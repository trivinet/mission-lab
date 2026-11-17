/**
 * ML-FR-014 AC1 / VI-01 (CSV row of tolerances.md §1): parsing the exported CSV gives Object.is
 * equality with every exported result value; the header has units, frame and epoch; one row per
 * sample. The parser below is the test's own (split lines, skip `#`, Number()), independent of
 * the exporter. The engine is the real one.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest, runSimulation } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { csvFileName, csvNumber, resultToCsv } from './csv-export';

function run(withManeuver: boolean): SimulationResult {
  const base = newScenario();
  const scenario = withManeuver
    ? {
        ...base,
        maneuvers: [
          {
            id: 'm1',
            t_s: 1500,
            frame: 'RSW' as const,
            deltaV_mps: [3.3, 100.1, -7.7] as [number, number, number],
          },
        ],
      }
    : base;
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error('request rejected');
  }
  const outcome = runSimulation(built.value);
  if (!outcome.ok || outcome.value.status !== 'ok') {
    throw new Error('run failed');
  }
  return outcome.value;
}

function parse(text: string): { comments: string[]; header: string[]; rows: string[][] } {
  expect(text.endsWith('\n')).toBe(true);
  expect(text).not.toContain('\r');
  const lines = text.slice(0, -1).split('\n');
  const comments = lines.filter((l) => l.startsWith('#'));
  const rest = lines.filter((l) => !l.startsWith('#'));
  const [headerLine, ...data] = rest;
  return { comments, header: (headerLine ?? '').split(','), rows: data.map((l) => l.split(',')) };
}

function exported(result: SimulationResult) {
  const csv = resultToCsv(result);
  if (!csv.ok) {
    throw new Error('export failed');
  }
  return { csv, ...parse(csv.text) };
}

describe('CSV export of a real result', () => {
  for (const withManeuver of [false, true]) {
    describe(withManeuver ? 'with a maneuver' : 'coast only', () => {
      const result = run(withManeuver);
      const { csv, comments, header, rows } = exported(result);

      it('has a header with units, frame and epoch', () => {
        const all = comments.join('\n');
        expect(all).toContain('frame: GCRF');
        expect(all).toContain(`epoch: ${result.model.epoch.iso}`);
        expect(all).toContain(`time scale ${result.model.epoch.scale}`);
        expect(all).toContain('units:');
        expect(all).toContain('requestId:');
        expect(header).toEqual([
          'segment',
          't_s',
          'x_m',
          'y_m',
          'z_m',
          'vx_mps',
          'vy_mps',
          'vz_mps',
        ]);
      });

      it('has one row per sample, with the segment index', () => {
        const samples = result.segments.reduce((n, s) => n + s.t_s.length, 0);
        expect(rows).toHaveLength(samples);
        expect(csv.rowCount).toBe(samples);
        let at = 0;
        for (const segment of result.segments) {
          for (const time of segment.t_s) {
            expect(Object.is(Number(rows[at]?.[1]), time)).toBe(true);
            expect(rows[at]?.[0]).toBe(String(segment.index));
            at += 1;
          }
        }
      });

      it('every cell parses back to exactly the result value (Object.is)', () => {
        let at = 0;
        let checked = 0;
        for (const segment of result.segments) {
          for (let k = 0; k < segment.t_s.length; k += 1) {
            const cells = rows[at] ?? [];
            expect(cells).toHaveLength(8);
            const expected = [
              segment.t_s[k],
              segment.position_m[3 * k],
              segment.position_m[3 * k + 1],
              segment.position_m[3 * k + 2],
              segment.velocity_mps[3 * k],
              segment.velocity_mps[3 * k + 1],
              segment.velocity_mps[3 * k + 2],
            ];
            expected.forEach((value, c) => {
              expect(Object.is(Number(cells[c + 1]), value)).toBe(true);
              checked += 1;
            });
            at += 1;
          }
        }
        expect(checked).toBe(rows.length * 7);
      });
    });
  }

  it('shows the two sides of the maneuver: same t_s and position, velocity before then after', () => {
    const result = run(true);
    const { rows } = exported(result);
    const event = result.events[0];
    expect(event).toBeDefined();
    const atEvent = rows.filter((r) => Object.is(Number(r[1]), event?.t_s));
    expect(atEvent).toHaveLength(2);
    expect(atEvent.map((r) => r[0])).toEqual(['0', '1']);
    expect(Number(atEvent[0]?.[5])).toBe(event?.velocityBefore_mps[0]);
    expect(Number(atEvent[1]?.[5])).toBe(event?.velocityAfter_mps[0]);
    expect(atEvent[0]?.[2]).toBe(atEvent[1]?.[2]);
  });
});

describe('number formatting', () => {
  it('round-trips awkward binary64 values, including -0, subnormals and extremes', () => {
    const base = run(false);
    const first = base.segments[0];
    if (first === undefined) {
      throw new Error('no segment');
    }
    const awkward = [
      -0,
      0.1 + 0.2,
      5e-324,
      1e21,
      1.7976931348623157e308,
      -123456789.12345679,
      1 / 3,
    ];
    const crafted: SimulationResult = {
      ...base,
      segments: [
        {
          ...first,
          t_s: new Float64Array([0, 1]),
          position_m: new Float64Array([...awkward.slice(0, 3), ...awkward.slice(3, 6)]),
          velocity_mps: new Float64Array([awkward[6] ?? 0, -0, 5e-324, 1e-7, 123, -1e-300]),
        },
      ],
      events: [],
    };
    const { rows } = exported(crafted);
    const expected = [
      [0, ...awkward.slice(0, 3), awkward[6], -0, 5e-324],
      [1, ...awkward.slice(3, 6), 1e-7, 123, -1e-300],
    ];
    expected.forEach((row, r) => {
      row.forEach((value, c) => {
        expect(Object.is(Number(rows[r]?.[c + 1]), value)).toBe(true);
      });
    });
    expect(csvNumber(-0)).toBe('-0');
    expect(csvNumber(0)).toBe('0');
  });

  it('does not use fixed decimals', () => {
    expect(csvNumber(0.1 + 0.2)).toBe('0.30000000000000004');
    expect(csvNumber(7000000)).toBe('7000000');
  });
});

describe('failure and file name', () => {
  it('declines a failed result', () => {
    const failed = { ...run(false), status: 'failed' as const };
    expect(resultToCsv(failed)).toEqual({ ok: false, reason: 'RESULT_FAILED' });
  });

  it('makes a safe file name', () => {
    expect(csvFileName('Preset: escape burn from LEO')).toBe(
      'Preset-escape-burn-from-LEO.result.csv',
    );
    expect(csvFileName('***')).toBe('scenario.result.csv');
  });
});
