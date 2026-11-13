# Conformance Run 1 — engine against the L2 reference datasets

**Document ID:** ML-VER-004 · **Date:** 2026-11-13 · **Author:** Verification Engineer (ML-TASK-018, part A/B) · **Status:** In review (not approved)

First comparison of the engine (`packages/astrodynamics`) with the committed reference datasets
of ML-TASK-011 and first O-1 solver check. Workspace: `conformance/` (ADR-009). Result:
**every comparison run passed**; nothing failed, so no failure characterisation was needed. This
is evidence for the families and layers listed in §3 only; §6 lists what was not run.

## 1. What was run, and on what

| Item | Value |
|---|---|
| Engine under test | `packages/astrodynamics` at `origin/main` 10656fa (merge of PR #16, ML-TASK-015), public API only: `elementsToState`, `stateToElements`, `propagateKeplerUniversal` |
| References | `test-data/reference-cases/` vt-02, vt-03, vt-04, vt-05, vt-08 (55 files, version 1, `producedBy.codeRevision` 5e44e1ce2b8f, merged to `main` in PR #17 before this run); datasets are "committed, not yet approved" (l2-references-report.md) |
| O-1 evaluator | `o1Check` of `verification/src/hp/o1-check.ts` (320-bit BigFloat; substitution for `mpmath`, finding F-4 of the L2 report) |
| Tolerances | Exactly the values stored in each dataset (tolerances.md revision 3, approved 2026-11-13); O-1 threshold ε_t + δt_α formed by `o1Check` from the exact input. No tolerance was computed, changed or re-evaluated in this task |
| Thresholds | ε_e = ε_i = 1e-5 (tolerances.md §15), read from each dataset's `method.convention.thresholds` and passed explicitly to `stateToElements` |
| Runtime | Node.js v24.22.2, Windows 11, Vitest 5.0.5 |
| Commit order | Tests committed in 1b4f514 before the first engine run (§4.1 item 1 spirit; datasets were already on `main`) |
| Command | `pnpm test` (Vitest project `conformance`; also `npx vitest run --project conformance --reporter=verbose --silent=false` for the ratio summaries) |

Mapping of dataset inputs to the engine API (no ambiguity found):

- VT-02: `elementsToState(inputs.elements, inputs.constants.mu_m3ps2)`; field names and units
  identical (SI, rad).
- VT-03/VT-04: `stateToElements(inputs.state, μ, {circularEccentricity: ε_e,
  equatorialInclination_rad: ε_i})`, then `elementsToState(view, μ)` for the round trip.
  Classification: engine `convention` ∈ {NONE, CIRCULAR, EQUATORIAL, CIRCULAR_EQUATORIAL} mapped to
  the dataset's `circular`/`equatorial` booleans. The substitute-angle sense of the datasets
  (positive in the sense of motion; retrograde clockwise seen from +z) is the approved one (ADR-008
  addendum, PR #18) and is also what the engine's public documentation of `stateToElements` states.
- VT-05: `propagateKeplerUniversal(μ, r₀, v₀, t_s)` once per dataset time, Δt = t_s − 0, each
  sample independently from the initial state (the propagator's documented behaviour and the model
  of tolerances.md §6.1). The contract runner (ML-TASK-017) does not exist yet; sample times are the
  dataset's `outputs.t_s`.
- VT-08: the same call with Δt = `request.duration_s` (= fl(N·T), computed by the dataset).
- O-1: χ̂ = `diagnostics.universalAnomaly_sqrtm` of the same call.

## 2. Results per family

"Ratio" = observed error / stored tolerance (≤ 1 passes). Maxima over all comparisons of the
family; the case is where the maximum occurred.

| Family | Datasets / tests | Comparisons | Passed | Failed | Worst ratio (position) | Worst ratio (velocity) | Other quantities |
|---|---|---|---|---|---|---|---|
| VT-02 elements → state | 9 / 9 | 18 | 18 | 0 | 0.0044 (c8a) | 0.0041 (c8a) | — |
| VT-03 round trip | 9 / 9 | 18 | 18 | 0 | 0.0109 (c1) | 0.0091 (c1) | — |
| VT-03 element view vs L2c (VI-03(b) rows stored in the dataset) + classification | 9 / 9 | 36 rows + 9 classifications | all | 0 | — | — | e 0.0146 (c4), i 0.000, Ω 0.000, ω 0.0039 (c4), ν 0.0085 (c4); classification 9/9 exact |
| VT-04 classification, e, i | 10 / 10 | 10 classifications + 20 rows | all | 0 | — | — | classification 10/10 exact; e 0.0134 (d4), i 0.000 |
| VT-04 round trip (exact degenerate, kind a) | 5 / 5 | 10 | 10 | 0 | 0.0101 (d4) | 0.0082 (d4) | — |
| VT-04 round trip (near degenerate, kind b) | 4 / 4 | 8 | 8 | 0 | 0.811 (d6) | 0.595 (d6) | see note 1 |
| VT-04 round trip (regular, d10) | 1 / 1 | 2 | 2 | 0 | 0.0017 | 0.0014 | — |
| VT-05 sample 0 exact | 9 / 9 | 9 × 6 components | 9 | 0 | exact (`Object.is`) | exact | — |
| VT-05 vs L2a | 9 / 9 | 1440 samples × 2 | 2880 | 0 | 0.0096 (c8a, k = 153) | 0.0075 (c8a, k = 28) | — |
| VT-05 vs L2b | 9 / 9 | 1440 samples × 2 | 2880 | 0 | 0.0148 (c2, k = 136) | 0.0112 (c6, k = 130) | — |
| VT-08 closure N = 1 | 9 / 9 | 18 | 18 | 0 | 0.0056 (c8a) | 0.0042 (c8a) | — |
| VT-08 closure N = 10 | 9 / 9 | 18 | 18 | 0 | 0.0053 (c8a) | 0.0039 (c8a) | — |

Note 1. The VT-04(b) tolerance is the numerical budget plus the convention term of §7 VT-04(b)
(no margin on the convention term, an exact bound). Its size is set by the convention (relabelling
the angles of a state with small but non-zero e or i'), not by rounding, so a ratio near 1 is
expected there: d6 (near-circular, e below ε_e) used 0.81 of it, the maximum over the four near
cases d6–d9 (the recorder keeps the maximum only; per-case values of d7–d9 were not tabulated).

Ratios of 0.000 for i and Ω (VT-03, VT-04) mean the engine and L2c returned the same binary64
value.

## 3. O-1 solver residual check (tolerances.md §6.1, §12 O-1, evidence route (1))

Threshold: |t(χ̂) − Δt| ≤ ε_t(Δt) + δt_α(Δt), t(χ̂) in 320-bit arithmetic with α, σ₀, r₀ formed
in high precision from the exact binary64 inputs; κ = 4a/r₀ − 1 of the exact input.

Cases (fixed in the test file before the first run):

- (a) every sample k ≥ 1 of the nine VT-05 datasets: 1440 cases (Δt from 1/160 to ≈ 10 periods);
- (b) a deterministic grid within the O-1 range (e up to 0.95, |Δt| up to 100 periods, negative
  Δt): a ∈ {7.0e6, 2.6e7, 4.2e7} m × e ∈ {0, 0.01, 0.3, 0.6, 0.8, 0.95} × ν₀ ∈ {0.3, 3.0} rad ×
  Δt/T ∈ {±0.37, ±3.3, ±41.7, ±100}; i, Ω, ω fixed per e (i from 0.1 to 3.0 rad, i.e. prograde
  and retrograde); initial states from the L2c map, μ = 3.986004418e14 m³/s². 288 cases.

| Set | Cases | Passed | Failed | Worst residual / threshold | Where |
|---|---|---|---|---|---|
| VT-05 grid C1 | 160 | 160 | 0 | 0.093 | k = 94, t = 34216 s |
| C2 | 160 | 160 | 0 | 0.043 | |
| C3 | 160 | 160 | 0 | 0.044 | |
| C4 | 160 | 160 | 0 | 0.090 | k = 116 |
| C5 | 160 | 160 | 0 | 0.053 | k = 160 (≈ 10T) |
| C6 | 160 | 160 | 0 | 0.064 | |
| C7 | 160 | 160 | 0 | 0.059 | |
| C8 (a and b) | 320 | 320 | 0 | 0.079 | |
| Additional e = 0 | 48 | 48 | 0 | 0.063 | |
| e = 0.01 | 48 | 48 | 0 | 0.074 | |
| e = 0.3 | 48 | 48 | 0 | 0.065 | |
| e = 0.6 | 48 | 48 | 0 | 0.052 | |
| e = 0.8 | 48 | 48 | 0 | 0.068 | |
| e = 0.95 | 48 | 48 | 0 | **0.094** | a = 7.0e6, ν₀ = 0.3, Δt = +100T |
| **All** | **1728** | **1728** | **0** | **0.094** | |

No pattern of growth with e, |Δt| or sign of Δt is visible at this resolution: the maxima lie
between 0.04 and 0.10 in every set.

## 4. Harness sensitivity (sanity check of the test code, not committed)

To confirm that the comparisons can fail, a temporary test (deleted, not committed) perturbed
inputs on VT-05 c1 at k = 160 (≈ 10T) and on VT-02 c4 and recomputed the ratio against the stored
tolerance:

| Perturbation | Ratio |
|---|---|
| μ × (1 + 1e-13) in the engine call (VT-05 vs L2a, position) | 3.38 (fails) |
| μ × (1 + 1e-12) | 33.8 (fails) |
| Δt + 1e-8 s (VT-05 vs L2a, position) | 2.90 (fails) |
| Ω + 1e-12 rad (VT-02 position) | 14.2 (fails) |
| χ̂ × (1 + 1e-15) (O-1) | 0.31 (passes) |
| χ̂ × (1 + 1e-14) (O-1) | 2.32 (fails) |

So the suite detects a μ error of 1e-13 relative and a 10 ns timing error at ten periods, and the
O-1 check resolves χ̂ to about 1e-14 relative. These numbers describe the harness only.

## 5. Evidence layers actually behind each family in this run

| Family | Layers run here | Missing |
|---|---|---|
| VT-02 | L2c (algorithmic independence partial: O-7) | L3 (Orekit, ML-TASK-012; textbook §9.4) |
| VT-03 | L1 (round trip to the exact input); L2c for the element rows | — for the round trip; L3 for element values |
| VT-04 | L1 (round trip); L2c (classification, e, i) | Substitute angles ϖ, λ, u: no approved tolerance (L2 report F-3) |
| VT-05 | L2a, L2b | L3 (Orekit) |
| VT-08 | L1 | — |
| O-1 | High-precision evaluator in `verification/` (own BigFloat, not `mpmath`, L2 report F-4) | Independent confirmation of the evaluator by a second tool |

## 6. Not run, and why

- **VT-01** (vector/matrix identities and the exact special inputs of §1): no dataset; the
  identities are not part of this part's scope. To be written in the next part of ML-TASK-018.
- **VT-06, VT-07** (energy and angular-momentum invariants), **VT-09** (sampling independence):
  L1 invariant tests on engine samples; no dataset needed, but not written in this part. VT-09's
  exactness depends on O-4; the propagator's documentation states each Δt is computed
  independently, which still needs the test.
- **VT-10** (determinism), **VI-01** (result structure), first-sample exactness of the
  `SimulationResult`: need the runner (ML-TASK-017), which does not exist. Sample 0 was checked at
  the propagator level only.
- **Maneuvers (VT-11 … VT-16)**: no engine maneuver code and no datasets (VT-12, VT-15, VT-16 not
  built; VT-14 for e > 0 blocked by O-11).
- **VT-17, VT-18**: serialisation and validation, outside the engine functions run here.
- **VT-19** (constants against the primary source): open; the primary source was not reached
  (L2 report §6). Every dataset passes μ explicitly, so this run does not depend on the engine's
  constants.
- **State accuracy for negative Δt and for hyperbolic arcs**: not in any dataset; negative Δt is
  covered by the O-1 residual check only.
- **Retrograde flag** of the VT-04 datasets: the engine reports no such flag; not compared (i is).
- **CI**: the suite ran locally; wiring into CI and the G1 report are later parts of ML-TASK-018.

## 7. Findings

No conformance failure. No dataset or reference defect observed. Items for the reviewer:

1. ADR-007 (write permissions) and coding standards §6 (boundary table) do not list
   `conformance/` yet; ADR-009 records the decision. Outside this task's paths.
2. The datasets and the L2 report are still "in review"; this run's evidence counts toward G1
   only once they are approved, unchanged.
3. The ADR-008 addendum (PR #18) fixing the retrograde-equatorial sense was not on `main` at the
   engine revision used; the datasets and the engine's public documentation agree with it.
