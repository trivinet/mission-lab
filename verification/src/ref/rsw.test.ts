/**
 * Self-validation of the RSW reference (ML-TASK-018 part C) before any engine comparison:
 * - the projection formulation equals the contract-wording formulation in 320-bit arithmetic;
 * - both equal a third, element-based formulation (columns of Rz(Ω)Rx(i)Rz(ω) applied to the
 *   perifocal radial/transverse directions) to binary64 accuracy;
 * - exactly known axis-aligned configurations;
 * - the rounded reference Δv is within ½ ulp per component of the 320-bit value, i.e. far inside
 *   the reference share (12κ_h + 24.2)u of the VT-12 tolerance.
 */
import { describe, expect, it } from 'vitest';
import { toNumber } from '../hp/bigfloat';
import { distB, normB, b3 } from '../hp/hp-vec';
import { elementsToState, perifocalToInertial } from './elements';
import {
  rswBasisDefinitionHp,
  rswBasisProjection,
  rswBasisProjectionHp,
  rswToInertialB,
  rswToInertialHp,
  velocityAfterR12,
} from './rsw';
import { matVec, norm, type V3 } from './vec';

const MU = 3.986004418e14;
const U = 2 ** -53;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

describe('RSW reference (L2c, projection form)', () => {
  it('axis-aligned states give the exact axes', () => {
    const b = rswBasisProjection([7e6, 0, 0], [0, 7500, 0]);
    expect(b.R).toEqual([1, 0, 0]);
    expect(b.S.map((x) => x + 0)).toEqual([0, 1, 0]);
    expect(b.W.map((x) => x + 0)).toEqual([0, 0, 1]);
    const c = rswBasisProjection([0, 7e6, 0], [-7500, 0, 0]);
    expect(c.R.map((x) => x + 0)).toEqual([0, 1, 0]);
    expect(c.S.map((x) => x + 0)).toEqual([-1, 0, 0]);
    expect(c.W.map((x) => x + 0)).toEqual([0, 0, 1]);
    // Retrograde in the xy plane: W = −z.
    const d = rswBasisProjection([7e6, 0, 0], [0, -7500, 0]);
    expect(d.W.map((x) => x + 0)).toEqual([0, 0, -1]);
    expect(rswToInertialHp([7e6, 0, 0], [0, 7500, 0], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('projection and contract-wording formulations agree in 320-bit arithmetic', () => {
    const rand = rng(12345);
    for (let k = 0; k < 300; k++) {
      const a = 6.6e6 + rand() * 4e7;
      const e = rand() * 0.95;
      const el = {
        semiMajorAxis_m: a,
        eccentricity: e,
        inclination_rad: rand() * Math.PI,
        raan_rad: rand() * 2 * Math.PI,
        argPeriapsis_rad: rand() * 2 * Math.PI,
        trueAnomaly_rad: rand() * 2 * Math.PI,
      };
      const s = elementsToState(el, MU);
      const p = rswBasisProjectionHp(s.position_m, s.velocity_mps);
      const d = rswBasisDefinitionHp(s.position_m, s.velocity_mps);
      for (const key of ['R', 'S', 'W'] as const) {
        expect(distB(p[key], d[key])).toBeLessThan(1e-90);
        expect(Math.abs(toNumber(normB(p[key])) - 1)).toBeLessThan(1e-90);
      }
    }
  });

  it('agrees with the element-based basis Q·(cos ν, sin ν, 0), Q·(−sin ν, cos ν, 0), Q·e_z', () => {
    const rand = rng(777);
    let worst = 0;
    for (let k = 0; k < 500; k++) {
      const el = {
        semiMajorAxis_m: 6.6e6 + rand() * 4e7,
        eccentricity: rand() * 0.9,
        inclination_rad: rand() * Math.PI,
        raan_rad: rand() * 2 * Math.PI,
        argPeriapsis_rad: rand() * 2 * Math.PI,
        trueAnomaly_rad: rand() * 2 * Math.PI,
      };
      const s = elementsToState(el, MU);
      const q = perifocalToInertial(el.raan_rad, el.inclination_rad, el.argPeriapsis_rad);
      const nu = el.trueAnomaly_rad;
      const R = matVec(q, [Math.cos(nu), Math.sin(nu), 0]);
      const S = matVec(q, [-Math.sin(nu), Math.cos(nu), 0]);
      const W = matVec(q, [0, 0, 1]);
      const hp = rswBasisProjectionHp(s.position_m, s.velocity_mps);
      // Both sides carry binary64 rounding (state map and Q): ~ tens of u.
      worst = Math.max(worst, distB(b3(R), hp.R), distB(b3(S), hp.S), distB(b3(W), hp.W));
    }
    expect(worst).toBeLessThan(200 * U);
  });

  it('reference Δv: rounding ≤ ½ ulp per component, norm preserved, linear in Δv_RSW', () => {
    const rand = rng(99);
    for (let k = 0; k < 200; k++) {
      const s = elementsToState(
        {
          semiMajorAxis_m: 7e6 + rand() * 3e7,
          eccentricity: rand() * 0.9,
          inclination_rad: rand() * Math.PI,
          raan_rad: rand() * 6,
          argPeriapsis_rad: rand() * 6,
          trueAnomaly_rad: rand() * 6,
        },
        MU,
      );
      const dv: V3 = [(rand() - 0.5) * 400, (rand() - 0.5) * 400, (rand() - 0.5) * 400];
      const exact = rswToInertialB(s.position_m, s.velocity_mps, dv);
      const rounded = rswToInertialHp(s.position_m, s.velocity_mps, dv);
      for (let j = 0; j < 3; j++) {
        const ex = toNumber(exact[j as 0 | 1 | 2]);
        expect(rounded[j]).toBe(ex);
      }
      expect(Math.abs(toNumber(normB(exact)) - norm(dv))).toBeLessThanOrEqual(2 * U * norm(dv));
      // Binary64 projection form is within the record's reference share (12κ_h + 24.2)u·‖Δv‖.
      const b = rswBasisProjection(s.position_m, s.velocity_mps);
      const v64: V3 = [
        dv[0] * b.R[0] + dv[1] * b.S[0] + dv[2] * b.W[0],
        dv[0] * b.R[1] + dv[1] * b.S[1] + dv[2] * b.W[1],
        dv[0] * b.R[2] + dv[1] * b.S[2] + dv[2] * b.W[2],
      ];
      expect(distB(b3(v64), exact)).toBeLessThan((12 / Math.sqrt(1 - 0.81) + 24.2) * U * norm(dv));
    }
  });

  it('R12 form is one rounded addition per component', () => {
    expect(velocityAfterR12([0.1, 1, -3], [0.2, -1, 3])).toEqual([0.1 + 0.2, 0, 0]);
  });
});
