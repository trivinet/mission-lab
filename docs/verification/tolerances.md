# M1 Tolerance Record

**Document ID:** ML-VER-002 · **Date:** 2026-11-12 (revision 4: 2026-11-15; revision 5: 2026-11-15) · **Author:** Verification Engineer (ML-TASK-010; revision 4: ML-TASK-018 part D1; revision 5: ML-TASK-018 part D3) · **Revision:** 5 · **Status:** Proposed, awaiting owner approval (revision 5; see §15). Revision 4 was approved by the owner on 2026-11-15, revision 3 on 2026-11-13; their approved content stays in force. Changes follow §4.1: any loosening needs owner sign-off before the engine is run against it

Implements the tolerance policy of the [verification plan](m1-verification-plan.md) §4 (method fixed
there) for the numerical families VT-01…VT-19 and the numeric parts of VI-01…VI-03. Nothing in this
document was approved until the owner signed §15 (2026-11-13). The revision-4 additions were
approved by the owner on 2026-11-15. **The revision-5 additions (§4.1 item 6, §6.8 "α data error
and extended O-1 check on hyperbolic arcs", §9.3.1 "A6′ hyperbolic criterion", §9.3.2 item 6) are
not approved until the owner signs the revision-5 rows of §15; until then the engine must not be run
against them.** The conformance tests that use them are gated (§4.1 item 6).

**Changes in revision 5** (ML-TASK-018 part D3 phase 1; owner decision of 2026-11-15 to close open
items O-12 and O-13 before the G1 report). (1) **O-12:** the α data error at fixed χ on a hyperbolic
arc, δt_α,hyp, is derived from the §6.1 expression of ∂F/∂α with cosh/sinh magnitudes (§6.8); the
closed form was checked against a high-precision finite difference. The O-1 black-box residual
check is extended to hyperbolic arcs with the threshold ε_t,gen + δt_α,hyp, the time equation
evaluated in high precision as in §6.1, on every sample with Δt > 0 of the six VT-16 hyperbolic arcs
and on a 144-case grid (§6.8). Its per-sample thresholds are a new dataset (`o1-hyp-r5`), committed
before any engine run on it. O-12 is closed for its definition; the evidence is the phase-2 run
(§12). (2) **O-13:** the A6′ criterion for Orekit's hyperbolic propagation is stated as pass/fail
bounds on the energy, angular-momentum and time-of-flight measurements of `selfcheck.py` — 2× the
§6.8 engine bounds mapped into each measured quantity, with M and the test's own evaluation error
(§9.3.1) — and implemented there. (3) **§4.1 item 6:** the rule by which the hyperbolic state rows
that conformance run 3 reported as informative become asserted; no new dataset version is needed for
them (their values were committed before run 3 and are not re-evaluated). (4) **§9.3.2 item 6:** the
L3 hyperbolic arc with the maneuver at m = 0 (`c1-escape-prograde`) is compared with an Orekit arc
restarted from the engine's event state, like the m > 0 arcs (revision 4 compared it with Orekit's
own segment 1, which starts from a different Δv_I; no transport bound exists for that difference).
(5) No approved value changed. **No loosening** (§15). No value of this revision was derived from,
or adjusted to, engine output or the measured values of conformance run 3 or of `selfcheck.py`
(§0).

**Changes in revision 4** (ML-TASK-018 part D1; owner directions of 2026-11-15 on proposals P-1…P-4
of [conformance run 2](conformance-run-2.md) §7, and the L3 Orekit datasets of ML-TASK-012 part B).
(1) **P-1:** VT-14 is accepted for G1 at e = 0 only; O-11 stays open and does not block G1 (§7
VT-14, §12, §15). Nothing is derived for e > 0. (2) **P-2:** VT-15 gets a general error model with a
first-order direction term from the computed RSW basis, tolerances for normal, radial and combined
burns, and two new rows for the orbit plane (plane-normal error and plane-rotation angle) (§7
VT-15). The same term, restricted to its magnitude part, is added to the tangential formula, and
term (i) is written as zero at m = 0; the approved values still bound the corrected formula, so
they stay in force for the run-2 datasets and **no approved value is loosened**. Revision-4 values
apply only to new dataset versions (§4.1 item 5). (3) **P-3:** the VT-16 componentwise budget is evaluated for hyperbolic arcs (§6.8), with
the 10κ_E·a term replaced by 10κ_E·r_max (justified in §6.8); O-5 is closed for its numeric part.
Only one hyperbolic case of the grid meets the approved validity condition \|E\| ≥ 0.1(v²/2 + μ/r);
lowering it to 0.05 is proposed for owner decision (§7 VT-16, §15). (4) **P-4:** O-4 is resolved
by ADR-005 (Decision) together with the approved ML-TASK-015 contract; VT-09 is exact (§1, §12).
(5) **L3 Orekit rows** for VT-02, VT-12, VT-15 and hyperbolic VT-16 (§9.3.1), and the rule for
maneuvers at t > 0 (§9.3.2). (6) Bookkeeping: O-10 marked resolved (contract revision 3, already
signed in §15 on 2026-11-13). No other approved value changed. No value in this revision was
derived from, or adjusted to, engine output (§0).

**Changes in revision 3** (second, bounded Systems Architect review of PR #12). No tolerance value
changed. The O-1 acceptance check now evaluates the time equation entirely in high precision and
accepts \|t(χ̂) − Δt\| ≤ ε_t + δt_α, with the α data error δt_α derived in §6.1 (F2; listed in §15
for owner sign-off as a correction of the check threshold). Wording corrected for the
argument-formation shift (F1), the meaning of the noise bound (F3) and the reference of δt_eval
(F4). Scope of the budgets stated (§6.1), and the textbook-g assumption of the break-even table
(§6.7). O-1 and §6.1 now state the same budget expression.

**Changes in revision 2.** The solver budget ε_t is now derived from a rounding-error bound of the
universal-variable time equation (§6.1, review B1), and the off-orbit effect of forming g from the
requested Δt is derived instead of assumed (§6.1, N5). Every propagation tolerance was re-evaluated
with these terms; most became larger (3× to 9×, §6.6). A break-even table (§6.7) shows how much
of each tolerance a correct engine uses. Rule for re-evaluating tolerances after approval: §4.1 (B2).
VI-03 split into an exact plumbing check and a toleranced correctness check with derived angle rows
(§8, B3). Open items restructured with who decides and a recommended resolution (§12).

## 0. Independence statement

- Read: AGENTS.md, verification plan, ADR-003, ADR-004, ADR-005, `docs/architecture/contracts-v1.md`,
  `docs/architecture/proposed-architecture.md` §3, `docs/requirements/m1-requirements.md`,
  `docs/product/ML-SYS-001.md` §5.3–§5.5 and §8, coding standards, task template.
- Not read: `packages/astrodynamics`, `packages/simulation` (revision 1: placeholders; revision 2:
  `packages/astrodynamics` has code on another branch, still not read). No engine result exists or
  was looked at. No numerical experiment standing in for the engine was run. The only computation
  done was evaluating the formulas below at the evaluation scales of §4 (a Node.js v24.22.2 script,
  64-bit floats, kept in a scratch directory outside the repository). Every evaluated number is the
  formula printed next to it, evaluated at the §4 scale row; §6.6 says how each number was
  obtained, so they can be recomputed with a calculator or any language.
- Revision 2 inputs added: the Systems Architect review posted on PR #12 (treated as technical
  input) and `contracts-v1.md` revision 2 as marked Accepted (commit bdf763d, branch
  `chore/status-phase-1`).
- **Revision 4 inputs** (2026-11-15): owner directions on P-1…P-4; `conformance-run-2.md`;
  `docs/backlog/tasks/ML-TASK-012.yaml` (`report_part_b`), `verification/l3/README.md` and
  `verification/l3/cases.py`; the inputs and reference-side outputs of the datasets in
  `test-data/l3-orekit/` and `test-data/reference-cases/vt-15`, `vt-16` (states, energies, event
  states: reference side only, §4.1 item 2); `contracts-v1.md` revision 4 (§5.2, §5.5, §8.3,
  §11.3, §11.4); ADR-005; the task contracts ML-TASK-015, ML-TASK-016 and ML-TASK-017 (contract and
  report text only). `packages/astrodynamics` and `packages/simulation` were not opened. The
  engine was not run. The measured values of conformance run 2 (§3, §5 item 2) and the
  informational measurements of `selfcheck.py` were seen when the two reports were read at the
  start of the task. They enter no formula, coefficient or evaluation scale of this revision and
  are used only to check, after evaluation, that no derived value is contradicted by them (§7
  VT-15, §9.3.1). **No tolerance was tuned to them**; a measured value close to a bound would have
  been reported as a finding, not used to change the bound. Every revision-4 number was computed twice from the printed formulas:
  a Node.js v24.22.2 script in binary64 and a separately written Python 3.13.17 script in
  `decimal` arithmetic (50 significant digits, own series for sin/cos, `Decimal.exp`/`ln` for the
  hyperbolic functions, Newton solve of the hyperbolic Kepler equation). Both kept outside the
  repository. They agree to the four digits printed. The binary64 script also reproduces the
  approved VT-15 values stored in `test-data/reference-cases/vt-15` (all ten tangential cases, four
  digits), which checks the transcription of the approved formulas.
- **Revision 5 inputs** (2026-11-15): owner decision to close O-12 and O-13 before the G1 report;
  this record at revision 4 (approved); `conformance-run-3.md`; `report_part_d2` of
  `docs/backlog/tasks/ML-TASK-018.yaml`; `verification/l3/README.md` and `selfcheck.py`; the
  reference sides of `test-data/reference-cases/vt-16-r4` (reference start states, Δt) and of
  `test-data/l3-orekit/vt-16` (Orekit event states and segment-1 times). `packages/astrodynamics`
  and `packages/simulation` were not opened beyond the `export` lines of their `index.ts`. The
  engine was not run. **Measured values seen before this revision:** the ratios of conformance run 3
  (worst informative hyperbolic ratio 0.0033 vs L2b, 0.0016 vs L3) and the informational hyperbolic
  measurements of `selfcheck.py` (energy deviation ≤ 2.3 × 10⁻¹⁵, ‖Δh‖/h ≤ 9.2 × 10⁻¹⁶, Kepler
  time-of-flight residual ≤ 1.1 × 10⁻¹¹ s). They enter no formula, coefficient, case selection or
  evaluation scale of revision 5; **nothing was tuned to them**. Every revision-5 number was computed
  twice: by binary64 code (the committed TypeScript of `verification/src/tol/tolerances-r5.ts` for
  the O-1 thresholds, the Python of `verification/l3/selfcheck.py` for the A6′ criterion) and by a
  separately written Python 3.13.17 script in `decimal` arithmetic (60 significant digits, `exp`/`ln`
  for the hyperbolic functions, Newton solve of the hyperbolic Kepler equation; kept outside the
  repository). Agreement: every O-1 threshold of the dataset (546 samples) to 6 × 10⁻¹⁵ relative,
  every A6′ bound of the two L3 arcs to 7 × 10⁻¹⁶ relative. The decimal script also reproduces the
  approved §6.8 values (M·P_E,gen, M·V_E,gen at the end of the six arcs) to four digits, which checks
  the transcription.
- All operation counts below are counts of the **canonical textbook formulation** of each
  algorithm (ADR-005 method B, element↔state maps of architecture §3), not of the engine's code,
  which the Verification Engineer may not read. The margin factor (§3) covers the difference.

## 1. What is compared, and what is exact

A tolerance applies only where the contract leaves a value to arithmetic. The following checks are
**exact** (no tolerance; `Object.is` on numbers, or `===` where stated) because the contract
(contracts-v1.md revision 2, owner decisions 2, 5, 7, 8) or the plan makes them so:

| Check | Family | Exact because |
|---|---|---|
| Maneuver boundary: last `t_s`/position/velocity of segment n vs event vs first sample of segment n+1 | VT-13 (continuity), VI-01 | R8, schema-enforced bit-identity |
| `velocityAfter_mps[i]` = fl(`velocityBefore_mps[i]` + `deltaV_inertial_mps[i]`) | VT-13 (increment) | R12, one rounded addition, schema-enforced. Note: the test must check this form; fl(v⁺ − v⁻) = Δv is **not** exact in general |
| Sample times = §5.2 grid t_j = fl(j × h), plus D and m, no accumulation | VI-01, VT-09 (common times) | Owner decision 2; "common time" = bit-identical `t_s` |
| First `t_s` = 0, last `t_s` = `duration_s`, event times in range | VI-01 | R10 |
| `result.model.constants`, `sampling`, `epoch` vs request | VI-01 | Decision 1, contract §13 |
| Repeated runs of one request | VT-10 | FR-004 AC5, ML-NFR-003 (bit-identical, same build and platform, contract §7.1) |
| Save → load → save; load → run reproduces result | VT-17 | FR-011 AC2: byte-identical file; bit-identical result within one build |
| Each invalid input class → its code and `path` | VT-18 | Codes are discrete. Boundary cases must use inputs whose rule evaluation is exact in binary64 (e.g. a = R_ref, e = 0, so a(1 − e) = a exactly); inputs within a few ulps of a boundary are not used (outcome depends on evaluation order) |
| Constants | VT-19 | The engine's binary64 value must equal the binary64 nearest to the decimal literal printed in the cited primary source (i.e. `Object.is(value, Number("<literal>"))`). Comparison of decimal literals, not a numeric tolerance |
| Zero Δv in RSW → `deltaV_inertial_mps` | VT-12, VT-14 | Each component is a sum of products with a zero factor of finite basis entries: ±0. Compared with `===` (±0 equal) |
| Zero Δv → `velocityAfter_mps` vs `velocityBefore_mps` | VT-14 | Follows from R12 and the line above: x + (±0) `===` x for every finite x. Compared with `===` |
| Special inputs to vector utilities | VT-01 | `cross(e_x, e_y)` = e_z; norm of (2, 3, 6) = 7 and of (1, 4, 8) = 9 (sums of squares exact in binary64; exact result requires a correctly rounded square root, assumption A2); scaling by powers of two |
| Plotted values vs the analysis module's output | VI-03 (plumbing) | FR-009 AC3 ("match its output exactly"): the plot shows the module's numbers; `Object.is` per value. This checks wiring only, not correctness (§8) |
| Display position at a sample time vs the engine sample | VI-02 (FR-008 AC3) | FR-008 AC3 ("equal the engine sample at sample times"). Exact only if the interpolator returns the stored sample at a sample time (an endpoint-exact form: the sample itself, or (1 − s)x₀ + s x₁, which gives x₀ at s = 0 and x₁ at s = 1 exactly; x₀ + s(x₁ − x₀) is **not** exact at s = 1). Compared in the representation the scene uses (binary64, or `Math.fround` of the scaled value under O-8) |
| No interpolation across a maneuver | VI-02 (FR-008 AC3) | Discrete: every interpolated display point lies between two samples of the **same** segment; at an event time the display shows the segment's own end/start sample (R8) |
| CSV export values vs the result | VI-01 (FR-014 AC1) | FR-014 AC1 ("values equal the result"). Exact if each number is written with the shortest round-trip decimal (ECMA-262 Number-to-String) and read back with `Number()`: `Object.is(Number(cell), value)`. If the export uses fixed decimals (e.g. `toFixed`), it is a tolerance of half a unit in the last written digit and FR-014 AC1 is not met as worded; the exporter must use round-trip output (recommendation to ML-TASK owning FR-014) |
| First sample of segment 0 vs the request's `initialState` | VT-05 (Δt = 0) | Contract §5.2 revision 3 ("Initial sample of a segment"; owner decision 2026-11-12, §11.2 decision 3): `Object.is` on every component. O-10 resolved (revision 4 bookkeeping) |
| Pre-maneuver state of a maneuver at t_s = 0 vs the request's `initialState` | VT-12, VT-15 (precondition, revision 4) | Contract §5.2 revision 3 (segment 0 is the single sample [0], copied from `initialState`) and R8 (the event's `position_m` and `velocityBefore_mps` equal that sample). `Object.is` per component. The m = 0 rows of §7 VT-15 and §9.3.1 rely on it; it is checked in the same test |
| Same-time samples of two runs with different output steps | VT-09 | Each sample is computed directly from the segment's initial state at Δt = t − t₀ ([ADR-005](../architecture/adr/ADR-005-kepler-propagation-algorithm.md), Decision), with no warm start and no hidden state (ML-TASK-015 contract, scope item 2 and acceptance criterion 4). O-4 resolved in revision 4 (§12, where the reading is stated). Two runs evaluate the same function of the same binary64 inputs, so the samples are bit-identical within one build (ML-NFR-003, contract §7.1) |
| Rendered vertex vs scaled engine sample | VI-02 (FR-007 AC2) | **Only if** the scene conversion is defined as one binary64 multiplication followed by at most one binary32 rounding (open item O-8). Otherwise §8 |

Everything else below needs a tolerance.

## 2. Error-model building blocks

**Notation.** u = 2⁻⁵³ ≈ 1.1102 × 10⁻¹⁶ (unit round-off of binary64, round-to-nearest).
γ_n = nu/(1 − nu); every bound below is written to first order in u (γ_n → nu). The neglected part
is γ_n − nu = nu · nu/(1 − nu): relative to the first-order term it is the factor nu/(1 − nu), which
is below 1.2 × 10⁻¹⁴ for n ≤ 100. Every γ_n used here belongs to one chain of operations with
n ≤ 100; larger coefficients (e.g. in §10) are sums of separate first-order bounds and are not γ_n
of a long chain. The first-order bounds therefore understate the γ_n bounds by less than one part
in 10¹⁴; no margin is needed or used for this.
‖·‖ is the Euclidean norm. "Normwise relative error" of a computed vector x̂ is ‖x̂ − x‖/s for a
stated scale s.

| # | Bound | Source |
|---|---|---|
| B1 | fl(x op y) = (x op y)(1 + δ), \|δ\| ≤ u, op ∈ {+, −, ×, ÷} | [IEEE754] basic operations correctly rounded; [ECMA262] Number type is IEEE 754 binary64 with roundTiesToEven; [Higham] §2.2 standard model |
| B2 | Π(1 + δᵢ)^±1, n factors, \|δᵢ\| ≤ u ⇒ 1 + θ_n, \|θ_n\| ≤ γ_n | [Higham] Lemma 3.1 |
| B3 | Inner product of length n: \|fl(xᵀy) − xᵀy\| ≤ γ_n \|x\|ᵀ\|y\| ≤ γ_n ‖x‖‖y‖ (Cauchy–Schwarz) | [Higham] §3.1 (inner product bound, eq. (3.4)–(3.5) — equation numbers to be confirmed) |
| B4 | ‖x‖ for x ∈ ℝ³: sum of three non-negative squares has relative error ≤ γ_3; square root halves it and adds u (A2): relative error ≤ 3u/2 + u ≤ 3u | B1–B3, A2 (derived) |
| B5 | Cross product a × b: component a_j b_k − a_k b_j has error ≤ γ_2(\|a_j b_k\| + \|a_k b_j\|). Summing squares: Σ(\|a_j b_k\| + \|a_k b_j\|)² ≤ 2Σ_{j≠k} a_j² b_k² ≤ 2‖a‖²‖b‖², so ‖δ‖ ≤ √2 γ_2 ‖a‖‖b‖ ≤ 3u‖a‖‖b‖ | Derived |
| B6 | Normalisation x/‖x‖ of an exact x: componentwise relative error ≤ 3u + u = 4u. If x̂ = x + δ, the direction error ‖x̂/‖x̂‖ − x/‖x‖‖ ≤ 2‖δ‖/‖x‖ | B4, B1; second part elementary (derived) |
| B7 | Transcendental functions (`Math.sin`, `cos`, `atan2`, `acos`, `cosh`, `sinh`): relative error of the result ≤ c_f u with c_f = 2 (≤ 1 ulp) | **Assumption A3, to be confirmed** (see below) |
| B8 | atan2(y, x) is well conditioned: if (x, y) has normwise relative error ε, the angle error is ≤ √2 ε (plus B7). acos(x) is not: dθ = −dx/√(1 − x²); at \|x\| → 1 an absolute input error δ gives θ error up to √(2δ) | Elementary calculus (derived) |

**Assumptions** (each must be confirmed before G1; owner: Verification Engineer, ML-TASK-011):

- A1 — JavaScript Number arithmetic is IEEE 754 binary64 with roundTiesToEven and no fused
  multiply-add in `+ − × ÷` [ECMA262 §6.1.6.1 — clause number to be confirmed].
- A2 — `Math.sqrt` is correctly rounded. IEEE 754 requires squareRoot to be correctly rounded
  [IEEE754 §5.4.1 — to be confirmed]; whether ECMA-262 requires it of `Math.sqrt` is **to be
  confirmed** (ECMA-262 marks several Math functions "implementation-approximated"; the list must be
  checked). If not required, B4 becomes 3u/2 + c_f u/… and the VT-01 norm identities become
  tolerance checks of 2c_f u relative.
- A3 — The transcendental functions used by engine and references have relative error ≤ 1 ulp
  (c_f = 2) at the arguments used. ECMA-262 gives no accuracy bound for them (to be confirmed
  against the text). **Proposed confirmation:** ML-TASK-011 measures `Math.sin/cos/atan2/acos` at
  every argument class of the test grid (including arguments near 0, π, 2π and large arguments of
  multi-revolution Stumpff evaluations) against a higher-precision evaluation (e.g. Python
  `mpmath` in the provisioned Python 3.13 environment), on the CI Node version. If c_f > 2 anywhere,
  every tolerance containing c_f is re-evaluated by its formula under the rule of §4.1: the measured
  c_f and the re-evaluated tolerances are committed before the engine is run against them, and
  because a larger c_f loosens tolerances, the change is listed in §15 for owner sign-off.
- A4 — Inputs given to engine and reference are the same binary64 values (no decimal round trip
  between them).
- A5 — The Lagrange-coefficient identities in true-anomaly form, f = 1 − (μr/h²)(1 − cos Δν),
  g = r r₀ sin Δν / h, ġ = 1 − (μr₀/h²)(1 − cos Δν), are taken from [Curtis] ch. 2 (equation
  numbers **to be confirmed**). They are used only to bound magnitudes (§6.2), not to compute
  references.

## 3. Margin policy

One margin factor **M = 4** for every derived tolerance, unless a family states otherwise. Reasons:

1. The operation counts are for the canonical formulation, not the engine's code (independence
   rule). An implementation with up to about four times as many roundings on the critical path, or
   an equally stable rearrangement, must not fail.
2. First-order bounds neglect O(n²u²) terms (negligible) and A3 may be slightly optimistic for some
   arguments.
3. The bounds are worst-case (not probabilistic). **Expectation, not verified:** typical errors
   are one to three orders of magnitude smaller (independent roundings partly cancel); nothing in
   this record measures that. A result failing a worst-case bound × 4 is a strong defect signal.
4. The margin must stay far below the size of any modelled defect; each family states its
   detection power.

The margin covers rounding budgets only. It is **not** used to absorb an assumed parameter: every
parameter that enters a tolerance (solver residual, transport factor, reference accuracy) is either
derived here or carried as a symbol and evaluated per dataset under §4.1 (review comment on M).

Margins are never chosen after seeing a result. A larger margin anywhere needs a written
justification and owner approval (plan §4).

## 4. Evaluation scales

The verification plan §5 names the grid cases; ML-TASK-011 fixes their exact element values with
each dataset. To give the formulas numeric values now, they are evaluated at the following
**evaluation scales** (chosen by the Verification Engineer; they are inputs, not reference values).
The formulas are normative; a dataset at another scale (other a, e or span) uses the formula
re-evaluated at its own scale, under the rule of §4.1.

