# Release-readiness review (ML-TASK-040)

Author: Verification Engineer. Date: 2026-11-17. Branch `test/ml-task-040-readiness`, built from
`origin/docs/ml-task-040-041-contracts` (`7a22214`). Requirements: ML-UX-001..004, ML-NFR-005,
ML-NFR-006. Product code was not touched; every defect below is a finding for the owner to accept
or send to a fix task.

Evidence layers: this review is **L3-style end-to-end and tooling evidence on the built app
(Chromium, headless, Windows 11, one machine)**. It contains no numerical verification (G1 suites
and conformance own that) and no L1/L2 reference comparison. Visual plausibility is not used as
evidence anywhere.

## 1. Full regression

| Check                                                  | Result                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                       | exit 0                                                         |
| `pnpm lint`                                            | exit 0                                                         |
| `pnpm typecheck`                                       | exit 0 (all 7 workspaces)                                      |
| `pnpm test` (Vitest, 6 projects)                       | 105 files, **1978 tests passed**, 0 failed                     |
| conformance project alone (`vitest run --project conformance`) | 28 files, **636 tests passed** (included in the 1978)  |
| `pnpm build`                                           | exit 0 (only the known chunk-size notice, 1397 kB)             |
| `pnpm format:check`                                    | exit 0                                                         |
| `pnpm check:boundaries`                                | exit 0, 20/20 fixtures                                         |
| `pnpm test:e2e` baseline, run 1 / 2 / 3                | 77 / 77 / 77 passed (42.5 s, 42.0 s, 39.9 s)                   |
| `pnpm test:e2e` with the 14 new tests, run 1 / 2 / 3   | 91 / 91 / 91 passed (50.9 s, 50.6 s, 51.0 s)                   |
| `pnpm perf:envelope` (once, 2 m 20 s)                  | 6 sizes x 3 reps all `ok`; numbers differ from the record, see D-1 |
| `pnpm audit --audit-level high`                        | exit 1: 1 high (picomatch), 1 moderate (minimatch); production dependencies: none, see D-10 |

Flake: none observed in 6 full e2e runs (3 x 77, 3 x 91 tests; no retries configured in the
suite, none used). Ports 4173 and 4174 were checked free before the runs and after; the a11y
harness uses an in-process server and leaves nothing listening.

## 2. Accessibility

### Method and tooling

- Automated: **axe-core 4.11.1**, rules `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa,
  best-practice`, injected at runtime into the built app from a throwaway folder
  `spikes/axe-readiness/` (own `package.json`, installed with npm, outside the pnpm workspace;
  the root lockfile and the app are unchanged). Playwright comes from the root install. See
  `spikes/axe-readiness/README.md`. Raw output: `spikes/axe-readiness/results/axe.json`.
- Contrast: computed (WCAG 2.x relative luminance), not estimated. Token pairs from the CSS in
  `apps/web/src/index.css` against the documented hex values, and every visible text node in the
  built app per state (computed colour, alpha-composited, effective ancestor background, opacity
  included). Output: `results/contrast.json`.

### axe results (viewport 1440x900)

| State                                   | Violations | Needs-review (incomplete)                                    |
| --------------------------------------- | ---------: | ------------------------------------------------------------ |
| 1 none                                  |          0 | aria-prohibited-attr (3), color-contrast (5)                 |
| 2 none + field error                    |          0 | aria-prohibited-attr (3), color-contrast (9)                 |
| 3 current (coast)                       |          0 | aria-prohibited-attr (3), color-contrast (5)                 |
| 4 stale                                 |          0 | aria-prohibited-attr (3), color-contrast (7)                 |
| 5 maneuver added (stale)                |          0 | aria-prohibited-attr (3), color-contrast (7)                 |
| 6 maneuver current + comparison         |          0 | aria-prohibited-attr (3), color-contrast (6)                 |
| 7 presets menu open                     |          0 | + aria-valid-attr-value (1), color-contrast (11)             |
| 8 error (failed run)                    |          0 | aria-prohibited-attr (3), color-contrast (7)                 |
| 9 confirm dialog open                   |          0 | color-contrast (1)                                           |
| 10 error dialog open                    |          0 | none                                                         |
| 11 current with a warning diagnostic    |          0 | aria-prohibited-attr (3), color-contrast (6)                 |

