/**
 * Classical Keplerian elements <-> Cartesian state (ML-TASK-014; ML-FR-002, ML-FR-003, ML-FR-009).
 *
 * Frame: every vector is in one inertial frame (in M1: GCRF, ADR-004). The angles i, Ω, ω, ν are
 * referred to the same frame: i is measured from its +z axis, Ω from its +x axis. No frame is
 * checked or converted here (the caller owns the frame, AGENTS.md).
 * Units: SI; m, m/s, rad, m^3/s^2. Time does not appear.
 * Arithmetic: IEEE 754 binary64, fixed evaluation order as documented per function (no FMA in
 * ECMAScript, so results are bit-reproducible for a given order and a given Math.sin/cos/atan2/sqrt).
 * Pure functions: no I/O, clock or randomness; inputs are never mutated; no function throws.
 *
 * SOURCES (ML-NFR-002). Each formula below is either taken from a source that was opened during
 * this task, or derived in the comments from vector definitions so that a reader can check it.
 * [W-PF]  Wikipedia, "Perifocal coordinate system", lead section and section on the transformation
 *         to the geocentric equatorial frame: perifocal position r = r cosθ p̂ + r sinθ q̂,
 *         velocity v = (μ/h)[−sinθ p̂ + (e + cosθ) q̂], and the matrix
 *         L = R_z(Ω) R_x(i) R_z(ω) with its nine entries.
 *         https://en.wikipedia.org/wiki/Perifocal_coordinate_system (accessed 2026-11-13).
 * [W-EV]  Wikipedia, "Eccentricity vector", section "Calculation": e = (v × h)/μ − r/|r| and the
 *         identity v × (r × v) = (v·v) r − (r·v) v.
 *         https://en.wikipedia.org/wiki/Eccentricity_vector (accessed 2026-11-13).
 * A secondary-source encyclopedia is not a primary reference; the same relations are textbook
 * material (e.g. Vallado, "Fundamentals of Astrodynamics and Applications", algorithms COE2RV and
 * RV2COE), but that book was NOT opened in this task: not confirmed. Independent confirmation is
 * VT-02/VT-03/VT-04 (Verification Engineer, L2/L3).
 *
 * Derivations used below (D1–D5), from h = r × v and Newton's two-body law r̈ = −μ r/|r|^3:
 * D1  h = r × v is constant (ḣ = v × v + r × r̈ = 0), so r and v stay in the plane ⟂ h.
 * D2  Eccentricity vector [W-EV]: e = (v × h)/μ − r/|r|. With v × (r × v) = (v·v) r − (r·v) v:
 *     e = ((v·v − μ/|r|) r − (r·v) v) / μ.
 * D3  Orbit equation: r·(v × h) = (r × v)·h = |h|^2, so e·r = |h|^2/μ − |r|. Writing ν for the
 *     angle from e to r (in the sense of h), |e||r| cos ν = |h|^2/μ − |r|, i.e.
 *     |r| = p / (1 + e cos ν) with p = |h|^2/μ (semi-latus rectum).
 * D4  Specific energy ξ = (v·v)/2 − μ/|r| is constant (energy integral). At periapsis (ν = 0,
 *     r ⟂ v): ξ = |h|^2/(2 r_p^2) − μ/r_p with r_p = p/(1 + e). For e ≠ 1 define a by
 *     p = a(1 − e^2); then r_p = a(1 − e) and ξ = μ(1 + e)/(2a(1 − e)) − μ/(a(1 − e)) = −μ/(2a),
 *     i.e. a = −μ/(2ξ) (vis-viva). a > 0 iff ξ < 0 (ellipse, e < 1); a < 0 iff ξ > 0 (hyperbola).
 * D5  Inclination and node: i is the angle between h and +z; the ascending node direction is
 *     N = ẑ × h = (−h_y, h_x, 0). With ĥ = (sin Ω sin i, −cos Ω sin i, cos i) (the h direction
 *     for node longitude Ω and inclination i, consistent with [W-PF] column 3), N = sin i ·
 *     (cos Ω, sin Ω, 0).
 */