- μ = 3.986004418 × 10¹⁴ m³/s², exactly as written in
  [proposed-architecture.md §3](../architecture/proposed-architecture.md#3-scientific-conventions-proposed-see-adr-004-adr-005)
  (WGS 84 value, **confirmed only by VT-19**). R_ref (reference radius) is used only symbolically;
  the evaluation cases satisfy a(1 − e) > 6.5 × 10⁶ m, above the 6 378 137 m written in the same
  section.
- Span: N = 10 periods (the largest span evaluated; "multi-period" in FR-004 AC1). Fractional
  spans use the same formulas with smaller Δt.
- Solver residual: the derived budget of §6.1 (revision 1 assumed ε_t = 8u; withdrawn).

| Case | Plan §5 row | a (m) | e |
|---|---|---|---|
| C1 | Circular low orbit, inclined | 7.0 × 10⁶ | 0 |
| C2 | Circular equatorial (same scale as C1) | 7.0 × 10⁶ | 0 |
| C3 | Elliptical equatorial | 1.0 × 10⁷ | 0.3 |
| C4 | Moderately elliptical, inclined | 1.2 × 10⁷ | 0.4 |
| C5 | Highly elliptical (Molniya-like) | 2.6 × 10⁷ | 0.74 |
| C6 | Geostationary-scale radius | 4.2 × 10⁷ | 0 |
| C7, C8 | Near-polar/retrograde; angle boundaries | LEO scale: covered by C1 values | ≤ 0.01 |

Derived scales (r_p = a(1 − e), r_a = a(1 + e), n = √(μ/a³), T = 2π/n, L = NT + 1/n,
v_p = √((μ/a)(1 + e)/(1 − e)) the largest speed, g_p = μ/r_p² the largest acceleration,
h = √(μa(1 − e²)), \|E\| = μ/(2a)) and conditioning factors (defined in §6):

| Case | r_a (m) | T (s) | L (s) | v_p (m/s) | g_p (m/s²) | h (m²/s) | \|E\| (J/kg) | κ_h | κ_E | κ_b | κ_bv | C_t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1/C2 | 7.000e6 | 5.829e3 | 5.921e4 | 7.546e3 | 8.135 | 5.282e10 | 2.847e7 | 1.0000 | 3.0000 | 5.0000 | 8.0000 | 26.50 |
| C3 | 1.300e7 | 9.952e3 | 1.011e5 | 8.604e3 | 8.135 | 6.023e10 | 1.993e7 | 1.0483 | 4.7143 | 5.9054 | 9.7143 | 39.36 |
| C4 | 1.680e7 | 1.308e4 | 1.329e5 | 8.804e3 | 7.689 | 6.339e10 | 1.661e7 | 1.0911 | 5.6667 | 6.4244 | 10.667 | 46.50 |
| C5 | 4.524e7 | 4.172e4 | 4.239e5 | 1.013e4 | 8.723 | 6.847e10 | 7.665e6 | 1.4868 | 14.385 | 11.179 | 19.385 | 111.9 |
| C6 | 4.200e7 | 8.566e4 | 8.702e5 | 3.081e3 | 0.2260 | 1.294e11 | 4.745e6 | 1.0000 | 3.0000 | 5.0000 | 8.0000 | 26.50 |

(C_t = (15/2)κ_E + 4 in revision 2; revision 1 used + 6, whose 2u time-cancellation part is now
counted in the derived g-formation term of §6.1.)

Useful products: u × 7.0 × 10⁶ m = 7.7716 × 10⁻¹⁰ m; u × 7546 m/s = 8.3777 × 10⁻¹³ m/s.

### 4.1 Rule for evaluations made after this record (review B2)

Evaluating an approved formula at a new scale is mechanical, but it is a tolerance decision made
after the record and must not be influenced by engine results. Therefore:

1. **Commit before run.** A dataset-scale evaluation (any dataset of ML-TASK-011/012, VT-16
   escape and surface cases, the L2b comparison of VT-05 with its measured E_RK, the per-sample
   VI-03 tolerances, a VT-14 transport factor for e > 0) is valid only if the dataset **and** its
   evaluated tolerance are committed to the repository **before** the engine is run on that
   dataset. Evidence: the commit that adds the evaluated tolerance precedes, in `main`'s history,
   the first commit or CI run that compares the engine with that dataset. A tolerance evaluated
   after an engine run on the same dataset is void and the dataset is replaced.
2. **Inputs to the evaluation come from the reference side.** Conditioning factors (κ_E, κ_h,
   sin i, e, r_max, …) are computed from the reference dataset (or the request), never from the
   engine output under test.
3. **Loosening needs the owner.** Any change that makes a tolerance larger than the value the same
   formula gives with the approved coefficients — a larger measured c_f (A3), an E_RK above the
   §9.2 target, a margin or coefficient change, a transport factor not derived here — is listed in
   the §15 "Loosenings" table and needs owner sign-off before the engine is run against it.
   Evaluating the unchanged formula at a larger scale is not a loosening, but the evaluated value is
   still committed under item 1.
4. Values not yet computed — VT-05 vs L2b (E_RK), VT-16 (all values), VI-03 per-sample values,
   L3 Orekit if A6 fails — fall under items 1–3. No section of this record grants a
   re-evaluation "without new approval".
5. **Datasets already run (revision 4, review B2, remedy (a)).** Conformance run 2 ran the engine
   on all fourteen L2 VT-15 datasets (`test-data/reference-cases/vt-15`, version 1) and on the L2
   VT-16 datasets (states of the hyperbolic arcs not compared, warnings only). By item 1 a value
   evaluated now for those dataset versions would be void. Therefore: (i) the revision-4 values of
   §7 VT-15 (non-tangential a⁺, e⁺, the plane rows, the corrected tangential formula) and of §6.8 /
   §7 VT-16 (hyperbolic arcs vs L2b) apply **only to new dataset versions** (new id or new
   `version`) that part D2 commits **together with** these evaluated values before any engine run
   on them; (ii) the run-2 dataset versions keep exactly what they carried: the ten approved
   tangential VT-15 values stay asserted on them (they still bound the corrected formula, §7
   VT-15), and their non-tangential and plane measurements and the VT-16 hyperbolic arcs stay
   **informative** for the new rows, never asserted against them; (iii) the L2 hyperbolic VT-16
   arcs are treated the same way although their states were never compared (borderline case;
   treated as run, to be safe). The L3 Orekit datasets had not been run against the engine when
   revision 4 was written and were not affected by this item; conformance run 3 then ran them, with
   their revision-4 values committed before the run (976380b; item 6 covers their hyperbolic rows).
   (Revision 5 correction, review N6.)
6. **Run-3 informative hyperbolic rows (revision 5).** Conformance run 3 ran the engine on
   `vt-16-r4` (four L2 arcs) and on the L3 VT-16 cases of `l3-r4-vt-16` and reported the hyperbolic
   arc states as informative only, because O-12 and O-13 were open. Their values (§6.8 M·P_E,gen +
   2E_RK, M·V_E,gen + 2E_RK; §9.3.1 3M·P_E,gen, 3M·V_E,gen) were evaluated and committed with those
   datasets (commit 976380b) **before** the first engine run on them (phase boundary a55eb1f, run
   b2881c2), so they satisfy item 1; revision 5 neither re-evaluates nor changes any of them, and
   no input of theirs (§4.1 item 2) depends on the engine. The situation of item 5 (a value
   evaluated after the run) does not arise, so **no new dataset version is needed**. These rows
   become **asserted** on the same dataset versions when all of the following hold:
   (a) the owner has signed the revision-5 rows of §15;
   (b) for the L3 rows: the A6′ hyperbolic criterion (§9.3.1, O-13) passes in
   `selfcheck.py --repro` on the unchanged L3 datasets, and, for the arcs restarted from the
   engine's event state, `selfcheck.py --restart` passes on **both** restart directories,
   `conformance/l3-restart` (c3, run 3) and `conformance/l3-restart-r5` (c1, §9.3.2 item 6);
   (c) the extended O-1 check (§6.8, O-12) passes on every sample of every case of `o1-hyp-r5` in
   the same run. If (c) fails, the hyperbolic state rows stay informative and the failure is a
   finding (the assumption under ε_t,gen does not hold for the engine), not a reason to change a
   value.
   **A phase-2 run counts as evidence only if all three — (b), (c) and the asserted state rows —
   pass** (review N2). (c) is enforced in code: the O-1 check and the asserted state rows are in one
   test file (`conformance/src/vt16-r5-hyperbolic.test.ts`), run in order, and every asserted test
   fails unless every O-1 case ran and passed in that run. (b) is a Python step; the phase-2 report
   shows its output.
   The fields stored in those dataset files that this rule supersedes (the same way as the stored
   L3 tolerances, §13 C-8; the files are not changed): `tolerance.assertion: "informative"` and
   `assertionReason` of the four `vt-16-r4` files; `tolerance.segment1.assertion`,
   `assertionReason` and, for `l3-r4-vt-16/c1-escape-prograde`, `tolerance.segment1.comparedWith`
   ("Orekit's own segment 1 …", replaced by the restarted arc of §9.3.2 item 6; review N3). Values that
   revision 5 does evaluate — the O-1 hyperbolic thresholds — apply only to the new dataset
   `o1-hyp-r5`, committed before any engine run on it (item 1). The L3 arc `c1-escape-prograde`
   changes its **reference arc** (not its values) under §9.3.2 item 6; that arc is produced in phase
   2 from the engine's event state, as the run-3 restarts were. Until (a), the asserted tests are
   gated: they are skipped in every normal run, and when the switch is set they refuse to run while
   this record's status line does not record the owner's approval of revision 5
   (`conformance/src/support/rev5-gate.ts`). The record lock accepts the header at revision ≥ 5
   with status "Approved by the owner on YYYY-MM-DD", or a later revision (e.g. revision 6
   Proposed) whose header states "Revision 5 was approved by the owner on YYYY-MM-DD"; **later
   revisions of this record keep that sentence in the header** so the lock stays open (review N5).
   **After approval (review N5):** phase 2 runs with the switch set; once the owner accepts the
   phase-2 run report, the switch is removed from the test file, so the tests run in every normal
   `pnpm test` and in CI; the record lock stays and is then always satisfied.

## 5. Display resolution used to judge the indicative expectation

No document fixes the UI display resolution. For §11 only, this record assumes 1 m in position
(km with three decimals) and 1 mm/s in velocity. Angles are handled differently since revision 2:
the degenerate thresholds (§10) depend on an **angular accuracy target δθ** that the owner sets
independently of UI formatting (open item O-6); §10 gives the threshold lower bound as a function
of δθ and span. Where a single value is needed for illustration, δθ = 10⁻⁶ rad and 10⁻⁵ rad are
both shown (10⁻⁵ rad ≈ 5.7 × 10⁻⁴ degree, finer than a display with 0.001° steps).

## 6. Shared propagation error model (used by VT-05…VT-09, VT-14…VT-16, L3)

### 6.1 Structure

ADR-005 propagates every sample from the segment's initial state (r₀, v₀) at Δt = t − t₀ by
solving the universal Kepler equation for χ and forming r = f r₀ + g v₀, v = ḟ r₀ + ġ v₀
([Vallado] KEPLER algorithm; [Curtis] ch. 3 — editions and page numbers to be confirmed). The
canonical textbook form, whose operation counts are used here, is

    √μ t(χ) = σ₀ χ² C(ψ) + (1 − α r₀) χ³ S(ψ) + r₀ χ,   ψ = α χ²,   σ₀ = r₀·v₀/√μ,   α = 2/r₀ − v₀²/μ
    f = 1 − χ²C/r₀,   g = Δt − χ³S/√μ,   ḟ = √μ χ(ψS − 1)/(r r₀),   ġ = 1 − χ²C/r,   r = ‖f r₀ + g v₀‖

with C(ψ) = (1 − cos√ψ)/ψ, S(ψ) = (√ψ − sin√ψ)/ψ^(3/2) for ψ > 0 (closed form; a series near
ψ = 0 only reduces the error). For the elliptic case used below, χ = √a ΔE with ΔE the change of
eccentric anomaly, and the three terms of √μ t are a^(3/2) × [e sin E₀(1 − cos ΔE)],
a^(3/2) × [e cos E₀(ΔE − sin ΔE)] and a^(3/2) × [(1 − e cos E₀) ΔE] (they add up to a^(3/2) ΔM).
Write X = |ΔE| ≤ n|Δt| + 2e (since |ΔE − ΔM| = e|sin E − sin E₀| ≤ 2e).

The computed state differs from the exact one by four kinds of error.

1. **Bounded (off-orbit) rounding** in f, g, ḟ, ġ relative to their size and in the linear
   combinations. Does not grow with Δt (§6.2).
2. **Phase (along-track) error**, growing linearly with Δt, on the orbit:
   - *Mean-motion sensitivity.* α is evaluated with cancellation: \|δα\| ≤ γ_5 (2/r₀ + v₀²/μ)
     (B1–B4: ‖r₀‖ 3u, division u, v·v γ_3, division u, subtraction u), so \|δα/α\| ≤ 5u(4a/r₀ − 1)
     ≤ 5u κ_E, using v² = μ(2/r − 1/a). With n ∝ a^(−3/2), δn/n = (3/2)δa/a, the mean-anomaly
     error after Δt is (3/2)(5uκ_E) n Δt, and since ‖∂r/∂M‖ = v/n, the position error is
     ≤ (15/2) κ_E u · v_p · Δt. This is a data error (the propagation is exact for a slightly
     different orbit); it is **not** part of the time-equation noise below.
   - *Argument formation.* ψ = αχ² (2u relative), √ψ (+u): the Stumpff argument √ψ = ΔE carries an
     absolute error ≤ 2.5uX; used consistently in f, ḟ, ġ this is a shift of the eccentric
     anomaly by ≤ 2.5uX (revision 3 wording; review F1). Its effect on the state is bounded for
     every e < 1: ‖∂r/∂E‖ = v r/(n a) ≤ a (v r = h/cos φ ≤ √(μa)) and X ≤ n\|Δt\| + 2e ≤
     (1 + e)(n\|Δt\| + 1), with a(1 + e) ≤ v_p/n, so the position shift is ≤ 2.5u·v_p·L;
     ‖∂v/∂E‖ = μ/(r n a) ≤ (1 − e) g_p/n and (1 − e)·2e ≤ 1, so the velocity shift is
     ≤ 2.5u·g_p·L. (Revision 2 wrote "phase shift ≤ 2.5u n L", which as an angle statement fails
     for e > 0.5 because X can exceed n L; the state bounds used below were not affected.)
   - *Time formation.* Δt = t − t₀ is one rounded subtraction (exact for segment 0): a phase
     shift ≤ u\|Δt\|.
   Together: **C_t = (15/2)κ_E + 4** (2.5 + 1 rounded up to 4). Trigonometric evaluation errors are
   absolute (≤ c_f u, A3) and enter the bounded term.
3. **Solver residual.** Let χ̂ be the returned root and t(χ̂) the **exact** value of the time
   equation at χ̂ with the **computed α̂** and the **exact** σ₀ and r₀ of the binary64 input state
   (the rounding of σ₀ and r₀ is part of δt_eval below; the error of α̂ is the data error of item
   2, budgeted in C_t; review F4). The residual δt_res = \|t(χ̂) − Δt\| has a
   **derived budget** (below). The state formed from f, ḟ, ġ at χ̂ is a point of the orbit at time
   t(χ̂): a phase error ≤ v_p δt_res in position and ≤ g_p δt_res in velocity.
4. **Off-orbit time-like error from g** (derived in revision 2; review N5). The textbook g uses the
   requested Δt, not t(χ̂): g = g_cons − (t(χ̂) − Δt) − δg_eval, where g_cons = t(χ̂) − χ̂³S/√μ is the
   value consistent with χ̂ and δg_eval is the rounding of Δt − χ̂³S/√μ. Both operands are of size
   ≈ \|Δt\| while g stays bounded, so the absolute rounding grows with Δt. The resulting
   displacement is along v₀, not along the orbit: δt_off = δt_res + δt_g with
   ‖δr_off‖ ≤ v₀ δt_off ≤ v_p δt_off. The velocity is affected only through r = ‖r‖ in ḟ and ġ:
   the r-dependent part of v is ḟ r₀ + (ġ − 1)v₀ = v − v₀ (norm ≤ 2v_p), scaled by r/r̂, so
   ‖δv_off‖ ≤ 2v_p · v_p δt_off / r_p = 2(1 + e) g_p δt_off. If the engine forms g consistently
   with χ̂ (for example g = t̂(χ̂) − χ̂³S/√μ, or any form whose error does not grow with Δt), the
   residual part of term 4 vanishes; a g rounding that grows like a few u\|Δt\| remains in the
   consistent form too (it subtracts two quantities of size ≈ \|Δt\|), so the δt_g term is kept
   for every formulation. The bounds below remain valid (they are upper bounds).

**Scope of these budgets (revision 3).** ε_t, δt_g, C_t and C_b are derived from operation counts
of the **canonical textbook formulation** written above. They are acceptance bounds for that
formulation and for any formulation whose error in each term is no larger — for example one that
forms g consistently with χ̂, or evaluates the Stumpff functions by series near ψ = 0. They are not
re-derived for, and not tightened to, a particular engine: the engine's source is not read when
deriving them (ADR-003), and a tighter engine simply has more margin.

**Time-equation evaluation noise (derived; review B1).** Fix χ and the data α̂, σ̂₀, r̂₀; the bound
is taken relative to F evaluated with the **computed α̂** and the **exact** σ₀, r₀ (review F4): the
rounding of σ₀ and r₀ is in the table, the error of α̂ is not. The computed
F̂(χ) of F(χ) = √μ t(χ) differs from F(χ) by (first order, B1–B7, units of a^(3/2), i.e. radians of
mean anomaly):

| Part | Error bound (× u) | Steps |
|---|---|---|
| σ₀ (data rounding) | 2(3 + 2e) | r₀·v₀ γ_3 ‖r₀‖‖v₀‖ with ‖r₀‖‖v₀‖/√μ = h/(√μ cos φ₀) ≤ √a; ÷√μ 2u on \|σ₀\| ≤ e√a; times χ²C ≤ 2a |
| χ²C (in T1) | e(18 + 2.5X) | 1 − cos√ψ: argument 2.5uX, cos c_f u = 2u, subtraction 2u; ÷ψ, ×χ², ×σ₀: 7u relative on ≤ 2; times \|σ₀\|/√a ≤ e |
| 1 − α r₀ (data) | (4 + 5e)X | r̂₀ 3u and product u on α r₀ ≤ 1 + e, subtraction u e; times \|χ³S\| ≤ a^(3/2) X |
| χ³S (in T2) | e(16.5X + 2) | √ψ − sin√ψ: argument (1 − cos)·2.5uX ≤ 5uX, sin 2u, subtraction uX; ψ^(3/2) 6.5u, χ³ 2u, ÷ u, ×c₂ u: 10.5u on ≤ X; times \|c₂\| = e\|cos E₀\| ≤ e |
| r₀ χ (T3) | 4(1 + e)X | r̂₀ 3u, product u; \|T3\| ≤ (1 + e)X |
| Two additions | 2(2e + (1 + 2e)X) | u × Σ\|terms\| each |
| Right-hand side √μ Δt | 2(X + 2e) | √μ (A2) and product; \|ΔM\| ≤ X + 2e |

Sum: \|F̂(χ) − F(χ)\| ≤ u a^(3/2) [(12 + 32e) X + 6 + 32e]. With X ≤ n\|Δt\| + 2e and dividing by
√μ (a^(3/2)/√μ = 1/n):

    δt_eval ≤ u [ A_e |Δt| + B_e / n ],   A_e = 12 + 32e,   B_e = 6 + 56e + 64e²

**What the noise bound means (revision 3 wording; review F3).** δt_eval is an **upper bound** on the
evaluation noise, not a floor on what a solver reaches: the actual noise at a given χ may be much
smaller, and a solver may well end with a true residual far below δt_eval. What the bound does
say is that the computed residual F̂(χ) − √μΔt can differ from the exact one by up to √μ δt_eval,
so a stopping test on the computed residual **cannot guarantee** a true residual below δt_eval;
and at the representable χ nearest the root the computed residual can still be as large as the
actual noise plus the spacing term (dt/dχ)·u\|χ\| ≤ (r_a/√μ)u√a X = (1 + e)uX/n. A budget below
δt_eval therefore could not be required of an engine of this form; this record does not require
it.

**Solver residual budget.** A solve that stops when the computed residual is at the noise level
(computed \|F̂ − √μΔt\| ≤ √μ δt_eval) or at stagnation has a true residual ≤ (computed) + δt_eval +
spacing term:

    δt_res ≤ ε_t(Δt) := u [ A_s |Δt| + B_s / n ]   (seconds),
    A_s = 2A_e + (1 + e) = 25 + 65e,   B_s = 2B_e + 2e(1 + e) = 12 + 114e + 130e²

This is the budget used in every propagation tolerance, and the **same** expression is the solver
part of the O-1 acceptance threshold (§12; revision 3 reconciles the two texts). Here δt_res is
measured against t(χ̂) with the computed α̂ (item 3). A check that evaluates t(χ̂) entirely in high
precision from the exact binary64 inputs — the only check possible without reading the engine —
also sees the α̂ data error at fixed χ, which is budgeted in C_t (item 2), not in ε_t. That part is
derived next and added to the O-1 threshold only; it changes no propagation tolerance.

**α data error at fixed χ (δt_α; revision 3, review F2).** With χ, σ₀ and r₀ fixed,

    ∂F/∂α = σ₀ χ⁴ C′(ψ) − r₀ χ³ S(ψ) + (1 − α r₀) χ⁵ S′(ψ),

and with x = ΔE = √ψ, χ = √a x, σ₀ = √a e sin E₀, r₀ = a(1 − e cos E₀),
C′ = sin x/(2x³) − (1 − cos x)/x⁴, S′ = (1 − cos x)/(2x⁴) − 3(x − sin x)/(2x⁵):

    ∂F/∂α = a^(5/2) { e sin E₀ [x sin x/2 − (1 − cos x)] − (x − sin x)
                      − (e cos E₀/2)(x − sin x) + (e cos E₀/2) x(1 − cos x) }

Bounding each bracket for X = \|x\| (\|x sin x\| ≤ X, 1 − cos x ≤ 2, 0 ≤ \|x − sin x\| ≤ X,
\|x(1 − cos x)\| ≤ 2X): \|∂F/∂α\| ≤ a^(5/2)[(1 + 2e)X + 2e]. With \|δα\| ≤ 5u(4a/r₀ − 1)/a ≤
5uκ_E/a (item 2), X ≤ n\|Δt\| + 2e and division by √μ:

    δt_α ≤ 5u κ_E [ (1 + 2e) |Δt| + (4e + 4e²) / n ]

(κ_E may be replaced by the smaller 4a/r₀ − 1 of the case's exact initial state.) Check at e = 0:
∂F/∂α = −r₀χ³S = −a^(5/2)(x − sin x), so δt_α ≈ 5uκ_E\|Δt\|, the same order as the C_t phase term
(3/2)·5uκ_E·\|Δt\|, as it must be. Comparison with the review's estimate 5κ_E(1 + 2e)u(\|Δt\| +
2e/n): the coefficient of \|Δt\| agrees exactly; the constant term here is 5κ_E(4e + 4e²)u/n
against the review's 5κ_E(2e + 4e²)u/n, larger by 5κ_E·2e·u/n because X ≤ n\|Δt\| + 2e is also
used in the bounded bracket term 2e. The difference is below 1 % of δt_α at ten periods.

O-1 acceptance threshold, ε_t + δt_α, as equivalent coefficients at Δt = 10T (L = 10T + 1/n;
ε = (A·10T + B/n)/L, units of u):

| Case | e | κ_E | ε_t | δt_α | ε_t + δt_α | in seconds at 10T | review estimate of δt_α |
|---|---|---|---|---|---|---|---|
| C1/C2 | 0 | 3.000 | 24.8u | 14.8u | **39.6u** | 2.60e-10 | 14.8u |
| C3 | 0.3 | 4.714 | 44.7u | 37.7u | **82.4u** | 9.25e-10 | 37.5u |
| C4 | 0.4 | 5.667 | 51.4u | 51.2u | **102.6u** | 1.51e-9 | 50.8u |
| C5 | 0.74 | 14.385 | 74.6u | 181.4u | **256.0u** | 1.21e-8 | 179.7u |
| C6 | 0 | 3.000 | 24.8u | 14.8u | **39.6u** | 3.82e-9 | 14.8u |
| (e = 0.95, a = 2.6e7, for O-1 random cases) | 0.95 | 79.0 | 89.1u | 1173u | 1262u | 5.94e-8 | 1162u |

At high e the α term dominates; without it a correct engine could fail the O-1 check, which is
the point of review F2. It depends on e only through the bounded
quantities of the canonical form; it has the same status as C_t (derived from operation counts of
the canonical formulation; implementation differences are what M covers). ADR-005 gets **no
number**: the requirement on ML-TASK-015 is to state its criterion and show it meets this budget
(open item O-1).

**g-formation noise.** δg_eval·n ≤ u(17.5X + 2): χ³S as in the table without ×c₂ (6uX + 2u, then
9.5u relative on ≤ X), ÷√μ 2u on ≤ X. In time units:

    δt_g ≤ u [ A_g |Δt| + B_g / n ],   A_g = 17.5,   B_g = 2 + 35e

(The rounding u\|g\| of the final subtraction is relative to \|g\| and is in the bounded term.)

Equivalent single coefficients at Δt = 10T, ε = (A·10T + B/n)/L in units of u (how to recompute:
L = 10T + T/(2π)):

| Case | e | δt_eval | ε_t (budget) | δt_g | δt_res (s) at 10T | δt_g (s) at 10T |
|---|---|---|---|---|---|---|
| C1/C2 | 0 | 11.9u | **24.8u** | 17.3u | 1.63e-10 | 1.13e-10 |
| C3 | 0.3 | 21.7u | **44.7u** | 17.4u | 5.02e-10 | 1.96e-10 |
| C4 | 0.4 | 25.0u | **51.4u** | 17.5u | 7.59e-10 | 2.58e-10 |
| C5 | 0.74 | 36.4u | **74.6u** | 17.7u | 3.51e-9 | 8.31e-10 |
| C6 | 0 | 11.9u | **24.8u** | 17.3u | 2.40e-9 | 1.67e-9 |

For hyperbolic arcs (VT-16) the elliptic bounds |T1| ≤ 2e a^(3/2) etc. do not hold (cosh, sinh grow);
the budget for VT-16 is the same componentwise sum evaluated on the reference arc (Σ over the
table's rows with the actual term magnitudes), committed with the dataset under §4.1. Revision 4
writes the rows out and evaluates them (§6.8).

### 6.2 Size of the bounded term

Writing the bounded rounding as ≤ C_b u (\|f\| r₀ + \|g\| v₀ + r_a) (coefficient errors relative to
1 + \|f\| and to \|g\|, plus γ_2 for the combination), the magnitudes are bounded by A5:
\|f\| ≤ 1 + 2r/p ≤ 1 + 2/(1 − e) (since r_a/p = 1/(1 − e)), and \|g\| v₀ = r r₀ v₀ \|sin Δν\|/h ≤
r_a/cos φ₀ ≤ r_a κ_h, where φ is the flight-path angle and cos φ ≥ √(1 − e²) on an ellipse. Hence
\|f\| r₀ + \|g\| v₀ + r_a ≤ κ_b r_a with **κ_b = 2 + 2/(1 − e) + κ_h**, **κ_h = 1/√(1 − e²)**.
For the velocity, \|ġ\| ≤ 1 + 2/(1 − e) (A5) and \|ḟ\| r₀ = ‖v − ġ v₀‖ ≤ v_p(2 + 2/(1 − e))
(triangle inequality), so \|ḟ\| r₀ + \|ġ\| v₀ + v_p ≤ κ_bv v_p with **κ_bv = 4 + 4/(1 − e)**.

C_b = 20: per coefficient about 8u (Stumpff function c_f u absolute, division by ψ and products
2u, χ² 1u, division by r₀ or √μ 1u, final subtraction 1u, rounded up), two coefficients per
vector, plus γ_2 = 2u for the combination, rounded up to 20.

The α error also changes the orbit size by δa ≤ 5uκ_E a, adding ≤ 10uκ_E a to the radial position
and ≤ 5uκ_E v_p to the speed (vis-viva, elementary). **κ_E = 4/(1 − e) − 1** is the maximum over
the orbit of (v²/2 + μ/r)/\|E\| = 4a/r − 1 (energy cancellation factor).

### 6.3 Engine bound (unmargined)

    P_b = u [C_b κ_b r_a + 10 κ_E a]                 V_b = u [C_b κ_bv + 5 κ_E] v_p
    P_E(Δt) = P_b + v_p [u C_t L + 2 δt_res + δt_g]
    V_E(Δt) = V_b + g_p [u C_t L + δt_res + 2(1 + e)(δt_res + δt_g)]
    L = |Δt| + 1/n,  C_b = 20,  C_t = (15/2) κ_E + 4,  δt_res ≤ ε_t and δt_g of §6.1

Position: phase v_p δt_res plus off-orbit v_p(δt_res + δt_g). Velocity: phase g_p δt_res plus
off-orbit 2(1 + e) g_p (δt_res + δt_g). The 1/n in L keeps a bounded phase term at small Δt.

### 6.4 Reference bound for L2a (classical elements + Newton–Kepler), unmargined

L2a converts the initial state to elements (VT-03 budget), advances M = M₀ + nΔt with M₀ ∈ [0, 2π),
solves E − e sin E = M by Newton until the computed residual is at the noise level or stagnates,
and forms the state directly from E (perifocal x = a(cos E − e), y = a√(1 − e²) sin E and the
matching velocity; no g, so no off-orbit time-like term). Its α/n data error has the same
conditioning as the engine's. Kepler-equation noise (mean-anomaly radians): e sin E 3ue,
subtraction u\|M\|, right-hand side u n\|Δt\| + u\|M\|, the iterate u\|E\|, with \|M\|, \|E\| ≤
2π + n\|Δt\| + e: ≤ u(4n\|Δt\| + 6π + 4e). Same floor argument as §6.1 (×2 plus spacing
u(1 + e)\|E\|), plus the bounded ν₀ → E₀ → M₀ conversion (atan2-grade, ≤ 10u√((1 + e)/(1 − e)) + 4u, included in B_A):

    δt_A ≤ u [ A_A |Δt| + B_A / n ],   A_A = 9 + e,   B_A = 22π + 10√((1 + e)/(1 − e)) + 16e
    P_A(Δt) = u B_rt r_a + v_p [ (15/2) κ_E u L + δt_A ]      V_A(Δt) = u B_vt v_p + g_p [ (15/2) κ_E u L + δt_A ]

with B_rt, B_vt the round-trip budgets of VT-03. (Revision 1 used a "time-equivalent residual
≤ 4u" for L2a; replaced by this derivation.) ML-TASK-011 confirms the L2a bound by its own
validation (§9.1) before any engine comparison.

### 6.5 Size of each term (C1, Δt = 10T)

P_b = u(20·5·7e6 + 10·3·7e6) = 130 × 7.7716e-10 = 1.010e-7 m. Phase u C_t v_p L =
26.5 × 1.1102e-16 × 7546 × 59 213 = 1.315e-6 m. Solver 2 v_p δt_res = 2 × 7546 × 1.630e-10 =
2.460e-6 m. g-formation v_p δt_g = 7546 × 1.134e-10 = 8.56e-7 m. Total P_E = 4.73e-6 m. The
solver budget is now the largest single term from about one period on; revision 1 had 3.97e-7 m
for it (8u, phase only).

### 6.6 Evaluated (N = 10 periods, derived budgets)

How obtained: each entry is the §6.3/§6.4 formula with the §4 row and Δt = 10T (L = 10T + 1/n),
u = 2⁻⁵³; δt_res, δt_g, δt_A from their two-coefficient forms (not from the equivalent
coefficients).

| Case | P_b (m) | V_b (m/s) | P_E(10T) (m) | V_E (m/s) | P_A (m) | V_A (m/s) | P_E(0) (m) | V_E(0) (m/s) |
|---|---|---|---|---|---|---|---|---|
| C1/C2 | 1.010e-7 | 1.466e-10 | 4.732e-6 | 7.388e-9 | 1.773e-6 | 1.904e-9 | 1.418e-7 | 2.023e-10 |
| C3 | 2.228e-7 | 2.081e-10 | 1.434e-5 | 2.263e-8 | 4.791e-6 | 4.412e-9 | 4.765e-7 | 6.091e-10 |
| C4 | 3.151e-7 | 2.362e-10 | 2.199e-5 | 3.324e-8 | 7.424e-6 | 6.284e-9 | 7.614e-7 | 9.280e-10 |
| C5 | 1.538e-6 | 5.169e-10 | 1.344e-4 | 2.088e-7 | 5.945e-5 | 4.944e-8 | 5.084e-6 | 6.688e-9 |
| C6 | 6.062e-7 | 5.985e-11 | 2.839e-5 | 3.016e-9 | 1.064e-5 | 7.772e-10 | 8.510e-7 | 8.260e-11 |

Revision 1 → 2, P_E(10T): C1 1.91e-6 → 4.73e-6 m; C5 5.96e-5 → 1.34e-4 m. V_E(10T): C1 2.10e-9 →
7.39e-9 m/s; C5 5.06e-8 → 2.09e-7 m/s (the velocity grows more because of the off-orbit factor
2(1 + e), absent in revision 1).

### 6.7 Break-even analysis (review B1)

For each family, ε* is the solver residual (as an equivalent coefficient, δt_res = ε* u L at each
Δt) at which a **correct engine alone** — the engine's unmargined bound with every other engine
term at its derived value, reference and test-evaluation errors set to zero — reaches the whole
margined tolerance (evaluated with the derived budget). The effective margin is ε*/ε_t. Because the
tolerance is M × (engine terms + other terms), ε* = ε_t + (M − 1)(engine terms at ε_t)/slope +
M(other terms)/slope ≥ M ε_t: the effective margin is never below M = 4, by construction. The
table shows how far above 4 it is. Δt = 10T except VT-14/VT-15 (C1 m = T, t = 10T; C4 m = T,
ratio taken against ε_t at Δt = T).

| Family | C1/C2 (ε_t 24.8u) | C3 (44.7u) | C4 (51.4u) | C5 (74.6u) | C6 (24.8u) |
|---|---|---|---|---|---|
| VT-05 vs L2a, r | 239u (×9.7) | 367u (×8.2) | 420u (×8.2) | 747u (×10.0) | 239u (×9.7) |
| VT-05 vs L2a, v | 210u (×8.5) | 305u (×6.8) | 341u (×6.6) | 523u (×7.0) | 210u (×8.5) |
| VT-06 energy | 156u (×6.3) | 235u (×5.3) | 262u (×5.1) | 354u (×4.8) | 156u (×6.3) |
| VT-07 ang. momentum | 156u (×6.3) | 235u (×5.2) | 261u (×5.1) | 353u (×4.7) | 156u (×6.3) |
| VT-08 closure, r | 224u (×9.0) | 349u (×7.8) | 401u (×7.8) | 722u (×9.7) | 224u (×9.0) |
| VT-08 closure, v | 200u (×8.1) | 297u (×6.6) | 333u (×6.5) | 515u (×6.9) | 200u (×8.1) |
| VT-09 fallback, r | 134u (×5.4) | 214u (×4.8) | 242u (×4.7) | 336u (×4.5) | 134u (×5.4) |
| VT-09 fallback, v | 140u (×5.7) | 222u (×5.0) | 249u (×4.8) | 343u (×4.6) | 140u (×5.7) |
| L3 Orekit, r | 549u (×22.2) | 861u (×19.3) | 982u (×19.1) | 1625u (×21.8) | 549u (×22.2) |
| VT-15 a⁺ (C4 only) | — | — | 303u (×5.5) | — | — |

(VT-14 is evaluated at C1 only, §7; its break-even is in that section.) Reading: an engine whose
true residual is up to ε* still passes when every other term is at its worst case; one whose
residual exceeds ε* can fail even if otherwise correct. The derived budget lies at least a factor
4.5 below every break-even value. For comparison, revision 1 (ε_t = 8u assumed) had break-even
values of 52–62u for VT-06/07 (review), i.e. the 8u assumption left a factor 6.5–7.8 — but an
engine at the derived floor (≈ 12–36u evaluation noise alone) would already have used most of it.
This table is arithmetic on the formulas; it is not a measurement of any engine.

**Assumption of this table (revision 3).** The break-even values assume the textbook g (formed
from the requested Δt, §6.1 item 4), through which the solver residual enters VT-06 and VT-07 as
an off-orbit term. For an engine that forms g consistently with χ̂, the residual is a pure phase
error: it does not enter VT-06/VT-07 at first order (their break-even becomes unbounded), and it
enters VT-05/VT-08 only through the phase term v_p δt_res. VT-06/VT-07 then give no control on
the solver residual, and the O-1 residual check (§12) is the only control on it. The tolerances
are unchanged in that case (they remain valid upper bounds, §6.1 scope).

### 6.8 Hyperbolic arcs (VT-16; revision 4, P-3)

This section carries out the method §6.1 and §7 VT-16 already prescribe ("the same componentwise
sum evaluated on the reference arc"); it introduces no new kind of term. Every quantity is taken
from the **reference** post-maneuver state (r₀, v₀) and arc (§4.1 item 2).

**Parametrisation.** For E > 0 write \|a\| = μ/(2E), e from h and E, p = h²/μ, n_h = √(μ/\|a\|³),
σ₀ = r₀·v₀/√μ, cosh F₀ = (1 + r₀/\|a\|)/e, sinh F₀ = σ₀/(√\|a\| e), and at a sample Δt the change of
hyperbolic anomaly x = F − F₀ ≥ 0 from e sinh F − F = e sinh F₀ − F₀ + n_h Δt. With χ = √\|a\| x and
ψ = αχ² = −x², C = (cosh x − 1)/x², S = (sinh x − x)/x³, the three terms of √μ t(χ) (§6.1) are,
in units of \|a\|^(3/2) (dividing by √μ turns them into seconds × n_h):

    t1 = e sinh F₀ (cosh x − 1),   t2 = e cosh F₀ (sinh x − x),   t3 = (r₀/|a|) x,   t1 + t2 + t3 = n_h Δt

(1 − α r₀ = 1 + r₀/\|a\| = e cosh F₀ has no cancellation on a hyperbola.)

**Time-equation noise, row by row** (each row is the elliptic row of §6.1 with the bound replaced
by the actual magnitude; units u \|a\|^(3/2); q₀ = r₀v₀/√(μ\|a\|)):

| Part | Error bound (× u) | Steps (as §6.1) |
|---|---|---|
| σ₀ (data) | (3q₀ + 2e\|sinh F₀\|)(cosh x − 1) | r₀·v₀ γ_3 r₀v₀, ÷√μ 2u, times χ²C = \|a\|(cosh x − 1) |
| χ²C (in T1) | e\|sinh F₀\| [2.5x sinh x + 2 cosh x + 8(cosh x − 1)] | argument 2.5ux through d cosh/dx = sinh x; cosh c_f u **relative to cosh x**; subtraction u counted separately (as in §6.1 and the χ³S row; review B3); ÷ψ, ×χ², ×σ₀ 7u relative |
| 1 − α r₀ (data) | (4r₀/\|a\| + e cosh F₀)(sinh x − x) | r̂₀ 3u and product u on r₀/\|a\|, addition u; times \|χ³S\| |
| χ³S (in T2) | e cosh F₀ [2.5x(cosh x − 1) + 2 sinh x + 11.5(sinh x − x)] | argument through d(sinh x − x)/dx; sinh c_f u relative to sinh x; subtraction u; 10.5u for ψ^(3/2), χ³, ÷, ×c₂ |
| r₀χ (T3) | 4(r₀/\|a\|) x | r̂₀ 3u, product u |
| Two additions | 2(\|t1\| + \|t2\| + \|t3\|) | u × Σ\|terms\| each |
| Right-hand side | 2 n_h Δt | √μ and product |

    S_eval(Δt) = sum of the rows;   δt_eval = u S_eval / n_h
    ε_t,gen(Δt) = u [ 2 S_eval + (r/|a|) x ] / n_h          (§6.1: twice the noise plus the spacing term (dt/dχ) u χ = u (r/|a|) x / n_h)
    δt_g,gen(Δt) = u [ 2.5x(cosh x − 1) + 2 sinh x + 12.5(sinh x − x) ] / n_h      (§6.1 g-formation, same steps)

**Phase terms.** Mean-motion sensitivity: n_h ∝ \|a\|^(−3/2) and \|δα/α\| ≤ 5u(4\|a\|/r₀ + 1) =
5uκ_E(r₀), so the position error along the orbit is ≤ (15/2)κ_E u v_max Δt, as in §6.1. Argument
formation: a shift 2.5ux of x moves the state along the orbit by the time dt/dF·2.5ux with
dt/dF = r/(\|a\| n_h) (from dM/dF = e cosh F − 1 = r/\|a\|). Time formation u Δt. Together, as a
time:

    δt_ph(Δt) = u [ (15/2) κ_E Δt + Δt + 2.5 x r_max / (|a| n_h) ]

(No 1/n term as in L = Δt + 1/n: x is used directly, so no elliptic bound X ≤ nΔt + 2e is needed.)

**Bounded term.** §6.2 applied without the ellipse bounds, as §7 VT-16 prescribes:
\|f\|r₀ + \|g\|v₀ + r_max ≤ K_b := r₀(1 + 2r_max/p) + r_max/cos φ₀ + r_max, and
\|ḟ\|r₀ + \|ġ\|v₀ + v_max ≤ K_bv := 2v_max + 2(1 + 2r₀/p)v₀ (A5: \|f\| ≤ 1 + 2r/p, \|ġ\| ≤ 1 + 2r₀/p,
\|g\|v₀ ≤ r/cos φ₀, \|ḟ\|r₀ ≤ v + \|ġ\|v₀). **Recount of C_b for cosh and sinh:** the hyperbolic
functions have errors relative to cosh x and sinh x, not absolute. ḟ = √μχ(ψS − 1)/(rr₀) with
ψS − 1 = −sinh x/x: ψS has absolute error ≤ (2 sinh x/x + 4(sinh x − x)/x)u ≤ 6u\|ψS − 1\|, plus
subtraction u, χ u, √μ 2u, ÷(rr₀) 8u: ≤ 18u relative; with γ_2 for the combination ≤ 20u: C_b = 20
holds. In f = 1 − χ²C/r₀ and ġ = 1 − χ²C/r, the cosh error 2u cosh x·\|a\|/r₀ (resp. /r) exceeds
the relative budget by 2u\|a\|/r₀ (resp. 2u\|a\|/r), which does not grow with x; it is added
explicitly: 2u\|a\| in position (× r₀) and 2u\|a\|v₀/r_min in velocity (× v₀).

**The 10κ_E·a substitution (conformance run 2 §5 item 4).** In §6.2 the term 10uκ_E a is the
radial effect of the α data error: \|δa/a\| ≤ 5uκ_E changes the size of the conic, and a change of
size by the factor (1 + δ) at fixed shape moves a point at radius r by rδ. On an ellipse r ≤ r_a ≤ 2a,
so 2a·5uκ_E = 10uκ_E a bounds rδ everywhere on the orbit. On a hyperbola r is unbounded and \|a\|
does not bound it (on the grid arcs r_max/\|a\| reaches 10.5), so \|a\| is **not** a valid replacement.
The bound of the same argument is r_max·5uκ_E; the factor 2 of the elliptic coefficient (which
there also covers the accompanying change of shape) is kept: **10uκ_E·r_max**, with r_max the
largest radius on the propagated arc (r is monotonic on each branch, so r_max = max(r₀, r(end))).
This is never smaller than the elliptic term would be at the same r_max (10κ_E a ≥ 5κ_E r_a), and
it is larger than the \|a\| form on every grid arc (both listed in the table below; P_b,gen is
1.2 to 2.3 times the \|a\| form). The velocity term 5uκ_E v_p becomes 5uκ_E v_max: from v² = μ(2/r + 1/\|a\|),
\|δv\| = (μ/(2\|a\|v²))v\|δa/a\| ≤ (v/2)\|δa/a\| ≤ 2.5uκ_E v, so 5uκ_E v_max is a bound.

**Conditioning factors on the arc.** r_min = \|a\|(e − 1) if the periapsis is passed within the
arc, else min(r₀, r(end)); v_max = √(μ(2/r_min + 1/\|a\|)), g_max = μ/r_min², κ_E = 1 + 4\|a\|/r_min
(§7 VT-16: the maximum over the arc of (v²/2 + μ/r)/E).

**Engine bound on a hyperbolic arc (unmargined).**

    P_b,gen = u [ 20 K_b + 10 κ_E r_max + 2|a| ]          V_b,gen = u [ 20 K_bv + 5 κ_E v_max + 2|a| v₀ / r_min ]
    P_E,gen(Δt) = P_b,gen + v_max [ δt_ph + 2 ε_t,gen + δt_g,gen ]
    V_E,gen(Δt) = V_b,gen + g_max [ δt_ph + ε_t,gen ] + (2 v_max² / r_min)(ε_t,gen + δt_g,gen)

(position: phase plus the off-orbit displacement along v₀ of §6.1 item 4; velocity: phase plus the
off-orbit factor 2v·v/r of §6.1 item 4 with v_p → v_max, r_p → r_min). All terms are
non-decreasing in Δt with the arc-wide factors, so the largest value of an arc is at its last
sample.

**Scope.** ε_t,gen assumes that the engine's solver ends at the noise level on hyperbolic arcs as
well. The O-1 acceptance check was run for e < 1 only (conformance run 1), and its α term δt_α
(§6.1) is derived for ellipses only; for hyperbolic arcs this assumption is **not verified**
(open item O-12, §12). The arc must satisfy the validity condition of §7 VT-16. **Revision 5:** the
assumption is tested by the extended O-1 check defined at the end of this section; the hyperbolic
state rows are asserted only under §4.1 item 6.

**Evaluated** (u = 2⁻⁵³, M = 4; post-maneuver state from the reference side: the L2 request's
initial state and RSW maneuver at t = 0, or Orekit's event state for the maneuver at t = 5000 s;
values at the last sample, which is the largest):

| Arc (dataset) | E/(v²/2 + μ/r) | \|a\| (m) | e | r_min, r_max (m) | κ_E | x(end) | P_b,gen (m) [\|a\| form] | ε_t,gen (s) | M·P_E,gen (m) | M·V_E,gen (m/s) |
|---|---|---|---|---|---|---|---|---|---|---|
| L2 `vt-16/c3-midrun-escape` (Δt ≤ 4000 s) | 0.2145 | 1.0282e7 | 2.0748 | 1.105e7, 3.245e7 | 4.722 | 1.448 | 3.90e-7 [2.74e-7] | 2.50e-11 | **4.551 × 10⁻⁶** | **3.412 × 10⁻⁹** |
| L3 `l3-orekit-c3-midrun-escape` (Δt ≤ 15 000 s) | 0.2145 | 1.0282e7 | 2.0748 | 1.105e7, 1.083e8 | 4.722 | 2.530 | 1.24e-6 [7.24e-7] | 1.22e-10 | 1.904e-5 | 1.435e-8 |
| L2 `vt-16/escape-clear` (Δt ≤ 6000 s) | 0.0786 | 2.0519e7 | 1.3411 | 7.000e6, 4.239e7 | 12.725 | 1.468 | 8.88e-7 [5.79e-7] | 3.58e-11 | 1.039e-5 | 1.105e-8 |
| L3 `l3-orekit-c1-escape-prograde` (Δt ≤ 20 000 s) | 0.0786 | 2.0519e7 | 1.3411 | 7.000e6, 1.175e8 | 12.725 | 2.296 | 2.43e-6 [1.06e-6] | 1.34e-10 | 3.428e-5 | 3.833e-8 |
| L2 `vt-16/hyperbolic-inbound` (Δt ≤ 6000 s; periapsis passed) | 0.0549 | 3.0103e7 | 1.1714 | 5.159e6, 3.821e7 | 24.340 | 1.602 | 1.35e-6 [1.13e-6] | 9.06e-11 | 2.234e-5 | 4.302e-8 |
| L2 `vt-16/hyperbolic-outbound` (Δt ≤ 6000 s) | 0.0549 | 3.0103e7 | 1.1714 | 7.000e6, 4.380e7 | 18.202 | 1.049 | 1.24e-6 [9.64e-7] | 3.51e-11 | 1.269e-5 | 1.136e-8 |

(Revision 4 after review B3: the χ²C row coefficient 7 → 8 raised ε_t,gen and the end values of
the C3, inbound and outbound arcs by 0.2 % to 0.8 %; escape-clear and L3 C1 depart from periapsis,
sinh F₀ = 0, so the row vanishes and their values are unchanged.) The first sample of each arc
(Δt = 60 s for L2, 1000 s for L3) has M·P_E,gen 1.603e-6 m (L2 C3), 5.580e-6 m (L3 C3), 3.607e-6 m
(escape-clear), 1.083e-5 m (L3 C1), 5.628e-6 m (inbound), 5.163e-6 m (outbound) (unchanged by B3
at four digits). **Per-sample convention (review N4):** every per-sample value uses the
**arc-wide** factors — r_max, r_min, v_max, g_max and κ_E taken over the whole propagated arc
[m, D] — with only x, r(t), Δt and the Δt-dependent terms varying per sample; part D2 evaluates
the per-sample tolerances with the same convention, and they are committed with the new dataset
versions (§4.1 items 1 and 5). How these engine bounds enter the comparison tolerances: §7 VT-16 (L2b) and §9.3.1
(L3). Excluded: `just-unbound` (E/(v²/2 + μ/r) = 10⁻³) and `exactly-parabolic` (near-parabolic,
warnings only); `at-end-escape` (the hyperbolic segment is the single event sample, exact by R8).

#### α data error and extended O-1 check on hyperbolic arcs (revision 5; O-12)

This subsection does for E > 0 what §6.1 (revision 3, review F2) did for ellipses; it introduces no
new kind of term and changes no propagation tolerance (δt_α is already budgeted in the phase term
δt_ph as the mean-motion sensitivity; it enters the O-1 check threshold only).

**∂F/∂α on a hyperbola.** The §6.1 expression is unchanged:
∂F/∂α = σ₀χ⁴C′(ψ) − r₀χ³S(ψ) + (1 − αr₀)χ⁵S′(ψ). With α = −1/\|a\|, ψ = −x², χ = √\|a\| x,
σ₀ = √\|a\| e sinh F₀, r₀ = \|a\|(e cosh F₀ − 1), 1 − αr₀ = e cosh F₀, and C = (cosh x − 1)/x²,
S = (sinh x − x)/x³, the derivatives with respect to ψ (dψ = −2x dx) are

    C′(ψ) = −sinh x/(2x³) + (cosh x − 1)/x⁴,     S′(ψ) = −(cosh x − 1)/(2x⁴) + 3(sinh x − x)/(2x⁵)

(the analytic continuation x → ix of the elliptic C′, S′ of §6.1). Substituting:

    ∂F/∂α = |a|^(5/2) { e sinh F₀ [(cosh x − 1) − x sinh x/2] + (sinh x − x)
                         + (e cosh F₀/2) [(sinh x − x) − x(cosh x − 1)] }

**Check of the closed form (not used to set any value).** A central finite difference of F(χ; α) at
fixed χ, σ₀, r₀ agrees with it to better than 10⁻³⁶ relative at three samples of each of the six
VT-16 arcs (decimal script, 60 digits) and to better than 10⁻¹² in the committed 320-bit test
(`verification/src/hp/o1-check-hyp.test.ts`, which compares with a binary64 evaluation of the
closed form).

**Magnitude bound.** Each of the five elementary terms is bounded by its magnitude, as §6.1 bounds
the elliptic brackets term by term (no cancellation between terms is assumed), with X = \|x\|:

    |∂F/∂α| ≤ |a|^(5/2) D(X),
    D(X) = e |sinh F₀| [(cosh X − 1) + X sinh X/2] + (sinh X − X) + (e cosh F₀/2) [(sinh X − X) + X(cosh X − 1)]

**α data error.** As §6.1 item 2, \|δα\| ≤ γ_5(2/r₀ + v₀²/μ); on a hyperbola
2/r₀ + v₀²/μ = 4/r₀ + 1/\|a\| = κ_E(r₀)/\|a\| with **κ_E(r₀) = 1 + 4\|a\|/r₀** of the exact input state
(≤ the arc-wide κ_E of §6.8, which may replace it). Dividing by √μ (\|a\|^(3/2)/√μ = 1/n_h):

    δt_α,hyp(Δt) = 5u κ_E(r₀) D(x(Δt)) / n_h

with x(Δt) from the reference arc (§6.8 "Parametrisation"). First order in δα (relative ≤ 5uκ_E,
below 10⁻¹⁴ on every arc), as in §6.1. Consistency: for small x, D ≈ e\|sinh F₀\| x² + x³/6 +
(e cosh F₀/3) x³, the term-by-term magnitudes of the leading terms of the elliptic expression of
§6.1 at the same x (sin, cos of the anomalies replaced by sinh, cosh).

**Extended O-1 acceptance check (definition).** For an input state (r₀, v₀) with E > 0 inside the
§7 VT-16 validity gate (E/(v₀²/2 + μ/r₀) ≥ 0.05) and a sample Δt > 0, put the engine's χ̂ (the
public diagnostic `universalAnomaly_sqrtm` of `propagateKeplerUniversal`, as in conformance run 1)
into the universal time equation evaluated **entirely in high precision** (320 bits) with α, σ₀
and r₀ also formed in high precision from the exact binary64 inputs (§6.1, §12 O-1 route (1)). The
check passes when

    |t(χ̂) − Δt| ≤ ε_t,gen(Δt) + δt_α,hyp(Δt)

with ε_t,gen of this section (revision 4, unchanged) and δt_α,hyp above, both evaluated on the
reference arc of the exact input state (arc-wide convention N4). **No margin factor**, as for the
elliptic threshold ε_t + δt_α: ε_t,gen is already a worst-case budget (twice the evaluation noise
plus the spacing term). Δt = 0 is excluded (the sample at Δt = 0 is the event state, exact by R8
and contracts §5.2), and so is Δt < 0 (§6.8 is written for x ≥ 0; the runner never propagates
backwards). The thresholds are committed per sample in `test-data/reference-cases/o1-hyp-r5`
(§4.1 item 1). **Cases:**

- the six VT-16 hyperbolic arcs, every sample with Δt > 0 (402 samples): the four L2 arcs of
  `vt-16-r4` from their reference post-maneuver state (`outputs.startState`), and the two L3 arcs
  from Orekit's own event state (`test-data/l3-orekit/vt-16`, Δt of Orekit's segment 1);
- a deterministic grid of 96 cases: \|a\| ∈ {7.0 × 10⁶, 3.0 × 10⁷} m, e ∈ {1.25, 1.5, 2.5, 5},
  start anomaly F₀ ∈ {−1, 0, 1} (inbound, at periapsis, outbound), one span per case with
  n_h Δt ∈ {0.05, 0.5, 5, 20}; i, Ω, ω fixed per e index ((0.4, 0.7, 4.4), (1.1, 3.3, 0.2),
  (2.0, 5.1, 2.6), (2.9, 1.9, 5.8) rad); the start state is formed in binary64 from these elements
  and that binary64 state is the input;
- a near-gate supplement of 48 cases (review N1: the 96-case grid did not reach the region of the
  L2 inbound/outbound arcs, e 1.17, κ_E(r₀) 18.2, gate ratio 0.0549): the same \|a\| and spans, and
  (i) e ∈ {1.1, 1.17} starting at r₀/\|a\| = 0.22, i.e. gate ratio 1/(1 + 4/0.22) ≈ 0.0521 and
  κ_E(r₀) ≈ 19.18, inbound and outbound (F₀ = ∓acosh(1.22/e)), (ii) e = 1.1 with F₀ = ±1; (i, Ω, ω)
  = (0.9, 2.2, 3.7), (1.6, 4.6, 1.3), (2.4, 0.3, 5.2) rad for the three start families.

  All 144 grid starts lie inside the gate (ratios 0.0521 to 0.63); κ_E(r₀) from 1.60 to 19.18.

The engine-side input is the reference-side state, not the engine's event state: the O-1 check
concerns the solver for a given input, so its input need not come from the engine (§4.1 item 2).
**Pass criterion:** every sample of every case passes; the result is reported as the largest ratio
\|t(χ̂) − Δt\|/(ε_t,gen + δt_α,hyp). A failure keeps O-12 open as a finding and the hyperbolic state
rows informative (§4.1 item 6 (c)).

**Reference validation (before any engine run; `o1-check-hyp.test.ts`).** At the correctly rounded
root χ* = √\|a\|(F − F₀), taken from the independent 200-bit hyperbolic-anomaly propagation
(`ref/hyperbolic.ts`), the 320-bit residual is within the representation spacing
(r/√μ)·u·\|χ*\| on all 546 samples (402 arc samples, 144 grid cases), hence within the threshold;
and χ*(1 + 10⁻⁹) fails the threshold on all 546 samples (detection power).

**Evaluated** (u = 2⁻⁵³; last sample of each arc, which carries the largest threshold of the arc;
printed to four digits, the dataset values govern):

| Arc (input state) | κ_E(r₀) | Δt (s) | x | ε_t,gen (s) | δt_α,hyp (s) | threshold (s) |
|---|---|---|---|---|---|---|
| L2 `vt-16-r4/escape-clear` | 12.725 | 6000 | 1.468 | 3.579e-11 | 7.392e-11 | **1.097e-10** |
| L2 `vt-16-r4/hyperbolic-inbound` | 18.202 | 6000 | 1.602 | 9.062e-11 | 3.474e-10 | **4.380e-10** |
| L2 `vt-16-r4/hyperbolic-outbound` | 18.202 | 6000 | 1.049 | 3.507e-11 | 1.003e-10 | **1.354e-10** |
| L2 `vt-16-r4/c3-midrun-escape` | 4.662 | 4000 | 1.448 | 2.496e-11 | 1.610e-11 | **4.105e-11** |
| L3 `c1-escape-prograde` (Orekit event state) | 12.725 | 20 000 | 2.296 | 1.336e-10 | 3.472e-10 | **4.808e-10** |
| L3 `c3-midrun-escape` (Orekit event state) | 4.662 | 15 000 | 2.530 | 1.224e-10 | 1.078e-10 | **2.301e-10** |

Over all cases the threshold is 1.00003 to 6.45 times ε_t,gen at the last sample (the α term
dominates at large κ_E(r₀), as δt_α does at high e in §6.1). Grid thresholds range from
1.14 × 10⁻¹³ s (n_h Δt = 0.05) to 2.71 × 10⁻⁸ s (n_h Δt = 20); the near-gate supplement alone
5.24 × 10⁻¹³ s to 2.71 × 10⁻⁸ s (before review N1 the grid maximum was 2.25 × 10⁻⁸ s and the
largest ratio to ε_t,gen 5.16; no value of the first 96 cases changed). ε_t,gen at the last sample reproduces
the §6.8 table (2.50e-11, 1.22e-10, 3.58e-11, 1.34e-10, 9.06e-11, 3.51e-11 s).

## 7. Per-family records

Format: **Quantity** · **Measure** · **Error model** · **Reference accuracy** · **Tolerance**
(formula, then evaluated) · **Margin** · **Layers** · **Detection power**.

### VT-01 Vector/matrix utilities (L1)

- Quantities: (a) \|a·(a × b)\| and \|b·(a × b)\|; (b) a·(b × c) − b·(c × a); (c) ‖x‖ vs the test's
  own ‖x‖; (d) ‖x/‖x‖‖ − 1; plus the exact identities of §1.
- Measure: normalised by the natural scale (Hadamard: \|det\| ≤ product of norms), because the exact
  value is 0 or the comparison is of two roundings of one quantity. Relative to a computed value
  near 0 would be meaningless.
- Error model: (a) exact value 0; computed cross product error ≤ 3u‖a‖‖b‖ (B5), dot product γ_3
  (B3) with ‖a × b‖ ≤ ‖a‖‖b‖: \|computed\| ≤ (√2·2 + 3)u ‖a‖²‖b‖ = 5.83u ‖a‖²‖b‖. (b) two triple
  products, each ≤ 5.83u ‖a‖‖b‖‖c‖. (c) two norms, each ≤ 3u (B4) — the measure is
  \|‖x‖_E − ‖x‖_T\|/‖x‖_T. (d) normalisation 4u (B6) + test norm 3u = 7u.
- Reference: L1 identity (exact) or the test's own evaluation (counted above).
- Tolerance: (a) 4 × 5.83u = **23.3u ≈ 2.6 × 10⁻¹⁵** × ‖a‖²‖b‖; (b) 4 × 11.66u = **46.6u ≈ 5.2 ×
  10⁻¹⁵** × ‖a‖‖b‖‖c‖; (c) 4 × 6u = **24u ≈ 2.7 × 10⁻¹⁵** relative; (d) 4 × 7u = **28u ≈ 3.1 ×
  10⁻¹⁵**.
- Margin: M = 4 (§3).
- Layers: L1 only.
- Detection power: any wrong sign or index in a cross product gives O(1) errors.

### VT-02 Elements → Cartesian (L2c, L3)

- Quantity: position and velocity vectors from (a, e, i, Ω, ω, ν) vs the L2c reference.
- Measure: ‖Δr‖ (m) and ‖Δv‖ (m/s), absolute on the norm of the difference with thresholds
  proportional to r_a and v_p (normwise relative). Componentwise relative measures are rejected:
  components can be zero (equatorial z, angles at 0, π).
- Error model (canonical perifocal formulation, r = p/(1 + e cos ν)(cos ν P + sin ν Q),
  v = √(μ/p)(−sin ν P + (e + cos ν) Q), P, Q columns of R₃(Ω)R₁(i)R₃(ω)):
  - Rotation-matrix entry: ≤ 2 products of ≤ 3 sines/cosines; error ≤ (3c_f + 3)u = 9u absolute,
    because Σ\|products\| ≤ 1 for each entry (Cauchy–Schwarz on the trigonometric terms).
  - Direction w = cos ν P + sin ν Q: ‖ŵ − w‖ ≤ √2·√3·9u + 2c_f u + √2·2u = 22.05u + 4u + 2.83u
    = 28.9u.
  - Scalar r: p = a(1 − e²) relative error ≤ 2u/(1 − e²) (cancellation in 1 − e², factor
    e²/(1 − e²), plus products); denominator 1 + e cos ν relative error ≤ (1 + 3e)u/(1 − e)
    (cancellation near apoapsis, with c_f = 2); division u, final scaling u.
  - Position, normwise relative: **η_r(e) = u[31 + 2/(1 − e²) + (1 + 3e)/(1 − e)]**
    (31 = 28.9 + 2, rounded).
  - Velocity, relative to v_p: √6·9u (rotation) + 7u/(1 + e) (trigonometric and sums, scaled by
    v_p = (1 + e)√(μ/p)) + 1u/(1 − e²) + 2u (square root of μ/p): **η_v(e) = u[25 + 1/(1 − e²) +
    7/(1 + e)]**.
- Reference accuracy (L2c): the same formulation evaluated by explicit matrix product (different
  evaluation path) has the same bounds; L2c is validated first by its own orthogonality check
  (§9). Independence note: L2c and the engine may implement the same textbook map; algorithmic
  independence is partial for this family and rests on L3 (open item O-7).
- Tolerance: ‖Δr‖ ≤ M · 2η_r(e) · r_a, ‖Δv‖ ≤ M · 2η_v(e) · v_p (factor 2: engine + reference).
  Evaluated: C1 r: 4·2·34u·7e6 = 272 × 7.7716e-10 = **2.11 × 10⁻⁷ m**; v: 4·2·33u·7546 = 264 ×
  8.3777e-13 = **2.21 × 10⁻¹⁰ m/s**. C3 4.15e-7 m / 2.41e-10 m/s; C4 5.53e-7 m / 2.44e-10 m/s;
  C5 **1.92 × 10⁻⁶ m / 2.81 × 10⁻¹⁰ m/s**; C6 1.27e-6 m / 9.03e-11 m/s.
- L3 (textbook): see §9.4 (print-resolution tolerance, convention check only).
- Margin: M = 4.
- Detection power: a wrong rotation order or sign changes the state by O(r); a μ error of
  relative size δ changes v by δ/2 — detected for δ ≳ 6 × 10⁻¹⁴.

### VT-03 Round trip state → elements → state (L1)

- Quantity: state after state→elements→state vs the original state (exact input).
- Measure: as VT-02 (‖Δr‖/r_a, ‖Δv‖/v_p).
- Error model (atan2-based extraction, B8; e-vector form
  e = [(v² − μ/r) r − (r·v) v]/μ):
  - e-vector absolute error (dimensionless): terms of size ≤ 2, 1, 2 (vis-viva), about 6
    roundings: ≤ 30u.
  - a from energy: 5uκ_E relative (§6.1).
  - Radius sensitivity to e: \|∂ ln r/∂e\| ≤ 3/(1 − e), times 30u: 90u/(1 − e).
  - **Angles (derived in revision 2; review N2).** The reconstructed position direction depends on
    the orbit plane (i, Ω) and the in-plane angle Ω + ω + ν (through R₃(Ω)R₁(i)R₃(ω + ν)).
    (i) Plane: h = r × v has error ≤ 3u r v (B5), direction error ≤ 2·3uκ_h (B6) = 6uκ_h; this
    bounds the combined effect of the inputs of i and sin i·Ω. (ii) atan2 rounding of i and Ω:
    c_f π u = 6.3u each; formation of √(h_x² + h_y²): 2.8u (√2 × 2u, B8). (iii) In-plane angle
    from the node: inputs n̂ (normalisation 4u), ĥ (4u), ĥ × n̂ (3u), two dot products (3u):
    normwise 14u, angle √2 × 14u = 19.8u, plus atan2 6.3u. (iv) ω and ν are measured from the same
    computed e-vector direction, so its error (30u/e) cancels exactly in ω + ν to first order;
    what remains is the atan2 rounding of ω (6.3u) and the rounding of the sum (≤ 2π u = 6.3u).
    The node-direction error cancels the same way in Ω + (ω + ν) at small i. Total direction error
    ≤ (6κ_h + 6.3 + 2.8 + 6.3 + 26.1 + 12.6)u ≤ **(6κ_h + 55)u** (revision 1: 50u, not derived).
  - Back conversion: η_r(e), η_v(e) of VT-02.
  - **B_rt(e) = 5κ_E + 90/(1 − e) + (6κ_h + 55) + 31 + 2/(1 − e²) + (1 + 3e)/(1 − e)**;
    **B_vt(e) = 2.5κ_E + 90/(1 − e) + (6κ_h + 55) + 25 + 1/(1 − e²) + 7/(1 + e)**.
- Reference accuracy: L1, the original state, exact (no reference error).
- Tolerance: ‖Δr‖ ≤ M B_rt u r_a, ‖Δv‖ ≤ M B_vt u v_p. Evaluated: C1/C2: B_rt = 200.0,
  B_vt = 191.5: r 4·200 × 7.7716e-10 = **6.22 × 10⁻⁷ m**, v 4·191.5 × 8.3777e-13 = **6.42 × 10⁻¹⁰
  m/s**; C3 1.44e-6 m / 8.91e-10; C4 2.07e-6 m / 1.00e-9; C5 (B_rt = 529.8, B_vt = 477.3)
  **1.06 × 10⁻⁵ m / 2.15 × 10⁻⁹ m/s**; C6 3.73e-6 m / 2.62e-10. (Revision 1: C1 5.88e-7 m.)
- Margin: M = 4.
- **Expectation flag:** an extraction using acos near ±1 (common in textbook RV2COE-type
  algorithms) loses half the digits (B8): angle errors ≈ √(2·6u) ≈ 3.6 × 10⁻⁸ rad, ≈ 0.25 m at
  7 × 10⁶ m. That fails this tolerance by design and is treated as a defect signal (plan §4), not as
  a reason to loosen it (§11, open item O-2).
- Detection power: a quadrant error in Ω, ω or ν gives O(r) errors.

### VT-04 Degenerate elements (L1, L2)

- Quantities: (i) the convention applied (architecture §3: circular ω := 0, ν := argument of
  latitude; equatorial Ω := 0, ω := longitude of periapsis; both ν := true longitude) — a
  discrete check against the thresholds of §10; (ii) state round trip as VT-03.
- Assumptions stated for the bounds: the longitude of periapsis is ϖ = Ω + ω for prograde and
  ω − Ω for retrograde near-equatorial orbits (the combination that leaves R₃(Ω)R₁(i)R₃(ω)
  unchanged at i' = 0); e and i are **kept as computed** below the thresholds (open item O-3,
  recommended resolution). With other definitions the convention term below does not apply.
- (a) **Exactly degenerate inputs** (e = 0 and/or i ∈ {0, `Math.PI`}). The computed e of an exact
  circular state is not 0 but ê ≤ 30u (e-vector noise); the computed i' of i = 0 is exactly 0
  (h_x = h_y = 0 exactly), of i = `Math.PI` it is ≤ (6κ_h + 2)u (input out-of-plane component of
  order 2⁻⁵² r plus direction error). Tolerance: VT-03 formula plus the convention term of (b)
  at e = ê, i' = î': ‖Δr‖ ≤ M B_rt u r_a + r_a(2ê/(1 − ê) + 4 sin(î'/2)); velocity analogous.
  Velocity: ‖Δv‖ ≤ M B_vt u v_p + v_p(2√2ê/(1 + ê) + 4 sin(î′/2)). At C1/C2 (i = `Math.PI`,
  κ_h = 1): 6.22e-7 m + 4.7e-8 m (e term) + 1.3e-8 m (i term) = **6.8 × 10⁻⁷ m**; velocity
  6.42e-10 + 7.1e-11 + 1.3e-11 = **7.3 × 10⁻¹⁰ m/s**.
- (b) **Near-degenerate inputs below a threshold** (0 < e < ε_e, or 0 < i' < ε_i). Applying the
  convention moves the reconstructed state by a non-numerical amount. **Exact bounds (revision 2;
  review N3)**, not first order:
  - e kept, ω := 0, ν := u_lat: the direction of r is unchanged; the radius changes from
    p/(1 + e cos ν) to p/(1 + e cos u_lat): \|Δr\| = p e\|cos ν − cos u_lat\|/((1 + e cos ν)(1 + e
    cos u_lat)) ≤ **2e r_a/(1 − e)**. Velocity: radial and transverse components
    √(μ/p) e sin(·) and √(μ/p)(1 + e cos(·)) change by ≤ 2e√(μ/p) each:
    ‖Δv‖ ≤ **2√2 e v_p/(1 + e)** (√(μ/p) = v_p/(1 + e)).
  - i kept, Ω := 0, ω := ϖ: the rotation changes from R₃(Ω)R₁(i)R₃(ω) to R₁(i)R₃(Ω + ω);
    the difference R₃(Ω)R₁(i) − R₁(i)R₃(Ω) = R₃(Ω)(R₁(i) − I) − (R₁(i) − I)R₃(Ω) has 2-norm
    ≤ 2‖R₁(i) − I‖₂ = **4 sin(i'/2)** (eigenvalues of R₁(i) − I: 0 and e^{±ii} − 1); exact.
    Position ≤ 4 sin(i'/2) r_a, velocity ≤ 4 sin(i'/2) v_p.
  - (For comparison, if e were zeroed instead: \|Δr\| = \|r − a\| ≤ a e and ‖Δv‖ ≤
    √(μ/a)·√(e²/(1 − e²) + (√((1 + e)/(1 − e)) − 1)²) ≈ √2 e √(μ/a); about half the "keep" values.)
  Tolerance: ‖Δr‖ ≤ M B_rt u r_a + r_a(2e/(1 − e)·[e < ε_e] + 4 sin(i'/2)·[i' < ε_i]),
  ‖Δv‖ ≤ M B_vt u v_p + v_p(2√2 e/(1 + e)·[e < ε_e] + 4 sin(i'/2)·[i' < ε_i]).
  The convention term has no margin (it is a bound, not an estimate of rounding). At ε = 10⁻⁵ and
  C1 scale: e term **140 m** and 0.21 m/s; i term 140 m and 0.15 m/s; both up to 280 m. Whether
  FR-003 AC2 accepts this for near-degenerate cases is an owner decision (open item O-3,
  conflict C-3).
- Reference accuracy: L1 (original state, exact) for (ii); L2 reference extraction with the same
  convention for (i), compared discretely.
- Layers: L1 (round trip); L2 (reference element extraction with the same convention).
- Cases within a factor 2 of a threshold are not used (the classification may legitimately differ
  between engine and reference).

### VT-05 Circular and elliptical propagation (L2a, L2b, L3)

- Quantity: state at fractional and multi-period times vs reference.
- Measure: ‖Δr‖ (m), ‖Δv‖ (m/s), thresholds from §6 (absolute, scale-dependent).
- Error model: §6.3 (engine, derived solver budget), §6.4 (L2a).
- Reference accuracy: L2a bounded by P_A, V_A (§6.4, validated per §9.1); L2b by its measured
  E_RK (§9.2); L3 per §9.3–§9.4.
- Tolerance vs **L2a**: ‖Δr‖ ≤ M[P_E(Δt) + P_A(Δt)], ‖Δv‖ ≤ M[V_E(Δt) + V_A(Δt)].
  Evaluated at Δt = 10T: C1/C2 4·(4.732e-6 + 1.773e-6) = **2.60 × 10⁻⁵ m**, **3.72 × 10⁻⁸ m/s**;
  C3 7.65e-5 m / 1.08e-7 m/s; C4 1.18e-4 m / 1.58e-7 m/s; C5 **7.75 × 10⁻⁴ m / 1.03 × 10⁻⁶ m/s**;
  C6 1.56e-4 m / 1.52e-8 m/s. (Revision 1: C1 1.47e-5 m / 1.60e-8 m/s; C5 4.74e-4 m /
  3.98e-7 m/s.)
- Tolerance vs **L2b** (RK): ‖Δr‖ ≤ M P_E(Δt) + 2E_RK,r, ‖Δv‖ ≤ M V_E(Δt) + 2E_RK,v, where E_RK is
  the step-halving estimate of the RK reference. No numeric value yet; E_RK and the evaluated
  tolerance are committed with the dataset before the engine is run on it (§4.1); an E_RK above
  the §9.2 target is a loosening (§15). Factor 2 on E_RK: the undivided halving difference already
  over-estimates the truncation error by 2^p − 1 in the asymptotic regime; the extra factor covers
  the round-off part, which does not scale with h.
- Tolerance vs **L3**: §9.3 (Orekit), §9.4 (textbook).
- At Δt = 0 (first sample of segment 0): exact if O-10 is adopted (§1); otherwise
  ‖Δr‖ ≤ M P_E(0), ‖Δv‖ ≤ M V_E(0) against the request's `initialState`: C1 **5.7 × 10⁻⁷ m /
  8.1 × 10⁻¹⁰ m/s**; C5 2.0e-5 m / 2.7e-8 m/s.
- Post-maneuver segments: the reference starts from the engine's event state (`position_m`,
  `velocityAfter_mps`) and the same formula applies with Δt = t − m. (Starting it from an exact
  post-maneuver state would add the transport term of VT-14.)
- Margin: M = 4. Break-even: §6.7.
- Detection power (C1, 10T): a relative μ error δ shifts the along-track position by ≈ a·(δ/2)·2πN =
  2.2 × 10⁸ δ m, detected for δ > 1.2 × 10⁻¹³; a timing error δt is detected for δt > 3.5 × 10⁻⁹ s.

### VT-06 Energy conservation (L1)

- Quantity: \|E_k − E₀\|/\|E₀\| on every sample, E = v²/2 − μ/r evaluated by the test.
- Measure: relative (E₀ ≠ 0 for every closed orbit; \|E\| = μ/(2a) sets the scale).
- Error model: (i) test evaluation of E: γ_5(v²/2 + μ/r) = 5uκ_E\|E\| each, two evaluations:
  10uκ_E; (ii) bounded off-orbit state errors δE ≤ v δv + (μ/r²) δr with P_b, V_b; (iii) the
  off-orbit time-like error of §6.1 item 4 (derived; review N5): the position displacement along
  v₀ changes E by ≤ g_p v_p δt_off, the velocity change through r by ≤ v_p · 2(1 + e) g_p δt_off;
  together (3 + 2e) v_p g_p (δt_res + δt_g). Phase errors along the orbit (C_t terms, the phase
  part of δt_res) do not change E: f, g, ḟ, ġ computed from one χ give a point of the exact orbit.
- Reference accuracy: L1 — the invariant itself; the only reference-side error is the test's own
  evaluation (i).
- Engine part (unmargined, used again in VT-14/VT-15):
  τ_E,eng(Δt) = (v_p V_b + g_p P_b)/\|E\| + (3 + 2e)(v_p g_p/\|E\|)(δt_res + δt_g).
- Tolerance: τ_E(Δt) = M[10uκ_E + τ_E,eng(Δt)].
  Worked, C1, 10T: 30u = 3.33e-15; bounded 6.77e-14; off-orbit 3 × (7546 × 8.135/2.847e7) ×
  (1.630e-10 + 1.134e-10) = 1.79e-12; sum 1.86e-12; × 4 = **7.4 × 10⁻¹²**.
  C3 3.60e-11; C4 6.41e-11; C5 **9.06 × 10⁻¹⁰**; C6 7.4e-12. (Revision 1: C1 8.5e-13, C5 3.15e-11.)
- Margin: M = 4. Break-even: §6.7.
- Note: term (iii) grows linearly with Δt; it vanishes (except its bounded part) if the engine
  forms g consistently with χ̂.
- Detection power: if the engine used μ(1 + δ) instead of the request's μ, the test's E would vary
  over an orbit by δμ(1/r_p − 1/r_a), i.e. by δ·4e/(1 − e²) relative to \|E\| (= 1.9δ for C4),
  detected for δ ≳ 3.4 × 10⁻¹¹ (C4). Not sensitive for e = 0 (VT-05 covers that).

### VT-07 Angular momentum conservation (L1)

- Quantity: ‖h_k − h₀‖/‖h₀‖, h = r × v (vector, evaluated by the test).
- Measure: normwise relative to ‖h₀‖ = √(μp) > 0.
- Error model: cross products 3u r v each (B5), r v/h ≤ κ_h: 6uκ_h; bounded off-orbit errors
  δh ≤ δr v + r δv: (P_b v_p + r_a V_b)/h; off-orbit time-like (§6.1 item 4): position
  v_p · v_p δt_off, velocity r_a · 2(1 + e) g_p δt_off.
- Reference accuracy: L1 — the invariant; reference-side error is the test's cross products.
- Tolerance: τ_h(Δt) = M[6uκ_h + (P_b v_p + r_a V_b + (v_p² + 2(1 + e) r_a g_p)(δt_res + δt_g))/h].
  Evaluated (10T): C1/C2 **3.7 × 10⁻¹²**; C3 1.65e-11; C4 2.86e-11; C5 **3.8 × 10⁻¹⁰**; C6 3.7e-12.
  (Revision 1: C1 4.2e-13, C5 5.1e-12.)
- Margin: M = 4. Layers: L1. Break-even: §6.7.
- Detection power: a frame or sign error rotating the plane by θ gives ‖Δh‖/h ≈ θ; detected for
  θ > 4 × 10⁻¹² rad (C1).

### VT-08 Full-period closure (L1)

- Quantity: state at t = NT vs initial state, where T is computed by the test from the initial
  state (T = 2π√(a³/μ), a from vis-viva) and `duration_s` is set to fl(N·T) so that the end time is
  an exact sample (R10).
- Measure: ‖Δr‖, ‖Δv‖.
- Error model: engine P_E(NT), V_E(NT); plus the test's period error δT/T ≤ (3/2)(5uκ_E) + 6u
  (a³, 2π product, division, square root, N·T), which moves the comparison time by NT·δT/T.
- Reference accuracy: L1 — the input state (exact); the test's period error is counted above.
- Tolerance: ‖Δr‖ ≤ M[P_E(NT) + u(7.5κ_E + 6) v_p NT], ‖Δv‖ ≤ M[V_E(NT) + u(7.5κ_E + 6) g_p NT].
  Evaluated (N = 10): C1/C2 **2.45 × 10⁻⁵ m / 3.56 × 10⁻⁸ m/s**; C3 7.31e-5 / 1.05e-7; C4 1.13e-4 /
  1.55e-7; C5 **7.51 × 10⁻⁴ m / 1.02 × 10⁻⁶ m/s**; C6 1.47e-4 / 1.45e-8. (Revision 1: C1 1.32e-5 m.)
- Margin: M = 4. Layers: L1. Break-even: §6.7.
- Detection power: as VT-05.

### VT-09 Sampling independence (L1)

- Quantity: the same request with two output steps; states at bit-identical `t_s`.
- Measure: ‖Δr‖, ‖Δv‖.
- Error model: both runs start from the same initial state and evaluate the same Δt, so α and the
  time formation are identical. They can differ only if the root solve depends on neighbouring
  samples (e.g. a warm start from the previous sample's χ): then the two roots differ, and with
  them the argument-formation phase (4u n L at most), the solver term and the g-formation term.
- Reference accuracy: L1 — the other run of the same engine; no external reference.
- Tolerance: **exact** (`Object.is`). Revision 4: O-4 is resolved — ADR-005 (Decision) requires
  each sample to be computed directly from the segment's initial state at Δt = t − t₀, and the
  approved ML-TASK-015 contract adds "no warm start" and "no hidden state" (§1, §12). The fallback
  below is kept only for reference; it applies if that rule is ever withdrawn:
  ‖Δr‖ ≤ 2M[P_b + v_p(4uL + 2δt_res + δt_g)], ‖Δv‖ ≤ 2M[V_b + g_p(4uL + δt_res +
  2(1 + e)(δt_res + δt_g))]: C1/C2 **2.89 × 10⁻⁵ m / 4.95 × 10⁻⁸ m/s**; C3 8.74e-5 / 1.55e-7;
  C4 1.32e-4 / 2.27e-7; C5 6.64e-4 / 1.32e-6; C6 1.74e-4 / 2.02e-8 (10T).
- Post-maneuver segments: the maneuver time m is a sample of every grid (§5.2), so the event
  state is a common-time state and the same rule applies.
- Margin: M = 4. Break-even (fallback form): §6.7.

### VT-10 Determinism — exact (§1).

### VT-11 RSW basis (L1)

- Quantities: max \|(BᵀB − I)_jk\| (B = [R S W]); ‖R × S − W‖ (handedness); ‖R − r/‖r‖‖;
  ‖W − (r × v)/‖r × v‖‖, with r, v the event's `position_m` and `velocityBefore_mps` (so no
  propagation error enters).
- Measure: absolute (dimensionless; unit vectors).
- Error model: R = r/‖r‖: ε_R = 4u (B6). W: cross product error ≤ 3u r v (B5), relative to
  h = ‖r × v‖ that is ≤ 3uκ_h since r v/h = 1/cos φ ≤ κ_h on the pre-maneuver ellipse (contract §8.3:
  r × v ≠ 0 in v1.0); direction error 2 × 3uκ_h (B6) + 4u: ε_W = (6κ_h + 4)u. S = W × R:
  ε_S = ε_W + ε_R + 3u = (6κ_h + 11)u. Test evaluation of BᵀB entries: γ_3 = 3u.
- Reference accuracy: L1 identities (exact); the test's own evaluation (3u) and the test's
  r/‖r‖, (r × v)/‖r × v‖ (same budgets as ε_R, ε_W) are counted in the factor 2.
- Tolerance: orthonormality and handedness: M(2ε_S + 3u) = **4(12κ_h + 25)u**: e = 0 **1.64 ×
  10⁻¹⁴**; C5 (κ_h = 1.487) 1.90e-14. R ∥ r: M·2ε_R = 32u = 3.6e-15. W ∥ r × v: M·2ε_W =
  4(12κ_h + 8)u: e = 0 8.9e-15.
- Margin: M = 4. Layers: L1.

### VT-12 Maneuver frame transformation (L2c)

- Quantity: `deltaV_inertial_mps` vs reference Δv_I = ΔvR R + ΔvS S + ΔvW W.
- Measure: ‖ΔΔv_I‖ relative to ‖Δv_RSW‖ (normwise).
- Error model: basis errors Σε = ε_R + ε_S + ε_W = (12κ_h + 19)u; combination γ_3 with
  Σ\|Δv_k\|‖b_k‖ ≤ √3‖Δv‖: 5.2u; total (12κ_h + 24.2)u for each of engine and reference.
- Reference accuracy: L2c, same budget (12κ_h + 24.2)u, counted by the factor 2.
- Tolerance: ‖ΔΔv_I‖ ≤ M · 2 · (12κ_h + 25)u · ‖Δv_RSW‖ = **8(12κ_h + 25)u** relative: e = 0 **3.3 ×
  10⁻¹⁴** (3.3 × 10⁻¹² m/s for 100 m/s); C5 3.8e-14. Zero Δv: exact (§1).
- Margin: M = 4. Detection power: swapped or mis-signed axes give O(‖Δv‖) errors.

### VT-13 Impulsive velocity change (L1)

- Continuity and increment: **exact** (§1, R8, R12).
- `deltaV_magnitude_mps` vs the test's ‖`deltaV_inertial_mps`‖: two norms, 3u each (B4):
  **\|Δ\| ≤ M·6u‖Δv‖ = 24u ≈ 2.7 × 10⁻¹⁵ relative**. The contract defines the value as the norm of
  the inertial vector; an engine that reports ‖Δv_RSW‖ instead can differ by up to
  (12κ_h + 25)u and may fail — that would be a contract deviation, not a tolerance problem.
- Physics cross-check ‖`deltaV_inertial_mps`‖ vs ‖Δv_RSW‖ (rotation preserves norm):
  M(12κ_h + 25 + 6)u = **4(12κ_h + 31)u**: e = 0 1.9e-14.
- Reference accuracy: L1 — the test's own norm (3u, counted).
- Margin: M = 4.

### VT-14 Zero-magnitude maneuver (L1)

- Exact parts: §1 (Δv_I = ±0, v⁺ `===` v⁻).
- Quantity: maneuvered run state at t > m vs coast run at t.
- Reference accuracy: L1 — the coast run of the same engine (its error P_E(t) is counted).
- Error model: the coast run has error P_E(t). The maneuvered run starts its second segment from
  the computed state at m: (1) its phase part is a time shift carried forward,
  ≤ v_p(uC_t L_m + δt_res(m)); (2) its off-orbit part changes the energy by ≤ τ_E,eng(m)·\|E\|
  — the **engine** part of VT-06 only; revision 1 also included the test's evaluation error
  (review N4) — hence the mean motion by (3/2)τ_E,eng(m), a drift (3/2)τ_E,eng(m) v_p (t − m);
  (3) the non-secular transport of the off-orbit part P_off(m) = P_b + v_p δt_off(m),
  V_off(m) = V_b + 2(1 + e) g_p δt_off(m), bounded with factors K_r, K_v (new in revision 2);
  (4) the new segment's own error P_E(t − m).
- Transport factors: for e = 0 the Clohessy–Wiltshire (Hill) solution of the linearised relative
  motion gives non-secular coefficients whose absolute sums are ≤ 14 for an initial position
  offset and ≤ 9/n for an initial velocity offset (radial: 4 − 3cos nt, sin nt/n, 2(1 − cos nt)/n;
  along-track: 6 sin nt, 1, 2(1 − cos nt)/n, 4 sin nt/n; the secular parts −6nt x₀ and −3t ẏ₀ are
  the energy drift of (2)) — [Vallado] or [Curtis] relative-motion chapter, **to be confirmed**:
  K_r = 14, K_v = 9. For e > 0, K_r(e), K_v(e) are **not derived**; VT-14 is evaluated here at e = 0
  only, and an e > 0 case needs K(e) derived and committed before its dataset is run (§4.1,
  open item O-11).
- Tolerance: ‖Δr‖ ≤ M[P_E(t) + v_p(uC_t L_m + δt_res(m)) + P_E(t − m) + (3/2)τ_E,eng(m) v_p (t − m)
  + K_r P_off(m) + K_v V_off(m)/n]; velocity: v_p → g_p in the time-like terms, P_E → V_E,
  transport K_r V_off(m) + K_v n P_off(m).
  Evaluated, C1, m = T, t = 10T (τ_E,eng(T) = 2.55 × 10⁻¹³): **6.8 × 10⁻⁴ m and 7.6 × 10⁻⁷ m/s**.
  The transported energy term is 89 % (86 % in velocity); it is a worst-case bound. Break-even:
  ε* = 180u (×7.8 over ε_t at Δt = T). (Revision 1 evaluated C4: 2.2e-3 m with K not included;
  C4 is withdrawn until K(e) is derived.)
- **Scope for G1 (revision 4, owner direction P-1 of 2026-11-15).** VT-14 is accepted for G1 at
  **e = 0 only**: the toleranced comparison of the maneuvered run with the coast run is made on
  circular cases (C1, C2, C6 scale), with the formula above evaluated at each case's scale and
  maneuver time (§4.1). For e > 0 only the exact parts (§1: Δv_I = ±0, v⁺ `===` v⁻, R8) and
  segment 0 are checked; the state after m is not judged. Nothing is derived for e > 0 in this
  revision. O-11 (K_r(e), K_v(e)) stays open and **does not block G1**. The G1 verification report
  must state, for this family, exactly: **"VT-14: e = 0 only"**.
- Margin: M = 4.

### VT-15 Post-maneuver orbit (L1, L2) — also ML-FR-010 AC3

- Quantities: a⁺ and e⁺ from the engine's post-maneuver state (evaluated by the test) vs closed
  form for a tangential burn at an apsis (vis-viva: a⁺ = 1/(2/r − (v + Δv)²/μ), e⁺ = \|1 − r/a⁺\|),
  and post-maneuver elements vs the L2 reference.
- Measure: a⁺ relative; e⁺ **absolute** (e⁺ can be 0: circularisation).
- Reference accuracy: closed form evaluated by the test (term (iii)); L2 reference elements per
  VT-03 budget.
- Error model: (i) the pre-maneuver state's energy error ≤ τ_E,eng(m)\|E⁻\| (engine part only,
  review N4); (ii) the rounding of v⁻ + Δv (≤ u\|v⁺\| per component) changes E by ≤ u v⁺²;
  (iii) closed form and test evaluation of E⁺ each γ_5(v⁺²/2 + μ/r). A phase (time) error at the
  apsis changes r and the along-track speed only to second order (both stationary at an apsis), so
  it is neglected. Dividing by \|E⁺\| = μ/(2a⁺): (ii) gives u(4a⁺/r − 2), (iii) 10u(4a⁺/r − 1).
- Tolerance: \|δa⁺\|/a⁺ ≤ M[τ_E,eng(m)·a⁺/a⁻ + 11u(4a⁺/r − 1)]; \|δe⁺\| ≤ M[(r/a⁺)(\|δa⁺\|/a⁺)/M + 60u]
  (60u: e-vector evaluation, 30u each in test and engine-state evaluation, §VT-03).
  Evaluated, C4 burn +100 m/s along S at m = T (τ_E,eng(T) = 2.15 × 10⁻¹²): perigee
  (r = 7.2e6, a⁺ = 1.268e7): **9.1 × 10⁻¹² relative (1.2 × 10⁻⁴ m)**, e⁺ **5.2 × 10⁻¹²**; apogee
  (r = 1.68e7, a⁺ = 1.228e7): 8.8 × 10⁻¹² relative, e⁺ 1.2 × 10⁻¹¹. (Revision 1: 1.5e-12 relative.)
  Break-even ε* = 303u (×5.5).
- Near-parabolic results (\|E⁺\| < 0.1(v⁺²/2 + μ/r)): a⁺ is ill-conditioned (κ → ∞); compare
  E⁺ in absolute terms instead, \|δE⁺\| ≤ M[τ_E,eng(m)\|E⁻\| + 11u(v⁺²/2 + μ/r)].
- FR-010 AC3 comparison table: perigee/apogee radius r_{p,a} = a(1 ∓ e): \|δr_{p,a}\| ≤
  \|δa\|(1 ± e) + a\|δe\|; period δT/T ≤ (3/2)\|δa\|/a + 6u; differences (after − before) are
  compared in absolute terms with the sum of both operands' tolerances (relative measures of a
  difference are meaningless when the difference is small).
- Margin: M = 4.

**Revision 4 (P-2): general burns, direction term and orbit plane.**

- **Missing term (iv): direction of the computed Δv_I.** The engine's Δv_I differs from the exact
  ΔvR R + ΔvS S + ΔvW W of its own pre-maneuver state by ‖δΔv_I‖ ≤ ε_Δv‖Δv‖, ε_Δv = (12κ_h⁻ + 25)u
  (VT-12 per-side budget, κ_h⁻ = 1/√(1 − e⁻²) of the pre-maneuver orbit). It changes the
  post-maneuver energy by v⁺·δΔv_I, which is first order in general:
  \|δE⁺\| ≤ v⁺ ε_Δv ‖Δv‖, i.e. \|δa⁺\|/a⁺ gains **β_dir = 2a⁺v⁺ε_Δv‖Δv‖/μ**. For a tangential burn
  at an apsis v⁺ is parallel to S, so only the component of δS along S enters: ‖Ŝ‖ − 1 ≤ 4u + 4u
  (norms of R̂, Ŵ, B6) + 3u (cross product, B5) = 11u, and the product ΔvS·S_k u, so
  \|v⁺·δΔv_I\| ≤ 12u v⁺Δv, i.e. 24u a⁺v⁺Δv/μ relative. The approved coefficient 11u(4a⁺/r − 1)
  rounds up the exact sum u(4a⁺/r − 2) + 10u(4a⁺/r − 1) = 11u(4a⁺/r − 1) − u, so it has a slack of
  1u that absorbs the tangential term whenever 24a⁺v⁺Δv/μ ≤ 1. Revision 3 omitted term (iv); the
  §6.1 phase argument (second order at an apsis) is unaffected.
- **Corrected tangential formula** (apsis, along ±S): \|δa⁺\|/a⁺ ≤ M[[m > 0]·τ_E,eng(m)·a⁺/a⁻ +
  11u(4a⁺/r − 1) + max(0, 24a⁺v⁺Δv/μ − 1)u]; e⁺ as before with this \|δa⁺\|/a⁺, except for
  e⁺ < 10⁻⁶ (below). Term (i) is written with [m > 0] because at m = 0 it is exactly zero: the
  engine's pre-maneuver state is the request's `initialState` bit-for-bit (§1, precondition row).
  Of the ten tangential grid cases only C3 apogee circularisation (m = 0, Δv = 904.46 m/s,
  24a⁺v⁺Δv/μ = 3.92) has a non-zero extra term; there the corrected formula gives
  \|δa⁺\|/a⁺ ≤ 4[11u·3 + 2.92u] = 143.7u = **1.60 × 10⁻¹⁴**. **No approved value is loosened**
  (review Q3 of revision 4): for every tangential case the corrected formula is ≤ the approved
  value — equal at m > 0 (extra term zero), smaller at m = 0 (term (i) zero; C3: 1.60 × 10⁻¹⁴ ≤
  1.7686 × 10⁻¹², and for e⁺ the general formula of N1 below gives 3.93 × 10⁻¹⁴ ≤ 1.7952 × 10⁻¹²).
  The approved values therefore stay in force, unchanged, for the run-2 datasets; the corrected
  formula applies to the m > 0 cases (where it equals the approved value) and to the new dataset
  versions of part D2 (below), where at m = 0 it is a tightening.
- **e⁺ near zero (circularisation; review N1).** The tangential e⁺ formula uses e⁺ = \|1 − r/a⁺\|,
  i.e. only the energy error. A velocity error δv_r normal to v⁺ (from the direction error of Ŝ and
  the R12 addition) changes the e-vector by ‖δe_⊥‖ ≤ (rv⁺/μ)\|δv_r\| perpendicular to ê⁺, which
  changes ‖e⁺‖ only by ≤ ‖δe_⊥‖²/(2e⁺) — second order — unless e⁺ is itself of the size of ‖δe_⊥‖
  (≤ 10⁻¹⁴ on the grid), where it is first order. **Chosen resolution: for e⁺ < 10⁻⁶ the general
  e⁺ formula below is used instead of the tangential one** (it bounds the e-vector change from any
  velocity error, 4rv⁺‖δv⁺‖/μ, which contains the reviewer's radial term (rv⁺²/μ)[(6κ_h⁻ + 12)
  u‖Δv‖/v⁺ + u]). For e⁺ ≥ 10⁻⁶ the neglected second-order part is ≤ (10⁻¹⁴)²/(2·10⁻⁶) = 5 × 10⁻²³,
  below 10⁻⁸ of every e⁺ tolerance, and is neglected as the apsis phase error is (§7 VT-15). Why
  not add the term to every case: it is first order only near e⁺ = 0, and adding it everywhere
  would raise approved values for a term that does not act there. Grid case affected:
  `c3-apogee-circularise` (e⁺ = 3.7 × 10⁻¹⁶): general formula 3.93 × 10⁻¹⁴, bounded by the
  approved 1.7952 × 10⁻¹² that stays in force for the run-2 dataset. A circularisation at m > 0
  must use mode B (the general formula has no pre-maneuver term).
- **Two comparison modes for the pre-maneuver state.** (A) The reference applies the burn exactly
  to the **exact** pre-maneuver state at m. At m = 0 that state is the request's `initialState`,
  and the engine's pre-maneuver state equals it bit-for-bit (§1, precondition row), so term (i) is
  zero. At m > 0 the engine's pre-maneuver state carries propagation error; for a burn away from an
  apsis or not along S its phase part changes a⁺, e⁺ and the plane at **first** order (the burn
  point moves), which is not derived here. **Mode A at m > 0 is allowed only for tangential burns
  at an apsis, for every VT-15 row** (a⁺, e⁺ with τ_E,eng(m), and the plane rows with the tilt
  term). For any other burn the plane rows would miss two first-order terms, ΔvW·δs/(rv⁺) from the
  along-track phase error δs and the tilt of the engine's W axis times ‖Δv‖/v⁺ (review B1 of
  revision 4); for a tangential burn at an apsis ΔvW = 0 and Δv lies along S, which tilts with the
  plane, so neither term arises. (B) The reference applies the burn exactly to the engine's
  **event** state (`position_m`, `velocityBefore_mps`); term (i) and the tilt term are zero for
  every m. **Every burn at m > 0 that is not tangential at an apsis uses mode B** (as §9.3.2
  item 4). (All non-tangential grid cases are at m = 0.)
- **Non-tangential burns (normal, radial, combined).** Measures as above (a⁺ relative, e⁺
  absolute); mode A at m = 0 or mode B:
  - \|δa⁺\|/a⁺ ≤ M[11u(4a⁺/r − 1) + 2a⁺v⁺(12κ_h⁻ + 25)u‖Δv‖/μ].
  - \|δe⁺\| ≤ M[(4rv⁺/μ)((12κ_h⁻ + 25)u‖Δv‖ + u v⁺) + 60u]. Derivation: from
    e = [(v² − μ/r)r − (r·v)v]/μ, a velocity error δv gives ‖δe‖ ≤ 4rv‖δv‖/μ, and
    \|δ‖e‖\| ≤ ‖δe‖; the engine's post-maneuver velocity error is ≤ ‖δΔv_I‖ + u v⁺ (the R12
    addition, componentwise ≤ u\|v⁺_k\|); 60u is the e-vector evaluation of test and reference
    (§VT-03, 30u each; valid for bound post-maneuver orbits, v²r/μ < 2). The formula uses no
    apsis property, so it holds for every bound post-maneuver orbit.
