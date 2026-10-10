param(
  [switch]$ForceDownload
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Get-Sha256FileHex([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "File not found for SHA-256: $Path" }
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($algorithm.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

$required = @(
  "AGENTS.md",
  "APP_SPEC.md",
  "app.config.json",
  "assets\favicon.svg",
  "dependencies.json",
  "dependencies.lock.json",
  ".github\workflows\dependency-updates.yml",
  "components\confirm-dialog.html",
  "components\toast.html",
  "components\popover-menu.html",
  "components\setting-field.html",
  "components\async-state.html",
  "components\mobile-bottom-bar.html",
  "components\webrtc-qr-pairing.html",
  "docs\COMPONENTS.md",
  "docs\DEPENDENCIES.md",
  "docs\DEPENDENCIES.ja.md",
  "docs\COMPONENTS.ja.md",
  "docs\WEBRTC_QR_PAIRING.md",
  "docs\WEBRTC_QR_PAIRING.ja.md",
  "examples\dependencies.webrtc-qr.json",
  "src\index.template.html",
  "build-standalone.ps1",
  "build-with-local-ffmpeg.bat",
  "import-release-ffmpeg.bat",
  "scripts\build-self-extract.ps1",
  "scripts\import-local-ffmpeg.ps1",
  "scripts\import-release-ffmpeg.ps1",
  "scripts\check-powershell-syntax.ps1",
  "scripts\dependency-tools.ps1",
  "scripts\check-dependency-updates.ps1",
  "scripts\sync-dependency-lock.ps1",
  "scripts\update-dependency.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "README.md",
  "README.ja.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json",
  "schemas\dependencies.schema.json",
  "schemas\dependencies-lock.schema.json"
)

foreach ($relative in $required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path $path)) { throw "Required repository file is missing: $relative" }
}

& (Join-Path $Root "scripts\check-powershell-syntax.ps1") -RootPath $Root

$mobileBottomBarPath = Join-Path $Root "components\mobile-bottom-bar.html"
$mobileBottomBarText = Get-Content -Raw -Encoding UTF8 $mobileBottomBarPath
$mobileBottomBarRequiredTokens = @(
  'position: fixed',
  'env(safe-area-inset-bottom)',
  'data-mobile-page-target',
  'app-mobile-page',
  'showPage',
  'currentPage',
  'data-mobile-target',
  'data-mobile-action',
  'disabled',
  'window.AppMobileBottomBar'
)
foreach ($token in $mobileBottomBarRequiredTokens) {
  if (-not $mobileBottomBarText.Contains($token)) {
    throw "components\mobile-bottom-bar.html is missing required behavior marker: $token"
  }
}


$componentContracts = @(
  @{ Path = "components\toast.html"; Tokens = @("window.AppToast", "actionLabel", "onAction", "env(safe-area-inset-bottom)") },
  @{ Path = "components\popover-menu.html"; Tokens = @("window.AppPopoverMenu", "data-popover-trigger", "aria-expanded", "Escape") },
  @{ Path = "components\setting-field.html"; Tokens = @("window.AppSettingField", "data-setting-custom", "data-setting-range", "settingchange") },
  @{ Path = "components\async-state.html"; Tokens = @("window.AppAsyncState", "invalidateSource", "captureGeneration", "isCurrent") },
  @{ Path = "components\webrtc-qr-pairing.html"; Tokens = @("window.AppWebRtcQrPairing", "iceServers:[]", "waitForIceComplete", "BarcodeDetector", "answerAutoRetryLimit", "StandaloneAssets", "createJoinAnswer", "payloadPrefix", "qrPrefix") }
)
foreach ($contract in $componentContracts) {
  $componentText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root $contract.Path)
  foreach ($token in @($contract.Tokens)) {
    if (-not $componentText.Contains([string]$token)) {
      throw "$($contract.Path) is missing required behavior marker: $token"
    }
  }
}

$dependencyConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "dependencies.json") | ConvertFrom-Json
$dependencyLock = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "dependencies.lock.json") | ConvertFrom-Json
if ([int]$dependencyLock.schemaVersion -ne 1) { throw "dependencies.lock.json must use schemaVersion 1." }
$configIds = @($dependencyConfig.dependencies | ForEach-Object { [string]$_.id })
$lockIds = @($dependencyLock.dependencies | ForEach-Object { [string]$_.id })
if ($configIds.Count -ne $lockIds.Count) { throw "dependencies.lock.json must contain exactly one entry for every dependency." }
foreach ($dependency in @($dependencyConfig.dependencies)) {
  $matches = @($dependencyLock.dependencies | Where-Object { [string]$_.id -eq [string]$dependency.id })
  if ($matches.Count -ne 1) { throw "dependencies.lock.json must contain exactly one lock entry for '$([string]$dependency.id)'." }
  if ([string]$matches[0].package -ne [string]$dependency.package -or [string]$matches[0].version -ne [string]$dependency.version) {
    throw "dependencies.lock.json does not match dependencies.json for '$([string]$dependency.id)'."
  }
}

$webrtcDependencyExample = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "examples\dependencies.webrtc-qr.json") | ConvertFrom-Json
$webrtcDependencyIds = @($webrtcDependencyExample.dependencies | ForEach-Object { [string]$_.id })
foreach ($requiredDependencyId in @("qrcode-generator", "jsqr")) {
  if ($webrtcDependencyIds -notcontains $requiredDependencyId) {
    throw "examples\dependencies.webrtc-qr.json is missing required dependency: $requiredDependencyId"
  }
}

$sourceText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "src\index.template.html")
if (-not $sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_JSON__")) { throw "src\index.template.html must embed the asset bundle JSON directly." }
if ($sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "Legacy double-Base64 asset bundle placeholder must not return." }
$iconPlaceholderCount = ([regex]::Matches($sourceText, [regex]::Escape("__APP_ICON_DATA_URI__"))).Count
if ($iconPlaceholderCount -ne 2) { throw "src\index.template.html must use __APP_ICON_DATA_URI__ exactly twice: favicon and header icon." }
if (-not $sourceText.Contains('id="appBrandIcon"')) { throw "src\index.template.html is missing the canonical header brand icon marker." }
foreach ($token in @("bytesAsync", "blobUrlAsync", "outputFilename", "window.AppToast")) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing required template behavior marker: $token" }
}

$builderText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "build-standalone.ps1")
foreach ($token in @("compressionSetting", "Compress-GzipBytes", "build-size-report.json", "sizeBudget", "DependencyLockPath", "tarballSha256", "__EMBEDDED_ASSET_BUNDLE_JSON__", "AppIconPath", "__APP_ICON_DATA_URI__", "__FFMPEG_JS_GZIP_BASE64__", "__FFMPEG_WASM_GZIP_BASE64__", "__FFMPEG_RUNTIME_SOURCE__", "video-audio-extractor", "rootHtmlOutputPath", 'StartsWith("htmlapps-"')) {
  if (-not $builderText.Contains($token)) { throw "build-standalone.ps1 is missing required asset pipeline marker: $token" }
}
if ($builderText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "build-standalone.ps1 must not wrap the full asset bundle in Base64." }

# Video Audio Extractor application contract.
foreach ($token in @("videoAudioExtractorInspectArgs", "videoAudioExtractorCopyArgs", "workerfs:true", "connect-src 'none'", 'data-mobile-page="video"', "outputFilename")) {
  if (-not $sourceText.Contains($token)) { throw "Video Audio Extractor source is missing required marker: $token" }
}
if ($sourceText -match 'File\s*\.\s*arrayBuffer\s*\(') { throw "Source video must use WORKERFS instead of File.arrayBuffer()." }
foreach ($token in @(
  "operationId:0",
  "isCurrentOperation(operationId,generation)",
  "downloadRequested:false",
  "file.data=new Uint8Array(0)",
  "event.persisted",
  "function disposeRunner()",
  "function clearAudioPreview"
)) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing v0.7 robustness marker: $token" }
}
if ($sourceText.Contains("state.result&&!state.result.saved")) { throw "Result replacement guard must use downloadRequested, not the old saved flag." }


