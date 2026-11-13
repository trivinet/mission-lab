/**
 * Unit tests for elements.ts: own self-consistency checks only (L1-style invariants and round
 * trips). They are NOT VT-02/VT-03/VT-04: independent references (L2/L3) and the approved
 * tolerances belong to the Verification Engineer (ADR-003, ML-TASK-010).
 *
 * The element values below are test inputs chosen to span the verification-plan §5 grid shapes;
 * they are not reference data.
 *
 * BOUND POLICY (PROVISIONAL; replaced by the approved tolerance record).
 * Standard model of binary64 with round-to-nearest: each +, −, *, /, sqrt has relative error
 * ≤ u = 2^-53 (no underflow/overflow at these magnitudes). ASSUMPTION A: Math.sin, Math.cos and
 * Math.atan2 are within 1 ulp, i.e. relative error ≤ 2u (ECMAScript does not specify their
 * accuracy; not verified here). Bounds below are first-order operation counts × u × scale, then
 * multiplied by a stated margin ≥ 2 that also covers second-order terms.
 *
 * E1 (elementsToState, position). P_k, Q_k: one 2-factor and one 3-factor product of trig values
 *    (≤ 8u relative each) and one addition; |t1| + |t2| ≤ 1 (Cauchy–Schwarz), so abs error ≤ 9u.
 *    r = p/(1 + e cos ν): p 4u; 1 + e cos ν abs error ≤ 3ue + u(1 + e cos ν), relative ≤
 *    u + 3ue/(1 − e); so r ≤ (6 + 3e/(1 − e))u relative; r cos ν, r sin ν add 3u. Component
 *    rc P_k + rs Q_k with |cν P_k| + |sν Q_k| ≤ 1: abs error ≤ |r| (9 + 3e/(1 − e) + 18 + 1)u
 *    = (28 + 3e/(1 − e)) u |r| ≤ 32 (1 + 1/(1 − e)) u |r|.
 *    Bound used: POS(e) = 64 (1 + 1/(1 − e)) u per component, relative to |r|  (margin 2).
 * E2 (elementsToState, velocity). s = sqrt(μ/p): 4.5u; s(−sin ν): 7.5u; e + cos ν: 3u(1 + e) abs;
 *    component abs error ≤ s(1 + e) · 35u ≤ 72 u s. With |v| ≥ s(1 − e) (apoapsis speed):
 *    relative to |v| ≤ 72u/(1 − e). Bound used: VEL(e) = 128 (1 + 1/(1 − e)) u per component,
 *    relative to |v|  (margin ≥ 1.7 on the 1/(1 − e) term, 128/72 elsewhere).
 * E3 (stateToElements). a = −μ/(2ξ), ξ = v²/2 − μ/r: the cancellation amplifies the relative
 *    error of the terms by (v²/2 + μ/r)/|ξ| ≤ 4/(1 − e) (both terms ≤ μ/r_p = μ/(a(1 − e)) and
 *    |ξ| = μ/(2a)); with ≤ 12 operations: ≤ 48u/(1 − e). e⃗ = ((v² − μ/r) r − (r·v) v)/μ: terms of
 *    size ≤ (1 + e) + 1 (v² r/μ = 2 − r/a ≤ 1 + e; |r·v| |v|/μ ≤ the same); ≤ 12 operations:
 *    e abs error ≤ 36u. The direction of e⃗ is then known to 36u/e, that of N = ẑ × h to ~8u/sin i,
 *    that of r to ~6u.
 * E4 (round trip state → elements → state). Re-mapping with the extracted elements: ∂r/∂a = r/a,
 *    |∂r/∂e| ≤ 2a/(1 − e)², the ω/ν direction errors of e⃗ cancel in ω + ν (both use the same
 *    computed e⃗) and enter |r| only via e sin ν δν (bounded by 36u). Input state error (E1/E2) is
 *    not involved: the round trip starts from the computed state. Total first order
 *    ≲ [48/(1 − e) + 72/(1 − e)² + 36 + 64 (1 + 1/(1 − e))] u r_max ≤ 220 u r_max / (1 − e)².
 *    Bound used: RT(e) = 512 u / (1 − e)², relative to r_a = a(1 + e) for position and to
 *    v_p = s(1 + e) for velocity  (margin ≥ 2.3).
 * E5 (element round trip elements → state → elements; only for convention 'NONE'). Combining E1–E3
 *    for the input state: a, e, i to EL(e) = 1024 u / (1 − e)² (relative for a, absolute for e
 *    and i); Ω to EL/sin i; ω to EL (1/e + 1/sin i); ν to EL (1/e + 1); ω + ν to EL (1 + 1/sin i).
 *    Angle differences are taken modulo 2π, which adds ≤ 2 · 2π u < 16u (included in EL).
 */
