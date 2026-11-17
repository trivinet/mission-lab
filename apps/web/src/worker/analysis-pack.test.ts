/**
 * ML-TASK-044 (D-1): the analysis is computed in the worker and packed into typed arrays; the
 * main thread unpacks it. VI-03 (a) plumbing: what the main thread plots from the packed arrays is
 * Object.is equal to the analysis module's own output for the same result, null positions
 * included (the escape preset has quantities that are not defined on a hyperbolic orbit).
 * This is a plumbing check; the module's values are verified elsewhere.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import {
  HISTORY_QUANTITIES,
  buildCoastRequest,
  buildSimulationRequest,
  computeHistories,
  runSimulation,
} from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { attachAnalysis, analyse } from '../plots/analysis-model';
import { PRESETS, loadPreset } from '../presets/presets';
import { newScenario } from '../state/default-scenario';
import { packHistories, packedBuffers, unpackSeries } from './analysis-pack';
import { handleRunMessage } from './run-handler';

function runOf(scenario: ReturnType<typeof newScenario>, coast: boolean): SimulationResult {
  const built = coast ? buildCoastRequest(scenario) : buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error('request rejected');
  }
  const outcome = runSimulation(built.value);
  if (!outcome.ok || outcome.value.status !== 'ok') {
    throw new Error('run failed');
  }
  return outcome.value;
}

const scenarios = [
  { name: 'default', scenario: newScenario() },
  ...PRESETS.map((preset) => {
    const loaded = loadPreset(preset);
    if (!loaded.ok) {
      throw new Error(`preset ${preset.id} did not load`);
    }
    return { name: preset.id, scenario: loaded.scenario };
  }),
];

describe.each(scenarios)('packed analysis: $name', ({ scenario }) => {
  const result = runOf(scenario, false);
  const module = computeHistories(result);

  it('every unpacked value is Object.is equal to the module output, nulls included', () => {
    const packed = packHistories(result);
    if (!module.ok || !packed.ok) {
      throw new Error('histories failed');
    }
    expect(packed.segments).toHaveLength(module.histories.segments.length);
    let compared = 0;
    let nulls = 0;
    for (const [i, segment] of module.histories.segments.entries()) {
      for (const { quantity } of HISTORY_QUANTITIES) {
        const expected = segment.series.find((s) => s.quantity === quantity)?.values ?? [];
        const actual = unpackSeries(packed.segments[i]?.values[quantity] ?? new Float64Array());
        expect(actual).toHaveLength(expected.length);
        for (const [k, value] of expected.entries()) {
          expect(Object.is(actual[k], value)).toBe(true);
          compared += 1;
          nulls += value === null ? 1 : 0;
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
    if (scenario.maneuvers.some((m) => m.deltaV_mps[1] > 3000)) {
      expect(nulls).toBeGreaterThan(0);
    }
  });

  it('analyse() hands the plots the same values, with the engine time array, no copy', () => {
    const packed = packHistories(result);
    attachAnalysis(result, packed);
    const model = analyse(result, undefined);
    if (!model.histories.ok || !module.ok) {
      throw new Error('histories failed');
    }
    for (const { quantity } of HISTORY_QUANTITIES) {
      const plotted = model.histories.forQuantity(quantity);
      for (const [i, segment] of module.histories.segments.entries()) {
        const expected = segment.series.find((s) => s.quantity === quantity);
        const got = plotted.segments[i]?.series[0];
        expect(got?.t_s).toBe(result.segments[i]?.t_s);
        expect(got?.values.map((v) => v)).toEqual(expected?.values);
      }
    }
  });
});

describe('analysis without a packed analysis, and the handler', () => {
  it('a result nobody attached an analysis to reports ANALYSIS_UNAVAILABLE', () => {
    const result = runOf(newScenario(), false);
    const model = analyse(result, undefined);
    expect(model.histories).toEqual({ ok: false, reason: 'ANALYSIS_UNAVAILABLE' });
  });

  it('the worker handler attaches the packed analysis to an ok result and lists its buffers', () => {
    const built = buildSimulationRequest(newScenario());
    if (!built.ok) {
      throw new Error('request rejected');
    }
    const { response, transfer, analysis_ms } = handleRunMessage({
      type: 'run',
      runId: 1,
      request: built.value,
    });
    if (response.type !== 'result' || response.analysis === undefined) {
      throw new Error('expected a result with an analysis');
    }
    expect(packedBuffers(response.analysis).every((b) => transfer.includes(b))).toBe(true);
    expect(analysis_ms).toBeGreaterThanOrEqual(0);
  });
});
