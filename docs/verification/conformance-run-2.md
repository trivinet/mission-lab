# Conformance Run 2 — remaining VT families, VI-01 and the runner

**Document ID:** ML-VER-005 · **Date:** 2026-11-15 · **Author:** Verification Engineer (ML-TASK-018 part C) · **Status:** In review (not approved)

Second engine run, covering the families conformance run 1 did not: VT-01, VT-06, VT-07, VT-09,
VT-10, VT-11 … VT-16, VT-18 and VI-01, plus the −0 rule (contracts-v1 §11.4 P3). Result: **every
comparison run passed; nothing failed**, so no failure characterisation was needed. §5 lists what
has no approved tolerance and was only reported; §6 what was not run.

## 1. Order of work (evidence for tolerances.md §4.1 and ADR-003)

| Commit | Content | Engine read? |
|---|---|---|
| 733fccf | References (`verification/src/ref/rsw.ts`, `maneuver.ts`, `grid.ts`, `hp/hp-vec.ts`), transcription of the VT-01, VT-06/07, VT-11 … VT-15 formulas, self-tests | No |
| dadff5d | Dataset builder `verification/src/datasets/build-c.ts`, dataset self-checks | No |
| **0e904ea** | **Phase 1 end:** 67 datasets under `test-data/reference-cases/` (vt-01, vt-06-07, vt-09, vt-12, vt-14, vt-15, vt-16, vt-18, vi-01), `producedBy.codeRevision` dadff5d6e225 | No |
| 5d9b54d | Conformance tests in `conformance/src/` (phase 2), committed before the first engine run | Public API only (`index.ts` exports, doc comments and signatures) |

Before 0e904ea nothing under `packages/astrodynamics/src` or `packages/simulation/src` was opened,
and neither were the ML-TASK-016/017/019 reports. In phase 2 only the two `index.ts` files and the
doc comments and signatures of the exported functions used (`runSimulation`,
`buildSimulationRequest`, `deriveRequestId`, `validateScenarioSemantics`, `rswBasis`, the vector
functions) were read. No reference, dataset or tolerance was changed after 0e904ea.

## 2. What was run

