/**
 * L2c reference: classical elements ↔ Cartesian state (verification plan §2, method (c)).
 *
 * Independent of the engine (ADR-003): written from the plan, contracts-v1.md §3, ADR-008 and the
 * standard two-body relations below; `packages/astrodynamics` was not read.
 *
 * Units: metres, metres per second, radians, m³/s². Frame: the inertial frame of the request
 * (GCRF); angles are referred to its axes.
 *
 * Element → state (regular map, no special cases, contracts-v1.md §3):
 *   p = a(1 − e²), r = p/(1 + e cos ν)
 *   perifocal r_pf = r (cos ν, sin ν, 0), v_pf = √(μ/p) (−sin ν, e + cos ν, 0)
 *   inertial = Q r_pf with Q = Rz(Ω) · Rx(i) · Rz(ω), the three ACTIVE elementary rotations
 *   multiplied out numerically as explicit 3×3 matrices (no closed-form entries).
 *
 * State → elements (an in-plane polar formulation, deliberately not the e-vector / acos form):
 *   h = r × v, i = atan2(√(h_x² + h_y²), h_z), Ω = atan2(h_x, −h_y) (node n = ẑ × h);
 *   in-plane axes n̂ and m̂ = ĥ × n̂; argument of latitude u = atan2(r·m̂, r·n̂);
 *   e cos ν = h²/(μ r) − 1, e sin ν = h (r·v)/(μ r)  (from r = p/(1 + e cos ν), p = h²/μ, and
 *   ṙ = (μ/h) e sin ν), e = √((e cos ν)² + (e sin ν)²), ν = atan2(e sin ν, e cos ν),
 *   ω = u − ν, a = 1/(2/r − v²/μ) (vis-viva).
 *   Every angle comes from atan2 (no acos/asin near ±1; tolerance record O-2).
 */
import { cross, dot, matMul, matVec, norm, rotX, rotZ, wrapTwoPi, type M3, type V3 } from './vec';

export interface Elements {
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
}

export interface State {
  readonly position_m: V3;
  readonly velocity_mps: V3;
}

/** Perifocal → inertial rotation Q = Rz(Ω) Rx(i) Rz(ω) by explicit matrix products. */
export function perifocalToInertial(raan: number, inc: number, argp: number): M3 {
  return matMul(matMul(rotZ(raan), rotX(inc)), rotZ(argp));
}

/** L2c element → state. Regular map; valid for 0 ≤ e < 1, a > 0. */
export function elementsToState(el: Elements, mu_m3ps2: number): State {
  const a = el.semiMajorAxis_m;
  const e = el.eccentricity;
  const nu = el.trueAnomaly_rad;
  const p = a * (1 - e * e);
  const cn = Math.cos(nu);
  const sn = Math.sin(nu);
  const r = p / (1 + e * cn);
  const k = Math.sqrt(mu_m3ps2 / p);
  const rPf: V3 = [r * cn, r * sn, 0];
  const vPf: V3 = [-k * sn, k * (e + cn), 0];
  const q = perifocalToInertial(el.raan_rad, el.inclination_rad, el.argPeriapsis_rad);
  return { position_m: matVec(q, rPf), velocity_mps: matVec(q, vPf) };
}

/** Raw (regular) elements plus the intermediate angles used by the convention. */
export interface RawElements extends Elements {
  /** Argument of latitude u = ω + ν, measured in the orbit plane from the node axis n̂. */
  readonly argLatitude_rad: number;
  /** True when h_x = h_y = 0 exactly: the node is undefined and n̂ := +x̂, Ω := 0 was used. */
  readonly nodeUndefined: boolean;
}

/**
 * L2c state → elements without any degenerate-case convention. When h_x = h_y = 0 exactly the
 * node axis is taken as +x̂ (Ω = 0); when e = 0 exactly ν = 0 and ω = u. Angles in [0, 2π).
 */
