/**
 * RSW (radial, along-track, cross-track) basis of a Cartesian state (ML-TASK-016; ML-FR-006 AC1).
 *
 * Definition (architecture §3, contracts-v1 §2 "Local frame"; Vallado convention, as named in
 * architecture §3 — that book was NOT opened in this task, not confirmed):
 *   R = r / |r|,   W = (r × v) / |r × v|,   S = W × R.
 * The three vectors are expressed in the inertial frame of r and v (GCRF in M1, ADR-004). They are
 * dimensionless. The function is frame-agnostic: it neither checks nor converts frames.
 *
 * Derived properties (exact arithmetic; elementary vector algebra, derived here):
 * P1  R and W are unit vectors by construction. R ⟂ W because r × v ⟂ r.
 * P2  S = W × R is a unit vector orthogonal to both (|W × R| = |W||R| sin 90° = 1).
 * P3  Right-handed: R × S = R × (W × R) = W (R·R) − R (R·W) = W, and S × W = R, W × R = S.
 * P4  S lies in the orbital plane (⟂ W) and S · v = |h|/|r| > 0 (v = v_r R + v_s S with
 *     v_s = (R × v)·W = |r × v|/|r|), so S points "forward", but S ∥ v only when r ⟂ v (circular
 *     orbit or apsis). This is the ML-FR-005 AC3 caveat: along-track is not the velocity direction.
 *
 * Rounding (IEEE 754 binary64; u = 2^-53; first order in u; bounds derived here from the operation
 * counts of the fixed evaluation order below, consistent with building blocks B4–B6 of
 * docs/verification/tolerances.md §2). With κ_h = |r||v|/|r × v| ≥ 1 (= 1/cos of the flight-path
 * angle):
 *   R̂: componentwise relative error ≤ 4u (norm ≤ 3u, then one division), so |R̂ − R| ≤ 4u.
 *   Ŵ: the computed cross product has |δh| ≤ 3u|r||v| (B5), i.e. ≤ 3uκ_h relative to |h|; its
 *       direction error is ≤ 2·3uκ_h (B6) and normalisation adds 4u: |Ŵ − W| ≤ (6κ_h + 4)u.
 *   Ŝ: |Ŝ − S| ≤ |Ŵ − W| + |R̂ − R| + 3u (rounding of the cross product of two unit vectors)
 *       = (6κ_h + 11)u.
 * Consequences: every entry of BᵀB − I (B = [R̂ Ŝ Ŵ]) is ≤ 2(6κ_h + 11)u in exact evaluation, and
 * |R̂ × Ŝ − Ŵ| ≤ (12κ_h + 19)u. These are rounding levels of order 1e-14 for M1 orbits
 * (κ_h ≤ 1.5); the approved VT-11 tolerances (tolerances.md §7) are 4× larger plus test terms.
 * The rounding grows without bound as the state approaches rectilinear motion (κ_h → ∞).
 *
 * Pure function; no throw; never returns NaN or ±Infinity.
 */

import { crossVec3, normalizeVec3 } from './vector3';
import type { Vec3 } from './vector3';

/** The RSW unit vectors, each expressed in the inertial frame of the state (dimensionless). */
export interface RswBasis {
  /** R = r/|r| (radial). */
  readonly radial: Vec3;
  /** S = W × R (along-track; in the orbital plane, not parallel to v unless r ⟂ v). */
  readonly alongTrack: Vec3;
  /** W = (r × v)/|r × v| (cross-track, along the angular momentum). */
  readonly crossTrack: Vec3;
}

/** Why `rswBasis` returns no basis. */
export type RswBasisFailure =
  /** A component of r or v is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** r is the zero vector (every component ±0): R is undefined. */
  | 'ZERO_POSITION'
  /**
   * The computed r × v is the zero vector: rectilinear state (v = 0 or v ∥ r), or a product so
   * small that it underflows to zero. W is undefined. (Contract note: `RSW_FRAME_UNDEFINED` is not
   * registered in v1.0, contracts-v1 §8.3; a valid v1.0 request cannot reach this.)
   */
  | 'ZERO_ANGULAR_MOMENTUM'
  /** |r| or |r × v| overflows binary64 (components near Number.MAX_VALUE). */
  | 'NON_FINITE_RESULT';

