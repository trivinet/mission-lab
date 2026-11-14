/**
 * Closed-form post-maneuver references (VT-15) and the independent escape / reference-sphere
 * classification (VT-16) of ML-TASK-018 part C. Written from the two-body relations stated below,
 * contracts-v1.md §3.1, §8.3, §11.3 (D1–D8) and §11.4 (P2, P6); packages/astrodynamics and
 * packages/simulation were not read (ADR-003).
 *
 * Two-body relations used (elementary; stated here so they can be checked):
 *   specific energy E = v²/2 − μ/r; angular momentum h = r × v; a = −μ/(2E) (E ≠ 0);
 *   e = √(1 + 2E h²/μ²); periapsis radius r_p = h²/(μ(1 + e)) (valid for every conic);
 *   ellipse: r = a(1 − e cos E), M = E − e sin E, n = √(μ/a³), e sin E = (r·v)/√(μa);
 *   hyperbola: r = |a|(e cosh F − 1), M = e sinh F − F, n = √(μ/|a|³), e sinh F = (r·v)/√(μ|a|).
 *
 * Exact maneuver in RSW coordinates. With R = r/r, the pre-maneuver velocity has RSW components
 * (v_r, v_s, 0), v_r = (r·v)/r, v_s = ‖r × v‖/r (≥ 0 by the definition of S and W). An RSW Δv
 * (ΔvR, ΔvS, ΔvW) gives the post-maneuver velocity (v_r + ΔvR, v_s + ΔvS, ΔvW), hence, without
 * forming any basis vector:
 *   E⁺ = ((v_r + ΔvR)² + (v_s + ΔvS)² + ΔvW²)/2 − μ/r,
 *   h⁺ = r·√((v_s + ΔvS)² + ΔvW²),  r·v⁺ = r (v_r + ΔvR),
 *   plane rotation angle δ = atan2(|ΔvW|, v_s + ΔvS) about R (pure normal burn: tan δ = ΔvW/v_s).
 * These are evaluated in 320-bit arithmetic from the exact binary64 pre-maneuver state.
 * Tangential burn at an apsis (v_r = 0, ΔvR = ΔvW = 0): E⁺ = E⁻ + v_sΔvS + ΔvS²/2, the burn
 * point stays an apsis, e⁺ = |1 − r/a⁺| (tolerances.md §7 VT-15 closed form, vis-viva).
 */
import {
  add,
  atan2 as atan2B,
  cmp,
  div,
  fromInt,
  fromNumber,
  mul,
  neg,
  sqrt,
  sub,
  toNumber,
  abs as absB,
  type BigFloat,
} from '../hp/bigfloat';
import { b3, crossB, dotB, normB } from '../hp/hp-vec';
import type { V3 } from './vec';

const ONE = fromInt(1);
const TWO = fromInt(2);

export interface InvariantsHp {
  readonly r: BigFloat;
  readonly rDotV: BigFloat;
  readonly v2: BigFloat;
  readonly energy: BigFloat;
  readonly h: BigFloat;
}

export function invariantsHp(mu: number, position: V3, velocity: V3): InvariantsHp {
  const rb = b3(position);
  const vb = b3(velocity);
  const r = normB(rb);
  const v2 = dotB(vb, vb);
  const energy = sub(div(v2, TWO), div(fromNumber(mu), r));
  return { r, rDotV: dotB(rb, vb), v2, energy, h: normB(crossB(rb, vb)) };
}

export interface ConicSummary {
  /** Specific energy (J/kg). */
  readonly energy_Jpkg: number;
  /** Energy scale v²/2 + μ/r (J/kg) at the given state (VT-16 case-selection margin, §7). */
  readonly energyScale_Jpkg: number;
  /** a = −μ/(2E) (negative for a hyperbola). */
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly periapsisRadius_m: number;
  readonly angularMomentum_m2ps: number;
  readonly radius_m: number;
  /** r·v: negative when moving towards periapsis. */
  readonly rDotV_m2ps: number;
}

function conicFromParts(
  mu: number,
  r: BigFloat,
  rDotV: BigFloat,
  v2: BigFloat,
  h: BigFloat,
): ConicSummary {
  const muB = fromNumber(mu);
  const pot = div(muB, r);
  const energy = sub(div(v2, TWO), pot);
  const e2 = add(ONE, div(mul(mul(TWO, energy), mul(h, h)), mul(muB, muB)));
  const e = sqrt(cmp(e2, fromInt(0)) < 0 ? fromInt(0) : e2);
  const rp = div(mul(h, h), mul(muB, add(ONE, e)));
  const a = toNumber(energy) === 0 ? Infinity : toNumber(div(neg(muB), mul(TWO, energy)));
  return {
    energy_Jpkg: toNumber(energy),
    energyScale_Jpkg: toNumber(add(div(v2, TWO), pot)),
    semiMajorAxis_m: a,
    eccentricity: toNumber(e),
    periapsisRadius_m: toNumber(rp),
    angularMomentum_m2ps: toNumber(h),
    radius_m: toNumber(r),
    rDotV_m2ps: toNumber(rDotV),
  };
}

/** Conic of a binary64 state, evaluated in 320-bit arithmetic. */
export function conicOfState(mu: number, position: V3, velocity: V3): ConicSummary {
  const inv = invariantsHp(mu, position, velocity);
  return conicFromParts(mu, inv.r, inv.rDotV, inv.v2, inv.h);
}

