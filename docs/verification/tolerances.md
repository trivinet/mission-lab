# M1 Tolerance Record

**Document ID:** ML-VER-002 · **Date:** 2026-11-12 · **Author:** Verification Engineer (ML-TASK-010) · **Status:** Proposed — owner approval required (values are fixed at G1, verification plan §4)

Implements the tolerance policy of the [verification plan](m1-verification-plan.md) §4 (method fixed
there) for the numerical families VT-01…VT-19 and the numeric parts of VI-01…VI-03. Nothing in this
document is approved until the owner signs §15.

## 0. Independence statement

- Read: AGENTS.md, verification plan, ADR-003, ADR-004, ADR-005, `docs/architecture/contracts-v1.md`,
  `docs/architecture/proposed-architecture.md` §3, `docs/requirements/m1-requirements.md`,
  `docs/product/ML-SYS-001.md` §5.3–§5.5 and §8, coding standards, task template.
- Not read: `packages/astrodynamics`, `packages/simulation` (placeholders today). No engine result
  exists. No numerical experiment standing in for the engine was run. The only computation done
  was evaluating the formulas below at the evaluation scales of §4 (a Node.js script, 64-bit
  floats, in a scratch directory outside the repository; it can be reproduced with a calculator
  from the scale table).
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

Everything else below needs a tolerance.

## 2. Error-model building blocks

**Notation.** u = 2⁻⁵³ ≈ 1.1102 × 10⁻¹⁶ (unit round-off of binary64, round-to-nearest).
γ_n = nu/(1 − nu); every bound below is written to first order in u (γ_n → nu); the neglected
O(n²u²) terms are below 10⁻²⁸ relative for every n used here and are covered by the margin.
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
  every tolerance containing c_f is re-evaluated by its formula (no new approval needed for a
  re-evaluation; a formula change needs approval).
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
3. The bounds are worst-case (not probabilistic): typical errors are one to three orders of
   magnitude smaller, so a result failing a worst-case bound × 4 is a strong defect signal.
4. The margin must stay far below the size of any modelled defect; each family states its
   detection power.

Margins are never chosen after seeing a result. A larger margin anywhere needs a written
justification and owner approval (plan §4).

## 4. Evaluation scales

The verification plan §5 names the grid cases; ML-TASK-011 fixes their exact element values with
each dataset. To give the formulas numeric values now, they are evaluated at the following
**evaluation scales** (chosen by the Verification Engineer; they are inputs, not reference values).
The formulas are normative; if a dataset uses a larger scale (larger a, e or span), its tolerance
is the formula re-evaluated at that scale and recorded in the dataset.

