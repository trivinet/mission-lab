/**
 * Validation of the L2a reference (tolerance record §6.4, §9.1) and of the L2b reference
 * (§9.2), and the reference-vs-reference cross-check L2a vs L2b. No engine is involved.
 *
 * Bounds used (all from docs/verification/tolerances.md, evaluated at each case's own scale):
 * - Kepler residual of the returned E, evaluated exactly (200-bit) and converted to time
 *   (÷ n): ≤ δt_A(Δt) (§6.4; §9.1 "records the maximum against δt_A"). No margin: it is the
 *   reference's own budget.
 * - L2a state vs the same algorithm in 200-bit arithmetic: ‖Δr‖ ≤ P_A(Δt), ‖Δv‖ ≤ V_A(Δt)
 *   (§6.4, unmargined): this is the confirmation of the L2a bound that the record asks for.
 * - L2b actual error (vs 200-bit L2a) ≤ 2E_RK (§7 VT-05 uses 2E_RK for the RK reference).
 * - L2a vs L2b: ‖Δr‖ ≤ M·P_A + 2E_RK,r, ‖Δv‖ ≤ M·V_A + 2E_RK,v (§9.1).
 */
import { describe, expect, it } from 'vitest';
import { GRID } from '../datasets/cases';
import { hpDist, hpPrepare, hpPropagate, keplerResidual } from '../hp/hp-kepler';
import { dtA, l2aVsL2b, pA, scales, vA } from '../tol/tolerances';
import { elementsToState, type Elements } from './elements';
import { prepareL2a, propagateL2a, solveKepler } from './kepler';
import { RK_ORDER, rk4WithHalving } from './rk';
import { dist } from './vec';
import { rkPlan } from '../datasets/plan';

const MU = 3.986004418e14;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

describe('L2a Kepler solver', () => {
  it('returns E within the stated step criterion and with an exact residual inside δt_A', () => {
    // Direct solver test over M ∈ [−700, 700] rad and e ∈ [0, 0.99].
    const r = rng(21);
    for (let k = 0; k < 3000; k++) {
      const e = k % 10 === 0 ? 0 : 0.99 * r();
      const M = (r() - 0.5) * 1400;
      const { E, iterations } = solveKepler(M, e);
      expect(iterations).toBeLessThan(100);
      // Mean-anomaly residual budget of §6.4 for this M: u(4|M| + 6π + 4e) noise, ×2 plus the
      // spacing term u(1 + e)|E| (same floor argument as §6.1).
      const u = 2 ** -53;
      const budget = 2 * u * (4 * Math.abs(M) + 6 * Math.PI + 4 * e) + u * (1 + e) * Math.abs(E);
      expect(keplerResidual(E, e, M, 0, 0)).toBeLessThanOrEqual(budget);
    }
  });
});

function randomElements(r: () => number): Elements {
  const e = 0.95 * r();
  const rp = 6.6e6 + 3e7 * r();
  return {
    semiMajorAxis_m: rp / (1 - e),
    eccentricity: e,
    inclination_rad: Math.PI * r(),
    raan_rad: 2 * Math.PI * r(),
    argPeriapsis_rad: 2 * Math.PI * r(),
    trueAnomaly_rad: 2 * Math.PI * r(),
  };
}

