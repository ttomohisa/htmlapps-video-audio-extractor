# Changelog

## Unreleased

- Added **Use video name / 動画名を使う** to restore the next extraction's source-derived filename and focus the field.
- Fixed repeated filename normalization removing internal dot segments from source-derived and custom basenames.
- Hardened bounded filename sanitation for dotted Windows device names, trailing dots, control characters, and Unicode. Completed-result filenames and Blob URLs remain unchanged by edits/reset.
- Added dependency-free synthetic filename/reset regressions across source, readable/root output, and restored self-extract output in the repository check.

## 1.0.0 - Stable release - 2026-10-02

- Promoted the release candidate to the first stable release without changing the verified extraction/conversion feature set.
- Updated the visible app version and Help scope to v1.0.0 and removed release-candidate wording from user-facing UI.
- Kept the production runtime pinned to the exact FFmpeg WASM Builder v1.10.0 `video-audio-extractor` Release asset and provenance.
- Reworked the English and Japanese READMEs to follow the PDF Organizer release structure, including demo, screenshots, quick start, usage, Pages publishing, build layout, privacy, limitations, dependency details, and licensing.
- Added fresh Japanese desktop, English desktop, and smartphone screenshots for the v1.0.0 UI.
- Retained the desktop result-to-Format navigation fix, mobile workflow behavior, local-only preference boundary, standalone/root HTML byte equality, and self-extract byte-restoration checks.

## 0.9.0 - Release candidate - 2026-09-30

- Pinned the release candidate to the tagged FFmpeg WASM Builder v1.10.0 `video-audio-extractor` asset, including exact Release ID, asset ID, byte count, SHA-256, BUILDINFO checksum, corresponding-source checksum, and release commit in vendor provenance.
- Replaced development-only Builder provenance with stable GitHub Release provenance and tightened repository/build checks so a development core cannot accidentally satisfy the RC contract.
- Rewrote the English and Japanese READMEs around the established PDF Organizer structure, with quick start, supported outputs, GitHub Pages, build layout, privacy, limitations, dependency provenance, and license sections.
- Fixed desktop “Change settings and extract again” and “Back to settings” actions so they scroll to and focus the Format section instead of using the mobile-only page switch.
- Kept the mobile result-to-format behavior unchanged.
- Updated the app version/help scope to v0.9.0 RC and froze the current user-facing feature set for release-candidate verification.
- Aligned with the current `htmlapps-template` build contract by generating `video-audio-extractor.html` at repository root as an exact copy of `dist/index.html`.
- Consolidated README/release checks and documented the tagged Builder Release asset used for final v1.0.0 validation.

## 0.8.0

- Added preference persistence limited to UI language, last output format, AAC bitrate, MP3 bitrate, and MP3 mono/stereo.
- Kept video/audio bytes, filenames, processing history, and generated output out of LocalStorage.
- Added explicit Help text for local preference storage and direct offline / `file://` use.
- Expanded privacy wording to state that both selected video and generated audio remain local and that runtime external network access is absent.
- Moved dynamic error and audio-summary labels into the shared JA/EN translation dictionary.
- Preserved the user-selected MP3 mono/stereo preference instead of resetting it when a source or track changes.

## 0.7.0

- Added per-operation IDs so stale inspect/extract completions cannot overwrite a newer source or retry.
- Guarded against duplicate processing starts and made cancellation explicit during runtime preparation and processing.
- Cleared audio preview references and revoked Blob URLs when completed results are replaced or the page is really unloaded.
- Dropped completed output Uint8Array references immediately after creating the result Blob to reduce peak retained memory.
- Preserved BFCache pages by skipping unload cleanup when `pagehide.persisted` is true.
- Reset disposed runtime references on real unload so a disposed runner cannot be reused.
- Changed save status wording to reflect that the browser download was started, rather than claiming the file definitely reached storage.
- Added the missing Japanese result/error/save-state translations introduced in v0.5.0.

## 0.6.0

