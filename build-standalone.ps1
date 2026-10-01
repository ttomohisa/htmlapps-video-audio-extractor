param(
  [switch]$ForceDownload,
  [switch]$SkipSelfExtract,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatePath = Join-Path $Root "src\index.template.html"
$AppConfigPath = Join-Path $Root "app.config.json"
$AppIconPath = Join-Path $Root "assets\favicon.svg"
$DependenciesPath = Join-Path $Root "dependencies.json"
$DependencyLockPath = Join-Path $Root "dependencies.lock.json"
$VerifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$SelfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$CacheRoot = Join-Path $Root ".cache"
$DistRoot = Join-Path $Root "dist"
$FfmpegVendorRoot = Join-Path $Root "vendor\ffmpeg"
$FfmpegJsGzipPath = Join-Path $FfmpegVendorRoot "ffmpeg.js.gz"
$FfmpegWasmGzipPath = Join-Path $FfmpegVendorRoot "ffmpeg.wasm.gz"
$FfmpegRuntimePath = Join-Path $FfmpegVendorRoot "browser-ffmpeg.js"
$FfmpegManifestPath = Join-Path $FfmpegVendorRoot "manifest.json"
$FfmpegProvenancePath = Join-Path $FfmpegVendorRoot "provenance.json"

$OutputPathWasSpecified = -not [string]::IsNullOrWhiteSpace($OutputPath)
if ($OutputPathWasSpecified -and -not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $Root $OutputPath
}

New-Item -ItemType Directory -Force -Path $CacheRoot, $DistRoot | Out-Null

function Write-Step([string]$Message) {
  Write-Host "[Single HTML] $Message" -ForegroundColor Cyan
}

function Get-Json([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Required file not found: $Path" }
  return Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json
}

function Get-Sha256FileHex([string]$Path) {
  if (-not (Test-Path $Path)) { throw "File not found for SHA-256: $Path" }
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $algorithm.ComputeHash($stream)
    return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Get-SafeId([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "Dependency id cannot be empty." }
  if ($Value -notmatch '^[a-z0-9][a-z0-9._-]*$') { throw "Dependency id '$Value' must use lowercase letters, numbers, dot, underscore, or hyphen." }
  return $Value
}

function Get-NpmPackage([string]$PackageName, [string]$Version) {
  if ([string]::IsNullOrWhiteSpace($PackageName) -or [string]::IsNullOrWhiteSpace($Version)) {
    throw "Every dependency requires package and version."
  }

  $packageKey = (($PackageName -replace "[^A-Za-z0-9._-]", "-") + "-" + $Version)
  $packageRoot = Join-Path $CacheRoot $packageKey
  $extractRoot = Join-Path $packageRoot "extracted"
  $packageDir = Join-Path $extractRoot "package"
  $archivePath = Join-Path $packageRoot "package.tgz"
  $metadataPath = Join-Path $packageRoot "metadata.json"

  if ($ForceDownload -and (Test-Path $packageRoot)) {
    Remove-Item -Recurse -Force $packageRoot
  }

  New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

  if (-not (Test-Path $archivePath)) {
    $encodedPackage = [Uri]::EscapeDataString($PackageName)
    $metadataUrl = "https://registry.npmjs.org/$encodedPackage/$Version"
    Write-Step "Resolving $PackageName@$Version"
    $metadata = Invoke-RestMethod -Uri $metadataUrl -UseBasicParsing -Headers @{ "User-Agent" = "single-html-app-template/1.0" }
    if (-not $metadata.dist.tarball) { throw "npm metadata did not contain a tarball URL for $PackageName@$Version" }
    $metadata | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $metadataPath
    $partialPath = "$archivePath.part"
    Remove-Item -Force -ErrorAction SilentlyContinue $partialPath
    Write-Step "Downloading $PackageName@$Version"
    Invoke-WebRequest -Uri ([string]$metadata.dist.tarball) -OutFile $partialPath -UseBasicParsing -Headers @{ "User-Agent" = "single-html-app-template/1.0" }
    Move-Item -Force $partialPath $archivePath
  } else {
    Write-Step "Using cached archive for $PackageName@$Version"
  }

  if (-not (Test-Path $packageDir)) {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    Write-Step "Extracting $PackageName@$Version"
    & tar.exe -xzf $archivePath -C $extractRoot
    if ($LASTEXITCODE -ne 0) { throw "tar.exe failed while extracting $archivePath" }
  }

  $packageJsonPath = Join-Path $packageDir "package.json"
  if (-not (Test-Path $packageJsonPath)) { throw "package.json was not found in $packageDir" }
  $actualVersion = [string]((Get-Content -Raw -Encoding UTF8 $packageJsonPath | ConvertFrom-Json).version)
  if ($actualVersion -ne $Version) { throw "Expected $PackageName@$Version but the archive contains $actualVersion" }

  return [ordered]@{
    Root = $packageDir
    Archive = $archivePath
    ArchiveSha256 = (Get-Sha256FileHex $archivePath)
  }
}

function Get-MimeType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".js" { return "text/javascript" }
    ".mjs" { return "text/javascript" }
    ".css" { return "text/css" }
    ".json" { return "application/json" }
    ".wasm" { return "application/wasm" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    ".woff" { return "font/woff" }
    ".woff2" { return "font/woff2" }
    ".txt" { return "text/plain" }
    default { return "application/octet-stream" }
  }
}

function Get-AssetBytes([string]$Path, [bool]$StripSourceMapComment) {
  if (-not (Test-Path $Path)) { throw "Dependency asset not found: $Path" }
  if ($StripSourceMapComment -and [System.IO.Path]::GetExtension($Path) -in @(".js", ".mjs", ".css")) {
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $text = [regex]::Replace($text, "(?m)^\s*//# sourceMappingURL=.*$", "")
    $text = [regex]::Replace($text, "(?m)^\s*/\*# sourceMappingURL=.*?\*/\s*$", "")
    return [System.Text.Encoding]::UTF8.GetBytes($text)
  }
  return [System.IO.File]::ReadAllBytes($Path)
}


function Compress-GzipBytes([byte[]]$Bytes) {
  $output = New-Object System.IO.MemoryStream
  $gzip = New-Object System.IO.Compression.GZipStream -ArgumentList @(
    $output,
    [System.IO.Compression.CompressionMode]::Compress,
    $true
  )
  try {
    $gzip.Write($Bytes, 0, $Bytes.Length)
  } finally {
    $gzip.Dispose()
  }
  try {
    return ,$output.ToArray()
  } finally {
    $output.Dispose()
  }
}

function Get-OptionalNumber([object]$Object, [string]$Name, [double]$Fallback = 0) {
  if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
    return [double]$Object.$Name
  }
  return $Fallback
}

function ConvertTo-SafeJson([object]$Value, [int]$Depth = 30) {
  return ($Value | ConvertTo-Json -Compress -Depth $Depth).Replace("<", "\u003c").Replace(">", "\u003e").Replace("&", "\u0026")
}

function Get-RelativeAssetPath([string]$PackageRoot, [string]$ConfiguredPath) {
  if ([string]::IsNullOrWhiteSpace($ConfiguredPath)) { throw "Dependency asset path cannot be empty." }
  $rootFull = [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd([char[]]@([char]92, [char]47))
  $assetFull = [System.IO.Path]::GetFullPath((Join-Path $PackageRoot $ConfiguredPath))
  if (-not $assetFull.StartsWith($rootFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Dependency asset path escapes the package root: $ConfiguredPath"
  }
  return $assetFull
}

if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
  throw "tar.exe was not found. Use a current Windows 10/11 environment, or install bsdtar and expose it as tar.exe."
}

if (-not (Test-Path -LiteralPath $AppIconPath -PathType Leaf)) {
  throw "Canonical app icon was not found: $AppIconPath"
}
$appIconBytes = [System.IO.File]::ReadAllBytes($AppIconPath)
$appIconDataUri = "data:image/svg+xml;base64," + [Convert]::ToBase64String($appIconBytes)

$appConfig = Get-Json $AppConfigPath
$dependencyConfig = Get-Json $DependenciesPath
$dependencyLock = Get-Json $DependencyLockPath
$rootHtmlOutputPath = ""
$rootHtmlOutputName = ""
if (-not $OutputPathWasSpecified) {
  $configuredOutput = [string]$appConfig.build.output
  if ([string]::IsNullOrWhiteSpace($configuredOutput)) { $configuredOutput = "dist/index.html" }
  $OutputPath = if ([System.IO.Path]::IsPathRooted($configuredOutput)) { $configuredOutput } else { Join-Path $Root $configuredOutput }

  $repositoryName = [string]$appConfig.repository.name
  if ([string]::IsNullOrWhiteSpace($repositoryName)) {
    throw "app.config.json: repository.name is required to generate the repository-root HTML copy."
  }
  $rootHtmlBaseName = $repositoryName
  if ($rootHtmlBaseName.StartsWith("htmlapps-", [System.StringComparison]::OrdinalIgnoreCase)) {
    $rootHtmlBaseName = $rootHtmlBaseName.Substring("htmlapps-".Length)
  }
  if ([string]::IsNullOrWhiteSpace($rootHtmlBaseName) -or $rootHtmlBaseName -in @(".", "..")) {
    throw "app.config.json: repository.name does not produce a valid repository-root HTML filename."
  }
  if ($rootHtmlBaseName.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
    throw "app.config.json: repository.name contains characters that cannot be used in the repository-root HTML filename."
  }
  $rootHtmlOutputName = $rootHtmlBaseName + ".html"
  $rootHtmlOutputPath = Join-Path $Root $rootHtmlOutputName
}
if (-not $dependencyConfig.dependencies) { $dependencies = @() } else { $dependencies = @($dependencyConfig.dependencies) }
if (-not ($dependencyLock.PSObject.Properties.Name -contains "schemaVersion") -or [int]$dependencyLock.schemaVersion -ne 1) {
  throw "dependencies.lock.json must use schemaVersion 1."
}
if (-not $dependencyLock.dependencies) { $lockedDependencies = @() } else { $lockedDependencies = @($dependencyLock.dependencies) }
$lockById = @{}
foreach ($lockedDependency in $lockedDependencies) {
  $lockedId = Get-SafeId ([string]$lockedDependency.id)
  if ($lockById.ContainsKey($lockedId)) { throw "Duplicate dependency lock id: $lockedId" }
  $lockById[$lockedId] = $lockedDependency
}
if ($lockedDependencies.Count -ne $dependencies.Count) {
  throw "dependencies.lock.json does not match dependencies.json. Run .\scripts\sync-dependency-lock.ps1 after changing dependencies."
}

$ids = @{}
$assetBundle = [ordered]@{ schemaVersion = 2; dependencies = [ordered]@{} }
$manifestDependencies = @()

foreach ($dependency in $dependencies) {
  $id = Get-SafeId ([string]$dependency.id)
  if ($ids.ContainsKey($id)) { throw "Duplicate dependency id: $id" }
  $ids[$id] = $true

  if (-not $lockById.ContainsKey($id)) {
    throw "dependencies.lock.json has no entry for '$id'. Run .\scripts\sync-dependency-lock.ps1 -Id $id."
  }
  $lockedDependency = $lockById[$id]
  if ([string]$lockedDependency.package -ne [string]$dependency.package -or [string]$lockedDependency.version -ne [string]$dependency.version) {
    throw "Dependency lock mismatch for '$id'. Run .\scripts\sync-dependency-lock.ps1 -Id $id."
  }
  if ([string]$lockedDependency.tarballSha256 -notmatch '^[a-f0-9]{64}$') {
    throw "Dependency lock for '$id' has an invalid tarballSha256."
  }

  $package = Get-NpmPackage ([string]$dependency.package) ([string]$dependency.version)
  if ($package.ArchiveSha256 -ne [string]$lockedDependency.tarballSha256) {
    throw "Locked tarball SHA-256 mismatch for '$id'. Expected $([string]$lockedDependency.tarballSha256), got $($package.ArchiveSha256). Refusing to build."
  }
  $dependencyAssets = [ordered]@{}
  $manifestAssets = @()
  $assetKeys = @{}

  foreach ($asset in @($dependency.assets)) {
    $key = Get-SafeId ([string]$asset.key)
    if ($assetKeys.ContainsKey($key)) { throw "Duplicate asset key '$key' in dependency '$id'." }
    $assetKeys[$key] = $true

    $assetPath = Get-RelativeAssetPath $package.Root ([string]$asset.path)
    $strip = $false
    if ($asset.PSObject.Properties.Name -contains "stripSourceMapComment") { $strip = [bool]$asset.stripSourceMapComment }
    $bytes = Get-AssetBytes $assetPath $strip
    $configuredMime = ""
    if ($asset.PSObject.Properties.Name -contains "mime") { $configuredMime = [string]$asset.mime }
    $mime = if ([string]::IsNullOrWhiteSpace($configuredMime)) { Get-MimeType $assetPath } else { $configuredMime }
    $shaAlgorithm = [Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $shaAlgorithm.ComputeHash($bytes)
    } finally {
      $shaAlgorithm.Dispose()
    }
    $sha = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $compressionSetting = "none"
    if ($asset.PSObject.Properties.Name -contains "compression") { $compressionSetting = ([string]$asset.compression).ToLowerInvariant() }
    if ($compressionSetting -notin @("none", "gzip", "auto")) {
      throw "Unsupported compression '$compressionSetting' for $id/$key. Use none, gzip, or auto."
    }

    $storedBytes = $bytes
    $resolvedCompression = "none"
    if ($compressionSetting -in @("gzip", "auto")) {
      $gzipBytes = Compress-GzipBytes $bytes
      if ($compressionSetting -eq "gzip" -or $gzipBytes.Length -lt $bytes.Length) {
        $storedBytes = $gzipBytes
        $resolvedCompression = "gzip"
      }
    }

    $dependencyAssets[$key] = [ordered]@{
      mime = $mime
      compression = $resolvedCompression
      originalBytes = $bytes.Length
      storedBytes = $storedBytes.Length
      base64 = [Convert]::ToBase64String($storedBytes)
    }
    $manifestAssets += [ordered]@{
      key = $key
      path = [string]$asset.path
      mime = $mime
      compression = $resolvedCompression
      bytes = $bytes.Length
      storedBytes = $storedBytes.Length
      sha256 = $sha
    }
  }

  $assetBundle.dependencies[$id] = [ordered]@{
    package = [string]$dependency.package
    version = [string]$dependency.version
    assets = $dependencyAssets
  }
  $license = ""
  $homepage = ""
  if ($dependency.PSObject.Properties.Name -contains "license") { $license = [string]$dependency.license }
  if ($dependency.PSObject.Properties.Name -contains "homepage") { $homepage = [string]$dependency.homepage }
  $manifestDependencies += [ordered]@{
    id = $id
    package = [string]$dependency.package
    version = [string]$dependency.version
    license = $license
    homepage = $homepage
    tarballSha256 = $package.ArchiveSha256
    locked = $true
    assets = $manifestAssets
  }
}

foreach ($required in @($FfmpegJsGzipPath, $FfmpegWasmGzipPath, $FfmpegRuntimePath, $FfmpegManifestPath, $FfmpegProvenancePath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Video Audio Extractor FFmpeg core is missing: $required" }
}
$ffmpegManifest = Get-Json $FfmpegManifestPath
$ffmpegProvenance = Get-Json $FfmpegProvenancePath
if ([string]$ffmpegManifest.profile -ne "video-audio-extractor") { throw "Embedded FFmpeg manifest profile must be video-audio-extractor." }
try { $ffmpegBuilderVersion = [version][string]$ffmpegManifest.builderVersion } catch { throw "Embedded FFmpeg manifest has an invalid builderVersion." }
if ($ffmpegBuilderVersion -ne [version]"1.10.0") { throw "Video Audio Extractor v1.0.0 is pinned to FFmpeg WASM Builder v1.10.0." }
if ([string]$ffmpegProvenance.sourceType -ne "github-release") { throw "Release builds must use tagged GitHub Release provenance." }
if ([string]$ffmpegProvenance.repository -ne "ttomohisa/htmlapps-ffmpeg-wasm-builder") { throw "Unexpected FFmpeg WASM Builder repository in provenance." }
if ([string]$ffmpegProvenance.tag -ne "v1.10.0") { throw "Release builds must pin Builder tag v1.10.0." }
if ([string]$ffmpegProvenance.releaseCommit -ne "c0f90882b9b9e5a724f10b1ae3e17a25d0b12d9c") { throw "Builder release commit does not match v1.10.0." }
if ([string]$ffmpegProvenance.releaseAsset.name -ne "ffmpeg-wasm-video-audio-extractor-v1.10.0.zip") { throw "Unexpected Video Audio Extractor release asset name." }
if ([long]$ffmpegProvenance.releaseAsset.sizeBytes -ne 1632881) { throw "Unexpected Video Audio Extractor release asset size." }
if ([string]$ffmpegProvenance.releaseAsset.sha256 -ne "e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f") { throw "Unexpected Video Audio Extractor release asset SHA-256." }
if ([bool]$ffmpegProvenance.developmentOnly) { throw "Release builds must not use development-only FFmpeg provenance." }
if ([string]$ffmpegProvenance.manifestSha256 -ne (Get-Sha256FileHex $FfmpegManifestPath)) { throw "Vendored FFmpeg manifest SHA-256 does not match provenance." }
if (-not $ffmpegManifest.runtime.fileProtocolSingleHtml) { throw "Embedded FFmpeg runtime must support file:// single HTML." }
if ($ffmpegManifest.runtime.requiresSharedArrayBuffer -or $ffmpegManifest.runtime.requiresCrossOriginIsolation) { throw "Video Audio Extractor standalone runtime must not require SharedArrayBuffer or cross-origin isolation." }
if (-not $ffmpegManifest.runtime.workerFsInput) { throw "Video Audio Extractor requires WORKERFS input." }
$ffmpegCopyFormats = @($ffmpegManifest.capabilities.copyFormats | ForEach-Object { [string]$_ })
if (($ffmpegCopyFormats -join ",") -ne "m4a,opus,mp3,ogg,flac") { throw "Embedded FFmpeg core must expose the verified copy matrix: m4a,opus,mp3,ogg,flac." }
if (-not $ffmpegManifest.capabilities.transcode) { throw "Embedded FFmpeg core must expose audio transcoding." }
$ffmpegTranscodeFormats = @($ffmpegManifest.capabilities.transcodeFormats | ForEach-Object { [string]$_ })
if (($ffmpegTranscodeFormats -join ",") -ne "m4a,wav,mp3") { throw "Embedded FFmpeg core must expose M4A, WAV, and MP3 transcoding." }
$ffmpegAacBitrates = @($ffmpegManifest.capabilities.aacBitratesKbps | ForEach-Object { [int]$_ })
if (($ffmpegAacBitrates -join ",") -ne "128,192,256") { throw "Embedded FFmpeg core must expose AAC bitrates 128,192,256 kbps." }
$ffmpegMp3Bitrates = @($ffmpegManifest.capabilities.mp3BitratesKbps | ForEach-Object { [int]$_ })
if (($ffmpegMp3Bitrates -join ",") -ne "128,192,256,320") { throw "Embedded FFmpeg core must expose MP3 bitrates 128,192,256,320 kbps." }
$ffmpegMp3Channels = @($ffmpegManifest.capabilities.mp3Channels | ForEach-Object { [int]$_ })
if (($ffmpegMp3Channels -join ",") -ne "1,2") { throw "Embedded FFmpeg core must expose mono/stereo MP3 output." }
if ([string]$ffmpegManifest.capabilities.mp3Encoder -ne "libmp3lame") { throw "Embedded FFmpeg core must use libmp3lame for MP3 output." }
if ([int]$ffmpegManifest.capabilities.pcmBits -ne 16) { throw "Embedded FFmpeg core must expose PCM 16-bit WAV output." }
$ffmpegRuntimeSource = [System.IO.File]::ReadAllText($FfmpegRuntimePath, [System.Text.Encoding]::UTF8)
foreach ($marker in @("videoAudioExtractorInspectArgs", "videoAudioExtractorCopyArgs", "videoAudioExtractorTranscodeArgs", "options.signal")) {
  if (-not $ffmpegRuntimeSource.Contains($marker)) { throw "Embedded FFmpeg runtime is missing required marker: $marker" }
}
if ($ffmpegRuntimeSource -match '(?i)</script') { throw "Embedded FFmpeg runtime must not contain a closing script tag." }
$ffmpegJsGzipBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($FfmpegJsGzipPath))
$ffmpegWasmGzipBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($FfmpegWasmGzipPath))

$manifest = [ordered]@{
  schemaVersion = 2
  builder = "single-html-app-template/1.3"
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  app = [ordered]@{
    name = [string]$appConfig.name
    slug = [string]$appConfig.slug
    version = [string]$appConfig.version
  }
  dependencies = $manifestDependencies
  embeddedRuntime = [ordered]@{
    ffmpeg = [ordered]@{
      profile = [string]$ffmpegManifest.profile
      builderVersion = [string]$ffmpegManifest.builderVersion
      binaryLicense = [string]$ffmpegManifest.binaryLicense
      fileProtocolSingleHtml = [bool]$ffmpegManifest.runtime.fileProtocolSingleHtml
      workerFsInput = [bool]$ffmpegManifest.runtime.workerFsInput
      requiresSharedArrayBuffer = [bool]$ffmpegManifest.runtime.requiresSharedArrayBuffer
      requiresCrossOriginIsolation = [bool]$ffmpegManifest.runtime.requiresCrossOriginIsolation
      source = $ffmpegProvenance
      files = [ordered]@{
        "ffmpeg.js.gz" = [ordered]@{ bytes = (Get-Item $FfmpegJsGzipPath).Length; sha256 = (Get-Sha256FileHex $FfmpegJsGzipPath) }
        "ffmpeg.wasm.gz" = [ordered]@{ bytes = (Get-Item $FfmpegWasmGzipPath).Length; sha256 = (Get-Sha256FileHex $FfmpegWasmGzipPath) }
        "browser-ffmpeg.js" = [ordered]@{ bytes = (Get-Item $FfmpegRuntimePath).Length; sha256 = (Get-Sha256FileHex $FfmpegRuntimePath) }
      }
    }
  }
}

Write-Step "Generating standalone HTML"
$template = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)
$assetBundleJson = ConvertTo-SafeJson $assetBundle 50
$replacements = [ordered]@{
  "__APP_CONFIG_JSON__" = ConvertTo-SafeJson $appConfig 20
  "__BUILD_MANIFEST_JSON__" = ConvertTo-SafeJson $manifest 40
  "__EMBEDDED_ASSET_BUNDLE_JSON__" = $assetBundleJson
  "__APP_ICON_DATA_URI__" = $appIconDataUri
  "__FFMPEG_JS_GZIP_BASE64__" = $ffmpegJsGzipBase64
  "__FFMPEG_WASM_GZIP_BASE64__" = $ffmpegWasmGzipBase64
  "__FFMPEG_RUNTIME_SOURCE__" = $ffmpegRuntimeSource
}
$replacementExpectedCounts = @{
  "__APP_CONFIG_JSON__" = 1
  "__BUILD_MANIFEST_JSON__" = 1
  "__EMBEDDED_ASSET_BUNDLE_JSON__" = 1
  "__APP_ICON_DATA_URI__" = 2
  "__FFMPEG_JS_GZIP_BASE64__" = 1
  "__FFMPEG_WASM_GZIP_BASE64__" = 1
  "__FFMPEG_RUNTIME_SOURCE__" = 1
}

