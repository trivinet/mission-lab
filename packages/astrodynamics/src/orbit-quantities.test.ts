/**
 * Unit tests for orbit-quantities.ts: exact cases (`toBe`) where every operation is exact in
 * binary64, and invariants with bounds derived from operation counts (u = 2^-53 per +, −, *, /,
 * sqrt; ASSUMPTION A of elements.test.ts for trig). PROVISIONAL bounds; own checks only, not a
 * VT-family verification.
 */
import { describe, expect, it } from 'vitest';
import { EARTH_GM_m3ps2 } from './constants';
import { elementsToState } from './elements';
import { closedOrbitQuantities, stateIntegrals } from './orbit-quantities';
import type { ClosedOrbitQuantities } from './orbit-quantities';

const U = 2 ** -53;
const MU = EARTH_GM_m3ps2;

function quantities(a: number, e: number, mu: number): ClosedOrbitQuantities {
  const res = closedOrbitQuantities(a, e, mu);
  if (!res.ok) {
    throw new Error(res.reason);
  }
  return res.quantities;
}

describe('closedOrbitQuantities: exact cases', () => {
  it('a = 1, e = 0, μ = 1', () => {
    const q = quantities(1, 0, 1);
    expect(q.periapsisRadius_m).toBe(1);
    expect(q.apoapsisRadius_m).toBe(1);
    expect(q.period_s).toBe(2 * Math.PI);
    expect(q.meanMotion_radps).toBe(1);
    expect(q.specificEnergy_m2ps2).toBe(-0.5);
    expect(q.specificAngularMomentum_m2ps).toBe(1);
  });

  it('a = 4, e = 0.5, μ = 1 (all operations exact except sqrt(3))', () => {
    const q = quantities(4, 0.5, 1);
    expect(q.periapsisRadius_m).toBe(2);
    expect(q.apoapsisRadius_m).toBe(6);
    // sqrt(4/1) = 2; T = 2π · (4 · 2) = 16π (power-of-two scaling of 2π is exact).
    expect(q.period_s).toBe(16 * Math.PI);
    expect(q.meanMotion_radps).toBe(0.125);
    expect(q.specificEnergy_m2ps2).toBe(-0.125);
    // μ a (1 − e)(1 + e) = 4 · 0.5 · 1.5 = 3 exactly; |h| = sqrt(3) (one rounding, same as here).
    expect(q.specificAngularMomentum_m2ps).toBe(Math.sqrt(3));
  });
});

describe('closedOrbitQuantities: invariants (Earth μ, orbit-like a, e)', () => {
  const cases: [number, number][] = [
    [6.778e6, 0],
    [7.0e6, 1e-3],
    [2.66e7, 0.74],
    [4.2164e7, 0],
    [1.0e7, 0.95],
  ];
  it.each(cases)('a = %d m, e = %d', (a, e) => {
    const q = quantities(a, e, MU);
    // T · n = 2π: T has sqrt (≤ 1.5u incl. the division inside), 2 products: ≤ 3.5u; n: 2
    // divisions + sqrt: ≤ 3.5u; product 1u: ≤ 8u; margin 2 → 16u.
    expect(Math.abs(q.period_s * q.meanMotion_radps - 2 * Math.PI)).toBeLessThanOrEqual(
      16 * U * 2 * Math.PI,
    );
    // r_p + r_a = 2a: each ≤ 2u relative of ≤ 2a; sum 1u: ≤ 5u · 2a; margin 2.
    expect(Math.abs(q.periapsisRadius_m + q.apoapsisRadius_m - 2 * a)).toBeLessThanOrEqual(
      20 * U * a,
    );
    // r_p r_a μ / a = |h|²: left ≤ 2+2+1+1+1 = 7u, right (sqrt, squared) ≤ 2·(4u + 0.5u) + 1u;
    // total ≤ 17u; margin 2.
    const lhs = (q.periapsisRadius_m * q.apoapsisRadius_m * MU) / a;
    const hh = q.specificAngularMomentum_m2ps * q.specificAngularMomentum_m2ps;
    expect(Math.abs(lhs - hh)).toBeLessThanOrEqual(34 * U * hh);
  });

  it('agrees with the state integrals of the state built from the same elements', () => {
    for (const [a, e] of cases) {
      const s = elementsToState(
        {
          semiMajorAxis_m: a,
          eccentricity: e,
          inclination_rad: 1,
          raan_rad: 2,
          argPeriapsis_rad: 3,
          trueAnomaly_rad: 4,
        },
        MU,
      );
      if (!s.ok) {
        throw new Error(s.reason);
      }
      const si = stateIntegrals(s.state.position_m, s.state.velocity_mps, MU);
      if (!si.ok) {
        throw new Error(si.reason);
      }
      const q = quantities(a, e, MU);
      // Energy: v²/2 − μ/r cancels by (v²/2 + μ/r)/|ξ| ≤ 4/(1 − e) (elements.test.ts E3) on terms
      // carrying the state errors 2√3·VEL and √3·POS (elements.test.ts E1/E2,
      // VEL ≤ 128(1 + 1/(1 − e))u): bound 4/(1 − e) · (2√3 · 128 (1 + 1/(1 − e)) + 8) u.
      const k = 4 / (1 - e);
      const energyBound = k * (2 * Math.sqrt(3) * 128 * (1 + 1 / (1 - e)) + 8) * U;
      expect(
        Math.abs(si.integrals.specificEnergy_m2ps2 - q.specificEnergy_m2ps2),
      ).toBeLessThanOrEqual(energyBound * Math.abs(q.specificEnergy_m2ps2));
      // |h|: √3 (POS + VEL) + 8u (elements.test.ts |h|² check, halved), with POS ≤ VEL.
      const hBound = (2 * Math.sqrt(3) * 128 * (1 + 1 / (1 - e)) + 16) * U;
      expect(
        Math.abs(si.integrals.specificAngularMomentum_m2ps - q.specificAngularMomentum_m2ps),
      ).toBeLessThanOrEqual(hBound * q.specificAngularMomentum_m2ps);
    }
  });
});