import { normalizeFiniteAngle_rad } from './angles';
import { crossVec3, dotVec3, normalizeVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

/** The six classical elements, SI units. Angles referred to the inertial frame of the state. */
export interface KeplerianElements {
  /** a [m]. Positive for an ellipse; negative for a hyperbola (state→elements only). */
  readonly semiMajorAxis_m: number;
  /** e [-], ≥ 0. Always the computed value (ADR-008); never set to zero. */
  readonly eccentricity: number;
  /** i [rad], in [0, π]. Always the computed value (ADR-008); never set to zero. */
  readonly inclination_rad: number;
  /** Ω, right ascension of the ascending node [rad]. */
  readonly raan_rad: number;
  /** ω, argument of periapsis [rad]. */
  readonly argPeriapsis_rad: number;
  /** ν, true anomaly [rad]. */
  readonly trueAnomaly_rad: number;
}

/** Position and velocity in one inertial frame. */
export interface CartesianState {
  /** Position [m]. */
  readonly position_m: Vec3;
  /** Velocity [m/s]. */
  readonly velocity_mps: Vec3;
}

// ---------------------------------------------------------------------------------------------
// Elements -> state
// ---------------------------------------------------------------------------------------------

/** Reasons `elementsToState` declines to compute a state. */
export type ElementsToStateFailure =
  /** A field of the elements or μ is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** μ ≤ 0. */
  | 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'
  /** a ≤ 0. */
  | 'SEMI_MAJOR_AXIS_NOT_POSITIVE'
  /** e < 0 or e ≥ 1 (this function handles closed input orbits only, contracts-v1 §3). */
  | 'ECCENTRICITY_OUT_OF_RANGE'
  /** i < 0 or i > Math.PI. */
  | 'INCLINATION_OUT_OF_RANGE'
  /** The arithmetic overflowed or underflowed into a non-finite component (extreme a or μ). */
  | 'NON_FINITE_RESULT';

/** Result of `elementsToState`. Never contains NaN or ±Infinity. */
export type ElementsToStateResult =
  | { readonly ok: true; readonly state: CartesianState }
  | { readonly ok: false; readonly reason: ElementsToStateFailure };

/**
 * Cartesian state from classical elements: the regular perifocal-to-inertial map, applied to the
 * given elements with no special-casing of circular or equatorial orbits and no re-normalisation
 * of the angles (contracts-v1 §3, owner decision 4 of 2026-11-11; ADR-008).
 *
 * Inputs: elements in SI (a [m], e [-], angles [rad]) and μ [m^3/s^2].
 * Output: position [m] and velocity [m/s] in the inertial frame to which the angles refer.
 *
 * Preconditions (the contract validators run upstream; this function re-checks only what would
 * otherwise produce a non-finite or meaningless result and returns `{ ok: false, reason }`):
 * all inputs finite; μ > 0; a > 0; 0 ≤ e < 1; 0 ≤ i ≤ Math.PI. Ω, ω, ν may be any finite number
 * (the map is 2π-periodic in each); the contract range [0, 2π) is the validator's job and is not
 * re-checked, and the angles are not reduced.
 *
 * Note on i = Math.PI: Math.sin(Math.PI) ≈ 1.22e-16, not 0, so the "retrograde equatorial" state
 * has a z component of that relative size. This is the regular map applied to the given number.
 *
 * Evaluation order (fixed):
 * 1. cΩ = cos Ω, sΩ = sin Ω, ci = cos i, si = sin i, cω = cos ω, sω = sin ω, cν = cos ν,
 *    sν = sin ν (Math.cos / Math.sin).
 * 2. P (inertial direction of periapsis) and Q (perifocal q̂ axis): columns 1 and 2 of
 *    L = R_z(Ω) R_x(i) R_z(ω) [W-PF]:
 *      P = [cΩ*cω − (sΩ*ci)*sω,  sΩ*cω + (cΩ*ci)*sω,  si*sω]
 *      Q = [(−cΩ)*sω − (sΩ*ci)*cω,  (−sΩ)*sω + (cΩ*ci)*cω,  si*cω]
 *    (Check by D5: with N̂ = (cΩ, sΩ, 0) and M̂ = ĥ × N̂ = (−ci sΩ, ci cΩ, si), P = cω N̂ + sω M̂
 *    and Q = −sω N̂ + cω M̂.)
 * 3. p = (a * (1 − e)) * (1 + e) (= a(1 − e^2), D4; factored to avoid cancellation in 1 − e^2).
 * 4. r = p / (1 + e * cν) (D3).
 * 5. position_k = (r * cν) * P_k + (r * sν) * Q_k, k = 0, 1, 2 [W-PF].
 * 6. s = Math.sqrt(μ / p) (= μ/|h| since |h| = sqrt(μ p), D3);
 *    velocity_k = (s * (−sν)) * P_k + (s * (e + cν)) * Q_k [W-PF].
 * 7. If any component is not finite: `NON_FINITE_RESULT`.
 *
 * Sources: [W-PF] (opened), D3–D5 (derived above). Vallado COE2RV: not opened, not confirmed.
 */
export function elementsToState(
  elements: KeplerianElements,
  mu_m3ps2: number,
): ElementsToStateResult {
  const a = elements.semiMajorAxis_m;
  const e = elements.eccentricity;
  const inc = elements.inclination_rad;
  const raan = elements.raan_rad;
  const argp = elements.argPeriapsis_rad;
  const nu = elements.trueAnomaly_rad;

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(e) ||
    !Number.isFinite(inc) ||
    !Number.isFinite(raan) ||
    !Number.isFinite(argp) ||
    !Number.isFinite(nu) ||
    !Number.isFinite(mu_m3ps2)
  ) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(mu_m3ps2 > 0)) {
    return { ok: false, reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE' };
  }
  if (!(a > 0)) {
    return { ok: false, reason: 'SEMI_MAJOR_AXIS_NOT_POSITIVE' };
  }
  if (!(e >= 0 && e < 1)) {
    return { ok: false, reason: 'ECCENTRICITY_OUT_OF_RANGE' };
  }
  if (!(inc >= 0 && inc <= Math.PI)) {
    return { ok: false, reason: 'INCLINATION_OUT_OF_RANGE' };
  }

  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const cw = Math.cos(argp);
  const sw = Math.sin(argp);
  const cn = Math.cos(nu);
  const sn = Math.sin(nu);

  const P: Vec3 = [cO * cw - sO * ci * sw, sO * cw + cO * ci * sw, si * sw];
  const Q: Vec3 = [-cO * sw - sO * ci * cw, -sO * sw + cO * ci * cw, si * cw];

  const p = a * (1 - e) * (1 + e);
  const r = p / (1 + e * cn);
  const rc = r * cn;
  const rs = r * sn;
  const position_m: Vec3 = [rc * P[0] + rs * Q[0], rc * P[1] + rs * Q[1], rc * P[2] + rs * Q[2]];

  const s = Math.sqrt(mu_m3ps2 / p);
  const vp = s * -sn;
  const vq = s * (e + cn);
  const velocity_mps: Vec3 = [vp * P[0] + vq * Q[0], vp * P[1] + vq * Q[1], vp * P[2] + vq * Q[2]];

  if (!allFinite(position_m) || !allFinite(velocity_mps)) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  return { ok: true, state: { position_m, velocity_mps } };
}

