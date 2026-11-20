# Video Audio Extractor regression checklist

## v1.1.0 simplified range and waveform UX

- [x] A loaded source presets End to the selected audio track's duration; on a different track the default updates.
- [x] Choosing Set a time range immediately starts waveform preparation, without a separate Show waveform step; a retry control is reserved for failed or canceled loading.
- [x] The preview's decoded duration replaces the untouched initial End, but manually selected end markers and typed times are preserved.
- [x] No obsolete waveform/time hint remains in Japanese/English, and the intro paragraph has no extra top padding on PC/mobile.

## v1.1.0 waveform-assisted selection

Automated checks:
- [x] PCM peaks are drawn from decoded WAV and can be played in the browser.
- [x] Play/pause, seeking, playhead start/end actions and keyboard-adjustable range markers work together with manual time fields.
- [x] A decoded WAV preview can be reused for the final WAV without a second FFmpeg invocation.
- [x] Changing the source revokes the preview Blob URL and clears the cache.
- [x] Japanese/English and narrow-mobile tests cover the new controls.

Manual follow-up:
- [ ] Test real Android/iPhone touch-drag, speaker output and iOS Safari audio restrictions.
- [ ] Test unsupported browser-native video codecs with the WAV preview path.

## v1.1.0 local time-range and gain/peak normalization

Automated checks:

- [x] Parse seconds, m:ss, h:mm:ss, fractions; reject malformed or reversed/empty ranges.
- [x] Generate valid PCM16 WAV after sample-accurate range slicing and a fixed gain change; preserve original source samples.
- [x] Peak-normalize a synthetic PCM waveform to approximately -1 dBFS without clipping/silence division errors.
- [x] Enforce known source duration, mono/stereo input and size cap before editing.
- [x] Switch editing output to WAV and disable stream-copy/M4A/MP3 only while edits are active.
- [x] Run actual local Chromium WAV trim/normalize/save smoke on the embedded runtime, verify RIFF/WAVE header, decoded output length, no external runtime requests, and retain existing plain Opus extraction.

Manual follow-up:

- [ ] Android and iOS phones: test duration validation, keyboard, navigation, memory warning, cancel and large input.
- [ ] Real music and speech: verify fixed gain/clipping, peak normalization and very short segments.
- [ ] Long recordings and multichannel formats: verify graceful documented rejection.



## v1.0.5 grouped encoding and estimated size

- [x] Keep `methodSummary` and `outputEstimate` together in the same `output-facts` group, separate from the filename input, before Extract audio.
- [x] Desktop/mobile layout presents both facts horizontally when room permits, including 320px and long Japanese/English labels, without horizontal scrolling.
- [x] Existing estimates remain dynamic when changing MP3/WAV output settings; hide missing estimate without orphaned dividers.
- [x] Cover original, readable and self-extract standalone variants in the synthetic tests and Chromium checks.


## v1.0.5 simplified filename row and summary inset

- [x] Removed the redundant filename reset button and helper text on PC/mobile; name editing, automatic initial names, and completed-result protection are retained.
- [x] Four audio metadata items have 16px left/right text insets on PC/mobile, including the 2-column mobile grid.
- [x] New browser and synthetic-DOM tests cover the removed controls, inset, filename editing, processing lock, and retry.

## v1.0.5 compact intro spacing

- [x] Mobile Chromium verifies that the introductory copy is within 16px of the header and the first workflow panel (8px design spacing, with text bounding-box tolerance).
- [x] Keep the explanatory copy visible before file selection and fully hide the intro after accepting a video.

## v1.0.5 eight-point spacing and quiet cards

Automated source/build regression:

- [x] Every authored CSS padding, margin and gap value is on the 8px spacing grid, including responsive overrides, except browser-controlled safe-area insets (not fixed pixel values).
- [x] No visible h1 remains in the intro; a visually hidden semantic h1 is retained for accessibility.
- [x] The main panels have a subtle single border, no shadow, and 8px corners; selected track and format states remain visible.
- [x] The entire introductory area is removed from the mobile workflow after a video is accepted.