export interface PostManeuverClosedForm extends ConicSummary {
  /** Plane rotation angle between h⁻ and h⁺ (rad), atan2(|ΔvW|, v_s + ΔvS). */
  readonly planeRotation_rad: number;
  /** Pre-maneuver transverse speed v_s = ‖r × v‖/r and radial speed v_r = r·v/r. */
  readonly vTransverse_mps: number;
  readonly vRadial_mps: number;
}

/**
 * Exact maneuver (RSW Δv) applied to the exact binary64 pre-maneuver state, post-maneuver conic in
 * 320-bit arithmetic (see the module comment).
 */
export function postManeuverClosedForm(
  mu: number,
  position: V3,
  velocity: V3,
  dvRsw: V3,
): PostManeuverClosedForm {
  const inv = invariantsHp(mu, position, velocity);
  const vr = div(inv.rDotV, inv.r);
  const vs = div(inv.h, inv.r);
  const dv = b3(dvRsw);
  const vrP = add(vr, dv[0]);
  const vsP = add(vs, dv[1]);
  const vw = dv[2];
  const v2P = add(add(mul(vrP, vrP), mul(vsP, vsP)), mul(vw, vw));
  const hP = mul(inv.r, sqrt(add(mul(vsP, vsP), mul(vw, vw))));
  const conic = conicFromParts(mu, inv.r, mul(inv.r, vrP), v2P, hP);
  return {
    ...conic,
    planeRotation_rad: toNumber(atan2B(absB(vw), vsP)),
    vTransverse_mps: toNumber(vs),
    vRadial_mps: toNumber(vr),
  };
}

/**
 * Time (s) from the given state until the radius first becomes ≤ radius_m, or Infinity if it
 * never does. Precondition: the current radius is > radius_m. Binary64 evaluation from the conic
 * summary (used only for case classification with margins ≥ 1 %, far above its accuracy);
 * cross-checked by RK integration in maneuver.test.ts.
 */
export function timeToRadius(mu: number, c: ConicSummary, radius_m: number): number {
  if (!(c.radius_m > radius_m)) throw new RangeError('timeToRadius: start must be above radius');
  if (c.periapsisRadius_m > radius_m) return Infinity;
  const e = c.eccentricity;
  if (c.energy_Jpkg < 0) {
    const a = c.semiMajorAxis_m;
    const n = Math.sqrt(mu / (a * a * a));
    const cosE0 = (1 - c.radius_m / a) / e;
    const sinE0 = c.rDotV_m2ps / (e * Math.sqrt(mu * a));
    const E0 = Math.atan2(sinE0, cosE0);
    const Ec = Math.acos(Math.min(1, Math.max(-1, (1 - radius_m / a) / e)));
    // Inside the sphere for E ∈ [−Ec, Ec] (mod 2π); E0 is outside. Next entry at −Ec (mod 2π).
    const Et = E0 < 0 ? -Ec : 2 * Math.PI - Ec;
    const M0 = E0 - e * Math.sin(E0);
    const Mt = Et - e * Math.sin(Et);
    return (Mt - M0) / n;
  }
  if (c.energy_Jpkg > 0) {
    if (c.rDotV_m2ps >= 0) return Infinity; // outbound on a hyperbola: radius only increases
    const aa = -c.semiMajorAxis_m;
    const n = Math.sqrt(mu / (aa * aa * aa));
    const sinhF0 = c.rDotV_m2ps / (e * Math.sqrt(mu * aa));
    const F0 = Math.asinh(sinhF0);
    const Fc = Math.acosh((1 + radius_m / aa) / e);
    const Ft = -Fc;
    const M0 = e * Math.sinh(F0) - F0;
    const Mt = e * Math.sinh(Ft) - Ft;
    return (Mt - M0) / n;
  }
  throw new RangeError('timeToRadius: parabolic case not supported (excluded by case margins)');
}

export interface ExpectedWarnings {
  readonly escape: boolean;
  readonly referenceSphereIntersection: boolean;
}

export interface Vt16Classification extends ExpectedWarnings {
  /** |E⁺|/(v²/2 + μ/r): distance from the energy boundary (record §7 VT-16 requires ≥ 1e-6). */
  readonly energyMargin: number;
  /** |r_p⁺ − R_ref|/R_ref (record requires ≥ 1e-6 when it decides the case). */
  readonly radiusMargin: number;
  /** Time from the maneuver to the first radius ≤ R_ref (s), Infinity if never. */
  readonly timeToSphere_s: number;
  /** |t_c − (D − m)|/(D − m) when the time decides the case; Infinity otherwise. */
  readonly timeMargin: number;
}

/**
 * Expected warning set under the approved semantics (contracts-v1.md §8.3, §11.3 D1–D5, §11.4 P6):
 * ESCAPE_TRAJECTORY iff the post-maneuver specific energy is not negative (cases near zero are
 * built separately: near-parabolic class, D2); REFERENCE_SPHERE_INTERSECTION iff the radius is
 * ≤ R_ref at some time in [m, D] (inclusive), decided analytically from the post-maneuver conic.
 */
export function classifyVt16(
  mu: number,
  referenceRadius_m: number,
  post: ConicSummary,
  span_s: number,
): Vt16Classification {
  const tc = timeToRadius(mu, post, referenceRadius_m);
  const intersects = tc <= span_s;
  return {
    escape: post.energy_Jpkg >= 0,
    referenceSphereIntersection: intersects,
    energyMargin: Math.abs(post.energy_Jpkg) / post.energyScale_Jpkg,
    radiusMargin: Math.abs(post.periapsisRadius_m - referenceRadius_m) / referenceRadius_m,
    timeToSphere_s: tc,
    timeMargin: Number.isFinite(tc) ? Math.abs(tc - span_s) / span_s : Infinity,
  };
}