# v0.8 privacy / offline / bilingual contract.
$allowedStorageKeys = @(
  "video-audio-extractor.aac-bitrate",
  "video-audio-extractor.language",
  "video-audio-extractor.mp3-bitrate",
  "video-audio-extractor.mp3-channels",
  "video-audio-extractor.output-mode"
)
$actualStorageKeys = @([regex]::Matches($sourceText, 'video-audio-extractor\.[a-z0-9-]+') | ForEach-Object { $_.Value } | Sort-Object -Unique)
if (($actualStorageKeys -join ",") -ne ($allowedStorageKeys -join ",")) {
  throw "v0.8 LocalStorage keys must remain limited to the five approved lightweight preferences. Found: $($actualStorageKeys -join ',')"
}
foreach ($token in @(
  "storedChoice(storageKeys.outputMode",
  "storedNumber(storageKeys.aacBitrate",
  "storedNumber(storageKeys.mp3Bitrate",
  "storedNumber(storageKeys.mp3Channels",
  "writeStorage(storageKeys.outputMode",
  "writeStorage(storageKeys.aacBitrate",
  "writeStorage(storageKeys.mp3Bitrate",
  "writeStorage(storageKeys.mp3Channels",
  "helpStorageTitle",
  "helpOfflineTitle",
  "helpPrivacyBody",
  "memoryError",
  "formatProcessError",
  "outputWriteError",
  "audioCodecLabel",
  "bitrateLabel",
  "sampleRateLabel",
  "channelsLabel"
)) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing v0.8 privacy/offline/bilingual marker: $token" }
}
foreach ($forbiddenNetworkToken in @("fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon")) {
  if ($sourceText.Contains($forbiddenNetworkToken)) { throw "Authored app source must not initiate runtime network access: $forbiddenNetworkToken" }
}
if ($sourceText -match 'https?://') { throw "Authored app source must not contain runtime HTTP(S) URLs." }
if ($sourceText.Contains("state.mp3Channels=track.channels") -or $sourceText.Contains("state.mp3Channels=initialTrack")) {
  throw "Changing a source/track must not overwrite the persisted MP3 mono/stereo preference."
}