export function stateToElementsRaw(s: State, mu_m3ps2: number): RawElements {
  const r = s.position_m;
  const v = s.velocity_mps;
  const h = cross(r, v);
  const hmag = norm(h);
  const hxy = Math.sqrt(h[0] * h[0] + h[1] * h[1]);
  const inc = Math.atan2(hxy, h[2]);
  let raan: number;
  let nHat: V3;
  let mHat: V3;
  const nodeUndefined = hxy === 0;
  if (nodeUndefined) {
    raan = 0;
    nHat = [1, 0, 0];
    const sgn = h[2] < 0 ? -1 : 1;
    mHat = [0, sgn, 0]; // ĥ × x̂ with ĥ = (0, 0, ±1)
  } else {
    raan = wrapTwoPi(Math.atan2(h[0], -h[1]));
    nHat = [-h[1] / hxy, h[0] / hxy, 0];
    // m̂ = ĥ × n̂ = (−h_z h_x, −h_z h_y, h_x² + h_y²)/(|h| √(h_x² + h_y²))
    const d = hmag * hxy;
    mHat = [(-h[2] * h[0]) / d, (-h[2] * h[1]) / d, (hxy * hxy) / d];
  }
  const u = Math.atan2(dot(r, mHat), dot(r, nHat));
  const rmag = norm(r);
  const v2 = dot(v, v);
  const ecos = (hmag * hmag) / (mu_m3ps2 * rmag) - 1;
  const esin = (hmag * dot(r, v)) / (mu_m3ps2 * rmag);
  const e = Math.sqrt(ecos * ecos + esin * esin);
  const nu = e === 0 ? 0 : Math.atan2(esin, ecos);
  const a = 1 / (2 / rmag - v2 / mu_m3ps2);
  return {
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: inc,
    raan_rad: raan,
    argPeriapsis_rad: wrapTwoPi(u - nu),
    trueAnomaly_rad: wrapTwoPi(nu),
    argLatitude_rad: wrapTwoPi(u),
    nodeUndefined,
  };
}

/** Thresholds of tolerances.md §10 / §15 (approved 2026-11-13; ADR-008): ε_e = ε_i = 1e-5. */
export const EPS_E = 1e-5;
export const EPS_I = 1e-5;

export interface ElementView {
  readonly elements: Elements;
  readonly circular: boolean;
  readonly equatorial: boolean;
  readonly retrograde: boolean;
}

/**
 * L2c derived element view with the ADR-008 / architecture §3 convention:
 * circular (e < ε_e): ω := 0, ν := argument of latitude;
 * equatorial (i < ε_i or π − i < ε_i): Ω := 0, ω := longitude of periapsis;
 * both: Ω := 0, ω := 0, ν := true longitude. e and i are always the computed values.
 *
 * Substitute angles (convention choice of this reference, open for the Coordinator): measured
 * from +x̂ positively in the sense of motion, i.e. right-handed about ĥ. For a prograde orbit that
 * is counter-clockwise seen from +z (ϖ = Ω + ω, λ = Ω + u); for a retrograde orbit clockwise
 * (ϖ = ω − Ω, λ = u − Ω). This is the choice for which the regular element→state map with Ω = 0
 * (and ω = 0) reproduces the state of an exactly equatorial orbit, including i = π.
 */
export function stateToElementView(s: State, mu_m3ps2: number): ElementView {
  const raw = stateToElementsRaw(s, mu_m3ps2);
  const inc = raw.inclination_rad;
  const iPrime = Math.min(inc, Math.PI - inc);
  const circular = raw.eccentricity < EPS_E;
  const equatorial = iPrime < EPS_I;
  const retrograde = inc > Math.PI / 2;
  const sgn = retrograde ? -1 : 1;
  let raan = raw.raan_rad;
  let argp = raw.argPeriapsis_rad;
  let nu = raw.trueAnomaly_rad;
  if (equatorial) {
    const lonPeri = wrapTwoPi(raw.argPeriapsis_rad + sgn * raw.raan_rad);
    const trueLon = wrapTwoPi(raw.argLatitude_rad + sgn * raw.raan_rad);
    raan = 0;
    if (circular) {
      argp = 0;
      nu = trueLon;
    } else {
      argp = lonPeri;
    }
  } else if (circular) {
    argp = 0;
    nu = raw.argLatitude_rad;
  }
  return {
    elements: {
      semiMajorAxis_m: raw.semiMajorAxis_m,
      eccentricity: raw.eccentricity,
      inclination_rad: inc,
      raan_rad: raan,
      argPeriapsis_rad: argp,
      trueAnomaly_rad: nu,
    },
    circular,
    equatorial,
    retrograde,
  };
}
