/**
 * VT-06 energy and VT-07 angular-momentum conservation (ML-FR-004 AC2) on every sample of full
 * runSimulation coast runs over the grid cases, with the per-sample tolerances committed in
 * test-data/reference-cases/vt-06-07 (tolerances.md §7 VT-06, VT-07; phase 1).
 * E = v²/2 − μ/r and h = r × v are evaluated by the test in binary64 (their rounding is in the
 * record's budgets).
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily } from './support/datasets';
import { cross3, dot3, firstBitDifference, norm3, runRequest, samplesOf } from './support/run';

interface Vt0607 {
  readonly inputs: { readonly request: SimulationRequest };
  readonly outputs: { readonly t_s: readonly number[] };
  readonly tolerance: {
    readonly energy_rel: readonly number[];
    readonly angularMomentum_rel: readonly number[];
  };
}

const datasets = loadFamily('vt-06-07').map((d) => ({ file: d.file, data: d.data as Vt0607 }));
const ratios = new RatioRecorder('VT-06/VT-07');

afterAll(() => {
  console.log(ratios.summary());
});

describe('VT-06 / VT-07 invariants on every sample', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const samples = samplesOf(result);
    expect(
      firstBitDifference(
        samples.map((s) => s.t),
        data.outputs.t_s,
      ),
    ).toBeNull();
    const s0 = samples[0];
    if (s0 === undefined) throw new Error('no samples');
    const energy = (r: typeof s0.r, v: typeof s0.v): number => dot3(v, v) / 2 - mu / norm3(r);
    const E0 = energy(s0.r, s0.v);
    const h0 = cross3(s0.r, s0.v);
    const h0n = norm3(h0);
    const failures: string[] = [];
    samples.forEach((s, k) => {
      const dE = Math.abs(energy(s.r, s.v) - E0) / Math.abs(E0);
      const h = cross3(s.r, s.v);
      const dh = norm3([h[0] - h0[0], h[1] - h0[1], h[2] - h0[2]]) / h0n;
      const tE = data.tolerance.energy_rel[k] ?? NaN;
      const tH = data.tolerance.angularMomentum_rel[k] ?? NaN;
      const where = `${file} k=${String(k)} t=${String(s.t)}`;
      const rE = ratios.record('energy (VT-06)', dE, tE, where);
      const rH = ratios.record('angular momentum (VT-07)', dh, tH, where);
      if (!(dE <= tE) || !(dh <= tH)) {
        failures.push(
          `${where}: dE ${dE.toExponential(3)} tol ${tE.toExponential(3)} (×${rE.toPrecision(3)}); dh ${dh.toExponential(3)} tol ${tH.toExponential(3)} (×${rH.toPrecision(3)})`,
        );
      }
    });
    expect(failures, file).toEqual([]);
  });
});