- μ = 3.986004418 × 10¹⁴ m³/s², exactly as written in
  [proposed-architecture.md §3](../architecture/proposed-architecture.md#3-scientific-conventions-proposed-see-adr-004-adr-005)
  (WGS 84 value, **confirmed only by VT-19**). R_ref (reference radius) is used only symbolically;
  the evaluation cases satisfy a(1 − e) > 6.5 × 10⁶ m, above the 6 378 137 m written in the same
  section.
- Span: N = 10 periods (the largest span evaluated; "multi-period" in FR-004 AC1). Fractional
  spans use the same formulas with smaller Δt.
- Solver residual ε_t = 8u (evaluation assumption, **open item O-1**).

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
| C1/C2 | 7.000e6 | 5.829e3 | 5.921e4 | 7.546e3 | 8.135 | 5.282e10 | 2.847e7 | 1.0000 | 3.0000 | 5.0000 | 8.0000 | 28.50 |
| C3 | 1.300e7 | 9.952e3 | 1.011e5 | 8.604e3 | 8.135 | 6.023e10 | 1.993e7 | 1.0483 | 4.7143 | 5.9054 | 9.7143 | 41.36 |
| C4 | 1.680e7 | 1.308e4 | 1.329e5 | 8.804e3 | 7.689 | 6.339e10 | 1.661e7 | 1.0911 | 5.6667 | 6.4244 | 10.667 | 48.50 |
| C5 | 4.524e7 | 4.172e4 | 4.239e5 | 1.013e4 | 8.723 | 6.847e10 | 7.665e6 | 1.4868 | 14.385 | 11.179 | 19.385 | 113.9 |
| C6 | 4.200e7 | 8.566e4 | 8.702e5 | 3.081e3 | 0.2260 | 1.294e11 | 4.745e6 | 1.0000 | 3.0000 | 5.0000 | 8.0000 | 28.50 |

Useful products: u × 7.0 × 10⁶ m = 7.7716 × 10⁻¹⁰ m; u × 7546 m/s = 8.3777 × 10⁻¹³ m/s.

## 5. Display resolution used to judge the indicative expectation

No document fixes the UI display resolution. For §11 only, this record assumes 1 m in position
(km with three decimals), 1 mm/s in velocity and 10⁻⁶ rad in angles (≈ 6 × 10⁻⁵ degree).
**Open item O-6.**

## 6. Shared propagation error model (used by VT-05…VT-09, VT-14…VT-16)

### 6.1 Structure

ADR-005 propagates every sample from the segment's initial state (r₀, v₀) at Δt = t − t₀ by
solving the universal Kepler equation for χ and forming r = f r₀ + g v₀, v = ḟ r₀ + ġ v₀
([Vallado] KEPLER algorithm; [Curtis] ch. 3 — editions and page numbers to be confirmed). The
computed state differs from the exact one by three kinds of error:

1. **Bounded (off-orbit) rounding** in f, g, ḟ, ġ and in the linear combinations. Does not grow
   with Δt.
2. **Phase (along-track) error** that grows linearly with Δt. Two mechanisms, both elementary:
   - *Mean-motion sensitivity.* α = 2/r₀ − v₀²/μ (= 1/a) is evaluated with cancellation:
     \|δα\| ≤ γ_5 (2/r₀ + v₀²/μ) (B1–B4: ‖r₀‖ 3u, division u, v·v γ_3, division u, subtraction u),
     so \|δα/α\| ≤ 5u(4a/r₀ − 1) ≤ 5u κ_E, using v² = μ(2/r − 1/a). With n ∝ a^(−3/2),
     δn/n = (3/2)δa/a, the mean-anomaly error after Δt is (3/2)(5uκ_E) n Δt, and since
     ‖∂r/∂M‖ = v/n, the position error is ≤ (15/2) κ_E u · v_p · Δt.
   - *Time and phase rounding.* g = Δt − χ³S/√μ cancels two terms of size ≈ Δt (≤ 2u Δt); the
     Stumpff argument and its trigonometric evaluation at large argument (multi-revolution) carry
     relative errors of a few u, i.e. a phase error ∝ n Δt. Budget: 6u (2u cancellation, 2u argument
     formation, c_f u = 2u trigonometric). Position error ≤ 6u · v_p · Δt.
   Together: C_t = (15/2)κ_E + 6.
3. **Solver error.** Let χ̂ be the returned root and t(χ̂) the time of flight given by the universal
   Kepler equation at χ̂. The **time residual** δt_res = \|t(χ̂) − Δt\| maps to a position error
   ≤ v_p δt_res and a velocity error ≤ g_p δt_res. This record parametrises the solver by
   ε_t: δt_res ≤ ε_t (\|Δt\| + 1/n). If ML-TASK-015 instead stops on a step criterion
   \|Δχ\| ≤ ε_χ\|χ\| and justifies that this bounds the error of the returned χ̂, then, from
   dt/dχ = r/√μ ≤ r_a/√μ and \|χ\| ≤ √a(n\|Δt\| + 2e) (elliptic, χ = √a ΔE and
   \|ΔE − ΔM\| ≤ 2e), δt_res ≤ ε_χ(1 + e)(\|Δt\| + 2e/n), i.e. ε_t = (1 + e)·max(1, 2e)·ε_χ.
   ADR-005 fixes no number (**open item O-1**). Evaluation uses ε_t = 8u (solver converged to
   rounding level).

Velocity errors have the same structure with v_p replaced by g_p in the time-like terms (a time
error δt moves the velocity by at most g_p δt).

### 6.2 Size of the bounded term

Writing the bounded rounding as ≤ C_b u (\|f\| r₀ + \|g\| v₀ + r_a) (coefficient errors relative to
1 + \|f\| and to \|g\|, plus γ_2 for the combination), the magnitudes are bounded by A5:
\|f\| ≤ 1 + 2r/p ≤ 1 + 2/(1 − e) (since r_a/p = 1/(1 − e)), and \|g\| v₀ = r r₀ v₀ \|sin Δν\|/h ≤
r_a/cos φ₀ ≤ r_a κ_h, where φ is the flight-path angle and cos φ ≥ √(1 − e²) on an ellipse. Hence
\|f\| r₀ + \|g\| v₀ + r_a ≤ κ_b r_a with **κ_b = 2 + 2/(1 − e) + κ_h**, **κ_h = 1/√(1 − e²)**.
For the velocity, \|ġ\| ≤ 1 + 2/(1 − e) (A5) and \|ḟ\| r₀ = ‖v − ġ v₀‖ ≤ v_p(2 + 2/(1 − e))
(triangle inequality), so \|ḟ\| r₀ + \|ġ\| v₀ + v_p ≤ κ_bv v_p with **κ_bv = 4 + 4/(1 − e)**.

C_b = 20: per coefficient about 8u (Stumpff function 1u argument + c_f u + 2u division by ψ,
χ² and product 2u, division by r₀ or √μ 1u, final subtraction 1u, rounded up), two coefficients per
vector, plus γ_2 = 2u for the combination, rounded up to 20.

The α error also changes the orbit size by δa ≤ 5uκ_E a, adding ≤ 10uκ_E a to the radial position
and ≤ 5uκ_E v_p to the speed (vis-viva, elementary). **κ_E = 4/(1 − e) − 1** is the maximum over
the orbit of (v²/2 + μ/r)/\|E\| = 4a/r − 1 (energy cancellation factor).

### 6.3 Engine bound (unmargined)

    P_b = u [C_b κ_b r_a + 10 κ_E a]                 V_b = u [C_b κ_bv + 5 κ_E] v_p
    P_E(Δt) = P_b + (u C_t + ε_t) v_p L              V_E(Δt) = V_b + (u C_t + ε_t) g_p L
    L = |Δt| + 1/n,   C_b = 20,   C_t = (15/2) κ_E + 6

The 1/n in L keeps a bounded phase term at small Δt.

### 6.4 Reference bound for L2a (classical elements + Newton–Kepler), unmargined

L2a converts the initial state to elements (§VT-03 budget), advances M = M₀ + nΔt, solves
Kepler's equation by Newton to rounding level (stop when \|ΔE\| ≤ 2u max(1, \|E\|) or stagnation;
time-equivalent residual ≤ 4u), and converts back. Its α/n error has the same conditioning as the
engine's (n from a). Hence:

    P_A(Δt) = u B_rt r_a + (u C_t + 4u) v_p L        V_A(Δt) = u B_vt v_p + (u C_t + 4u) g_p L

with B_rt, B_vt the round-trip budgets of VT-03.

### 6.5 Evaluated (N = 10 periods, ε_t = 8u)

