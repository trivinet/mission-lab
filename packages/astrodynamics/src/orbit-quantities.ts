/**
 * Derived orbit quantities (ML-TASK-014; ML-FR-002 AC4, ML-FR-009, ML-FR-010 AC2).
 *
 * Units: SI (m, s, rad, m^3/s^2). Specific energy in m^2/s^2 (= J/kg), specific angular momentum
 * in m^2/s. Frame: the state function needs one inertial frame for r and v; scalar outputs are
 * frame-independent. Pure functions; never throw; never return NaN or ±Infinity.
 *
 * Sources: derivations D1–D4 in the header of elements.ts (h = r × v, vis-viva ξ = −μ/(2a),
 * orbit equation r = p/(1 + e cos ν), p = a(1 − e^2) and |h|^2 = μ p), plus:
 * D6  Periapsis / apoapsis radii: r(ν) = p/(1 + e cos ν) is smallest at ν = 0 and, for e < 1,
 *     largest at ν = π: r_p = p/(1 + e) = a(1 − e), r_a = p/(1 − e) = a(1 + e).
 * D7  Period: by D1 the areal rate is |h|/2 (dA/dt = |r × v|/2), the ellipse area is π a b with
 *     b = a sqrt(1 − e^2), and |h| = sqrt(μ a (1 − e^2)), so T = 2π a b/|h| = 2π sqrt(a^3/μ)
 *     (Kepler's third law), and the mean motion is n = 2π/T = sqrt(μ/a^3).
 * No external source was opened for D6/D7; they are derived here. Not confirmed against a
 * textbook in this task.
 */

