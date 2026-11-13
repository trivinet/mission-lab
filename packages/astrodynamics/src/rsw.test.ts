/**
 * Unit tests for rsw.ts (implementer self-consistency checks, L1 identities; NOT the VT-11/VT-12
 * verification, which the Verification Engineer runs independently).
 *
 * Bounds (u = 2^-53, first order; derivation in the rsw.ts module comment, consistent with
 * tolerances.md §2 B3–B6). κ_h = |r||v|/|r × v| is evaluated by the test.
 *   ε_R = 4u, ε_W = (6κ_h + 4)u, ε_S = (6κ_h + 11)u   (engine error of each basis vector)
 * Each test bound below = engine error + the error of the test's own evaluation (dot product 3u,
 * cross product 3u for unit vectors) + 1u covering neglected second-order terms and the rounding
 * of the test's κ_h.
 */
import { describe, expect, it } from 'vitest';
import { EARTH_GM_m3ps2 } from './constants';
import { elementsToState } from './elements';
import type { KeplerianElements } from './elements';
import { rswBasis, rswToInertial } from './rsw';
import type { RswBasis } from './rsw';
import { crossVec3, dotVec3, normVec3, subVec3 } from './vector3';
import type { Vec3 } from './vector3';

const U = 2 ** -53;
const MU = EARTH_GM_m3ps2;

function basisOf(r: Vec3, v: Vec3): RswBasis {
  const res = rswBasis(r, v);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.basis;
}

function stateOf(el: KeplerianElements): { r: Vec3; v: Vec3 } {
  const res = elementsToState(el, MU);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return { r: res.state.position_m, v: res.state.velocity_mps };
}

function expectVecIs(actual: Vec3, expected: Vec3): void {
  for (let i = 0; i < 3; i += 1) {
    expect(Object.is(actual[i], expected[i]), `component ${String(i)}`).toBe(true);
  }
}

describe('rswBasis: exact axis-aligned cases (every operation exact in binary64)', () => {
  it('r on +x, v on +y: R = x̂, S = ŷ, W = ẑ (with +0 components)', () => {
    const b = basisOf([7e6, 0, 0], [0, 7500, 0]);
    expectVecIs(b.radial, [1, 0, 0]);
    expectVecIs(b.alongTrack, [0, 1, 0]);
    expectVecIs(b.crossTrack, [0, 0, 1]);
  });

  it('radial velocity component does not change S on an axis-aligned state', () => {
    // v = (300, 7500, 0): h = (0, 0, 7e6·7500) still along +z.
    const b = basisOf([7e6, 0, 0], [300, 7500, 0]);
    expectVecIs(b.radial, [1, 0, 0]);
    expectVecIs(b.alongTrack, [0, 1, 0]);
    expectVecIs(b.crossTrack, [0, 0, 1]);
  });

  it('retrograde: v on −y gives W = −ẑ and S = −ŷ', () => {
    const b = basisOf([7e6, 0, 0], [0, -7500, 0]);
    expectVecIs(b.radial, [1, 0, 0]);
    expectVecIs(b.crossTrack, [0, 0, -1]);
    expect(b.alongTrack).toEqual([0, -1, 0]);
    expect(b.alongTrack[1]).toBe(-1);
  });

  it('r on +y, v on +z: R = ŷ, W = x̂, S = ẑ (S is the velocity direction)', () => {
    const b = basisOf([0, 4e7, 0], [0, 0, 3000]);
    expectVecIs(b.radial, [0, 1, 0]);
    expectVecIs(b.crossTrack, [1, 0, 0]);
    expectVecIs(b.alongTrack, [0, 0, 1]);
  });

  it('a velocity component along r is ignored by S (S ⟂ R), unlike v/|v|', () => {
    // r = (3, 4, 0)·1e6 has |r| = 5e6 exactly; v = r̂·100 + ẑ·7000 → W ⟂ r, S = ẑ-ish.
    const b = basisOf([3e6, 4e6, 0], [60, 80, 7000]);
    expectVecIs(b.radial, [0.6, 0.8, 0]);
    // S · v must equal |h|/|r| > 0 and S must have no radial part.
    expect(dotVec3(b.alongTrack, b.radial)).toBe(0);
    expect(dotVec3(b.alongTrack, [60, 80, 7000])).toBeGreaterThan(0);
  });
});