foreach ($path in @("vendor\ffmpeg\ffmpeg.js.gz", "vendor\ffmpeg\ffmpeg.wasm.gz", "vendor\ffmpeg\browser-ffmpeg.js", "vendor\ffmpeg\manifest.json", "vendor\ffmpeg\provenance.json")) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root $path) -PathType Leaf)) { throw "Video Audio Extractor FFmpeg vendor file is missing: $path" }
}
$ffmpegManifestPath = Join-Path $Root "vendor\ffmpeg\manifest.json"
$ffmpegProvenancePath = Join-Path $Root "vendor\ffmpeg\provenance.json"
$ffmpegManifest = Get-Content -Raw -Encoding UTF8 $ffmpegManifestPath | ConvertFrom-Json
$ffmpegProvenance = Get-Content -Raw -Encoding UTF8 $ffmpegProvenancePath | ConvertFrom-Json
if ([string]$ffmpegManifest.profile -ne "video-audio-extractor") { throw "FFmpeg vendor profile must be video-audio-extractor." }
if ([string]$ffmpegManifest.builderVersion -ne "1.10.0") { throw "FFmpeg vendor must be pinned to Builder v1.10.0." }
if ([string]$ffmpegProvenance.sourceType -ne "github-release") { throw "FFmpeg provenance must be a tagged GitHub Release." }
if ([string]$ffmpegProvenance.tag -ne "v1.10.0") { throw "FFmpeg provenance must pin v1.10.0." }
if ([string]$ffmpegProvenance.releaseCommit -ne "c0f90882b9b9e5a724f10b1ae3e17a25d0b12d9c") { throw "FFmpeg provenance release commit mismatch." }
if ([string]$ffmpegProvenance.releaseAsset.name -ne "ffmpeg-wasm-video-audio-extractor-v1.10.0.zip") { throw "FFmpeg release asset name mismatch." }
if ([long]$ffmpegProvenance.releaseAsset.sizeBytes -ne 1632881) { throw "FFmpeg release asset size mismatch." }
if ([string]$ffmpegProvenance.releaseAsset.sha256 -ne "e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f") { throw "FFmpeg release asset SHA-256 mismatch." }
if ([bool]$ffmpegProvenance.developmentOnly) { throw "FFmpeg provenance must not be development-only." }
$ffmpegManifestHash = Get-Sha256FileHex $ffmpegManifestPath
if ([string]$ffmpegProvenance.manifestSha256 -ne $ffmpegManifestHash) { throw "FFmpeg manifest hash does not match provenance." }
if (-not $ffmpegManifest.runtime.workerFsInput) { throw "FFmpeg vendor runtime must support WORKERFS input." }
$ffmpegCopyFormats = @($ffmpegManifest.capabilities.copyFormats | ForEach-Object { [string]$_ })
if (($ffmpegCopyFormats -join ",") -ne "m4a,opus,mp3,ogg,flac") { throw "FFmpeg vendor must expose the verified copy matrix: m4a,opus,mp3,ogg,flac." }
if (-not $ffmpegManifest.capabilities.transcode) { throw "FFmpeg vendor must expose transcoding." }
$ffmpegTranscodeFormats = @($ffmpegManifest.capabilities.transcodeFormats | ForEach-Object { [string]$_ })
if (($ffmpegTranscodeFormats -join ",") -ne "m4a,wav,mp3") { throw "FFmpeg vendor must expose M4A, WAV, and MP3 transcoding." }
if ((@($ffmpegManifest.capabilities.aacBitratesKbps | ForEach-Object { [int]$_ }) -join ",") -ne "128,192,256") { throw "FFmpeg vendor must expose AAC bitrates 128,192,256 kbps." }
if ((@($ffmpegManifest.capabilities.mp3BitratesKbps | ForEach-Object { [int]$_ }) -join ",") -ne "128,192,256,320") { throw "FFmpeg vendor must expose MP3 bitrates 128,192,256,320 kbps." }
if ((@($ffmpegManifest.capabilities.mp3Channels | ForEach-Object { [int]$_ }) -join ",") -ne "1,2") { throw "FFmpeg vendor must expose mono/stereo MP3 output." }
if ([string]$ffmpegManifest.capabilities.mp3Encoder -ne "libmp3lame") { throw "FFmpeg vendor must use libmp3lame for MP3 output." }
if ([int]$ffmpegManifest.capabilities.pcmBits -ne 16) { throw "FFmpeg vendor must expose PCM 16-bit WAV output." }
foreach ($contractFile in @("build-standalone.ps1", "scripts\import-local-ffmpeg.ps1")) {
  $contractText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root $contractFile)
  if (-not $contractText.Contains("m4a,opus,mp3,ogg,flac")) { throw "$contractFile must enforce the v0.3.0 copy matrix." }
  if (-not $contractText.Contains("m4a,wav,mp3")) { throw "$contractFile must enforce the v0.4.0 transcode matrix." }
  if (-not $contractText.Contains("128,192,256,320")) { throw "$contractFile must enforce the v0.4.0 MP3 bitrate matrix." }
  if (-not $contractText.Contains("libmp3lame")) { throw "$contractFile must enforce the v0.4.0 MP3 encoder." }
}

$releaseImporterText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\import-release-ffmpeg.ps1")
foreach ($token in @(
  "v1.10.0",
  "ffmpeg-wasm-video-audio-extractor-v1.10.0.zip",
  "e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f",
  "1632881",
  "c0f90882b9b9e5a724f10b1ae3e17a25d0b12d9c",
  'developmentOnly = $false'
)) {
  if (-not $releaseImporterText.Contains($token)) { throw "scripts\import-release-ffmpeg.ps1 is missing pinned release marker: $token" }
}

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if (
  $selfExtractBuilderBytes.Length -ge 3 -and
  $selfExtractBuilderBytes[0] -eq 0xef -and
  $selfExtractBuilderBytes[1] -eq 0xbb -and
  $selfExtractBuilderBytes[2] -eq 0xbf
) {
  $selfExtractBuilderStart = 3
}
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) {
    throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text."
  }
}