| Case | P_b (m) | V_b (m/s) | P_E(10T) (m) | V_E (m/s) | P_A (m) | V_A (m/s) |
|---|---|---|---|---|---|---|
| C1/C2 | 1.010e-7 | 1.466e-10 | 1.912e-6 | 2.099e-9 | 1.759e-6 | 1.889e-9 |
| C3 | 2.228e-7 | 2.081e-10 | 4.990e-6 | 4.715e-9 | 4.724e-6 | 4.353e-9 |
| C4 | 3.151e-7 | 2.362e-10 | 7.655e-6 | 6.646e-9 | 7.315e-6 | 6.196e-9 |
| C5 | 1.538e-6 | 5.169e-10 | 5.964e-5 | 5.055e-8 | 5.878e-5 | 4.891e-8 |
| C6 | 6.062e-7 | 5.985e-11 | 1.147e-5 | 8.567e-10 | 1.055e-5 | 7.713e-10 |

Worked arithmetic, C1: P_b = u(20·5·7e6 + 10·3·7e6) = 130 × 7.7716e-10 = 1.0103e-7 m.
P_E = 1.0103e-7 + (28.5 + 8)u · 7546 · 59 213 = 1.0103e-7 + 4.0523e-15 · 7546 · 59 213 =
1.0103e-7 + 1.8107e-6 = 1.912e-6 m. Split for C1: bounded 1.0e-7, mean-motion/phase 1.41e-6,
solver 3.97e-7 m. The along-track terms dominate for every case from about one period on.

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
  - Angles: three atan2 evaluations, each ≤ c_f π u + √2 × (input error) ≈ 6.3u + O(10u): budget
    50u in r·δθ. For e → 0 (i → 0) the individual angles ω, ν (Ω, ω) are ill-conditioned, but if ν
    is measured from the same computed eccentricity (node) direction the errors cancel in
    ω + ν (Ω + ω), and the position depends only on the sum; the cancellation is exact in exact
    arithmetic for any direction, so only the rounding of the atan2 calls remains.
  - Back conversion: η_r(e), η_v(e) of VT-02.
  - **B_rt(e) = 5κ_E + 90/(1 − e) + 50 + 31 + 2/(1 − e²) + (1 + 3e)/(1 − e)**;
    **B_vt(e) = 2.5κ_E + 90/(1 − e) + 75 + 1/(1 − e²) + 7/(1 + e)**.
- Reference: L1 (the original state, exact).
- Tolerance: ‖Δr‖ ≤ M B_rt u r_a, ‖Δv‖ ≤ M B_vt u v_p. Evaluated: C1/C2: B_rt = 189, B_vt = 180.5:
  r 4·189 × 7.7716e-10 = **5.88 × 10⁻⁷ m**, v 4·180.5 × 8.3777e-13 = **6.05 × 10⁻¹⁰ m/s**; C3
  1.37e-6 m / 8.48e-10; C4 1.98e-6 m / 9.59e-10; C5 (B_rt = 515.9, B_vt = 463.4) **1.04 × 10⁻⁵ m /
  2.08 × 10⁻⁹ m/s**; C6 3.53e-6 m / 2.47e-10.
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
- (a) **Exactly degenerate inputs** (e = 0 and/or i ∈ {0, `Math.PI`}): VT-03 formula at e = 0:
  **5.88 × 10⁻⁷ m and 6.05 × 10⁻¹⁰ m/s at C1/C2 scale**. Note i = `Math.PI` differs from π by at
  most half an ulp of π (2⁻⁵², B1), so the "retrograde equatorial" state has an out-of-plane
  component of order 2⁻⁵² r, inside this tolerance.
