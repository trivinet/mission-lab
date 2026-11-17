# Conformance Run 5 — VI-03 (b) and ML-FR-010 AC3: analysis module vs independent references

**Document ID:** ML-VER-010 · **Date:** 2026-11-17 · **Author:** Verification Engineer (ML-TASK-036, phase 2) · **Status:** In review (not approved)

First run of the analysis module (ML-TASK-031: `computeHistories`, `compareCoastAndManeuver`)
against independent references, as gate G3 evidence for VI-03 (b) (ML-FR-009 histories) and
ML-FR-010 AC3 (comparison table). Tolerances: [tolerance record revision 5](tolerances.md)
(approved by the owner on 2026-11-16) §8 VI-03 (b), §7 VT-15 "FR-010 AC3 comparison table",
§7 VT-12, §7 VT-13, §10 thresholds. Result: **every asserted comparison passed; worst ratio
0.0897 (Ω history). No defect of the analysis module and no reference defect was found.** Several
quantities are not covered by an approved row and stayed informative (§4).

## 1. Order of work (evidence for tolerances.md §4.1 and ADR-003)

Branch `test/ml-task-036-vi03-references`, cut from `origin/docs/ml-task-032-036-contracts`
(5a526f6).

| Commit | Content | Analysis module read or run? |
|---|---|---|
| d7be9dd | Reference `verification/src/ref/analysis.ts` (method H, 200-bit; method B, binary64) with self-tests; transcription `verification/src/tol/tolerances-vi03.ts` checked against every value the record prints for these rows | No |
| 0122162 | Dataset builder `verification/src/datasets/build-vi03.ts` and reference-side checks `datasets-vi03.test.ts` | No |
| 39d3152 | Datasets `test-data/reference-cases/vi-03-b/` (6 files, codeRevision 012216262e97) with per-sample tolerances | No |
| **894ad6b** | **Phase-1 boundary.** Conformance test `conformance/src/vi03-analysis.test.ts`; comparison logic `conformance/src/support/vi03.ts`, self-tested on synthetic inputs only (`support/vi03.test.ts`: the reference stands in for the module; perturbations beyond tolerance, nulls, wrong convention, non-copied `t_s`, a defined apoapsis on an open orbit and a wrong Δv are all caught; a 2π shift passes) | No (public API only: `analysis/index.ts`, the exported type declarations and the ML-TASK-031 report) |
| — | Phase 2: `pnpm exec vitest run --project conformance src/vi03-analysis.test.ts --reporter=verbose --silent=false` (§3), then the full `pnpm test` | Run |

Between 894ad6b and the run no reference, dataset, tolerance or test was changed. Neither the
engine (`runSimulation`) nor the analysis module was run on these cases before 894ad6b.

Independence: the reference does not import `packages/simulation` or `packages/astrodynamics`
(only the conformance test does). In phase 1 only the analysis module's public surface was read:
`packages/simulation/src/analysis/index.ts` and the `export` declarations (types, constants,
function signatures with their doc comments) of `state-quantities.ts`, `histories.ts`,
`comparison.ts` and `coast-request.ts`, extracted with a filter. That filter also printed two
small private helpers (`valueOf` in `histories.ts`, a switch from quantity id to field;
`firstSample` in `comparison.ts`, reading the first sample of segment 0). Neither contains
physics or numerics, and neither influenced a reference or a tolerance. The default-scenario
values come from `apps/web/src/state/default-scenario.ts` (a documented product default, read
only, not changed).

## 2. What was compared, and how

Six cases (`vi-03-b`), each a `Scenario` built into a request with `buildSimulationRequest`; for
maneuver cases the coast twin is built with `buildCoastRequest` (the UI path). Both results go
through `computeHistories`, and the pair through `compareCoastAndManeuver`.

| Case | Orbit | Maneuver (RSW, m/s) at t | Samples (segments; coast) | Post-maneuver |
|---|---|---|---|---|
| `default` | ML-FR-001 AC1 default: a = 7e6 m, e = 0.01, i = π/4 | none | 101 | — |
| `default-tangential` | default | (0, 100, 0) at 3000 s | 51 + 51; 101 | elliptic |
| `default-combined` | default | (30, −60, 45) at 1500 s | 26 + 76; 101 | elliptic |
| `c4-normal` | grid C4: a = 1.2e7 m, e = 0.4, i = 0.5 | (0, 0, −150) at 6000 s | 51 + 61; 111 | elliptic |
| `c5-prograde` | grid C5 (Molniya-like): a = 2.6e7 m, e = 0.74, i = 1.1 | (0, 50, 0) at 20000 s | 68 + 75; 141 | elliptic |
| `default-escape` | default | (0, 3500, 0) at 600 s | 11 + 91; 101 | **hyperbolic** |

