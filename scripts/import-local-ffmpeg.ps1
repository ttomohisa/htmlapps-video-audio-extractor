param([Parameter(Mandatory = $true)][string]$BuilderRoot)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BuilderRoot = [System.IO.Path]::GetFullPath($BuilderRoot)
$Source = Join-Path $BuilderRoot "dist\video-audio-extractor"
$Runtime = Join-Path $BuilderRoot "runtime\browser-ffmpeg.js"
$Vendor = Join-Path $Root "vendor\ffmpeg"
foreach ($path in @((Join-Path $Source "ffmpeg.js.gz"),(Join-Path $Source "ffmpeg.wasm.gz"),(Join-Path $Source "manifest.json"),$Runtime)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required Builder output is missing: $path" }
}
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $Source "manifest.json") | ConvertFrom-Json
if ([string]$manifest.profile -ne "video-audio-extractor") { throw "Builder manifest profile must be video-audio-extractor." }
if ([version][string]$manifest.builderVersion -lt [version]"1.10.0") { throw "FFmpeg WASM Builder v1.10.0 or newer is required." }
if (-not $manifest.runtime.workerFsInput -or -not $manifest.runtime.fileProtocolSingleHtml) { throw "Builder output must support WORKERFS and file:// single HTML." }
$copyFormats = @($manifest.capabilities.copyFormats | ForEach-Object { [string]$_ })
if (($copyFormats -join ",") -ne "m4a,opus,mp3,ogg,flac") { throw "Builder output must expose the verified copy matrix: m4a,opus,mp3,ogg,flac." }
if (-not $manifest.capabilities.transcode) { throw "Builder output must expose transcoding." }
$transcodeFormats = @($manifest.capabilities.transcodeFormats | ForEach-Object { [string]$_ })
if (($transcodeFormats -join ",") -ne "m4a,wav,mp3") { throw "Builder output must expose M4A, WAV, and MP3 transcoding." }
$aacBitrates = @($manifest.capabilities.aacBitratesKbps | ForEach-Object { [int]$_ })
if (($aacBitrates -join ",") -ne "128,192,256") { throw "Builder output must expose AAC bitrates 128,192,256 kbps." }
$mp3Bitrates = @($manifest.capabilities.mp3BitratesKbps | ForEach-Object { [int]$_ })
if (($mp3Bitrates -join ",") -ne "128,192,256,320") { throw "Builder output must expose MP3 bitrates 128,192,256,320 kbps." }
$mp3Channels = @($manifest.capabilities.mp3Channels | ForEach-Object { [int]$_ })
if (($mp3Channels -join ",") -ne "1,2") { throw "Builder output must expose mono/stereo MP3 output." }
if ([string]$manifest.capabilities.mp3Encoder -ne "libmp3lame") { throw "Builder output must use libmp3lame for MP3 output." }
if ([int]$manifest.capabilities.pcmBits -ne 16) { throw "Builder output must expose PCM 16-bit WAV output." }
$runtimeText = Get-Content -Raw -Encoding UTF8 $Runtime
foreach ($marker in @("videoAudioExtractorInspectArgs","videoAudioExtractorCopyArgs","videoAudioExtractorTranscodeArgs","options.signal")) {
  if (-not $runtimeText.Contains($marker)) { throw "Builder runtime is missing required marker: $marker" }
}
New-Item -ItemType Directory -Force -Path $Vendor | Out-Null
Copy-Item -Force (Join-Path $Source "ffmpeg.js.gz") (Join-Path $Vendor "ffmpeg.js.gz")
Copy-Item -Force (Join-Path $Source "ffmpeg.wasm.gz") (Join-Path $Vendor "ffmpeg.wasm.gz")
Copy-Item -Force (Join-Path $Source "manifest.json") (Join-Path $Vendor "manifest.json")
Copy-Item -Force $Runtime (Join-Path $Vendor "browser-ffmpeg.js")
$provenance = [ordered]@{
  schemaVersion = 1
  sourceType = "local-builder"
  builderRoot = $BuilderRoot
  profile = [string]$manifest.profile
  builderVersion = [string]$manifest.builderVersion
  developmentOnly = $true
}
[System.IO.File]::WriteAllText((Join-Path $Vendor "provenance.json"), ($provenance | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Imported Video Audio Extractor Builder $($manifest.builderVersion) from $Source" -ForegroundColor Green