- (b) **Near-degenerate inputs below a threshold** (0 < e < ε_e, or 0 < i' < ε_i with
  i' = min(i, π − i)): applying the convention moves the reconstructed state by a non-numerical,
  derived amount: setting ω := 0 with e kept moves the periapsis by up to π, changing r by
  ≤ 2e r (relative, to first order in e) and v by ≤ 2e v_p; replacing R₃(Ω)R₁(i)R₃(ω) by
  R₁(i)R₃(Ω + ω) changes the matrix by the commutator [R₃(Ω), R₁(i)]R₃(ω), whose 2-norm is
  ≤ 2‖R₁(i) − I‖ = 4 sin(i/2). Tolerance:
  ‖Δr‖ ≤ M B_rt u r_a + r_a(2e·[e < ε_e] + 4 sin(i'/2)·[i' < ε_i]),
  ‖Δv‖ ≤ M B_vt u v_p + v_p(2e·[e < ε_e] + 4 sin(i'/2)·[i' < ε_i]).
  The convention term has no margin (it is a bound, not an estimate of rounding). With ε = 10⁻⁵
  (§10) it reaches 2 × 10⁻⁵ × 7 × 10⁶ = **140 m** at LEO scale. Whether FR-003 AC2 ("round trip holds
  … including degenerate cases under the documented convention") accepts this for near-degenerate
  cases is an owner decision (**open item O-3**; conflict C-3).
- Layers: L1 (round trip); L2 (reference element extraction with the same convention).
- Cases within a factor 2 of a threshold are not used (the classification may legitimately differ
  between engine and reference).

### VT-05 Circular and elliptical propagation (L2a, L2b, L3)

- Quantity: state at fractional and multi-period times vs reference.
- Measure: ‖Δr‖ (m), ‖Δv‖ (m/s), thresholds from §6 (absolute, scale-dependent).
- Error model: §6 (engine), §6.4 (L2a).
- Tolerance vs **L2a**: ‖Δr‖ ≤ M[P_E(Δt) + P_A(Δt)], ‖Δv‖ ≤ M[V_E(Δt) + V_A(Δt)].
  Evaluated at Δt = 10T: C1/C2 4·(1.912e-6 + 1.759e-6) = **1.47 × 10⁻⁵ m**, **1.60 × 10⁻⁸ m/s**;
  C3 3.89e-5 m / 3.63e-8 m/s; C4 5.99e-5 m / 5.14e-8 m/s; C5 **4.74 × 10⁻⁴ m / 3.98 × 10⁻⁷ m/s**;
  C6 8.81e-5 m / 6.51e-9 m/s.
- Tolerance vs **L2b** (RK): ‖Δr‖ ≤ M P_E(Δt) + 2E_RK,r, ‖Δv‖ ≤ M V_E(Δt) + 2E_RK,v, where E_RK is
  the step-halving estimate of the RK reference recorded in its dataset **before** the engine is run
  (§9.2). No numeric value yet (depends on the reference run). Factor 2 on E_RK: the undivided
  halving difference already over-estimates the truncation error by 2^p − 1 in the asymptotic
  regime; the extra factor covers the round-off part, which does not scale with h.
- Tolerance vs **L3**: §9.3 (Orekit), §9.4 (textbook).
- Post-maneuver segments: the reference starts from the engine's event state (`position_m`,
  `velocityAfter_mps`) and the same formula applies with Δt = t − m. (Starting it from an exact
  post-maneuver state would add the transport term of VT-14.)
- Margin: M = 4.
- Detection power (C1, 10T): a relative μ error δ shifts the along-track position by ≈ a·(δ/2)·2πN =
  2.2 × 10⁸ δ m, detected for δ > 7 × 10⁻¹⁴; a timing error δt is detected for δt > 2 × 10⁻⁹ s.

### VT-06 Energy conservation (L1)

- Quantity: \|E_k − E₀\|/\|E₀\| on every sample, E = v²/2 − μ/r evaluated by the test.
- Measure: relative (E₀ ≠ 0 for every closed orbit; \|E\| = μ/(2a) sets the scale).
- Error model: (i) test evaluation of E: γ_5(v²/2 + μ/r) = 5uκ_E\|E\| each, two evaluations:
  10uκ_E; (ii) off-orbit state errors δE ≤ v δv + (μ/r²) δr with the bounded terms P_b, V_b;
  (iii) the off-orbit part of the time-like error: the cancellation in g (2u) and the solver
  residual (ε_t) displace r along v₀, not along the orbit, if the engine forms g from the requested Δt
  (the textbook form), giving δE ≤ g_p v_p (2u + ε_t) L. Phase errors along the orbit do not change
  E: f, g, ḟ, ġ computed from one χ give a point of the exact orbit.
- Tolerance: τ_E(Δt) = M[10uκ_E + (v_p V_b + g_p P_b)/\|E\| + (v_p g_p/\|E\|)(2u + ε_t) L].
  Worked, C1, 10T: 30u = 3.33e-15; (7546 × 1.466e-10 + 8.135 × 1.0103e-7)/2.847e7 = 6.77e-14;
  (7546 × 8.135/2.847e7) × 10u × 59 213 = 1.42e-13; sum 2.128e-13; × 4 = **8.5 × 10⁻¹³**.
  C3 2.32e-12; C4 3.52e-12; C5 **3.15 × 10⁻¹¹**; C6 8.5e-13.
- Margin: M = 4.
- Note: term (iii) grows linearly with Δt; it vanishes if the engine evaluates g consistently with
  χ̂ (then the solver error is a pure phase error).
- Detection power: if the engine used μ(1 + δ) instead of the request's μ, the test's E would vary
  over an orbit by δμ(1/r_p − 1/r_a), i.e. by δ·4e/(1 − e²) relative to \|E\| (= 1.9δ for C4),
  detected for δ ≳ 2 × 10⁻¹² (C4). Not sensitive for e = 0 (VT-05 covers that).

### VT-07 Angular momentum conservation (L1)

- Quantity: ‖h_k − h₀‖/‖h₀‖, h = r × v (vector, evaluated by the test).
- Measure: normwise relative to ‖h₀‖ = √(μp) > 0.
- Error model: cross products 3u r v each (B5), r v/h ≤ κ_h: 6uκ_h; off-orbit errors
  δh ≤ δr v + r δv: (P_b v_p + r_a V_b)/h; off-orbit time-like displacement along v₀:
  v_p²(2u + ε_t)L/h.
- Tolerance: τ_h(Δt) = M[6uκ_h + (P_b v_p + r_a V_b + v_p²(2u + ε_t)L)/h].
  Evaluated (10T): C1/C2 **4.2 × 10⁻¹³**; C3 8.6e-13; C4 1.15e-12; C5 **5.1 × 10⁻¹²**; C6 4.2e-13.
- Margin: M = 4. Layers: L1.
- Detection power: a frame or sign error rotating the plane by θ gives ‖Δh‖/h ≈ θ; detected for
  θ > 10⁻¹² rad.

### VT-08 Full-period closure (L1)

- Quantity: state at t = NT vs initial state, where T is computed by the test from the initial
  state (T = 2π√(a³/μ), a from vis-viva) and `duration_s` is set to fl(N·T) so that the end time is
  an exact sample (R10).
- Measure: ‖Δr‖, ‖Δv‖.
- Error model: engine P_E(NT), V_E(NT); plus the test's period error δT/T ≤ (3/2)(5uκ_E) + 6u
  (a³, 2π product, division, square root, N·T), which moves the comparison time by NT·δT/T.
- Tolerance: ‖Δr‖ ≤ M[P_E(NT) + u(7.5κ_E + 6) v_p NT], ‖Δv‖ ≤ M[V_E(NT) + u(7.5κ_E + 6) g_p NT].
  Evaluated (N = 10): C1/C2 **1.32 × 10⁻⁵ m / 1.44 × 10⁻⁸ m/s**; C3 3.57e-5 / 3.37e-8; C4 5.54e-5 /
  4.83e-8; C5 **4.52 × 10⁻⁴ m / 3.86 × 10⁻⁷ m/s**; C6 7.93e-5 / 5.88e-9.
- Margin: M = 4. Layers: L1 (exact reference: the input state).
- Detection power: as VT-05.

### VT-09 Sampling independence (L1)

- Quantity: the same request with two output steps; states at bit-identical `t_s`.
- Measure: ‖Δr‖, ‖Δv‖.
- Error model: both runs start from the same initial state and evaluate the same Δt, so α, the
  time rounding and the phase terms are identical. They can differ only if the root solve depends on
  neighbouring samples (e.g. a warm start from the previous sample's χ): then the two roots differ
  by ≤ 2 solver errors and the bounded rounding differs.
- Tolerance: if ML-TASK-015 guarantees that a sample depends only on (segment start, Δt) — no
  warm start — the check is **exact** (`Object.is`). Otherwise ‖Δr‖ ≤ M[2ε_t v_p L + 2P_b],
  ‖Δv‖ ≤ M[2ε_t g_p L + 2V_b]: C1/C2 **3.98 × 10⁻⁶ m / 4.60 × 10⁻⁹ m/s**; C3 7.96e-6 / 7.51e-9;
  C4 1.08e-5 / 9.15e-9; C5 4.28e-5 / 3.04e-8; C6 2.39e-5 / 1.88e-9 (10T). **Open item O-4.**
- Post-maneuver segments: the maneuver time m is a sample of every grid (§5.2), so the event
  state is a common-time state and the same rule applies.
- Margin: M = 4.

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
- Tolerance: orthonormality and handedness: M(2ε_S + 3u) = **4(12κ_h + 25)u**: e = 0 **1.64 ×
  10⁻¹⁴**; C5 (κ_h = 1.487) 1.90e-14. R ∥ r: M·2ε_R = 32u = 3.6e-15. W ∥ r × v: M·2ε_W =
  4(12κ_h + 8)u: e = 0 8.9e-15.
- Margin: M = 4. Layers: L1.

### VT-12 Maneuver frame transformation (L2c)

- Quantity: `deltaV_inertial_mps` vs reference Δv_I = ΔvR R + ΔvS S + ΔvW W.
- Measure: ‖ΔΔv_I‖ relative to ‖Δv_RSW‖ (normwise).
- Error model: basis errors Σε = ε_R + ε_S + ε_W = (12κ_h + 19)u; combination γ_3 with
  Σ\|Δv_k\|‖b_k‖ ≤ √3‖Δv‖: 5.2u; total (12κ_h + 24.2)u for each of engine and reference.
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
- Margin: M = 4.

### VT-14 Zero-magnitude maneuver (L1)

- Exact parts: §1 (Δv_I = ±0, v⁺ `===` v⁻).
- Quantity: maneuvered run state at t > m vs coast run at t.
- Error model: the coast run has error P_E(t). The maneuvered run starts its second segment from
  the computed state at m (error P_E(m)): its time-like part is a time shift carried forward
  (≤ (uC_t + ε_t) v_p L_m); its off-orbit part changes the energy by ≤ τ_E⁰(m) relative (τ_E⁰ = the
  unmargined VT-06 bound), hence the mean motion by (3/2)τ_E⁰(m), giving a drift
  (3/2) τ_E⁰(m) v_p (t − m); plus the new segment's own error P_E(t − m).
- Tolerance: ‖Δr‖ ≤ M[P_E(t) + (uC_t + ε_t) v_p L_m + P_E(t − m) + (3/2) τ_E⁰(m) v_p (t − m)]
  (velocity: v_p → g_p in the time-like terms, P → V). Evaluated, C4, m = T, t = 10T
  (τ_E⁰(T) = 3.46 × 10⁻¹³): **2.2 × 10⁻³ m and 1.9 × 10⁻⁶ m/s**. The transported energy term
  dominates; it is a worst-case bound.
- Margin: M = 4.

### VT-15 Post-maneuver orbit (L1, L2) — also ML-FR-010 AC3

- Quantities: a⁺ and e⁺ from the engine's post-maneuver state (evaluated by the test) vs closed
  form for a tangential burn at an apsis (vis-viva: a⁺ = 1/(2/r − (v + Δv)²/μ), e⁺ = \|1 − r/a⁺\|),
  and post-maneuver elements vs the L2 reference.
- Measure: a⁺ relative; e⁺ **absolute** (e⁺ can be 0: circularisation).
- Error model: (i) the pre-maneuver state's energy error ≤ τ_E⁰(m)\|E⁻\|; (ii) the rounding of
  v⁻ + Δv (≤ u\|v⁺\| per component) changes E by ≤ u v⁺²; (iii) closed form and test evaluation of
  E⁺ each γ_5(v⁺²/2 + μ/r). A phase (time) error at the apsis changes r and the along-track speed
  only to second order (both stationary at an apsis), so it is neglected. Dividing by
  \|E⁺\| = μ/(2a⁺): (ii) gives u(4a⁺/r − 2), (iii) 10u(4a⁺/r − 1).
- Tolerance: \|δa⁺\|/a⁺ ≤ M[τ_E⁰(m)·a⁺/a⁻ + 11u(4a⁺/r − 1)]; \|δe⁺\| ≤ M[(r/a⁺)(\|δa⁺\|/a⁺)/M + 60u]
  (60u: e-vector evaluation, 30u each in test and engine-state evaluation, §VT-03).
  Evaluated, C4 burn +100 m/s along S at m = T: perigee (r = 7.2e6, a⁺ = 1.268e7): **1.5 × 10⁻¹²
  relative (1.9 × 10⁻⁵ m)**, e⁺ **8.7 × 10⁻¹³**; apogee (r = 1.68e7, a⁺ = 1.228e7): 1.4 × 10⁻¹²
  relative, e⁺ 2.0 × 10⁻¹².
- Near-parabolic results (\|E⁺\| < 0.1(v⁺²/2 + μ/r)): a⁺ is ill-conditioned (κ → ∞); compare
  E⁺ in absolute terms instead, \|δE⁺\| ≤ M[τ_E⁰(m)\|E⁻\| + 11u(v⁺²/2 + μ/r)].
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
  same steps as §6.2 without the ellipse bounds). Valid only when \|E\| ≥ 0.1(v²/2 + μ/r) at the
  start of the arc; near-parabolic arcs are excluded from the grid (no tolerance derived — open
  item O-5).
- Tolerance: ‖Δr‖ ≤ M P_E,gen(Δt) + 2E_RK,r (velocity analogous). Numeric value: evaluated per
  dataset in ML-TASK-011 (the escape Δv is not fixed yet).
- **Case selection margins** (not tolerances): an escape case has \|E⁺\| ≥ 10⁻⁶(v⁺²/2 + μ/r); a
  surface-intersection case has \|r_p⁺ − R_ref\| ≥ 10⁻⁶ R_ref. Both are ≥ 10⁶ times the evaluation
  noise of the decision quantity, so the expected warning is unambiguous. Detection semantics
  (analytic perigee vs sampled radius; whether the perigee passage must fall inside the span) are
  owned by ML-TASK-016/017 (contract §8.3) and not decided (**open item O-5**).

### VT-17, VT-18, VT-19 — exact (§1).

## 8. Integration families (numeric parts)

- **VI-01**: exact (§1).
- **VI-02** (rendered vertex = engine sample × single scene-unit factor s, FR-007 AC2): exact
  (compare with fl(x × s)) if the scene keeps binary64 and multiplies once. If vertices are stored as
  `Float32Array` (typical for WebGL buffers), conversion and scaling give ≤ 3u₃₂ relative,
  u₃₂ = 2⁻²⁴ ≈ 5.96 × 10⁻⁸: ‖Δ‖ ≤ M·3u₃₂‖x s‖ = **7.2 × 10⁻⁷ relative** (normwise; ≈ 30 m at
  4.2 × 10⁷ m before scaling). Which applies is a frontend design decision (**conflict C-4**,
  open item O-8).
- **VI-03** (analysis outputs vs values recomputed by the test from the same result state; no
  propagation error enters). Exact if the analysis module is the shared implementation and the
  test reuses it; otherwise, with κ_E(r) = (v²/2 + μ/r)/\|E\|:

| Quantity | Measure | Tolerance |
|---|---|---|
| ‖r‖, ‖v‖ | relative | M·6u = 24u |
| Altitude ‖r‖ − R_ref | absolute (cancellation near the surface) | M(6u‖r‖ + 2u\|alt\|) |
| Specific energy | absolute | M·10u(v²/2 + μ/r) |
| a | relative | M·11u·κ_E(r) |
| e | absolute | M·60u = 240u ≈ 2.7 × 10⁻¹⁴ |
| i | absolute (rad) | M·2(6.3 + 4.3κ_h)u |
| Ω (only if not equatorial) | absolute, compared modulo 2π | M·2(12.6 + 6(κ_h + 1)/sin i)u |
| ω, ν (only if not circular) | absolute, compared modulo 2π | M·2(12.6 + 45/e)u |

  Samples with e or i' within a factor 2 of a threshold of §10 are excluded (classification may
  differ). Angle differences are reduced to (−π, π] before comparison.

