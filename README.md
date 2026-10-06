# Video Audio Extractor

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-video-audio-extractor/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-video-audio-extractor/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-16624F)](video-audio-extractor.html)
[![FFmpeg WASM Builder](https://img.shields.io/badge/FFmpeg%20WASM%20Builder-v1.10.0-16624F)](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/releases/tag/v1.10.0)

[日本語版 README](README.ja.md)

A privacy-focused, single-HTML Browser Kitty app for extracting one audio track from a video without uploading the selected media to a server. Supported audio can be saved unchanged, or converted locally to M4A, MP3, or WAV.

Current app version: **v1.0.0**.

## 🚀 Live demo

After the repository is published and GitHub Pages is enabled, the app is available at:

### [Open Video Audio Extractor on GitHub Pages](https://ttomohisa.github.io/htmlapps-video-audio-extractor/)

GitHub Pages delivers the initial HTML. After it loads, video inspection, audio extraction, conversion, preview, and output creation are processed locally in the browser. The video you select is not uploaded by the app.

[![Video Audio Extractor screenshot](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-video-audio-extractor/)

## Features

- **Extract without re-encoding when supported** — AAC → M4A, ALAC → M4A, MP3 → MP3, Opus → OPUS, Vorbis → OGG, and FLAC → FLAC use verified stream-copy paths.
- **Convert to common audio formats** — Convert to M4A/AAC, MP3 with LAME 4.0, or uncompressed PCM16 WAV.
- **Choose the audio track you need** — Multi-audio files expose language, title, and default-track metadata when available.
- **Avoid an initial full-file JavaScript copy** — The original `File` / `Blob` is mounted through WORKERFS instead of being read in full with `File.arrayBuffer()`.
- **Use one HTML file** — FFmpeg JavaScript, WebAssembly, the browser runtime, and the app UI are embedded in the standalone build.
- **Work offline after obtaining the HTML** — The standalone file can be opened directly with `file://` in supported browsers.
- **No runtime external connection** — The generated app uses `connect-src 'none'` and contains no CDN, analytics, telemetry, remote font, or runtime update request.
- **Japanese / English UI** — Both languages are included in the same HTML, with a desktop and smartphone workflow.

## Quick start

### Use the web demo

After GitHub Pages is enabled, open the [web demo](https://ttomohisa.github.io/htmlapps-video-audio-extractor/). No account or installation is required.

### Use the standalone file

1. Download `video-audio-extractor.html` from this repository.
2. Open it in a current Chrome or Edge browser.
3. Choose or drop a local video.
4. Select an audio track when the file contains more than one.
5. Choose **Keep original quality**, **M4A**, **MP3**, or **WAV**.
6. Select **Extract audio**, review the result, and save the created audio file.

No local server or media upload is required.

### Use the smaller self-extracting file

Open:

```text
dist/index.self-extract.html
```

This wrapper restores the normal standalone HTML locally with `DecompressionStream`. It does not contact a server while unpacking.

## Usage

1. Add a video with the file picker or drag and drop.
2. Wait for local inspection to finish. If multiple audio tracks are present, choose the track you want.
3. Choose the output method.
4. For M4A or MP3, choose the available bitrate. MP3 also offers mono or stereo output.
5. Edit the output basename if needed, or choose **Use video name** to restore the selected video name plus `-audio`. Then select **Extract audio**.
6. Preview the result when the browser supports the generated audio format, then save it.
7. Use **Change settings and extract again** to return to the Format section without replacing the source video.

The filename field applies to the next extraction. Internal dots are preserved (`lecture.part1.mov` → `lecture.part1-audio.m4a`), and the output format adds the extension automatically. A completed result keeps its captured filename when you edit or reset this field. The reset action is unavailable during preparation or processing.

If you open a new video while a completed result has not been saved, the app asks before replacing it.

## Supported outputs

### Unchanged extraction

| Source audio | Output | Method |
| --- | --- | --- |
| AAC | M4A | Stream copy |
| ALAC | M4A | Stream copy |
| MP3 | MP3 | Stream copy |
| Opus | OPUS | Stream copy |
| Vorbis | OGG | Stream copy |
| FLAC | FLAC | Stream copy |

MPEG-TS AAC → M4A is covered by the Builder browser smoke test, including the `aac_adtstoasc` path.

### Conversion

| Output | Encoding options |
| --- | --- |
| M4A | FFmpeg native AAC, 128 / 192 / 256 kbps |
| MP3 | LAME 4.0 / `libmp3lame`, 128 / 192 / 256 / 320 kbps, mono or stereo |
| WAV | PCM signed 16-bit little-endian |

For MP3, sources with more than two channels are converted to the selected mono/stereo layout.

## Publish with GitHub Pages

The repository includes a workflow that rebuilds the standalone HTML, runs repository checks, and deploys `dist/` when GitHub Pages is enabled.

1. Publish the repository as `ttomohisa/htmlapps-video-audio-extractor`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or manually run **Deploy standalone app to GitHub Pages** from the Actions tab.
4. After a successful deployment, the app is available at `https://ttomohisa.github.io/htmlapps-video-audio-extractor/`.

The workflow still validates and uploads the standalone build artifact when Pages has not been enabled yet.

## Development and build layout

The repository check requires Node.js 20 or newer for the dependency-free synthetic filename regression suite.


```text
.
├─ src/index.template.html              # Application UI and logic
├─ vendor/ffmpeg/                       # Pinned embedded FFmpeg WASM profile
├─ assets/
│  ├─ favicon.svg
│  ├─ screenshot.png
│  ├─ screenshot-en.png
│  └─ screenshot-mobile.png
├─ app.config.json                      # App metadata and output settings
├─ build-standalone.bat                 # Windows build entry point
├─ build-standalone.ps1                 # Single-HTML builder
├─ build-with-local-ffmpeg.bat          # Development Builder import
├─ import-release-ffmpeg.bat            # Exact v1.10.0 Release ZIP importer
├─ scripts/
│  ├─ check-repository.ps1              # Full source/build validation
│  ├─ verify-standalone.ps1             # Standalone/CSP checks
│  ├─ build-self-extract.ps1            # Compressed single-HTML wrapper
│  ├─ verify-self-extract.ps1           # Byte-for-byte restore check
│  ├─ import-local-ffmpeg.ps1           # Development-only local Builder import
│  └─ import-release-ffmpeg.ps1         # SHA-256 verified Release import
├─ dist/
│  ├─ index.html
│  ├─ index.self-extract.html
│  ├─ dependency-manifest.json
│  ├─ self-extract-manifest.json
│  └─ build-size-report.json
└─ video-audio-extractor.html           # Exact copy of dist/index.html
```

### Build locally

Run on Windows:

```bat
build-standalone.bat
```

The canonical build validates the embedded profile, stream-copy matrix, M4A/WAV/MP3 conversion capabilities, LAME encoder identity, WORKERFS / `file://` support, the pinned Builder v1.10.0 Release provenance, and the runtime network boundary.

Do not edit generated HTML directly. Edit `src/index.template.html` and rebuild.

### Refresh the pinned FFmpeg Release core

The v1.0.0 production build is pinned to:

```text
Builder tag: v1.10.0
Asset:       ffmpeg-wasm-video-audio-extractor-v1.10.0.zip
SHA-256:     e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f
```

After downloading that exact asset from the Builder Release, verify and import it with:

```bat
import-release-ffmpeg.bat "C:\path\to\ffmpeg-wasm-video-audio-extractor-v1.10.0.zip"
build-standalone.bat
```

The importer rejects a ZIP whose byte count or SHA-256 differs from the pinned Release asset. `vendor/ffmpeg/provenance.json` also records the Release ID, asset ID, corresponding-source archive, BUILDINFO checksum, and exact release commit.

For Builder development only, `build-with-local-ffmpeg.bat` can import a local profile. That path is marked `developmentOnly` and does not satisfy the production repository check.

## Privacy and runtime network protection

The generated app is designed so selected media stays on the device:

- `connect-src 'none'` blocks runtime external connections.
- FFmpeg JavaScript, WebAssembly, and the browser runtime are embedded in the HTML.
- Source `File` / `Blob` data is mounted with WORKERFS instead of copying the complete video into JavaScript memory first.
- The app uses no CDN, remote font, analytics, telemetry, remote API, or runtime dependency check.
- LocalStorage is limited to UI language, last output format, M4A bitrate, MP3 bitrate, and MP3 mono/stereo preference.
- Video/audio bytes, filenames, track metadata, processing history, generated audio, and Blob URLs are not persisted in LocalStorage.

The GitHub Pages version needs the initial HTML request to load the app. After that, selected-video inspection and audio generation remain local to the browser.

## Limitations

- The normal file picker is intended for video input. Selecting an audio-only file is rejected because this tool is specifically for extracting audio from video.
- AC-3 / E-AC-3 are not exposed as unchanged outputs because dedicated compatibility cases are not part of the verified profile matrix.
- Very large or long videos can still be limited by browser/WASM memory, output size, device performance, and available storage even though WORKERFS avoids an initial full-file JavaScript copy.
- Preview availability depends on whether the browser can play the generated audio format. Saving can still work when inline preview is unavailable.
- Processing is single-threaded and does not require `SharedArrayBuffer` or cross-origin isolation.

## FFmpeg WASM dependency

The embedded processing core comes from `ttomohisa/htmlapps-ffmpeg-wasm-builder` **v1.10.0**, profile `video-audio-extractor`.

| Component | Version / source | Purpose |
| --- | --- | --- |
| FFmpeg | `n9.0.1`, commit `bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa` | Media demuxing, stream copy, decoding and encoding |
| Emscripten | `6.0.6` | WebAssembly toolchain/runtime |
| LAME | `4.0` | MP3 encoding through `libmp3lame` |
| Builder profile | v1.10.0 `video-audio-extractor` | Browser-specific FFmpeg WASM package |

The Builder reports the generated profile license as `LGPL-2.1-or-later`. The exact Release binary asset SHA-256 is `e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f`, and the matching corresponding-source archive SHA-256 is `0f087fe1e3992f2a6569849e06f41baff0d492a048d5eb86c09fa4c81c7d1493`.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for license and source-availability details.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues after the repository is published. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Application source is licensed under the [MIT License](LICENSE). Embedded FFmpeg/LAME components remain subject to their own license terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