- **Reference value:** `analysisReferenceHp` (200-bit, in-plane polar formulation, ADR-008
  convention, rounded once), evaluated by the test **on the engine's own state** of each sample
  and on the engine's R8 event states (§8 VI-03 (b): "independent recomputation by the test from
  the same state"; no propagation error enters). It was validated before the run against a
  second, independent method (binary64 e-vector form, the record's canonical formulation) within
  M × the per-side budget on 320 grid states (five general grid cases × 64 anomalies), 10
  hyperbolic states and every one of the 1 217 stored reference samples; against known input
  elements on 40 states (to 1e-12); and against the earlier L2c convention view on all nine grid
  cases.
- **Tolerances:** evaluated per sample from the **reference trajectory** (200-bit Kepler
  propagation of the scenario elements; exact burn on the reference pre-maneuver state), committed
  in the dataset (§4.1 items 1, 2). Comparison-table rows use the VI-03 (b) a, e, i, Ω, ω, ξ rows
  for before/after, the FR-010 AC3 formulas for r_p, r_a, T, and "sum of both operands'
  tolerances" for differences; applied Δv uses VT-12 (inertial, vs `rswToInertialHp` of the event
  pre-state) and VT-13 (magnitude). Angles are compared modulo 2π (difference reduced to (−π, π]).
- **Exact checks (asserted):** engine `t_s` = dataset grid per segment; every series `t_s` a
  bit-identical copy; per-sample convention = reference (`NONE` everywhere); r_p, r_a, T present
  on closed samples; r_a and T null with `NOT_CLOSED_ORBIT` on open samples (history and table);
  `deltaV.inertial_mps` and `magnitude_mps` = the event's values, `rsw_mps` = the request's
  (`Object.is`); `maneuverId` and `t_s` of the comparison = the event's.
- **Exclusions:** no sample lies within a factor 2 of a §10 threshold (checked in
  `datasets-vi03.test.ts`), so none was excluded.

## 3. Results

Command: `pnpm exec vitest run --project conformance src/vi03-analysis.test.ts --reporter=verbose
--silent=false` — 7 tests passed (2.95 s). Full `pnpm test`: 98 files, 1 877 tests passed.

### 3.1 VI-03 (b) histories (asserted)

| Quantity | Comparisons | Worst observed / tolerance | Where | Result |
|---|---|---|---|---|
| radius ‖r‖ | 1 217 | 0.0833 | `c4-normal` seg 1, t = 7440 s | pass |
| altitude | 1 217 | 0.0574 | `default-tangential` seg 1, t = 5700 s | pass |
| speed ‖v‖ | 1 217 | 0.0827 | `default-escape` seg 1, t = 2100 s (hyperbolic) | pass |
| specific energy ξ | 1 217 | 0.0418 | `c5-prograde` seg 1, t = 21300 s | pass |
| a | 1 217 | 0.0435 | `c5-prograde` seg 0, t = 17100 s | pass |
| e | 1 126 | 0.0125 | `c5-prograde` seg 1, t = 36000 s | pass |
| i | 1 217 | 0.0185 | `c5-prograde` seg 1, t = 20700 s | pass |
| Ω | 1 217 | **0.0897** | `c5-prograde` coast, t = 21900 s | pass |
| ω | 1 126 | 0.0135 | `c5-prograde` coast, t = 21000 s | pass |
| ν | 1 126 | 0.0144 | `c5-prograde` coast, t = 37200 s | pass |

1 217 = all samples of the six scenario runs and five coast runs; 1 126 = the same without the 91
hyperbolic samples (e, ω, ν not asserted there, §4). Discrete checks (convention, definedness,
`t_s` copies): no failure.

### 3.2 ML-FR-010 AC3 comparison table (asserted)

Five maneuver cases; "after" and "difference" have 4 comparisons for r_p, r_a, T, e, ω (the
hyperbolic after-state is not asserted for them, §4) and 5 otherwise.

| Row | Before | After | Difference | Result |
|---|---|---|---|---|
| a | 0.0180 | 0.0305 | 0.0301 | pass |
| e | 0.0050 | 0.0033 | 0.0021 | pass |
| i | 0.0092 | 0.0093 | 0.0069 | pass |
| Ω | 0.0004 | 0.0004 | 0 (bit-identical) | pass |
| ω | 0.0012 | 0.0078 | 0.0039 | pass |
| r_p | 0.0064 | 0.0037 | 0.0016 | pass |
| r_a | 0.0096 | 0.0093 | 0.0047 | pass |
| T | 0.0205 | 0.0166 | 0.0084 | pass |
| ξ | 0.0210 | 0.0352 | 0.0123 | pass |
| Δv inertial (VT-12) | — | — | — | 0.0061, pass |
| \|Δv\| vs ‖Δv_I‖ (VT-13) | — | — | — | 0 (bit-identical), pass |
| \|Δv\| vs ‖Δv_RSW‖ (VT-13 cross-check) | — | — | — | 0.0074, pass |

(Worst observed / tolerance per cell over the cases.) Hyperbolic after-state (`default-escape`):
r_a and T after are null with `NOT_CLOSED_ORBIT` and their differences null, as asserted.

### 3.3 Informative (not asserted; no approved row)