| Item | Value |
|---|---|
| Engine | `origin/main` ed672c6 (merge of PR #25, includes PR #26 ML-TASK-019), public API of `@mission-lab/astrodynamics` and `@mission-lab/simulation` |
| Entry point | `runSimulation(request)` for every family except VT-01 (vector functions) and VT-18 (validators and `buildSimulationRequest`) |
| Tolerances | Stored in the datasets, evaluated from tolerances.md revision 3 (approved 2026-11-13) at each dataset's scale with reference-side inputs |
| Runtime | Node.js v24.22.2, Windows 11, Vitest 5.0.5 |
| Command | `pnpm test` (also `npx vitest run --project conformance --silent=false` for the ratio summaries) |

## 3. Results per family

"Ratio" = observed / tolerance (≤ 1 passes); maximum over the family.

| Family | Tests | Comparisons | Passed | Failed | Worst ratio | Where |
|---|---|---|---|---|---|---|
| VT-01 vector identities | 2 | 1000 + exact cases | all | 0 | 0.071 (unit norm); (a) 0.059, (b) 0.048, (c) 0.000 | random triple 23 |
| VT-06 energy | 9 | 1449 samples | 1449 | 0 | 0.0022 | c7, t = 1092 s |
| VT-07 angular momentum | (same 9) | 1449 samples | 1449 | 0 | 0.0017 | c1, t = 2548 s |
| VT-09 sampling independence (exact) | 5 | 57 common samples × 3 runs + events | all | 0 | exact | — |
| VT-10 determinism (exact) | 44 | whole results, incl. typed arrays and requestId | 44 | 0 | exact | — |
| VT-11 RSW basis | 84 | 336 | 336 | 0 | 0.027 (orthonormality), 0.015 (handedness), 0.000 (R ∥ r, W ∥ r × v; see note 1) | c7 / c4, t mid-run |
| VT-12 inertial Δv vs L2c | (84) | 84 | 84 | 0 | 0.0060 | c7, t = 0, cross-track |
| VT-13 impulsive change | (84) | R12, R8 exact ×84; 168 toleranced | all | 0 | 0.014 (‖Δv_I‖ vs ‖Δv_RSW‖); magnitude 0.000 | c4 mid-run, combined |
| VT-14 zero Δv vs coast, e = 0 | 4 (+2 exact-only) | 576 samples × 2 | all | 0 | 0.00059 | c6, off-grid m |
| VT-15 a⁺, e⁺ (tangential at apsis) | 10 (+4 informative) | 20 | 20 | 0 | 0.0016 (a⁺), 0.00053 (e⁺) | c1 circular |
| VT-16 warnings (exact) | 18 | 18 warning sets | 18 | 0 | exact | — |
| VT-16 sub-surface arcs vs L2a / L2b | 3 | 300 × 4 | all | 0 | L2a 0.0050 / 0.0039; L2b 0.030 / 0.025 | subsurface-within-span; elliptic-outbound-long |
| VT-18 invalid inputs (exact) | 48 | code + path multisets | 48 | 0 | exact | — |
| VI-01 structure (exact) | 12 | §13 checks | 12 | 0 | exact | — |
| P3 −0 rule (exact) | 9 | requestId and payload | 9 | 0 | exact | — |

New tests: 254 (conformance project 378, of which 124 from run 1). Whole repository: 53 files,
1153 tests, all passed.

Note 1. VT-11 R ∥ r and W ∥ r × v, and VT-13 magnitude, show ratio 0: the engine and the test
form these quantities with the same expression and got the same binary64 value. These checks only
show that the engine follows the contract definition. They carry no independent numerical evidence.
The independent evidence for the basis is VT-12 (320-bit projection-form reference) and the
orthonormality and handedness checks.

Specific observations:

- VI-01: all ten scenarios (no maneuver, on and off the grid, at 0, at D, zero Δv, h ≥ D,
  h = 0.1 s, one ulp after a grid point, D not a multiple of h) match the independent §5.2 grid
  bit-for-bit. Constants, sampling and epoch are copied, the first sample is bit-identical to
  `initialState`, every typed array owns its whole `ArrayBuffer` and no buffer is shared. A request
  with a maneuver at −0 gives the sample −0 in both segments.
- Rectilinear collision: `status: "failed"`, no segments and no events. The only diagnostic is
  `NON_FINITE_STATE` (error) at t_s = 1030.3459096915992 s. That is bit-identical to the reference
  free-fall time (π/2)√(r₀³/(2μ)) computed in the dataset. No warning precedes it.
- VT-11: the Δv_I of the three unit-axis maneuvers equals the exported `rswBasis` vectors bit-for-bit
  in all 36 axis runs. So the runner uses the exported basis.
- VT-18: all 44 structural and semantic classes return exactly the expected {code, path}, and
  `buildSimulationRequest` returns the same issues. The four accepted boundary controls validate
  and run. `runSimulation` given a scenario returns issues, never a result.

## 4. Evidence layers behind each family in this run

| Family | Layers run | Missing |
|---|---|---|
| VT-01 | L1 | — |
| VT-06, VT-07 | L1 | — |
| VT-09, VT-10 | L1 (self-consistency, exact) | — |
| VT-11 | L1 | — |
| VT-12 | L2c (320-bit, projection formulation; the meaning of R, S, W comes from the same contract text) | L3 |
| VT-13 | L1 (exact R8/R12; toleranced norms) | — |
| VT-14 | L1, e = 0 only | e > 0 (O-11) |
| VT-15 | L1 closed form (exact maneuver in RSW coordinates, 320-bit), tangential burns at an apsis | non-tangential burns (no tolerance); L2 element comparison; L3 |
| VT-16 | Warnings: independent analytic classification (L2). States: L2a, L2b for elliptic sub-surface arcs | hyperbolic arc states; L3 |
| VT-18, VI-01, P3 | Contract conformance (exact) | — |

## 5. Gaps: no approved tolerance, so nothing was asserted

1. **VT-14, e > 0** (c4, c5): no transport factors K_r(e), K_v(e) (open item O-11). I chose to
   **restrict VT-14 to e = 0**; K(e) was not derived. Exact parts and segment 0 were still checked
   for e > 0. The observed trajectory differences after m were printed but not judged (vitest
   output).
2. **VT-15 non-tangential burns** (normal, radial, combined): the §7 VT-15 formula covers only
   tangential burns at an apsis, and there is no tolerance for the plane-rotation angle. Observed,
   not asserted: |δa⁺|/a⁺ ≤ 4.0e-16, |δe⁺| ≤ 2.1e-16, plane rotation (sin) ≤ 6.7e-17.
3. **VT-16 hyperbolic arc states**: the record gives a recipe (componentwise §6.1 sums on the arc),
   not evaluated formulas. Not evaluated in this task, so not compared. Warnings for hyperbolic
   cases were checked.
4. **VT-16 generalised P_E**: for elliptic sub-surface arcs this run uses the §6.3 formula at the
   post-maneuver (a, e), as the record's VT-05 post-maneuver rule allows. The "§6 generalised" form
   of §7 VT-16 does not say what replaces a in the 10κ_E·a term for hyperbolic arcs. The reviewer
   should settle this before any hyperbolic evaluation.
5. **VT-16 time margin**: the record sets the energy and radius case-selection margins (1e-6). For
   the time to the sphere, this task chose ≥ 5 % of the span. That is a case-selection choice, not
   a tolerance.
6. **Exactly-parabolic VT-16 case**: expected flagged (D2). This assumes the engine's rounding band
   for the energy is at least about 2u·(v²/2 + μ/r). The case passed.

## 6. Not run

- VT-17 (persistence does not exist), VT-19, VI-02, VI-03, VE, L3/Orekit: out of scope.
- VT-09 was tested as exact. Its premise is O-4: a sample depends only on the segment's initial
  state, start time, t_s and the constants. The `runSimulation` doc comment states this
  ("no chaining"), but O-4 is still formally open in the record. VT-14 segment-0 exactness rests on
  the same premise.
- VT-05 for post-maneuver segments of non-sub-surface cases; VT-06/07 on post-maneuver segments.
- CI: local only.

## 7. Findings and proposals (owner or reviewer)

- No conformance failure. No reference or dataset defect observed.
- P-1 (proposal, needs owner approval): derive K_r(e), K_v(e) (O-11) or accept VT-14 as e = 0 only
  for G1.
- P-2 (proposal): add VT-15 tolerances for non-tangential burns and the plane-rotation angle to the
  record (the error model needs a first-order direction term Δv·v·ε_W).
- P-3 (proposal): evaluate the VT-16 hyperbolic componentwise budget and state the 10κ_E·a
  substitution (§5 item 4).
- P-4: record O-4 as resolved by the runner's documented behaviour, or keep VT-09 conditional.
- The datasets and this report are "committed, not yet approved". This evidence counts toward G1
  only after they are approved unchanged.