describe('rswBasis: invariants with derived rounding bounds', () => {
  const cases: { name: string; r: Vec3; v: Vec3 }[] = [
    {
      name: 'circular LEO inclined',
      ...stateOf({
        semiMajorAxis_m: 7.0e6,
        eccentricity: 0,
        inclination_rad: 0.9,
        raan_rad: 0.7,
        argPeriapsis_rad: 1.3,
        trueAnomaly_rad: 2.1,
      }),
    },
    {
      name: 'moderately elliptical, off-apsis',
      ...stateOf({
        semiMajorAxis_m: 1.2e7,
        eccentricity: 0.4,
        inclination_rad: 0.5,
        raan_rad: 4.0,
        argPeriapsis_rad: 5.5,
        trueAnomaly_rad: 1.0,
      }),
    },
    {
      name: 'Molniya-like, near the latus rectum',
      ...stateOf({
        semiMajorAxis_m: 2.6e7,
        eccentricity: 0.74,
        inclination_rad: 1.1,
        raan_rad: 3.0,
        argPeriapsis_rad: 4.7,
        trueAnomaly_rad: 1.7,
      }),
    },
    {
      name: 'retrograde near-polar',
      ...stateOf({
        semiMajorAxis_m: 7.2e6,
        eccentricity: 0.01,
        inclination_rad: 2.9,
        raan_rad: 6.0,
        argPeriapsis_rad: 0.2,
        trueAnomaly_rad: 5.9,
      }),
    },
    // Hyperbolic energy, large flight-path angle, arbitrary components (κ_h computed below).
    { name: 'hyperbolic, steep', r: [-5.1e6, 3.3e6, 2.2e6], v: [9.1e3, 4.4e3, -6.0e3] },
  ];

  for (const c of cases) {
    it(`${c.name}: orthonormal, right-handed, R ∥ r, W ∥ r × v`, () => {
      const b = basisOf(c.r, c.v);
      const h = crossVec3(c.r, c.v);
      const kappaH = (normVec3(c.r) * normVec3(c.v)) / normVec3(h);
      const epsR = 4 * U;
      const epsW = (6 * kappaH + 4) * U;
      const epsS = (6 * kappaH + 11) * U;
      const columns: { vec: Vec3; eps: number }[] = [
        { vec: b.radial, eps: epsR },
        { vec: b.alongTrack, eps: epsS },
        { vec: b.crossTrack, eps: epsW },
      ];

      // (BᵀB − I)_jk: engine ≤ ε_j + ε_k; test dot 3u; +1u.
      columns.forEach((cj, j) => {
        columns.forEach((ck, k) => {
          const value = dotVec3(cj.vec, ck.vec) - (j === k ? 1 : 0);
          expect(Math.abs(value)).toBeLessThanOrEqual(cj.eps + ck.eps + 4 * U);
        });
      });

      // Handedness |R × S − W|: engine ε_R + ε_S + ε_W; test cross 3u; +1u.
      const handedness = normVec3(subVec3(crossVec3(b.radial, b.alongTrack), b.crossTrack));
      expect(handedness).toBeLessThanOrEqual(epsR + epsS + epsW + 4 * U);

      // R ∥ r: |R × r|/|r| = |(R̂ − R) × r|/|r| ≤ ε_R; test cross 3u; +1u. And R·r > 0.
      expect(normVec3(crossVec3(b.radial, c.r)) / normVec3(c.r)).toBeLessThanOrEqual(epsR + 4 * U);
      expect(dotVec3(b.radial, c.r)).toBeGreaterThan(0);

      // W ⟂ r and W ⟂ v (so W ∥ r × v): |W·x|/|x| ≤ ε_W; test dot 3u; +1u. And W·h > 0.
      expect(Math.abs(dotVec3(b.crossTrack, c.r)) / normVec3(c.r)).toBeLessThanOrEqual(
        epsW + 4 * U,
      );
      expect(Math.abs(dotVec3(b.crossTrack, c.v)) / normVec3(c.v)).toBeLessThanOrEqual(
        epsW + 4 * U,
      );
      expect(dotVec3(b.crossTrack, h)).toBeGreaterThan(0);

      // S points forward (P4): S·v > 0.
      expect(dotVec3(b.alongTrack, c.v)).toBeGreaterThan(0);
    });
  }

  it('is invariant (bit-for-bit) under scaling r and v by powers of two', () => {
    const { r, v } = cases[1] ?? { r: [1, 0, 0] as Vec3, v: [0, 1, 0] as Vec3 };
    const b = basisOf(r, v);
    const b2 = basisOf([r[0] * 1024, r[1] * 1024, r[2] * 1024], [v[0] / 8, v[1] / 8, v[2] / 8]);
    expectVecIs(b2.radial, b.radial);
    expectVecIs(b2.alongTrack, b.alongTrack);
    expectVecIs(b2.crossTrack, b.crossTrack);
  });
});

