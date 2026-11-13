/**
 * VT-03 Round trip state → elements → state (ML-FR-003 AC2) — engine `stateToElements` (with the
 * approved thresholds ε_e = ε_i = 1e-5 passed explicitly, tolerances.md §15) followed by engine
 * `elementsToState`, against the input state (L1, exact) with the tolerance stored in each
 * dataset (tolerances.md §7 VT-03). Also, per dataset: the engine's element view and degenerate
 * classification against the L2c reference elements, with the VI-03(b) element rows stored in the
 * dataset (`tolerance.elementRows`; null = row not applicable) and exact classification.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { elementsToState, stateToElements } from '@mission-lab/astrodynamics';
import { wrapPi } from '@mission-lab/verification';
import { loadFamily, type ElementsJson, type Vt03Dataset } from './support/datasets';
import { diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';

const datasets = loadFamily('vt-03').map((d) => ({ file: d.file, data: d.data as Vt03Dataset }));
const ratios = new RatioRecorder('VT-03');

afterAll(() => {
  console.log(ratios.summary());
});

function thresholdsOf(data: Vt03Dataset) {
  const t = data.method.convention.thresholds;
  return { circularEccentricity: t.epsilon_e, equatorialInclination_rad: t.epsilon_i };
}

describe('VT-03 round trip state → elements → state (L1)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const { state, constants } = data.inputs;
    const el = stateToElements(state, constants.mu_m3ps2, thresholdsOf(data));
    if (!el.ok) {
      expect.fail(`${file}: stateToElements returned ${el.reason}`);
    }
    const back = elementsToState(el.elements, constants.mu_m3ps2);
    if (!back.ok) {
      expect.fail(`${file}: elementsToState returned ${back.reason}`);
    }
    const expected = data.outputs.roundTripExpected;
    const dr = diffNorm(back.state.position_m, expected.position_m);
    const dv = diffNorm(back.state.velocity_mps, expected.velocity_mps);
    ratios.record('round-trip position', dr, data.tolerance.position_m, file);
    ratios.record('round-trip velocity', dv, data.tolerance.velocity_mps, file);
    const report =
      `${file}: input ${fmtV(state.position_m)} ${fmtV(state.velocity_mps)}\n` +
      `  engine elements ${JSON.stringify(el.elements)} convention ${el.convention}\n` +
      `  round trip ${fmtV(back.state.position_m)} ${fmtV(back.state.velocity_mps)}\n` +
      `  |Δr| ${fmt(dr)} m (tol ${fmt(data.tolerance.position_m)}), ` +
      `|Δv| ${fmt(dv)} m/s (tol ${fmt(data.tolerance.velocity_mps)})`;
    expect(dr <= data.tolerance.position_m, report).toBe(true);
    expect(dv <= data.tolerance.velocity_mps, report).toBe(true);
  });
});

const angleKeys = ['raan_rad', 'argPeriapsis_rad', 'trueAnomaly_rad'] as const;

describe('VT-03 element view vs L2c (VI-03(b) rows stored in the dataset)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const { state, constants } = data.inputs;
    const el = stateToElements(state, constants.mu_m3ps2, thresholdsOf(data));
    if (!el.ok) {
      expect.fail(`${file}: stateToElements returned ${el.reason}`);
    }
    const ref: ElementsJson = data.outputs.referenceElements.elementView;
    const rows = data.tolerance.elementRows;
    const problems: string[] = [];

    const cls = data.outputs.referenceElements.classification;
    const engineCircular = el.convention === 'CIRCULAR' || el.convention === 'CIRCULAR_EQUATORIAL';
    const engineEquatorial =
      el.convention === 'EQUATORIAL' || el.convention === 'CIRCULAR_EQUATORIAL';
    if (engineCircular !== cls.circular || engineEquatorial !== cls.equatorial) {
      problems.push(
        `classification: expected circular=${String(cls.circular)} equatorial=${String(cls.equatorial)}, ` +
          `engine convention ${el.convention}`,
      );
    }

    const check = (name: string, diff: number, tol: number | null): void => {
      if (tol === null) return;
      ratios.record(`element ${name}`, diff, tol, file);
      if (!(diff <= tol)) problems.push(`${name}: |Δ| ${fmt(diff)} > tol ${fmt(tol)}`);
    };
    check('eccentricity', Math.abs(el.elements.eccentricity - ref.eccentricity), rows.eccentricity);
    check(
      'inclination_rad',
      Math.abs(el.elements.inclination_rad - ref.inclination_rad),
      rows.inclination_rad,
    );
    for (const key of angleKeys) {
      check(key, Math.abs(wrapPi(el.elements[key] - ref[key])), rows[key]);
    }
    expect(
      problems,
      `${file}: engine ${JSON.stringify(el.elements)} vs reference ${JSON.stringify(ref)}`,
    ).toEqual([]);
  });
});