import { describe, expect, it } from 'vitest';
import { normalizeAngle_rad, TWO_PI_rad } from './angles';
import { EARTH_GM_m3ps2 } from './constants';
import { elementsToState, stateToElements } from './elements';
import type {
  CartesianState,
  DegeneracyThresholds,
  DegenerateConvention,
  KeplerianElements,
  StateToElementsSuccess,
} from './elements';
import { crossVec3, dotVec3, normVec3, subVec3 } from './vector3';
import type { Vec3 } from './vector3';

const U = 2 ** -53;
const MU = EARTH_GM_m3ps2;

/**
 * PROVISIONAL thresholds for these tests only: the value proposed in the (not yet approved)
 * tolerance record, ML-TASK-010 §10 (ε_e = ε_i = 1e-5). Not an approved value; not exported.
 */
const PROVISIONAL_THRESHOLDS: DegeneracyThresholds = {
  circularEccentricity: 1e-5,
  equatorialInclination_rad: 1e-5,
};

const POS = (e: number): number => 64 * (1 + 1 / (1 - e)) * U;
const VEL = (e: number): number => 128 * (1 + 1 / (1 - e)) * U;
const RT = (e: number): number => (512 * U) / (1 - e) ** 2;
const EL = (e: number): number => (1024 * U) / (1 - e) ** 2;

function el(
  a: number,
  e: number,
  i: number,
  raan: number,
  argp: number,
  nu: number,
): KeplerianElements {
  return {
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: i,
    raan_rad: raan,
    argPeriapsis_rad: argp,
    trueAnomaly_rad: nu,
  };
}

function toState(x: KeplerianElements): CartesianState {
  const res = elementsToState(x, MU);
  if (!res.ok) {
    throw new Error(`elementsToState failed: ${res.reason}`);
  }
  return res.state;
}

function toElements(s: CartesianState): StateToElementsSuccess {
  const res = stateToElements(s, MU, PROVISIONAL_THRESHOLDS);
  if (!res.ok) {
    throw new Error(`stateToElements failed: ${res.reason}`);
  }
  return res;
}

/** Signed difference x − y reduced to (−π, π]. */
function angleDiff(x: number, y: number): number {
  const res = normalizeAngle_rad(x - y);
  if (!res.ok) {
    throw new Error('non-finite angle difference');
  }
  return res.angle_rad > Math.PI ? res.angle_rad - TWO_PI_rad : res.angle_rad;
}

function allFinite(s: CartesianState): boolean {
  return [...s.position_m, ...s.velocity_mps].every((x) => Number.isFinite(x));
}

// Grid (verification-plan §5 shapes). a in m; e; i, angles in rad.
const A_VALUES = [7.0e6, 2.6e7, 4.2e7];
const E_VALUES = [0, 1e-3, 0.3, 0.74, 0.95];
const I_VALUES = [0, 0.1, Math.PI / 2, 2.0, Math.PI];
const ANGLES = [0, 1, Math.PI, 4, TWO_PI_rad - 1e-9];

interface GridCase {
  readonly x: KeplerianElements;
}

function grid(): GridCase[] {
  const out: GridCase[] = [];
  for (const a of A_VALUES) {
    for (const e of E_VALUES) {
      for (const i of I_VALUES) {
        for (const raan of [0, 4]) {
          for (const argp of [0, 1, TWO_PI_rad - 1e-9]) {
            for (const nu of ANGLES) {
              out.push({ x: el(a, e, i, raan, argp, nu) });
            }
          }
        }
      }
    }
  }
  return out;
}
const GRID = grid();

