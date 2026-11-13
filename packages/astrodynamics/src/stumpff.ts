/**
 * Stumpff functions c0 … c3 of a real, dimensionless argument ψ.
 *
 * Definitions (series, all real ψ):
 *
 *     c_k(ψ) = Σ_{n ≥ 0} (−ψ)^n / (k + 2n)!                                     (1)
 *
 * The functions used by the universal-variable propagator are C = c2 and S = c3. Closed forms
 * follow from (1) by comparing with the Taylor series of cos, sin, cosh, sinh. With x = √ψ for
 * ψ > 0 and y = √(−ψ) for ψ < 0:
 *
 *     c0 = cos x           c1 = sin x / x        C = (1 − cos x) / ψ      S = (x − sin x) / (ψ x)
 *     c0 = cosh y          c1 = sinh y / y       C = (cosh y − 1) / (−ψ)  S = (sinh y − y) / ((−ψ) y)
 *
 * and, for every ψ, the recurrence ψ c_{k+2}(ψ) = 1/k! − c_k(ψ), i.e. c0 = 1 − ψ C, c1 = 1 − ψ S.
 * At ψ = 0: c0 = c1 = 1, C = 1/2, S = 1/6.
 *
 * Sources (opened 2026-11-12):
 * - Wikipedia, "Stumpff function", https://en.wikipedia.org/wiki/Stumpff_function: series (1),
 *   closed forms of c0 … c3, recurrence x c_{k+2}(x) = 1/k! − c_k(x). The page cites Stumpff,
 *   *Himmelsmechanik* (1956) and Danby, *Fundamentals of Celestial Mechanics* (1988), which were
 *   not opened (not confirmed).
 * - B. Weber, *Orbital Mechanics & Astrodynamics*, "Orbit Independent Solution: The Universal
 *   Anomaly", Eqs. 253–255 (series and closed forms of C(z) and S(z)),
 *   https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/universal-variables.html
 *   (CC BY-SA 4.0; based on Curtis, *Orbital Mechanics for Engineering Students*, ch. 3 — the
 *   book itself was not opened, not confirmed).
 * The closed forms are also checkable from (1) by hand: e.g. ψ C = Σ_{n≥0} (−1)^n x^{2n+2}/(2n+2)!
 * = 1 − cos x.
 *
 * ---------------------------------------------------------------------------------------------
 * Evaluation scheme and the switch-over (derivation, u = 2^-53 is the binary64 unit roundoff):
 *
 * Closed forms lose accuracy near ψ = 0 by cancellation. For S with ψ > 0: x − sin x ≈ x³/6,
 * while the absolute rounding of sin x and of the subtraction is about u·x (sin x ≈ x), so the
 * relative error is about 12u/ψ. For C: 1 − cos x ≈ ψ/2 with absolute error about u, i.e. about
 * 2u/ψ … 4u/ψ relative. Below |ψ| ≈ 1 these errors exceed 4u and grow without bound as ψ → 0.
 *
 * The series is therefore used for |ψ| < PSI_SWITCH = 4 and the closed forms for |ψ| ≥ 4.
 * At |ψ| = 4 (x = 2 or y = 2, exact square roots) the closed forms are well conditioned. With
 * the elementary functions within 1 ulp (≤ 2u relative; an assumption, see below):
 *   S, ψ = +4: sin 2 ≈ 0.909 (abs. err. ≤ 1.82u), 2 − sin 2 ≈ 1.091 (+1.09u), ÷ (ψ x = 8, exact)
 *              (+u)  →  ≤ 3.7u relative;
 *   S, ψ = −4: sinh 2 ≈ 3.627 (≤ 7.25u), − 2 → 1.627 (+1.63u), ÷ 8 (+u)  →  ≤ 6.5u;
 *   C, ψ = +4: cos 2 ≈ −0.416 (≤ 0.83u), 1 − cos 2 ≈ 1.416 (+1.42u), ÷ 4 (exact)  →  ≤ 1.6u;
 *   C, ψ = −4: cosh 2 ≈ 3.762 (≤ 7.52u), − 1 → 2.762 (+2.76u), ÷ 4 (exact)  →  ≤ 3.7u.
 * Above |ψ| = 4 the cancellation only decreases (for ψ > 0 the numerators 1 − cos x and x − sin x
 * are bounded away from zero relative to their operands; for ψ < 0 they grow).
 *
 * Series length. Truncating (1) after N terms (n = 0 … N−1) leaves a remainder bounded by the
 * first omitted term times 1/(1 − q), q = |ψ| / ((k + 2N + 1)(k + 2N + 2)) ≤ 4/600 (the tail is
 * alternating for ψ > 0 and geometric-dominated for ψ < 0). On |ψ| ≤ 4 the functions are
 * smallest at ψ = +4: C(4) = (1 − cos 2)/4 ≥ 0.35 and S(4) = (2 − sin 2)/8 ≥ 0.13. Hence the
 * relative truncation error is at most
 *   C: 4^N / (2N + 2)! / 0.35 · 1.01,     S: 4^N / (2N + 3)! / 0.13 · 1.01.
 *   N = 10: C 2.7e-15 (24u), S 3.1e-16 (2.8u)   — too large;
 *   N = 11: C 2.0e-17 (0.18u), S 2.1e-18 (0.02u) — below u/4.
 * So SERIES_TERMS = 11 for both.
 *
 * Series evaluation: nested (Horner) form using the exact term ratio
 *   term_n / term_{n−1} = −ψ / ((k + 2n − 1)(k + 2n)),
 *   C = (1/2)·[1 − ψ/(3·4)·[1 − ψ/(5·6)·[ … [1 − ψ/(21·22)] … ]]]
 *   S = (1/6)·[1 − ψ/(4·5)·[1 − ψ/(6·7)·[ … [1 − ψ/(22·23)] … ]]]
 * Every denominator is an exact small integer, so no factorial or reciprocal coefficient is
 * rounded. Each level is acc ← 1 − (ψ / d) · acc (one division, one multiplication, one
 * subtraction). Since |ψ/d| ≤ 1/3 and the inner errors are damped by that factor, the rounding of
 * the whole nest is ≤ about 2.5u relative for ψ ∈ [0, 4] and ≤ about 2u for ψ ∈ [−4, 0]; the final
 * ÷2 is exact and ÷6 adds u. Together with truncation: series ≤ 4u relative on |ψ| < 4.
 *
 * Continuity at the switch: |series − closed| ≤ (4u + 6.5u)·|value| < 11u·|value| at |ψ| = 4,
 * plus |c'_k| · (spacing of ψ) when comparing neighbouring arguments. At ψ = 0 the series alone
 * is used on both sides, so continuity there is that of a polynomial in ψ. At ψ = ±0 the nest
 * gives acc = 1 at every level, so C(±0) = 0.5 exactly and S(±0) = fl(1/6).
 *
 * c0 and c1 on the series side are formed by the recurrence c0 = 1 − ψ C, c1 = 1 − ψ S (absolute
 * error ≤ about 6u since |ψ C| ≤ 1.42 and |ψ S| ≤ 0.55 on |ψ| ≤ 4). On the closed side they are
 * cos x / cosh y and sin x / x / sinh y / y, sharing the same x (or y) as C and S, so that all
 * four values are consistent with one rounded argument.
 *
 * Assumption (not confirmed): ECMAScript leaves Math.sin, Math.cos, Math.sinh and Math.cosh
 * implementation-approximated; the bounds above assume ≤ 1 ulp, which is the documented accuracy
 * of the fdlibm-derived implementations used by V8. Math.sqrt is assumed correctly rounded.
 *
 * Domain: finite ψ. For ψ > 0 the closed forms are finite for every finite ψ. For ψ < 0, cosh
 * and sinh overflow when y = √(−ψ) exceeds about 710; c0, c1, C and S are then +Infinity. NaN in
 * gives NaN out. Callers that pass data out of the engine must check finiteness.
 */

