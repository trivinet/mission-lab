# M1 requirements traceability matrix

**Task:** ML-TASK-041 · **Date:** 2026-11-17 · **Author:** Documentation and Release agent ·
**Status:** Draft, not reviewed by the Verification Engineer.

This matrix maps each requirement of [m1-requirements.md](../requirements/m1-requirements.md)
(ML-FR, ML-UX, ML-NFR) to its acceptance criteria (AC), the test files and the evidence documents.
It does not judge whether a test is sufficient and it does not repeat tolerances. It records what
exists.

Rules used:

- Every file named in backticks was checked to exist in the repository at the commit that adds this
  file (script output in the ML-TASK-041 report). A name was not written unless the file exists.
- A test file is linked to an AC only if its content, title or header names that requirement, VT,
  VI or VE family, or the behaviour of the AC. Linking is by reading titles and headers, not by
  running the tests.
- "Evidence" documents are the approved gate reviews and verification reports. Their approval
  status is the one the gate reviews state.
- **Gap** means no evidence was found for the AC or for the part of it named. **Partial** means
  part of the AC has evidence and the rest is named as a gap.

Abbreviations. Test method letters follow the requirements: N numerical, U unit, I integration,
E end to end, R owner review. G1, G2, G3 are the gate reviews in `docs/releases/`; CR1…CR5 are
`docs/verification/conformance-run-1.md` to `docs/verification/conformance-run-5.md`. Unit tests under `apps/web/src`
run in the `web` Vitest project; `apps/web/e2e/*.spec.ts` are Playwright (Chromium) tests.

## 1. Summary

| Group | Requirements | Covered | Partial | Gap |
|---|---|---|---|---|
| ML-FR (14) | FR-001 … FR-014 | 9 | 5 | 0 |
| ML-UX (4) | UX-001 … UX-004 | 2 | 2 | 0 |
| ML-NFR (7) | NFR-001 … NFR-007 | 2 | 4 | 1 |

"Covered" means every AC has a test or evidence document that names it. "Partial" means at least
one AC, or the review (R) part of one, has none (section 5 lists them). "Gap" means no evidence of
the stated method was found. The 14 functional requirements have 47 acceptance criteria; the 4 UX and 7 NFR
requirements are single statements.

## 2. Functional requirements

### ML-FR-001 Create a new orbital scenario (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 default scenario runs | `apps/web/src/state/default-scenario.test.ts`, `apps/web/src/state/scenario-store.test.ts`, `apps/web/e2e/editor.spec.ts` | G2 (ML-TASK-021) |
| AC2 name, epoch, duration, step editable with units | `apps/web/e2e/editor.spec.ts`, `apps/web/src/state/editor-setters.test.ts` | G2 (ML-TASK-022) |
| AC3 confirmation on unsaved changes | `apps/web/e2e/persistence.spec.ts` ("New scenario: no dialog when clean; confirmation when unsaved") | G3 (ML-TASK-033); G2 section C records it as deferred to that task |

Status: covered.

### ML-FR-002 Configure and validate Keplerian elements (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 six elements, km and degrees in the UI, m and rad stored | `apps/web/src/format/units.test.ts`, `apps/web/e2e/editor.spec.ts` ("every scenario and element field shows its unit") | G2 |
| AC2 validation and angle normalisation | `conformance/src/vt18-invalid-input.test.ts` (VT-18), `apps/web/src/editor/normalise-angles.test.ts`, `apps/web/src/editor/issue-map.test.ts`, `apps/web/e2e/editor.spec.ts` | G1 report (VT-18), G2 |
| AC3 degenerate cases and convention stated | `conformance/src/vt04-degenerate.test.ts` (VT-04), `packages/simulation/src/degeneracy-thresholds.test.ts`, `apps/web/e2e/editor.spec.ts` ("degenerate orbit classification") | G1 report; CR1; ADR-008; accepted reduced scope: VT-04 without a tolerance on the substitute angles (G1-review B.2) |
| AC4 derived quantities, distinct from inputs | `packages/simulation/src/scenario-view.test.ts`, `apps/web/e2e/editor.spec.ts` ("derived values") | G2 (ML-TASK-027) |