| Quantity | Values | Max \|module − reference\| |
|---|---|---|
| e on hyperbolic samples / table after / difference | 91 / 1 / 1 | 4.4e-16 |
| ω on hyperbolic samples / table after / difference | 91 / 1 / 1 | 8.9e-16 / 1.1e-16 / 4.4e-15 rad |
| ν on hyperbolic samples | 91 | 8.9e-16 rad |
| r_p, r_a, T histories (closed samples), relative | 1 126 each | 1.5e-15, 1.3e-15, 1.9e-15 |
| r_p on the hyperbolic after-state | — | not provided by the module (null, documented ML-TASK-031 limitation) |

These are small, but they are measurements, not verified results: the record gives no tolerance
for them.

## 4. Where the record was silent or ambiguous

No tolerance was invented. Each item below is either an interpretation that the record's text
supports (stated so a reviewer can reject it) or a quantity left informative.

1. **|δa|, |δe| in the FR-010 AC3 rows (interpretation).** §7 VT-15 gives r_{p,a} and T in terms
   of |δa| and |δe| without saying which a and e tolerances they are. The table values are analysis
   outputs of result states (the R8 event states), so §8 VI-03 (b) applies to a and e and their
   VI-03 (b) values were used. Consistency check: on a bound state κ_E(r) = 4a/r − 1, so the
   VI-03 (b) a row M·11uκ_E equals the VT-15 term (iii) M·11u(4a⁺/r − 1), which is what VT-15 gives
   when the engine state is fixed (mode B: terms (i), (ii), (iv) zero).
2. **r_p, r_a formation rounding.** The FR-010 AC3 r_{p,a} formula has no term for forming
   a(1 ∓ e) (FR-002 AC4 counts 2u per side). Applied as written; the a and e terms are more than ten
   times larger than that rounding on every case.
3. **e, ω, ν on hyperbolic states: not asserted.** The VI-03 (b) e row (30u per side) and the ω, ν
   rows built on it come from the e-vector budget of §7 VT-03 ("terms of size ≤ 2, 1, 2"), which
   §7 VT-15 revision 4 states is "valid for bound post-maneuver orbits, v²r/μ < 2". On the
   hyperbolic segment that budget does not hold as derived. Radius, altitude, speed, ξ, a, i and Ω
   were asserted there (their rows do not depend on boundedness).
4. **r_p, r_a, T as histories: not asserted.** The module provides them, but the VI-03 (b) table
   has no row for them, and the FR-010 AC3 rows are written for the comparison table. ML-FR-009 AC1
   does not require them.
5. **r_p on a hyperbolic state.** The module returns null (ML-TASK-031 known limitation), and the
   record has no hyperbolic r_p row. r_a and T do not exist on an open orbit; their absence was
   asserted (discrete).
6. **κ_h in the VT-12 Δv row.** VT-12 writes κ_h without fixing it per state; κ_h⁻ = 1/√(1 − e⁻²)
   of the pre-maneuver orbit was used, as §7 VT-15 revision 4 defines it and as the VT-12
   evaluated values (e = 0: 1; C5: 1.487) imply.
7. **Exclusion rule.** "Samples with e or i′ within a factor 2 of a threshold are excluded" was
   read as the whole sample, bounds inclusive. It affected no sample.
8. **Scale of the relative rows** (‖r‖, ‖v‖, a): the reference-side value (§4.1 item 2).
9. **Convention-assigned angles** (ν = argument of latitude on circular samples, Ω := 0 on
   equatorial ones): the record has no row ("only if not circular / equatorial"). No case is
   near-circular or near-equatorial, so this was neither asserted nor exercised.

## 5. Evidence layers

| Family | L1 | L2 | L3 |
|---|---|---|---|
| VI-03 (b) histories | Recomputation from the same state (no propagation error) | L2c reference library (method H, 200-bit polar; method B, binary64 e-vector, used to validate H) | None |
| FR-010 AC3 table: a, e, i, Ω, ω, ξ, r_p, r_a, T, differences | Same, from the R8 event states | L2c as above | None |
| FR-010 AC3 applied Δv | VT-13 identities (norm) | L2c `rswToInertialHp` (VT-12) | None (VT-12 L3 exists from run 3, on other cases) |

No external tool or textbook value was used in this run.

## 6. Limits of the evidence

- The checks verify the module's arithmetic on the engine's states. They do not verify the
  engine's propagation (VT-05…VT-16 do that) or the plots (VI-03 (a), FR-009 AC2/AC3: ML-TASK-032).
- Near-circular, near-equatorial and retrograde-equatorial histories are not covered (§4 item 9);
  the convention itself is covered for `stateToElements` by VT-04 only.
- Five maneuver cases, one hyperbolic: no parabolic-limit, rectilinear or sub-surface case.
- Flight-path angle and mean anomaly (ML-SYS-001 §2.2) are not provided by the module and were not
  verified.
- The worst ratio is 0.09: the tolerances are worst-case bounds with margin M = 4 (§3); the
  results say the module is far inside them, not how tight the bounds are.

## 7. Findings

- **Defects:** none in the analysis module, none in the references.
- **Record gaps for the owner (no change made):** the items of §4 numbers 3, 4, 5 and 9 have no
  approved row. If they are wanted as G3 evidence, a record revision must add them (owner
  approval, §4.1 item 3) and new dataset versions must be committed before a run.
- **Interpretations to confirm:** §4 items 1, 6 and 7.