describe('closedOrbitQuantities: explicit behaviour outside the closed-orbit domain', () => {
  const cases: [number, number, number, string][] = [
    [Number.NaN, 0, MU, 'NON_FINITE_INPUT'],
    [7e6, Number.POSITIVE_INFINITY, MU, 'NON_FINITE_INPUT'],
    [7e6, 0, 0, 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'],
    [7e6, 1, MU, 'NOT_CLOSED_ORBIT'],
    [-7e6, 1.5, MU, 'NOT_CLOSED_ORBIT'],
    [0, 0, MU, 'NOT_CLOSED_ORBIT'],
    [7e6, -0.1, MU, 'NOT_CLOSED_ORBIT'],
    // sqrt(a/μ) = sqrt(1e308/1e-308) = Infinity.
    [1e308, 0, 1e-308, 'NON_FINITE_RESULT'],
  ];
  it.each(cases)('case %#', (a, e, mu, reason) => {
    expect(closedOrbitQuantities(a, e, mu)).toEqual({ ok: false, reason });
  });
});

describe('stateIntegrals', () => {
  it('exact case: r = (1, 0, 0), v = (0, 1, 0), μ = 1 gives ξ = −0.5, |h| = 1', () => {
    expect(stateIntegrals([1, 0, 0], [0, 1, 0], 1)).toEqual({
      ok: true,
      integrals: { specificEnergy_m2ps2: -0.5, specificAngularMomentum_m2ps: 1 },
    });
  });

  it('open orbit: positive energy is returned, not flagged as a failure', () => {
    const res = stateIntegrals([1, 0, 0], [0, 2, 0], 1);
    expect(res).toEqual({
      ok: true,
      integrals: { specificEnergy_m2ps2: 1, specificAngularMomentum_m2ps: 2 },
    });
  });

  it('failures are result objects', () => {
    expect(stateIntegrals([0, 0, 0], [0, 1, 0], 1)).toEqual({ ok: false, reason: 'ZERO_POSITION' });
    expect(stateIntegrals([1, 0, Number.NaN], [0, 1, 0], 1)).toEqual({
      ok: false,
      reason: 'NON_FINITE_INPUT',
    });
    expect(stateIntegrals([1, 0, 0], [0, 1, 0], -1)).toEqual({
      ok: false,
      reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE',
    });
    expect(stateIntegrals([1e300, 0, 0], [0, 1e300, 0], 1)).toEqual({
      ok: false,
      reason: 'NON_FINITE_RESULT',
    });
  });
});
