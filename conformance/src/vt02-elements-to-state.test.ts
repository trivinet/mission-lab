/**
 * VT-02 Elements → Cartesian (ML-FR-003 AC1) — engine `elementsToState` against the L2c datasets
 * of test-data/reference-cases/vt-02 with the tolerance stored in each dataset
 * (tolerances.md §7 VT-02). Evidence layer: L2c only (L3 Orekit pending, ML-TASK-012; O-7).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { elementsToState } from '@mission-lab/astrodynamics';
import { loadFamily, type Vt02Dataset } from './support/datasets';
import { diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';

const datasets = loadFamily('vt-02').map((d) => ({ file: d.file, data: d.data as Vt02Dataset }));
const ratios = new RatioRecorder('VT-02');

afterAll(() => {
  console.log(ratios.summary());
});

describe('VT-02 elements → state vs L2c', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const { elements, constants } = data.inputs;
    const result = elementsToState(elements, constants.mu_m3ps2);
    if (!result.ok) {
      expect.fail(`${file}: engine returned ${result.reason}`);
    }
    const dr = diffNorm(result.state.position_m, data.outputs.position_m);
    const dv = diffNorm(result.state.velocity_mps, data.outputs.velocity_mps);
    ratios.record('position', dr, data.tolerance.position_m, file);
    ratios.record('velocity', dv, data.tolerance.velocity_mps, file);
    const report =
      `${file}: inputs ${JSON.stringify(elements)} μ=${String(constants.mu_m3ps2)}\n` +
      `  position expected ${fmtV(data.outputs.position_m)} actual ${fmtV(result.state.position_m)}\n` +
      `  |Δr| ${fmt(dr)} m, tol ${fmt(data.tolerance.position_m)} m\n` +
      `  velocity expected ${fmtV(data.outputs.velocity_mps)} actual ${fmtV(result.state.velocity_mps)}\n` +
      `  |Δv| ${fmt(dv)} m/s, tol ${fmt(data.tolerance.velocity_mps)} m/s`;
    expect(dr <= data.tolerance.position_m, report).toBe(true);
    expect(dv <= data.tolerance.velocity_mps, report).toBe(true);
  });
});
