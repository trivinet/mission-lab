/**
 * Self-tests of the 200-bit hyperbolic reference (ref/hyperbolic.ts), before it is used to validate
 * L2b: invariants along the arc, the defining Kepler equation, the binary64 anomaly solver of the
 * tolerance evaluation (tolerances-r4.ts), and agreement with an independent method (RK4).
 */
import { describe, expect, it } from 'vitest';
import { toNumber } from '../hp/bigfloat';
import { crossB, dotB, normB, toV3 } from '../hp/hp-vec';
import { hyperbolicAt, prepareHyperbolicArc } from '../tol/tolerances-r4';
import { hypDeltaF, hypPrepare, hypPropagate } from './hyperbolic';
import { integrateRK4 } from './rk';
import type { V3 } from './vec';

const MU = 3.986004418e14;
// Hyperbolic test states: departing from periapsis, inbound through periapsis, outbound.
const STATES: { r: V3; v: V3 }[] = [
  { r: [7.0e6, 0, 0], v: [0, 11546, 0] },
  { r: [3.0e7, 1.0e7, -2.0e6], v: [-6000, 300, 500] },
  { r: [-8.0e6, 5.0e6, 1.0e6], v: [6000, 8000, -2000] },
];

describe('200-bit hyperbolic reference', () => {
  it('conserves energy and angular momentum to working precision and starts at the input state', () => {
    for (const s of STATES) {
      const pr = hypPrepare(s.r, s.v, MU);
      const s0 = hypPropagate(pr, 0);
      // Reconstructed in 200-bit and rounded once: equal to the binary64 input.
      expect(toV3(s0.position_m)).toEqual([...s.r]);
      const vv = toV3(s0.velocity_mps);
      vv.forEach((x, i) => {
        expect(Math.abs(x - (s.v[i] ?? 0))).toBeLessThanOrEqual(1e-12 * Math.abs(s.v[i] ?? 1));
      });
      const e0 = toNumber(dotB(s0.velocity_mps, s0.velocity_mps)) / 2 - MU / toNumber(s0.r);
      const h0 = toNumber(normB(crossB(s0.position_m, s0.velocity_mps)));
      for (const dt of [60, 1000, 6000, 20000]) {
        const st = hypPropagate(pr, dt);
        const r = toNumber(normB(st.position_m));
        const e = toNumber(dotB(st.velocity_mps, st.velocity_mps)) / 2 - MU / r;
        const h = toNumber(normB(crossB(st.position_m, st.velocity_mps)));
        expect(Math.abs(e - e0) / Math.abs(e0)).toBeLessThan(1e-30 + 1e-15);
        expect(Math.abs(h - h0) / h0).toBeLessThan(1e-15);
        expect(Math.abs(r - toNumber(st.r)) / r).toBeLessThan(1e-15);
      }
    }
  });

  it('binary64 anomaly solver of the tolerance evaluation agrees with the 200-bit solve', () => {
    for (const s of STATES) {
      const pr = hypPrepare(s.r, s.v, MU);
      const arc = prepareHyperbolicArc(MU, s.r, s.v, 20000);
      for (const dt of [60, 1000, 6000, 20000]) {
        const x = hyperbolicAt(arc, dt).x;
        expect(Math.abs(x - hypDeltaF(pr, dt))).toBeLessThan(1e-12);
      }
    }
  });

  it('agrees with RK4 (independent method) to the RK truncation level', () => {
    for (const s of STATES) {
      const pr = hypPrepare(s.r, s.v, MU);
      const rk = integrateRK4({ position_m: s.r, velocity_mps: s.v }, MU, 0.25, 4 * 6000, 4 * 600);
      rk.forEach((st, k) => {
        const ref = hypPropagate(pr, 600 * k);
        const rr = toV3(ref.position_m);
        const d = Math.hypot(
          st.position_m[0] - rr[0],
          st.position_m[1] - rr[1],
          st.position_m[2] - rr[2],
        );
        expect(d, `k=${String(k)}`).toBeLessThan(1e-4);
      });
    }
  });
});
