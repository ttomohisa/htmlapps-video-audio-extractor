# Third-Party Notices

Video Audio Extractor embeds software produced by `ttomohisa/htmlapps-ffmpeg-wasm-builder`.

## FFmpeg WASM Builder v1.10.0 release pin

- Builder repository: https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder
- Release tag: `v1.10.0`
- Release commit: `c0f90882b9b9e5a724f10b1ae3e17a25d0b12d9c`
- Binary asset: `ffmpeg-wasm-video-audio-extractor-v1.10.0.zip`
- Binary asset SHA-256: `e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f`
- BUILDINFO asset SHA-256: `1cc0de3c1240e24fa388b1b859948714c8d3b52e4a4fdacdf99a7845fb9f9612`
- Corresponding-source asset: `ffmpeg-wasm-sources-v1.10.0.tar.gz`
- Corresponding-source SHA-256: `0f087fe1e3992f2a6569849e06f41baff0d492a048d5eb86c09fa4c81c7d1493`

The GitHub Release workflow rebuilt and real-browser smoke-tested the `video-audio-extractor` profile before publishing the tagged assets. Exact release metadata is also recorded in `vendor/ffmpeg/provenance.json`.

## FFmpeg

- Upstream: https://ffmpeg.org/
- Builder profile: `video-audio-extractor`
- FFmpeg ref: `n9.0.1`
- FFmpeg commit: `bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`
- Binary license reported by the Builder manifest: `LGPL-2.1-or-later`
- The profile links the FFmpeg libraries required for media inspection, stream copy, and audio-only transcoding, including `libswresample` for conversion.
- It does not link x264, libwebp, libvpx, or libopus into this profile.
- Audio decoding is limited to the codecs enabled by the profile. Output encoding uses FFmpeg native AAC, PCM signed 16-bit little-endian, or LAME 4.0 / libmp3lame for MP3.

FFmpeg is a separate work with its own copyright holders and license terms. Redistribution of the generated WASM core must comply with the applicable FFmpeg/LGPL requirements.

## LAME

- Version: `4.0`
- Source archive SHA-256: `3df5124d5ad3a98312ffd7ba6a9b36230e4f8a3e66d3ce0f425e336c32d216eb`
- Purpose: MP3 encoding through `libmp3lame`
- Linked only into the `video-audio-extractor` profile among the components used by this app

LAME is a separate upstream project with its own LGPL license terms. The Builder v1.10.0 corresponding-source archive includes the SHA-256-verified LAME source used for the release build.

## FFmpeg WASM Builder browser runtime

- Repository: https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder
- Release source: `v1.10.0`
- License: MIT
- Runtime file: `runtime/browser-ffmpeg.js`
- Git blob at the release commit: `fb653c15b7669c4189ecf9c42418643bc958ffe8`

The browser runtime mounts source files through WORKERFS, runs the public-libav profile in a Worker, reports progress, supports cancellation, and returns explicitly requested output files.

## Emscripten

The pinned core was compiled with Emscripten `6.0.6` from commit `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Emscripten and its toolchain components have their own upstream license terms; the matching source and license material are included by the Builder release process.
