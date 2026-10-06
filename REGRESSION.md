# Video Audio Extractor regression checklist

## v0.3.0 automated / fixture coverage

The dedicated Builder profile browser smoke test covers:

- MP4 containing AAC: inspect and AAC -> M4A stream copy;
- WebM containing Opus: inspect and Opus -> OPUS stream copy;
- ALAC: inspect and ALAC -> M4A stream copy;
- MP3: inspect and MP3 -> MP3 stream copy;
- Vorbis: inspect and Vorbis -> OGG stream copy;
- FLAC: inspect and FLAC -> FLAC stream copy;
- MKV with three audio tracks: track inventory, language/title/default metadata, selected-track extraction;
- MPEG-TS containing AAC: inspect, ADTS parameter recovery, timestamp handling, `aac_adtstoasc`, M4A output;
- video-only input: zero-audio inventory;
- selected Opus track → AAC/M4A at 192 kbps, then re-inspection as AAC;
- selected AAC track → PCM16/WAV, then re-inspection as `pcm_s16le`.

## App checks for v0.3.0

- [ ] `build-standalone.bat` succeeds on Windows PowerShell.
- [ ] `dist/index.html` opens directly with `file://` in current Chrome.
- [ ] `dist/index.html` opens directly with `file://` in current Edge.
- [ ] MP4 + AAC produces an M4A file that plays after saving.
- [ ] WebM + Opus produces an OPUS file that plays after saving.
- [ ] A video containing ALAC produces an M4A file.
- [ ] A video containing MP3 produces an MP3 file.
- [ ] A video containing Vorbis produces an OGG file.
- [ ] A video containing FLAC produces a FLAC file.
- [ ] M4A conversion works at 128 / 192 / 256 kbps and defaults to 192 kbps.
- [ ] WAV conversion produces PCM 16-bit output and preserves source sample rate / channel layout where supported.
- [ ] Switching between Original / M4A / WAV updates extension, size estimate, and processing summary without stale values.
- [ ] Multiple audio tracks show useful title/language/default labels without normal-UI stream numbers.
- [ ] Switching tracks updates codec / bitrate / sample rate / channel details.
- [ ] Unsupported copy codec does not guess an unchanged format; M4A/WAV remain available only when the Builder reports transcode support.
- [ ] Video without audio shows the friendly no-audio state.
- [ ] Audio-only input stops with the audio-file message.
- [ ] Cancel terminates the active Worker and leaves the selected video/settings available.
- [ ] Reprocessing cancellation preserves the previous completed result.
- [ ] Replacing a source with an unsaved result asks for confirmation.
- [ ] Replacing a source after saving does not ask unnecessarily.
- [ ] Long filenames wrap without horizontal scrolling.
- [ ] Output basename sanitizes Windows-invalid characters and keeps extension outside the editable field.
- [ ] Japanese / English switching preserves the selected source, settings and completed result.
- [ ] 320 px smartphone width has no horizontal scrolling or overlapped bottom tabs.
- [ ] Result tab remains disabled until a valid output exists.
- [ ] Save button clearly includes the output format.
- [ ] No runtime request occurs with DevTools Network open.
- [ ] Source video is mounted via WORKERFS and is not read through `File.arrayBuffer()`.
- [ ] `connect-src 'none'` remains in the generated HTML.

## MP3 / LAME v0.4.0

- MP3 format appears only when the embedded Builder manifest advertises MP3 transcoding.
- 128 / 192 / 256 / 320 kbps are available; default is 192 kbps.
- Mono and stereo output are selectable.
- A source with more than two channels shows the MP3 channel-reduction warning.
- The generated filename extension switches to `.mp3`.
- Output estimate uses the selected MP3 bitrate.
- The runtime receives `bitrateKbps` and `channels` only for MP3.
- Builder import/package checks reject an artifact without `mp3Encoder: libmp3lame`, the complete bitrate matrix, or mono/stereo capability.
- Existing stream-copy, M4A, WAV, cancellation, result preservation, language switching, and mobile tabs remain unchanged.

## v0.5.0 result / error states

- Processing failure with no prior result enables the Result step and shows a user-facing failure message.
- Processing failure with a prior completed result keeps that result playable/saveable and shows that the previous result was preserved.
- Cancelling a new processing run follows the same preservation rule and leaves an explicit cancellation state.
- “Back to settings” returns to Format; “Try again” reruns when the current settings are valid.
- Result shows “not saved” before download and “saved” after download.
- Saving uses the filename captured when the result was created.
- Technical diagnostics remain collapsed by default and do not expose raw runtime details unless expanded.