/** |ψ| at and above which the closed forms are used (derivation in the module comment). */
export const STUMPFF_SERIES_SWITCH = 4;

/** Number of series terms (n = 0 … 10) used for |ψ| < STUMPFF_SERIES_SWITCH. */
export const STUMPFF_SERIES_TERMS = 11;

/** The four Stumpff values at one argument ψ, all dimensionless. */
export interface StumpffValues {
  /** c0(ψ) = cos √ψ (ψ ≥ 0) or cosh √(−ψ) (ψ < 0). */
  readonly c0: number;
  /** c1(ψ) = sin √ψ / √ψ (ψ > 0) or sinh √(−ψ) / √(−ψ) (ψ < 0); 1 at ψ = 0. */
  readonly c1: number;
  /** c2(ψ) = C(ψ). */
  readonly c2: number;
  /** c3(ψ) = S(ψ). */
  readonly c3: number;
}

/**
 * Nested series of C(ψ) = c2(ψ), valid for |ψ| < STUMPFF_SERIES_SWITCH (see module comment).
 * Exported for the unit tests of the switch-over; not part of the package's public index.
 * Evaluation order (fixed): acc = 1; for n = 10 down to 1: acc = 1 - (psi / ((2n+1)(2n+2))) * acc;
 * result = acc / 2.
 */
export function stumpffCSeries(psi: number): number {
  let acc = 1;
  for (let n = STUMPFF_SERIES_TERMS - 1; n >= 1; n -= 1) {
    const d = (2 * n + 1) * (2 * n + 2);
    acc = 1 - (psi / d) * acc;
  }
  return acc / 2;
}