Status: covered.

### ML-FR-003 Convert Keplerian elements to Cartesian states (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 elements to state against references | `conformance/src/vt02-elements-to-state.test.ts` (VT-02, L2), `conformance/src/l3-vt02-elements-to-state.test.ts` (L3 Orekit) | CR1, CR3; G1 report; `docs/verification/l2-references-report.md` |
| AC2 round trip, degenerate convention | `conformance/src/vt03-round-trip.test.ts` (VT-03), `conformance/src/vt04-degenerate.test.ts`, `packages/astrodynamics/src/elements.test.ts` | CR1; G1 report |
| AC3 output state declares frame, central body, epoch | `conformance/src/vi01-structure.test.ts` (copies frame, epoch and model into the result, VI-01), `packages/contracts/src/result.test.ts` | G2 (VI-01). **Partial: no test names a state function declaring its frame, central body and epoch directly.** |

Status: partial (AC3).

### ML-FR-004 Propagate an orbit with the two-body model (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 states against references | `conformance/src/vt05-propagation.test.ts` (VT-05, L2), `conformance/src/l3-vt05-propagation.test.ts` (L3) | CR1, CR3; G1 report |
| AC2 energy and angular momentum conserved | `conformance/src/vt06-07-invariants.test.ts` (VT-06, VT-07) | CR1; G1 report |
| AC3 closure after one period | `conformance/src/vt08-closure.test.ts` (VT-08) | CR1; G1 report |
| AC4 sampling times and independence | `conformance/src/vt09-sampling-independence.test.ts` (VT-09), `packages/simulation/src/sampling-grid.test.ts` | CR1; G1 report |
| AC5 identical requests, identical results | `conformance/src/vi01-structure.test.ts` (block "VT-10 determinism"), `packages/simulation/src/run.test.ts`, `apps/web/e2e/acceptance.spec.ts` (step 12) | CR2; G3 (VE-01) |
| AC6 failure gives `status: "failed"` with diagnostic | `packages/simulation/src/run.test.ts`, `conformance/src/vi01-structure.test.ts` (failed-result shape), `apps/web/src/state/scenario-store.test.ts` | CR2 |

Status: covered.

### ML-FR-005 Configure an impulsive RSW maneuver (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 add, edit, remove one maneuver | `apps/web/e2e/editor.spec.ts` ("maneuver: add, edit, UTC label, total |dv| from the engine, remove"), `apps/web/src/state/maneuver-id.test.ts` | G2 (ML-TASK-022) |
| AC2 rejects time out of range, non-finite, second maneuver | `conformance/src/vt18-invalid-input.test.ts`, `apps/web/e2e/editor.spec.ts` ("maneuver validation") | G1 report |
| AC3 total delta-v; RSW convention and along-track note | `apps/web/e2e/editor.spec.ts` (note text "not the velocity direction"), `apps/web/e2e/acceptance.spec.ts` (step 5) | `docs/verification/ve-01-acceptance.md`. **R part: no review record found.** |

Status: partial (AC3 review part).

### ML-FR-006 Execute maneuver propagation (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 RSW basis orthonormal, right-handed | `conformance/src/vt11-13-maneuver.test.ts` (VT-11), `packages/astrodynamics/src/rsw.test.ts`, `verification/src/ref/rsw.test.ts` | CR1; G1 report |
| AC2 inertial delta-v against references | `conformance/src/vt11-13-maneuver.test.ts` (VT-12), `conformance/src/l3-vt12-maneuver-frame.test.ts` | CR1, CR3; G1 report |
| AC3 continuity, exact delta-v, both sides present | `conformance/src/vt11-13-maneuver.test.ts` (VT-13) | CR1; G1 report |
| AC4 zero maneuver equals coast | `conformance/src/vt14-zero-maneuver.test.ts` (VT-14) | G1 report; **accepted reduced scope: e = 0 only (G1-review B.2; open item O-11)** |
| AC5 post-maneuver elements | `conformance/src/vt15-post-maneuver.test.ts`, `conformance/src/vt15-r4-post-maneuver.test.ts`, `conformance/src/l3-vt15-post-maneuver.test.ts` (VT-15) | CR2, CR3, CR4; G1 report; accepted: no L2 element comparison for VT-15, L3 post-maneuver trajectories not compared (G1-review B.2, B.3) |
| AC6 escape or surface intersection propagated with warning | `conformance/src/vt16-escape-intersection.test.ts`, `conformance/src/vt16-r4-hyperbolic.test.ts`, `conformance/src/vt16-r5-hyperbolic.test.ts`, `conformance/src/l3-vt16-escape-intersection.test.ts` (VT-16), `packages/astrodynamics/src/trajectory-flags.test.ts` | CR2, CR3, CR4; G1 report |