## 9. Reference accuracy and validation (before any engine comparison)

### 9.1 L2a (classical elements, Newton–Kepler)

Bounded by §6.4. Validated against L2b on every grid case (agreement within M·P_A + 2E_RK) and
by its own VT-06/VT-07/VT-08 invariants with the formulas above (P_E → P_A, ε_t → 4u).

### 9.2 L2b (fixed-step high-order RK) — step halving

For each case run step sizes h, h/2, h/4. Record d₁ = ‖y_h − y_{h/2}‖, d₂ = ‖y_{h/2} − y_{h/4}‖ at
every compared time. Asymptotic regime is confirmed when 2^(p−1) ≤ d₁/d₂ ≤ 2^(p+1) (p the method
order; Richardson argument, [Hairer] §II.4 — to be confirmed). Then E_RK := d₂ (undivided, ≥ the
error of y_{h/4} by a factor ≈ 2^p − 1). If the ratio test fails (round-off dominated),
E_RK := max(d₁, d₂) and the dataset says so. Round-off accumulates with the step count;
compensated summation of the state update ([Higham] §4.3, to be confirmed) is recommended. Target:
E_RK ≤ 10⁻¹⁰ r_max. If not achievable the achieved value is recorded and the owner is told; the
L2b comparison then has less resolving power than L2a (§11).

