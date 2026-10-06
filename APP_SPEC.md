# Video Audio Extractor — APP_SPEC

This file is the product contract for `ttomohisa/htmlapps-video-audio-extractor`.
The user-provided formal specification dated 2026-09-29 is authoritative. Browser Kitty Guide and the current htmlapps-template apply where this file is silent.

## 1. Product identity

- **Japanese name:** 動画から音声抽出
- **English name:** Video Audio Extractor
- **Repository:** `ttomohisa/htmlapps-video-audio-extractor`
- **Development version:** `0.1.0`
- **First stable release:** `1.0.0`
- **Base template:** htmlapps-template v1.3.0 or newer current template at development start
- **FFmpeg base:** `ttomohisa/htmlapps-ffmpeg-wasm-builder`
- **Builder profile:** `video-audio-extractor`
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Purpose and scope

Extract audio contained in a video file entirely in the browser. The primary tasks are:

1. extract one selected audio stream without decoding/re-encoding when a tested safe container mapping exists;
2. convert one selected audio stream to MP3, M4A/AAC, or WAV.

The app is not a video editor and does not provide audio trimming/editing features. The intended flow is: choose video → choose audio track when needed → choose save method → create → preview when supported → save.

Primary users include people extracting audio from phone videos, meetings, lectures, interviews, podcast/source material, multi-audio MP4/MOV/MKV files, and videos whose picture cannot be played natively by the browser.

Codec expertise is not assumed.

## 3. Core user flow and states

Explicit states:

- `empty`: no video selected;
- `inspecting`: container/stream inspection in progress;
- `ready`: track and save method can be selected;
- `preparing`: WASM runtime/Worker preparation;
- `processing`: extraction/conversion in progress;
- `result`: completed output available;
- `error`: processing cannot continue.

Initial copy:

- 動画から音声を取り出す / Extract audio from a video
- MP4 / MOV / MKV / WebM など / MP4 / MOV / MKV / WebM and more
- primary action: 動画を選択 / Choose video
- Drag & Drop is supported.

Inspection starts immediately after selection.

The file card shows filename, duration and file size. Audio summary shows codec, channels/layout, sample rate, bitrate when known. If there is one audio track, do not require a track-selection step. If there are multiple tracks, show natural labels from language/title and metadata, plus codec, bitrate, sample rate, channels/layout and default disposition. Do not expose internal stream numbers in the normal UI.

## 4. Save methods

### 4.1 元の音質のまま / Keep original quality

Copy the selected compressed audio stream without decode/re-encode.

Japanese helper text: `再圧縮せず音声だけを取り出します。速く、音質も変わりません。`

Only expose stream-copy combinations that are implemented and smoke-tested. Minimum planned matrix for v1.0:

| Source audio | Default output |
|---|---|
| AAC | M4A |
| ALAC | M4A |
| MP3 | MP3 |
| Opus | OPUS |
| Vorbis | OGG |
| FLAC | FLAC |
| supported PCM | WAV |
| AC-3 | AC3 |
| E-AC-3 | EAC3 |

Do not guess for an unverified codec. If safe stream copy is unavailable, show that the audio cannot be saved unchanged and offer MP3 / M4A / WAV conversion when the decoder path supports it.

MPEG-TS / raw ADTS AAC → M4A must use the necessary bitstream-filter path and be acceptance-tested.

### 4.2 MP3

Required for v1.0. Use `libmp3lame` from the dedicated Builder profile.

Quality choices:

- 128 kbps — 小さめ / Smaller
- 192 kbps — 標準 / Standard (default)
- 256 kbps — 高め / Higher
- 320 kbps — 最大 / Maximum

Do not expose VBR/ABR/psychoacoustic tuning in the normal UI.

MP3 output supports mono/stereo. For inputs with 3+ channels, explain before processing that MP3 output will be stereo; do not silently change it.

LAME source/version/license/provenance must be pinned and managed in the Builder. Do not add GPL-only components merely to obtain MP3 output. Re-evaluate the final generated core license from the actual build configuration rather than describing it as MIT.

