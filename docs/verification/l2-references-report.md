# L2 Independent References and Reference Datasets — Report

**Document ID:** ML-VER-003 · **Date:** 2026-11-13 · **Author:** Verification Engineer (ML-TASK-011) · **Status:** In review (not approved)

Builds verification layer L2 of the [verification plan](m1-verification-plan.md) §2 and the
reference datasets of §6, with tolerances from the approved [tolerance record](tolerances.md)
(revision 3, approved 2026-11-13). No engine result is used or exists in this task.

## 1. Independence statement

- Read: AGENTS.md, coding standards, the verification plan, tolerances.md (in full), ADR-003,
  ADR-004, ADR-008, contracts-v1.md revision 3 (§2–§5, §7, §13), proposed-architecture.md §3,
  `packages/contracts` (public API and fixtures), `test-data/reference-cases/README.md`, task
  template.
- Not read: `packages/astrodynamics` (including `constants.ts`, `vector3.ts` and their tests), the
  branches `feat/ml-task-014-elements` and `feat/ml-task-015-propagator`, the discussions of
  PR #11, #15, #16. The engine was not run. `verification/` imports only `@mission-lab/contracts`
  (lint-enforced) and Node built-ins in test files.
- Algorithms differ from the engine's ADR-005 universal-variable method: L2a uses classical
  elements and Kepler's equation in eccentric anomaly, L2b numerical integration, L2c an explicit
  rotation-matrix product and an in-plane polar element extraction (not the e-vector/acos form).

## 2. What was built

All code under `verification/src/`; tests are `*.test.ts` next to it.

| Module | Content |
|---|---|
| `hp/bigfloat.ts` | Arbitrary-precision binary floating point on BigInt (default 320 bits): + − × ÷ √ with correct rounding at working precision, exact binary64 conversion both ways, sin, cos, atan, atan2, acos, exp, sinh, cosh. π from Machin's formula, no constants from memory. Self-tests in `bigfloat.test.ts`. |
| `ref/vec.ts` | Minimal vector/matrix helpers (own code). |
| `ref/elements.ts` | **L2c** element ↔ state, degenerate-element view (ADR-008). |
| `ref/kepler.ts` | **L2a** classical-element propagation with a bracketed Newton Kepler solver. |
| `ref/rk.ts` | **L2b** fixed-step RK4 with compensated summation and step halving. |
| `hp/hp-kepler.ts` | The L2a algorithm and the element→state map in 200-bit arithmetic, used to measure the binary64 references' own rounding errors. |
| `hp/o1-check.ts` | **O-1 evaluator**: universal-variable time equation in 320-bit arithmetic, residual and threshold ε_t + δt_α. |
| `tol/tolerances.ts` | Transcription of the approved formulas; checked against every number printed in tolerances.md (`tolerances.test.ts`). |
| `datasets/cases.ts`, `plan.ts`, `build.ts` | Grid element values, sampling/RK plan, dataset builder. |
| `datasets/datasets.test.ts` | Dataset checks; generation mode (`ML_WRITE_DATASETS=1`). |
| `hp/a3-math-accuracy.test.ts` | A2/A3 measurement. |

## 3. References, algorithms and error bounds

### 3.1 L2c — element ↔ state

- Element → state: regular map, no special cases (contracts-v1.md §3): p = a(1 − e²),
  r = p/(1 + e cos ν), perifocal r, v, rotated by Q = Rz(Ω)·Rx(i)·Rz(ω) formed as products of
  the three active elementary matrices.
- State → elements: h = r × v; i = atan2(√(h_x² + h_y²), h_z); Ω = atan2(h_x, −h_y); argument of
  latitude u = atan2(r·m̂, r·n̂) in the plane axes n̂ = ẑ × h/|ẑ × h|, m̂ = ĥ × n̂;
  e cos ν = h²/(μr) − 1, e sin ν = h(r·v)/(μr) (from r = p/(1 + e cos ν), p = h²/μ,
  ṙ = (μ/h) e sin ν); ω = u − ν; a = 1/(2/r − v²/μ). atan2 only (O-2).