// ---------------------------------------------------------------------------------------------
// State -> elements
// ---------------------------------------------------------------------------------------------

/**
 * Detection thresholds for the degenerate-element convention (ADR-008). There is NO default:
 * the approved values come with the tolerance record (ML-TASK-010) and are passed by the caller.
 */
export interface DegeneracyThresholds {
  /** ε_e [-]: the orbit is treated as circular when e < ε_e (or e is exactly 0). Finite, ≥ 0. */
  readonly circularEccentricity: number;
  /**
   * ε_i [rad]: the orbit is treated as equatorial when i' = min(i, Math.PI − i) < ε_i (or the
   * node vector is exactly zero). Finite, ≥ 0.
   */
  readonly equatorialInclination_rad: number;
}

/**
 * Which degenerate-element convention was applied (architecture §3 as refined by ADR-008). The UI
 * uses it to state which elements are undefined (ML-FR-002 AC3).
 * - 'NONE': all six elements are computed.
 * - 'CIRCULAR': ω undefined; ω := 0 and ν := argument of latitude u (angle from the ascending node
 *   to r).
 * - 'EQUATORIAL': Ω undefined; Ω := 0 and ω := longitude of periapsis (angle from +x to e).
 * - 'CIRCULAR_EQUATORIAL': Ω and ω undefined; Ω := 0, ω := 0 and ν := true longitude (angle from
 *   +x to r).
 * In the two equatorial cases the angles from +x are measured in the plane of the orbit, from the
 * projection of +x onto that plane, positively in the sense of motion (right-handed about h).
 * For a retrograde equatorial orbit (i near π) this is clockwise seen from +z; see
 * `stateToElements` for why.
 */