### 4.3 M4A / AAC

Use FFmpeg native AAC encoder.

Quality choices: 128 / 192 (default) / 256 kbps.

AAC input + `元の音質のまま` must stream-copy without re-encoding. Re-encode AAC only when the user explicitly chooses the M4A conversion mode.

### 4.4 WAV

PCM WAV, default PCM 16-bit. Preserve input sample rate where practical and preserve channel count within supported range. Do not claim WAV improves quality.

Japanese helper text:

`編集ソフトで扱いやすい非圧縮形式です。元の音質以上にはなりません。ファイルサイズは大きくなります。`

## 5. Advanced settings

Put non-primary settings in a collapsed advanced area.

v1.0 option: `モノラルにする / Convert to mono`, default OFF, available only for re-encoding modes. Do not show it for `元の音質のまま`.

## 6. Output filename and result

Filename is editable before save. Default:

`<source-basename>-audio.<extension>`

Example: `meeting.mp4` → `meeting-audio.m4a`.

Keep extension outside the editable basename field and manage it automatically. Sanitize invalid characters. Empty input falls back to a safe default.

The basename belongs to the next extraction. **動画名を使う / Use video name** restores the selected video's basename plus `-audio` and focuses the editable field. It is disabled before a usable video is inspected and during preparation/processing, and does not change the selected track, format, quality, channels, preferences, or an existing completed result.

Remove only the source filename's final extension when deriving the default. Keep internal dots in both source-derived and user-entered basenames (`lecture.part1.mov` → `lecture.part1-audio.m4a`). Repeated blur, reset, extraction and save must not remove further segments. Sanitize path separators, Windows-invalid characters, control characters, trailing spaces/dots, and reserved device names even before a dot (`CON.v2` → `CON-file.v2`). Keep the existing 110 UTF-16 code-unit basename limit without splitting a surrogate pair; source defaults reserve six characters for `-audio`. Empty/all-dot input falls back to `audio`. The format-owned extension is separate from the editable basename, including when the user types a dot suffix.

A completed result retains the filename captured when it was created and its Blob URL. Editing/resetting the next-run field does not rename that result; a successful new extraction captures the new name. Failed or cancelled retries preserve the previous result.

Success state includes format, duration, size, preview if the browser can play the generated audio, and an explicit save action such as `M4Aを保存 / Save M4A`. Do not use a context-free `保存 / Save` button.

If native playback is unsupported, explain that preview is unavailable but saving is still possible.

## 7. Input media behavior

Input video preview is not required for v1.0 and must never gate extraction. A HEVC/H.265 video that the browser cannot render may still be processed when the Builder can demux it and read the audio stream.

Supported input is determined from FFmpeg inspection, not filename extension alone. Principal verification targets:

- MP4 / M4V / MOV
- MKV / WebM
- AVI
- MPEG-TS / MPEG-PS
- FLV
- ASF / WMV
- 3GP
- other formats safely demuxed by the pinned Builder profile

Do not claim universal video-format support.

If there is no video stream but audio stream(s) exist, stop and show that the input is an audio file; optionally link to Audio Cutter & Joiner. If video stream(s) exist but there is no audio stream, show `この動画には音声がありません。` as a normal empty-result condition rather than a technical crash.

v1.0 processes one audio track per run. Batch/all-track extraction is future scope.

## 8. Progress, cancellation and replacement

Show a percentage only when the underlying operation provides a reliable progress value. Otherwise use indeterminate status text such as `音声を取り出しています…`.

Processing is cancellable. Cancel must terminate the Worker, discard partial output, preserve the selected video/track/output settings, and preserve any previous completed result when re-processing.

When a new source is selected:

- no unsaved completed result: replace without confirmation;
- unsaved completed result exists: confirm `新しい動画を開きますか？ まだ保存していない音声があります。` with cancel/open actions.

No custom Undo system is required for v1.0 because there is little reversible editing.

## 9. FFmpeg architecture

Do not add generic `@ffmpeg/ffmpeg`. Extend `ttomohisa/htmlapps-ffmpeg-wasm-builder` with `video-audio-extractor`.