- Error bound: the record's VT-02 budget η_r(e)u·r_a, η_v(e)u·v_p (§7 VT-02 states L2c has the
  engine's budget). **Measured** against the same map evaluated in 200-bit arithmetic with
  closed-form perifocal vectors (a different evaluation path): ≤ 4.4 × 10⁻⁹ m and
  2.2 × 10⁻¹² m/s on the grid, i.e. ≤ 0.03 of the bound (per-dataset values in VT-02 files).
- Self-validation (`ref/elements.test.ts`): orthonormality of Q; special configurations; energy
  and angular-momentum direction of 1000 random states; state → elements → state within the
  VT-03 tolerance on the grid and 2000 random orbits (e ≤ 0.9); element recovery within the
  VI-03 rows plus the state budget; VT-04 classification and round trip.

### 3.2 L2a — classical elements + Kepler (not universal variables)

Algorithm in `ref/kepler.ts` and in every VT-05 dataset (`method.l2a`). Stopping criterion of
the Kepler solve: Newton correction |ΔE| ≤ 4u·max(1, |M|), or f(E) = 0, or no binary64 point left
strictly inside the bracket [M − e, M + e] (shrunk with the sign of f; a step leaving it is
replaced by bisection); at most 100 iterations; the iterate with the smallest computed |f| is
returned. Error bound: P_A(Δt), V_A(Δt), δt_A(Δt) of tolerances.md §6.4.

**L2a bound confirmed (§6.4 "ML-TASK-011 confirms the L2a bound").** Evidence:

| Check | Bound | Result |
|---|---|---|
| L2a state vs the L2a algorithm in 200-bit arithmetic, every sample of the 9 VT-05 datasets (≈10 periods) | P_A, V_A (unmargined) | max ratio 0.130 (position), 0.135 (velocity), C4 |
| Same, 150 random orbits, e ≤ 0.95, Δt uniform in ±100 periods | P_A, V_A | all within (test) |
| Kepler residual of the returned E evaluated exactly (200-bit), ÷ n | δt_A (unmargined) | all within on the grid (test) and random cases; on every 8th grid sample the max ratio was 0.22 (survey before the datasets) |
| Solver alone, 3000 cases M ∈ [−700, 700], e ≤ 0.99 | 2u(4\|M\| + 6π + 4e) + u(1 + e)\|E\| | all within |
| L2a vs L2b on every grid sample | M·P_A + 2E_RK | all within |

No correction of the bound is needed. Limits: the 200-bit comparison measures rounding error
only (same algorithm); algorithmic correctness rests on the agreement with L2b (different
algorithm), which resolves to E_RK (≈ 5 × 10⁻¹³ r_a, §3.3), not to P_A at small Δt.

### 3.3 L2b — fixed-step RK4 with step halving

Classical RK4 (p = 4), fixed step, Kahan-compensated state update, output at exact multiples of
the step. Runs with h, h/2, h/4; E_RK per §9.2 (E_RK = d₂ when 8 ≤ d₁/d₂ ≤ 32). The step was
chosen per case by a survey before the datasets were written (the coarsest RK step for which
every output time is in the asymptotic regime with E_RK far below the target); the survey
compared only reference with reference.

