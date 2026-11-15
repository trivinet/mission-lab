/**
 * Self-validation of the post-maneuver closed forms and the VT-16 classification reference
 * (ML-TASK-018 part C), before any engine comparison. Independent cross-checks:
 * - conic of an L2c state reproduces its elements (a, e, r_p);
 * - the RSW-coordinate closed form equals the conic of the explicit post-maneuver vector
 *   v⁺ = v + Δv_I (Δv_I from the 320-bit RSW reference), i.e. two different evaluation paths;
 * - tangential burn at an apsis equals the vis-viva form of tolerances.md §7 VT-15;
 * - a pure normal burn rotates the plane by atan2(ΔvW, v_s) about R (angle between h⁻ and h⁺);
 * - timeToRadius agrees with an RK4 integration (radius above the sphere just before t_c, below
 *   just after), for elliptic and hyperbolic arcs.
 */
import { describe, expect, it } from 'vitest';
import { b3, crossB, normB, scaleB, addB, toV3 } from '../hp/hp-vec';
import { div, mul, toNumber } from '../hp/bigfloat';
import { elementsToState } from './elements';
import { conicOfState, postManeuverClosedForm, timeToRadius, classifyVt16 } from './maneuver';
import { integrateRK4 } from './rk';
import { rswBasisProjectionHp, rswToInertialB } from './rsw';
import { norm, type V3 } from './vec';

const MU = 3.986004418e14;
const R_REF = 6378137;

function state(a: number, e: number, i: number, raan: number, argp: number, nu: number) {
  return elementsToState(
    {
      semiMajorAxis_m: a,
      eccentricity: e,
      inclination_rad: i,
      raan_rad: raan,
      argPeriapsis_rad: argp,
      trueAnomaly_rad: nu,
    },
    MU,
  );
}

function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b);
}

describe('post-maneuver closed forms', () => {
  it('conic of an L2c state reproduces a, e, r_p', () => {
    for (const [a, e] of [
      [7e6, 0],
      [1.2e7, 0.4],
      [2.6e7, 0.74],
    ] as const) {
      const s = state(a, e, 0.5, 2.5, 4.0, 1.3);
      const c = conicOfState(MU, s.position_m, s.velocity_mps);
      expect(rel(c.semiMajorAxis_m, a)).toBeLessThan(1e-13);
      expect(Math.abs(c.eccentricity - e)).toBeLessThan(1e-13);
      expect(rel(c.periapsisRadius_m, a * (1 - e))).toBeLessThan(1e-13);
    }
  });

  it('RSW-coordinate closed form equals the conic of the explicit post-maneuver vector', () => {
    const cases: [V3, ReturnType<typeof state>][] = [
      [[50, -120, 30], state(1.2e7, 0.4, 0.5, 2.5, 4.0, 5.5)],
      [[0, 0, 200], state(7e6, 0, 0.9, 1.2, 0, 0.3)],
      [[-6000, 2000, 0], state(7e6, 0, 0.9, 1.2, 0, 0.3)],
      [[0, 4000, 0], state(2.6e7, 0.74, 1.1, 4.2, 4.7, 0.2)],
    ];
    for (const [dv, s] of cases) {
      const cf = postManeuverClosedForm(MU, s.position_m, s.velocity_mps, dv);
      const dvI = rswToInertialB(s.position_m, s.velocity_mps, dv);
      const vPlus = addB(b3(s.velocity_mps), dvI);
      // Conic of (r, v⁺) with v⁺ in 320 bits: compare a, e, r_p via an explicit evaluation.
      const vPlus64 = toV3(vPlus);
      const c = conicOfState(MU, s.position_m, vPlus64);
      // vPlus64 carries ½ ulp rounding; compare at 1e-12 relative.
      expect(rel(c.energy_Jpkg, cf.energy_Jpkg)).toBeLessThan(1e-12);
      expect(Math.abs(c.eccentricity - cf.eccentricity)).toBeLessThan(1e-12);
      expect(rel(c.periapsisRadius_m, cf.periapsisRadius_m)).toBeLessThan(1e-12);
      expect(Math.sign(c.rDotV_m2ps)).toBe(Math.sign(cf.rDotV_m2ps));
    }
  });

  it('tangential burn at an apsis equals the vis-viva closed form (§7 VT-15)', () => {
    for (const nu of [0, Math.PI]) {
      const s = state(1.2e7, 0.4, 0.5, 2.5, 4.0, nu);
      const dv = 100;
      const cf = postManeuverClosedForm(MU, s.position_m, s.velocity_mps, [0, dv, 0]);
      const r = norm(s.position_m);
      const v = norm(s.velocity_mps);
      const aPlus = 1 / (2 / r - ((v + dv) * (v + dv)) / MU);
      expect(rel(cf.semiMajorAxis_m, aPlus)).toBeLessThan(1e-13);
      expect(Math.abs(cf.eccentricity - Math.abs(1 - r / aPlus))).toBeLessThan(1e-13);
    }
  });

  it('pure normal burn rotates the orbit plane by atan2(ΔvW, v_s) about R', () => {
    const s = state(1.2e7, 0.4, 0.5, 2.5, 4.0, 1.0);
    const dvW = 300;
    const cf = postManeuverClosedForm(MU, s.position_m, s.velocity_mps, [0, 0, dvW]);
    const r = b3(s.position_m);
    const v = b3(s.velocity_mps);
    const { W } = rswBasisProjectionHp(s.position_m, s.velocity_mps);
    const vPlus = addB(v, scaleB(b3([dvW, 0, 0])[0], W));
    const h0 = crossB(r, v);
    const h1 = crossB(r, vPlus);
    const sinAngle = toNumber(div(normB(crossB(h0, h1)), mul(normB(h0), normB(h1))));
    expect(Math.abs(Math.sin(cf.planeRotation_rad) - sinAngle)).toBeLessThan(1e-15);
    expect(cf.planeRotation_rad).toBeCloseTo(Math.atan2(dvW, cf.vTransverse_mps), 15);
  });
});