- **Orbit plane (new rows, every VT-15 case).** ĥ = (r × v)/‖r × v‖ formed by the test.
  - *Plane-normal error* δψ_n = ‖ĥ⁺_engine − ĥ⁺_ref‖ (radians, = the angle to first order; also
    bounds \|sin\| of the angle). Engine state: δh⁺ = r × δv⁺, direction error ≤ 2r‖δv⁺‖/h⁺ (B6);
    with κ_h⁺ = rv⁺/h⁺ (the post-maneuver flight-path factor at the burn point, from the
    reference state) that is κ_h⁺u[2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 2]. Evaluation of ĥ⁺ by the test and by
    a binary64 reference: 6uκ_h⁺ each (B5, B6). At m > 0 (mode A, tangential burns at an apsis
    only) add the tilt of the engine's pre-maneuver plane: only the bounded rounding P_b, V_b of §6.2 leaves the plane (§10, inclination
    noise), giving 2(P_b v⁺ + rV_b)/h⁺.
    **δψ_n ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14) + [m > 0]·2(P_b v⁺ + rV_b)/h⁺].**
  - *Plane-rotation angle* ψ = atan2(‖ĥ⁻ × ĥ⁺‖, ĥ⁻·ĥ⁺) (the atan2 form is required; acos of the dot
    product loses half the digits for small ψ, B8). Adds the evaluation of ĥ⁻ (6uκ_h⁻ per side) and
    of the atan2 (cross product 3u, its norm 3u, dot product 3u: normwise 6.7u, √2·6.7u = 9.5u by B8,
    plus atan2 rounding 2πu = 6.3u: 16u per side):
    **\|δψ\| ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14) + 12uκ_h⁻ + 32u + [m > 0]·2(P_b v⁺ + rV_b)/h⁺]**.
    A common tilt of ĥ⁻ and ĥ⁺ cancels in ψ; keeping the tilt term is conservative.