$buildCompatibilityFiles = @(
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\check-powershell-syntax.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "scripts\dependency-tools.ps1",
  "scripts\check-dependency-updates.ps1",
  "scripts\sync-dependency-lock.ps1",
  "scripts\update-dependency.ps1",
  "scripts\import-local-ffmpeg.ps1",
  "scripts\import-release-ffmpeg.ps1"
)
foreach ($relative in $buildCompatibilityFiles) {
  $compatibilityPath = Join-Path $Root $relative
  $compatibilityText = Get-Content -Raw -Encoding UTF8 $compatibilityPath
  if ($compatibilityText -match '(?i)\bGet-FileHash\b') {
    throw "$relative must not depend on Get-FileHash; use the .NET SHA-256 helper for broader Windows PowerShell compatibility."
  }
  if ($compatibilityText -match '::new\s*\(') {
    throw "$relative must not use ::new(); use New-Object or older-compatible .NET construction syntax."
  }
}

# Regression check: dependency update reporting must handle both zero dependencies and one disabled dependency without network access.
$dependencyUpdateCheckPath = Join-Path $Root "scripts\check-dependency-updates.ps1"
$dependencyUpdateTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-dependency-check-" + [Guid]::NewGuid().ToString("N"))
$dependencyUpdateCases = @(
  @{
    Name = "empty"
    Json = '{"dependencies":[]}'
    DependencyCount = 0
    CheckedCount = 0
    DisabledCount = 0
  },
  @{
    Name = "single-disabled"
    Json = '{"dependencies":[{"id":"fixture","package":"fixture-package","version":"1.0.0","updates":{"enabled":false,"policy":"manual"}}]}'
    DependencyCount = 1
    CheckedCount = 0
    DisabledCount = 1
  }
)
try {
  New-Item -ItemType Directory -Force -Path $dependencyUpdateTestRoot | Out-Null
  foreach ($case in $dependencyUpdateCases) {
    $caseRoot = Join-Path $dependencyUpdateTestRoot ([string]$case.Name)
    New-Item -ItemType Directory -Force -Path $caseRoot | Out-Null
    $caseDependenciesPath = Join-Path $caseRoot "dependencies.json"
    $caseJsonOutput = Join-Path $caseRoot "report.json"
    $caseMarkdownOutput = Join-Path $caseRoot "report.md"
    [System.IO.File]::WriteAllText($caseDependenciesPath, [string]$case.Json, (New-Object System.Text.UTF8Encoding($false)))
    & $dependencyUpdateCheckPath -DependenciesPath $caseDependenciesPath -JsonOutput $caseJsonOutput -MarkdownOutput $caseMarkdownOutput
    $caseReport = Get-Content -Raw -Encoding UTF8 $caseJsonOutput | ConvertFrom-Json
    if ([int]$caseReport.dependencyCount -ne [int]$case.DependencyCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected dependencyCount." }
    if ([int]$caseReport.checkedCount -ne [int]$case.CheckedCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected checkedCount." }
    if ([int]$caseReport.disabledCount -ne [int]$case.DisabledCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected disabledCount." }
    if ([int]$caseReport.updateCount -ne 0) { throw "Dependency update regression '$($case.Name)' must not report updates." }
  }
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $dependencyUpdateTestRoot
}

# Regression check: runtime identifiers like __APP_INTERNAL_STATE__ are not build placeholders.
$verifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$tempVerifyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-verify-" + [Guid]::NewGuid().ToString("N") + ".html")
$syntheticHtml = @'
<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'">
</head><body><script>const __APP_INTERNAL_STATE__ = 1;</script></body></html>
'@
try {
  [System.IO.File]::WriteAllText($tempVerifyPath, $syntheticHtml, (New-Object System.Text.UTF8Encoding($false)))
  & $verifyPath -Path $tempVerifyPath -RequireNetworkBlock $true -RequireCanonicalIcon $false
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tempVerifyPath
}

$templateText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "src\index.template.html")
if (-not $templateText.Contains("'wasm-unsafe-eval'")) { throw "src\index.template.html must allow WebAssembly compilation with wasm-unsafe-eval." }
if (-not $templateText.Contains("[hidden]{display:none!important}")) { throw "src\index.template.html must keep hidden workflow states visually hidden." }

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$app.name)) { throw "app.config.json: name is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.slug)) { throw "app.config.json: slug is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.version)) { throw "app.config.json: version is required" }

