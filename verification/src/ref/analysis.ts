/**
 * Independent reference for the analysis outputs of one Cartesian state (ML-TASK-036; tolerance
 * record revision 5 §8 VI-03 (b) and §7 VT-15 "FR-010 AC3 comparison table").
 *
 * Independence (ADR-003): written from the tolerance record, contracts-v1.md §3, ADR-008 and the
 * standard two-body relations below. It does not import or call `packages/simulation` (the
 * analysis module) or `packages/astrodynamics`, and neither was read to write it; only the
 * analysis module's public quantity identifiers (ML-TASK-031 report) are reused as field names.
 *
 * Two methods, used to check each other (task rule: every new number by two independent methods):
 *
 *  (H) `analysisReferenceHp`: BigFloat arithmetic (200 bits) from the exact binary64 state, rounded
 *      once to binary64 at the end. In-plane polar formulation (NOT the e-vector):
 *        r = ‖r‖, v = ‖v‖, altitude = r − R_ref, ξ = v²/2 − μ/r, a = −μ/(2ξ),
 *        h = r × v, i = atan2(√(h_x² + h_y²), h_z), Ω = atan2(h_x, −h_y),
 *        argument of latitude u = atan2(r·m̂, r·n̂) with n̂ = ẑ × h/‖ẑ × h‖, m̂ = ĥ × n̂,
 *        e cos ν = h²/(μr) − 1, e sin ν = h (r·v)/(μr), e = √(..), ν = atan2(e sin ν, e cos ν),
 *        ω = u − ν; closed orbits only (ξ < 0): r_p = a(1 − e), r_a = a(1 + e), T = 2π√(a³/μ).
 *      Angles in [0, 2π). The ADR-008 convention (thresholds ε_e = ε_i = 1e-5, strict comparison;
 *      circular: ω := 0, ν := u; equatorial: Ω := 0, ω := longitude of periapsis, ν kept; both:
 *      ν := true longitude; substitute angles positive about ĥ, i.e. ϖ = ω ± Ω, λ = u ± Ω with +
 *      for prograde and − for retrograde) is applied after the raw extraction.
 *  (B) `analysisReference64`: binary64, the record's canonical formulation (the one the per-side
 *      budgets of §8 VI-03 (b) are derived for): e-vector e = [(v² − μ/r) r − (r·v) v]/μ,
 *      ω = atan2(ê·m̂, ê·n̂) (node to e-vector), ν = atan2(r·(ĥ × ê), r·ê) (e-vector to r),
 *      i and Ω as above. Used only in the self-tests (analysis.test.ts), never as the comparison
 *      reference.
 *
 * Units: m, m/s, rad, m²/s², s; frame: the inertial frame of the state (GCRF).
 */
import {
  add,
  atan2 as atan2B,
  cmp,
  div,
  fromInt,
  fromNumber,
  isZero,
  ldexp,
  mul,
  neg,
  pi as piB,
  sign,
  sqrt as sqrtB,
  sub,
  toNumber,
  type BigFloat,
} from '../hp/bigfloat';
import { b3, crossB, dotB, type B3 } from '../hp/hp-vec';
import { cross, dot, norm, wrapTwoPi, type V3 } from './vec';

const P = 200;

/** ADR-008 thresholds (approved 2026-11-13, tolerance record §10 / §15). */
export const EPS_E = 1e-5;
export const EPS_I = 1e-5;

export interface ReferenceConstants {
  readonly mu_m3ps2: number;
  readonly referenceRadius_m: number;
}

export type ReferenceConvention = 'NONE' | 'CIRCULAR' | 'EQUATORIAL' | 'CIRCULAR_EQUATORIAL';

/** Reference analysis quantities of one state (field names = the module's quantity ids). */
export interface AnalysisReference {
  readonly radius_m: number;
  readonly altitude_m: number;
  readonly speed_mps: number;
  readonly specificEnergy_m2ps2: number;
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
  /** null on an open orbit (ξ ≥ 0). */
  readonly periapsisRadius_m: number | null;
  readonly apoapsisRadius_m: number | null;
  readonly period_s: number | null;
  /** ADR-008 classification (strict comparison with the thresholds). */
  readonly convention: ReferenceConvention;
  /** ξ < 0. */
  readonly closed: boolean;
  /** Conditioning inputs of the §8 VI-03 (b) table, from this state. */
  readonly kappaE: number;
  readonly kappaH: number;
  /** v²/2 + μ/r (scale of the energy row). */
  readonly energyScale_m2ps2: number;
  /** min(i, π − i). */
  readonly iPrime_rad: number;
}