Architecture:

`Video File → libavformat → audio stream inventory → stream copy OR audio transcode → audio file`.

Do not include unnecessary video encoder/decoder/filter/scaler functionality. Phase 1 specifically contains no audio decoder/encoder either; later phases add only the audio decode/encode path needed for MP3/M4A/WAV.

Required over the completed v1.0 profile:

- libavformat
- libavcodec audio functionality
- libavutil
- swresample for transcode phase
- required demuxers/audio decoders
- native AAC encoder
- PCM encoder
- libmp3lame
- required audio muxers/bitstream filters

Do not expose a UI that constructs arbitrary FFmpeg CLI strings. Use the existing public-libav runner contract.

## 10. Stream inspection contract

Do not load a second Media Inspector WASM. The extractor profile returns the minimum JSON needed before extraction:

- container
- duration
- file size
- video stream count
- audio stream entries with stream index, codec, codec tag, profile, bitrate, sample rate, channels, channel layout, language, title, default disposition, duration

Keep HDR/subtitle/full metadata inspection out of this app.

## 11. Runner API

Conceptual operations:

- Inspect: input → audio stream inventory JSON
- Stream Copy: input + selected audio stream + approved output format → audio file
- Transcode (later phase): input + selected audio stream + output codec + bitrate + mono option → audio file

The UI does not construct arbitrary FFmpeg command lines.

## 12. Large-file I/O and memory

Use WORKERFS for source video `File`/`Blob` input. Do not use `File.arrayBuffer()` to copy the complete source video into MEMFS.

Output may be generated in MEMFS for v1.0, so output size remains constrained by available browser/WASM memory. Do not impose an arbitrary small app-level input size cap and do not claim an unsupported maximum GB size.

Before stable release, stream-copy a multi-GB video in desktop Chrome/Edge and verify no full-input JS/WASM duplication, responsive UI, cancellation, output Blob/save and memory release.

For re-encoded output, estimate size approximately from bitrate × duration. For stream copy, use source audio bitrate × duration when available. Always label estimates as approximate.

## 13. Runtime network and dependency pinning

The completed standalone HTML performs no runtime external request.

Required CSP: `connect-src 'none'`.

No CDN, runtime GitHub download, Google Fonts, analytics, telemetry, external API, or update check.

FFmpeg assets are downloaded/pinned at app build/update time and embedded in the standalone artifact.

Production app builds must pin Builder release tag, exact asset name, release asset ID, byte count and SHA-256, following the existing video-app release-lock approach. Local Builder output may be used during development only. Stable release provenance must not point to a local Builder checkout.

## 14. LAME dependency requirements

At the implementation phase, re-check the current stable LAME upstream release and pin exact version/source commit/hash. Builder integration must include source pin, SHA-256, BUILDINFO, THIRD_PARTY_NOTICES, license documentation, corresponding source/provenance and browser smoke coverage. FFmpeg configure must explicitly enable libmp3lame.

## 15. Desktop UI

One page, all stages visible in compact sections:

1. 動画 / Video — file card
2. 音声 / Audio — track selection when necessary
3. 保存方法 / Format — original / MP3 / M4A / WAV + advanced settings
4. primary `音声を取り出す / Extract audio` action
5. 結果 / Result — audio preview + explicit save action

Sections that are not currently actionable are compact/disabled rather than visually noisy.

## 16. Smartphone UI

Do not stack the whole desktop workflow into excessive vertical scrolling. Reuse the template mobile page-tab pattern:

`[動画] [音声] [形式] [結果]` / `[Video] [Audio] [Format] [Result]`.

After file selection, advance to the next required page. If only one audio track exists, the Audio page may be auto-skipped. Result is disabled before processing and becomes the active page on completion.

Desktop continues to show all sections.

## 17. Responsive and accessibility requirements

Verify from 320px upward:

- no horizontal scroll;
- long filenames/track titles/English strings wrap safely;
- fixed bottom UI does not cover content and respects safe areas;
- dialogs remain within the viewport and are fully scrollable;
- major touch targets about 44px or larger;
- output filename does not break layout.

