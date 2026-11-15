/**
 * VT-05 propagation vs L3 Orekit (ML-FR-004 AC1; ML-TASK-018 part D2). `runSimulation` on each
 * Orekit request (requestId added) against Orekit's KeplerianPropagator samples
 * (test-data/l3-orekit/vt-05), per-sample tolerance 3M·P_E(t), 3M·V_E(t) of tolerances.md §9.3
 * read from test-data/reference-cases/l3-r4-vt-05. The sample times must equal Orekit's
 * bit-for-bit (§5.2 grid) and sample 0 must equal initialState (§1). Asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';
import type { V3 } from './support/datasets';
import { loadL3, numArray, obj, withRequestId } from './support/l3';
import { runRequest, segmentSamples } from './support/run';

interface L3Vt05 {
  readonly inputs: { readonly requestBody: Omit<SimulationRequest, 'requestId'> };
  readonly outputs: {
    readonly t_s: readonly number[];
    readonly position_m: readonly V3[];
    readonly velocity_mps: readonly V3[];
  };
}

const cases = loadL3<L3Vt05>('vt-05');
const ratios = new RatioRecorder('L3 VT-05 (asserted)');

afterAll(() => {
  console.log(ratios.summary());
});

describe('L3 VT-05 runSimulation vs Orekit KeplerianPropagator', () => {
  it('covers the nine grid cases', () => {
    expect(cases).toHaveLength(9);
  });
  it.each(cases)('$file', ({ file, data, tol }) => {
    const t = obj(tol.tolerance);
    const tolR = numArray(t.position_m);
    const tolV = numArray(t.velocity_mps);
    const req = withRequestId(data.inputs.requestBody);
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const seg = segmentSamples(result, 0);
    const ts = data.outputs.t_s;
    expect(seg.length, `${file}: sample count`).toBe(ts.length);
    const failures: string[] = [];
    seg.forEach((s, k) => {
      if (!Object.is(s.t, ts[k]))
        failures.push(`k=${String(k)}: t_s ${String(s.t)} vs ${String(ts[k])}`);
    });
    const s0 = seg[0];
    if (s0 === undefined) throw new Error('no sample');
    expect(bitIdentical(s0.r, req.initialState.position_m), `${file}: sample 0 position`).toBe(
      true,
    );
    expect(bitIdentical(s0.v, req.initialState.velocity_mps), `${file}: sample 0 velocity`).toBe(
      true,
    );
    for (let k = 1; k < seg.length; k++) {
      const s = seg[k];
      const rRef = data.outputs.position_m[k];
      const vRef = data.outputs.velocity_mps[k];
      if (s === undefined || rRef === undefined || vRef === undefined) {
        failures.push(`k=${String(k)}: missing`);
        continue;
      }
      const dr = diffNorm(s.r, rRef);
      const dv = diffNorm(s.v, vRef);
      const tr = tolR[k] ?? NaN;
      const tv = tolV[k] ?? NaN;
      const where = `${file} k=${String(k)} t=${String(s.t)}`;
      const qr = ratios.record('position', dr, tr, where);
      const qv = ratios.record('velocity', dv, tv, where);
      if (!(dr <= tr) || !(dv <= tv)) {
        failures.push(
          `${where}: |Δr| ${fmt(dr)} tol ${fmt(tr)} (×${qr.toPrecision(3)}), |Δv| ${fmt(dv)} tol ${fmt(tv)} (×${qv.toPrecision(3)}); engine r ${fmtV(s.r)} Orekit r ${fmtV(rRef)}`,
        );
      }
    }
    expect(failures, file).toEqual([]);
  });
});