- Raised interactive controls to at least 44 px touch targets and improved 320 px / safe-area layout.
- Added mobile workflow position correction so fixed header/bottom tabs do not cover the active panel.
- Added arrow-key navigation and current-step semantics for the mobile workflow tabs.
- Added live status announcements, progressbar semantics, alert handling, and accessible labels for dynamic processing/result states.
- Made unavailable workflow panels inert so keyboard focus cannot enter disabled steps.
- Restored focus after dialogs and moved focus to the active step after automatic mobile transitions.

## 0.5.0

- Added persistent Result-step states for processing failure and cancellation.
- Preserve the previous completed audio when a retry fails or is cancelled.
- Added retry/back actions and collapsible technical diagnostics.
- Added visible unsaved/saved state and “Save again” behavior.
- Freeze the result filename at completion time.

## 0.4.0 - MP3 conversion - 2026-09-30

- Adds MP3 conversion using the dedicated Builder profile with LAME 4.0 / libmp3lame.
- Adds 128 / 192 / 256 / 320 kbps MP3 bitrates, with 192 kbps as the default.
- Adds mono / stereo output selection and warns when a source with more than two channels will be reduced for MP3.
- Keeps stream copy, M4A conversion, and WAV conversion as separate existing paths.
- Requires the embedded Builder manifest/runtime to advertise MP3, all four bitrates, mono/stereo, and `libmp3lame` before packaging.
- Builder artifact provenance is filled from the successful PR #7 browser-smoke workflow before the development ZIP is produced.

## 0.3.0 - M4A / WAV conversion - 2026-09-30

- Adds an explicit save-method selector: original quality, M4A, or WAV.
- Adds native AAC/M4A conversion at 128 / 192 / 256 kbps, with 192 kbps as the default.
- Adds PCM signed 16-bit WAV conversion while preserving source sample rate and channel layout where the Builder supports them.
- Keeps stream copy and transcode as separate Builder operations so unchanged extraction never decodes/re-encodes audio.
- Estimates M4A output from the selected AAC bitrate and WAV output from sample rate, channel count, and PCM16 size.
- Requires the embedded Builder manifest/runtime to advertise the complete v0.3 transcode contract before standalone packaging.

## 0.2.0 - Compatibility expansion - 2026-09-30

- Expands the lossless stream-copy UI for Builder-verified ALAC, MP3, Vorbis, and FLAC compatibility in addition to AAC and Opus.
- Adds output MIME handling for MP3, OGG, and FLAC while keeping the generated extension controlled by the inspected stream mapping.
- Uses the finalized Video Audio Extractor icon for both the app header and favicon.

## 0.1.0 - Stream-copy foundation - 2026-09-30

- Initialized Video Audio Extractor from the current Browser Kitty HTML app template.
- Added the dedicated `video-audio-extractor` FFmpeg WASM Builder integration.
- Added WORKERFS-based source video inspection without copying the full input through `File.arrayBuffer()`.
- Added AAC → M4A and Opus → OPUS stream-copy extraction, limited to combinations covered by Builder browser smoke tests.
- Added multiple-audio-track selection using language, title, and default-track metadata without exposing internal stream numbers in the normal UI.
- Added empty, inspecting, ready, preparing, processing, result, and error states; cancellation; stale-source guards; and confirmation before replacing an unsaved completed result.
- Added editable output filenames, output-size estimates, result preview when supported, explicit format-specific save buttons, Japanese/English UI, and smartphone Video / Audio / Format / Result tabs.
- Added complete-local-processing runtime policy with `connect-src 'none'`, embedded FFmpeg assets, and development Builder provenance.
- Stable FFmpeg release pinning remains pending a Builder release that contains the `video-audio-extractor` asset.

- Normalize selected `File` objects to Blob-backed WORKERFS inputs with `file.slice()` so browser behavior matches the Builder smoke path without reading the full source into JavaScript memory.
- Add collapsible inspection diagnostics so runtime/FFmpeg failures are no longer hidden behind a generic unsupported-file message.
- Allow WebAssembly compilation under CSP using the narrowly scoped `wasm-unsafe-eval` source.
- Keep hidden workflow status elements hidden before a video is selected.
