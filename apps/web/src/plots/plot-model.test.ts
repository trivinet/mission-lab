/**
 * ML-TASK-032: plot data structure (ML-FR-009 AC1-AC3, ML-FR-010 AC1; ADR-010 angle policy).
 *
 * VI-03 (a), plumbing: every plotted value is Object.is equal to the analysis module's output,
 * default and maneuvered scenarios, coast run included. This file reads the plot model; the
 * read-back from uPlot's own data store is the browser e2e (plots.spec.ts). The engine and the
 * analysis module are the real ones; the expected values are the module's arrays themselves, so
 * this is a plumbing check, not a check that the values are physically right (VI-03 (b), ML-TASK-036).
 */
import type { Scenario, SimulationResult } from '@mission-lab/contracts';
import {
  HISTORY_QUANTITIES,
  buildCoastRequest,
  buildSimulationRequest,
  computeHistories,
  runSimulation,
} from '@mission-lab/simulation';
import type { ResultHistories } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { buildPlotModel, mergeTimes, sampleAt } from './plot-model';
import type { PlotModel } from './plot-model';

function run(request: ReturnType<typeof buildSimulationRequest>): SimulationResult {
  if (!request.ok) {
    throw new Error('request rejected');
  }
  const outcome = runSimulation(request.value);
  if (!outcome.ok || outcome.value.status !== 'ok') {
    throw new Error('run failed');
  }
  return outcome.value;
}

function histories(result: SimulationResult): ResultHistories {
  const computed = computeHistories(result);
  if (!computed.ok) {
    throw new Error('histories failed');
  }
  return computed.histories;
}

interface Case {
  readonly name: string;
  readonly result: ResultHistories;
  readonly coast: ResultHistories | null;
  readonly maneuverTimes_s: readonly number[];
}

function caseFor(name: string, scenario: Scenario): Case {
  const result = run(buildSimulationRequest(scenario));
  const maneuvered = scenario.maneuvers.length > 0;
  const coast = maneuvered ? run(buildCoastRequest(scenario)) : null;
  return {
    name,
    result: histories(result),
    coast: coast === null ? null : histories(coast),
    maneuverTimes_s: result.events.map((e) => e.t_s),
  };
}

const base = newScenario();
const CASES: readonly Case[] = [
  caseFor('default (no maneuver)', base),
  caseFor('maneuver on the output grid (t = 3000 s)', {
    ...base,
    maneuvers: [{ id: 'burn-1', t_s: 3000, frame: 'RSW', deltaV_mps: [0, 100, 0] }],
  }),
  caseFor('maneuver off the output grid (t = 3025 s)', {
    ...base,
    maneuvers: [{ id: 'burn-1', t_s: 3025, frame: 'RSW', deltaV_mps: [10, 80, 5] }],
  }),
];

function caseAt(index: number): Case {
  const found = CASES[index];
  if (found === undefined) {
    throw new Error('no such case');
  }
  return found;
}

function models(c: Case): PlotModel[] {
  return HISTORY_QUANTITIES.map(({ quantity, unit }) =>
    buildPlotModel(c.result, c.coast, quantity, unit, c.maneuverTimes_s),
  );
}

