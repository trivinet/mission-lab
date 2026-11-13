import { it } from 'vitest';
import { GRID } from '../datasets/cases';
import { elementsToState } from '../ref/elements';
import { prepareL2a, propagateL2a } from '../ref/kepler';
import { rk4WithHalving } from '../ref/rk';
import { dist } from '../ref/vec';
import { scales, l2aVsL2b } from '../tol/tolerances';
const MU = 3.986004418e14;
it('explore', () => {
  for (const g of GRID) {
    const s0 = elementsToState(g.elements, MU);
    const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
    const H = Math.round(sc.T / 16);
    for (const spo of g.id.startsWith('c5') ? [1024, 2048, 4096, 8192] : [256, 512, 1024]) {
      const t0 = Date.now();
      const rk = rk4WithHalving(s0, MU, H / spo, spo, 160);
      const p = prepareL2a(s0, MU);
      let maxE = 0,
        nonAs = 0,
        worst = 0,
        maxD = 0;
      rk.forEach((x, k) => {
        maxE = Math.max(maxE, x.eRk_r / sc.ra);
        if (k > 0 && (!x.asymptotic_r || !x.asymptotic_v)) nonAs++;
        const a = propagateL2a(p, k * H).state;
        const d = dist(a.position_m, x.state.position_m);
        const tol = l2aVsL2b(sc, k * H, x.eRk_r, x.eRk_v).position_m;
        worst = Math.max(worst, d / tol);
        maxD = Math.max(maxD, d / sc.ra);
      });
      console.log(
        g.id,
        'H',
        H,
        'spo',
        spo,
        'maxE_RK/ra',
        maxE.toExponential(2),
        'nonAsym',
        nonAs,
        'maxL2a-L2b/ra',
        maxD.toExponential(2),
        'worst ratio',
        worst.toFixed(3),
        'ms',
        Date.now() - t0,
      );
    }
  }
}, 600000);
