# Dialog and narrow-header audit

Version: 1.0.3. Baseline: 1.0.2 at 53546787176ca4af06375258bcbf78439d79d353.

## Reproduced issues

Headed cloud Chromium confirmed these issues:
- Outside-Help-backdrop wheel scrolled the page from Y 0 to 593 while Help stayed open.
- At 1180×300, keyboard End scrolled the outer Help dialog and moved Close to −367 px. At 320×252 CSS pixels, Close moved to −801 px. Final Help content was reachable only after the header disappeared.
- At 320×252, the confirmation Open button initially extended beyond the viewport. Scrolling to it clipped the title/Close. Outside wheel also moved the underlying page, and backdrop click did not dismiss confirmation.
- The narrow English header clipped the complete app name and visually hid its version.
- Final preview verification found that desktop-to-narrow resizing while replacement confirmation was open hid its opener in an inactive Video panel; closing preserved the result but left focus on the document body.

## Scoped change

Use open-only flex shells, fixed headers and shrinking scrollable bodies for both dialogs. Lock the background scrolling roots only while a native modal is open. Add target- and coordinate-guarded confirmation backdrop cancellation using the existing finish/focus path. Wrap the narrow name/version while reserving language/Help controls. Preserve existing Help handlers, the canonical artwork, the already-correct decorative shared shield and all engine bytes. Update bilingual Help instructions.

## Verification so far

- Test-first: four new modal/layout/backdrop assertions failed on baseline; shield and existing close-route checks passed. All 6 pass after the change.
- Actual confirmation handlers are exercised for outside clicks at each edge, inside and keyboard-generated child clicks, Close, Cancel, Escape, affirmative completion and focus restoration.
- Filename/lifecycle 14, header/Help 11 and dialog checks 9 all pass on source, root, readable and restored self-extract variants. Icon tests 3/3 pass.
- Reconstruction proved baseline source/root assembly and unchanged official engine/runtime hashes. The wrapper restores exact readable bytes. Local PowerShell is unavailable; official Windows CI remains mandatory.
- Actual baseline saved files from the selected second synthetic audio track were independently fully decoded: unchanged AAC/M4A, 128 kbps mono MP3 and PCM16 WAV. All retained the expected 880 Hz tone; the M4A packets exactly matched all 142 source packets. Editing the next-run name did not rename the existing result.

The initial exact-head official CI and artifact verification passed. Final native verification reproduced the hidden-opener transition above; three additional actual-handler regressions failed before the focus fallback and pass afterward. A visible original opener remains preferred, followed by the active visible mobile tab and then visible Help. Disabled/disconnected/unfocusable candidates are skipped without page navigation. Updated exact-head CI/artifact verification and the targeted native focus supplement remain required before Ready. No pending checklist item is presumed passed.

## Limits

Viewport checks used desktop zoom, not a physical phone. Physical Android/iOS, touch, software keyboard, rotation, Safari/Firefox and direct file:// opening remain unverified. The layout change does not add processing features or runtime network access.