describe.each(CASES)('plot model: $name', (c) => {
  it('VI-03 (a): every plotted value is Object.is equal to the module output', () => {
    for (const model of models(c)) {
      for (const source of model.sources) {
        const own = model.series.filter(
          (s) => s.run === source.run && s.segmentIndex === source.segmentIndex,
        );
        let plotted = 0;
        for (const [k, t] of source.t_s.entries()) {
          const xi = model.x.findIndex((x) => Object.is(x, t));
          expect(xi).toBeGreaterThanOrEqual(0);
          const here = own.map((s) => s.values[xi] ?? null).filter((v): v is number => v !== null);
          const expected = source.values[k] ?? null;
          if (expected === null) {
            expect(here).toHaveLength(0);
          } else {
            expect(here).toHaveLength(1);
            expect(Object.is(here[0], expected)).toBe(true);
            plotted += 1;
          }
        }
        // Nothing else is plotted for that segment: no extra, no missing value.
        const total = own.reduce((n, s) => n + s.values.filter((v) => v !== null).length, 0);
        expect(total).toBe(plotted);
      }
    }
  });

  it('the series come straight from the module arrays (same values, by reference of the sources)', () => {
    for (const model of models(c)) {
      const expectedCount = (c.coast?.segments.length ?? 0) + c.result.segments.length;
      expect(model.sources).toHaveLength(expectedCount);
      for (const source of model.sources) {
        const segments = source.run === 'coast' && c.coast !== null ? c.coast : c.result;
        const segment = segments.segments[source.segmentIndex];
        const series = segment?.series.find((s) => s.quantity === model.quantity);
        expect(source.values).toBe(series?.values);
        expect(source.t_s).toBe(series?.t_s);
      }
    }
  });

  it('no plotted line crosses a maneuver or an angle wrap', () => {
    for (const model of models(c)) {
      for (const series of model.series) {
        const source = model.sources.find(
          (s) => s.run === series.run && s.segmentIndex === series.segmentIndex,
        );
        if (source === undefined) {
          throw new Error('series without a source');
        }
        for (let i = 0; i + 1 < model.x.length; i += 1) {
          const a = series.values[i];
          const b = series.values[i + 1];
          if (a === null || b === null || a === undefined || b === undefined) {
            continue;
          }
          // A drawn line segment joins two consecutive samples of one segment ...
          const ia = source.t_s.findIndex((t) => Object.is(t, model.x[i]));
          const ib = source.t_s.findIndex((t) => Object.is(t, model.x[i + 1]));
          expect(ia).toBeGreaterThanOrEqual(0);
          expect(ib).toBe(ia + 1);
          // ... and for an angle the two values are on the same side of the wrap.
          if (model.unit === 'rad') {
            expect(Math.abs(b - a)).toBeLessThanOrEqual(Math.PI);
          }
        }
        // A series never has a value outside the time span of its own segment.
        const first = source.t_s[0] ?? Number.NaN;
        const last = source.t_s[source.t_s.length - 1] ?? Number.NaN;
        for (const [i, v] of series.values.entries()) {
          if (v !== null) {
            expect(model.x[i]).toBeGreaterThanOrEqual(first);
            expect(model.x[i]).toBeLessThanOrEqual(last);
          }
        }
      }
    }
  });

  it('x is sorted, has no duplicate time and every series is aligned to it', () => {
    for (const model of models(c)) {
      for (let i = 1; i < model.x.length; i += 1) {
        expect(model.x[i]).toBeGreaterThan(model.x[i - 1] ?? Number.POSITIVE_INFINITY);
      }
      for (const series of model.series) {
        expect(series.values).toHaveLength(model.x.length);
      }
    }
  });
});

describe('maneuver structure', () => {
  const maneuvered = caseAt(1);
  const plainCase = caseAt(0);

  it('the two sides of the maneuver are separate series that both have the maneuver time', () => {
    const model = buildPlotModel(maneuvered.result, maneuvered.coast, 'speed_mps', 'm/s', [3000]);
    const before = model.series.find((s) => s.run === 'maneuvered' && s.segmentIndex === 0);
    const after = model.series.find((s) => s.run === 'maneuvered' && s.segmentIndex === 1);
    const at = model.x.findIndex((t) => t === 3000);
    expect(before?.values[at]).not.toBeNull();
    expect(after?.values[at]).not.toBeNull();
    // The speed jumps at the maneuver; the two values are the engine's pre- and post- samples.
    expect(before?.values[at]).not.toBe(after?.values[at]);
  });

  it('with a coast run the coast is its own series; without one segment 0 is the coast', () => {
    const withCoast = buildPlotModel(maneuvered.result, maneuvered.coast, 'radius_m', 'm', [3000]);
    expect(withCoast.series.some((s) => s.run === 'coast')).toBe(true);
    const plain = buildPlotModel(plainCase.result, null, 'radius_m', 'm', []);
    expect(plain.series.map((s) => s.run)).toEqual(['coast']);
  });

  it('breaks an angle where it wraps, and leaves the values unchanged', () => {
    // The default scenario covers about one orbit: the true anomaly wraps once.
    const model = buildPlotModel(plainCase.result, null, 'trueAnomaly_rad', 'rad', []);
    expect(model.series.length).toBeGreaterThan(1);
    const plotted = model.series.flatMap((s) => s.values).filter((v) => v !== null);
    const source = model.sources[0]?.values.filter((v) => v !== null);
    expect(plotted).toHaveLength(source?.length ?? -1);
    // A non-angle quantity is never split.
    const radius = buildPlotModel(plainCase.result, null, 'radius_m', 'm', []);
    expect(radius.series).toHaveLength(1);
  });
});

describe('mergeTimes and sampleAt', () => {
  it('merges ascending arrays, equal times once', () => {
    expect(
      mergeTimes([
        [0, 60, 120],
        [0, 60, 90, 120],
      ]),
    ).toEqual([0, 60, 90, 120]);
    expect(mergeTimes([[], [1, 2]])).toEqual([1, 2]);
    expect(mergeTimes([])).toEqual([]);
  });

  it('holds the last sample at or before t, and none outside the segment', () => {
    const source = {
      run: 'maneuvered',
      segmentIndex: 1,
      t_s: [10, 20, 30],
      values: [1, null, 3],
    } as const;
    expect(sampleAt(source, 9)).toBeNull();
    expect(sampleAt(source, 10)).toEqual({ t_s: 10, value: 1 });
    expect(sampleAt(source, 29.9)).toEqual({ t_s: 20, value: null });
    expect(sampleAt(source, 30)).toEqual({ t_s: 30, value: 3 });
    expect(sampleAt(source, 31)).toBeNull();
  });
});