function wrap2PiB(x: BigFloat, twoPi: BigFloat): BigFloat {
  let y = x;
  while (sign(y) < 0) y = add(y, twoPi, P);
  while (cmp(y, twoPi) >= 0) y = sub(y, twoPi, P);
  return y;
}

/** Method (H): high-precision polar formulation; see module comment. */
export function analysisReferenceHp(
  position_m: V3,
  velocity_mps: V3,
  constants: ReferenceConstants,
): AnalysisReference {
  const r = b3(position_m);
  const v = b3(velocity_mps);
  const mu = fromNumber(constants.mu_m3ps2);
  const R = fromNumber(constants.referenceRadius_m);
  const one = fromInt(1);
  const pi = piB(P);
  const twoPi = ldexp(pi, 1);

  const r2 = dotB(r, r, P);
  const rmag = sqrtB(r2, P);
  const v2 = dotB(v, v, P);
  const vmag = sqrtB(v2, P);
  const muOverR = div(mu, rmag, P);
  const xi = sub(ldexp(v2, -1), muOverR, P);
  const a = div(neg(mu), ldexp(xi, 1), P);

  const h = crossB(r, v, P);
  const h2 = dotB(h, h, P);
  const hmag = sqrtB(h2, P);
  const hxy2 = add(mul(h[0], h[0], P), mul(h[1], h[1], P), P);
  const hxy = sqrtB(hxy2, P);
  const inc = atan2B(hxy, h[2], P);
  const nodeUndefined = isZero(hxy);

  let raw: BigFloat;
  let u: BigFloat;
  if (nodeUndefined) {
    raw = fromInt(0);
    // n̂ = x̂, m̂ = ĥ × x̂ = (0, sgn h_z, 0).
    u = atan2B(sign(h[2]) < 0 ? neg(r[1]) : r[1], r[0], P);
  } else {
    raw = atan2B(h[0], neg(h[1]), P);
    // r·n̂ ∝ (−h_y x + h_x y); r·m̂ ∝ (−h_z (h_x x + h_y y) + (h_x² + h_y²) z)/‖h‖ (common factor
    // 1/√(h_x² + h_y²) dropped: atan2 is invariant to a positive common scale).
    const rn = add(mul(neg(h[1]), r[0], P), mul(h[0], r[1], P), P);
    const rm = div(
      add(mul(neg(h[2]), add(mul(h[0], r[0], P), mul(h[1], r[1], P), P), P), mul(hxy2, r[2], P), P),
      hmag,
      P,
    );
    u = atan2B(rm, rn, P);
  }
  const muR = mul(mu, rmag, P);
  const ecos = sub(div(h2, muR, P), one, P);
  const esin = div(mul(hmag, dotB(r, v, P), P), muR, P);
  const e = sqrtB(add(mul(ecos, ecos, P), mul(esin, esin, P), P), P);
  const nu = isZero(e) ? fromInt(0) : atan2B(esin, ecos, P);
  const omegaRaw = wrap2PiB(sub(u, nu, P), twoPi);
  const raan = wrap2PiB(raw, twoPi);
  const nuW = wrap2PiB(nu, twoPi);
  const uW = wrap2PiB(u, twoPi);

  const closed = sign(xi) < 0;
  let rp: number | null = null;
  let ra: number | null = null;
  let T: number | null = null;
  if (closed) {
    rp = toNumber(mul(a, sub(one, e, P), P));
    ra = toNumber(mul(a, add(one, e, P), P));
    T = toNumber(mul(twoPi, sqrtB(div(mul(mul(a, a, P), a, P), mu, P), P), P));
  }

  const eN = toNumber(e);
  const iN = toNumber(inc);
  const iPrime = Math.min(iN, toNumber(sub(pi, inc, P)));
  const circular = eN < EPS_E;
  const equatorial = iPrime < EPS_I;
  const retrograde = cmp(inc, ldexp(pi, -1)) > 0;
  let raanOut = raan;
  let argpOut = omegaRaw;
  let nuOut = nuW;
  if (equatorial) {
    const s = retrograde ? neg(raan) : raan;
    raanOut = fromInt(0);
    if (circular) {
      argpOut = fromInt(0);
      nuOut = wrap2PiB(add(uW, s, P), twoPi);
    } else {
      argpOut = wrap2PiB(add(omegaRaw, s, P), twoPi);
    }
  } else if (circular) {
    argpOut = fromInt(0);
    nuOut = uW;
  }
  const convention: ReferenceConvention =
    circular && equatorial
      ? 'CIRCULAR_EQUATORIAL'
      : circular
        ? 'CIRCULAR'
        : equatorial
          ? 'EQUATORIAL'
          : 'NONE';

  const energyScale = add(ldexp(v2, -1), muOverR, P);
  const absXi = sign(xi) < 0 ? neg(xi) : xi;
  return {
    radius_m: toNumber(rmag),
    altitude_m: toNumber(sub(rmag, R, P)),
    speed_mps: toNumber(vmag),
    specificEnergy_m2ps2: toNumber(xi),
    semiMajorAxis_m: toNumber(a),
    eccentricity: eN,
    inclination_rad: iN,
    raan_rad: toNumber(raanOut),
    argPeriapsis_rad: toNumber(argpOut),
    trueAnomaly_rad: toNumber(nuOut),
    periapsisRadius_m: rp,
    apoapsisRadius_m: ra,
    period_s: T,
    convention,
    closed,
    kappaE: toNumber(div(energyScale, absXi, P)),
    kappaH: toNumber(div(mul(rmag, vmag, P), hmag, P)),
    energyScale_m2ps2: toNumber(energyScale),
    iPrime_rad: iPrime,
  };
}