describe('rswBasis: failures (no throw, no NaN)', () => {
  it('zero position', () => {
    expect(rswBasis([0, -0, 0], [0, 7500, 0])).toEqual({ ok: false, reason: 'ZERO_POSITION' });
  });
  it('rectilinear: v ∥ r', () => {
    expect(rswBasis([7e6, 0, 0], [-100, 0, 0])).toEqual({
      ok: false,
      reason: 'ZERO_ANGULAR_MOMENTUM',
    });
    expect(rswBasis([3e6, 4e6, 0], [3, 4, 0])).toEqual({
      ok: false,
      reason: 'ZERO_ANGULAR_MOMENTUM',
    });
  });
  it('rectilinear: v = 0', () => {
    expect(rswBasis([7e6, 1e6, 0], [0, 0, 0])).toEqual({
      ok: false,
      reason: 'ZERO_ANGULAR_MOMENTUM',
    });
  });
  it('r × v underflows to zero', () => {
    expect(rswBasis([1e-200, 0, 0], [0, 1e-200, 0])).toEqual({
      ok: false,
      reason: 'ZERO_ANGULAR_MOMENTUM',
    });
  });
  it('non-finite input', () => {
    expect(rswBasis([Number.NaN, 0, 0], [0, 1, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
    expect(rswBasis([1, 0, 0], [0, Number.POSITIVE_INFINITY, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
  });
  it('r × v overflows', () => {
    expect(rswBasis([1e200, 0, 0], [0, 1e200, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_RESULT',
    });
  });
});

describe('rswToInertial: exact properties of the fixed evaluation order', () => {
  const b = basisOf([-5.1e6, 3.3e6, 2.2e6], [9.1e3, 4.4e3, -6.0e3]);

  it('unit RSW components return the basis vectors (=== per component)', () => {
    expect(rswToInertial(b, [1, 0, 0])).toEqual(b.radial);
    expect(rswToInertial(b, [0, 1, 0])).toEqual(b.alongTrack);
    expect(rswToInertial(b, [0, 0, 1])).toEqual(b.crossTrack);
  });

  it('power-of-two scaling is exact (Object.is per component)', () => {
    const x: Vec3 = [12.5, -3.75, 0.3];
    const y = rswToInertial(b, x);
    expectVecIs(rswToInertial(b, [x[0] * 4, x[1] * 4, x[2] * 4]), [y[0] * 4, y[1] * 4, y[2] * 4]);
    expectVecIs(rswToInertial(b, [x[0] / 2, x[1] / 2, x[2] / 2]), [y[0] / 2, y[1] / 2, y[2] / 2]);
  });

  it('negation is exact (=== per component)', () => {
    const x: Vec3 = [12.5, -3.75, 0.3];
    const y = rswToInertial(b, x);
    const yn = rswToInertial(b, [-x[0], -x[1], -x[2]]);
    for (let i = 0; i < 3; i += 1) {
      expect(yn[i]).toBe(-(y[i] ?? Number.NaN));
    }
  });
});
