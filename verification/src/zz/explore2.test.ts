import { it } from 'vitest';
import { GRID } from '../datasets/cases';
import { elementsToState } from '../ref/elements';
import { prepareL2a, propagateL2a } from '../ref/kepler';
import { rk4WithHalving } from '../ref/rk';
import { hpPrepare, hpPropagate, hpDist, keplerResidual } from '../hp/hp-kepler';
import { scales, pA, vA, dtA } from '../tol/tolerances';
const MU = 3.986004418e14;
const SPO: Record<string, number> = { c3: 512, c4: 512, c5: 2048 };
it('explore2', () => {
  for (const g of GRID) {
    const s0 = elementsToState(g.elements, MU);
    const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
    const H = Math.round(sc.T / 16);
    const spo = SPO[g.id.slice(0, 2)] ?? 256;
    const rk = rk4WithHalving(s0, MU, H / spo, spo, 160);
    const p = prepareL2a(s0, MU);
    let t0 = Date.now();
    const hp = hpPrepare(s0.position_m, s0.velocity_mps, MU);
    let wA = 0,
      wAv = 0,
      wRes = 0,
      wRk = 0,
      wRkv = 0,
      maxRkRatio = 0;
    for (let k = 0; k <= 160; k += 8) {
      const dt = k * H;
      const a = propagateL2a(p, dt);
      const x = hpPropagate(hp, dt);
      wA = Math.max(wA, hpDist(a.state.position_m, x.position_m) / pA(sc, dt));
      wAv = Math.max(wAv, hpDist(a.state.velocity_mps, x.velocity_mps) / vA(sc, dt));
      const res = keplerResidual(a.trace.E, a.trace.e, a.trace.M0, a.trace.n, dt) / a.trace.n;
      wRes = Math.max(wRes, res / dtA(sc, dt));
      const r = rk[k]!;
      if (k > 0) {
        wRk = Math.max(wRk, hpDist(r.state.position_m, x.position_m) / r.eRk_r);
        wRkv = Math.max(wRkv, hpDist(r.state.velocity_mps, x.velocity_mps) / r.eRk_v);
      }
    }
    console.log(
      g.id,
      'L2a/P_A',
      wA.toExponential(2),
      'L2a/V_A',
      wAv.toExponential(2),
      'res/dtA',
      wRes.toExponential(2),
      'RKerr/E_RK r',
      wRk.toFixed(3),
      'v',
      wRkv.toFixed(3),
      'ms',
      Date.now() - t0,
    );
  }
}, 600000);