import { crossVec3, dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

/** Quantities of a closed (elliptic) orbit. */
export interface ClosedOrbitQuantities {
  /** r_p = a(1 − e) [m] (D6). Radius, not altitude: subtract the reference radius for altitude. */
  readonly periapsisRadius_m: number;
  /** r_a = a(1 + e) [m] (D6). */
  readonly apoapsisRadius_m: number;
  /** T = 2π sqrt(a^3/μ) [s] (D7). */
  readonly period_s: number;
  /** n = sqrt(μ/a^3) [rad/s] (D7). */
  readonly meanMotion_radps: number;
  /** ξ = −μ/(2a) [m^2/s^2] (D4). */
  readonly specificEnergy_m2ps2: number;
  /** |h| = sqrt(μ a (1 − e^2)) [m^2/s] (D3, D4). */
  readonly specificAngularMomentum_m2ps: number;
}

/** Reasons `closedOrbitQuantities` declines. */
export type ClosedOrbitQuantitiesFailure =
  /** a, e or μ is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** μ ≤ 0. */
  | 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'
  /**
   * Not a closed orbit: a ≤ 0, e < 0 or e ≥ 1. Apoapsis, period and mean motion do not exist for
   * an open conic; callers holding a hyperbolic element set get this explicit result.
   */
  | 'NOT_CLOSED_ORBIT'
  /** Overflow or underflow made a quantity non-finite or zero where it must be positive. */
  | 'NON_FINITE_RESULT';

/** Result of `closedOrbitQuantities`. */
export type ClosedOrbitQuantitiesResult =
  | { readonly ok: true; readonly quantities: ClosedOrbitQuantities }
  | { readonly ok: false; readonly reason: ClosedOrbitQuantitiesFailure };

/**
 * Periapsis and apoapsis radius, period, mean motion, specific energy and specific angular
 * momentum of a closed orbit from a [m], e [-] and μ [m^3/s^2].
 *
 * Domain: all finite, μ > 0, a > 0, 0 ≤ e < 1. Otherwise `{ ok: false, reason }` (see
 * `ClosedOrbitQuantitiesFailure`); in particular a hyperbolic set (a < 0 or e ≥ 1) returns
 * 'NOT_CLOSED_ORBIT'.
 *
 * Evaluation (fixed):
 *   r_p = a * (1 − e);  r_a = a * (1 + e)
 *   q = Math.sqrt(a / μ);  T = (2 * Math.PI) * (a * q);  n = (1 / q) / a
 *   ξ = −μ / (2 * a)
 *   |h| = Math.sqrt(μ * ((a * (1 − e)) * (1 + e)))
 * (T and n are written with sqrt(a/μ) to avoid forming a^3, which overflows for a > ~5.6e102 m.)
 *
 * Sources: D4, D6, D7 (derived; see module header).
 */
export function closedOrbitQuantities(
  semiMajorAxis_m: number,
  eccentricity: number,
  mu_m3ps2: number,
): ClosedOrbitQuantitiesResult {
  const a = semiMajorAxis_m;
  const e = eccentricity;
  if (!Number.isFinite(a) || !Number.isFinite(e) || !Number.isFinite(mu_m3ps2)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(mu_m3ps2 > 0)) {
    return { ok: false, reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE' };
  }
  if (!(a > 0) || !(e >= 0 && e < 1)) {
    return { ok: false, reason: 'NOT_CLOSED_ORBIT' };
  }
  const oneMinusE = 1 - e;
  const periapsisRadius_m = a * oneMinusE;
  const apoapsisRadius_m = a * (1 + e);
  const q = Math.sqrt(a / mu_m3ps2);
  const period_s = 2 * Math.PI * (a * q);
  const meanMotion_radps = 1 / q / a;
  const specificEnergy_m2ps2 = -mu_m3ps2 / (2 * a);
  const specificAngularMomentum_m2ps = Math.sqrt(mu_m3ps2 * (a * oneMinusE * (1 + e)));

  const values = [
    periapsisRadius_m,
    apoapsisRadius_m,
    period_s,
    meanMotion_radps,
    specificEnergy_m2ps2,
    specificAngularMomentum_m2ps,
  ];
  if (!values.every((x) => Number.isFinite(x) && x !== 0)) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  return {
    ok: true,
    quantities: {
      periapsisRadius_m,
      apoapsisRadius_m,
      period_s,
      meanMotion_radps,
      specificEnergy_m2ps2,
      specificAngularMomentum_m2ps,
    },
  };
}

/** Energy and angular momentum of a state. */
export interface StateIntegrals {
  /** ξ = v·v/2 − μ/|r| [m^2/s^2] (D4). Negative: closed; zero: parabolic; positive: open. */
  readonly specificEnergy_m2ps2: number;
  /** |h| = |r × v| [m^2/s] (D1). Zero for rectilinear motion. */
  readonly specificAngularMomentum_m2ps: number;
}

/** Reasons `stateIntegrals` declines. */
export type StateIntegralsFailure =
  /** A component or μ is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** μ ≤ 0. */
  | 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'
  /** |r| = 0: μ/|r| is undefined. */
  | 'ZERO_POSITION'
  /** Overflow in an intermediate. */
  | 'NON_FINITE_RESULT';

/** Result of `stateIntegrals`. */
export type StateIntegralsResult =
  | { readonly ok: true; readonly integrals: StateIntegrals }
  | { readonly ok: false; readonly reason: StateIntegralsFailure };

/**
 * Specific energy and specific angular momentum magnitude of a state (any conic), from position
 * [m] and velocity [m/s] in one inertial frame and μ [m^3/s^2].
 *
 * Evaluation (fixed): rn = normVec3(r); ξ = dotVec3(v, v) / 2 − μ / rn; |h| = normVec3(r × v).
 * Domain: finite inputs, μ > 0, r ≠ 0; otherwise `{ ok: false, reason }`.
 * Sources: D1, D4 (elements.ts header).
 */
export function stateIntegrals(
  position_m: Vec3,
  velocity_mps: Vec3,
  mu_m3ps2: number,
): StateIntegralsResult {
  const finite = [...position_m, ...velocity_mps, mu_m3ps2].every((x) => Number.isFinite(x));
  if (!finite) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(mu_m3ps2 > 0)) {
    return { ok: false, reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE' };
  }
  const rn = normVec3(position_m);
  if (rn === 0) {
    return { ok: false, reason: 'ZERO_POSITION' };
  }
  const specificEnergy_m2ps2 = dotVec3(velocity_mps, velocity_mps) / 2 - mu_m3ps2 / rn;
  const specificAngularMomentum_m2ps = normVec3(crossVec3(position_m, velocity_mps));
  if (!Number.isFinite(specificEnergy_m2ps2) || !Number.isFinite(specificAngularMomentum_m2ps)) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  return { ok: true, integrals: { specificEnergy_m2ps2, specificAngularMomentum_m2ps } };
}
