# M1 Tolerance Record

**Document ID:** ML-VER-002 · **Date:** 2026-11-12 · **Author:** Verification Engineer (ML-TASK-010) · **Revision:** 2 (Systems Architect review of PR #12: B1–B3, N1–N9) · **Status:** Proposed — owner approval required (values are fixed at G1, verification plan §4)

Implements the tolerance policy of the [verification plan](m1-verification-plan.md) §4 (method fixed
there) for the numerical families VT-01…VT-19 and the numeric parts of VI-01…VI-03. Nothing in this
document is approved until the owner signs §15.

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
| First sample of segment 0 vs the request's `initialState` | VT-05 (Δt = 0) | **Only if adopted** in a contract revision (open item O-10): `Object.is` on every component. Otherwise the Δt = 0 tolerance of §7 VT-05 applies |
| Same-time samples of two runs with different output steps | VT-09 | **Only if** ML-TASK-015 states that a sample is a function of (segment initial state, segment start time, `t_s`, constants) only (open item O-4). Otherwise §7 VT-09 |
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
     absolute error ≤ 2.5uX; used consistently in f, ḟ, ġ this is a phase shift ≤ 2.5u n L.
   - *Time formation.* Δt = t − t₀ is one rounded subtraction (exact for segment 0): a phase
     shift ≤ u\|Δt\|.
   Together: **C_t = (15/2)κ_E + 4** (2.5 + 1 rounded up to 4). Trigonometric evaluation errors are
   absolute (≤ c_f u, A3) and enter the bounded term.
3. **Solver residual.** Let χ̂ be the returned root and t(χ̂) the **exact** value of the time
   equation at χ̂ (with the computed α, σ₀, r₀). The residual δt_res = \|t(χ̂) − Δt\| has a
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
   with χ̂ (for example g = t̂(χ̂) − χ̂³S/√μ, or any form whose error does not grow with Δt), term 4
   vanishes except for its bounded part; the bounds below remain valid (they are upper bounds).

**Time-equation evaluation noise (derived; review B1).** Fix χ and the data α̂, σ̂₀, r̂₀. The computed
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

**Floor.** For every χ the computed residual F̂(χ) − √μΔt differs from the exact one by up to
√μ δt_eval. No stopping test on the computed residual can therefore certify a true residual below
δt_eval, and at the representable χ nearest the root the computed residual can still be as large
as δt_eval plus the spacing term (dt/dχ)·u\|χ\| ≤ (r_a/√μ)u√a X = (1 + e)uX/n. The attainable true
residual of **any** Newton (or other) solve of this equation in this form is floored by δt_eval;
an engine cannot be required to do better, and this record does not assume it does.

**Solver residual budget.** A solve that stops when the computed residual is at the noise level
(computed \|F̂ − √μΔt\| ≤ √μ δt_eval) or at stagnation has a true residual ≤ (computed) + δt_eval +
spacing term:

    δt_res ≤ ε_t := u [ A_s |Δt| + B_s / n ],   A_s = 2A_e + (1 + e) = 25 + 65e,
                                                B_s = 2B_e + 2e(1 + e) = 12 + 114e + 130e²

This is the budget used in every propagation tolerance. It depends on e only through the bounded
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
table's rows with the actual term magnitudes), committed with the dataset under §4.1.

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
- Tolerance: **exact** (`Object.is`) if ML-TASK-015 states that a sample is a function of
  (segment initial state, segment start time, `t_s`, constants) only (open item O-4, recommended).
  Otherwise ‖Δr‖ ≤ 2M[P_b + v_p(4uL + 2δt_res + δt_g)], ‖Δv‖ ≤ 2M[V_b + g_p(4uL + δt_res +
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
| O-1 | Solver stopping criterion. ADR-005 fixes none; the propagation tolerances use the **derived** budget ε_t = u[(25 + 65e)\|Δt\| + (12 + 114e + 130e²)/n] (§6.1). | Astrodynamics Engineer (ML-TASK-015) proposes; Verification Engineer accepts the evidence; Systems Architect reviews | ML-TASK-015 **states its stopping criterion** in the task report and in the solver's public documentation (ML-NFR-002), and **demonstrates** that the true residual \|t(χ̂) − Δt\| of the returned χ̂ is within ε_t. Acceptable evidence that does not require the verifier to read the implementation: (1) **black-box residual check** (preferred): the solver, or an exported function returning χ̂ for (r₀, v₀, Δt, μ), is part of the documented interface; the Verification Engineer evaluates t(χ̂) in higher precision (Python `mpmath`, on the exact binary64 inputs) over the test grid plus random cases (e up to 0.95, Δt up to 100 periods, negative Δt) and records max \|t(χ̂) − Δt\|/ε_t ≤ 1; (2) the engineer's own test doing the same with an extended-precision evaluator, with the evaluator and the case list in the PR, reviewed by the verifier; (3) not sufficient alone: a step criterion \|Δχ\| ≤ ε_χ\|χ\| (bounds the residual only via ε_t = (1 + e)·max(1, 2e)·ε_χ and only if the step bounds the error), or passing VT-05…VT-09 (the break-even table, §6.7, shows a correct engine passes with residuals up to 4.5–10× ε_t, so passing does not prove the budget). A criterion below the noise floor δt_eval needs a stagnation exit and an iteration cap (it may otherwise not terminate). **No number goes into ADR-005**; a looser engine criterion does not loosen these tolerances without owner approval (§4.1). | Propagation tolerances assume δt_res ≤ ε_t |
| O-2 | Element extraction must be well conditioned (atan2 forms, B8); acos near ±1 fails VT-03/VT-04 by design. | Systems Architect (ML-TASK-014 contract), Astrodynamics Engineer | Agree with the review: add "angles extracted with atan2-grade conditioning (no acos/asin of a quantity that can approach ±1)" to the **acceptance criteria of ML-TASK-014**. It is a requirement on the algorithm, not a tolerance question. | VT-03/VT-04 may fail on an acos-based implementation |
| O-3 | Degenerate convention: thresholds ε_e, ε_i; whether near-degenerate inputs below them are in VT-04 with the convention term; whether e and i are zeroed or kept. | **Owner** (product); convention detail via a Proposed ADR by the Systems Architect | Agree with the review: **keep e and i as computed, never zero them**, and record the convention (including ϖ = Ω ± ω) in a Proposed ADR. Consequences: (a) VT-04(a) exact-degenerate inputs carry a computed ê ≤ 30u and î' ≤ (6κ_h + 2)u, so their tolerance includes the convention term at those values (§7, adds ≈ 6 × 10⁻⁸ m at LEO, inside the existing scale); (b) VT-04(b): the convention term is 2e r_a/(1 − e) and 2√2 e v_p/(1 + e) (vs ≈ a e and √2 e √(μ/a) if e were zeroed) — about twice as large, up to 140 m per element at ε = 10⁻⁵; (c) thresholds: their lower bound (§10) is unaffected, but because e and i stay continuous across the threshold only the angle convention switches, which makes the near-threshold exclusion rule of VT-04/VI-03 sufficient. I also recommend that FR-003 AC2's "within tolerance" be read, for near-degenerate inputs, as "within the numerical tolerance plus the convention term" (C-3), with ε_e = ε_i = 10⁻⁵ (§10). | VT-04(b) not runnable; FR-002 AC3 thresholds undefined |
| O-4 | Does a sample depend only on (segment initial state, segment start time, `t_s`, constants)? | Astrodynamics Engineer (ML-TASK-015); Systems Architect if made a contract rule | Agree with the review: require it (no warm start across samples, no step-dependent caching). Then **VT-09 is exact** (§1). It costs little: each sample is an independent solve from the segment start (already ADR-005's structure). | VT-09 uses the fallback tolerance (§7) |
| O-5 | Escape and surface-intersection detection semantics; near-parabolic arcs (no tolerance derived). | ML-TASK-016/017 (Astrodynamics Engineer), Systems Architect | Decide semantics in ML-TASK-016/017; VT-16 values evaluated per dataset under §4.1. | VT-16 cases restricted per §7 |
| O-6 | Angular accuracy target. Revision 1 tied the thresholds to an assumed display resolution. | **Owner** | Agree with the review: introduce an owner-approved **angular accuracy target δθ**, decoupled from UI formatting. §10 gives ε_min(N, δθ) and N_max(ε, δθ). Recommendation: δθ = 10⁻⁵ rad with ε_e = ε_i = 10⁻⁵ (worst case to ≈ 100 periods). Position/velocity display resolution remains a UI matter (only §11 uses it). | §10 shows both 10⁻⁶ and 10⁻⁵ rad; thresholds provisional |
| O-7 | VT-02 L2c and the engine may implement the same textbook map; algorithmic independence is partial. | Verification Engineer (ML-TASK-011/012) | L3 (Orekit element→state) is the independent check; L2c uses the explicit matrix product. | VT-02 rests on L2c + L3 |
| O-8 | Scene conversion for VI-02. | Frontend Engineer proposes; Systems Architect records it (frontend design note or contract) | Define the conversion as **one binary64 multiplication followed by at most one binary32 rounding**, `Math.fround(x * s)`, with no other CPU-side arithmetic before storage; then **VI-02 is exact** (§8). If GPU-side scaling is used, check buffer and scale separately (both exact). | VI-02 relative 7.2 × 10⁻⁷ |
| O-9 | Assumptions A2 (correctly rounded `Math.sqrt` under ECMA-262), A3 (transcendental accuracy ≤ 1 ulp on the CI Node version) and A6 (Orekit accuracy) unconfirmed. | Verification Engineer (ML-TASK-011/012) | Measure/confirm; any c_f > 2 or A6 failure is re-evaluated under §4.1 and listed in §15. | Formulas use c_f = 2 and A6 |
| O-10 | Is the first sample of every segment bit-identical to the segment's initial state? For segments n ≥ 1 R8 already makes it so (event state); for segment 0 the contract is silent. | **Owner** (contract revision 3, drafted by the Systems Architect) | Agree with the review: adopt "first sample of every segment is bit-identical to the segment's initial state" (segment 0: the request's `initialState`). Tolerance both ways: **if adopted**, VT-05 at Δt = 0 is `Object.is` per component (§1); **if not**, ‖Δr‖ ≤ M P_E(0), ‖Δv‖ ≤ M V_E(0) (C1 5.7 × 10⁻⁷ m / 8.1 × 10⁻¹⁰ m/s, §7). | Fallback tolerance at Δt = 0 |
| O-11 | VT-14 transport factors K_r(e), K_v(e) for e > 0 not derived (e = 0: Clohessy–Wiltshire, K_r = 14, K_v = 9, citation to be confirmed). New in revision 2. | Verification Engineer (ML-TASK-011) | Derive K(e) from the elliptic state-transition matrix (literature source to be cited) and commit it with the first e > 0 VT-14 dataset, before the engine is run on it (§4.1); until then VT-14 runs at e = 0 only. | VT-14 evaluated at C1 only |

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

## 13. Conflicts and inconsistencies found

| # | Finding | Sources | Status |
|---|---|---|---|
| C-1 | Revision 1: `contracts-v1.md` header read "Proposed" although PR #7 was merged. | contracts-v1.md header | **Resolved**: the header reads "Accepted — owner approval 2026-11-12 (merge of PR #7)" (commit bdf763d, branch `chore/status-phase-1`; not yet on `main` when this revision was written). Revision 2 of the contract is authority. |
| C-2 | FR-006 AC3 ("velocity changes by exactly the inertial Δv") and plan VT-13 ("v⁺ − v⁻ = Δv") vs contract R12 (v⁺ = fl(v⁻ + Δv), one rounding). Taken literally, fl(v⁺ − v⁻) = Δv fails in general. This record uses the R12 form as the exact check (§1). | m1-requirements FR-006 AC3; plan §3; contract §5.3, R12 | Interpretation stated; plan wording change proposed in §12 (owner) |
| C-3 | FR-003 AC2 requires the round trip to hold "within tolerance … including degenerate cases under the documented convention"; for near-degenerate inputs below the threshold the convention itself moves the state by O(ε r) (VT-04(b)). | m1-requirements FR-003 AC2; architecture §3; contract §3 | Owner decision (O-3) |
| C-4 | FR-007 AC2 says a rendered vertex "equals" the scaled engine sample; with Float32 vertex buffers equality is attainable only under the O-8 conversion rule. | m1-requirements FR-007 AC2 | Frontend decision (O-8) |
| C-5 | Contract §13 assigns `deltaV_magnitude_mps` to VT-13 while plan §3 lists VT-13 as "position continuity; v⁺ − v⁻ = Δv". Not a contradiction; VT-13 here covers both. | contract §13; plan §3 | Noted |
| C-6 | FR-014 AC1 ("values equal the result") is attainable only with round-trip number formatting; fixed-decimal export would not meet it. | m1-requirements FR-014 AC1 | Recommendation in §1 to the task owning FR-014 |

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

Derived in this document (elementary; checkable from the text): B4–B6, B8, all conditioning
factors (κ_E, κ_h, κ_b, κ_bv), the time-equation noise and solver budget (§6.1), the g-formation
and off-orbit terms, the four-term propagation model of §6, the VT-03 angle budget, the VT-04
convention bounds, the VI-03 angle rows, the §10 noise model, every budget and every evaluated
number. The CW coefficient sums of VT-14 are read off the standard CW solution (citation to be
confirmed).

## 15. Approval

| Item | Decision | Owner | Date |
|---|---|---|---|
| Method and formulas §2–§9 | | | |
| Derived solver budget ε_t (§6.1) | | | |
| Margin M = 4, M_book = 2 | | | |
| Angular accuracy target δθ (O-6) | | | |
| Thresholds ε_e, ε_i (§10) | | | |
| Re-evaluation rule §4.1 | | | |
| Open items O-1…O-11 | | | |

**Loosenings** (§4.1 item 3; each needs owner sign-off before the engine is run against it):

| Tolerance | Old value | New value | Reason | Owner | Date |
|---|---|---|---|---|---|
| | | | | | |
