/**
 * Impulsive maneuver application (ML-TASK-016; ML-FR-006 AC2–AC4; contracts-v1 §3.1, §5.3, §5.5
 * R8 and R12).
 *
 * Model (architecture §3 "Maneuver"; contracts-v1 §3.1): instantaneous; position unchanged;
 * velocity incremented by the Δv given in RSW components [ΔvR radial, ΔvS along-track,
 * ΔvW cross-track], resolved to the inertial frame with the RSW basis of the PRE-maneuver state.
 * No mass model. Units: m, m/s. Frame: the inertial frame of the input state (GCRF in M1).
 *
 * Output shape: the success fields map one-to-one onto the contract's `ManeuverEvent` (§5.3):
 * `position_m`, `velocityBefore_mps`, `deltaV_inertial_mps`, `velocityAfter_mps`,
 * `deltaV_magnitude_mps` (the simulation layer adds `maneuverId` and `t_s`). The basis used is
 * returned as well (not part of the contract).
 *
 * Bit-exact guarantees (IEEE 754 binary64, round to nearest, no FMA in ECMAScript):
 * G1  position_m[i] is the input position component (copied, `Object.is`-identical).
 * G2  velocityBefore_mps[i] is the input velocity component (copied, `Object.is`-identical).
 * G3  velocityAfter_mps[i] is computed as exactly one addition,
 *     velocityBefore_mps[i] + deltaV_inertial_mps[i], so `Object.is(velocityAfter_mps[i],
 *     velocityBefore_mps[i] + deltaV_inertial_mps[i])` holds for every i (contract R12). With G1
 *     and the segment construction of ML-TASK-017 (copies of these values) R8 holds as well.
 * G4  deltaV_magnitude_mps is normVec3(deltaV_inertial_mps): the norm of the INERTIAL vector, as
 *     contracts-v1 §5.3 defines it (not the norm of the RSW input; the two differ by rounding).
 *
 * Zero Δv and signed zeros (all three RSW components ±0):
 * Z1  Every product x·b with x = ±0 and finite b is ±0 (sign = XOR of the signs). A sum of two
 *     zeros is −0 only if both are −0, otherwise +0 (IEEE 754 §6.3, round to nearest). Hence
 *     deltaV_inertial_mps[i] is ±0, and it is −0 exactly when all three products of row i are −0.
 * Z2  velocityAfter_mps[i] === velocityBefore_mps[i] for every i (x + ±0 equals x for every
 *     non-zero finite x, and ±0 + ±0 is ±0). So the zero-Δv post-maneuver state equals the
 *     pre-maneuver state under `===`, as tolerances.md §1 requires (VT-14 exact part).
 * Z3  It is NOT guaranteed bit-for-bit: if velocityBefore_mps[i] is −0 and deltaV_inertial_mps[i]
 *     is +0, then velocityAfter_mps[i] = −0 + +0 = +0. No other sign change can occur
 *     (x + ±0 = x bit-exactly for x ≠ 0; +0 + ±0 = +0; −0 + −0 = −0). R12 still holds bit-exactly
 *     because velocityAfter_mps IS that sum, and R8 compares velocityAfter_mps with the next
 *     segment's first sample, which ML-TASK-017 copies from it. The evaluation is not
 *     special-cased for zero Δv (see the task report: design choice).
 * Z4  deltaV_magnitude_mps is +0 (normVec3 of a zero vector).
 *
 * Source: definition (architecture §3, contracts-v1 §3.1, §5.3); RSW basis in rsw.ts.
 */

import { rswBasis, rswToInertial } from './rsw';
import type { RswBasis, RswBasisFailure } from './rsw';
import { normVec3 } from './vector3';
import type { Vec3 } from './vector3';

/** The applied maneuver; field names and meaning as contracts-v1 §5.3 `ManeuverEvent`. */
export interface ImpulsiveManeuverApplication {
  /** Position at the maneuver, m, inertial frame: the input values, unchanged (G1). */
  readonly position_m: Vec3;
  /** Velocity immediately before, m/s, inertial frame: the input values (G2). */
  readonly velocityBefore_mps: Vec3;
  /** Δv resolved to the inertial frame, m/s: rswToInertial(pre-maneuver basis, Δv_RSW). */
  readonly deltaV_inertial_mps: Vec3;
  /** velocityBefore_mps[i] + deltaV_inertial_mps[i], one addition per component, m/s (G3). */
  readonly velocityAfter_mps: Vec3;
  /** |deltaV_inertial_mps| (normVec3), m/s, ≥ 0 (G4). */
  readonly deltaV_magnitude_mps: number;
  /** RSW basis of the pre-maneuver state used for the resolution (dimensionless, inertial). */
  readonly rswBasis: RswBasis;
}