Accessibility:

- keyboard operation;
- visible focus;
- correct labels and `aria-label` where needed;
- `aria-live` statuses;
- Enter/Space activation;
- Escape closes dialogs;
- state not communicated only by color;
- respect `prefers-reduced-motion`;
- radio-card selection works by keyboard.

Use SVG icons, not emoji. `assets/favicon.svg` and the upper-left brand icon use the same design. Primary color is `#16624F`; no gradients.

## 18. Japanese / English

One HTML supports Japanese and English without reload. Use natural UI wording rather than literal translation. Verify long English strings at 360px.

## 19. Error model

Distinct user-facing states:

- no audio: `この動画には音声がありません。`
- audio-only input: `これは音声ファイルです。`
- unreadable/corrupt/unsupported container;
- stream copy unavailable;
- unsupported decoder for conversion;
- encoder failure;
- insufficient memory;
- cancel.

Put FFmpeg stack/log detail under a technical-details disclosure. Do not dump it directly into primary UI.

## 20. Security and async source guard

Treat media as untrusted input. Parsing/conversion runs in a Worker. Render metadata as text, never HTML. Sanitize filenames. Never fetch metadata URLs, artwork, or external images. Revoke Blob URLs. Ignore callbacks/results from terminated or stale Workers.

Use a source-generation ID/token. When input A is processing and input B becomes current, any later A inspection/processing result must be discarded.

## 21. Persistence

Never persist video/audio bytes, track contents, generated bytes or filename history.

LocalStorage may store only lightweight preferences such as UI language, last output format, MP3 bitrate, AAC bitrate, and mono option.

## 22. Explicit v1.0 non-goals

No trim/cut/join, fades, volume/loudness, silence removal, denoise, EQ, pitch/speed, subtitle extraction, video conversion/compression, batch input, all-track batch extraction, track mixing, URL/YouTube download, cloud save, DRM bypass, or metadata editor.

Direct users to appropriate Browser Kitty audio/video tools where useful.

## 23. Future candidates

After v1.0 only if demand justifies them: multi-video batch, extract all tracks, ZIP, FLAC conversion, metadata-preservation options, cover-art extraction, File System Access streaming output, and avoiding MEMFS for large outputs.

## 24. Phase 1 acceptance tests — stream copy

Browser smoke coverage must include:

- MP4 H.264 + AAC stereo → AAC detected → M4A → no re-encode → playable audio and matching duration;
- MOV HEVC + AAC → extract audio even where browser cannot preview video;
- WebM VP9 + Opus → Opus stream copy;
- MKV with Japanese AAC / English Opus / Commentary AAC → all three listed and individually selectable;
- MPEG-TS AAC ADTS → M4A correctly;
- video-only → no-audio state;
- audio-only → audio-file state at app layer;
- corrupt file → friendly error plus technical detail.

## 25. v1.0 transcode acceptance tests

- AAC → MP3 128/192/256/320;
- Opus → M4A/AAC;
- AAC → WAV;
- 5.1 → MP3 stereo with preflight disclosure;
- stereo → mono MP3/M4A;
- cancel/retry/reprocess;
- editable output filename;
- Japanese filename and non-ASCII metadata.

## 26. Browser targets

Primary: current stable Chrome and Edge. Verify Android Chrome. Where feasible verify Safari, Firefox, iOS Safari and show accurate limitation messaging for unsupported browser/codec behavior. Direct `file://` standalone use is required.

## 27. Repository and release assets

Final release follows the template structure and produces:

- `dist/index.html`
- `dist/index.self-extract.html`
- `dist/dependency-manifest.json`
- `dist/build-size-report.json`
- `dist/.nojekyll`

Final repository assets:

- `assets/favicon.svg`
- `assets/screenshot.png`
- `assets/screenshot-en.png`
- `assets/screenshot-mobile.png`

README follows Browser Kitty app conventions and includes Overview/Screenshot, Features, Usage, Supported formats, Privacy, Browser support, Development, Build, FFmpeg WASM dependency and License. Avoid marketing-heavy claims.