### 9.3 L3 Orekit (ML-TASK-012)

Orekit uses its own constants and algorithms. For a valid comparison the dataset must: pass μ
explicitly equal to the request's μ (not Orekit's default constants); define the initial state
directly in the propagation frame and compare in that frame (no GCRF↔EME2000 or other
transformation, whose frame bias would dominate the comparison); define target dates as
`initialDate.shiftedBy(t_s)` with the same binary64 t_s; record Orekit version, propagator class
and orbit type. Orekit's propagator accuracy is not known to this record (no published bound
consulted — **to be confirmed**); assumption A6: it obeys §6.3 with coefficients at most 2× ours.
Tolerance: M[P_E + 2P_E] = 3M·P_E (position; velocity analogous): C1 10T 2.3 × 10⁻⁵ m. A6 is
checked by Orekit self-consistency (closure and energy of its own output) in ML-TASK-012; if it
fails, the L3-Orekit tolerance is re-derived from the measured self-consistency, not from the
engine comparison.

### 9.4 L3 textbook examples

Printed values carry d significant digits (typically 3–5). For a printed x with d digits:
τ_book = M_book · ½ · 10^(q − d + 1), q = ⌊log₁₀\|x\|⌋, **M_book = 2** (the author's intermediate
rounding is unknown; this allows ±1 in the last printed digit). The comparison uses the book's own
μ and inputs exactly as printed (A4 does not hold for textbook inputs; the engine is run on the
printed inputs). Relative resolution is about 10^(1−d): 10⁻² to 10⁻⁴. These checks detect
convention errors (sign, axis, angle definition), not numerical accuracy.