foreach ($entry in $replacements.GetEnumerator()) {
  $count = ([regex]::Matches($template, [regex]::Escape($entry.Key))).Count
  $expectedCount = [int]$replacementExpectedCounts[$entry.Key]
  if ($count -ne $expectedCount) {
    throw "Template placeholder $($entry.Key) must occur exactly $expectedCount time(s); found $count."
  }
  $template = $template.Replace($entry.Key, [string]$entry.Value)
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
[System.IO.File]::WriteAllText($OutputPath, $template, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory "dependency-manifest.json"), ($manifest | ConvertTo-Json -Depth 40), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory ".nojekyll"), "", (New-Object System.Text.UTF8Encoding($false)))

& $VerifyPath `
  -Path $OutputPath `
  -RequireNetworkBlock ([bool]$appConfig.build.blockRuntimeNetwork) `
  -ForbiddenPlaceholders @($replacements.Keys)

if (-not [string]::IsNullOrWhiteSpace($rootHtmlOutputPath)) {
  [System.IO.File]::Copy($OutputPath, $rootHtmlOutputPath, $true)
}

$selfExtractEnabled = $false
$selfExtractOutputPath = ""
if (-not $SkipSelfExtract -and ($appConfig.build.PSObject.Properties.Name -contains "selfExtract")) {
  $selfExtractConfig = $appConfig.build.selfExtract
  if ($selfExtractConfig -and ($selfExtractConfig.PSObject.Properties.Name -contains "enabled")) {
    $selfExtractEnabled = [bool]$selfExtractConfig.enabled
  }
  if ($selfExtractEnabled) {
    if (-not ($selfExtractConfig.PSObject.Properties.Name -contains "output")) {
      throw "app.config.json: build.selfExtract.output is required when self-extract output is enabled."
    }
    if ($OutputPathWasSpecified) {
      $customDirectory = Split-Path -Parent $OutputPath
      $customBaseName = [System.IO.Path]::GetFileNameWithoutExtension($OutputPath)
      $selfExtractOutputPath = Join-Path $customDirectory ($customBaseName + ".self-extract.html")
    } else {
      $configuredSelfExtractOutput = [string]$selfExtractConfig.output
      if ([string]::IsNullOrWhiteSpace($configuredSelfExtractOutput)) {
        throw "app.config.json: build.selfExtract.output cannot be empty."
      }
      $selfExtractOutputPath = if ([System.IO.Path]::IsPathRooted($configuredSelfExtractOutput)) {
        $configuredSelfExtractOutput
      } else {
        Join-Path $Root $configuredSelfExtractOutput
      }
    }

    Write-Step "Generating self-extracting HTML"
    & $SelfExtractBuilderPath `
      -InputPath $OutputPath `
      -OutputPath $selfExtractOutputPath `
      -AppName ([string]$appConfig.name) `
      -AppNameJa ([string]$appConfig.nameJa)
  }
}

$readableBytes = (Get-Item $OutputPath).Length
$selfExtractBytes = 0
if ($selfExtractEnabled -and (Test-Path $selfExtractOutputPath)) { $selfExtractBytes = (Get-Item $selfExtractOutputPath).Length }
$assetRawBytes = 0
$assetStoredBytes = 0
$sizeAssets = @()
$ffmpegJsRawBytes = [long]$ffmpegManifest.files."ffmpeg.js".bytes
$ffmpegWasmRawBytes = [long]$ffmpegManifest.files."ffmpeg.wasm".bytes
$ffmpegRuntimeBytes = [long]((Get-Item $FfmpegRuntimePath).Length)
$ffmpegJsStoredBytes = [long]((Get-Item $FfmpegJsGzipPath).Length)
$ffmpegWasmStoredBytes = [long]((Get-Item $FfmpegWasmGzipPath).Length)
$assetRawBytes += $ffmpegJsRawBytes + $ffmpegWasmRawBytes + $ffmpegRuntimeBytes
$assetStoredBytes += $ffmpegJsStoredBytes + $ffmpegWasmStoredBytes + $ffmpegRuntimeBytes
$sizeAssets += [ordered]@{ dependency = "ffmpeg"; key = "ffmpeg.js"; compression = "gzip"; originalBytes = $ffmpegJsRawBytes; storedBytes = $ffmpegJsStoredBytes }
$sizeAssets += [ordered]@{ dependency = "ffmpeg"; key = "ffmpeg.wasm"; compression = "gzip"; originalBytes = $ffmpegWasmRawBytes; storedBytes = $ffmpegWasmStoredBytes }
$sizeAssets += [ordered]@{ dependency = "ffmpeg"; key = "browser-ffmpeg.js"; compression = "none"; originalBytes = $ffmpegRuntimeBytes; storedBytes = $ffmpegRuntimeBytes }
foreach ($dependencyEntry in $manifestDependencies) {
  foreach ($assetEntry in @($dependencyEntry.assets)) {
    $assetRawBytes += [long]$assetEntry.bytes
    $assetStoredBytes += [long]$assetEntry.storedBytes
    $sizeAssets += [ordered]@{
      dependency = [string]$dependencyEntry.id
      key = [string]$assetEntry.key
      compression = [string]$assetEntry.compression
      originalBytes = [long]$assetEntry.bytes
      storedBytes = [long]$assetEntry.storedBytes
    }
  }
}
$sizeReport = [ordered]@{
  schemaVersion = 1
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  readableHtmlBytes = [long]$readableBytes
  selfExtractHtmlBytes = [long]$selfExtractBytes
  embeddedAssetOriginalBytes = [long]$assetRawBytes
  embeddedAssetStoredBytes = [long]$assetStoredBytes
  embeddedAssetSavedBytes = [long]($assetRawBytes - $assetStoredBytes)
  assets = $sizeAssets
}
$sizeReportPath = Join-Path (Split-Path -Parent $OutputPath) "build-size-report.json"
[System.IO.File]::WriteAllText($sizeReportPath, ($sizeReport | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "[Size] Readable HTML: $([Math]::Round($readableBytes / 1MB, 2)) MB"
if ($selfExtractBytes -gt 0) { Write-Host "[Size] Self-extract HTML: $([Math]::Round($selfExtractBytes / 1MB, 2)) MB" }
Write-Host "[Size] Embedded assets: $([Math]::Round($assetRawBytes / 1MB, 2)) MB raw -> $([Math]::Round($assetStoredBytes / 1MB, 2)) MB stored"
Write-Host "[Size] Report: $sizeReportPath"

if ($appConfig.build.PSObject.Properties.Name -contains "sizeBudget" -and $appConfig.build.sizeBudget) {
  $readableBudget = Get-OptionalNumber $appConfig.build.sizeBudget "readableWarningMb" 0
  $selfExtractBudget = Get-OptionalNumber $appConfig.build.sizeBudget "selfExtractWarningMb" 0
  $readableMb = $readableBytes / 1MB
  $selfExtractMb = $selfExtractBytes / 1MB
  if ($readableBudget -gt 0 -and $readableMb -gt $readableBudget) {
    Write-Warning ("Readable HTML size {0:N2} MB exceeds warning budget {1:N2} MB." -f $readableMb, $readableBudget)
  }
  if ($selfExtractBytes -gt 0 -and $selfExtractBudget -gt 0 -and $selfExtractMb -gt $selfExtractBudget) {
    Write-Warning ("Self-extract HTML size {0:N2} MB exceeds warning budget {1:N2} MB." -f $selfExtractMb, $selfExtractBudget)
  }
}

$outputHash = Get-Sha256FileHex $OutputPath
$outputSizeMb = [Math]::Round($readableBytes / 1MB, 2)
Write-Host ""
Write-Host "[OK] Standalone HTML: $OutputPath" -ForegroundColor Green
Write-Host "[OK] Size: $outputSizeMb MB"
Write-Host "[OK] SHA-256: $outputHash"
Write-Host "[OK] Fetch/XHR/WebSocket-style runtime network access is blocked by CSP."
if ($selfExtractEnabled) {
  Write-Host "[OK] Self-extracting HTML: $selfExtractOutputPath" -ForegroundColor Green
}