Status: covered, with the accepted reductions named.

### ML-FR-007 Display orbital trajectories in 3D (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 Earth, trajectory, markers, camera | `apps/web/e2e/scene.spec.ts` | G2 (ML-TASK-023) |
| AC2 vertices equal `Math.fround(x * s)` (VI-02) | `apps/web/src/scene/scene-geometry.test.ts`, `apps/web/e2e/scene.spec.ts`, `apps/web/e2e/acceptance.spec.ts` (steps 4 and 7) | G2 section A (VI-02: 918 components, 0 mismatches) |
| AC3 inertial axes; Earth orientation labelled illustrative | `apps/web/e2e/scene.spec.ts` (axes option, orientation label), `apps/web/src/scene/scene-geometry.test.ts` ("Earth orientation (illustrative, ADR-004)"), `apps/web/e2e/acceptance.spec.ts` (step 13) | **R part: no review record found.** |
| AC4 display option starts no simulation | `apps/web/src/scene/scene-options.test.ts`, `apps/web/e2e/scene.spec.ts` ("display options start no run") | G2 |

Status: partial (AC3 review part).

### ML-FR-008 Control simulation playback (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 play, pause, scrub, jumps, rates | `apps/web/src/playback/playback.test.ts`, `apps/web/e2e/playback.spec.ts` | G2 (ML-TASK-024) |
| AC2 one `t_s` for time, marker and plot cursor | `apps/web/e2e/playback.spec.ts`, `apps/web/e2e/plots.spec.ts` ("the plot cursor follows the playback time") | G2, G3 |
| AC3 interpolation exact at samples, never across a maneuver | `apps/web/src/playback/interpolate.test.ts`, `apps/web/e2e/playback.spec.ts` | G2 |

Status: covered.

### ML-FR-009 Visualize orbital parameter histories (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 histories for radius, altitude, speed, true anomaly, elements | `packages/simulation/src/analysis/histories.test.ts`, `apps/web/src/plots/plot-model.test.ts` (13 quantities), `apps/web/e2e/plots.spec.ts` | G3 section A; CR5 |
| AC2 axis titles with units, legend, maneuver marker | `apps/web/e2e/plots.spec.ts` (legend "Maneuver time"), `apps/web/e2e/acceptance.spec.ts` (step 8) | **Partial: no test of axis titles and units was found (the code builds them in `apps/web/src/plots/PlotsPanel.tsx`). R part: no review record found.** |
| AC3 plotted values equal the analysis output (VI-03 (a)) | `apps/web/src/plots/plot-model.test.ts`, `apps/web/e2e/plots.spec.ts`, `conformance/src/vi03-analysis.test.ts` | G3 section A; CR5 (VI-03 (b), worst ratio 0.090) |