## v0.6.0 mobile / accessibility

- [ ] 320 px viewport has no horizontal scrolling.
- [ ] Sticky header and fixed mobile tabs do not cover the active panel.
- [ ] Bottom navigation respects left / right / bottom safe-area insets.
- [ ] Buttons, selects, icon buttons, workflow tabs, and expandable summaries provide at least 44 px touch targets.
- [ ] Mobile workflow tabs support ArrowLeft / ArrowRight / Home / End across enabled steps.
- [ ] Automatic mobile transitions move focus to the new step heading.
- [ ] Unavailable Audio / Format / Result panels are inert and cannot receive keyboard focus.
- [ ] Inspection status, source errors, processing progress, cancellation/failure, completion, and save toasts are exposed to assistive technology without duplicate announcements.
- [ ] Progress switches from indeterminate text to aria-valuenow / aria-valuetext when reliable percentage data becomes available.
- [ ] Help and confirmation dialogs keep focus inside the dialog and restore focus to their opener after closing.
- [ ] Long filenames wrap without pushing the source card wider than the viewport.
- [ ] Japanese / English switching updates accessible labels for the workflow, audio preview, processing progress, and language button.

## v0.7.0 robustness / repeated-use

- [ ] Starting extraction twice cannot create two concurrent runs.
- [ ] Cancelling during runtime preparation is reported as cancellation, not failure.
- [ ] Replacing the source while extraction is running aborts the old Worker and the old catch/result cannot overwrite the new source state.
- [ ] Replacing the source while inspection is running ignores the old inspection completion/error.
- [ ] A failed/cancelled retry preserves the previous completed result and its Blob URL.
- [ ] A successful retry revokes the previous result Blob URL only after the new result is ready.
- [ ] Replacing a completed result detaches the `<audio>` preview before revoking the old URL.
- [ ] Output Worker Uint8Array references are cleared after creating the result Blob.
- [ ] Real page unload aborts active work, revokes the result URL and disposes/nulls the runner.
- [ ] BFCache `pagehide.persisted` does not dispose the runner or revoke the current result URL.
- [ ] After a browser download is requested, the UI says download/save was started rather than guaranteeing disk persistence.
- [ ] Japanese result/error/cancellation/save-state text never falls back to English.

## v0.8.0 privacy / offline / bilingual

- [ ] `connect-src 'none'` is present in normal and self-extract HTML.
- [ ] Runtime source contains no `fetch`, XMLHttpRequest, WebSocket, EventSource, sendBeacon, CDN URL, API URL, analytics, or update-check request.
- [ ] Direct `file://` opening works in supported Chrome / Edge without runtime network access.
- [ ] LocalStorage keys are limited to language, last output format, AAC bitrate, MP3 bitrate, and MP3 channel preference.
- [ ] Video/audio bytes, filename/history, generated result bytes, Blob URLs, and track metadata are never written to LocalStorage.
- [ ] Reload restores the five allowed lightweight preferences only.
- [ ] Selecting a different source/track does not silently replace the saved MP3 mono/stereo preference.
- [ ] Japanese and English translation dictionaries have identical key sets.
- [ ] Switching language updates dynamic errors, audio summary labels, privacy/offline help, accessible labels, and result state without reloading.
- [ ] Help accurately states what is stored locally and that input/output media are not uploaded.
- [ ] Normal and self-extract HTML restore to byte-identical application content.

## v0.9.0 release candidate

### Automated / source-build contract

- [x] App version and visible badge/help scope are v0.9.0 RC.
- [x] Desktop Result actions use `navigateToStep('format')`; they no longer call the mobile-only page switch directly.
- [x] Mobile Result actions still return to the Format step.
- [x] `video-audio-extractor.html` is generated at repository root and must be byte-identical to `dist/index.html`.
- [x] favicon and upper-left app icon are generated from the same canonical `assets/favicon.svg`.
- [x] `connect-src 'none'`, `wasm-unsafe-eval`, WORKERFS, the five-key LocalStorage boundary, and the v0.4 Builder capability contract remain enforced.
- [x] Normal/self-extract payload restoration is byte-identical.

### Manual RC checks before v1.0.0