- **Evaluated (L2, M = 4; inputs: the grid elements, ν₀, m and Δv_RSW of the datasets; κ_h⁻ =
  1/√(1 − e²) of the grid case; κ_h⁺ from the reference post-maneuver state).** "Run-2 dataset"
  is the approved revision-3 value, which stays in force for the dataset version run in
  conformance run 2 (§4.1 item 1); "new version" is the revision-4 value, which applies only to the
  new dataset versions committed in part D2 before any engine run (§4.1 item 5). The plane rows
  exist only for new versions.

| Case | Burn | m | a⁺ (m) | κ_h⁺ | \|δa⁺\|/a⁺ run-2 dataset \| new version | \|δe⁺\| run-2 dataset \| new version | δψ_n (rad), new version | \|δψ\| (rad), new version |
|---|---|---|---|---|---|---|---|---|
| c1-circular-prograde | +100 S | 0 | 7.1919e6 | 1.0000 | 3.318e-13 \| 1.52e-14 | 3.496e-13 \| 4.14e-14 | 6.65e-15 | 2.62e-14 |
| c1-circular-prograde-after-1T | +100 S | T | 7.1919e6 | 1.0000 | 1.063e-12 \| 1.063e-12 | 1.061e-12 \| 1.061e-12 | 2.76e-13 | 2.95e-13 |
| c1-normal | +200 W | 0 | 7.0049e6 | 1.0000 | — \| **1.55e-14** | — \| **3.02e-14** | 7.09e-15 | 2.66e-14 |
| c3-apogee-circularise | +904.46 S | 0 | 1.3000e7 | 1.0000 | 1.7686e-12 \| 1.60e-14 | 1.7952e-12 \| 3.93e-14 (general formula, e⁺ < 10⁻⁶) | 1.17e-14 | 3.15e-14 |
| c4-perigee-prograde | +100 S | 0 | 1.2676e7 | 1.0000 | 2.603e-12 \| 2.95e-14 | 1.505e-12 \| 4.34e-14 | 6.60e-15 | 2.66e-14 |
| c4-perigee-prograde-after-1T | +100 S | T | 1.2676e7 | 1.0000 | 9.114e-12 \| 9.114e-12 | 5.203e-12 \| 5.203e-12 | 5.69e-13 | 5.89e-13 |
| c4-perigee-retrograde | −100 S | 0 | 1.1399e7 | 1.0000 | 2.340e-12 \| 2.61e-14 | 1.505e-12 \| 4.31e-14 | 6.61e-15 | 2.66e-14 |
| c4-apogee-prograde | +100 S | 0 | 1.2283e7 | 1.0000 | 2.503e-12 \| 9.40e-15 | 3.450e-12 \| 3.95e-14 | 7.09e-15 | 2.71e-14 |
| c4-apogee-prograde-after-1T | +100 S | T | 1.2283e7 | 1.0000 | 8.812e-12 \| 8.812e-12 | 1.208e-11 \| 1.208e-11 | 6.45e-13 | 6.65e-13 |
| c4-perigee-normal | −150 W | 0 | 1.2008e7 | 1.0000 | — \| **2.91e-14** | — \| **3.08e-14** | 6.79e-15 | 2.68e-14 |
| c4-radial (ν₀ = 1) | +80 R | 0 | 1.2126e7 | 1.0404 | — \| **2.44e-14** | — \| **2.99e-14** | 6.82e-15 | 2.69e-14 |
| c4-combined (ν₀ = 1) | (30, −60, 45) | 0 | 1.1723e7 | 1.0392 | — \| **2.34e-14** | — \| **2.98e-14** | 6.82e-15 | 2.69e-14 |
| c5-perigee-prograde | +50 S | 0 | 2.7844e7 | 1.0000 | 4.237e-11 \| 7.56e-14 | 1.031e-11 \| 4.50e-14 | 6.40e-15 | 2.85e-14 |
| c5-apogee-raise-perigee | +200 S | 0 | 2.7143e7 | 1.0000 | 4.124e-11 \| 6.84e-15 | 6.876e-11 \| 3.80e-14 | 1.07e-14 | 3.28e-14 |

  (T is fl(2π/n) of the grid a, as in the datasets. Every new-version value is ≤ the run-2 value
  of the same case: no loosening.) **Consistency check, not used to set any
  value:** conformance run 2 §5 item 2 reports, for the four non-tangential cases, observed
  \|δa⁺\|/a⁺ ≤ 4.0e-16, \|δe⁺\| ≤ 2.1e-16 and plane rotation (sine) ≤ 6.7e-17, i.e. at most 2.6 %,
  0.7 % and 1.0 % of the smallest rev. 4 values above; nothing in the measurements contradicts the
  derivation.