| Case | Reference step h/4 (s) | max E_RK,r (m) | max E_RK,r / r_a | max E_RK,v (m/s) | all samples asymptotic | max actual error / E_RK (vs 200-bit L2a) |
|---|---|---|---|---|---|---|
| C1 c1-circular-inclined | 0.3555 | 3.40e-6 | 4.86e-13 | 3.66e-9 | yes | 0.11 |
| C2 c2-circular-equatorial | 0.3555 | 3.41e-6 | 4.88e-13 | 3.67e-9 | yes | 0.08 |
| C3 c3-elliptical-equatorial | 0.3037 | 1.76e-6 | 1.36e-13 | 7.56e-10 | yes | **1.15** (see F-6) |
| C4 c4-moderate-inclined | 0.3994 | 7.45e-6 | 4.43e-13 | 4.50e-9 | yes | 0.10 |
| C5 c5-molniya | 0.3184 | 7.36e-5 | 1.63e-12 | 6.26e-8 | yes | 0.07 |
| C6 c6-geo-radius | 5.2285 | 2.06e-5 | 4.92e-13 | 1.51e-9 | yes | 0.09 |
| C7 c7-near-polar-retrograde | 0.3555 | 3.51e-6 | 4.97e-13 | 3.74e-9 | yes | 0.08 |
| C8 c8-angle-boundaries-a | 0.3555 | 3.42e-6 | 4.86e-13 | 3.69e-9 | yes | 0.09 |
| C8 c8-angle-boundaries-b | 0.3555 | 3.49e-6 | 4.93e-13 | 3.62e-9 | yes | 0.09 |

All E_RK are below the §9.2 target 10⁻¹⁰ r_max by more than a factor 60: **no loosening** under
§4.1 item 3. Per-sample E_RK, d₁, d₂ and the asymptotic flag are in each VT-05 dataset.

### 3.4 O-1 evaluator

`hp/o1-check.ts`: `o1Check({mu, position, velocity}, Δt, χ̂)` returns |t(χ̂) − Δt| with α, σ₀, r₀
formed in 320-bit arithmetic from the exact binary64 inputs, Stumpff functions by series for
|ψ| ≤ 1 and closed forms otherwise (hyperbolic branch included), and the threshold
ε_t(Δt) + δt_α(Δt) with a, e and κ = 4a/r₀ − 1 of the exact input (§6.1 permits κ in place of
κ_E). Tested (`o1-check.test.ts`) where χ is known by construction: unit circular orbit
(t(χ) = χ exactly, residual of a χ̂ off by k ulps equals k ulps exactly), an exact elliptic
periapsis state against the Kepler time of flight (agreement to 2⁻³⁰⁰ relative), the nine grid
states against the 300-bit Kepler time of flight for ΔE up to 62.9 rad (2⁻¹⁵⁰), Δt built from a
chosen χ̂ (residual ≤ ½ ulp(Δt), passes), and a χ̂ perturbed by 10⁻⁹ relative (rejected). It was
**not** run against the engine.

## 4. Convention choices

1. **Retrograde equatorial substitute angles (OPEN, for the Coordinator).** No approved document
   fixes how ϖ and λ are measured when i ≈ π. This reference measures every substitute angle from
   +x **positively in the sense of motion (right-handed about ĥ)**: prograde ϖ = Ω + ω, λ = Ω + u
   (counter-clockwise seen from +z); retrograde ϖ = ω − Ω, λ = u − Ω (clockwise seen from +z).
   Reason: with this choice the regular element→state map with Ω := 0 (and ω := 0) reproduces the
   state of an exactly equatorial orbit including i = π (R₃(Ω)R₁(π)R₃(ω) = R₁(π)R₃(ω − Ω)), and it
   is the ϖ = ω − Ω assumption of tolerances.md §7 VT-04. The alternative (counter-clockwise from
   +x regardless of direction) would give ϖ' = 2π − ϖ for retrograde orbits; with it the element
   view would not round-trip through the regular map. Recorded in every VT-03/VT-04 dataset
   (`method.convention.substituteAngles`). ML-TASK-014 must use the same choice or the VT-04
   element-view comparison is not like-for-like.
2. When h_x = h_y = 0 exactly, the node axis is +x (Ω = 0); when the computed e = 0 exactly, ν = 0.
3. Equatorial means min(i, π − i) < ε_i; circular means e < ε_e; ε_e = ε_i = 10⁻⁵ (§15). Strict
   inequality. e and i are never changed.