- [ ] Current Chrome on Windows: choose a video, process it, then press **設定を変えてもう一度 / Change settings and extract again** and confirm the Format section is visibly scrolled/focused.
- [ ] Current Edge on Windows: repeat the desktop result-to-Format check.
- [ ] Mobile/narrow view: the same action switches from Result to Format without horizontal scrolling or fixed-UI overlap.
- [ ] Japanese and English complete flows.
- [ ] `file://` opening for `video-audio-extractor.html`, `dist/index.html`, and `dist/index.self-extract.html`.
- [ ] Representative stream copy: AAC→M4A, Opus→OPUS, MP3→MP3, FLAC→FLAC.
- [ ] Representative conversion: M4A 192 kbps, MP3 192 kbps stereo + one mono case, WAV PCM16.
- [ ] Multiple audio tracks, no-audio video, and audio-only input.
- [ ] Cancel during preparation/processing; retry; source replacement during processing; unsaved-result confirmation.
- [ ] DevTools Network stays empty after initial HTML load during inspect/process/preview/save.
- [ ] Console has no unexpected errors during the complete flow.
- [ ] Fresh `assets/screenshot.png`, `assets/screenshot-en.png`, and `assets/screenshot-mobile.png` are captured from the v0.9 RC UI.
- [x] Builder v1.10.0 Release asset exists for `video-audio-extractor`; provenance pins tag `v1.10.0`, release commit, asset ID, byte count, SHA-256, BUILDINFO checksum, and corresponding-source checksum, with `developmentOnly: false`.

## v1.0.0 stable release

### Automated / packaging checks

- [x] App metadata and visible version badge are v1.0.0.
- [x] Help text contains stable supported-scope wording and no release-candidate wording.
- [x] Production FFmpeg provenance remains pinned to Builder v1.10.0, exact Release asset name/size/SHA-256, release commit, BUILDINFO checksum, and corresponding-source checksum.
- [x] `developmentOnly` is false for the production FFmpeg provenance.
- [x] `video-audio-extractor.html` is byte-identical to `dist/index.html`.
- [x] Normal/self-extract payload restoration is byte-identical.
- [x] `connect-src 'none'`, `wasm-unsafe-eval`, WORKERFS, and the five-key LocalStorage boundary remain present.
- [x] Fresh `assets/screenshot.png`, `assets/screenshot-en.png`, and `assets/screenshot-mobile.png` are captured from the v1.0.0 UI.
- [x] Headless Chromium smoke: AAC MP4 inspection, AAC→M4A stream copy, MP3 192 kbps stereo conversion, download creation, result→Format navigation, no-audio video, audio-only input, and no runtime HTTP(S) request all pass with no console error.
- [x] Host `ffprobe` confirms the browser-produced M4A contains AAC and the browser-produced MP3 contains MP3 audio.

### Manual release smoke checks

- [ ] Windows Chrome: complete one extraction and confirm **設定を変えてもう一度 / Change settings and extract again** returns to the Format section.
- [ ] Windows Edge: repeat the desktop result-to-Format flow.
- [ ] Smartphone or narrow viewport: complete the Video → Audio → Format → Result flow without horizontal scrolling or fixed-UI overlap.
- [ ] Japanese and English complete flows with representative stream-copy and conversion outputs.
- [ ] Direct `file://` opening of `video-audio-extractor.html`, `dist/index.html`, and `dist/index.self-extract.html`.
- [ ] DevTools Network remains empty after initial document load during inspect/process/preview/save.
- [ ] Console shows no unexpected errors during the complete flow.


## Next-run filename reset and dotted-name regressions

`node scripts/test-output-filename.cjs [HTML path]` executes application functions and event bindings in a synthetic Node VM harness. With no path it tests `src/index.template.html`; the repository checker also runs readable, root, and restored self-extract output. It does not run a browser, decode media, or establish visual accessibility.

Automated coverage:
- Default multi-dot source names and custom dotted names survive repeated blur/extract/save.
- Reset restores the current source stem plus `-audio`, focuses the field, and preserves track/format/quality/channels and preference boundaries.
- Reset is disabled and guarded without usable input and during preparation/processing; cancellation/failure restore availability.
- Reset/edit leave a completed result's captured filename and URL intact; successful retry uses the new draft and revokes only the superseded URL.
- Path/control/invalid characters, empty/all-dot input, reserved device names with dot suffixes, Unicode and truncation boundaries stay safe and idempotent.
- Actual selected stream index, WORKERFS, copy/M4A/MP3/WAV arguments, CSP and five-key preferences remain unchanged.

Manual follow-up, not claimed by the automated suite:
- [ ] Keyboard Enter/Space activation, visible focus, and correct field focus after reset.
- [ ] Japanese/English at desktop and 320 px widths, including long names and helper text.
- [ ] Real media extraction/download in all output modes and direct `file://` use in supported browsers.