- Detection power (plane rows): a burn applied about the wrong axis or with a mis-signed W
  component rotates the plane by ≈ ‖Δv‖/v (≈ 10⁻² rad on the grid), twelve orders of magnitude
  above the tolerance.
- Layers: L1 closed form (exact maneuver, high precision) for every row; L2 element comparison per
  VI-03 rows; L3 per §9.3.1.

### VT-16 Escape / surface intersection (L2b)

- Quantity: hyperbolic or sub-surface arcs vs the RK reference; warning present.
- Measure: ‖Δr‖, ‖Δv‖; warning presence is exact (boolean).
- Error model: §6 generalised: κ_E = max over the arc of (v²/2 + μ/r)/\|E\| (for E > 0 it equals
  4\|a\|/r + 1); r_a → r_max (largest radius on the propagated span); v_p → largest speed; g_p →
  largest acceleration; \|f\| r₀ + \|g\| v₀ + r_max ≤ r₀(1 + 2r_max/p) + r_max/cos φ₀ + r_max (A5,
  same steps as §6.2 without the ellipse bounds); δt_res and δt_g from the componentwise sums of
  §6.1 evaluated on the reference arc (the elliptic closed forms do not apply). Valid only when
  \|E\| ≥ 0.1(v²/2 + μ/r) at the start of the arc; near-parabolic arcs are excluded from the grid
  (no tolerance derived — open item O-5).
