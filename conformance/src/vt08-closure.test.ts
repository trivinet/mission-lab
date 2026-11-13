/**
 * VT-08 Full-period closure (ML-FR-004 AC3) — engine `propagateKeplerUniversal` from the
 * request's initial state over Δt = request.duration_s (= N·T computed by the dataset, binary64),
 * against the initial state (L1, exact) with the tolerance stored in each dataset
 * (tolerances.md §7 VT-08).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { propagateKeplerUniversal } from '@mission-lab/astrodynamics';
import { loadFamily, type Vt08Dataset } from './support/datasets';
import { diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';

const datasets = loadFamily('vt-08').map((d) => ({ file: d.file, data: d.data as Vt08Dataset }));
const ratios = new RatioRecorder('VT-08');

afterAll(() => {
  console.log(ratios.summary());
});

describe('VT-08 closure after N periods (L1)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const { constants, initialState, duration_s } = data.inputs.request;
    const r = propagateKeplerUniversal(
      constants.mu_m3ps2,
      initialState.position_m,
      initialState.velocity_mps,
      duration_s,
    );
    if (!r.ok) {
      expect.fail(`${file}: engine returned ${r.reason}`);
    }
    const expected = data.outputs.finalExpected;
    const dr = diffNorm(r.position_m, expected.position_m);
    const dv = diffNorm(r.velocity_mps, expected.velocity_mps);
    const n = `N=${String(data.inputs.periods)}`;
    ratios.record(`position ${n}`, dr, data.tolerance.position_m, file);
    ratios.record(`velocity ${n}`, dv, data.tolerance.velocity_mps, file);
    const report =
      `${file}: Δt ${String(duration_s)} s\n` +
      `  expected ${fmtV(expected.position_m)} ${fmtV(expected.velocity_mps)}\n` +
      `  actual ${fmtV(r.position_m)} ${fmtV(r.velocity_mps)}\n` +
      `  |Δr| ${fmt(dr)} m (tol ${fmt(data.tolerance.position_m)}), ` +
      `|Δv| ${fmt(dv)} m/s (tol ${fmt(data.tolerance.velocity_mps)})`;
    expect(dr <= data.tolerance.position_m, report).toBe(true);
    expect(dv <= data.tolerance.velocity_mps, report).toBe(true);
  });
});