describe('elementsToState: exact structural cases', () => {
  it('circular equatorial at ν = 0 gives r = (a, 0, 0) and v = (0, sqrt(μ/a), 0)', () => {
    const a = 7.0e6;
    const s = toState(el(a, 0, 0, 0, 0, 0));
    // p = a·1·1 = a and r = a/1 exactly; P = (1, 0, 0), Q = (−0, 1, 0) exactly (cos 0 = 1, sin 0 = 0).
    expect(s.position_m[0]).toBe(a);
    expect(s.position_m[1]).toBe(0);
    expect(s.position_m[2]).toBe(0);
    expect(Math.abs(s.velocity_mps[0])).toBe(0);
    expect(s.velocity_mps[1]).toBe(Math.sqrt(MU / a));
    expect(s.velocity_mps[2]).toBe(0);
  });

  it('periapsis of an equatorial ellipse is at r_p = a(1 − e) along +x', () => {
    // a = 8e6, e = 0.5: 1 − e and 1 + e exact, p = 8e6·0.5·1.5 = 6e6, r = 6e6/1.5 = 4e6 exact.
    const s = toState(el(8e6, 0.5, 0, 0, 0, 0));
    expect(s.position_m[0]).toBe(4e6);
    expect(s.position_m[1]).toBe(0);
    expect(s.velocity_mps[1]).toBe(Math.sqrt(MU / 6e6) * 1.5);
  });

  it('i = Math.PI keeps the regular map: z component of order sin(Math.PI)·r, no special case', () => {
    const s = toState(el(7e6, 0.1, Math.PI, 0, Math.PI / 2, 0));
    // P_z = sin i sin ω; with sin(Math.PI) ≈ 1.22e-16 the z component is tiny but generally non-zero.
    expect(Math.abs(s.position_m[2])).toBeLessThanOrEqual(2 * Math.sin(Math.PI) * 7e6 * 1.1);
  });

  it('does not re-normalise angles: ν and ν + 2·TWO_PI_rad give states equal within POS/VEL', () => {
    const base = el(7e6, 0.1, 1, 2, 3, 0.5);
    const s1 = toState(base);
    const s2 = toState({ ...base, trueAnomaly_rad: 0.5 + 2 * TWO_PI_rad });
    // The two ν values differ by 4π − 2·TWO_PI_rad ≈ 1e-15 rad (TWO_PI_rad ≠ 2π) plus the
    // rounding of the sum (≤ 13u·... < 2e-15), i.e. far below POS(0.1).
    const r = normVec3(s1.position_m);
    expect(normVec3(subVec3(s1.position_m, s2.position_m))).toBeLessThanOrEqual(
      Math.sqrt(3) * 2 * POS(0.1) * r,
    );
  });
});