- Reference accuracy: E_RK by step halving (§9.2), committed with the dataset.
- Tolerance: ‖Δr‖ ≤ M P_E,gen(Δt) + 2E_RK,r (velocity analogous). No numeric value: evaluated per
  dataset in ML-TASK-011 under §4.1 (dataset and evaluated tolerance committed before the engine
  is run on it; any loosening listed in §15).
- **Case selection margins** (not tolerances): an escape case has \|E⁺\| ≥ 10⁻⁶(v⁺²/2 + μ/r); a
  surface-intersection case has \|r_p⁺ − R_ref\| ≥ 10⁻⁶ R_ref. Both are ≥ 10⁶ times the evaluation
  noise of the decision quantity, so the expected warning is unambiguous. Detection semantics
  (analytic perigee vs sampled radius; whether the perigee passage must fall inside the span) are
  owned by ML-TASK-016/017 (contract §8.3) and not decided (**open item O-5**).
- **Revision 4 (P-3).** Detection semantics are fixed by contract §8.3 and §11.3 D1–D8 (owner,
  2026-11-13); this record does not change them. The hyperbolic budget is written out and
  evaluated in §6.8 (P_E,gen, V_E,gen, with 10κ_E·a → 10κ_E·r_max). O-5 is closed (§12).
  - *Hyperbolic arc vs L2b:* ‖Δr‖ ≤ M·P_E,gen(Δt) + 2E_RK,r, ‖Δv‖ ≤ M·V_E,gen(Δt) + 2E_RK,v, the
    approved form. The engine part M·P_E,gen, M·V_E,gen is evaluated in §6.8. The L2 hyperbolic
    datasets of conformance run 2 carry no reference trajectory (`stateComparison: null`) and were
    run for warnings; the §6.8 values apply only to **new dataset versions** with the L2b
    trajectory and its E_RK, committed in part D2 together with the evaluated values before the
    engine comparison (§4.1 items 1 and 5; an E_RK above the §9.2 target is a loosening for §15).
    The run-2 versions stay informative. Hyperbolic arcs vs L2a are
    not defined (L2a is the elliptic Newton–Kepler method).
  - *Maneuver at m > 0* (`c3-midrun-escape`): the reference arc starts from the engine's event
    state (`position_m`, `velocityAfter_mps`), as for VT-05 post-maneuver segments; Δt = t − m.
  - *Validity condition.* The approved condition \|E\| ≥ 0.1(v²/2 + μ/r) at the start of the arc
    is kept as the rule in force. Only `c3-midrun-escape` (0.2145) meets it. `escape-clear` and
    `l3-orekit-c1-escape-prograde` (0.0786), `hyperbolic-inbound` and `hyperbolic-outbound`
    (0.0549) do not. The §6.8 derivation uses no property of E beyond E > 0 (every factor, κ_E
    included, is taken on the arc), so the 0.1 limit is not needed by the bound; it protected the
    elliptic closed forms, which §6.8 no longer uses. **The start-of-arc test is a scope gate, not
    a condition of the bound (review N2):** the bound takes κ_E, v_max, g_max and r_min over the
    whole arc, so it stays valid where the ratio falls below the gate along the arc — e.g.
    `hyperbolic-inbound` starts at 0.0549 and passes periapsis at 1/κ_E = 0.0411. The gate is
    tested at the start because that is where the case is defined (the post-maneuver state) and
    where D2 can apply it without propagating; a condition "on the whole arc" would add nothing to
    the bound and would exclude arcs that pass a low periapsis for no numerical reason.
    **Proposal for owner decision (§15):** lower
    the condition to \|E\| ≥ 0.05(v²/2 + μ/r), which brings the four arcs above into the toleranced
    set with the §6.8 values (κ_E ≤ 24.3). Near-parabolic arcs below 0.05 (`just-unbound`, 10⁻³;
    `exactly-parabolic`) stay excluded from state comparison: κ_E grows like the inverse of the
    ratio and the \|a\|-scaled rows of §6.8 lose meaning as \|a\| → ∞; no budget is claimed there.
    Until the owner decides, the four arcs are compared for warnings only and their state values are
    reported, not asserted.
  - *Elliptic sub-surface arcs* keep the approved treatment (§6.3 at the post-maneuver (a, e), VT-05
    post-maneuver rule), as used in conformance run 2.
  - Layers: warnings L2 (analytic classification); hyperbolic states L2b (D2) and L3 (§9.3.1).
- **Revision 5 (O-12, O-13).** The hyperbolic arc states vs L2b (`vt-16-r4`) and vs L3
  (`l3-r4-vt-16`, segment 1 of `c1-escape-prograde` and `c3-midrun-escape`) are asserted with their
  committed values, unchanged, under §4.1 item 6: after the owner signs revision 5, with the
  extended O-1 check (§6.8) passing in the same run, and for L3 with the A6′ hyperbolic criterion
  (§9.3.1) passing. L3 `c1-escape-prograde` is compared with an Orekit arc restarted from the
  engine's event state (§9.3.2 item 6). Layers then: hyperbolic states L2b and L3, asserted; solver
  residual on hyperbolic arcs L1-type black-box check (O-1 route (1)).

### VT-17, VT-18, VT-19 — exact (§1).

### FR-002 AC4 derived quantities (L1) — added in revision 2 (review N7)

- Quantities: perigee and apogee radius r_{p,a} = a(1 ∓ e), altitudes r_{p,a} − R_ref, period
  T = 2π√(a³/μ), specific energy −μ/(2a), computed from the **input elements** (no propagation).
- Reference: L1, the same closed forms evaluated by the test (possibly in a different order).
- Error model (per side): r_{p,a}: 1 ∓ e (u) and product (u): 2u relative. Altitude: absolute,
  2u r_{p,a} + u\|alt\| (cancellation near the surface). T: a³ 2u, ÷μ u, square root 1.5u + u,
  2π constant u, product u: 7u relative. Energy: one division (2a exact): u relative.
- Tolerance (M, factor 2 for two sides): r_{p,a} M·4u = **16u ≈ 1.8 × 10⁻¹⁵** relative; altitude
  M·2(2u r + u\|alt\|) absolute; T M·14u = **56u ≈ 6.2 × 10⁻¹⁵** relative; energy M·2u = **8u ≈
  8.9 × 10⁻¹⁶** relative. If the engine and the test use the same formula in the same order, the
  values are bit-identical, but that is not required.
- Displayed values (km, degrees) are a formatting question for the UI, not part of this check.

## 8. Integration families (numeric parts)

- **VI-01**: exact (§1), including FR-014 AC1 CSV values under round-trip formatting.
- **VI-02** (rendered vertex = engine sample × single scene-unit factor s, FR-007 AC2; display
  position at sample times, FR-008 AC3):
  - **Exact** if the scene conversion is defined as one binary64 multiplication x × s followed by
    at most one binary32 rounding (`Math.fround(x * s)`), with no further CPU-side arithmetic on the
    stored value (no origin shift, no matrix product before storage): the test compares
    `Object.is(stored, Math.fround(x * s))` (or `x * s` if binary64 is kept). Scaling done on the
    GPU through a model matrix is not observable in a buffer; then the check is on the buffer
    (`Math.fround(x)`) and on the matrix entry (= s) separately, both exact. Open item O-8.
  - **Otherwise** (other conversion chains): conversion and scaling give ≤ 3u₃₂ relative,
    u₃₂ = 2⁻²⁴ ≈ 5.96 × 10⁻⁸: ‖Δ‖ ≤ M·3u₃₂‖x s‖ = **7.2 × 10⁻⁷ relative** (normwise; ≈ 30 m at
    4.2 × 10⁷ m before scaling).
  - FR-008 AC3: exact under the conditions of §1.
- **VI-03** (analysis outputs; split in revision 2, review B3):
  - **(a) Plumbing — exact.** Plotted values equal the analysis module's output (FR-009 AC3),
    `Object.is` per value. This proves the wiring only; it is not evidence that the values are
    correct, because the module would be its own reference.
  - **(b) Correctness — tolerance.** The analysis output for a result state is compared with an
    **independent recomputation** by the test from the same state (the verification reference
    library, L2c, atan2 forms; it must not import or call the analysis module). No propagation error
    enters. Per-sample tolerance values are evaluated from the **reference side** (the dataset's
    reference trajectory at the same `t_s`, or for L1 checks the state values fed to both) and
    committed under §4.1; the engine output is never used to size its own tolerance.
    κ_E(r) = (v²/2 + μ/r)/\|E\|, κ_h = r v/h (≤ 1/√(1 − e²)).

| Quantity | Measure | Per side (× u) | Tolerance (M, two sides) |
|---|---|---|---|
| ‖r‖, ‖v‖ | relative | 3 (B4) | M·6u = 24u |
| Altitude ‖r‖ − R_ref | absolute (cancellation near the surface) | 3‖r‖ + \|alt\| | M(6u‖r‖ + 2u\|alt\|) |
| Specific energy | absolute | 5(v²/2 + μ/r) | M·10u(v²/2 + μ/r) |
| a | relative | 5.5 κ_E(r) | M·11u·κ_E(r) |
| e | absolute | 30 (e-vector) | M·60u = 240u ≈ 2.7 × 10⁻¹⁴ |
| i | absolute (rad) | 4.3κ_h + 9.2 | M·2(4.3κ_h + 9.2)u |
| Ω (only if not equatorial) | absolute, modulo 2π | 6.3 + 4.3κ_h/sin i | M·2(6.3 + 4.3κ_h/sin i)u |
| ω (only if not circular) | absolute, modulo 2π | 12 + 42.5/e + 4.3κ_h/sin i (last term omitted under the equatorial convention) | M·2(…)u |
| ν (only if not circular) | absolute, modulo 2π | 12 + 42.5/e | M·2(12 + 42.5/e)u |

  Derivations of the angle rows (revision 2; revision 1 gave the rows without derivation):
  - i = atan2(√(h_x² + h_y²), h_z): h has error ≤ 3u r v = 3uκ_h h (B5); forming √(h_x² + h_y²)
    adds 2u relative; B8: angle ≤ √2 × (3κ_h + 2)u = (4.24κ_h + 2.83)u, plus atan2 rounding
    c_f π u = 6.28u: **(4.3κ_h + 9.2)u**.
  - Ω = atan2(h_x, −h_y) (node vector n = ẑ × h, exact sign changes): the same h error relative
    to ‖(h_x, h_y)‖ = h sin i is 3uκ_h/sin i; B8 gives 4.24κ_h u/sin i, plus 6.28u:
    **(6.3 + 4.3κ_h/sin i)u**.
  - ω = angle in the orbit plane from n̂ to the e-vector: e-vector absolute error 30u, i.e. 30u/e
    relative to its length; the projections onto n̂ and ĥ × n̂ add ≈ 4u; B8: √2(30/e + 4)u =
    (42.4/e + 5.7)u; the node direction error rotates the reference direction by the Ω input error
    4.24κ_h u/sin i; atan2 6.28u: **(12 + 42.5/e + 4.3κ_h/sin i)u**.
  - ν = angle from the e-vector to r: the same e-vector term and projections, atan2; r is the
    exact input; the plane error enters only at second order: **(12 + 42.5/e)u**.
  Evaluated examples (M·2·per side): κ_h = 1, sin i = 1, e = 0.1: i 1.2e-14, Ω 9.4e-15, ω 3.9e-13,
  ν 3.9e-13 rad; C4-like (κ_h = 1.091, i = 0.5 rad, e = 0.4): i 1.2e-14, Ω 1.4e-14, ω 1.1e-13,
  ν 1.05e-13 rad; C5-like (κ_h = 1.487, i = 63.4°, e = 0.74): i 1.4e-14, Ω 1.2e-14, ω 6.8e-14,
  ν 6.2e-14 rad.

  Samples with e or i' within a factor 2 of a threshold of §10 are excluded (classification may
  differ). Angle differences are reduced to (−π, π] before comparison.

## 9. Reference accuracy and validation (before any engine comparison)

### 9.1 L2a (classical elements, Newton–Kepler)

Bounded by §6.4. Validated against L2b on every grid case (agreement within M·P_A + 2E_RK) and
by its own VT-06/VT-07/VT-08 invariants with the formulas above (P_E → P_A, δt_res → δt_A, no
off-orbit term). Its solver residual is checked directly: L2a is verification code, so the
Verification Engineer evaluates its Kepler residual in higher precision (Python `mpmath`) on the
grid and records the maximum against δt_A.

### 9.2 L2b (fixed-step high-order RK) — step halving

For each case run step sizes h, h/2, h/4. Record d₁ = ‖y_h − y_{h/2}‖, d₂ = ‖y_{h/2} − y_{h/4}‖ at
every compared time. Asymptotic regime is confirmed when 2^(p−1) ≤ d₁/d₂ ≤ 2^(p+1) (p the method
order; Richardson argument, [Hairer] §II.4 — to be confirmed). Then E_RK := d₂ (undivided, ≥ the
error of y_{h/4} by a factor ≈ 2^p − 1). If the ratio test fails (round-off dominated),
E_RK := max(d₁, d₂) and the dataset says so. Round-off accumulates with the step count;
compensated summation of the state update ([Higham] §4.3, to be confirmed) is recommended. Target:
E_RK ≤ 10⁻¹⁰ r_max. If not achievable the achieved value is recorded, it is listed in §15 as a
loosening (§4.1) and the owner is told; the L2b comparison then has less resolving power than L2a
(§11).

### 9.3 L3 Orekit (ML-TASK-012)

Orekit uses its own constants and algorithms. For a valid comparison the dataset must: pass μ
explicitly equal to the request's μ (not Orekit's default constants); define the initial state
directly in the propagation frame and compare in that frame (no GCRF↔EME2000 or other
transformation, whose frame bias would dominate the comparison); define target dates as
`initialDate.shiftedBy(t_s)` with the same binary64 t_s; record Orekit version, propagator class
and orbit type. Orekit's propagator accuracy is not known to this record (no published bound
consulted — **to be confirmed**); assumption A6: it obeys §6.3 with coefficients at most 2× ours.
Tolerance: M[P_E + 2P_E] = 3M·P_E (position; velocity analogous): C1 10T **5.7 × 10⁻⁵ m /
8.9 × 10⁻⁸ m/s**; C3 1.72e-4 m; C4 2.64e-4 m; C5 1.61e-3 m / 2.51e-6 m/s; C6 3.41e-4 m.
(Revision 1: C1 2.3e-5 m.) A6 is checked by Orekit self-consistency (closure and energy of its
own output) in ML-TASK-012; if it fails, the L3-Orekit tolerance is re-derived from the measured
self-consistency (not from the engine comparison), committed before the engine comparison, and
listed in §15 as a loosening (§4.1).

**Status of A6 (revision 4).** ML-TASK-012 part B ran the check (`verification/l3/selfcheck.py`,
Orekit 13.1.9, orekit_jpype 13.1.9.0, Hipparchus 4.0.3, JDK Temurin 21.0.13; 489 pass/fail checks,
0 failures): energy and angular momentum on every elliptic sample within VT-06/VT-07 with the
engine part ×2 (max ratio 0.001), closure after 1 and 10 periods within VT-08 with P_E, V_E ×2
(max 0.004). A6 is therefore **confirmed for elliptic propagation** in the sense §9.3 asks, and the
§9.3 method applies unchanged. Those bounds are loose (the measured values use ≤ 0.4 % of them);
they confirm A6 but do not measure Orekit's accuracy.

#### 9.3.1 L3 rows for VT-02, VT-12, VT-15 and VT-16 (revision 4)

**Method (the §9.3 rule, applied per family).** Tolerance = M × (engine-side bound + Orekit-side
bound), with the Orekit-side bound at most twice the engine-side bound of the same quantity:
**3M × (engine-side, per-side bound)**. For the families whose L2 tolerance is M × 2 × (per-side
budget) — engine and an equally accurate reference — the L3 tolerance is the same budget with the
factor 2 replaced by 3, i.e. 1.5 times the L2 value. This needs A6 to cover the Orekit computation
of each row, not only propagation:

- **A6′ (new assumption, revision 4):** Orekit's element→state map (`KeplerianOrbit` from
  elements), its QSW frame (`LOFType.QSW`), its state→element getters (a, e, plane) and its
  Keplerian propagation of hyperbolic arcs each obey the corresponding per-side budget of this
  record with coefficients at most 2×. **Evidence (pass/fail, ML-TASK-012 part B, read after the
  formulas were set and not used to set them):** Orekit VT-02 vs the L2c dataset at ≤ 1.3 % of
  M·2η; Orekit's Δv_I vs ΔvR R + ΔvS S + ΔvW W in binary64 at ≤ 1.6 % of the VT-12 tolerance; QSW
  axes vs R, S, W at ≤ 11.4 % of the VT-11 tolerances; Orekit a⁺ vs vis-viva at ≤ 2.5 %, e⁺ ≤ 0.8 %,
  i⁺ ≤ 1.4 % of their bounds. **Hyperbolic arcs: informational only.** `selfcheck.py` measured
  energy deviation ≤ 2.3 × 10⁻¹⁵ relative, ‖Δh‖/h ≤ 9.2 × 10⁻¹⁶ and a Kepler time-of-flight
  residual ≤ 1.1 × 10⁻¹¹ s, without a pass/fail bound. Against the §6.8 values these are ≤ 0.06 %
  of 2τ_E (engine energy part, generalised as in VT-06) and ≤ 2.8 % of 2(ε_t,gen + δt_ph) at the
  end of the two L3 arcs: consistent with A6′, not a confirmation. **Precondition for the L3 VT-16
  hyperbolic rows:** part D2 turns these three measurements into pass/fail checks against 2× the
  §6.8 engine bounds, committed before any engine comparison (needs a change to
  `verification/l3/selfcheck.py`, outside this revision's paths).

**A6′ hyperbolic criterion (revision 5; O-13).** A6′ says Orekit's Keplerian propagation of a
hyperbolic arc obeys §6.8 with coefficients at most 2×. `selfcheck.py` cannot compare Orekit with a
state reference; it measures three quantities of Orekit's own arc, so the criterion is 2× the §6.8
engine bounds **mapped into each measured quantity**, plus M and the test's own evaluation error —
the same construction as the elliptic A6 check of §9.3 (VT-06/VT-07 with the engine part doubled).
All factors are arc-wide (§6.8, N4), from the segment's first state (the input of Orekit's
propagation; reference side, §4.1 item 2): \|a\|, e, n_h, F₀, r_min, r_max, v_max, g_max,
κ_E = 1 + 4\|a\|/r_min, P_b,gen, V_b,gen, and per sample ε_t,gen, δt_g,gen, δt_ph (§6.8). Write
δt_off = ε_t,gen + δt_g,gen (§6.1 item 4). For every sample with Δt > 0, on arcs inside the §7 VT-16
validity gate (below it the measurements stay informative; no bound is claimed there):

- **Energy:** \|E_k − E₀\|/E₀ ≤ M[10uκ_E + 2τ_E,gen(Δt)],
  τ_E,gen = [v_max V_b,gen + g_max P_b,gen + (g_max v_max + 2v_max³/r_min) δt_off]/E. This is VT-06
  (§7) with v_p → v_max, g_p → g_max, P_b → P_b,gen, V_b → V_b,gen and the off-orbit factor
  2(1 + e)g_p = 2v_p²/r_p → 2v_max²/r_min of §6.8; 10uκ_E is the test's two evaluations of E
  (γ_5(v²/2 + μ/r) each, (v²/2 + μ/r)/E ≤ κ_E on the arc). Phase errors do not change E.
- **Angular momentum:** ‖h_k − h₀‖/h₀ ≤ M[6uκ_h + 2τ_h,gen(Δt)],
  τ_h,gen = [P_b,gen v_max + r_max V_b,gen + (v_max² + 2v_max² r_max/r_min) δt_off]/h, with
  κ_h = r_max v(r_max)/h the largest r v/h on the arc (r v = √(μ(2r + r²/\|a\|)) increases with r);
  VT-07 with the same substitutions; 6uκ_h is the test's two cross products (B5).
- **Time of flight:** the measured residual is \|δt_k\| = \|Δt − [M_h(r_k, v_k) − M_h(r₀, v₀)]/n_h\|
  with M_h = s − H, c = e cosh H = 1 + r/\|a\|, s = e sinh H = r·v/√(μ\|a\|), H = ln((c + s)/e),
  \|a\| and e of the first state, in 40-digit decimal arithmetic. A phase (along-orbit) error of
  Orekit's state is a time shift and enters \|δt_k\| one to one: per side ≤ δt_ph + ε_t,gen (§6.8,
  the phase part of P_E,gen as a time). An off-orbit error (δr, δv) changes c by ≤ ‖δr‖/\|a\| and s
  by ≤ (‖δr‖v_max + r_max‖δv‖)/√(μ\|a\|), and δM_h = δs(1 − 1/(c + s)) − δc/(c + s) with
  c + s = e·e^F ≥ e·e^F₀ on an arc with Δt > 0, so \|δM_h\| ≤ w(\|δs\| + \|δc\|),
  **w = max(1, e^(−F₀)/e)**. The off-orbit errors per side are P_off = P_b,gen + v_max δt_off and
  V_off = V_b,gen + (2v_max²/r_min) δt_off (§6.8). Hence per side
  B_tof(Δt) = δt_ph + ε_t,gen + (w/n_h)[(P_off v_max + r_max V_off)/√(μ\|a\|) + P_off/\|a\|], and the
  criterion is **\|δt_k\| ≤ M·2·B_tof(Δt)**. The 40-digit evaluation (exact decimal images of the
  binary64 states, relative rounding ≤ 10⁻³⁹ per operation, \|t\| ≤ 2 × 10⁴ s, w = 1 on both L3
  arcs, see below) adds less than 10⁻³⁰ s and is neglected.

Revision 4 (§9.3.1 above) compared the informational time-of-flight measurement with
2(ε_t,gen + δt_ph); that is the phase part only and is not a bound of this measured quantity
(an off-orbit error moves the inferred anomaly). It was never a pass/fail bound; the criterion above
is the first one, so nothing is loosened (§15 lists it for transparency).

