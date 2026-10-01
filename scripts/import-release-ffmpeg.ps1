param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseZipPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Vendor = Join-Path $Root "vendor\ffmpeg"
$ExpectedSha256 = "e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f"
$ExpectedBytes = 1632881
$ExpectedAsset = "ffmpeg-wasm-video-audio-extractor-v1.10.0.zip"
$ExpectedCommit = "c0f90882b9b9e5a724f10b1ae3e17a25d0b12d9c"

function Get-Sha256FileHex([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($algorithm.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

$ReleaseZipPath = [System.IO.Path]::GetFullPath($ReleaseZipPath)
if (-not (Test-Path -LiteralPath $ReleaseZipPath -PathType Leaf)) { throw "Release ZIP not found: $ReleaseZipPath" }
if ((Get-Item -LiteralPath $ReleaseZipPath).Length -ne $ExpectedBytes) { throw "Release ZIP byte count does not match the pinned v1.10.0 asset." }
if ((Get-Sha256FileHex $ReleaseZipPath) -ne $ExpectedSha256) { throw "Release ZIP SHA-256 does not match the pinned v1.10.0 asset." }

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("video-audio-extractor-release-" + [Guid]::NewGuid().ToString("N"))
try {
  Expand-Archive -LiteralPath $ReleaseZipPath -DestinationPath $temp -Force
  foreach ($name in @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "manifest.json", "browser-ffmpeg.js", "BUILDINFO.txt", "THIRD_PARTY_NOTICES.md")) {
    if (-not (Test-Path -LiteralPath (Join-Path $temp $name) -PathType Leaf)) { throw "Pinned release asset is missing $name" }
  }
  $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $temp "manifest.json") | ConvertFrom-Json
  if ([string]$manifest.profile -ne "video-audio-extractor" -or [string]$manifest.builderVersion -ne "1.10.0") {
    throw "Pinned release manifest is not Video Audio Extractor Builder v1.10.0."
  }
  if ([string]$manifest.capabilities.mp3Encoder -ne "libmp3lame") { throw "Pinned release manifest does not advertise libmp3lame." }

  New-Item -ItemType Directory -Force -Path $Vendor | Out-Null
  foreach ($name in @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "manifest.json", "browser-ffmpeg.js")) {
    Copy-Item -Force -LiteralPath (Join-Path $temp $name) -Destination (Join-Path $Vendor $name)
  }

  $provenance = [ordered]@{
    schemaVersion = 2
    sourceType = "github-release"
    repository = "ttomohisa/htmlapps-ffmpeg-wasm-builder"
    tag = "v1.10.0"
    releaseCommit = $ExpectedCommit
    releaseId = 400577471
    releaseAsset = [ordered]@{ id = 602176850; name = $ExpectedAsset; sizeBytes = $ExpectedBytes; sha256 = $ExpectedSha256 }
    checksumsAsset = [ordered]@{ name = "SHA256SUMS.txt"; sha256 = "1788c5e1f5717192b2ee7dd62cfae1d76e99bef000e291ef8d98f6ad72b955bf" }
    buildInfoAsset = [ordered]@{ name = "BUILDINFO-video-audio-extractor.txt"; sha256 = "1cc0de3c1240e24fa388b1b859948714c8d3b52e4a4fdacdf99a7845fb9f9612" }
    correspondingSource = [ordered]@{ name = "ffmpeg-wasm-sources-v1.10.0.tar.gz"; sha256 = "0f087fe1e3992f2a6569849e06f41baff0d492a048d5eb86c09fa4c81c7d1493" }
    profile = "video-audio-extractor"
    builderVersion = "1.10.0"
    lameVersion = "4.0"
    lameSourceSha256 = "3df5124d5ad3a98312ffd7ba6a9b36230e4f8a3e66d3ce0f425e336c32d216eb"
    manifestSha256 = (Get-Sha256FileHex (Join-Path $Vendor "manifest.json"))
    developmentOnly = $false
  }
  [System.IO.File]::WriteAllText((Join-Path $Vendor "provenance.json"), ($provenance | ConvertTo-Json -Depth 20) + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[OK] Imported and verified $ExpectedAsset" -ForegroundColor Green
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $temp
}
