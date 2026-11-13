/**
 * Unit tests for trajectory-flags.ts (implementer self-consistency checks; NOT the VT-16
 * verification). Cases are constructed with margins far above rounding (≥ 1 % in time or
 * radius), so the expected flag does not depend on the evaluation order; the boundary semantics
 * (inclusive comparisons) are tested with values taken from the function's own outputs.
 * The escape rule is checked against the EXACT sign of the energy of the binary64 state,
 * computed with BigInt rational arithmetic (no tolerance).
 */
import { describe, expect, it } from 'vitest';
import { EARTH_GM_m3ps2, EARTH_REFERENCE_RADIUS_m } from './constants';
import { propagateKeplerUniversal } from './kepler-universal';
import { applyImpulsiveManeuver } from './maneuver';
import {
  classifyEscape,
  detectReferenceSphereIntersection,
  ESCAPE_ENERGY_BOUND_FACTOR,
} from './trajectory-flags';
import type { EscapeClassification, ReferenceSphereIntersection } from './trajectory-flags';
import { dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

const U = 2 ** -53;
const MU = EARTH_GM_m3ps2;
const R_REF = EARTH_REFERENCE_RADIUS_m;

function escapeOf(r: Vec3, v: Vec3): EscapeClassification {
  const res = classifyEscape(r, v, MU);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.classification;
}

function intersectionOf(r: Vec3, v: Vec3, R: number, span: number): ReferenceSphereIntersection {
  const res = detectReferenceSphereIntersection(r, v, MU, R, span);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.intersection;
}

/** x · 2^1074 as an exact BigInt (every finite binary64 is an integer multiple of 2^-1074). */
function scaled(x: number): bigint {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const negative = bits >> 63n === 1n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponentBits === 0 ? fraction : fraction | (1n << 52n);
  const shift = exponentBits === 0 ? 0 : exponentBits - 1;
  const value = mantissa << BigInt(shift);
  return negative ? -value : value;
}

/**
 * Exact sign of ξ = v·v/2 − μ/|r| for binary64 r, v, μ: ξ < 0 ⇔ (v·v)²(r·r) < 4μ² (all positive).
 * Scales: v·v and r·r carry 2^2148, μ carries 2^1074; the left side carries 2^6444, the right 2^2148.
 */
function exactEnergySign(r: Vec3, v: Vec3, mu: number): number {
  const sq = (a: Vec3): bigint => a.reduce((acc, x) => acc + scaled(x) * scaled(x), 0n);
  const v2 = sq(v);
  const r2 = sq(r);
  const m = scaled(mu);
  const lhs = v2 * v2 * r2;
  const rhs = 4n * m * m * (1n << 4296n);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

describe('classifyEscape', () => {
  const r: Vec3 = [-5.1e6, 3.3e6, 2.2e6];
  const rn = normVec3(r);
  const vEsc = Math.sqrt((2 * MU) / rn);
  // Unit direction not parallel to r (any direction gives the same energy).
  const dirRaw: Vec3 = [0.3, -0.5, 0.8];
  const dn = normVec3(dirRaw);
  const dir: Vec3 = [dirRaw[0] / dn, dirRaw[1] / dn, dirRaw[2] / dn];
  const vel = (s: number): Vec3 => [dir[0] * s, dir[1] * s, dir[2] * s];

  it('circular orbit: CLOSED, not flagged', () => {
    const c = escapeOf([7e6, 0, 0], [0, Math.sqrt(MU / 7e6), 0]);
    expect(c.regime).toBe('CLOSED');
    expect(c.escape).toBe(false);
    expect(c.specificEnergy_m2ps2).toBeLessThan(0);
  });

  it('1e-6 above / below escape speed: OPEN flagged / CLOSED not flagged', () => {
    const open = escapeOf(r, vel(vEsc * (1 + 1e-6)));
    expect(open.regime).toBe('OPEN');
    expect(open.escape).toBe(true);
    const closed = escapeOf(r, vel(vEsc * (1 - 1e-6)));
    expect(closed.regime).toBe('CLOSED');
    expect(closed.escape).toBe(false);
  });

  it('speed = fl(sqrt(2μ/|r|)): energy within its rounding bound, NEAR_PARABOLIC and flagged', () => {
    const c = escapeOf(r, vel(vEsc));
    expect(Math.abs(c.specificEnergy_m2ps2)).toBeLessThanOrEqual(c.energyRoundingBound_m2ps2);
    expect(c.regime).toBe('NEAR_PARABOLIC');
    expect(c.escape).toBe(true);
  });

  it('bound value is 6u(v²/2 + μ/|r|) as documented', () => {
    const v = vel(1000);
    const c = escapeOf(r, v);
    const expected = ESCAPE_ENERGY_BOUND_FACTOR * U * (dotVec3(v, v) / 2 + MU / rn);
    expect(c.energyRoundingBound_m2ps2).toBe(expected);
  });

  it('CLOSED and OPEN agree with the exact energy sign of the binary64 state (sweep of ±64 ulps-scale steps around v_esc)', () => {
    let near = 0;
    for (let k = -64; k <= 64; k += 1) {
      const v = vel(vEsc * (1 + k * 2 ** -50));
      const c = escapeOf(r, v);
      const sign = exactEnergySign(r, v, MU);
      if (c.regime === 'CLOSED') {
        expect(sign).toBe(-1);
      } else if (c.regime === 'OPEN') {
        expect(sign).toBe(1);
      } else {
        near += 1;
      }
      // Escape flag set whenever the exact energy is ≥ 0 (never a missed escape).
      if (sign >= 0) {
        expect(c.escape).toBe(true);
      }
    }
    // The undecided band is narrow: step k changes ξ by ≈ k·2^-50·v², while |ξ̂| ≤ η needs
    // |ξ| ≤ η + 5u(A + B) = 11u·v² ≈ 1.4·2^-50·v² (A = B = v²/2 at escape speed), so only a few
    // steps around k = 0 can be undecided.
    expect(near).toBeLessThan(10);
  });

  it('post-maneuver: prograde burn to above escape speed on a circular orbit is flagged', () => {
    const r0: Vec3 = [7e6, 0, 0];
    const vc = Math.sqrt(MU / 7e6);
    const m = applyImpulsiveManeuver(r0, [0, vc, 0], [0, vc * (Math.SQRT2 - 1) * 1.01, 0]);
    if (!m.ok) {
      throw new Error(m.reason);
    }
    const c = escapeOf(m.maneuver.position_m, m.maneuver.velocityAfter_mps);
    expect(c.regime).toBe('OPEN');
    expect(c.escape).toBe(true);
  });

  it('failures', () => {
    expect(classifyEscape([0, 0, 0], [1, 0, 0], MU)).toEqual({
      ok: false,
      reason: 'ZERO_POSITION',
    });
    expect(classifyEscape([1, 0, 0], [1, 0, 0], 0)).toEqual({
      ok: false,
      reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE',
    });
    expect(classifyEscape([1, 0, 0], [Number.NaN, 0, 0], MU)).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
    expect(classifyEscape([1, 0, 0], [1e200, 0, 0], MU)).toEqual({
      ok: false,
      reason: 'NON_FINITE_RESULT',
    });
  });
});

describe('detectReferenceSphereIntersection: closed orbit dipping below R, started at apoapsis', () => {
  // Axis-aligned apoapsis state: r·v = 0 exactly. Orbit of the binary64 state: α = 2/r − v²/μ,
  // a = 1/α, e = r α − 1 (at apoapsis r = a(1 + e)). Chosen a ≈ 7.0e6 m, e ≈ 0.1: r_p ≈ 6.3e6 m < R.
  const aNominal = 7.0e6;
  const eNominal = 0.1;
  const rA = aNominal * (1 + eNominal);
  const vA = Math.sqrt((MU / aNominal) * ((1 - eNominal) / (1 + eNominal)));
  const r: Vec3 = [rA, 0, 0];
  const v: Vec3 = [0, vA, 0];
  const alpha = 2 / rA - (vA * vA) / MU;
  const a = 1 / alpha;
  const e = rA * alpha - 1;
  const n = Math.sqrt(MU * alpha * alpha * alpha);
  const halfPeriod = Math.PI / n;
  // First crossing of |r| = R (descending branch E ∈ (π, 2π)), Kepler's equation from apoapsis:
  // r = a(1 − e cos E) → E* = 2π − acos((1 − R/a)/e); t* = ((E* − e sin E*) − π)/n.
  const eStar = 2 * Math.PI - Math.acos((1 - R_REF / a) / e);
  const tStar = (eStar - e * Math.sin(eStar) - Math.PI) / n;

  it('preconditions of the constructed case (margins ≥ 1 %)', () => {
    expect(a * (1 - e)).toBeLessThan(0.99 * R_REF);
    expect(tStar).toBeGreaterThan(0);
    expect(tStar).toBeLessThan(0.99 * halfPeriod);
  });

  it('time to periapsis = half the period of the state’s own orbit (≤ 40u relative)', () => {
    // From apoapsis χ_p = π/k exactly in the code path; t(χ_p) = π/(√μ α^{3/2}) in exact
    // arithmetic. Engine: ~12 rounded operations, Stumpff ≤ 7u, Math.PI/atan2 ≤ 2u, data
    // inconsistency |q + α r₀ − 1| ≤ 4u, amplified by (|q|/α + r₀)/a = 1 + 2e: ≤ 25(1 + 2e)u;
    // test evaluation of π/√(μα³) ≤ 5u; total ≤ 35u for e = 0.1, written as 40u.
    const res = intersectionOf(r, v, R_REF, 0);
    expect(res.timeToPeriapsis_s).not.toBeNull();
    const tp = res.timeToPeriapsis_s ?? Number.NaN;
    expect(Math.abs(tp - halfPeriod)).toBeLessThanOrEqual(40 * U * halfPeriod);
  });

  it('periapsis radius = a(1 − e) of the state’s orbit (≤ 40u relative, operation count)', () => {
    // r_p = p/(1 + e): ~20 rounded operations in h, p, e_vec, |e_vec| with condition ≤ 1 + e
    // (no cancellation: at apoapsis r·v = 0); test a(1 − e) with e = rα − 1: ~6u, amplified by
    // 1/(1 − e) ≤ 1.2. Written as 40u.
    const res = intersectionOf(r, v, R_REF, 0);
    const expected = a * (1 - e);
    expect(Math.abs(res.periapsisRadius_m - expected)).toBeLessThanOrEqual(40 * U * expected);
  });

  it('span before the crossing: not flagged', () => {
    const res = intersectionOf(r, v, R_REF, 0.5 * tStar);
    expect(res.intersects).toBe(false);
    expect(res.reason).toBeNull();
    expect(res.radiusAtEnd_m).toBeGreaterThan(R_REF);
  });

  it('span after the crossing but before periapsis: flagged INSIDE_AT_END', () => {
    const res = intersectionOf(r, v, R_REF, 0.5 * (tStar + halfPeriod));
    expect(res.intersects).toBe(true);
    expect(res.reason).toBe('INSIDE_AT_END');
  });

  it('span containing periapsis: flagged PERIAPSIS_BELOW_REFERENCE_IN_SPAN (also over many periods)', () => {
    for (const span of [1.01 * halfPeriod, 20 * halfPeriod + 0.5 * halfPeriod]) {
      const res = intersectionOf(r, v, R_REF, span);
      expect(res.intersects).toBe(true);
      expect(res.reason).toBe('PERIAPSIS_BELOW_REFERENCE_IN_SPAN');
    }
  });

  it('periapsis time brackets the sign change of r·v (propagator, ±1e-6 relative)', () => {
    const tp = intersectionOf(r, v, R_REF, 0).timeToPeriapsis_s ?? Number.NaN;
    const before = propagateKeplerUniversal(MU, r, v, tp * (1 - 1e-6));
    const after = propagateKeplerUniversal(MU, r, v, tp * (1 + 1e-6));
    if (!before.ok || !after.ok) {
      throw new Error('propagation failed');
    }
    expect(dotVec3(before.position_m, before.velocity_mps)).toBeLessThan(0);
    expect(dotVec3(after.position_m, after.velocity_mps)).toBeGreaterThan(0);
  });

  it('span = 0: not flagged, |r(D)| equals |r(0)| bit-for-bit', () => {
    const res = intersectionOf(r, v, R_REF, 0);
    expect(res.intersects).toBe(false);
    expect(Object.is(res.radiusAtEnd_m, res.radiusAtStart_m)).toBe(true);
  });
});

describe('detectReferenceSphereIntersection: boundaries (inclusive comparisons)', () => {
  const rA = 7.7e6;
  const vA = Math.sqrt((MU / 7.0e6) * (0.9 / 1.1));
  const r: Vec3 = [rA, 0, 0];
  const v: Vec3 = [0, vA, 0];

  it('start exactly on the sphere: INSIDE_AT_START', () => {
    const res = intersectionOf(r, v, normVec3(r), 0);
    expect(res.intersects).toBe(true);
    expect(res.reason).toBe('INSIDE_AT_START');
  });

  it('tangent orbit: R = computed r_p is flagged once periapsis is in the span; R one step below is not', () => {
    const probe = intersectionOf(r, v, R_REF, 0);
    const rp = probe.periapsisRadius_m;
    const tp = probe.timeToPeriapsis_s ?? Number.NaN;
    const touching = intersectionOf(r, v, rp, 1.01 * tp);
    expect(touching.intersects).toBe(true);
    expect(touching.reason).toBe('PERIAPSIS_BELOW_REFERENCE_IN_SPAN');
    // Same orbit, R slightly below r_p (relative 2^-30, far above the radius rounding at t = D).
    const below = intersectionOf(r, v, rp * (1 - 2 ** -30), 1.01 * tp);
    expect(below.intersects).toBe(false);
    // Tangent but periapsis outside the span: not flagged.
    const early = intersectionOf(r, v, rp, 0.5 * tp);
    expect(early.intersects).toBe(false);
  });

  it('periapsis exactly at the end of the span counts (t_p ≤ D)', () => {
    const probe = intersectionOf(r, v, R_REF, 0);
    const tp = probe.timeToPeriapsis_s ?? Number.NaN;
    const res = intersectionOf(r, v, R_REF, tp);
    expect(res.intersects).toBe(true);
    expect(res.reason).toBe('PERIAPSIS_BELOW_REFERENCE_IN_SPAN');
  });
});

describe('detectReferenceSphereIntersection: other conics', () => {
  it('bound orbit with r_p above R: never flagged, over many periods', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [0, Math.sqrt(MU / 7e6) * 1.02, 300];
    for (const span of [0, 100, 6000, 1e5]) {
      const res = intersectionOf(r, v, R_REF, span);
      expect(res.intersects).toBe(false);
      expect(res.periapsisRadius_m).toBeGreaterThan(R_REF);
    }
  });

  it('open orbit moving outward from periapsis: no future periapsis, never flagged', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [0, Math.sqrt((2 * MU) / 7e6) * 1.2, 0];
    const res = intersectionOf(r, v, R_REF, 1e6);
    expect(res.timeToPeriapsis_s).toBeNull();
    expect(res.intersects).toBe(false);
  });

  it('open orbit moving inward with r_p below R: flagged only when the span reaches the crossing', () => {
    // r₀ = 2e7 m, v = (−7000, 1000, 0): ξ > 0, h = 2e10 m²/s, r_p ≈ 1.6e5 m (≪ R).
    const r: Vec3 = [2e7, 0, 0];
    const v: Vec3 = [-7000, 1000, 0];
    expect(escapeOf(r, v).regime).toBe('OPEN');
    const probe = intersectionOf(r, v, R_REF, 0);
    expect(probe.periapsisRadius_m).toBeLessThan(0.1 * R_REF);
    const tp = probe.timeToPeriapsis_s ?? Number.NaN;
    expect(Number.isFinite(tp)).toBe(true);
    const short = intersectionOf(r, v, R_REF, 0.1 * tp);
    expect(short.intersects).toBe(false);
    const long = intersectionOf(r, v, R_REF, 10 * tp);
    expect(long.intersects).toBe(true);
    expect(long.reason).toBe('PERIAPSIS_BELOW_REFERENCE_IN_SPAN');
    // Periapsis time brackets the sign change of r·v.
    const before = propagateKeplerUniversal(MU, r, v, tp * (1 - 1e-6));
    const after = propagateKeplerUniversal(MU, r, v, tp * (1 + 1e-6));
    if (!before.ok || !after.ok) {
      throw new Error('propagation failed');
    }
    expect(dotVec3(before.position_m, before.velocity_mps)).toBeLessThan(0);
    expect(dotVec3(after.position_m, after.velocity_mps)).toBeGreaterThan(0);
  });

  it('open orbit moving inward with r_p above R: not flagged', () => {
    // r₀ = 2e7 m, v = (−7000, 4000, 0): r_p ≈ 6.6e6 m > R (≈ 3 % margin).
    const r: Vec3 = [2e7, 0, 0];
    const v: Vec3 = [-7000, 4000, 0];
    const probe = intersectionOf(r, v, R_REF, 0);
    expect(probe.periapsisRadius_m).toBeGreaterThan(1.01 * R_REF);
    const res = intersectionOf(r, v, R_REF, 10 * (probe.timeToPeriapsis_s ?? Number.NaN));
    expect(res.intersects).toBe(false);
  });

  it('closed orbit moving inward (σ₀ < 0) with r_p below R: crossing before periapsis', () => {
    // Post-maneuver case: retrograde S burn at apoapsis of a 7.7e6 × 7.0e6-ish orbit.
    const rA = 7.7e6;
    const vA = Math.sqrt(MU / rA);
    const m = applyImpulsiveManeuver([rA, 0, 0], [0, vA, 0], [-150, -800, 0]);
    if (!m.ok) {
      throw new Error(m.reason);
    }
    const r = m.maneuver.position_m;
    const v = m.maneuver.velocityAfter_mps;
    expect(dotVec3(r, v)).toBeLessThan(0);
    const probe = intersectionOf(r, v, R_REF, 0);
    expect(probe.periapsisRadius_m).toBeLessThan(0.99 * R_REF);
    const tp = probe.timeToPeriapsis_s ?? Number.NaN;
    expect(intersectionOf(r, v, R_REF, 0.01 * tp).intersects).toBe(false);
    expect(intersectionOf(r, v, R_REF, 2 * tp).reason).toBe('PERIAPSIS_BELOW_REFERENCE_IN_SPAN');
  });
});

describe('detectReferenceSphereIntersection: failures (no throw, no NaN)', () => {
  const r: Vec3 = [7e6, 0, 0];
  const v: Vec3 = [0, 7500, 0];
  it('invalid inputs', () => {
    for (const [rr, vv, mu, R, span] of [
      [[0, 0, 0], v, MU, R_REF, 1],
      [r, v, 0, R_REF, 1],
      [r, v, MU, 0, 1],
      [r, v, MU, R_REF, -1],
      [r, v, MU, R_REF, Number.NaN],
      [r, [Number.NaN, 0, 0], MU, R_REF, 1],
    ] as [Vec3, Vec3, number, number, number][]) {
      expect(detectReferenceSphereIntersection(rr, vv, mu, R, span)).toEqual({
        ok: false,
        reason: 'INVALID_INPUT',
        propagationFailure: null,
      });
    }
  });
  it('span −0 is accepted as 0', () => {
    expect(intersectionOf(r, v, R_REF, -0).intersects).toBe(false);
  });
});
