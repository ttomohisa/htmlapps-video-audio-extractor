@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: import-release-ffmpeg.bat "C:\path\to\ffmpeg-wasm-video-audio-extractor-v1.10.0.zip"
  exit /b 2
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\import-release-ffmpeg.ps1" -ReleaseZipPath "%~1"
exit /b %errorlevel%
