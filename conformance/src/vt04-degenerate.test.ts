/**
 * VT-04 Degenerate elements (ML-FR-002 AC3, ML-FR-003 AC2; ADR-008) — engine `stateToElements`
 * with the approved thresholds ε_e = ε_i = 1e-5 passed explicitly, against the datasets of
 * test-data/reference-cases/vt-04:
 * - classification (circular / equatorial) exact against the L2c element view;
 * - e and i (always the computed values) against the L2c view with the stored absolute rows;
 * - round trip: engine element view → engine `elementsToState` (regular map) vs the input state,
 *   with the stored tolerance (numerical budget plus the convention term, §7 VT-04).
 * Not compared: the substitute angles (ϖ, λ, u): no approved tolerance exists (dataset
 * `tolerance.substituteAngles`). The retrograde flag of the dataset is not compared directly
 * (the engine reports no such flag); it is implied by i.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { elementsToState, stateToElements } from '@mission-lab/astrodynamics';
import { loadFamily, type Vt04Dataset } from './support/datasets';
import { diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';

const datasets = loadFamily('vt-04').map((d) => ({ file: d.file, data: d.data as Vt04Dataset }));
const ratios = new RatioRecorder('VT-04');

afterAll(() => {
  console.log(ratios.summary());
});

function engineView(data: Vt04Dataset) {
  const t = data.method.convention.thresholds;
  return stateToElements(data.inputs.state, data.inputs.constants.mu_m3ps2, {
    circularEccentricity: t.epsilon_e,
    equatorialInclination_rad: t.epsilon_i,
  });
}

describe('VT-04 classification and e, i vs L2c view', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const el = engineView(data);
    if (!el.ok) {
      expect.fail(`${file}: stateToElements returned ${el.reason}`);
    }
    const cls = data.outputs.classification;
    const engineCircular = el.convention === 'CIRCULAR' || el.convention === 'CIRCULAR_EQUATORIAL';
    const engineEquatorial =
      el.convention === 'EQUATORIAL' || el.convention === 'CIRCULAR_EQUATORIAL';
    const problems: string[] = [];
    if (engineCircular !== cls.circular || engineEquatorial !== cls.equatorial) {
      problems.push(
        `classification: expected circular=${String(cls.circular)} equatorial=${String(cls.equatorial)}, ` +
          `engine convention ${el.convention}`,
      );
    }
    const de = Math.abs(el.elements.eccentricity - data.outputs.elementView.eccentricity);
    const di = Math.abs(el.elements.inclination_rad - data.outputs.elementView.inclination_rad);
    ratios.record('eccentricity', de, data.tolerance.eccentricity_abs, file);
    ratios.record('inclination', di, data.tolerance.inclination_abs_rad, file);
    if (!(de <= data.tolerance.eccentricity_abs)) {
      problems.push(`e: |Δ| ${fmt(de)} > tol ${fmt(data.tolerance.eccentricity_abs)}`);
    }
    if (!(di <= data.tolerance.inclination_abs_rad)) {
      problems.push(`i: |Δ| ${fmt(di)} > tol ${fmt(data.tolerance.inclination_abs_rad)}`);
    }
    expect(
      problems,
      `${file}: engine ${JSON.stringify(el.elements)} vs view ${JSON.stringify(data.outputs.elementView)}`,
    ).toEqual([]);
  });
});

describe('VT-04 round trip under the convention (L1)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const el = engineView(data);
    if (!el.ok) {
      expect.fail(`${file}: stateToElements returned ${el.reason}`);
    }
    const back = elementsToState(el.elements, data.inputs.constants.mu_m3ps2);
    if (!back.ok) {
      expect.fail(`${file}: elementsToState returned ${back.reason}`);
    }
    const expected = data.outputs.roundTripExpected;
    const dr = diffNorm(back.state.position_m, expected.position_m);
    const dv = diffNorm(back.state.velocity_mps, expected.velocity_mps);
    ratios.record(`round-trip position (${data.kind})`, dr, data.tolerance.position_m, file);
    ratios.record(`round-trip velocity (${data.kind})`, dv, data.tolerance.velocity_mps, file);
    const report =
      `${file}: input ${fmtV(data.inputs.state.position_m)} ${fmtV(data.inputs.state.velocity_mps)}\n` +
      `  engine view ${JSON.stringify(el.elements)} convention ${el.convention}\n` +
      `  round trip ${fmtV(back.state.position_m)} ${fmtV(back.state.velocity_mps)}\n` +
      `  |Δr| ${fmt(dr)} m (tol ${fmt(data.tolerance.position_m)}), ` +
      `|Δv| ${fmt(dv)} m/s (tol ${fmt(data.tolerance.velocity_mps)})`;
    expect(dr <= data.tolerance.position_m, report).toBe(true);
    expect(dv <= data.tolerance.velocity_mps, report).toBe(true);
  });
});
