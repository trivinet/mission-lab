# VE-01: release acceptance scenario (ML-SYS-001 section 14)

Spec: `apps/web/e2e/acceptance.spec.ts` (one Playwright test, 13 named `test.step` blocks).
Task: ML-TASK-035. Evidence layer: end-to-end, on the production build, real engine in the
worker, Chromium only. Gate: G3 evidence (m1-verification-plan.md, VE-01).

## What this is, and what it is not

This is a **flow test**. It shows that a user can walk the 13 steps of section 14 in the real
built app, and that every step produces an observable outcome. It is **not numerical
verification.** It never decides whether an orbit, a delta-v or a plotted value is physically
right. Numerical evidence is the G1 suites (VT-xx) and the conformance runs; section 14 itself
says the release is not accepted unless that suite passes. The only numbers asserted are hand
arithmetic on inputs (r_p = a(1-e), r_a = a(1+e)), the sign of the changes caused by a prograde
burn, and exact equality of the app's own data with itself (hook vertices against the engine
arrays; run 1 against run 2).

Scenario used: a = 8000 km, e = 0.1, i = 51.6 deg, RAAN 30 deg, argp 60 deg, nu 10 deg; 5400 s at
60 s (91 samples coast); one maneuver at t = 2400 s, RSW delta-v [0, 100, 0] m/s.
Hooks: `?sceneHook=1` (scene and plot hooks). The worker is observed from the page by wrapping
`Worker.prototype.postMessage` and a `message` listener (no product change), to read the
requestIds of the requests and of the results.

## Step map

| # | Step (section 14) | What the user sees / what is asserted | Requirement |
|---|---|---|---|
| 1 | Create an elliptical orbit | Entered elements shown with units (a in km), scenario name in the toolbar, unsaved indicator true, result state none, model panel says no model | ML-FR-001, ML-FR-011 (indicator) |
| 2 | Inspect elements | Derived panel: perigee 7200 km, apogee 8800 km (hand calc), period, specific energy with units, tagged computed, no inputs in the panel; degeneracy classification NONE, undefined list "none" | ML-FR-002 |
| 3 | Propagate | Run: state current, 91 samples, 0 maneuver events, no diagnostics, no banner, timeline visible | ML-FR-004 |
| 4 | Unmodified trajectory | Hook: one segment, 273 vertices, every vertex equals fround(engine sample x scale) (0 mismatches of 273), no markers, no coast run drawn; segment summary "91 samples"; comparison panel says no comparison | ML-FR-004, ML-FR-007 |
| 5 | Define RSW maneuver | Maneuver block with time and R/S/W inputs holding the entered values, RSW note visible; result becomes stale, scene hook stale, stale chip visible | ML-FR-005, ML-FR-006 |
| 6 | Execute | Run: current, 1 event, total delta-v 100 m/s shown, sample count at least the coast count, no diagnostics | ML-FR-006 |
| 7 | Resulting trajectory and location | Hook: two segments kind maneuvered, exact vertices (0 mismatches), one marker whose position equals the end of segment 0 exactly; both segment summaries; playback jump to maneuver reads t = 2400 s | ML-FR-007, ML-FR-008 |
| 8 | Parameter changes | Three plots exist (altitude, speed, true anomaly), each with the maneuver time at 2400 s, legend has Maneuver time; comparison table has all nine rows with before, after, difference cells; differences in a, period and specific energy carry a numeric SI attribute and are positive (prograde burn); delta-v RSW, magnitude and inertial rows present | ML-FR-009, ML-FR-010 |
| 9 | Compare both | Hook: one coast segment plus two maneuvered; same first position, different final position; coast-run summary visible; legend names Coast run (dashed grey) and Maneuvered run (solid teal); every plot holds both runs | ML-FR-010 |
| 10 | Save | Real download event; file name ends .scenario.json; JSON has schemaVersion "1.0", name, the maneuver (t, [0,100,0]), a = 8 000 000 m, e = 0.1; indicator moves true to false | ML-FR-011 |
| 11 | Reload | New scenario (clean, no dialog) clears name, maneuver and result; load through the file input restores every field, indicator false, result state none, scene empty; saving again gives byte-identical text | ML-FR-011, ML-FR-001 |
| 12 | Reproducibility | Run again: raw bytes of every engine position array (maneuvered segments and coast) equal the first run; the two requestIds posted equal the first run's two; each id appears in a worker response; sample count equal | ML-SYS-001 section 14 step 12 and the requestId contract (no dedicated ML-FR); ML-FR-011 for the re-saved file |
| 13 | Model, frame, metadata | Model panel current, all 13 rows visible and non-empty, frame GCRF, duration and output step shown, at least one limitation, "Not qualified for operational use" visible, Earth orientation labelled illustrative | ML-FR-012 |

Also asserted over the whole run: no browser console errors.

## Observability notes

- requestId is not shown anywhere in the UI or in the hooks. The spec reads it from the worker
  messages (page-side wrapper). This is observation of the real request and response, not a
  product change, but it is not something a user can see; the user-visible reproducibility
  evidence is the identical plots/scene data and the byte-identical re-saved file.
- Samples are compared as raw bytes of the Float64 position arrays, so `-0` versus `0` and NaN
  payloads would show as differences. Velocity arrays are not exposed by the hook and are not
  compared.
- Display formatting of the comparison table is deliberately not asserted (ML-TASK-034 changes
  it); the spec uses presence, structure, the `data-value-si` attribute and sign.

## Run results

Recorded in the ML-TASK-035 report section (`docs/backlog/tasks/ML-TASK-035.yaml`).

## Not proven by this test

- Numerical correctness of anything shown (propagation, maneuver, element conversion, derived
  values, analysis). Not covered here; see G1 and conformance runs.
- That the 3D picture looks right (only vertex data is checked; visual plausibility is not
  evidence).
- That the comparison-table numbers are right (only presence, structure and the sign of three
  differences).
- Velocities, full result contents and plotted values against an independent reference.
- Other browsers, other OSes, real OS file dialogs, slow-CI behaviour beyond three local repeats.
- Reproducibility across different machines or engine builds; only same build, same browser,
  same session.
- The scenario variants: circular or degenerate orbits, multiple maneuvers (not in M1), open
  orbits and error paths (covered by the other specs).
