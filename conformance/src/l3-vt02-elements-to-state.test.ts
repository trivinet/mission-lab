/**
 * VT-02 Elements → Cartesian vs L3 Orekit (ML-FR-003 AC1; ML-TASK-018 part D2). Engine
 * `elementsToState` against Orekit's KeplerianOrbit element→state (test-data/l3-orekit/vt-02) with
 * the revision-4 row of tolerances.md §9.3.1: ‖Δr‖ ≤ 3M·η_r(e)·u·r_a, ‖Δv‖ ≤ 3M·η_v(e)·u·v_p,
 * read from test-data/reference-cases/l3-r4-vt-02 (the values stored in the Orekit files are not
 * used, record C-8). Asserted.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { elementsToState } from '@mission-lab/astrodynamics';
import { diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';
import type { ConstantsJson, ElementsJson, StateJson } from './support/datasets';
import { loadL3, num, obj } from './support/l3';

interface L3Vt02 {
  readonly inputs: { readonly constants: ConstantsJson; readonly elements: ElementsJson };
  readonly outputs: StateJson;
}

const cases = loadL3<L3Vt02>('vt-02');
const ratios = new RatioRecorder('L3 VT-02 (asserted)');

afterAll(() => {
  console.log(ratios.summary());
});

describe('L3 VT-02 elements → state vs Orekit', () => {
  it('covers the nine grid cases', () => {
    expect(cases).toHaveLength(9);
  });
  it.each(cases)('$file', ({ file, data, tol }) => {
    const t = obj(tol.tolerance);
    const tolR = num(t.position_m);
    const tolV = num(t.velocity_mps);
    const res = elementsToState(data.inputs.elements, data.inputs.constants.mu_m3ps2);
    if (!res.ok) expect.fail(`${file}: engine returned ${res.reason}`);
    const dr = diffNorm(res.state.position_m, data.outputs.position_m);
    const dv = diffNorm(res.state.velocity_mps, data.outputs.velocity_mps);
    ratios.record('position', dr, tolR, file);
    ratios.record('velocity', dv, tolV, file);
    const report =
      `${file}: inputs ${JSON.stringify(data.inputs.elements)}\n` +
      `  position Orekit ${fmtV(data.outputs.position_m)} engine ${fmtV(res.state.position_m)} |Δr| ${fmt(dr)} tol ${fmt(tolR)}\n` +
      `  velocity Orekit ${fmtV(data.outputs.velocity_mps)} engine ${fmtV(res.state.velocity_mps)} |Δv| ${fmt(dv)} tol ${fmt(tolV)}`;
    expect(dr <= tolR, report).toBe(true);
    expect(dv <= tolV, report).toBe(true);
  });
});