Manual layout review:

- [ ] Inspect PC and smartphone screenshots for rhythm of space, subdued card appearance, and appropriate hierarchy without the hero heading.

## v1.0.5 UI and release integration

Automated Chromium smoke (including 320px, 360px, 390px, tablet-width and desktop; both UI languages):

- [x] Tray/down-arrow SVG matches the PDF Fill & Sign reference shape.
- [x] Local-processing badge is invisible at the mobile page-tab breakpoint but remains visible on desktop.
- [x] The introductory description is visible before selecting a file and becomes hidden on mobile once video selection is accepted.
- [x] Help contains audio-selection, conversion and saving guidance rather than dialog-closing implementation instructions.
- [x] Updated panels, mobile navigation, Help dialogs and long-language layouts retain the existing geometry/overflow checks.

Manual release checks:

- [ ] Review actual desktop and mobile screenshots for overly nested boxes, selected states, touch area and contrast.
- [ ] Verify the readable/self-extract standalone HTML attachments after PR merge.
- [ ] Verify release workflow creates the v1.0.5 tag and GitHub Release only after the PR is merged into main, and is idempotent when re-run.


## v1.0.5 preview, localization and settings

Automated (source, readable build, root copy and restored self-extract):

- [x] Re-rendering result, switching language and saving do not reload the active audio source or reset the playback position in the synthetic DOM harness.
- [x] Unsupported-preview warning remains hidden/visible as appropriate and changes language with the UI.
- [x] Source errors, processing errors and cancellation notices follow language changes.
- [x] Selected-track duration takes priority over container duration; loaded audio metadata can correct the result duration.
- [x] Processing snapshots the filename and MP3 bitrate/channel choice before asynchronous setup; editable settings are disabled during preparation and processing.

Manual follow-up (not represented by synthetic tests):

- [ ] Desktop Chrome/Edge: play extracted audio, toggle language and request save while playback continues; verify elapsed position is unchanged.
- [ ] Mobile Android Chrome: verify unsupported-preview warning, error-language switching, and result playback controls.
- [ ] Multi-audio video with a shorter selected track: verify result duration and estimated size in M4A/MP3/WAV and stream-copy modes.
- [ ] Long MP3/M4A transcode: verify controls lock during preparation/processing, cancel/retry restores controls and prior result, and source replacement remains possible.
- [ ] Direct `file://` opening of both generated variants and DevTools network capture (no runtime external requests).


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


## Next-run filename and dotted-name regressions

`node scripts/test-output-filename.cjs [HTML path]` executes application functions and event bindings in a synthetic Node VM harness. With no path it tests `src/index.template.html`; the repository checker also runs readable, root, and restored self-extract output. It does not run a browser, decode media, or establish visual accessibility.

Automated coverage:
- Default multi-dot source names and custom dotted names survive repeated blur/extract/save.
- Source selection fills the basename with the source stem plus `-audio`; the separate reset button and helper text are absent in both languages.
- The filename field is editable before extraction, locked during preparation/processing, and unlocked after cancel, success, or failure.
- Editing a next-run name leaves the completed result's filename and URL intact; successful retry uses the edited draft and revokes only the superseded URL.
- Path/control/invalid characters, empty/all-dot input, reserved device names with dot suffixes, Unicode and truncation boundaries stay safe and idempotent.
- Actual selected stream index, WORKERFS, copy/M4A/MP3/WAV arguments, CSP and five-key preferences remain unchanged.

Manual follow-up, not claimed by the automated suite:
- [ ] Filename field focus, input, and automatic source-based initial value with keyboard navigation.
- [ ] Japanese/English at desktop and 320 px widths, including long output names and metadata text inset.
- [ ] Real media extraction/download in all output modes and direct `file://` use in supported browsers.