Evaluated (u = 2⁻⁵³, M = 4; the Orekit segment 1 of `test-data/l3-orekit/vt-16`; first sample with
Δt > 0 and last sample; w = max(1, e^(−F₀)/e) = 1 on both arcs, since e^(−F₀)/e ≤ e^(0.13)/2.07 =
0.55 for c3 (F₀ = −0.130, e = 2.07) and = 1/1.34 for c1 (F₀ = 0 to rounding, e = 1.34)):

| Arc | E/(v²/2 + μ/r) | κ_E | κ_h | energy (relative) first / last | ‖Δh‖/h first / last | time of flight (s) first / last |
|---|---|---|---|---|---|---|
| `c1-escape-prograde` (Δt 1000…20 000 s) | 0.0786 | 12.725 | 7.443 | 2.087e-11 / 9.218e-11 | 7.946e-12 / 8.195e-11 | 3.764e-8 / 3.517e-7 |
| `c3-midrun-escape` (Δt 1000…15 000 s) | 0.2145 | 4.722 | 6.320 | 2.794e-12 / 1.649e-11 | 2.736e-12 / 2.393e-11 | 9.896e-9 / 7.683e-8 |

The same criterion applies to Orekit arcs restarted from an engine event state (§9.3.2), checked by
`selfcheck.py --restart conformance/l3-restart` before such an arc is used in an asserted
comparison (§4.1 item 6 (b)).

**Status of A6′ for hyperbolic arcs (revision 5):** see the selfcheck result below the rows of this
section (§9.3.1 "Selfcheck result, revision 5").

**Rows** (M = 4; each per-side bound is the engine-side term of the family named; inputs as in
the datasets):

- **VT-02 L3:** ‖Δr‖ ≤ 3M·η_r(e)·u·r_a, ‖Δv‖ ≤ 3M·η_v(e)·u·v_p (η of §7 VT-02).

| Case | e | η_r | η_v | ‖Δr‖ (m) | ‖Δv‖ (m/s) |
|---|---|---|---|---|---|
| c1, c2 | 0 | 34.00 | 33.00 | 3.17e-7 | 3.32e-10 |
| c3 | 0.3 | 35.91 | 31.48 | 6.22e-7 | 3.61e-10 |
| c4 | 0.4 | 37.05 | 31.19 | 8.29e-7 | 3.66e-10 |
| c5 | 0.74 | 47.81 | 31.23 | 2.88e-6 | 4.22e-10 |
| c6 | 0 | 34.00 | 33.00 | 1.90e-6 | 1.35e-10 |
| c7, c8-b | 0.01 | 34.04 | 32.93 | 3.21e-7 | 3.34e-10 |
| c8-a | 0.005 | 34.02 | 32.97 | 3.19e-7 | 3.33e-10 |

  The L3 VT-02 files store M·2η (the L2 formula; ML-TASK-012 report, "known limitations"); the
  values of this table replace them for the engine comparison (§13, C-8).
- **VT-12 L3:** ‖ΔΔv_I‖ ≤ 3M(12κ_h + 25)u‖Δv_RSW‖ = 12(12κ_h + 25)u‖Δv_RSW‖ (κ_h = 1/√(1 − e²)).
  Valid when the engine's pre-maneuver state equals Orekit's bit-for-bit, i.e. for m = 0 (§1
  precondition row; true for all eight L3 VT-12 files, whose event state equals `initialState`).

| Case | κ_h | ‖Δv‖ (m/s) | relative | ‖ΔΔv_I‖ (m/s) |
|---|---|---|---|---|
| c4 radial, ν₀ = 1 | 1.0911 | 80 | 5.08e-14 | 4.06e-12 |
| c4 along-track, ν₀ = 1 | 1.0911 | 100 | 5.08e-14 | 5.08e-12 |
| c4 cross-track, ν₀ = 1 | 1.0911 | 200 | 5.08e-14 | 1.02e-11 |
| c1 combined | 1.0000 | 80.78 | 4.93e-14 | 3.98e-12 |
| c3 combined | 1.0483 | 80.78 | 5.01e-14 | 4.04e-12 |
| c5 combined | 1.4868 | 80.78 | 5.71e-14 | 4.61e-12 |
| c7 combined, c8-b combined | 1.0001 | 80.78 | 4.93e-14 | 3.98e-12 |

- **VT-15 L3** (Orekit's post-maneuver a⁺, e⁺ and plane vs the engine's, each evaluated from its
  own post-maneuver state). Per-side bounds, from §7 VT-15 revision 4:
  X_a = [m > 0]·τ_E,eng(m)a⁺/a⁻ + 6u(4a⁺/r − 1) + (tangential: max(0, 24a⁺v⁺Δv/μ − 1)u; otherwise
  2a⁺v⁺(12κ_h⁻ + 25)u‖Δv‖/μ) — one evaluation of E⁺ (5u) and the R12 addition (u) per side;
  X_e = (r/a⁺)X_a + 30u (tangential at an apsis with e⁺ ≥ 10⁻⁶) or (4rv⁺/μ)((12κ_h⁻ + 25)u‖Δv‖ +
  uv⁺) + 30u (every other burn, and e⁺ < 10⁻⁶; §7 VT-15, review N1);
  X_n = κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 8) + [m > 0]·2(P_b v⁺ + rV_b)/h⁺ (state error plus one ĥ⁺
  evaluation); X_ψ = X_n + 6uκ_h⁻ + 16u. Tolerances 3M·X. At m = 0 both pre-maneuver states are the
  request's `initialState` (precondition row of §1; true in all eleven m = 0 L3 VT-15 files), so
  the propagation term is zero on both sides. At m = T only tangential burns at an apsis occur;
  each side uses its own event state, and the τ_E,eng(T) term enters three times (engine, Orekit
  ×2), as §9.3 prescribes for propagation. Restart is not needed there because a phase difference
  at an apsis changes a⁺, e⁺ only at second order (§7 VT-15).

| Case | \|δa⁺\|/a⁺ | \|δe⁺\| | δψ_n (rad) | \|δψ\| (rad) |
|---|---|---|---|---|
| c1-circular-prograde | 2.49e-14 | 6.42e-14 | 1.20e-14 | 4.13e-14 |
| c1-circular-prograde-after-1T | 3.17e-12 | 3.12e-12 | 8.19e-13 | 8.48e-13 |
| c1-normal | 2.66e-14 | 5.05e-14 | 1.33e-14 | 4.26e-14 |
| c3-apogee-circularise | 2.79e-14 | 7.80e-14 (general formula, e⁺ < 10⁻⁶) | 2.70e-14 | 5.67e-14 |
| c4-perigee-prograde | 4.83e-14 | 6.74e-14 | 1.18e-14 | 4.18e-14 |
| c4-perigee-prograde-after-1T | 2.73e-11 | 1.56e-11 | 1.70e-12 | 1.73e-12 |
| c4-perigee-retrograde | 4.26e-14 | 6.69e-14 | 1.18e-14 | 4.19e-14 |
| c4-apogee-prograde | 1.54e-14 | 6.10e-14 | 1.33e-14 | 4.33e-14 |
| c4-apogee-prograde-after-1T | 2.64e-11 | 3.62e-11 | 1.93e-12 | 1.96e-12 |
| c4-perigee-normal | 4.94e-14 | 5.23e-14 | 1.24e-14 | 4.24e-14 |
| c4-radial | 4.08e-14 | 4.97e-14 | 1.22e-14 | 4.22e-14 |
| c4-combined | 3.91e-14 | 4.96e-14 | 1.22e-14 | 4.22e-14 |
| c5-perigee-prograde | 1.24e-13 | 7.00e-14 | 1.12e-14 | 4.44e-14 |
| c5-apogee-raise-perigee | 1.12e-14 | 5.86e-14 | 2.40e-14 | 5.72e-14 |

  At m = 0 these are smaller than the approved L2 tangential values, because the approved L2
  formula keeps the term τ_E,eng(0) (§7 VT-15), which the L3 rows drop on the strength of the
  bit-identity precondition. Elements other than a, e and the plane (Ω, ω, ν after the burn) are
  not compared at L3 (ML-TASK-012 report: Orekit applies no ADR-008 convention).
- **VT-16 L3, hyperbolic arcs:** ‖Δr‖ ≤ 3M·P_E,gen(Δt), ‖Δv‖ ≤ 3M·V_E,gen(Δt) (§6.8), under the
  precondition on A6′ above and the validity condition of §7 VT-16. End-of-span values:
  `l3-orekit-c3-midrun-escape` (in force, ratio 0.2145; Δt ≤ 15 000 s from the restart state of
  §9.3.2) **5.712 × 10⁻⁵ m / 4.304 × 10⁻⁸ m/s**; `l3-orekit-c1-escape-prograde` (ratio 0.0786,
  inside the 0.05 gate approved with P-3 on 2026-11-15) **1.028 × 10⁻⁴ m / 1.150 × 10⁻⁷ m/s**.
  First samples: 1.674e-5 m / 3.304e-9 m/s (C3, Δt = 1000 s) and 3.248e-5 m / 7.110e-9 m/s (C1,
  Δt = 1000 s). Arc-wide factors per sample, as in §6.8 (N4).
- **VT-16 L3, elliptic segment after the burn** (`l3-orekit-c4-midrun-retro-subsurface`): the
  approved §9.3 formula 3M·P_E, 3M·V_E at the post-maneuver (a⁺, e⁺) = (8.4482 × 10⁶ m, 0.61416),
  from the restart state; at the last sample (Δt = 5999.5 s) 3.73 × 10⁻⁵ m / 1.71 × 10⁻⁷ m/s.
- VT-05 L3 is the approved §9.3 row, unchanged.

**Selfcheck result, revision 5 (O-13).** The criterion and its implementation were committed
(6967f93, 35a548f) before the run. `python -B verification/l3/selfcheck.py --repro --restart
conformance/l3-restart` (Orekit venv: Python 3.13.17, Orekit 13.1.9, orekit_jpype 13.1.9.0,
Hipparchus 4.0.3, JDK Temurin 21.0.13): **exit 0, 500 pass/fail checks, 0 failures,
66 informational measurements; generator unchanged since df84b5e6d75a, same 43 files,
byte-identical regeneration** (without `--restart`: 495 checks, 0 failures). The six former
informational hyperbolic measurements are now pass/fail. Worst sample per measured quantity
(observed / bound = ratio):

| Arc | energy | ‖Δh‖/h | time of flight (s) |
|---|---|---|---|
| Orekit segment 1, `c1-escape-prograde` | 2.301e-15 / 2.087e-11 = 1.1e-4 | 3.532e-16 / 7.946e-12 = 4.4e-5 | 1.030e-11 / 1.960e-7 = 5.3e-5 |
| Orekit segment 1, `c3-midrun-escape` | 7.688e-16 / 2.794e-12 = 2.8e-4 | 3.933e-16 / 5.041e-12 = 7.8e-5 | 8.499e-12 / 6.110e-8 = 1.4e-4 |
| Restarted arc `l3-restart/c3-midrun-escape` (§9.3.2) | 2.691e-15 / 2.794e-12 = 9.6e-4 | 2.622e-16 / 2.736e-12 = 9.6e-5 | 2.280e-12 / 1.721e-8 = 1.3e-4 |

(The restarted elliptic arc `c4-midrun-retro-subsurface` passes the approved A6 energy and
angular-momentum checks at ratios 7.0e-5 and 5.2e-5.) **A6′ is therefore confirmed for Orekit's
hyperbolic propagation on these arcs** in the sense of this criterion. As for the elliptic A6
check, the bounds are worst-case and loose (the measurements use at most 0.1 % of them); they
confirm A6′, they do not measure Orekit's accuracy.

#### 9.3.2 Maneuvers at t > 0 in the L3 comparison (revision 4)

Orekit's event state at m > 0 differs from the engine's by the propagation errors of both
(≤ 3M·P_E(m), 3M·V_E(m) by §9.3). Two treatments were considered: restarting the reference from the
engine's event state, or comparing with Orekit's own post-maneuver arc and adding a transport term
for the event-state difference. The transport term needs the factors K_r, K_v of §7 VT-14, which
exist only for e = 0 (O-11 open) and not at all for hyperbolic arcs; it cannot be applied to the
L3 cases (all have e > 0 or are hyperbolic after the burn). **Rule:**

1. **Segment 0 (t ≤ m)** is compared with Orekit's own segment 0 under §9.3 (no restart).
2. **States after the burn** are compared with an Orekit arc **restarted from the engine's event
   state** (`position_m`, `velocityAfter_mps`) with the same propagator call as the dataset
   (`KeplerianPropagator` on a `CartesianOrbit`, μ explicit, GCRF; `generate.propagate`), at
   Δt = t − m, with 3M·P_E (elliptic, at the post-maneuver scale) or 3M·P_E,gen (hyperbolic). This
   is the VT-05 post-maneuver rule (§7) applied to L3. The restarted arc depends on the engine
   only through its event state; the event state itself is checked by segment 0 (item 1), VT-12
   and VT-13.
3. **Tolerance values** are evaluated from Orekit's own event state (reference side, §4.1 item 2)
   and committed before the engine run. The engine's event state differs from it by ≤ 3M·P_E(m),
   i.e. ≤ 1.4 × 10⁻⁵ m (C3 at 5000 s, the largest m of the hyperbolic set) and relative ≤ 2 × 10⁻¹²,
   which changes no printed digit of any scale factor (the most sensitive, \|a\| through κ_E, moves
   by less than 10⁻¹⁰ relative).
4. **Post-maneuver elements** (VT-15): tangential burns at an apsis may use each tool's own event
   state (phase difference second order; τ_E,eng(m) on both sides, §9.3.1); any other burn at
   m > 0 uses mode B of §7 VT-15 (Orekit's maneuver applied to the engine's event state), with the
   m = 0 formulas. **VT-12** at m > 0 (no grid case) likewise recomputes Orekit's QSW from the
   engine's (`position_m`, `velocityBefore_mps`).
5. The L3 files keep `segment1: null` or Orekit-start segment-1 values; part D2 regenerates the
   restarted arcs (`selfcheck.py --repro` first) and commits the comparison code before any engine
   result on these datasets is inspected (§4.1).
