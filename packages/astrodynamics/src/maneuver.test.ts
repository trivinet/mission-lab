/**
 * Unit tests for maneuver.ts (implementer self-consistency checks; NOT the VT-12/VT-13/VT-14
 * verification, which the Verification Engineer runs independently).
 *
 * Exact checks use Object.is (bit-identical) or === where the module documents ±0 freedom.
 * Inexact checks use bounds derived in each test (u = 2^-53, first order, building blocks of
 * tolerances.md §2), or, where named, an APPROVED tolerance of tolerances.md §7.
 * Energy evaluation bound used below (derived in trajectory-flags.ts, ENERGY ROUNDING):
 *   |ξ̂ − ξ| ≤ 5u (v²/2 + μ/|r|) for ξ̂ = v·v/2 − μ/|r| as evaluated by stateIntegrals.
 */
import { describe, expect, it } from 'vitest';
import { EARTH_GM_m3ps2 } from './constants';
import { elementsToState } from './elements';
import { applyImpulsiveManeuver } from './maneuver';
import type { ImpulsiveManeuverApplication } from './maneuver';
import { stateIntegrals } from './orbit-quantities';
import { rswToInertial } from './rsw';
import { crossVec3, dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

const U = 2 ** -53;
const MU = EARTH_GM_m3ps2;

function apply(r: Vec3, v: Vec3, dv: Vec3): ImpulsiveManeuverApplication {
  const res = applyImpulsiveManeuver(r, v, dv);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.maneuver;
}

function energy(r: Vec3, v: Vec3): number {
  const res = stateIntegrals(r, v, MU);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.integrals.specificEnergy_m2ps2;
}

function inclinedState(): { r: Vec3; v: Vec3 } {
  const res = elementsToState(
    {
      semiMajorAxis_m: 1.2e7,
      eccentricity: 0.4,
      inclination_rad: 0.5,
      raan_rad: 4.0,
      argPeriapsis_rad: 5.5,
      trueAnomaly_rad: 1.0,
    },
    MU,
  );
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return { r: res.state.position_m, v: res.state.velocity_mps };
}

function expectR12(m: ImpulsiveManeuverApplication): void {
  for (let i = 0; i < 3; i += 1) {
    const before = m.velocityBefore_mps[i] ?? Number.NaN;
    const dv = m.deltaV_inertial_mps[i] ?? Number.NaN;
    expect(Object.is(m.velocityAfter_mps[i], before + dv), `R12 component ${String(i)}`).toBe(
      true,
    );
  }
}

function expectVecIs(actual: Vec3, expected: Vec3): void {
  for (let i = 0; i < 3; i += 1) {
    expect(Object.is(actual[i], expected[i]), `component ${String(i)}`).toBe(true);
  }
}

const R0_M = 7e6;
const VC_MPS = Math.sqrt(MU / R0_M);
const AXIS_R: Vec3 = [R0_M, 0, 0];
const AXIS_V: Vec3 = [0, VC_MPS, 0];

describe('applyImpulsiveManeuver: contract invariants (bit-exact)', () => {
  const { r, v } = inclinedState();
  const burns: Vec3[] = [
    [0, 100, 0],
    [-35.5, 12.25, 80],
    [1e-3, -2.5e3, 7.77],
    [0, 0, -500],
  ];

  for (const dv of burns) {
    it(`Δv_RSW = [${dv.join(', ')}]: position copied, v⁻ copied, R12 exact, |Δv| = norm of Δv_I`, () => {
      const m = apply(r, v, dv);
      expectVecIs(m.position_m, r);
      expectVecIs(m.velocityBefore_mps, v);
      expect(m.position_m).not.toBe(r);
      expect(m.velocityBefore_mps).not.toBe(v);
      expectR12(m);
      expect(Object.is(m.deltaV_magnitude_mps, normVec3(m.deltaV_inertial_mps))).toBe(true);
      expectVecIs(m.deltaV_inertial_mps, rswToInertial(m.rswBasis, dv));
    });
  }

  it('|Δv_I| vs |Δv_RSW| within the APPROVED VT-13 cross-check tolerance 4(12κ_h + 31)u (tolerances.md §7 VT-13)', () => {
    const kappaH = (normVec3(r) * normVec3(v)) / normVec3(crossVec3(r, v));
    for (const dv of burns) {
      const m = apply(r, v, dv);
      const rswNorm = normVec3(dv);
      expect(Math.abs(m.deltaV_magnitude_mps - rswNorm)).toBeLessThanOrEqual(
        4 * (12 * kappaH + 31) * U * rswNorm,
      );
    }
  });
});

describe('applyImpulsiveManeuver: exact axis-aligned cases', () => {
  it('pure S burn on r = x̂ r0, v = ŷ vc: Δv_I = [0, Δ, 0] and v⁺ = [0, fl(vc + Δ), 0]', () => {
    const m = apply(AXIS_R, AXIS_V, [0, 100, 0]);
    expectVecIs(m.deltaV_inertial_mps, [0, 100, 0]);
    expectVecIs(m.velocityAfter_mps, [0, VC_MPS + 100, 0]);
    expect(m.deltaV_magnitude_mps).toBe(100);
  });

  it('pure R burn: Δv_I = [Δ, 0, 0]', () => {
    const m = apply(AXIS_R, AXIS_V, [-20, 0, 0]);
    expectVecIs(m.deltaV_inertial_mps, [-20, 0, 0]);
    expectVecIs(m.velocityAfter_mps, [-20, VC_MPS, 0]);
  });

  it('pure W burn: v⁺ = [0, vc, Δ]; the plane rotates about R by atan(Δ/vc)', () => {
    const delta = 250;
    const m = apply(AXIS_R, AXIS_V, [0, 0, delta]);
    expectVecIs(m.velocityAfter_mps, [0, VC_MPS, delta]);
    const hAfter = crossVec3(m.position_m, m.velocityAfter_mps);
    // h⁺ ⟂ R exactly (rotation axis is R): h⁺ = [0, −r0Δ, r0 vc] with rounded products.
    expect(hAfter[0]).toBe(0);
    // tan θ = r0Δ/(r0 vc) = Δ/vc. Engine: two rounded products; test: two divisions → ≤ 4u
    // relative, +1u for second-order terms.
    const tanTheta = -(hAfter[1] / hAfter[2]);
    const expected = delta / VC_MPS;
    expect(Math.abs(tanTheta - expected)).toBeLessThanOrEqual(5 * U * expected);
  });
});

describe('applyImpulsiveManeuver: physics consistency with derived bounds', () => {
  it('pure S burn on a circular orbit raises ξ by vc·Δ + Δ²/2', () => {
    const delta = 100;
    const m = apply(AXIS_R, AXIS_V, [0, delta, 0]);
    const before = energy(AXIS_R, AXIS_V);
    const after = energy(AXIS_R, m.velocityAfter_mps);
    const expected = VC_MPS * delta + (delta * delta) / 2;
    const aBefore = (VC_MPS * VC_MPS) / 2;
    const vPlus = VC_MPS + delta;
    const aAfter = (vPlus * vPlus) / 2;
    const b = MU / R0_M;
    // Bound: rounding of fl(vc + Δ) changes v²/2 by ≤ u v⁺²; each ξ̂ ≤ 5u(A + B); difference u|Δξ|;
    // closed form evaluated by the test 2u|Δξ|; +1u(A⁺ + A⁻ + 2B) for second-order terms.
    const bound = U * vPlus * vPlus + 6 * U * (aAfter + aBefore + 2 * b) + 3 * U * expected;
    expect(Math.abs(after - before - expected)).toBeLessThanOrEqual(bound);
  });

  it('pure W burn on an inclined elliptical orbit: ξ rises by Δ²/2 (W ⟂ v), |r| unchanged', () => {
    const { r, v } = inclinedState();
    const delta = 300;
    const m = apply(r, v, [0, 0, delta]);
    expect(normVec3(m.position_m)).toBe(normVec3(r));
    const kappaH = (normVec3(r) * normVec3(v)) / normVec3(crossVec3(r, v));
    const vMinus = normVec3(v);
    const vPlus = normVec3(m.velocityAfter_mps);
    const b = MU / normVec3(r);
    // Exact: ξ⁺ − ξ⁻ = Δ (v·Ŵ) + Δ²/2 with |v·Ŵ| ≤ ε_W v (ε_W = (6κ_h + 4)u, rsw.ts), and Ŵ has
    // |Ŵ| − 1 ≤ ε_W, so Δ²/2 changes by ≤ Δ² ε_W. Per-component rounding of v⁺ changes v²/2 by
    // ≤ √3 u v⁺² ≤ 2u v⁺². Δv_I rounding ≤ 3uΔ per component → ≤ 6uΔ v⁺ in v²/2. Each ξ̂ ≤
    // 5u(A + B); test Δ²/2 exact; difference u|Δξ|; +1u(A⁺ + A⁻ + 2B) second order.
    const epsW = (6 * kappaH + 4) * U;
    const expected = (delta * delta) / 2;
    const bound =
      delta * epsW * vMinus +
      delta * delta * epsW +
      2 * U * vPlus * vPlus +
      6 * U * delta * vPlus +
      6 * U * ((vPlus * vPlus) / 2 + (vMinus * vMinus) / 2 + 2 * b) +
      U * expected;
    const after = energy(r, m.velocityAfter_mps);
    const before = energy(r, v);
    expect(Math.abs(after - before - expected)).toBeLessThanOrEqual(bound);
    // The new plane normal is rotated away from the old one: h⁺ · h⁻ < |h⁺||h⁻|, and the rotation
    // axis is r: h⁺ ⟂ r up to the test's cross/dot rounding (h⁺ = r × v⁺ is ⟂ r by construction).
    const hBefore = crossVec3(r, v);
    const hAfter = crossVec3(r, m.velocityAfter_mps);
    expect(dotVec3(hBefore, hAfter)).toBeLessThan(normVec3(hBefore) * normVec3(hAfter));
  });

  it('linearity: Δv_I(a + b) − Δv_I(a) − Δv_I(b) ≤ 5u(|a| + |b| + |a + b|) per component', () => {
    const { r, v } = inclinedState();
    const a: Vec3 = [3, -40, 12.5];
    const bb: Vec3 = [-1.25, 7, 100];
    const ab: Vec3 = [a[0] + bb[0], a[1] + bb[1], a[2] + bb[2]];
    const ma = apply(r, v, a).deltaV_inertial_mps;
    const mb = apply(r, v, bb).deltaV_inertial_mps;
    const mab = apply(r, v, ab).deltaV_inertial_mps;
    // Derivation: each Δv_I(x)_i is an inner product of length 3 with error ≤ 3u|x| (rows of the
    // computed basis have norm 1 + O(u)); the rounding of a + b adds ≤ u|a + b|; the test's sum
    // ≤ u(|a| + |b|): 4u(|a| + |b| + |a + b|), +1u for second-order terms.
    const bound = 5 * U * (normVec3(a) + normVec3(bb) + normVec3(ab));
    for (let i = 0; i < 3; i += 1) {
      const residual = (mab[i] ?? Number.NaN) - ((ma[i] ?? Number.NaN) + (mb[i] ?? Number.NaN));
      expect(Math.abs(residual)).toBeLessThanOrEqual(bound);
    }
  });

  it('homogeneity under powers of two is exact (Object.is)', () => {
    const { r, v } = inclinedState();
    const x: Vec3 = [3, -40, 12.5];
    const m1 = apply(r, v, x).deltaV_inertial_mps;
    const m8 = apply(r, v, [x[0] * 8, x[1] * 8, x[2] * 8]).deltaV_inertial_mps;
    expectVecIs(m8, [m1[0] * 8, m1[1] * 8, m1[2] * 8]);
  });
});

describe('applyImpulsiveManeuver: zero Δv and signed zeros', () => {
  it('zero Δv: event produced, Δv_I is ±0, v⁺ === v⁻, |Δv| = +0, R12 exact', () => {
    const { r, v } = inclinedState();
    for (const zero of [
      [0, 0, 0],
      [-0, -0, -0],
      [0, -0, 0],
    ] as Vec3[]) {
      const m = apply(r, v, zero);
      for (let i = 0; i < 3; i += 1) {
        expect(m.deltaV_inertial_mps[i] === 0).toBe(true);
        expect(m.velocityAfter_mps[i] === m.velocityBefore_mps[i]).toBe(true);
      }
      expect(Object.is(m.deltaV_magnitude_mps, 0)).toBe(true);
      expectR12(m);
    }
  });

  it('Δv_I[i] is −0 exactly when all three products of row i are −0 (Z1)', () => {
    const { r, v } = inclinedState();
    for (const zero of [
      [0, 0, 0],
      [-0, -0, -0],
    ] as Vec3[]) {
      const m = apply(r, v, zero);
      const b = m.rswBasis;
      for (let i = 0; i < 3; i += 1) {
        const allNegativeZero =
          Object.is(zero[0] * (b.radial[i] ?? Number.NaN), -0) &&
          Object.is(zero[1] * (b.alongTrack[i] ?? Number.NaN), -0) &&
          Object.is(zero[2] * (b.crossTrack[i] ?? Number.NaN), -0);
        expect(Object.is(m.deltaV_inertial_mps[i], -0)).toBe(allNegativeZero);
      }
    }
  });

  it('a −0 velocity component with a +0 inertial Δv becomes +0 (=== holds, Object.is does not; Z3)', () => {
    // r = x̂ r0, v = (−0, vc, 0): W = (0, −0, 1), S = (−0, 1, 0), Δv_I[0] = (0·1 + 0·(−0)) + 0·0 = +0.
    const m = apply(AXIS_R, [-0, VC_MPS, 0], [0, 0, 0]);
    expect(Object.is(m.velocityBefore_mps[0], -0)).toBe(true);
    expect(Object.is(m.deltaV_inertial_mps[0], 0)).toBe(true);
    expect(Object.is(m.velocityAfter_mps[0], 0)).toBe(true);
    expect(m.velocityAfter_mps[0] === m.velocityBefore_mps[0]).toBe(true);
    expectR12(m);
  });
});

describe('applyImpulsiveManeuver: failures (no throw, no NaN)', () => {
  it('non-finite Δv or state', () => {
    expect(applyImpulsiveManeuver(AXIS_R, AXIS_V, [0, Number.NaN, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
    expect(applyImpulsiveManeuver([Number.NEGATIVE_INFINITY, 0, 0], AXIS_V, [0, 1, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
  });
  it('undefined RSW basis', () => {
    expect(applyImpulsiveManeuver([0, 0, 0], AXIS_V, [0, 1, 0])).toEqual({
      ok: false,
      reason: 'ZERO_POSITION',
    });
    expect(applyImpulsiveManeuver(AXIS_R, [-5, 0, 0], [0, 1, 0])).toEqual({
      ok: false,
      reason: 'ZERO_ANGULAR_MOMENTUM',
    });
  });
  it('overflow of the magnitude or of v⁺', () => {
    expect(applyImpulsiveManeuver(AXIS_R, AXIS_V, [1.7e308, 1.7e308, 1.7e308])).toEqual({
      ok: false,
      reason: 'NON_FINITE_RESULT',
    });
    expect(applyImpulsiveManeuver([1, 0, 0], [0, 1.7e308, 0], [0, 1.7e308, 0])).toEqual({
      ok: false,
      reason: 'NON_FINITE_RESULT',
    });
  });
});