describe('time to the reference sphere (VT-16 classification reference)', () => {
  function radiusAt(s0: { position_m: V3; velocity_mps: V3 }, t: number): number {
    const steps = Math.max(2000, Math.ceil(t / 0.05));
    const out = integrateRK4(s0, MU, t / steps, steps, steps);
    const last = out[out.length - 1];
    if (last === undefined) throw new Error('rk');
    return norm(last.position_m);
  }

  const c1 = state(7e6, 0, 0.9, 1.2, 0, 0.3);
  const post = (dv: V3) => {
    const dvI = toV3(rswToInertialB(c1.position_m, c1.velocity_mps, dv));
    const v: V3 = [
      c1.velocity_mps[0] + dvI[0],
      c1.velocity_mps[1] + dvI[1],
      c1.velocity_mps[2] + dvI[2],
    ];
    return { position_m: c1.position_m, velocity_mps: v };
  };

  for (const [label, dv] of [
    ['elliptic retro burn (from apoapsis)', [0, -400, 0]],
    ['elliptic outbound, low periapsis', [1500, -1200, 0]],
    ['hyperbolic inbound', [-6000, 2000, 0]],
  ] as const) {
    it(`${label}: crossing time confirmed by RK4`, () => {
      const s = post(dv);
      const c = conicOfState(MU, s.position_m, s.velocity_mps);
      const tc = timeToRadius(MU, c, R_REF);
      expect(Number.isFinite(tc)).toBe(true);
      expect(radiusAt(s, tc * (1 - 1e-4))).toBeGreaterThan(R_REF);
      expect(radiusAt(s, tc * (1 + 1e-4))).toBeLessThan(R_REF);
    });
  }

  it('outbound hyperbola and high periapsis never reach the sphere', () => {
    const s = post([6000, 2000, 0]);
    const c = conicOfState(MU, s.position_m, s.velocity_mps);
    expect(c.periapsisRadius_m).toBeLessThan(R_REF);
    expect(timeToRadius(MU, c, R_REF)).toBe(Infinity);
    const s2 = post([0, 100, 0]);
    expect(timeToRadius(MU, conicOfState(MU, s2.position_m, s2.velocity_mps), R_REF)).toBe(
      Infinity,
    );
  });

  it('classification uses an inclusive span', () => {
    const s = post([0, -400, 0]);
    const c = conicOfState(MU, s.position_m, s.velocity_mps);
    const tc = timeToRadius(MU, c, R_REF);
    expect(classifyVt16(MU, R_REF, c, tc).referenceSphereIntersection).toBe(true);
    expect(classifyVt16(MU, R_REF, c, tc * 0.9).referenceSphereIntersection).toBe(false);
    expect(classifyVt16(MU, R_REF, c, tc * 0.9).escape).toBe(false);
  });
});