4. Near-equatorial with i' > 0: ϖ and λ are formed from the regular Ω, ω, u (ϖ = ω ± Ω), not by
   projecting x̂ into the plane; the two differ at second order in i'.
5. JSON cannot carry −0: inputs were normalised to +0 before any reference was computed from
   them; outputs are written with −0 as 0 (comparisons are by norms).
6. VT-05 sample 0 is the initial state itself and its tolerance is 0 (exact), because
   contracts-v1.md §5.2 revision 3 makes the first sample bit-identical to `initialState`
   (tolerances.md §1, O-10 adopted).

## 5. Dataset inventory (55 files, `test-data/reference-cases/`)

Format of plan §6 (`id`, `description`, `inputs`, `model`, `producedBy`, `method`, `outputs`,
`tolerance`) plus `version`, `status`, `referenceAccuracy`. Inputs are contract-shaped
(`KeplerianElements`, `PhysicalConstants`, `CartesianState`, full `SimulationRequest` with
`requestId` per §7.1) and validated with the contracts validators in `datasets.test.ts`.
`producedBy.codeRevision` = `5e44e1ce2b8f` (the commit of the builder and references);
`datasets.test.ts` rebuilds every dataset and requires bit-identical content.
Constants: μ = 3.986004418 × 10¹⁴ m³/s² and R_ref = 6 378 137 m exactly as written in
proposed-architecture.md §3. Each tolerance shows its formula and the inputs it was evaluated at
(`tolerance.evaluatedAt`).

Grid (`datasets/cases.ts`; a, e of C1–C6 are the §4 evaluation scales): C1 a 7.0e6, e 0, i 0.9;
C2 7.0e6, 0, i 0; C3 1.0e7, 0.3, i 0; C4 1.2e7, 0.4, i 0.5; C5 2.6e7, 0.74, i 1.1; C6 4.2e7, 0,
i 0.001; C7 7.0e6, 0.01, i 1.7 (retrograde, near-polar); C8a 7.0e6, 0.005, i π/2, Ω 0, ω π,
ν = 2π − 2⁻⁵⁰; C8b 7.0e6, 0.01, i 2.5, Ω = 2π − 2⁻⁵⁰, ω 0, ν π.

| Family | Files | Reference | Evaluated tolerance (position / velocity) |
|---|---|---|---|
| VT-02 | 9 (`vt-02/<case>`) | L2c | C1 2.11e-7 m / 2.21e-10 m/s · C3 4.15e-7 / 2.41e-10 · C4 5.53e-7 / 2.44e-10 · C5 1.92e-6 / 2.81e-10 · C6 1.27e-6 / 9.03e-11 · C7 2.14e-7 / 2.23e-10 · C8 2.13–2.14e-7 / 2.22–2.23e-10 |
| VT-03 | 9 (`vt-03/<case>`) | L1 (input state) + L2c elements | C1/C2 6.22e-7 / 6.42e-10 · C3 1.44e-6 / 8.91e-10 · C4 2.07e-6 / 1.00e-9 · C5 1.06e-5 / 2.15e-9 · C6 3.73e-6 / 2.62e-10 · C7, C8 6.27–6.32e-7 / 6.47–6.51e-10; VI-03 element rows included |
| VT-04 | 10 (`vt-04/d1…d10`) | L1 + L2c view | exact degenerate (a): 6.68e-7–1.46e-6 m; near-degenerate (b): d6 14.0 m / 2.13e-2 m/s, d7, d8 26.0 m / 1.72e-2 m/s, d9 42.0 m / 5.15e-2 m/s; d10 (regular) 6.22e-7 m. Classification exact |
| VT-05 | 9 (`vt-05/<case>`), 161 samples each, ≈10 periods | L2a and L2b (+ E_RK) | per sample; at the last sample vs L2a: C1 2.60e-5 m / 3.71e-8 m/s, C3 7.65e-5 / 1.08e-7, C4 1.18e-4 / 1.58e-7, C5 7.75e-4 / 1.03e-6, C6 1.56e-4 / 1.52e-8; vs L2b: C1 2.57e-5 / 3.68e-8, C3 6.00e-5 / 9.20e-8, C4 9.70e-5 / 1.42e-7, C5 6.85e-4 / 9.61e-7, C6 1.55e-4 / 1.51e-8 |
| VT-08 | 18 (`vt-08/<case>-n1`, `-n10`) | L1 (initial state), L2a informative | N = 10: C1 2.45e-5 / 3.56e-8, C3 7.31e-5 / 1.05e-7, C4 1.13e-4 / 1.55e-7, C5 7.51e-4 / 1.02e-6, C6 1.47e-4 / 1.45e-8; N = 1: C1 2.96e-6 / 4.28e-9 … C5 9.34e-5 / 1.26e-7 |