describe('elementsToState: preconditions return a result object, never NaN', () => {
  const ok = el(7e6, 0.1, 1, 1, 1, 1);
  const cases: [KeplerianElements, number, string][] = [
    [{ ...ok, semiMajorAxis_m: Number.NaN }, MU, 'NON_FINITE_INPUT'],
    [{ ...ok, trueAnomaly_rad: Number.POSITIVE_INFINITY }, MU, 'NON_FINITE_INPUT'],
    [ok, Number.NaN, 'NON_FINITE_INPUT'],
    [ok, 0, 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'],
    [ok, -1, 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'],
    [{ ...ok, semiMajorAxis_m: 0 }, MU, 'SEMI_MAJOR_AXIS_NOT_POSITIVE'],
    [{ ...ok, semiMajorAxis_m: -7e6 }, MU, 'SEMI_MAJOR_AXIS_NOT_POSITIVE'],
    [{ ...ok, eccentricity: 1 }, MU, 'ECCENTRICITY_OUT_OF_RANGE'],
    [{ ...ok, eccentricity: -1e-12 }, MU, 'ECCENTRICITY_OUT_OF_RANGE'],
    [{ ...ok, inclination_rad: -1e-12 }, MU, 'INCLINATION_OUT_OF_RANGE'],
    [{ ...ok, inclination_rad: Math.PI + 1e-12 }, MU, 'INCLINATION_OUT_OF_RANGE'],
    // Apoapsis of a = 1.7e308, e = 0.9: r = a(1 + e) ≈ 3.2e308 > Number.MAX_VALUE.
    [
      { ...ok, semiMajorAxis_m: 1.7e308, eccentricity: 0.9, trueAnomaly_rad: Math.PI },
      MU,
      'NON_FINITE_RESULT',
    ],
  ];
  it.each(cases)('case %#', (x, mu, reason) => {
    expect(elementsToState(x, mu)).toEqual({ ok: false, reason });
  });

  it('accepts angles outside [0, 2π) (no re-normalisation, validators run upstream)', () => {
    expect(elementsToState(el(7e6, 0.1, 1, -1, 10, -20), MU).ok).toBe(true);
  });
});

describe('elementsToState: invariants over the grid (bounds E1, E2)', () => {
  it('|r| = p/(1 + e cos ν), r and v lie in the plane ⟂ ĥ(Ω, i), vis-viva and |h|² = μp', () => {
    for (const { x } of GRID) {
      const e = x.eccentricity;
      const s = toState(x);
      expect(allFinite(s)).toBe(true);
      const r = s.position_m;
      const v = s.velocity_mps;
      const rn = normVec3(r);
      const vn = normVec3(v);
      const p = x.semiMajorAxis_m * (1 - e) * (1 + e);
      const rExpected = p / (1 + e * Math.cos(x.trueAnomaly_rad));
      // |r|: √3·POS from the components + 6u norm + (6 + 3e/(1−e))u for rExpected ≤ 2·POS.
      expect(Math.abs(rn - rExpected)).toBeLessThanOrEqual(2 * POS(e) * rExpected);

      // Plane normal from the elements (D5): (sin Ω sin i, −cos Ω sin i, cos i), entries ≤ 5u abs.
      const si = Math.sin(x.inclination_rad);
      const hHat: Vec3 = [
        Math.sin(x.raan_rad) * si,
        -Math.cos(x.raan_rad) * si,
        Math.cos(x.inclination_rad),
      ];
      // r·ĥ: √3·POS·|r| (components) + 3·5u|r| (ĥ) + 3u|r| (dot) ≤ 2·POS·|r|.
      expect(Math.abs(dotVec3(r, hHat))).toBeLessThanOrEqual(2 * POS(e) * rn);
      expect(Math.abs(dotVec3(v, hHat))).toBeLessThanOrEqual(2 * VEL(e) * vn);

      // r·h = 0 and v·h = 0 for h = r × v (structural): each cross component has 2 roundings
      // relative to its two products, the dot 3 more: ≤ γ(5)·Σ|r_i|(|r_j v_k| + |r_k v_j|)
      // ≤ 6u · 2|r|²|v| (Σ_i |r_i| t_i ≤ 2|r|²|v| by Cauchy–Schwarz on each pair); margin 2.
      const h = crossVec3(r, v);
      expect(Math.abs(dotVec3(r, h))).toBeLessThanOrEqual(24 * U * rn * rn * vn);
      expect(Math.abs(dotVec3(v, h))).toBeLessThanOrEqual(24 * U * rn * vn * vn);

      // Vis-viva v² = μ(2/r − 1/a): v² relative ≤ 2√3·VEL; right side: 2/r − 1/a cancels by at
      // most 2/(1 − e) (at apoapsis 2/r_a − 1/a = (1 − e)/(a(1 + e))), times |r| error √3·POS + 4u.
      const vv = dotVec3(v, v);
      const visViva = MU * (2 / rn - 1 / x.semiMajorAxis_m);
      const visBound = 2 * Math.sqrt(3) * VEL(e) + (2 / (1 - e)) * (Math.sqrt(3) * POS(e) + 4 * U);
      expect(Math.abs(vv - visViva)).toBeLessThanOrEqual(visBound * visViva);

      // |h|² = μ p: |h| = |r| |v_t| relative error ≤ √3(POS + VEL) + 8u; squared: × 2.
      const hh = dotVec3(h, h);
      const hBound = 2 * (Math.sqrt(3) * (POS(e) + VEL(e)) + 8 * U) + 6 * U;
      expect(Math.abs(hh - MU * p)).toBeLessThanOrEqual(hBound * MU * p);
    }
  });
});

describe('stateToElements: exact structural cases', () => {
  const a = 7.0e6;
  const s = Math.sqrt(MU / a);

  it('prograde circular equatorial state: i = 0, Ω = ω = ν = 0, both conventions applied', () => {
    const res = toElements({ position_m: [a, 0, 0], velocity_mps: [0, s, 0] });
    expect(res.convention).toBe('CIRCULAR_EQUATORIAL');
    expect(res.conic).toBe('ELLIPTIC');
    expect(res.elements.inclination_rad).toBe(0);
    expect(res.elements.raan_rad).toBe(0);
    expect(res.elements.argPeriapsis_rad).toBe(0);
    expect(res.elements.trueAnomaly_rad).toBe(0);
    // e is reported as computed (ADR-008), not forced to 0: here only rounding of s² vs μ/a
    // (≤ 3u relative on each of the two terms of c = v² − μ/r, so e ≤ 6u + 2u).
    expect(res.elements.eccentricity).toBeLessThanOrEqual(8 * U);
    // a: ξ = s²/2 − μ/a ≈ −μ/(2a), cancellation factor ≤ 3, ≤ 4 ops: relative ≤ 16u.
    expect(Math.abs(res.elements.semiMajorAxis_m - a)).toBeLessThanOrEqual(16 * U * a);
  });

  it('retrograde circular equatorial state: i = Math.PI exactly; true longitude in the sense of motion', () => {
    // r along +y, v along +x: h = (0, 0, −a s). Moving clockwise seen from +z, the angle from +x
    // to r in the sense of motion is 3π/2 (convention documented in stateToElements).
    const res = toElements({ position_m: [0, a, 0], velocity_mps: [s, 0, 0] });
    expect(res.convention).toBe('CIRCULAR_EQUATORIAL');
    expect(res.elements.inclination_rad).toBe(Math.PI);
    expect(res.elements.raan_rad).toBe(0);
    expect(res.elements.argPeriapsis_rad).toBe(0);
    // atan2(−a, 0) = −π/2 (≤ 1 ulp, assumption A), + 2π: ≤ 2 roundings of size ≤ 2π u.
    expect(Math.abs(res.elements.trueAnomaly_rad - 1.5 * Math.PI)).toBeLessThanOrEqual(
      8 * Math.PI * U,
    );
  });

  it('all outputs are finite, angles in [0, 2π), i in [0, π] (sample)', () => {
    const res = toElements({ position_m: [-4e6, 5e6, 2e6], velocity_mps: [-5e3, -3e3, 2e3] });
    const x = res.elements;
    for (const ang of [x.raan_rad, x.argPeriapsis_rad, x.trueAnomaly_rad]) {
      expect(ang >= 0 && ang < TWO_PI_rad).toBe(true);
    }
    expect(x.inclination_rad >= 0 && x.inclination_rad <= Math.PI).toBe(true);
  });
});

describe('stateToElements: failures are result objects', () => {
  const r: Vec3 = [7e6, 0, 0];
  const v: Vec3 = [0, 7.5e3, 0];
  const cases: [CartesianState, number, DegeneracyThresholds, string][] = [
    [
      { position_m: [Number.NaN, 0, 0], velocity_mps: v },
      MU,
      PROVISIONAL_THRESHOLDS,
      'NON_FINITE_INPUT',
    ],
    [
      { position_m: r, velocity_mps: [0, Infinity, 0] },
      MU,
      PROVISIONAL_THRESHOLDS,
      'NON_FINITE_INPUT',
    ],
    [
      { position_m: r, velocity_mps: v },
      0,
      PROVISIONAL_THRESHOLDS,
      'GRAVITATIONAL_PARAMETER_NOT_POSITIVE',
    ],
    [
      { position_m: r, velocity_mps: v },
      MU,
      { circularEccentricity: -1, equatorialInclination_rad: 0 },
      'INVALID_THRESHOLD',
    ],
    [
      { position_m: r, velocity_mps: v },
      MU,
      { circularEccentricity: 0, equatorialInclination_rad: Number.NaN },
      'INVALID_THRESHOLD',
    ],
    [{ position_m: [0, 0, 0], velocity_mps: v }, MU, PROVISIONAL_THRESHOLDS, 'ZERO_POSITION'],
    [
      { position_m: r, velocity_mps: [3e3, 0, 0] },
      MU,
      PROVISIONAL_THRESHOLDS,
      'ZERO_ANGULAR_MOMENTUM',
    ],
    [
      { position_m: r, velocity_mps: [0, 0, 0] },
      MU,
      PROVISIONAL_THRESHOLDS,
      'ZERO_ANGULAR_MOMENTUM',
    ],
    // Exact parabola: μ = 2, |r| = 1, |v| = 2: ξ = 4/2 − 2/1 = 0 exactly.
    [
      { position_m: [1, 0, 0], velocity_mps: [0, 2, 0] },
      2,
      PROVISIONAL_THRESHOLDS,
      'SEMI_MAJOR_AXIS_UNDEFINED',
    ],
    // Overflow of h = r × v.
    [
      { position_m: [1e300, 0, 0], velocity_mps: [0, 1e300, 0] },
      MU,
      PROVISIONAL_THRESHOLDS,
      'NON_FINITE_RESULT',
    ],
  ];
  it.each(cases)('case %#', (state, mu, th, reason) => {
    expect(stateToElements(state, mu, th)).toEqual({ ok: false, reason });
  });
});

describe('stateToElements: convention selection (provisional thresholds 1e-5)', () => {
  const a = 7.0e6;
  const cases: [string, KeplerianElements, DegenerateConvention][] = [
    ['general', el(a, 0.1, 1, 1, 1, 1), 'NONE'],
    ['circular inclined (e = 0)', el(a, 0, 1, 1, 1, 1), 'CIRCULAR'],
    ['e just below threshold', el(a, 5e-6, 1, 1, 1, 1), 'CIRCULAR'],
    ['e above threshold (×2)', el(a, 2e-5, 1, 1, 1, 1), 'NONE'],
    ['equatorial prograde (i = 0)', el(a, 0.1, 0, 1, 1, 1), 'EQUATORIAL'],
    ['equatorial retrograde (i = π)', el(a, 0.1, Math.PI, 1, 1, 1), 'EQUATORIAL'],
    ['i just below threshold', el(a, 0.1, 5e-6, 1, 1, 1), 'EQUATORIAL'],
    ['π − i just below threshold', el(a, 0.1, Math.PI - 5e-6, 1, 1, 1), 'EQUATORIAL'],
    ['i above threshold (×2)', el(a, 0.1, 2e-5, 1, 1, 1), 'NONE'],
    ['π − i above threshold (×2)', el(a, 0.1, Math.PI - 2e-5, 1, 1, 1), 'NONE'],
    ['circular equatorial', el(a, 0, 0, 1, 1, 1), 'CIRCULAR_EQUATORIAL'],
    ['circular retrograde equatorial', el(a, 0, Math.PI, 1, 1, 1), 'CIRCULAR_EQUATORIAL'],
  ];
  it.each(cases)('%s', (_name, x, convention) => {
    const res = toElements(toState(x));
    expect(res.convention).toBe(convention);
    // e and i are reported as computed, never zeroed (ADR-008): compare with the input within E5.
    expect(Math.abs(res.elements.eccentricity - x.eccentricity)).toBeLessThanOrEqual(
      EL(x.eccentricity),
    );
    expect(Math.abs(res.elements.inclination_rad - x.inclination_rad)).toBeLessThanOrEqual(
      EL(x.eccentricity),
    );
    if (x.eccentricity > 0) {
      expect(res.elements.eccentricity).toBeGreaterThan(0);
    }
  });

  it('exact zero thresholds still apply the convention to exactly degenerate states', () => {
    const zero = { circularEccentricity: 0, equatorialInclination_rad: 0 };
    const res = stateToElements({ position_m: [7e6, 0, 0], velocity_mps: [0, 7.5e3, 0] }, MU, zero);
    expect(res.ok && res.convention).toBe('EQUATORIAL');
  });
});

describe('round trip elements → state → elements (convention NONE, bound E5)', () => {
  it('recovers all six elements over the non-degenerate grid', () => {
    let checked = 0;
    for (const { x } of GRID) {
      const res = toElements(toState(x));
      if (res.convention !== 'NONE') {
        continue;
      }
      checked += 1;
      const e = x.eccentricity;
      const b = EL(e);
      const si = Math.sin(x.inclination_rad);
      const y = res.elements;
      expect(Math.abs(y.semiMajorAxis_m - x.semiMajorAxis_m)).toBeLessThanOrEqual(
        b * x.semiMajorAxis_m,
      );
      expect(Math.abs(y.eccentricity - e)).toBeLessThanOrEqual(b);
      expect(Math.abs(y.inclination_rad - x.inclination_rad)).toBeLessThanOrEqual(b);
      expect(Math.abs(angleDiff(y.raan_rad, x.raan_rad))).toBeLessThanOrEqual(b / si);
      expect(Math.abs(angleDiff(y.argPeriapsis_rad, x.argPeriapsis_rad))).toBeLessThanOrEqual(
        b * (1 / e + 1 / si),
      );
      expect(Math.abs(angleDiff(y.trueAnomaly_rad, x.trueAnomaly_rad))).toBeLessThanOrEqual(
        b * (1 / e + 1),
      );
      expect(
        Math.abs(
          angleDiff(y.argPeriapsis_rad + y.trueAnomaly_rad, x.argPeriapsis_rad + x.trueAnomaly_rad),
        ),
      ).toBeLessThanOrEqual(b * (1 + 1 / si));
    }
    expect(checked).toBeGreaterThan(500);
  });
});

/** ‖Δr‖ and ‖Δv‖ of a state → elements → state round trip. */
function stateRoundTrip(s0: CartesianState): { dr: number; dv: number; e1: number } {
  const res = toElements(s0);
  const s1 = toState(res.elements);
  return {
    dr: normVec3(subVec3(s1.position_m, s0.position_m)),
    dv: normVec3(subVec3(s1.velocity_mps, s0.velocity_mps)),
    e1: res.elements.eccentricity,
  };
}

describe('round trip state → elements → state (bound E4)', () => {
  it('holds over the whole grid, degenerate cases included', () => {
    for (const { x } of GRID) {
      const e = x.eccentricity;
      const s0 = toState(x);
      const { dr, dv, e1 } = stateRoundTrip(s0);
      const ra = x.semiMajorAxis_m * (1 + e);
      const vp = Math.sqrt(MU / (x.semiMajorAxis_m * (1 - e) * (1 + e))) * (1 + e);
      // For exactly circular inputs the convention reassigns ω while the computed e1 is a
      // rounding-level non-zero value: convention term ≤ 2 e1 r and ≤ 3 e1 v (derived in the
      // near-degenerate test below). e1 ≤ EL(0) here, so the term is at rounding level.
      const conventionTerm = e < PROVISIONAL_THRESHOLDS.circularEccentricity ? 3 * e1 : 0;
      expect(dr).toBeLessThanOrEqual((RT(e) + conventionTerm) * ra);
      expect(dv).toBeLessThanOrEqual((RT(e) + conventionTerm) * vp);
    }
  });

  it('near-degenerate below the threshold: displacement bounded by the convention term (ADR-008)', () => {
    // Circular convention with 0 < e < ε_e: the reconstructed r has the same direction (it depends
    // on ω + ν = u) and |r| changes from p/(1 + e cos(u − ω0)) to p/(1 + e cos u): ≤ 2e p/(1 − e)²
    // ≤ 2e r (1 + 3e). Velocity: radial (μ/h) e sin ν and transverse (μ/h)(1 + e cos ν) components
    // each change by ≤ 2e μ/h, so ‖Δv‖ ≤ 2√2 e μ/h ≤ 3 e v_p.
    // Equatorial convention with 0 < i' < ε_i: R3(Ω)R1(i)R3(ω) is replaced by R1(i)R3(ω'); the
    // commutator [R3(Ω), R1(i)] has 2-norm ≤ 2‖R1(i') − I‖ = 4 sin(i'/2) (tolerance-record
    // proposal ML-TASK-010, VT-04(b)); ω' measured from the projection of +x differs from Ω + ω
    // (prograde) or ω − Ω (retrograde) by ≤ (1 − cos i')/(2 cos i') ≤ i'² (derived: d/dc atan(c t)
    // ≤ 1/(2c)). Bound: (4 sin(i'/2) + i'²) × scale.
    const a = 7.0e6;
    const cases: [KeplerianElements, number, number][] = [
      [el(a, 5e-6, 1, 1, 2, 3), 5e-6, 0],
      [el(a, 9e-6, 0.5, 4, 1, 0.3), 9e-6, 0],
      [el(a, 0.1, 5e-6, 1, 2, 3), 0, 5e-6],
      [el(a, 0.1, Math.PI - 5e-6, 1, 2, 3), 0, 5e-6],
      [el(a, 5e-6, 5e-6, 1, 2, 3), 5e-6, 5e-6],
    ];
    for (const [x, e, ip] of cases) {
      const s0 = toState(x);
      const { dr, dv } = stateRoundTrip(s0);
      const ra = a * (1 + x.eccentricity);
      const vp =
        Math.sqrt(MU / (a * (1 - x.eccentricity) * (1 + x.eccentricity))) * (1 + x.eccentricity);
      const eqTerm = 4 * Math.sin(ip / 2) + ip * ip;
      const rBound = RT(x.eccentricity) + 2 * e * (1 + 3 * e) + eqTerm;
      const vBound = RT(x.eccentricity) + 3 * e + eqTerm;
      expect(dr).toBeLessThanOrEqual(rBound * ra);
      expect(dv).toBeLessThanOrEqual(vBound * vp);
    }
  });

  it('exactly retrograde equatorial: substitute angles reproduce the state without reflection', () => {
    for (const e of [0, 0.3]) {
      for (const argp of [0, 1, 4]) {
        for (const nu of [0, 2, 5]) {
          const s0 = toState(el(7e6, e, Math.PI, 2, argp, nu));
          const res = toElements(s0);
          expect(res.elements.inclination_rad).toBeGreaterThan(Math.PI - 1e-12);
          const { dr } = stateRoundTrip(s0);
          expect(dr).toBeLessThanOrEqual((RT(e) + 3 * res.elements.eccentricity) * 7e6 * (1 + e));
        }
      }
    }
  });
});

describe('stateToElements: open orbits (e ≥ 1) are returned, not NaN', () => {
  it('hyperbolic periapsis state: a < 0, e > 1, ν = 0, p = a(1 − e²) = |h|²/μ', () => {
    const r0 = 7.0e6;
    const vEsc = Math.sqrt((2 * MU) / r0);
    const s0: CartesianState = { position_m: [r0, 0, 0], velocity_mps: [0, 1.2 * vEsc, 0] };
    const res = toElements(s0);
    expect(res.conic).toBe('HYPERBOLIC');
    const x = res.elements;
    expect(x.semiMajorAxis_m).toBeLessThan(0);
    expect(x.eccentricity).toBeGreaterThan(1);
    // At periapsis e⃗ ∥ r, so ν = atan2(±tiny, positive): ≤ rounding-level angle, reduced to [0, 2π).
    expect(Math.min(x.trueAnomaly_rad, TWO_PI_rad - x.trueAnomaly_rad)).toBeLessThanOrEqual(64 * U);
    // e at periapsis: e = v² r/μ − 1 = 1.44·2 − 1 = 1.88 (algebra); computed with ≤ 12 ops on terms
    // ≤ 2.9: ≤ 64u abs (margin > 2).
    expect(Math.abs(x.eccentricity - (1.2 * 1.2 * 2 - 1))).toBeLessThanOrEqual(64 * U);
    // p: |h|²/μ vs a(1 − e)(1 + e): a relative ≤ 48u·(v²/2 + μ/r)/ξ ≈ 48u·4.3, 1 − e ≤ 64u/0.88.
    const h = normVec3(crossVec3(s0.position_m, s0.velocity_mps));
    const p1 = (h * h) / MU;
    const p2 = x.semiMajorAxis_m * (1 - x.eccentricity) * (1 + x.eccentricity);
    expect(Math.abs(p1 - p2)).toBeLessThanOrEqual(512 * U * p1);
  });

  it('inclined retrograde hyperbola: every element finite and angles in range', () => {
    const res = toElements({ position_m: [5e6, -4e6, 3e6], velocity_mps: [2e3, 1.1e4, -6e3] });
    expect(res.conic).toBe('HYPERBOLIC');
    const x = res.elements;
    expect(Object.values(x).every((n: number) => Number.isFinite(n))).toBe(true);
    for (const ang of [x.raan_rad, x.argPeriapsis_rad, x.trueAnomaly_rad]) {
      expect(ang >= 0 && ang < TWO_PI_rad).toBe(true);
    }
  });

  it('is deterministic (bit-identical on repeat)', () => {
    const s: CartesianState = { position_m: [5e6, -4e6, 3e6], velocity_mps: [2e3, 7e3, -1e3] };
    expect(stateToElements(s, MU, PROVISIONAL_THRESHOLDS)).toEqual(
      stateToElements(s, MU, PROVISIONAL_THRESHOLDS),
    );
  });
});