/** ‖x‖ of a binary64 vector in high precision, rounded once. */
export function normHp(x: V3): number {
  const b: B3 = b3(x);
  return toNumber(sqrtB(dotB(b, b, P), P));
}

/** Raw (no convention) quantities of method (B); see module comment. Binary64 throughout. */
export interface AnalysisReference64 {
  readonly radius_m: number;
  readonly altitude_m: number;
  readonly speed_mps: number;
  readonly specificEnergy_m2ps2: number;
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
  readonly periapsisRadius_m: number | null;
  readonly apoapsisRadius_m: number | null;
  readonly period_s: number | null;
}

/** Method (B): binary64, e-vector form (requires a non-equatorial, non-circular state). */
export function analysisReference64(
  position_m: V3,
  velocity_mps: V3,
  constants: ReferenceConstants,
): AnalysisReference64 {
  const mu = constants.mu_m3ps2;
  const r = position_m;
  const v = velocity_mps;
  const rmag = norm(r);
  const v2 = dot(v, v);
  const xi = v2 / 2 - mu / rmag;
  const a = -mu / (2 * xi);
  const c = v2 - mu / rmag;
  const rv = dot(r, v);
  const evec: V3 = [
    (c * r[0] - rv * v[0]) / mu,
    (c * r[1] - rv * v[1]) / mu,
    (c * r[2] - rv * v[2]) / mu,
  ];
  const e = norm(evec);
  const h = cross(r, v);
  const hmag = norm(h);
  const hxy = Math.sqrt(h[0] * h[0] + h[1] * h[1]);
  const inc = Math.atan2(hxy, h[2]);
  const raan = Math.atan2(h[0], -h[1]);
  const nHat: V3 = [-h[1] / hxy, h[0] / hxy, 0];
  const hHat: V3 = [h[0] / hmag, h[1] / hmag, h[2] / hmag];
  const mHat = cross(hHat, nHat);
  const argp = Math.atan2(dot(evec, mHat), dot(evec, nHat));
  const pHat = cross(hHat, evec);
  const nu = Math.atan2(dot(r, pHat), dot(r, evec));
  const closed = xi < 0;
  return {
    radius_m: rmag,
    altitude_m: rmag - constants.referenceRadius_m,
    speed_mps: Math.sqrt(v2),
    specificEnergy_m2ps2: xi,
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: inc,
    raan_rad: wrapTwoPi(raan),
    argPeriapsis_rad: wrapTwoPi(argp),
    trueAnomaly_rad: wrapTwoPi(nu),
    periapsisRadius_m: closed ? a * (1 - e) : null,
    apoapsisRadius_m: closed ? a * (1 + e) : null,
    period_s: closed ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : null,
  };
}

/** e-vector magnitude in high precision (second HP formulation, self-test only). */
export function eccentricityEvectorHp(position_m: V3, velocity_mps: V3, mu_m3ps2: number): number {
  const r = b3(position_m);
  const v = b3(velocity_mps);
  const mu = fromNumber(mu_m3ps2);
  const rmag = sqrtB(dotB(r, r, P), P);
  const c = sub(dotB(v, v, P), div(mu, rmag, P), P);
  const rv = dotB(r, v, P);
  const ev: B3 = [
    sub(mul(c, r[0], P), mul(rv, v[0], P), P),
    sub(mul(c, r[1], P), mul(rv, v[1], P), P),
    sub(mul(c, r[2], P), mul(rv, v[2], P), P),
  ];
  return toNumber(div(sqrtB(dotB(ev, ev, P), P), mu, P));
}