The values at the §4 scales coincide with the printed values of tolerances.md, as they must.

## 6. VT-19 (constants against the primary source) — partly done, **not confirmed**

- Attempted to open the primary source NGA.STND.0036_1.0.0_WGS84 (2014-07-08) at
  `earth-info.nga.mil` (the standard's PDF and the NGA WGS 84 page): both fetches failed from this
  environment. NIMA TR8350.2 was not reached either.
- A web search result (secondary, an automated summary of search hits) states that the NGA WGS 84
  page lists GM = 3.986004418 × 10¹⁴ m³/s² (with atmosphere) and a separate GPS value
  3.9860050 × 10¹⁴ m³/s². This is **not** treated as confirmation: the page itself was not read.
- Nothing was confirmed for the reference radius (6 378 137 m) or the ERA coefficients.
- Status: VT-19 remains open; it needs someone with access to the PDF to transcribe Table 3.1
  (defining parameters) and the GM entry with page numbers. The datasets carry the constants as
  explicit inputs, so a corrected value means new dataset versions, not hidden changes.
- The implementer's secondary NGA document was not looked at.

## 7. A2/A3 (Math accuracy on Node v24.22.2) — measured on a sample

`hp/a3-math-accuracy.test.ts`, each binary64 result vs the 320-bit value at the same argument:

| Function | Arguments | Max relative error | Max ulp error |
|---|---|---|---|
| sin, cos | near 0, [−10, 10], near kπ/2 (incl. Math.PI, 2π), \|x\| ≤ 1000, \|x\| ≤ 10⁶ (400 each) | 1.001u | 0.720 |
| atan2 | 1000, all quadrants, magnitudes 10⁻⁶…10⁶ | 1.709u | 0.956 |
| acos | 700, incl. ±(1 − k·2⁻⁵³) | 1.181u | 0.691 |
| sinh | 500, \|x\| ≤ 50 and tiny | **1.818u** | **1.328** |
| cosh | 500 | 1.363u | 1.011 |
| sqrt | 1000, 10⁻²⁰…10²⁰ | correctly rounded in every case (A2 on the sample) | ≤ 0.5 |

An earlier, larger survey (1500–3000 arguments per class, same code) gave max 1.86u (atan2),
1.68u (sinh). Result: **c_f = 2 holds on every sample** (relative error ≤ 2u), so no tolerance is
re-evaluated. But "≤ 1 ulp" (A3 wording) is not the same statement: atan2, sinh and cosh exceeded
1 ulp of the result while staying within 2u relative. sinh has the least margin (1.82u). This is
a sample, not a proof; ECMA-262 gives no accuracy bound. A2 is supported empirically, not by the
specification text, which was not consulted here.

## 8. Findings and conflicts (reported, not resolved)

| # | Finding | Where | Proposed action |
|---|---|---|---|
| F-1 | tolerances.md §6.1 prints the C5 O-1 threshold at 10T as 1.21e-8 s; its own coefficient 256.0u gives 256.0·u·L = 1.20e-8 s. The other printed rows reproduce. | tolerances.md §6.1 table | Correct the printed value (no formula change). Tests check the coefficient and formula value. |
| F-2 | Substitute angles for retrograde equatorial orbits are not fixed by any approved document (§4 item 1). | ADR-008, contracts §3, architecture §3 | Coordinator / Systems Architect to fix the convention (recommend the one used here) in ADR-008 or the ML-TASK-014 contract. |
| F-3 | No approved tolerance for the substitute angles (ϖ, λ, u) of the element view, nor for VT-04 element angles. The datasets give the values and mark the tolerance as missing. | tolerances.md §7 VT-04, §8 | Add rows to the record (owner approval). |
| F-4 | §6.4/§9.1 and A3 name Python `mpmath` for the high-precision checks; this task used an in-repo 320-bit BigFloat (no new dependency, as instructed). | tolerances.md §9.1, A3 | Record the substitution in the record. |
| F-5 | A3 says "≤ 1 ulp (c_f = 2)"; these differ (1 ulp of the result can be < 2u relative). Measured: atan2 1.06 ulp (survey), sinh 1.33 ulp, all ≤ 2u. | tolerances.md §2 A3 | Reword A3 as "relative error ≤ 2u". |
| F-6 | The §9.2 rule E_RK = d₂ under-estimated the actual RK error at two early C3 samples (actual 1.15·E_RK, ≈ 1 × 10⁻⁹ m ≈ 0.8u·r_a): at those times truncation is below round-off, which d₂ does not see, although the ratio test passed. The factor 2 on E_RK in the VT-05 formula covers it (measured ≤ 2E_RK everywhere, tested). | tolerances.md §9.2 | Note in §9.2 that the factor 2 is needed for this; no value change. |
| F-7 | Plan §2 says "high-order" Runge–Kutta; RK4 (order 4) was used. It meets the §9.2 target by > 60×. | plan §2 | Accept RK4 or state the required order. |
| F-8 | tolerances.md §1 lists "first sample = initialState" as exact "only if adopted"; contracts-v1.md revision 3 adopted it, so VT-05 sample 0 is exact. | tolerances.md §1, §12 O-10 | Update the record's O-10 status. |
| F-9 | `verification/tsconfig.json` now includes Node types (needed for `console`, `fs` in tests). The reference modules use no Node API, but the compiler no longer prevents it. | verification workspace | Reviewer to accept, or add a lint rule. |

No conflict was found between the plan, the record and the contract on the families delivered,
apart from F-1, F-2 and F-8.

## 9. What remains

- **For ML-TASK-012 (Orekit, L3):** an independent element→state check of the VT-02 grid (O-7: L2c
  and the engine may share the textbook map) and propagation at the VT-05 sample times, with μ
  passed explicitly (§9.3). The VT-05 requests can be reused as inputs.
- **For ML-TASK-018 (engine runs):** compare the engine with these datasets using the stored
  per-sample tolerances (`tolerance.vsL2a`, `tolerance.vsL2b`, VT-02/03/04/08 values); sample 0
  exact; VT-04 classification exact; run `o1Check` on the engine's χ̂ over the grid plus random
  cases (O-1 evidence (1)); never re-evaluate a tolerance after a run (§4.1).
- **Not built here:** datasets for VT-12 (RSW, L2c), VT-15 (post-maneuver), VT-16 (escape and
  surface, L2b; needs §6.1 componentwise budgets on the arc and O-5), VT-14 for e > 0 (O-11:
  K_r(e), K_v(e) not derived), VI-03 per-sample values, negative-Δt datasets (L2a supports them
  and is tested with them, but no dataset uses them; the contract has no negative times).
- VT-19 primary-source confirmation (§6). A3 beyond the sample (§7).