# Execute app behavior before packaging so filename regressions fail the build.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required for app behavior regression checks." }
$filenameTestPath = Join-Path $Root "scripts\test-output-filename.cjs"
& node $filenameTestPath
if ($LASTEXITCODE -ne 0) { throw "Source filename behavior regression failed." }
$headerTestPath = Join-Path $Root "scripts\test-header.cjs"
& node $headerTestPath
if ($LASTEXITCODE -ne 0) { throw "Source header behavior regression failed." }

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
& (Join-Path $Root "build-standalone.ps1") @buildArguments

$repositoryName = [string]$app.repository.name
if ([string]::IsNullOrWhiteSpace($repositoryName)) { throw "app.config.json: repository.name is required" }
$rootHtmlBaseName = $repositoryName
if ($rootHtmlBaseName.StartsWith("htmlapps-", [System.StringComparison]::OrdinalIgnoreCase)) {
  $rootHtmlBaseName = $rootHtmlBaseName.Substring("htmlapps-".Length)
}
$rootHtmlPath = Join-Path $Root ($rootHtmlBaseName + ".html")
if (-not (Test-Path -LiteralPath $rootHtmlPath -PathType Leaf)) { throw "Repository-root HTML was not generated: $rootHtmlPath" }
$configuredOutput = [string]$app.build.output
$readableOutputPath = if ([System.IO.Path]::IsPathRooted($configuredOutput)) { $configuredOutput } else { Join-Path $Root $configuredOutput }
$rootBytes = [System.IO.File]::ReadAllBytes($rootHtmlPath)
$readableBytes = [System.IO.File]::ReadAllBytes($readableOutputPath)
if ($rootBytes.Length -ne $readableBytes.Length) { throw "Repository-root HTML must match the readable standalone HTML." }
for ($i = 0; $i -lt $rootBytes.Length; $i += 1) {
  if ($rootBytes[$i] -ne $readableBytes[$i]) { throw "Repository-root HTML must be an exact copy of the readable standalone HTML." }
}

# v1.0 desktop result navigation regression.
foreach ($token in @("function navigateToStep(page", "extractAgainButton').onclick=()=>navigateToStep('format')", "resultBackButton').onclick=()=>navigateToStep('format')")) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing v1.0 desktop navigation marker: $token" }
}

# Exercise the generated release variants, including the restored gzip payload.
foreach ($filenameTestHtml in @($readableOutputPath, $rootHtmlPath, (Join-Path $Root "dist\index.self-extract.html"))) {
  & node $filenameTestPath $filenameTestHtml
  if ($LASTEXITCODE -ne 0) { throw "Generated filename behavior regression failed: $filenameTestHtml" }
  & node $headerTestPath $filenameTestHtml
  if ($LASTEXITCODE -ne 0) { throw "Generated header behavior regression failed: $filenameTestHtml" }
}

Write-Host "[OK] Repository-root HTML matches the readable standalone build: $rootHtmlPath" -ForegroundColor Green
foreach ($target in @("src\index.template.html", "video-audio-extractor.html", "dist\index.html", "dist\index.self-extract.html")) {
  & node (Join-Path $Root "scripts\test-dialog-layout.cjs") (Join-Path $Root $target)
  if ($LASTEXITCODE -ne 0) { throw "Dialog layout regression failed for $target" }
}

Write-Host "[OK] Repository check passed." -ForegroundColor Green

# WebRTC readiness DataChannel regression
$webrtcReadyText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "components\webrtc-qr-pairing.html")
if (-not $webrtcReadyText.Contains("readyChannelLabel: null")) {
  throw "WebRTC component is missing readyChannelLabel."
}
if (-not $webrtcReadyText.Contains("requireReadyChannelOpen: true")) {
  throw "WebRTC component is missing requireReadyChannelOpen."
}
if (-not $webrtcReadyText.Contains("readyChannelLabel is required when createDefaultChannel is false")) {
  throw "Custom WebRTC DataChannel layouts must require readyChannelLabel."
}
if (-not $webrtcReadyText.Contains("options.requireReadyChannelOpen!==false&&(!readyChannel||readyChannel.readyState!=='open')")) {
  throw "WebRTC application-ready must wait for the designated DataChannel to open."
}