export type DegenerateConvention = 'NONE' | 'CIRCULAR' | 'EQUATORIAL' | 'CIRCULAR_EQUATORIAL';

/**
 * Conic type, from the sign of the specific energy ξ (D4): 'ELLIPTIC' when ξ < 0 (a > 0),
 * 'HYPERBOLIC' when ξ > 0 (a < 0). ξ = 0 (parabola) is reported as a failure. Near e = 1 the
 * computed e and the sign of the computed ξ are independent roundings and can disagree (e.g.
 * e = 1 − 1e-16 with ξ > 0); the conic type follows ξ so that it always matches the sign of a.
 */
export type ConicType = 'ELLIPTIC' | 'HYPERBOLIC';

/** Reasons `stateToElements` declines to compute elements. */
export type StateToElementsFailure =
  /** A component of the state, or μ, is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** μ ≤ 0. */
  | 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'
  /** A threshold is negative, NaN or infinite. */
  | 'INVALID_THRESHOLD'
  /** position is the zero vector. */
  | 'ZERO_POSITION'
  /** r × v is exactly zero (rectilinear motion): the orbital plane is undefined. */
  | 'ZERO_ANGULAR_MOMENTUM'
  /** ξ is exactly 0 (parabola) or −μ/(2ξ) overflows: a is undefined. */
  | 'SEMI_MAJOR_AXIS_UNDEFINED'
  /** An intermediate overflowed (extreme magnitudes). */
  | 'NON_FINITE_RESULT';

/** Successful output of `stateToElements`. */
export interface StateToElementsSuccess {
  readonly ok: true;
  /** Elements; angles normalised to [0, 2 * Math.PI) by the rule of `normalizeAngle_rad`. */
  readonly elements: KeplerianElements;
  /** Which angles were assigned by convention. */
  readonly convention: DegenerateConvention;
  /** Elliptic (a > 0) or hyperbolic (a < 0). */
  readonly conic: ConicType;
}

/** Result of `stateToElements`. Never contains NaN or ±Infinity. */
export type StateToElementsResult =
  StateToElementsSuccess | { readonly ok: false; readonly reason: StateToElementsFailure };

const X_AXIS: Vec3 = [1, 0, 0];

/**
 * Angle [rad, in (−π, π]] from `from` to `to`, measured in the plane ⟂ hHat, positive in the
 * right-handed sense about hHat:
 *   atan2((from × to) · hHat, from · to).
 * Both arguments of atan2 carry the same positive factor |from_⟂| |to| (from_⟂ = projection of
 * `from` onto the plane, when `to` lies in that plane), so neither needs normalising. The
 * well-conditioned atan2 form is used instead of acos/asin of a ratio (tolerance-review
 * acceptance criterion: acos loses about half the digits near 0 and π).
 */
function signedAngleAbout(from: Vec3, to: Vec3, hHat: Vec3): number {
  return Math.atan2(dotVec3(crossVec3(from, to), hHat), dotVec3(from, to));
}