/** Why `applyImpulsiveManeuver` returns no result. */
export type ImpulsiveManeuverFailure =
  /** A component of the state or of Δv is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** RSW basis undefined: r = 0 (see RswBasisFailure). */
  | 'ZERO_POSITION'
  /** RSW basis undefined: r × v = 0, rectilinear pre-maneuver state (see RswBasisFailure). */
  | 'ZERO_ANGULAR_MOMENTUM'
  /** Overflow: the basis, the inertial Δv, the post-maneuver velocity or the magnitude is not finite. */
  | 'NON_FINITE_RESULT';

/** Result of `applyImpulsiveManeuver`. A success never contains a non-finite number. */
export type ImpulsiveManeuverResult =
  | { readonly ok: true; readonly maneuver: ImpulsiveManeuverApplication }
  | { readonly ok: false; readonly reason: ImpulsiveManeuverFailure };

function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

function mapBasisFailure(reason: RswBasisFailure): ImpulsiveManeuverFailure {
  return reason;
}

/**
 * Applies an impulsive Δv given in RSW components to a state.
 *
 * @param position_m Pre-maneuver position r, m, inertial frame.
 * @param velocity_mps Pre-maneuver velocity v⁻, m/s, same frame.
 * @param deltaV_rsw_mps [ΔvR, ΔvS, ΔvW], m/s, in the RSW frame of the pre-maneuver state
 *   (contracts-v1 §3.1 `deltaV_mps`). The zero vector is allowed and yields a result (Z1–Z4).
 * @returns The applied maneuver (ManeuverEvent fields plus the basis) or a failure. Never throws.
 *
 * Domain: finite inputs; r ≠ 0; r × v ≠ 0 (the RSW frame must exist). In M1 the maneuver is
 * applied on the closed input orbit, where both hold (contracts-v1 §8.3 note).
 *
 * Evaluation order (fixed):
 *   1. basis = rswBasis(r, v⁻)                                     (rsw.ts)
 *   2. Δv_I[i] = (ΔvR * R[i] + ΔvS * S[i]) + ΔvW * W[i]              (rswToInertial)
 *   3. v⁺[i] = v⁻[i] + Δv_I[i]                                       (one addition)
 *   4. |Δv| = normVec3(Δv_I)                                         (vector3.ts)
 *   5. position and v⁻ are copied component by component.
 * Rounding of Δv_I relative to the exact rotation of Δv_RSW: per component ≤ 3u Σ_k |Δv_k||b_ki|
 * (inner product of length 3, tolerances.md §2 B3) plus the basis error of rsw.ts.
 *
 * Source: definition (architecture §3; contracts-v1 §3.1, §5.3, R12); module comment.
 */
export function applyImpulsiveManeuver(
  position_m: Vec3,
  velocity_mps: Vec3,
  deltaV_rsw_mps: Vec3,
): ImpulsiveManeuverResult {
  if (!isFiniteVec3(position_m) || !isFiniteVec3(velocity_mps) || !isFiniteVec3(deltaV_rsw_mps)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  const basisResult = rswBasis(position_m, velocity_mps);
  if (!basisResult.ok) {
    return { ok: false, reason: mapBasisFailure(basisResult.reason) };
  }
  const basis = basisResult.basis;
  const deltaV_inertial_mps = rswToInertial(basis, deltaV_rsw_mps);
  const velocityBefore_mps: Vec3 = [velocity_mps[0], velocity_mps[1], velocity_mps[2]];
  const velocityAfter_mps: Vec3 = [
    velocityBefore_mps[0] + deltaV_inertial_mps[0],
    velocityBefore_mps[1] + deltaV_inertial_mps[1],
    velocityBefore_mps[2] + deltaV_inertial_mps[2],
  ];
  const deltaV_magnitude_mps = normVec3(deltaV_inertial_mps);
  if (
    !isFiniteVec3(deltaV_inertial_mps) ||
    !isFiniteVec3(velocityAfter_mps) ||
    !Number.isFinite(deltaV_magnitude_mps)
  ) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  return {
    ok: true,
    maneuver: {
      position_m: [position_m[0], position_m[1], position_m[2]],
      velocityBefore_mps,
      deltaV_inertial_mps,
      velocityAfter_mps,
      deltaV_magnitude_mps,
      rswBasis: basis,
    },
  };
}