6. **Hyperbolic arc with the maneuver at m = 0 (revision 5).** For `l3-orekit-c1-escape-prograde`
   (m = 0, hyperbolic after the burn) both pre-maneuver states are the request's `initialState`, but
   the post-burn velocities differ by the difference of the two Δv_I (each within its VT-12 per-side
   bound; 1.8 × 10⁻¹² m/s in run 3). Revision 4 compared the engine with Orekit's own segment 1,
   which leaves that start difference to be transported along the arc, and no transport bound
   exists for a hyperbola (the reason for item 2). The rule of item 2 therefore applies here as
   well: segment 1 is compared with an Orekit arc restarted from the engine's event state
   (`position_m`, `velocityAfter_mps`), with the same propagator call, at Δt = t − 0, against the
   committed values 3M·P_E,gen(Δt), 3M·V_E,gen(Δt) of `l3-r4-vt-16/c1-escape-prograde` (evaluated from
   Orekit's own event state, item 3; unchanged). The first sample of the restarted arc is the event
   state (exact, R8). The restarted arc is produced in phase 2 (engine event state recorded by the
   gated test, then Orekit run by `verification/l3-d2/restart.py` unchanged) and checked by
   `selfcheck.py --restart` before use (§4.1 item 6 (b)). **Premise asserted with the comparison
   (review N4):** the engine's c1 event `position_m` and `velocityBefore_mps` equal the request's
   `initialState` bit-for-bit (§1 precondition row), and ‖Δv_I,engine − Δv_I,Orekit‖ is within the
   approved L3 VT-12 row of §9.3.1, 3M(12κ_h + 25)u‖Δv_RSW‖ with κ_h = 1 (grid e = 0) and
   ‖Δv_RSW‖ = 4000 m/s: **1.972 × 10⁻¹⁰ m/s** (not a new formula: the VT-12 L3 row evaluated at this
   case's scale, from the reference side; checked in binary64 and decimal).

### 9.4 L3 textbook examples

Printed values carry d significant digits (typically 3–5). For a printed x with d digits:
τ_book = M_book · ½ · 10^(q − d + 1), q = ⌊log₁₀\|x\|⌋, **M_book = 2** (the author's intermediate
rounding is unknown; this allows ±1 in the last printed digit). The comparison uses the book's own
μ and inputs exactly as printed (A4 does not hold for textbook inputs; the engine is run on the
printed inputs). Relative resolution is about 10^(1−d): 10⁻² to 10⁻⁴. These checks detect
convention errors (sign, axis, angle definition), not numerical accuracy.

## 10. Degenerate-element thresholds (requested by contract §3)

Contract §3 takes the circular and equatorial thresholds from this record. They are partly a
product decision; this section gives the numerical lower bound as a function of the angular
accuracy target δθ (owner, open item O-6) and of the span N (periods).

- **Eccentricity noise** of the computed e of a circular state after N periods (revised in
  revision 2): e-vector evaluation 30u; sensitivity of the e-vector to state errors at e = 0,
  \|δe\| ≤ 3δv/v + 2δr/r (from e = [(v² − μ/r) r − (r·v) v]/μ with v² = μ/r, r·v = 0; revision 1
  used 2δv/v + δr/r, too small); bounded part 3·175u + 2·130u (V_b/(u v_p) = 175,
  P_b/(u r_a) = 130); off-orbit time-like part (§6.1 item 4) δr/r = n δt_off, δv/v = 2n δt_off,
  so 8 n δt_off with n δt_off = u[(A_s + A_g)·2πN + B_s + B_g] = u[42.5·2πN + 14] at e = 0.
  Phase errors do not change e.

      ê_noise(N) = u [ 30 + 785 + 8 (42.5 · 2πN + 14) ] = u [ 927 + 2136.3 N ]

  N = 0: 927u = 1.0 × 10⁻¹³; N = 1: 3.4 × 10⁻¹³; N = 10: 2.5 × 10⁻¹²; N = 100: 2.4 × 10⁻¹¹;
  N = 1000: 2.4 × 10⁻¹⁰.
- **Inclination noise.** The off-orbit time-like errors lie in the orbit plane (along v₀ and
  along v − v₀), so they do not tilt h. Only the bounded rounding does:
  î_noise = 2[3uκ_h + (P_b v_p + r_a V_b)/h] = 2(3 + 130 + 175)u = **616u = 6.8 × 10⁻¹⁴ rad** at
  e = 0, independent of N (revision 1 used ê_noise for both).
- The angle of a vector of size e known to ±ê_noise is uncertain by ê_noise/e; Ω of a plane
  inclined by i' is uncertain by î_noise/sin i'. For ω (resp. Ω) to meet δθ:

      ε_e,min(N, δθ) = M ê_noise(N) / δθ          ε_i,min(δθ) = M î_noise / δθ

| δθ (rad) | ε_e,min N = 0 | N = 1 | N = 10 | N = 100 | N = 1000 | ε_i,min (any N) | N_max for ε = 10⁻⁵ |
|---|---|---|---|---|---|---|---|
| 10⁻⁴ | 4.1e-9 | 1.4e-8 | 9.9e-8 | 9.5e-7 | 9.5e-6 | 2.7e-9 | ≈ 1050 |
| 10⁻⁵ | 4.1e-8 | 1.4e-7 | 9.9e-7 | 9.5e-6 | 9.5e-5 | 2.7e-8 | ≈ 105 |
| 10⁻⁶ | 4.1e-7 | 1.4e-6 | 9.9e-6 | 9.5e-5 | 9.5e-4 | 2.7e-7 | ≈ 10 |
| 10⁻⁷ | 4.1e-6 | 1.4e-5 | 9.9e-5 | 9.5e-4 | 9.5e-3 | 2.7e-6 | < 1 |

  (N_max(ε, δθ) = (ε δθ/(M u) − 927)/2136.3, the span up to which ε meets δθ in the worst case.)
- **Span dependence (review N8).** `duration_s` is not bounded by the contract, so no fixed ε_e
  guarantees δθ for every span: the guarantee is "δθ up to N_max periods". Revision 1's statement
  "valid to about 100 periods at δθ = 10⁻⁶ rad" was wrong under the revised noise model; at
  10⁻⁶ rad, ε = 10⁻⁵ holds to about 10 periods, at 10⁻⁵ rad to about 105.
- Trade-off: a larger ε makes displayed angles reliable over longer spans but moves the
  near-degenerate round trip by up to ≈ 2ε r per degenerate element (VT-04(b)).
- **Proposal for owner decision (O-3, O-6):** δθ = 10⁻⁵ rad (about 6 × 10⁻⁴ degree, finer than a
  0.001° display step), ε_e = ε_i = 10⁻⁵: worst-case angle accuracy δθ up to ≈ 100 periods. The UI
  does not promise δθ for near-threshold orbits beyond N_max.

## 11. Where the indicative expectation of plan §4 does not hold

Against the assumed display resolution (§5: 1 m, 1 mm/s), every derived tolerance above is 3 to
9 orders of magnitude finer (largest: VT-05/VT-08 C5 7.8 × 10⁻⁴ m, VT-14 C1 6.8 × 10⁻⁴ m, L3
Orekit C5 1.6 × 10⁻³ m). Exceptions and limits:

1. **acos-based element extraction** (VT-03, VT-04, VI-03): √u-level angle errors (≈ 4 × 10⁻⁸ rad,
   ≈ 0.25 m at LEO) — would make a round trip agree only to decimetres. Treated as a defect signal.
2. **Degenerate convention** (VT-04(b)): up to 2ε r per degenerate element (140 m at LEO for
   ε = 10⁻⁵, 280 m if both) for near-degenerate inputs below the threshold. Not a numerical error;
   inherent in the convention.
3. **Element angles near the thresholds**: ω, ν, Ω accurate only to about ê_noise/e, i.e. close to
   δθ by construction of §10, and only up to N_max periods.
4. **L2b and L3 comparisons**: their resolving power is limited by E_RK (measured), by Orekit's
   unverified accuracy (A6) and, for textbook values, by 3–5 printed digits (10⁻²…10⁻⁴ relative,
   i.e. at or above display resolution). Only L1 and L2a comparisons can confirm "many orders of
   magnitude better".
5. **Float32 scene buffers** (VI-02): 7 × 10⁻⁷ relative, tens of metres at GEO scale — far below
   visual resolution but not "many orders" below a 1 m numeric display. Exact under O-8.
6. **Solver criterion**: every propagation number uses the derived budget ε_t (§6.1). A solver with
   a loose stopping rule (e.g. a relative step of 10⁻⁸ with only linear convergence guaranteed)
   could have residuals ≈ 10⁻⁸ \|Δt\| — C1 10T errors up to ≈ 10⁻⁸ × 7546 × 59 213 ≈ 4.5 m, display
   level. Such an engine fails these tolerances; that is intended (O-1).
7. **Long spans**: along-track terms grow linearly; at C1 scale P_E grows by
   u(C_t + 2A_s + A_g) v_p ≈ 7.9 × 10⁻¹¹ m per second of span, reaching 1 m after ≈ 1.3 × 10¹⁰ s
   (≈ 400 years) — not a practical limit.

## 12. Open items

Each item: what is open, who decides, the recommended resolution, and the effect until resolved.
The review's table (PR #12) was the input; where this record's position differs it says so.

| # | Item | Decides | Recommended resolution | Effect until resolved |
|---|---|---|---|---|
| O-1 | Solver stopping criterion. ADR-005 fixes none; the propagation tolerances use the **derived** budget ε_t(Δt) = u[(25 + 65e)|Δt| + (12 + 114e + 130e²)/n] seconds (§6.1, same expression). | Astrodynamics Engineer (ML-TASK-015) proposes; Verification Engineer accepts the evidence; Systems Architect reviews; owner signs the acceptance threshold (§15) | ML-TASK-015 **states its stopping criterion** in the task report and in the solver's public documentation (ML-NFR-002), and **demonstrates** that its residual is within budget. **Acceptance check (revision 3, review F2):** the time equation is evaluated in high precision at the returned χ̂ with α, σ₀ and r₀ **also formed in high precision from the exact binary64 inputs**, and the check passes when |t(χ̂) − Δt| ≤ ε_t(Δt) + δt_α(Δt), δt_α = 5uκ_E[(1 + 2e)|Δt| + (4e + 4e²)/n] (§6.1; κ_E may be taken as 4a/r₀ − 1 of the exact input). The δt_α part is the α data error already budgeted in C_t; it is part of the check threshold only and changes no propagation tolerance. At ten periods the threshold is 39.6u (C1), 82.4u (C3), 102.6u (C4), 256.0u (C5) equivalent (§6.1 table). Acceptable evidence that does not require the verifier to read the implementation: (1) **black-box residual check** (preferred): the solver, or an exported function returning χ̂ for (r₀, v₀, Δt, μ), is part of the documented interface; the Verification Engineer evaluates the check above (Python `mpmath`) over the test grid plus random cases (e up to 0.95, Δt up to 100 periods, negative Δt) and records max |t(χ̂) − Δt|/(ε_t + δt_α) ≤ 1; (2) the engineer's own test doing the same with an extended-precision evaluator, with the evaluator and the case list in the PR, reviewed by the verifier; (3) not sufficient alone: a step criterion |Δχ| ≤ ε_χ|χ| (it bounds the residual by ε_χ(1 + e)(|Δt| + 2e/n), which must then be ≤ ε_t(Δt) for every case, and only if the step bounds the error), or passing VT-05…VT-09 (the break-even table, §6.7, shows a correct engine passes with residuals up to 4.5–10× ε_t, and for an engine forming g consistently with χ̂ VT-06/VT-07 do not see the residual at all). A criterion below the noise bound δt_eval needs a stagnation exit and an iteration cap. **No number goes into ADR-005**; a looser engine criterion does not loosen these tolerances without owner approval (§4.1). | Propagation tolerances assume δt_res ≤ ε_t |
| O-2 | Element extraction must be well conditioned (atan2 forms, B8); acos near ±1 fails VT-03/VT-04 by design. | Systems Architect (ML-TASK-014 contract), Astrodynamics Engineer | Agree with the review: add "angles extracted with atan2-grade conditioning (no acos/asin of a quantity that can approach ±1)" to the **acceptance criteria of ML-TASK-014**. It is a requirement on the algorithm, not a tolerance question. | VT-03/VT-04 may fail on an acos-based implementation |
| O-3 | Degenerate convention: thresholds ε_e, ε_i; whether near-degenerate inputs below them are in VT-04 with the convention term; whether e and i are zeroed or kept. | **Owner** (product); convention detail via a Proposed ADR by the Systems Architect | Agree with the review: **keep e and i as computed, never zero them**, and record the convention (including ϖ = Ω ± ω) in a Proposed ADR. Consequences: (a) VT-04(a) exact-degenerate inputs carry a computed ê ≤ 30u and î' ≤ (6κ_h + 2)u, so their tolerance includes the convention term at those values (§7, adds ≈ 6 × 10⁻⁸ m at LEO, inside the existing scale); (b) VT-04(b): the convention term is 2e r_a/(1 − e) and 2√2 e v_p/(1 + e) (vs ≈ a e and √2 e √(μ/a) if e were zeroed) — about twice as large, up to 140 m per element at ε = 10⁻⁵; (c) thresholds: their lower bound (§10) is unaffected, but because e and i stay continuous across the threshold only the angle convention switches, which makes the near-threshold exclusion rule of VT-04/VI-03 sufficient. I also recommend that FR-003 AC2's "within tolerance" be read, for near-degenerate inputs, as "within the numerical tolerance plus the convention term" (C-3), with ε_e = ε_i = 10⁻⁵ (§10). | VT-04(b) not runnable; FR-002 AC3 thresholds undefined |
| O-4 | Does a sample depend only on (segment initial state, segment start time, `t_s`, constants)? | Astrodynamics Engineer (ML-TASK-015); Systems Architect if made a contract rule | **Resolved in revision 4 (P-4).** Authority: [ADR-005](../architecture/adr/ADR-005-kepler-propagation-algorithm.md) (Accepted, G0, 2026-11-11), *Decision*: "Each output sample is computed directly from the segment's initial state at Δt = t − t₀", with the *Rationale* "the output step is purely a sampling choice"; restated by contracts-v1 §5.2 (revision 3, "Initial sample of a segment"), which refines it only for Δt = 0 and says "Every other sample is unchanged". The approved ML-TASK-015 contract (merged with PR #16 on the owner's instruction; task done in `docs/status/status.json`) makes the reading explicit for the propagator: scope item 2 "direct evaluation from the initial state, no warm start", acceptance criterion 4 "Each sample is computed directly from the initial state (no hidden state)". **Reading stated:** "computed directly from the segment's initial state at Δt" is taken to exclude any other input (a warm start or cache from another sample would be such an input); with the constants this makes each sample a function of (segment initial state, t₀, t_s, μ). contracts-v1 §11.4 P1–P10 do not address it; the ML-TASK-017 contract states it only in its report, which is not authority. Recommendation (not blocking): the Systems Architect may write the "and nothing else" explicitly into the next contract revision; if the reading above is rejected, VT-09 falls back to §7. Note: ML-TASK-015.yaml still reads `status: in_review` while `status.json` shows it done (C-7). | — (VT-09 exact, §1) |
| O-5 | Escape and surface-intersection detection semantics; near-parabolic arcs (no tolerance derived). | ML-TASK-016/017 (Astrodynamics Engineer), Systems Architect | **Closed in revision 4.** Semantics: contract §8.3 and §11.3 D1–D8 (owner, 2026-11-13), not changed here. Numeric part: hyperbolic budget written out and evaluated (§6.8), 10κ_E·a → 10κ_E·r_max justified there. Near-parabolic arcs keep no state tolerance by the validity condition of §7 VT-16 (a scope limit, not an open item); the owner decides whether that condition moves from 0.1 to 0.05 (§15). | — |
| O-6 | Angular accuracy target. Revision 1 tied the thresholds to an assumed display resolution. | **Owner** | Agree with the review: introduce an owner-approved **angular accuracy target δθ**, decoupled from UI formatting. §10 gives ε_min(N, δθ) and N_max(ε, δθ). Recommendation: δθ = 10⁻⁵ rad with ε_e = ε_i = 10⁻⁵ (worst case to ≈ 100 periods). Position/velocity display resolution remains a UI matter (only §11 uses it). | §10 shows both 10⁻⁶ and 10⁻⁵ rad; thresholds provisional |
| O-7 | VT-02 L2c and the engine may implement the same textbook map; algorithmic independence is partial. | Verification Engineer (ML-TASK-011/012) | L3 (Orekit element→state) is the independent check; L2c uses the explicit matrix product. | VT-02 rests on L2c + L3 |
| O-8 | Scene conversion for VI-02. | Frontend Engineer proposes; Systems Architect records it (frontend design note or contract) | Define the conversion as **one binary64 multiplication followed by at most one binary32 rounding**, `Math.fround(x * s)`, with no other CPU-side arithmetic before storage; then **VI-02 is exact** (§8). If GPU-side scaling is used, check buffer and scale separately (both exact). | VI-02 relative 7.2 × 10⁻⁷ |
| O-9 | Assumptions A2 (correctly rounded `Math.sqrt` under ECMA-262), A3 (transcendental accuracy ≤ 1 ulp on the CI Node version) and A6 (Orekit accuracy) unconfirmed. | Verification Engineer (ML-TASK-011/012) | Measure/confirm; any c_f > 2 or A6 failure is re-evaluated under §4.1 and listed in §15. Revision 4: **A6 confirmed for elliptic propagation** by `selfcheck.py` (§9.3); A6′ (§9.3.1) supported by pass/fail checks except for hyperbolic arcs, which need the D2 check (O-13). A2, A3 unchanged here. Revision 5: hyperbolic A6′ now pass/fail (§9.3.1, O-13). | Formulas use c_f = 2 and A6 |
| O-10 | Is the first sample of every segment bit-identical to the segment's initial state? For segments n ≥ 1 R8 already makes it so (event state); for segment 0 the contract is silent. | **Owner** (contract revision 3, drafted by the Systems Architect) | **Resolved** (bookkeeping in revision 4): adopted as contracts-v1 §5.2 revision 3 (owner decision 2026-11-12, §11.2 decision 3; recorded as decided in §15 on 2026-11-13). VT-05 at Δt = 0 is `Object.is` (§1). | — |
| O-11 | VT-14 transport factors K_r(e), K_v(e) for e > 0 not derived (e = 0: Clohessy–Wiltshire, K_r = 14, K_v = 9, citation to be confirmed). New in revision 2. | Verification Engineer (ML-TASK-011) | Derive K(e) from the elliptic state-transition matrix (literature source to be cited) and commit it with the first e > 0 VT-14 dataset, before the engine is run on it (§4.1); until then VT-14 runs at e = 0 only. **Revision 4 (owner direction P-1, 2026-11-15): stays open and does not block G1; VT-14 is accepted for G1 at e = 0 only (§7 VT-14).** | VT-14 at e = 0 only; G1 report says so |
| O-12 | Solver residual on hyperbolic arcs: ε_t,gen (§6.8) assumes the engine's solve ends at the noise level for E > 0; the O-1 acceptance check covered e < 1 only, and δt_α is derived for ellipses only. New in revision 4. | Verification Engineer (part D2 or later) | Derive the hyperbolic δt_α from the same ∂F/∂α expression (§6.1) with cosh/sinh magnitudes and extend the O-1 black-box check to the VT-16 hyperbolic arcs before the hyperbolic state comparison. **Closed in revision 5 (ML-TASK-018 part D3), subject to the owner's signature (§15):** δt_α,hyp = 5uκ_E(r₀)D(x)/n_h derived (§6.8); extended O-1 check defined with threshold ε_t,gen + δt_α,hyp, no margin, on the six VT-16 hyperbolic arcs and a 144-case grid (§6.8, with the near-gate supplement of review N1); thresholds committed in `o1-hyp-r5` before any engine run; the reference validated (§6.8). The evidence is the phase-2 run of that check; if any sample fails, O-12 reopens as a finding and the hyperbolic state rows stay informative (§4.1 item 6 (c)). | Until the phase-2 run: hyperbolic VT-16 state rows informative |
| O-13 | A6′ for Orekit's hyperbolic propagation is only informational (§9.3.1). New in revision 4. | Verification Engineer (part D2; change to `verification/l3/selfcheck.py`) | Make the hyperbolic energy, angular-momentum and time-of-flight measurements pass/fail against 2× the §6.8 engine bounds; commit before the engine comparison. **Closed in revision 5, subject to the owner's signature (§15):** criterion stated in §9.3.1 ("A6′ hyperbolic criterion") and implemented in `selfcheck.py` (ML-TASK-018 part D3); result in §9.3.1 ("Selfcheck result, revision 5"). No engine comparison was involved. | — (L3 VT-16 hyperbolic rows usable under §4.1 item 6 after signature) |

Changes to other documents proposed by the review are listed here, not made (outside this task's
affected paths): plan §3 VT-13 wording (C-2); ML-TASK-014 acceptance criterion (O-2); a Proposed
ADR for the degenerate convention (O-3); contract revision 3 rule (O-10); frontend conversion rule
(O-8); ML-TASK-015 acceptance criterion for O-1 and O-4. Proposed wording for each:

- Plan §3, VT-13: "velocity after = fl(velocity before + Δv_inertial), bit-identical (contract
  R12); position continuous (R8)". Decides: owner (plan change). Recommended: adopt.
- ML-TASK-014 acceptance criterion: "State→elements extracts every angle with atan2-grade
  conditioning; no acos or asin of a quantity that can approach ±1." Decides: Systems Architect
  (task contract), owner approves the task.
- ML-TASK-015 acceptance criteria: "The universal-variable solver documents its stopping criterion
  and exposes χ̂ (or the solver) through a documented function; its true time residual is within
  the budget of tolerances.md §6.1 on the evidence of O-1 (1) or (2)." and "Each sample is a
  function of (segment initial state, segment start time, t_s, constants) only." Decides: Systems
  Architect (task contract), owner approves.
- Contract revision 3, new rule: "status ok ⇒ the first sample of segment 0 is bit-identical to
  `initialState` (position and velocity)." Decides: owner.
- Frontend design note: "Scene positions are `Math.fround(x_m * s)` of the engine's binary64
  sample, one multiplication by the single scene factor s, no other CPU-side arithmetic." Decides:
  Frontend Engineer with Systems Architect review.

Revision 4 — changes needed outside this revision's paths (reported, not made):

- `verification/l3/selfcheck.py`: pass/fail checks for hyperbolic arcs against 2× the §6.8 bounds
  (O-13); part D2. **Done in revision 5** (ML-TASK-018 part D3, with the owner's knowledge that this
  file belongs to ML-TASK-012; the generator files are unchanged).
- `docs/backlog/tasks/ML-TASK-015.yaml`: status field (C-7). Decides: Coordinator.
- Optional contract clarification (O-4): "Each sample of a segment is a function of the segment's
  initial state, its start time, `t_s` and `constants` only." Decides: Systems Architect drafts,
  owner approves. Not required for revision 4 unless the owner rejects the reading of §12.
- Conformance datasets for the L2b hyperbolic trajectories (VT-16) and the L3 restart arcs
  (§9.3.2): part D2, before any engine comparison on them.

## 13. Conflicts and inconsistencies found

| # | Finding | Sources | Status |
|---|---|---|---|
| C-1 | Revision 1: `contracts-v1.md` header read "Proposed" although PR #7 was merged. | contracts-v1.md header | **Resolved**: the header reads "Accepted — owner approval 2026-11-12 (merge of PR #7)" (commit bdf763d, branch `chore/status-phase-1`; not yet on `main` when this revision was written). Revision 2 of the contract is authority. |
| C-2 | FR-006 AC3 ("velocity changes by exactly the inertial Δv") and plan VT-13 ("v⁺ − v⁻ = Δv") vs contract R12 (v⁺ = fl(v⁻ + Δv), one rounding). Taken literally, fl(v⁺ − v⁻) = Δv fails in general. This record uses the R12 form as the exact check (§1). | m1-requirements FR-006 AC3; plan §3; contract §5.3, R12 | Interpretation stated; plan wording change proposed in §12 (owner) |
| C-3 | FR-003 AC2 requires the round trip to hold "within tolerance … including degenerate cases under the documented convention"; for near-degenerate inputs below the threshold the convention itself moves the state by O(ε r) (VT-04(b)). | m1-requirements FR-003 AC2; architecture §3; contract §3 | Owner decision (O-3) |
| C-4 | FR-007 AC2 says a rendered vertex "equals" the scaled engine sample; with Float32 vertex buffers equality is attainable only under the O-8 conversion rule. | m1-requirements FR-007 AC2 | Frontend decision (O-8) |
| C-5 | Contract §13 assigns `deltaV_magnitude_mps` to VT-13 while plan §3 lists VT-13 as "position continuity; v⁺ − v⁻ = Δv". Not a contradiction; VT-13 here covers both. | contract §13; plan §3 | Noted |
| C-6 | FR-014 AC1 ("values equal the result") is attainable only with round-trip number formatting; fixed-decimal export would not meet it. | m1-requirements FR-014 AC1 | Recommendation in §1 to the task owning FR-014 |
| C-7 | `docs/backlog/tasks/ML-TASK-015.yaml` reads `status: in_review`, while `docs/status/status.json` lists ML-TASK-015 as done and the activity log records the owner's instruction to merge PR #16. The O-4 resolution (§12) relies on that contract being approved. | ML-TASK-015.yaml; status.json | Revision 4: reported to the Coordinator; outside this task's paths |
| C-8 | The L3 Orekit files store engine-vs-L2 tolerances (VT-02 M·2η, VT-12 8(12κ_h + 25)u, VT-15 approved formula) and `segment1` values from Orekit's own event state; revision 4 sets L3 rows (§9.3.1) and the restart rule (§9.3.2) that differ from them. | `test-data/l3-orekit/*`; §9.3.1, §9.3.2 | Revision 4: the record values govern; part D2 uses them (the files' stored values are not approved) |

No conflict was found between ADR-003, ADR-004, ADR-005 and the plan's tolerance method.

## 14. Sources and confirmation status

| Ref | Source | Used for | Status |
|---|---|---|---|
| [IEEE754] | IEEE Std 754-2019, *IEEE Standard for Floating-Point Arithmetic*: correctly rounded basic operations and squareRoot (clause 5.4.1), roundTiesToEven (clause 4.3) | B1, A2 | Clause numbers **to be confirmed** against the text |
| [ECMA262] | ECMA-262, *ECMAScript Language Specification* (edition current on the CI Node version): Number type as binary64 (§6.1.6.1); Math object functions, "implementation-approximated"; Number-to-String round trip (FR-014) | A1, A2, A3, §1 | **To be confirmed** (clause numbers; which Math functions are exactly specified) |
| [Higham] | N. J. Higham, *Accuracy and Stability of Numerical Algorithms*, 2nd ed., SIAM, 2002: §2.2 (standard model), Lemma 3.1 (γ_n), §3.1 (inner products), §4.3 (compensated summation) | B1–B3, §9.2 | Section and lemma numbers **to be confirmed** against the text |
| [Curtis] | H. D. Curtis, *Orbital Mechanics for Engineering Students*: Lagrange coefficients in terms of true-anomaly change (ch. 2), universal variables (ch. 3), relative motion / Clohessy–Wiltshire equations | A5, §6.1, VT-14 | Edition, chapter and equation numbers **to be confirmed** |
| [Vallado] | D. A. Vallado, *Fundamentals of Astrodynamics and Applications*, KEPLER algorithm (cited by ADR-005); Hill/Clohessy–Wiltshire solution | §6.1, VT-14 | Edition, page **to be confirmed** |
| [Hairer] | E. Hairer, S. P. Nørsett, G. Wanner, *Solving Ordinary Differential Equations I*, §II.4 (step-size/error estimation by Richardson extrapolation) | §9.2 | **To be confirmed** |
| Architecture | `docs/architecture/proposed-architecture.md` §3 | μ and reference radius values, conventions | Values confirmed only by VT-19 |
| Contract | `docs/architecture/contracts-v1.md` revision 4: §5.2 (sampling grid; initial sample, revision 3), §5.5 R8, R12, §8.3, §11.3 D1–D8, §11.4 P1–P10 | §1 exact rows, O-4, O-5, O-10, VT-16 | Accepted (owner); read for revision 4 |
| ADR-005 | `docs/architecture/adr/ADR-005-kepler-propagation-algorithm.md`, Decision and Rationale | O-4 | Accepted at G0 (2026-11-11) |
| ML-TASK-015 | `docs/backlog/tasks/ML-TASK-015.yaml`, scope item 2 and acceptance criterion 4 | O-4 | Merged with PR #16 on the owner's instruction; file status field inconsistent (C-7) |
| Orekit | Orekit 13.1.9 via orekit_jpype 13.1.9.0 (Hipparchus 4.0.3), JDK Temurin 21.0.13, Python 3.13.17; datasets `test-data/l3-orekit/`, check `verification/l3/selfcheck.py` (ML-TASK-012 part B) | §9.3, §9.3.1 (A6, A6′) | Versions as recorded in the datasets' `producedBy`; Orekit's algorithms and accuracy not documented to this record (A6) |

Derived in this document (elementary; checkable from the text): B4–B6, B8, all conditioning
factors (κ_E, κ_h, κ_b, κ_bv), the time-equation noise and solver budget (§6.1), the g-formation
and off-orbit terms, the four-term propagation model of §6, the VT-03 angle budget, the VT-04
convention bounds, the VI-03 angle rows, the §10 noise model, every budget and every evaluated
number. The CW coefficient sums of VT-14 are read off the standard CW solution (citation to be
confirmed).

## 15. Approval

| Item | Decision | Owner | Date |
|---|---|---|---|
| Method and formulas §2–§9 | Approved | Owner | 2026-11-13 |
| Derived solver budget ε_t (§6.1) | Approved | Owner | 2026-11-13 |
| O-1 acceptance threshold ε_t + δt_α (§6.1, §12) — revision 3 **correction of the O-1 check threshold**, not a loosening of any VT tolerance | Approved | Owner | 2026-11-13 |
| Margin M = 4, M_book = 2 | Approved | Owner | 2026-11-13 |
| Angular accuracy target δθ (O-6) | Approved: δθ = 1e-5 rad, independent of display formatting (ADR-008) | Owner | 2026-11-13 |
| Thresholds ε_e, ε_i (§10) | Approved: ε_e = ε_i = 1e-5; e and i never set to zero (ADR-008) | Owner | 2026-11-13 |
| Re-evaluation rule §4.1 | Approved | Owner | 2026-11-13 |
| Open items O-1…O-11 | Acknowledged as open. Already decided by the owner on 2026-11-12: O-3 (keep e and i), O-6 (principle), O-8 (scene coordinate), O-10 (contract revision 3). The others stay open with the owners named in §12 | Owner | 2026-11-13 |

**Revision 4 items** (proposed 2026-11-15; each needs the owner's signature before the engine is run
against it or against the L3 Orekit datasets):

| Item | Proposed decision | Owner | Date |
|---|---|---|---|
| P-1: VT-14 accepted for G1 at e = 0 only; O-11 open, not blocking G1 (§7 VT-14, §12) | Records the owner direction of 2026-11-15 **Approved by the owner.** | Owner | 2026-11-15 |
| P-2: VT-15 direction term (iv); non-tangential a⁺, e⁺ rows; plane-normal and plane-rotation rows; modes A/B — mode A at m > 0 only for tangential burns at an apsis (every row, plane rows included), every other burn at m > 0 in mode B (§7 VT-15, §9.3.2 item 4) | Approve the formulas and evaluated values **Approved by the owner.** | Owner | 2026-11-15 |
| P-2: correction of the tangential VT-15 formula (term (iv), magnitude part; term (i) zero at m = 0; general e⁺ formula for e⁺ < 10⁻⁶) | Approve; no approved value changes (the approved values bound the corrected formula and stay in force for the run-2 datasets) **Approved by the owner.** | Owner | 2026-11-15 |
| §4.1 item 5 (review B2, remedy (a)): revision-4 values for the L2 VT-15 and VT-16 cases already run in conformance run 2 apply only to new dataset versions committed with them in D2 before any engine run; the run-2 versions keep their approved values (VT-15 tangential) and are informative for the new rows | Approve **Approved by the owner.** | Owner | 2026-11-15 |
| P-3: hyperbolic budget §6.8, including 10κ_E·a → 10κ_E·r_max and the hyperbolic C_b recount; O-5 closed | Approve the method and the evaluated values **Approved by the owner.** | Owner | 2026-11-15 |
| P-3: VT-16 validity condition \|E\| ≥ 0.1(v²/2 + μ/r) → 0.05 (§7 VT-16) | Owner decision; recommended (adds four arcs to the toleranced set; not a loosening of any value) **Approved by the owner.** | Owner | 2026-11-15 |
| P-4: O-4 resolved on ADR-005 Decision + ML-TASK-015 contract, with the reading stated in §12; VT-09 exact | Approve, or reject the reading (then VT-09 uses §7 and a contract amendment by the Systems Architect is needed) **Approved by the owner.** | Owner | 2026-11-15 |
| L3 rows VT-02, VT-12, VT-15, VT-16 (§9.3.1) and assumption A6′ | Approve; VT-16 hyperbolic L3 rows usable only after O-13 **Approved by the owner.** | Owner | 2026-11-15 |
| L3 maneuvers at t > 0: restart from the engine's event state (§9.3.2) | Approve **Approved by the owner.** | Owner | 2026-11-15 |
| O-10 marked resolved (bookkeeping of the 2026-11-12 decision) | Acknowledge **Approved by the owner.** | Owner | 2026-11-15 |
| New open items O-12 (hyperbolic solver residual), O-13 (A6′ hyperbolic check) | Acknowledge **Approved by the owner.** | Owner | 2026-11-15 |

**Loosenings** (§4.1 item 3; each needs owner sign-off before the engine is run against it):

| Tolerance | Old value | New value | Reason | Owner | Date |
|---|---|---|---|---|---|
| | | | | | |

Revision 4 proposes no loosening. (A loosening of the C3 circularisation values proposed in the
first draft of revision 4 was withdrawn after review Q3: at m = 0 term (i) is zero and the
corrected formula gives 1.60 × 10⁻¹⁴, well inside the approved 1.7686 × 10⁻¹².)

**Revision 5 items** (proposed 2026-11-15, ML-TASK-018 part D3 phase 1; each needs the owner's
signature before the engine is run against it; the conformance tests that use them are gated):

| Item | Proposed decision | Owner | Date |
|---|---|---|---|
| O-12: δt_α,hyp = 5uκ_E(r₀)D(x)/n_h (§6.8 revision 5), derived from the §6.1 ∂F/∂α with cosh/sinh magnitudes | Approve the derivation | | |
| O-12: extended O-1 check — threshold ε_t,gen + δt_α,hyp (no margin), time equation in high precision as §6.1, cases = six VT-16 hyperbolic arcs (every Δt > 0) + 144-case grid (incl. the near-gate supplement), dataset `o1-hyp-r5`; pass = every sample; O-12 closed on a pass | Approve the check and its dataset | | |
| O-13: A6′ hyperbolic criterion (§9.3.1) — energy M[10uκ_E + 2τ_E,gen], angular momentum M[6uκ_h + 2τ_h,gen], time of flight M·2·B_tof; implemented in `selfcheck.py`; also applied to restarted arcs (`--restart`); O-13 closed on the recorded result | Approve the criterion and the result | | |
| §4.1 item 6: run-3 informative hyperbolic rows (`vt-16-r4`, `l3-r4-vt-16` segment 1) become asserted with their committed, unchanged values when (a) revision 5 is signed, (b) A6′ hyperbolic passes, (c) the extended O-1 check passes in the same run; no new dataset version (values committed before run 3) | Approve | | |
| §9.3.2 item 6: L3 `c1-escape-prograde` segment 1 (m = 0, hyperbolic) compared with an Orekit arc restarted from the engine's event state; committed values unchanged | Approve | | |

**Loosenings (revision 5): none.** For transparency, what changes relative to revision 4:

| Quantity | Revision 4 | Revision 5 | Kind |
|---|---|---|---|
| O-1 check on hyperbolic arcs | not defined (threshold NaN for α ≤ 0) | ε_t,gen + δt_α,hyp per sample (`o1-hyp-r5`) | new check |
| A6′ hyperbolic energy, ‖Δh‖/h, time of flight (`selfcheck.py`) | informational, no bound (rev. 4 text compared the time of flight with 2(ε_t,gen + δt_ph), phase part only) | pass/fail M[10uκ_E + 2τ_E,gen], M[6uκ_h + 2τ_h,gen], M·2·B_tof | new criterion (the time-of-flight bound includes the off-orbit part that the rev. 4 comparison omitted; it was never a bound, so this is not a loosening) |
| VT-16 hyperbolic states vs L2b, vs L3 | values committed, informative | same values, asserted under §4.1 item 6 | status change, values unchanged |
| L3 `c1-escape-prograde` segment 1 reference arc | Orekit's own segment 1 | Orekit restarted from the engine's event state | reference arc change, values unchanged |

No approved value changes in revision 5.