/**
 * Classical elements from a Cartesian state, with the degenerate-element convention of
 * architecture §3 as refined by ADR-008 (state→elements only).
 *
 * Inputs: state (position [m], velocity [m/s]) in an inertial frame; μ [m^3/s^2] > 0; thresholds
 * (no default; see `DegeneracyThresholds`). Output angles refer to the same frame.
 *
 * Evaluation (fixed; all vector operations are those of vector3.ts with their documented order):
 *  1. Validate: all inputs finite, μ > 0, thresholds finite and ≥ 0.
 *  2. rn = |r| (normVec3); rn = 0 → ZERO_POSITION.
 *  3. h = r × v (crossVec3); ĥ = normalizeVec3(h); zero → ZERO_ANGULAR_MOMENTUM (D1).
 *  4. vv = v·v, rv = r·v (dotVec3).
 *  5. ξ = vv / 2 − μ / rn (D4). If ξ = 0: SEMI_MAJOR_AXIS_UNDEFINED.
 *     a = −μ / (2 ξ); if not finite: SEMI_MAJOR_AXIS_UNDEFINED.
 *  6. c = vv − μ / rn; e⃗_k = (c * r_k − rv * v_k) / μ (D2, [W-EV]).
 *  7. e = |e⃗| (normVec3). Reported as computed (ADR-008).
 *  8. N = (−h_y, h_x, 0) (D5); nn = |N| (normVec3).
 *  9. i = atan2(nn, h_z) ∈ [0, π] (D5: nn = |h| sin i, h_z = |h| cos i). Reported as computed.
 *     (atan2 form, not acos(h_z/|h|).)
 * 10. circular  := e === 0 or e < ε_e.
 *     equatorial := nn === 0 or min(i, Math.PI − i) < ε_i  (nn = 0 implies i ∈ {0, π} exactly).
 * 11. Angles (each atan2 result then reduced to [0, 2π) with the rule of `normalizeAngle_rad`):
 *     Ω = equatorial ? 0 : atan2(N_y, N_x)      = atan2(h_x, −h_y)          (D5)
 *     ref = equatorial ? +x = (1, 0, 0) : N      (direction from which ω, or u, is measured)
 *     not circular:  ω = signedAngleAbout(ref, e⃗, ĥ)
 *                         = atan2((ref × e⃗)·ĥ, ref·e⃗)  — argument of periapsis, or longitude
 *                           of periapsis when equatorial
 *                    ν = signedAngleAbout(e⃗, r, ĥ) = atan2((e⃗ × r)·ĥ, e⃗·r)   (D3)
 *     circular:      ω = 0
 *                    ν = signedAngleAbout(ref, r, ĥ) = atan2((ref × r)·ĥ, ref·r) — argument of
 *                        latitude, or true longitude when also equatorial.
 * 12. Any non-finite intermediate in the outputs: NON_FINITE_RESULT.
 *
 * Retrograde equatorial (i near π): the substitute angles are measured from (the in-plane
 * projection of) +x positively about ĥ, i.e. in the direction of motion, which for ĥ ≈ −z is
 * clockwise seen from +z. Reason: with Ω := 0 and i = π, the regular map of `elementsToState`
 * places periapsis at P = (cos ω, −sin ω, 0) and r at angle ν from it in the same sense, so these
 * definitions make state → elements → state consistent (no reflection) for retrograde as well as
 * prograde equatorial orbits. Texts that define the longitude of periapsis as Ω + ω measured
 * eastward would differ in sign for i = π; that alternative is not used.
 *
 * Open orbits: for ξ > 0 the same steps apply and return a < 0, e ≥ 1 (up to rounding near 1),
 * i, Ω, ω and ν (the hyperbolic true anomaly, reduced to [0, 2π)); conic = 'HYPERBOLIC'. A state
 * with ξ exactly 0 (parabola) or with |a| overflowing returns SEMI_MAJOR_AXIS_UNDEFINED. Only
 * exactly rectilinear states (h = 0) return ZERO_ANGULAR_MOMENTUM; nearly rectilinear states
 * return elements whose angles are ill-conditioned.
 *
 * Sources: [W-EV] (opened) for e⃗; D1–D5 (derived in the module header). Vallado RV2COE: not
 * opened, not confirmed; note that this function deliberately uses atan2 where RV2COE-style
 * algorithms use acos.
 */