/** Result of `rswBasis`. A success never contains a non-finite number. */
export type RswBasisResult =
  | { readonly ok: true; readonly basis: RswBasis }
  | { readonly ok: false; readonly reason: RswBasisFailure };

function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

/**
 * RSW basis of the state (r, v).
 *
 * @param position_m r, m, inertial frame.
 * @param velocity_mps v, m/s, same frame.
 * @returns `{ ok: true, basis }` with dimensionless unit vectors in the input frame, or
 *   `{ ok: false, reason }` (see `RswBasisFailure`). Never throws, never NaN.
 *
 * Domain: finite r ≠ 0 and finite v with r × v ≠ 0 (computed). Units of r and v cancel in every
 * output; any consistent units give the same basis.
 *
 * Evaluation order (fixed, bit-reproducible):
 *   1. R = normalizeVec3(r)            (vector3.ts: n = normVec3(r); R_i = r_i / n)
 *   2. h = crossVec3(r, v)             (h = [r1 v2 − r2 v1, r2 v0 − r0 v2, r0 v1 − r1 v0])
 *   3. W = normalizeVec3(h)
 *   4. S = crossVec3(W, R)
 * S is not re-normalised.
 *
 * Source: architecture §3 / contracts-v1 §2 definition; properties P1–P4 and rounding levels
 * derived in the module comment.
 */
export function rswBasis(position_m: Vec3, velocity_mps: Vec3): RswBasisResult {
  if (!isFiniteVec3(position_m) || !isFiniteVec3(velocity_mps)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  const radial = normalizeVec3(position_m);
  if (!radial.ok) {
    return {
      ok: false,
      reason: radial.reason === 'ZERO_VECTOR' ? 'ZERO_POSITION' : 'NON_FINITE_RESULT',
    };
  }
  const angularMomentum_m2ps = crossVec3(position_m, velocity_mps);
  const crossTrack = normalizeVec3(angularMomentum_m2ps);
  if (!crossTrack.ok) {
    return {
      ok: false,
      reason: crossTrack.reason === 'ZERO_VECTOR' ? 'ZERO_ANGULAR_MOMENTUM' : 'NON_FINITE_RESULT',
    };
  }
  const alongTrack = crossVec3(crossTrack.unit, radial.unit);
  return {
    ok: true,
    basis: { radial: radial.unit, alongTrack, crossTrack: crossTrack.unit },
  };
}

/**
 * Inertial vector from RSW components: x_I = x_R·R + x_S·S + x_W·W.
 *
 * @param basis RSW basis from `rswBasis` (unit vectors in the inertial frame).
 * @param components_rsw [x_R, x_S, x_W] in any unit; the result has the same unit, inertial frame.
 * @returns x_I. Pure; non-finite components propagate per IEEE 754 (callers validate first;
 *   `applyImpulsiveManeuver` does).
 *
 * Evaluation order (fixed): for each i = 0, 1, 2,
 *   x_I[i] = (x_R * R[i] + x_S * S[i]) + x_W * W[i]
 * (three products, two additions, left to right; the same order as dotVec3 of row i of the matrix
 * [R S W] with the component vector).
 *
 * Exact consequences of this order (IEEE 754, round to nearest): scaling the components by a power
 * of two scales the result by the same power exactly (absent overflow/underflow); negating the
 * components negates the result (up to the sign of zero); components [1, 0, 0] return R (and
 * analogously S, W) up to the sign of zero in components that are ±0; zero components give ±0 in
 * every output component (see `applyImpulsiveManeuver` for the sign rule).
 * Source: definition (architecture §3, contracts-v1 §3.1).
 */
export function rswToInertial(basis: RswBasis, components_rsw: Vec3): Vec3 {
  const R = basis.radial;
  const S = basis.alongTrack;
  const W = basis.crossTrack;
  const xR = components_rsw[0];
  const xS = components_rsw[1];
  const xW = components_rsw[2];
  return [
    xR * R[0] + xS * S[0] + xW * W[0],
    xR * R[1] + xS * S[1] + xW * W[1],
    xR * R[2] + xS * S[2] + xW * W[2],
  ];
}