describe('L2a against its own algorithm in 200-bit arithmetic (confirms the §6.4 bound)', () => {
  it('stays within P_A, V_A and δt_A on the grid (every 4th sample over ≈10 periods)', () => {
    for (const g of GRID) {
      const s0 = elementsToState(g.elements, MU);
      const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
      const plan = rkPlan(g.id, sc.T);
      const p = prepareL2a(s0, MU);
      const hp = hpPrepare(s0.position_m, s0.velocity_mps, MU);
      for (let k = 0; k <= plan.nOut; k += 4) {
        const dt = k * plan.outputStep_s;
        const a = propagateL2a(p, dt);
        const x = hpPropagate(hp, dt);
        expect(hpDist(a.state.position_m, x.position_m), g.id).toBeLessThanOrEqual(pA(sc, dt));
        expect(hpDist(a.state.velocity_mps, x.velocity_mps), g.id).toBeLessThanOrEqual(vA(sc, dt));
        const res = keplerResidual(a.trace.E, a.trace.e, a.trace.M0, a.trace.n, dt) / a.trace.n;
        expect(res, g.id).toBeLessThanOrEqual(dtA(sc, dt));
      }
    }
  });

  it('stays within P_A, V_A and δt_A on random orbits (e ≤ 0.95, |Δt| ≤ 100 periods)', () => {
    const r = rng(22);
    for (let k = 0; k < 150; k++) {
      const el = randomElements(r);
      const s0 = elementsToState(el, MU);
      const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
      const dt = (r() - 0.5) * 200 * sc.T;
      const p = prepareL2a(s0, MU);
      const a = propagateL2a(p, dt);
      const x = hpPropagate(hpPrepare(s0.position_m, s0.velocity_mps, MU), dt);
      expect(hpDist(a.state.position_m, x.position_m)).toBeLessThanOrEqual(pA(sc, dt));
      expect(hpDist(a.state.velocity_mps, x.velocity_mps)).toBeLessThanOrEqual(vA(sc, dt));
      const res = keplerResidual(a.trace.E, a.trace.e, a.trace.M0, a.trace.n, dt) / a.trace.n;
      expect(res).toBeLessThanOrEqual(dtA(sc, dt));
    }
  });
});

describe('L2b fixed-step RK4 with step halving (§9.2)', () => {
  it('converges with order 4 and its E_RK bounds its actual error on the grid', () => {
    for (const g of GRID) {
      const s0 = elementsToState(g.elements, MU);
      const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
      const plan = rkPlan(g.id, sc.T);
      const rk = rk4WithHalving(s0, MU, plan.rkStep_s, plan.stepsPerOutput, plan.nOut);
      const hp = hpPrepare(s0.position_m, s0.velocity_mps, MU);
      for (let k = 1; k <= plan.nOut; k++) {
        const smp = rk[k];
        if (smp === undefined) throw new Error('index');
        // Every compared time is in the asymptotic regime (ratio test of §9.2).
        expect(smp.asymptotic_r && smp.asymptotic_v, `${g.id} k=${String(k)}`).toBe(true);
        expect(smp.d1_r / smp.d2_r).toBeGreaterThanOrEqual(2 ** (RK_ORDER - 1));
        // §9.2 target E_RK ≤ 1e-10 r_max.
        expect(smp.eRk_r).toBeLessThanOrEqual(1e-10 * sc.ra);
        if (k % 4 === 0) {
          const x = hpPropagate(hp, k * plan.outputStep_s);
          expect(hpDist(smp.state.position_m, x.position_m)).toBeLessThanOrEqual(2 * smp.eRk_r);
          expect(hpDist(smp.state.velocity_mps, x.velocity_mps)).toBeLessThanOrEqual(2 * smp.eRk_v);
        }
      }
    }
  });

  it('agrees with L2a within M·P_A + 2E_RK on the grid (reference-vs-reference, §9.1)', () => {
    for (const g of GRID) {
      const s0 = elementsToState(g.elements, MU);
      const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
      const plan = rkPlan(g.id, sc.T);
      const rk = rk4WithHalving(s0, MU, plan.rkStep_s, plan.stepsPerOutput, plan.nOut);
      const p = prepareL2a(s0, MU);
      for (let k = 0; k <= plan.nOut; k++) {
        const smp = rk[k];
        if (smp === undefined) throw new Error('index');
        const dt = k * plan.outputStep_s;
        const a = propagateL2a(p, dt).state;
        const tol = l2aVsL2b(sc, dt, smp.eRk_r, smp.eRk_v);
        expect(dist(a.position_m, smp.state.position_m), g.id).toBeLessThanOrEqual(tol.position_m);
        expect(dist(a.velocity_mps, smp.state.velocity_mps), g.id).toBeLessThanOrEqual(
          tol.velocity_mps,
        );
      }
    }
  });
});