**0 violations in 11 states.** The "needs review" items were examined one by one:

- `aria-prohibited-attr` (3): `aria-label` on the three plain `div` column wrappers ("Scenario
  editor", "Simulation view and analysis", "Results and assumptions"). Real, minor: the label is
  ignored by assistive technology on a role-less div. D-7.
- `color-contrast` incompletes: icon glyphs in `aria-hidden` spans ("no text"), the scene
  overlay `bg-[#151b23]/90` (background over a canvas: axe cannot resolve it), and, with a popup
  or modal open, elements "overlapped by another element". None is a measured failure. The
  computed per-text-node scan below covers the text that axe could not resolve, except text drawn
  over the WebGL canvas (see not verified).
- `aria-valid-attr-value` on the Presets button: checked by hand, `aria-controls` points at an id
  that exists (`_r_0_`) when the menu is open. Benign.

### Contrast (computed)

- The CSS custom properties equal the documented tokens in `docs/design/design-tokens.md`:
  **0 mismatches of 20 tokens**.
- 60 token pairs (text and accent colours on the 4 backgrounds at 4.5:1; trajectory, marker,
  focus, control-border colours at 3:1): **none below its threshold**.
- Every visible text node in the built app, with opacity and alpha composited: 136 to 350 texts per
  state, minimum ratio **5.97:1 (none, current, stale, invalid) and 5.40:1 (error, maneuver,
  dialog)**, **0 texts below 4.5:1** in 7 states. No text has effective opacity below 1 in the
  stale state, so the viewport dimming caveat in the design-token record does not apply to text.

### Structure

- **Names and roles.** All 34 tab stops (state none) have an accessible name: native labels on all
  inputs, text on buttons, `aria-label` on the 3D canvas ("Orbit view, inertial GCRF axes, +Z up.
  Arrow keys orbit, plus and minus zoom, Home resets the camera.") and the playback slider
  (`aria-valuetext` in seconds). The only unnamed element is the visually hidden file input
  (`aria-hidden`, `tabindex=-1`), reached through the Load button.
- **Text alternatives.** The 3D canvas has a name and the legend list and segment summaries are
  text. Plot canvases have `role="img"`, `aria-label` and `aria-describedby` pointing to text; the
  comparison table is a real table. Result state, banner, unsaved indicator and diagnostics are
  `role="status"` or `role="alert"` (failed run).
- **Focus order.** Skip link, toolbar (New, Load, Save, Presets, Export CSV when enabled, Run),
  editor fields in visual order, maneuver controls, 3D view, camera reset, axes option, playback
  controls, plot toggles, comparison copy, model details. The order follows the reading order
  of the three columns' DOM; no positive `tabindex`. The 3D canvas does not trap Tab (checked in
  the new e2e: Tab from the canvas goes to Reset camera).
- **Visible focus.** Every one of 34 tab stops has `outline: solid 2px`, colour `#9cc4ff`, and is
  inside the viewport. The offset is 2 px on buttons and the canvas, **1 px on text inputs**
  (documented as 2 px, D-9). Focus ring contrast 8.76:1 to 10.83:1.
- **Not colour only.** States carry an icon and a label (none, computing, current, stale, error);
  stale differs from warning by symbol and text; coast is dashed and maneuvered is solid with a
  legend; errors are prefixed by a cross and "Error:" for screen readers. No finding.
- **Reduced motion.** A `prefers-reduced-motion` block exists in the stylesheet (spinner).
- **Dialogs.** Native modal `<dialog>` with `aria-labelledby`; safe action focused first, Escape
  closes, focus returns to the opener (asserted by existing e2e, which passed).
- **Reflow.** Viewport widths 1280, 1024 and 768: no horizontal scroll. At 400 px the document is
  441 px wide, i.e. horizontal scrolling (WCAG 1.4.10 asks for none at 320 CSS px). The design is
  declared desktop-first. D-8.

## 3. Keyboard

New spec `apps/web/e2e/release-readiness.spec.ts`, first test: **VE-01 by keyboard only**. It
never calls `click`, `fill` or any locator action on a control; it moves focus with Tab
(`tabTo`) and acts with Enter, Space, typing and arrow keys. Steps and result:

| VE-01 step                         | By keyboard                                                              | Result |
| ---------------------------------- | ------------------------------------------------------------------------ | ------ |
| 1-2 enter orbit, inspect derived   | name, duration, step, a, e, i, RAAN, argp, nu typed; perigee 7200 km hand check | pass |
| 3 run                              | Enter on Run; 91 samples                                                 | pass   |
| 5-6 maneuver                       | Enter on Add maneuver; t, dv R/S/W typed; Space on Run; 1 event          | pass   |
| 7 playback                         | Enter on "jump to maneuver" (t = 2400 s), Enter on "end" (5400 s), Home and ArrowRight on the slider | pass |
| 8-9 plots, comparison              | Space toggles a plot checkbox and back; comparison table visible         | pass   |
| 3D view                            | focus on canvas, arrow and Home keys, Tab leaves to Reset camera         | pass   |
| 13 model                           | Enter collapses and re-expands the details; not-qualified statement visible | pass |
| 10 save                            | Enter on Save; download `*.scenario.json`; unsaved indicator false       | pass   |
| 11 new, load                       | Enter on New; Enter on Load opens the file chooser (Playwright supplies the file); fields restored | pass |
| 12 run again                       | Enter on Run; current                                                    | pass   |
| presets menu                       | ArrowDown opens, Escape closes, focus returns to the button              | pass   |

No console error or page error during the flow. The test passed in 3 consecutive full-suite
runs (the first development iteration failed on two mistakes in my own test, a details element
that is open by default and a synthetic event Chromium does not deliver; both fixed in the test,
not in the product). The existing e2e specs add keyboard
checks for the dialogs and the editor (kept, they passed).

Limits: the OS file dialog and the OS download prompt cannot be driven headless; the chooser and
the download are observed as Playwright events. Comparison-table cell values are not asserted
(ve-01-acceptance.md says why).

## 4. Error paths

"Usable afterwards" means: the next edit is accepted and a following Run reaches state current
(asserted unless noted). All rows were exercised in a browser by a test that passes.

| Error path                                         | How triggered                                                   | What the user sees                                                                 | Usable afterwards | Evidence |
| -------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------- | -------- |
| Editor validation, 13 field classes (a, e, i, RAAN, argp, nu, duration, step, epoch) | typed invalid values | field message with code, toolbar "problem(s) prevent the run", Run does nothing, existing result unchanged | yes | editor.spec (existing, passed) |
| Perigee not above the reference radius             | a, e                                                            | field message; run blocked                                                         | yes               | editor.spec (existing) |
| Maneuver validation (time out of range, non-finite dv, second maneuver) | typed                                  | maneuver problems list; run blocked                                                | yes               | editor.spec (existing) |
| **Sample limit exceeded**                          | duration 1 000 000 s, step 1 s (1 000 001 samples)              | "The run would produce 1000001 samples; the limit is 1000000. (SAMPLE_COUNT_EXCEEDED)" on the step field; run blocked, state stays none. 999 999 s accepted | yes | new spec; message wording see D-2, D-3 |
| **Failed run, non-finite state**                   | maneuver dv_S = 1e300 m/s                                       | chip "Run failed", banner `role=alert` "Run failed: ...", diagnostic `NON_FINITE_STATE`; Export CSV disabled | yes, fixed dv then run gives current | new spec |
| **Failed run, propagator**                         | duration 1e300 s, step 1e298 s                                  | `PROPAGATOR_NOT_CONVERGED` with segment and time                                   | yes               | new spec |
| **Rectilinear fall** (burn cancels the circular speed, v parallel to r then zero) | e = 0, a = 7000 km, dv_S = -sqrt(mu/a) | **not an error**: state current, warning `REFERENCE_SPHERE_INTERSECTION` (periapsis radius 1e-25 m) | yes | new spec, probe; see D-5 |
| Worker `error` event (crash) while computing       | page-side double: error event dispatched on the worker          | chip "Run failed", banner "The simulation worker failed: boom"                     | yes, a second worker is created and the next run is current | new spec |
| Worker `messageerror`                              | page-side double (handler called directly)                      | "The simulation worker sent a message that could not be read."                     | not re-run        | new spec |
| Worker cannot start                                | page-side double (constructor throws)                           | "The simulation worker could not start: ..."; the editor still accepts input       | editing yes; run not retried | new spec |
| Rejected file: invalid JSON, unknown schema version, schema violation, over 64 KiB, out-of-range value | file input | error dialog with message and offending field paths; Escape closes; scenario and unsaved indicator unchanged | yes | persistence.spec (existing) |
| Rejected file: empty, binary bytes, `null`, `[]`, `"string"` | file input                                                | error dialog with a message; no page error; scenario unchanged                    | yes               | new spec |
| Schema-valid file the engine would reject (a = 6000 km) | load                                                       | error dialog; scenario keeps its values                                            | yes               | new spec |
| Save while the scenario is invalid                 | duration 0, Save                                                | error dialog listing `DURATION_NOT_POSITIVE`                                       | yes               | persistence.spec (existing) |
| New, Load, Preset with unsaved changes             | buttons                                                         | confirmation dialog, Cancel has focus, Escape cancels, confirm replaces            | yes               | persistence.spec, presets-csv.spec (existing) |
| Stale result                                       | any physical edit after a run                                   | chip and banner "stale", values italic, old trajectory kept                        | yes               | result-states, scene specs (existing) |
| Closing or reloading the tab with unsaved changes  | n/a                                                             | **no warning** (no `beforeunload` handler)                                         | n/a               | source search, D-6 |
| 3D view render failure                             | not triggered                                                   | code shows an alert and keeps the summary; **not exercised**                       | n/a               | not verified |

Worker crash from the UI: it cannot be triggered by a user action, so the doubles above are the
only way; they use the page's own `Worker` object and change no product code. A synthetic
`messageerror` event is not delivered to the handler property by Chromium, so that case calls the
handler the page installed directly (stated in the spec).

## 5. Findings

Severity: blocker (must fix before release), major, minor. Recommendation: fix before release,
accept, or defer to M2. The owner decides each.

| ID   | Severity | Finding | Recommendation |
| ---- | -------- | ------- | -------------- |
| D-1  | **major** | **The performance record no longer matches the release candidate.** Same machine and harness as `performance-envelope.md` (git history: harness unchanged since ML-TASK-026), measured once on this branch. Max long task at 1 000 000 samples: **3187 ms** (2751-3356) against 503 ms recorded; at 500 000: 1451 vs 306; at 250 000: 789 vs 197; at 100 000: 365 vs 120. Click to current at 1 000 000: 4520 ms vs 1621. Main-page JS heap after the run at 1 000 000: **227 MB vs 7.1 MB** recorded. Engine time equals the record (1433 vs 1424 ms), so the growth is on the main thread after the result arrives (scene, plots, comparison built after the record). During a long task the page does not handle input (ML-UX-003 spirit); the owner's G3 decision on the soft threshold (250 000) and hard limit was based on the old numbers. Not attributed to a commit; machine load differs between the two sessions and one repeat is not enough to exclude it. | **Fix before release (the document, at least):** re-measure on the RC on a quiet machine, update the record, and let the owner confirm the soft-warning threshold against it. A performance fix task is the owner's call (defer to M2 is defensible if the new numbers are accepted). |
| D-2  | minor | When the run is blocked at 1 000 001 samples, the editor shows both the error and the note "Large run: 1 000 001 samples. ... The run is not blocked", and the toolbar shows "Large run: playback will be slower". The note contradicts the error. | Fix before release (text only): do not show the large-run note when the sample-limit error is present. |
| D-3  | minor | Toolbar text "1 problem prevent the run" (singular subject, plural verb); "2 problems prevent" is correct. | Fix before release (one-word text). |
| D-4  | minor | Physically implausible inputs are accepted: a 1e12 m/s burn (about 3000 c) and a = 1e300 km both give state current (ESCAPE_TRAJECTORY warning only, resp. no diagnostic). Overflow is caught only far out (1e154 and 1e300 m/s give state error with NON_FINITE_STATE). | Accept for M1 (educational tool, errors are handled); consider input plausibility limits in M2. |
| D-5  | minor | Impact is warning-only: after a burn that makes the periapsis (even 1e-25 m) lower than the Earth radius, the run is current and the samples continue through the Earth's interior with a `REFERENCE_SPHERE_INTERSECTION` warning. The contract names this a warning, so this is by design, but a user can read a trajectory through the planet as a valid result. | Accept (documented warning); optionally mark the post-impact part in the 3D view in M2. |
| D-6  | minor | Closing or reloading the tab with unsaved changes loses the work without warning (New, Load and Presets do confirm). | Accept for M1 or add a `beforeunload` guard (small); owner's call. |
| D-7  | minor | `aria-label` on three role-less `div` column wrappers is ignored by assistive technology (axe aria-prohibited-attr, needs-review, in every state). The 3D canvas is `role="img"` yet focusable and keyboard-operable; a role that signals interaction would be more accurate. | Fix when convenient (use `section` with a label or `role="group"`); not release-blocking. |
| D-8  | minor | No reflow at narrow widths: 441 px document width at a 400 px viewport (horizontal scroll). Desktop-first is a declared decision, but ML-UX-004 and WCAG 1.4.10 users zooming to 400% would scroll in two dimensions. | Defer to M2 or record as a known limitation in the release notes. |
| D-9  | minor | Focus outline offset on text inputs is 1 px, the design tokens document says 2 px (contrast and width are fine). | Accept and correct the document, or set the offset. |
| D-10 | minor | `pnpm audit --audit-level high` exits 1: picomatch ReDoS (high, no patched version listed) and minimatch (moderate), reached only through dev tooling (eslint, typescript-eslint, Vite); `pnpm audit --prod` reports no known vulnerabilities. The CI audit job is informational by design. | Accept, track upstream; mention in the release notes. |

No blocker was found. D-1 is the only item whose resolution I would want before the release
decision, because the owner's limit decision cites the numbers it contradicts.

## 6. Not verified

- Screen readers (NVDA, JAWS, VoiceOver): not run. Names and roles were checked through the DOM
  and axe only; real announcements, live-region behaviour and reading order were not heard.
- Text drawn over the WebGL canvas (legend and tooltip overlays on the 3D view): contrast not
  computed against the real pixels, only against the layout background; axe could not resolve it.
  The 3D scene and the plot canvases themselves (pixel content) were not checked for contrast,
  colour-blind legibility or non-colour cues; only the declared styles (dashed vs solid, legend)
  were read. No colour-blind simulation.
- Browsers other than Chromium 156, other OSes, touch, high-contrast or forced-colours mode,
  browser zoom to 200 and 400 per cent (only narrow viewports were tried), and printing.
- Hardware GPU rendering (all runs software WebGL).
- The 3D view failure path (`scene-render-error`) was not triggered; the worker `crash` was
  simulated by doubles, never by a real out-of-memory or engine fault.
- D-1 was measured once, as instructed; cause not isolated; no bisect.
- The numbers shown anywhere in the UI are not verified here (flow and robustness only).
- Whether `pnpm audit` results differ in CI or on a later date.
- The existing e2e specs cited in section 4 were run and passed, but their assertions were not
  re-reviewed line by line.