## 28. Development plan

### Phase 0 — initialization / v0.1.0 foundation

- unpack latest template;
- read `AGENTS.md`;
- replace APP_SPEC with this contract;
- update `app.config.json` and repository identity;
- provisional favicon;
- verify starter build, unresolved placeholders, bilingual switching and readable/self-extract generation.

### Phase 1 — Builder Foundation

In `htmlapps-ffmpeg-wasm-builder`, add the `video-audio-extractor` profile with inspect JSON, selected audio stream, stream copy, WORKERFS and output file. Do not add MP3 encode yet. Browser smoke: MP4/AAC→M4A, WebM/Opus, MKV multi-audio, MPEG-TS/AAC, no-audio.

### Phase 2 — app v0.1.0 Stream Copy

File picker/Drop, inspecting state, file card, track display, one-track selection, original-quality mode, filename, process/cancel/result/preview/save and basic errors. End-to-end MP4/AAC→M4A.

### Phase 3 — app v0.2.0 Multi Audio / Compatibility

Language/title/default/bitrate/layout UI, compatibility matrix/fallback, HEVC MOV audio extraction, MPEG-TS handling.

### Phase 4 — app v0.3.0 M4A / WAV Conversion

Builder native AAC + PCM WAV + swresample + channel/sample-rate handling; app bitrate/mono/size estimate.

### Phase 5 — app v0.4.0 MP3 / LAME

Builder LAME pin/build/license/provenance/smoke; app MP3 128/192/256/320, 192 default, multichannel→stereo disclosure and mono option.

### Phase 6 — app v0.5.0 Result / Error UX

Result preview/size/duration/editable filename, unsupported preview, replacement confirm, cancel recovery, memory/corrupt/decoder/encoder error separation and technical-detail foldout.

### Phase 7 — app v0.6.0 Smartphone / Accessibility

Mobile tabs Video/Audio/Format/Result; safe area, 320/360/390, long names/English, dialogs, keyboard, screen-reader labels/focus/live region.

### Phase 8 — app v0.7.0 Robustness

Multi-GB, long duration, no/multi audio, unsupported/broken input, rapid replacement, replacement during processing, repeated conversion, cancel→retry, Blob URL/Worker cleanup, stale results and memory behavior.

### Phase 9 — app v0.8.0 Privacy / Offline / Bilingual

`connect-src 'none'`, runtime network 0, offline/file://, Japanese/English, help/privacy/supported formats/limitations/engine information.

### Phase 10 — app v0.9.0 Release Candidate

README/favicon/screenshots, notices, version consistency, Pages/Actions/repository/standalone/self-extract checks and build-size review.

### Phase 11 — v1.0.0 Final Release

Final PC/mobile/language/input/output/privacy/build regression per the formal specification. Do not delay stable release solely because future-feature ideas remain.

## 29. Builder release strategy

Development may consume a local Builder output. Production must consume a tagged Builder Release. The v1.0.0 production pin is FFmpeg WASM Builder v1.10.0, asset `ffmpeg-wasm-video-audio-extractor-v1.10.0.zip`, SHA-256 `e7b1f45792b1589b6b7d82f61d0ec3cb06c11e9404e6333d26c5a12bcf216a4f`. Local Builder imports remain development-only and must not satisfy the production repository check.

## 30. Definition of Done

v1.0.0 requires correct audio-stream recognition, multi-track selection, tested stream copy, MP3/M4A/WAV output, editable filename, result preview where supported, cancel, extraction when browser video playback is unavailable but FFmpeg can read audio, no-audio handling, WORKERFS source input, desktop/smartphone/JA/EN, readable and self-extract standalone, direct file:// operation, no runtime external network, correct CSP, README/favicon/screenshots, green Actions and major regression tests.

## 31. Implementation priority

1. recognize audio correctly;
2. extract correctly;
3. convert correctly;
4. make state understandable;
5. make smartphone flow good;
6. polish UI;
7. future features.

Prefer reliable completion of one task over adding features.
