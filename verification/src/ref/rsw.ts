/**
 * L2c reference for the RSW maneuver frame (verification plan §2 method (c); VT-11, VT-12;
 * ML-TASK-018 part C). Written from contracts-v1.md §2 and §3.1 only; packages/astrodynamics was
 * not read (ADR-003).
 *
 * Contract definition (§2): R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R, evaluated with the
 * pre-maneuver state; Δv_inertial = ΔvR·R + ΔvS·S + ΔvW·W (§3.1).
 *
 * Formulation used here (projection / Gram–Schmidt, not "normalise, cross, cross"):
 *   R = r/‖r‖,  v⊥ = v − (v·R) R,  S = v⊥/‖v⊥‖,  W = R × S.
 * It is the same basis mathematically: (r × v) × r = ‖r‖² v − (r·v) r = ‖r‖² v⊥ and
 * ‖r × v‖ = ‖r‖ ‖v⊥‖, so S = W × R, and R × S = (r × v)/(‖r‖ ‖v⊥‖) = W.
 *
 * What is and is not independent of the engine:
 * - R is fixed by the contract (r/‖r‖); any reference forms it the same way mathematically.
 * - S and W are formed by different operations (projection, then one cross product) from the
 *   contract's wording (cross product, normalisation, second cross product).
 * - The comparison value is evaluated in 320-bit arithmetic and rounded once to binary64
 *   (`rswToInertialHp`), so the reference's own rounding is ≤ ½ ulp per component, far below the
 *   reference share (12κ_h + 24.2)u of the VT-12 tolerance (tolerances.md §7 VT-12).
 * - Not independent: the meaning of R, S, W and of the component order [R, S, W] is taken from
 *   the same contract text the engine implements. A misreading of the contract shared by both
 *   would not be detected here (only by L3).
 */
import { add, div, fromNumber, mul, sub, toNumber, type BigFloat } from '../hp/bigfloat';
import { b3, crossB, dotB, normB, scaleB, subB, toV3, unitB, type B3 } from '../hp/hp-vec';
import { cross, dot, norm, scale, subV, type V3 } from './vec';

export interface RswBasis {
  readonly R: V3;
  readonly S: V3;
  readonly W: V3;
}

/** Binary64 projection-form basis (used for diagnostics and self-tests; not a comparison value). */
export function rswBasisProjection(r: V3, v: V3): RswBasis {
  const rn = norm(r);
  const R: V3 = [r[0] / rn, r[1] / rn, r[2] / rn];
  const vPerp = subV(v, scale(dot(v, R), R));
  const vpn = norm(vPerp);
  const S: V3 = [vPerp[0] / vpn, vPerp[1] / vpn, vPerp[2] / vpn];
  return { R, S, W: cross(R, S) };
}

export interface RswBasisHp {
  readonly R: B3;
  readonly S: B3;
  readonly W: B3;
}

/** Projection-form basis in 320-bit arithmetic from the exact binary64 r, v. */
export function rswBasisProjectionHp(r: V3, v: V3): RswBasisHp {
  const rb = b3(r);
  const vb = b3(v);
  const R = unitB(rb);
  const vPerp = subB(vb, scaleB(dotB(vb, R), R));
  const S = unitB(vPerp);
  return { R, S, W: crossB(R, S) };
}

/** Contract-wording basis (normalise, cross, cross) in 320-bit arithmetic; self-test only. */
export function rswBasisDefinitionHp(r: V3, v: V3): RswBasisHp {
  const rb = b3(r);
  const vb = b3(v);
  const R = unitB(rb);
  const W = unitB(crossB(rb, vb));
  return { R, S: crossB(W, R), W };
}

/** Basis rounded to binary64 component by component (each ≤ ½ ulp from the 320-bit value). */
export function rswBasisHpRounded(r: V3, v: V3): RswBasis {
  const b = rswBasisProjectionHp(r, v);
  return { R: toV3(b.R), S: toV3(b.S), W: toV3(b.W) };
}

/** Δv_inertial = ΔvR R + ΔvS S + ΔvW W in 320-bit arithmetic (projection form). */
export function rswToInertialB(r: V3, v: V3, dvRsw: V3): B3 {
  const { R, S, W } = rswBasisProjectionHp(r, v);
  const c = b3(dvRsw);
  const comp = (k: 0 | 1 | 2): BigFloat =>
    add(add(mul(c[0], R[k]), mul(c[1], S[k])), mul(c[2], W[k]));
  return [comp(0), comp(1), comp(2)];
}

/** Reference Δv_inertial rounded once to binary64 (the VT-12 comparison value). */
export function rswToInertialHp(r: V3, v: V3, dvRsw: V3): V3 {
  return toV3(rswToInertialB(r, v, dvRsw));
}

/** ‖x − y‖ with x binary64 and y 320-bit, returned as binary64. */
export function distToB(x: V3, y: B3): number {
  return toNumber(normB(subB(b3(x), y)));
}

/** Angle between two non-zero 320-bit vectors via atan2-free form: ‖a × b‖ / (‖a‖‖b‖) (sin). */
export function sinAngleB(a: B3, b: B3): number {
  return toNumber(div(normB(crossB(a, b)), mul(normB(a), normB(b))));
}

/** Contract R12 form: fl(vBefore[i] + Δv[i]) per component (one rounded addition). */
export function velocityAfterR12(vBefore: V3, dvInertial: V3): V3 {
  return [vBefore[0] + dvInertial[0], vBefore[1] + dvInertial[1], vBefore[2] + dvInertial[2]];
}

/** Exact difference of two binary64 numbers, rounded once (helper for reports). */
export function exactDiff(a: number, b: number): number {
  return toNumber(sub(fromNumber(a), fromNumber(b)));
}
