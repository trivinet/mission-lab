/**
 * Angle normalisation for the element view (ML-TASK-014).
 *
 * Radians only. Degree conversion is display formatting and belongs to the UI layer
 * (proposed-architecture §3), so no degree helper is provided here.
 */

/**
 * The binary64 number 2 * Math.PI. Multiplying by 2 is exact, so this is exactly twice the
 * binary64 value of π (Math.PI), i.e. the double nearest 2π. It is the period used by
 * `normalizeAngle_rad` and the upper bound of the contract's angle range `[0, 2 * Math.PI)`
 * (contracts-v1 §3).
 */
export const TWO_PI_rad = 2 * Math.PI;

/** Result of `normalizeAngle_rad`. Never NaN. */
export type NormalizeAngleResult =
  | { readonly ok: true; readonly angle_rad: number }
  | { readonly ok: false; readonly reason: 'NON_FINITE_ANGLE' };

/**
 * Maps a finite angle [rad] to the half-open interval [0, 2 * Math.PI) (contracts-v1 §3, §11 OQ-1).
 *
 * Evaluation (fixed):
 * 1. r = x % TWO_PI_rad. ECMAScript `%` on Numbers is the truncating remainder (result has the
 *    sign of the dividend, |r| < |TWO_PI_rad|). The remainder of two binary64 numbers is exactly
 *    representable, so this step does not round (standard property of fmod; the ECMAScript
 *    text "Number::remainder" was not opened in this task: not confirmed against the spec, checked
 *    behaviourally by the unit tests).
 * 2. If r < 0: r = r + TWO_PI_rad (one rounding). For a tiny negative r this sum can round to
 *    exactly TWO_PI_rad.
 * 3. If r >= TWO_PI_rad (only possible through step 2): return +0 (contract OQ-1: a normaliser
 *    whose result rounds to 2π must map it to 0).
 * 4. If r is ±0: return +0 (−0 is mapped to +0).
 *
 * Semantics: the reduction is modulo the binary64 number TWO_PI_rad, not modulo the real 2π.
 * For |x| below a few multiples of 2π the difference is below one ulp of the result; for very
 * large |x| the reduced angle differs from the exact reduction modulo 2π by up to
 * |x| / TWO_PI_rad × (2π − TWO_PI_rad) (about |x| × 3.9e-17), which is a property of the input
 * representation, not of this function.
 *
 * Domain: any finite x. NaN and ±Infinity have no angle: returns
 * `{ ok: false, reason: 'NON_FINITE_ANGLE' }` instead of propagating NaN.
 *
 * Unit: rad in, rad out. Frame: none (a scalar).
 * Source: definition of angle equivalence modulo one turn; boundary rule from contracts-v1 §11
 * OQ-1. No further algorithm.
 */
export function normalizeAngle_rad(x_rad: number): NormalizeAngleResult {
  if (!Number.isFinite(x_rad)) {
    return { ok: false, reason: 'NON_FINITE_ANGLE' };
  }
  return { ok: true, angle_rad: normalizeFiniteAngle_rad(x_rad) };
}

/**
 * Steps 1–4 of `normalizeAngle_rad` without the finiteness check. Internal to this package (not
 * exported from the package index): callers pass only values already known to be finite, e.g.
 * results of Math.atan2 on finite arguments. A non-finite argument would return NaN.
 */
export function normalizeFiniteAngle_rad(x_rad: number): number {
  let r = x_rad % TWO_PI_rad;
  if (r < 0) {
    r = r + TWO_PI_rad;
  }
  if (r >= TWO_PI_rad || r === 0) {
    return 0;
  }
  return r;
}