export function stateToElements(
  state: CartesianState,
  mu_m3ps2: number,
  thresholds: DegeneracyThresholds,
): StateToElementsResult {
  const r = state.position_m;
  const v = state.velocity_mps;
  if (!allFinite(r) || !allFinite(v) || !Number.isFinite(mu_m3ps2)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(mu_m3ps2 > 0)) {
    return { ok: false, reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE' };
  }
  const epsE = thresholds.circularEccentricity;
  const epsI = thresholds.equatorialInclination_rad;
  if (!Number.isFinite(epsE) || !Number.isFinite(epsI) || !(epsE >= 0) || !(epsI >= 0)) {
    return { ok: false, reason: 'INVALID_THRESHOLD' };
  }

  const rn = normVec3(r);
  if (rn === 0) {
    return { ok: false, reason: 'ZERO_POSITION' };
  }
  const h = crossVec3(r, v);
  const hUnit = normalizeVec3(h);
  if (!hUnit.ok) {
    return {
      ok: false,
      reason: hUnit.reason === 'ZERO_VECTOR' ? 'ZERO_ANGULAR_MOMENTUM' : 'NON_FINITE_RESULT',
    };
  }
  const hHat = hUnit.unit;

  const vv = dotVec3(v, v);
  const rv = dotVec3(r, v);
  const muOverR = mu_m3ps2 / rn;
  const xi = vv / 2 - muOverR;
  if (xi === 0) {
    return { ok: false, reason: 'SEMI_MAJOR_AXIS_UNDEFINED' };
  }
  const a = -mu_m3ps2 / (2 * xi);
  if (!Number.isFinite(a)) {
    return { ok: false, reason: 'SEMI_MAJOR_AXIS_UNDEFINED' };
  }

  const c = vv - muOverR;
  const eVec: Vec3 = [
    (c * r[0] - rv * v[0]) / mu_m3ps2,
    (c * r[1] - rv * v[1]) / mu_m3ps2,
    (c * r[2] - rv * v[2]) / mu_m3ps2,
  ];
  const e = normVec3(eVec);

  const node: Vec3 = [-h[1], h[0], 0];
  const nn = normVec3(node);
  const inc = Math.atan2(nn, h[2]);

  const circular = e === 0 || e < epsE;
  const equatorial = nn === 0 || Math.min(inc, Math.PI - inc) < epsI;

  const raan = equatorial ? 0 : normalizeFiniteAngle_rad(Math.atan2(node[1], node[0]));
  const ref = equatorial ? X_AXIS : node;
  let argp: number;
  let nu: number;
  if (circular) {
    argp = 0;
    nu = normalizeFiniteAngle_rad(signedAngleAbout(ref, r, hHat));
  } else {
    argp = normalizeFiniteAngle_rad(signedAngleAbout(ref, eVec, hHat));
    nu = normalizeFiniteAngle_rad(signedAngleAbout(eVec, r, hHat));
  }

  const elements: KeplerianElements = {
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: inc,
    raan_rad: raan,
    argPeriapsis_rad: argp,
    trueAnomaly_rad: nu,
  };
  if (
    !Number.isFinite(e) ||
    !Number.isFinite(inc) ||
    !Number.isFinite(raan) ||
    !Number.isFinite(argp) ||
    !Number.isFinite(nu)
  ) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }

  let convention: DegenerateConvention = 'NONE';
  if (circular && equatorial) {
    convention = 'CIRCULAR_EQUATORIAL';
  } else if (circular) {
    convention = 'CIRCULAR';
  } else if (equatorial) {
    convention = 'EQUATORIAL';
  }

  return { ok: true, elements, convention, conic: xi < 0 ? 'ELLIPTIC' : 'HYPERBOLIC' };
}

function allFinite(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}