/**
 * Nested series of S(ψ) = c3(ψ), valid for |ψ| < STUMPFF_SERIES_SWITCH (see module comment).
 * Exported for the unit tests of the switch-over; not part of the package's public index.
 * Evaluation order (fixed): acc = 1; for n = 10 down to 1: acc = 1 - (psi / ((2n+2)(2n+3))) * acc;
 * result = acc / 6.
 */
export function stumpffSSeries(psi: number): number {
  let acc = 1;
  for (let n = STUMPFF_SERIES_TERMS - 1; n >= 1; n -= 1) {
    const d = (2 * n + 2) * (2 * n + 3);
    acc = 1 - (psi / d) * acc;
  }
  return acc / 6;
}

/**
 * Closed forms of c0 … c3 for ψ ≠ 0 (any finite ψ; inaccurate near 0, see module comment).
 * Exported for the unit tests of the switch-over; not part of the package's public index.
 *
 * Evaluation order (fixed):
 * - ψ > 0: x = sqrt(ψ); c0 = cos x; c1 = sin x / x; C = (1 - cos x) / ψ; S = (x - sin x) / (ψ * x).
 * - ψ < 0: m = -ψ; y = sqrt(m); c0 = cosh y; c1 = sinh y / y; C = (cosh y - 1) / m;
 *   S = (sinh y - y) / (m * y).
 * Each of sin, cos, sinh, cosh is evaluated once per call.
 */
export function stumpffClosed(psi: number): StumpffValues {
  if (psi > 0) {
    const x = Math.sqrt(psi);
    const cosX = Math.cos(x);
    const sinX = Math.sin(x);
    return { c0: cosX, c1: sinX / x, c2: (1 - cosX) / psi, c3: (x - sinX) / (psi * x) };
  }
  const m = -psi;
  const y = Math.sqrt(m);
  const coshY = Math.cosh(y);
  const sinhY = Math.sinh(y);
  return { c0: coshY, c1: sinhY / y, c2: (coshY - 1) / m, c3: (sinhY - y) / (m * y) };
}

/**
 * All four Stumpff functions c0(ψ), c1(ψ), C(ψ) = c2(ψ), S(ψ) = c3(ψ) at a real, dimensionless ψ.
 *
 * |ψ| < 4: C and S from the nested series (11 terms), c0 = 1 - psi * C, c1 = 1 - psi * S.
 * |ψ| ≥ 4: closed forms (`stumpffClosed`), all four from one rounded √|ψ|.
 * Accuracy (derived in the module comment, assuming ≤ 1-ulp elementary functions): C and S within
 * about 7u relative near the switch and 4u on the series side; continuous through ψ = 0.
 * Frame/units: none (dimensionless). Sources: module comment.
 * NaN propagates; for ψ below about −5.0e5 the hyperbolic functions overflow to +Infinity.
 */
export function stumpff(psi: number): StumpffValues {
  if (Math.abs(psi) < STUMPFF_SERIES_SWITCH) {
    const c2 = stumpffCSeries(psi);
    const c3 = stumpffSSeries(psi);
    return { c0: 1 - psi * c2, c1: 1 - psi * c3, c2, c3 };
  }
  if (Number.isNaN(psi)) {
    return { c0: Number.NaN, c1: Number.NaN, c2: Number.NaN, c3: Number.NaN };
  }
  return stumpffClosed(psi);
}

/**
 * Stumpff function C(ψ) = c2(ψ) = Σ (−ψ)^n / (2n + 2)!, dimensionless, for real ψ.
 * Equal to (1 − cos √ψ)/ψ for ψ > 0, (cosh √−ψ − 1)/(−ψ) for ψ < 0, 1/2 at ψ = 0.
 * Same evaluation and accuracy as `stumpff(psi).c2`. Sources and derivation: module comment
 * (Weber, Eq. 254; Wikipedia "Stumpff function").
 */
export function stumpffC(psi: number): number {
  return stumpff(psi).c2;
}

/**
 * Stumpff function S(ψ) = c3(ψ) = Σ (−ψ)^n / (2n + 3)!, dimensionless, for real ψ.
 * Equal to (√ψ − sin √ψ)/ψ^{3/2} for ψ > 0, (sinh √−ψ − √−ψ)/(−ψ)^{3/2} for ψ < 0, 1/6 at ψ = 0.
 * Same evaluation and accuracy as `stumpff(psi).c3`. Sources and derivation: module comment
 * (Weber, Eq. 255; Wikipedia "Stumpff function").
 */
export function stumpffS(psi: number): number {
  return stumpff(psi).c3;
}