## 10. Degenerate-element thresholds (requested by contract §3)

Contract §3 takes the circular and equatorial thresholds from this record. They are partly a
product decision; this section gives the numerical lower bound.

- Noise of the computed eccentricity of a circular state after N periods (e-vector evaluation 30u,
  sensitivity ≈ 2δv/v + δr/r ≤ 3 × the larger of V_b/(u v_p) = 175 and P_b/(u r_a) = 130, and the
  off-orbit time-like displacement 10u · nL = 10u(2πN + 1), ×3):
  **ê_noise(N) = u[30 + 3·175 + 30(2πN + 1)]**: N = 0: 585u = 6.5 × 10⁻¹⁴; N = 10: 2470u =
  2.7 × 10⁻¹³; N = 100: 19 435u = 2.2 × 10⁻¹².
- The angle of a vector of size e known to ±ê_noise is uncertain by ê_noise/e. For ω (resp. Ω, with
  sin i) to be good to the angle display resolution δθ: **ε_min = M ê_noise(N)/δθ**. With
  δθ = 10⁻⁶ rad: N = 0: 2.6 × 10⁻⁷; N = 10: 1.1 × 10⁻⁶; N = 100: 8.6 × 10⁻⁶. The inclination noise
  is no larger (h-direction error ≤ 2(3uκ_h + δr/r + δv/v) ≤ ê_noise for e ≤ 0.1), so the same
  bound is used for ε_i (rad, on i' = min(i, π − i)).
- Trade-off: a larger ε makes displayed angles reliable over longer spans but moves the
  near-degenerate round trip by up to 2ε r (VT-04(b)). Proposed provisional value
  **ε_e = ε_i = 10⁻⁵** (valid to about 100 periods at δθ = 10⁻⁶ rad, worst case), **for owner
  decision (open item O-3)**.

## 11. Where the indicative expectation of plan §4 does not hold

Against the assumed display resolution (§5: 1 m, 1 mm/s, 10⁻⁶ rad), every derived tolerance above
is 4 to 9 orders of magnitude finer (largest: VT-14 2.2 × 10⁻³ m; VT-05 C5 4.7 × 10⁻⁴ m). Exceptions
and limits:

1. **acos-based element extraction** (VT-03, VT-04, VI-03): √u-level angle errors (≈ 4 × 10⁻⁸ rad,
   ≈ 0.25 m at LEO) — would make a round trip agree only to decimetres. Treated as a defect signal.
2. **Degenerate convention** (VT-04(b)): up to 2ε r (140 m at LEO for ε = 10⁻⁵) for near-degenerate
   inputs below the threshold. Not a numerical error; inherent in the convention.
3. **Element angles near the thresholds**: ω, ν, Ω accurate only to about ê_noise/e, i.e. close to
   the display resolution by construction of §10.
4. **L2b and L3 comparisons**: their resolving power is limited by E_RK (measured), by Orekit's
   unverified accuracy (A6) and, for textbook values, by 3–5 printed digits (10⁻²…10⁻⁴ relative,
   i.e. at or above display resolution). Only L1 and L2a comparisons can confirm "many orders of
   magnitude better".
5. **Float32 scene buffers** (VI-02): 7 × 10⁻⁷ relative, tens of metres at GEO scale — far below
   visual resolution but not "many orders" below a 1 m numeric display.
6. **Solver criterion**: every propagation number assumes ε_t = 8u. A typical textbook stopping rule
   such as a relative step of 10⁻⁸ would, if it bounded only the error linearly (bisection
   fallback), give ε_t ≈ 10⁻⁸ and C1 10T errors up to ≈ 10⁻⁸ × 7546 × 59 213 ≈ 4.5 m — i.e. display
   level. With Newton in its quadratic regime the real error is far smaller, but the bound is not
   rigorous without a residual check (open item O-1).
7. **Long spans**: along-track terms grow linearly; at C1 scale the 1 m level is reached after
   roughly 10¹⁰ s (≈ 300 years) — not a practical limit.

## 12. Open items

| # | Item | Needed from | Effect until resolved |
|---|---|---|---|
| O-1 | ADR-005 fixes no convergence criterion. Proposal: ML-TASK-015 bounds the **time residual** \|t(χ̂) − Δt\| ≤ ε_t(\|Δt\| + 1/n) with ε_t ≤ 8u (or a step criterion with a stated, justified error bound). A looser engine criterion does not loosen these tolerances without owner approval. | Astrodynamics Engineer / owner | Propagation numbers assume ε_t = 8u |
| O-2 | Element extraction must be well conditioned (atan2 forms); acos near ±1 fails VT-03 by design. Confirm this is a requirement, not a tolerance question. | Owner / Astrodynamics Engineer | VT-03/VT-04 may fail on an acos-based implementation |
| O-3 | Thresholds ε_e, ε_i (provisional 10⁻⁵) and whether VT-04 includes near-degenerate inputs below them with the convention displacement term. Also: does the convention zero e (i), or keep the computed value? (Architecture §3 does not say; affects VT-04(b) only through the bound used.) | Owner (product) | VT-04(b) not runnable; FR-002 AC3 thresholds undefined |
| O-4 | Does a sample depend only on (segment start, Δt)? If yes, VT-09 is exact. | Astrodynamics Engineer (ML-TASK-015) | VT-09 uses the tolerance form |
| O-5 | Escape and surface-intersection detection semantics; near-parabolic arcs (no tolerance derived). | ML-TASK-016/017 | VT-16 cases restricted per §7 |
| O-6 | UI display resolution (position, velocity, angles) not defined anywhere. | Owner / Frontend | §5, §10, §11 use assumed values |
| O-7 | VT-02 L2c and the engine may implement the same textbook map; algorithmic independence is partial. L3 (Orekit element→state) is the independent check. | ML-TASK-011/012 | VT-02 rests on L2c + L3 |
| O-8 | Scene vertex storage type (binary64 vs Float32) for VI-02. | Frontend Engineer | VI-02 exact vs relative 7.2 × 10⁻⁷ |
| O-9 | Assumptions A2 (correctly rounded `Math.sqrt` under ECMA-262), A3 (transcendental accuracy ≤ 1 ulp on the CI Node version) and A6 (Orekit accuracy) unconfirmed. | Verification Engineer (ML-TASK-011/012) | Formulas with c_f re-evaluated if A3 fails |
| O-10 | Is the first sample (t_s = 0) required to equal the request's initial state bit-exactly? Not stated by the contract; the universal-variable method gives f = 1, g = 0 at χ = 0, so it is likely but not guaranteed. Until decided, VT-05 at Δt = 0 uses P_E(0). | Systems Architect / owner | Tolerance form at Δt = 0 |

## 13. Conflicts and inconsistencies found

| # | Finding | Sources | Status |
|---|---|---|---|
| C-1 | `contracts-v1.md` header still reads "Status: Proposed — awaiting owner approval of this revision", but PR #7 is merged on `main` (commit 6bce7c7) and the task brief calls contract v1.0 approved. This record treats revision 2 as authority on the strength of the merge and the owner decisions of 2026-11-11 recorded in its §11; the header should be updated by its owner. | contracts-v1.md header; git history; ML-TASK-010 brief | Reported, not resolved |
| C-2 | FR-006 AC3 ("velocity changes by exactly the inertial Δv") and plan VT-13 ("v⁺ − v⁻ = Δv") vs contract R12 (v⁺ = fl(v⁻ + Δv), one rounding). Taken literally, fl(v⁺ − v⁻) = Δv fails in general. This record uses the R12 form as the exact check (§1). Not a contradiction once R12 is read as the definition of "exactly"; recorded so the test is written against R12. | m1-requirements FR-006 AC3; plan §3; contract §5.3, R12 | Interpretation stated |
| C-3 | FR-003 AC2 requires the round trip to hold "within tolerance … including degenerate cases under the documented convention"; for near-degenerate inputs below the threshold the convention itself moves the state by O(ε r) (VT-04(b)). | m1-requirements FR-003 AC2; architecture §3; contract §3 | Owner decision (O-3) |
| C-4 | FR-007 AC2 says a rendered vertex "equals" the scaled engine sample; with Float32 vertex buffers equality is not attainable. | m1-requirements FR-007 AC2 | Frontend decision (O-8) |
| C-5 | Contract §13 assigns `deltaV_magnitude_mps` to VT-13 while plan §3 lists VT-13 as "position continuity; v⁺ − v⁻ = Δv". Not a contradiction; VT-13 here covers both. | contract §13; plan §3 | Noted |

No conflict was found between ADR-003, ADR-004, ADR-005 and the plan's tolerance method.

## 14. Sources and confirmation status

| Ref | Source | Used for | Status |
|---|---|---|---|
| [IEEE754] | IEEE Std 754-2019, *IEEE Standard for Floating-Point Arithmetic*: correctly rounded basic operations and squareRoot (clause 5.4.1), roundTiesToEven (clause 4.3) | B1, A2 | Clause numbers **to be confirmed** against the text |
| [ECMA262] | ECMA-262, *ECMAScript Language Specification* (edition current on the CI Node version): Number type as binary64 (§6.1.6.1); Math object functions, "implementation-approximated" | A1, A2, A3 | **To be confirmed** (clause numbers; which Math functions are exactly specified) |
| [Higham] | N. J. Higham, *Accuracy and Stability of Numerical Algorithms*, 2nd ed., SIAM, 2002: §2.2 (standard model), Lemma 3.1 (γ_n), §3.1 (inner products), §4.3 (compensated summation) | B1–B3, §9.2 | Section and lemma numbers **to be confirmed** against the text |
| [Curtis] | H. D. Curtis, *Orbital Mechanics for Engineering Students*: Lagrange coefficients in terms of true-anomaly change (ch. 2), universal variables (ch. 3) | A5, §6.1 | Edition, equation numbers **to be confirmed** |
| [Vallado] | D. A. Vallado, *Fundamentals of Astrodynamics and Applications*, KEPLER algorithm (cited by ADR-005) | §6.1 | Edition, page **to be confirmed** |
| [Hairer] | E. Hairer, S. P. Nørsett, G. Wanner, *Solving Ordinary Differential Equations I*, §II.4 (step-size/error estimation by Richardson extrapolation) | §9.2 | **To be confirmed** |
| Architecture | `docs/architecture/proposed-architecture.md` §3 | μ and reference radius values, conventions | Values confirmed only by VT-19 |

Derived in this document (elementary; checkable from the text): B4–B6, B8, all conditioning
factors (κ_E, κ_h, κ_b, κ_bv), the three-term propagation model of §6, every budget and every
evaluated number.

## 15. Approval

| Item | Decision | Owner | Date |
|---|---|---|---|
| Method and formulas §2–§9 | | | |
| Margin M = 4, M_book = 2 | | | |
| Thresholds ε_e, ε_i (§10) | | | |
| Open items O-1…O-10 | | | |