Status: partial (AC2). Accepted limit: flight-path angle and mean anomaly histories are not provided
(G3 section C, owner, PR #60). ML-SYS-001 section 2.2 lists them; FR-009 AC1 does not.

### ML-FR-010 Compare baseline and maneuver scenarios (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 coast and maneuvered runs, distinct styles | `apps/web/src/state/scenario-store-pair.test.ts`, `apps/web/e2e/plots.spec.ts`, `apps/web/e2e/acceptance.spec.ts` (step 9), `packages/simulation/src/analysis/coast-request.test.ts` | G3 |
| AC2 comparison table rows and delta-v | `packages/simulation/src/analysis/comparison.test.ts`, `apps/web/src/plots/comparison-display.test.ts`, `apps/web/e2e/plots.spec.ts`, `apps/web/e2e/presets-csv.spec.ts` | G3 |
| AC3 values against independent references | `conformance/src/vi03-analysis.test.ts`, `conformance/src/vt15-post-maneuver.test.ts`, `verification/src/ref/analysis.test.ts` | CR5 (5 maneuver cases, worst ratio 0.035); G3 section A |

Status: covered. Accepted limit: quantities with no approved tolerance row are informative only
(G3 section C, owner, PR #65).

### ML-FR-011 Save and load scenario configurations (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 JSON with `schemaVersion` | `apps/web/src/persistence/scenario-file.test.ts`, `apps/web/e2e/persistence.spec.ts` | G3 |
| AC2 save, load, save identical; load, run reproduces (VT-17) | `apps/web/src/persistence/scenario-file.test.ts`, `apps/web/e2e/persistence.spec.ts`, `apps/web/e2e/acceptance.spec.ts` (steps 10 to 12) | G3 section A (VT-17) |
| AC3 invalid files rejected, scenario unchanged (VT-18) | `apps/web/src/persistence/scenario-file.test.ts` (14 classes), `apps/web/e2e/persistence.spec.ts`, `conformance/src/vt18-invalid-input.test.ts` | G3 section A (VT-18, FR-011 AC3 part) |
| AC4 unsaved indicator | `apps/web/src/persistence/scenario-file.test.ts` ("unsaved changes"), `apps/web/e2e/persistence.spec.ts` | G3 |

Status: covered. The 64 KiB size limit was confirmed by the owner (G3 section B, ML-TASK-033).

### ML-FR-012 Display active physical models and assumptions (MUST)

| AC | Tests | Evidence |
|---|---|---|
| AC1 panel content | `apps/web/e2e/model-panel.spec.ts`, `apps/web/src/model-panel/ModelPanel.test.ts`, `apps/web/e2e/acceptance.spec.ts` (step 13) | G2 (ML-TASK-025). **R part: the owner approved the not-qualified wording (G2 section B); no separate review record of the panel content was found.** |
| AC2 rendered from `SimulationResult.model` | `apps/web/src/model-panel/ModelPanel.test.ts` ("nothing about the model is hard-coded"), `conformance/src/vi01-structure.test.ts` (metadata completeness, VI-01) | G2 (VI-01) |
| AC3 not-qualified statement | `apps/web/src/model-panel/ModelPanel.test.ts` ("not-qualified statement"), `apps/web/e2e/model-panel.spec.ts` | G2 (owner-approved wording) |

Status: covered; the panel-content review is not recorded separately.

### ML-FR-013 Predefined example scenarios (SHOULD)

| AC | Tests | Evidence |
|---|---|---|
| AC1 at least three presets through the validation path | `apps/web/src/presets/presets.test.ts`, `apps/web/e2e/presets-csv.spec.ts` | G3 (ML-TASK-034; presets owner-approved) |

Status: covered. Preset values are product choices, not physical references
(`apps/web/src/presets/presets.ts`).

### ML-FR-014 Export simulation results as CSV (SHOULD)

| AC | Tests | Evidence |
|---|---|---|
| AC1 header with units, frame, epoch; one row per sample; values equal result | `apps/web/src/export/csv-export.test.ts`, `apps/web/e2e/presets-csv.spec.ts` | G3 (ML-TASK-034) |

Status: covered.

## 3. Workspace state requirements

| ID | Statement (short) | Tests | Evidence | Status |
|---|---|---|---|---|
| ML-UX-001 | Five result states, failed run is the error state, warnings listed | `apps/web/src/state/result-state.test.ts`, `apps/web/src/state/scenario-store.test.ts` ("error state"), `apps/web/src/state/scenario-store-pair.test.ts`, `apps/web/e2e/result-states.spec.ts` | G2 (VE-02) | Partial: the e2e test covers none, computing, current, stale and validation issues. **No e2e test reaches the error state or the warning list.** Method E is met for four of five states. |
| ML-UX-002 | A physical edit marks the result stale | `apps/web/src/state/scenario-store.test.ts`, `apps/web/src/state/scenario-store-pair.test.ts`, `apps/web/e2e/result-states.spec.ts`, `apps/web/e2e/editor.spec.ts` | G2 (VE-02) | Covered |
| ML-UX-003 | Computation off the main thread; UI stays interactive | `apps/web/e2e/result-states.spec.ts` ("the page responds to input while a run is in progress"), `apps/web/src/worker/worker-runner.test.ts` | G2; `docs/verification/performance-envelope.md` | Covered |
| ML-UX-004 | All inputs reachable by keyboard | `apps/web/e2e/editor.spec.ts`, `apps/web/e2e/playback.spec.ts`, `apps/web/e2e/plots.spec.ts`, `apps/web/e2e/persistence.spec.ts`, `apps/web/e2e/presets-csv.spec.ts`, `apps/web/e2e/model-panel.spec.ts` | G2. The accessibility and keyboard review is ML-TASK-040; its report does not exist yet | Partial: tests exist; the R part (review) is pending ML-TASK-040. G2 and G3 list a screen reader test as not done. |

## 4. Nonfunctional requirements

| ID | Method | Tests and configuration | Evidence | Status |
|---|---|---|---|---|
| ML-NFR-001 | lint | `eslint.config.js` (boundaries rules, restricted imports and globals), `tools/boundary-fixtures/check.mjs` (`pnpm check:boundaries`), `.github/workflows/ci.yml` (steps `lint`, `check:boundaries`) | G1 report (CI) | Covered |
| ML-NFR-002 | review | Task contracts ML-TASK-013 … 016 list it as an acceptance criterion (`docs/backlog/tasks/ML-TASK-013.yaml`, `docs/backlog/tasks/ML-TASK-014.yaml`, `docs/backlog/tasks/ML-TASK-015.yaml`, `docs/backlog/tasks/ML-TASK-016.yaml`) | **No review record of the public-function documentation was found** | Gap (review not evidenced) |
| ML-NFR-003 | lint, I | Determinism: `conformance/src/vi01-structure.test.ts` (VT-10), `packages/simulation/src/run.test.ts`, `packages/astrodynamics/src/kepler-universal.test.ts` | CR2 | Partial: integration covered. **No lint rule against clocks or randomness was found in `eslint.config.js`.** |
| ML-NFR-004 | U, report | `packages/simulation/src/request.test.ts`, `packages/simulation/src/run.test.ts`, `packages/contracts/src/result.test.ts` (`SAMPLE_COUNT_EXCEEDED`), `apps/web/src/editor/sample-warning.test.ts`, `apps/web/e2e/sample-warning.spec.ts` | `docs/verification/performance-envelope.md`; G2 section B (limit 1,000,000 kept, soft warning above 250,000, owner 2026-11-17) | Covered. Limit: measured on one machine with software WebGL (G2 section C). |
| ML-NFR-005 | CI | `.github/workflows/ci.yml` (jobs `checks`, `e2e`) | G1 report (CI run on `main`); G2, G3 ("CI green") | Partial: lint, type-check, build and all Vitest projects including `conformance` run on every PR. Unit, integration and numerical tests are not separate projects in `vitest.config.ts` (contributing.md section 8). |
| ML-NFR-006 | CI | `.github/workflows/ci.yml` (job `audit`) | none | Partial: the audit job exists but is informational, not a required check (comment in the workflow file). **No secret scan was found.** |
| ML-NFR-007 | review | `pnpm-lock.yaml`, `.npmrc`, `.github/workflows/ci.yml` (`--frozen-lockfile`) | `docs/architecture/tech-baseline.md` | Partial: pinning is configured and enforced by the frozen install. The per-PR justification is a review step and no review record was checked. |

## 5. Gaps and partial items (consolidated)

1. ML-FR-003 AC3: no test names a state function declaring frame, central body and epoch.
2. ML-FR-005 AC3, ML-FR-007 AC3, ML-FR-009 AC2: the R (owner review) part has no review record.
   ML-FR-012 AC1: the not-qualified wording is owner-approved; the panel content has no separate
   review record.
3. ML-FR-009 AC2: no test of plot axis titles and units.
4. ML-UX-001: no e2e test of the error state or of the warning list; unit tests cover both.
5. ML-UX-004: the keyboard and accessibility review (ML-TASK-040) is pending; no screen reader
   test.
6. ML-NFR-002: no review record. Gap.
7. ML-NFR-003: no lint rule against clock and randomness found.
8. ML-NFR-005: no separate integration and numerical projects.
9. ML-NFR-006: no secret scan; the audit job is informational.
10. ML-NFR-007: per-PR justification not evidenced by a document.

## 6. Tests with no requirement

These files are not linked above to an ML-FR, ML-UX or ML-NFR by their own title or header. They
check internals, tooling or the reference side.

| File | What it checks |
|---|---|
| `packages/astrodynamics/src/angles.test.ts`, `packages/astrodynamics/src/constants.test.ts`, `packages/astrodynamics/src/stumpff.test.ts`, `packages/astrodynamics/src/vector3.test.ts`, `packages/astrodynamics/src/kepler-universal-rectilinear.test.ts`, `packages/astrodynamics/src/orbit-quantities.test.ts`, `packages/astrodynamics/src/maneuver.test.ts` | Engine internals. VT-01 (`conformance/src/vt01-vector.test.ts`) and VT-19 (`conformance/src/vt19-constants.test.ts`) are plan families without a requirement ("—" in the plan). |
| `packages/simulation/src/sha256.test.ts`, `packages/simulation/src/utc-label.test.ts`, `packages/simulation/src/earth-rotation.test.ts`, `packages/simulation/src/engine-constants.test.ts` | Supporting functions (request id hash, UTC label, illustrative Earth angle, constants). |
| `packages/contracts/src/canonical.test.ts`, `packages/contracts/src/index.test.ts`, `packages/contracts/src/request.test.ts`, `packages/contracts/src/scenario.test.ts`, `packages/contracts/src/validate.test.ts` | Contract schemas and canonical form. |
| `packages/astrodynamics/src/index.test.ts`, `packages/simulation/src/index.test.ts`, `apps/web/src/index.test.ts`, `verification/src/index.test.ts`, `apps/web/e2e/smoke.spec.ts` | Placeholder or smoke tests. |
| The test files under `verification/src/datasets/`, `verification/src/hp/`, `verification/src/ref/` and `verification/src/tol/`, the three under `conformance/src/support/`, and `conformance/src/o1-solver-residual.test.ts` | Self-tests of the independent reference code, tolerance transcriptions and datasets; solver residual check (O-1). Each supports a VT or VI family rather than a requirement directly. |
| `apps/web/src/worker/run-handler.test.ts`, `apps/web/src/worker/worker-runner.test.ts`, `apps/web/src/worker/vi01-integration.test.ts`, `apps/web/src/format/display-precision.test.ts` | Worker protocol, VI-01 in the app, comparison display precision. |

## 7. Evidence documents and their status

| Document | Status as the gate reviews record it |
|---|---|
| `docs/verification/G1-verification-report.md` | Approved at G1 (G1-review B.6) |
| `docs/verification/tolerances.md` | Revision 5, approved 2026-11-16 |
| `docs/verification/conformance-run-1.md`, `docs/verification/conformance-run-2.md`, `docs/verification/conformance-run-3.md`, `docs/verification/conformance-run-4.md`, `docs/verification/l2-references-report.md`, `docs/verification/vt-19-constants.md` | Approved unchanged at `main` 77cdbaa (G1-review B.4) |
| `docs/verification/conformance-run-5.md` | Used as G3 evidence and G3 was approved on it. Its own header still says "In review (not approved)". Readings 5 to 9 of its section 4 have had no separate Systems Architect review (G3 section C). |
| `docs/verification/ve-01-acceptance.md` | G3 evidence for VE-01 |
| `docs/verification/performance-envelope.md` | Owner decision recorded 2026-11-17 |

## 8. Method limits

- Test counts quoted come from the gate reviews: 1574 tests at G1; 1792 unit and 53 e2e tests at
  G2; 1978 unit and 77 e2e tests at G3. This task did not run the suite.
- VE-01 is a flow test, not numerical verification (G3 section C).
- Evidence for the release commit (full suite on the release commit, owner walkthrough) belongs to
  gate G4 and is not in this matrix.
