/**
 * ML-TASK-024 unit checks (ML-FR-008 AC3): the display position equals the engine sample bit for
 * bit at every sample time, the post-maneuver segment is shown at a maneuver time, no
 * interpolation mixes segments, and the Hermite formula matches a hand-worked case.
 *
 * Expected values come from the engine result's own arrays (real engine) or are worked by hand
 * below; the code under test is displayPositionAt / hermite.
 */
import type { Scenario, SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest, runSimulation } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { displayPositionAt, hermite, resultTimeSpan_s } from './interpolate';
import type { InterpolationSegment } from './interpolate';

function runEngine(scenario: Scenario): SimulationResult {
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error(`scenario rejected: ${JSON.stringify(built.issues)}`);
  }
  const outcome = runSimulation(built.value);
  if (!outcome.ok) {
    throw new Error(`run rejected: ${JSON.stringify(outcome.issues)}`);
  }
  return outcome.value;
}

function withManeuver(t_s: number): Scenario {
  const base = newScenario();
  return {
    ...base,
    maneuvers: [{ id: 'm1', t_s, frame: 'RSW', deltaV_mps: [0, 100, 0] }],
  };
}

describe('hermite (hand-worked)', () => {
  // Cubic with p(0) = 0, p'(0) = 1, p(2) = 4, p'(2) = 3. Solving a t^3 + b t^2 + t:
  // 8a + 4b + 2 = 4 and 12a + 4b + 1 = 3 give a = 0, b = 1/2, so p(t) = t^2 / 2 + t and
  // p(1) = 1.5. With u = 1/2 the basis values are h00 = 1/2, h10 = 1/8, h01 = 1/2, h11 = -1/8, so
  // p = 0 + (1/8)(2)(1) + (1/2)(4) + (-1/8)(2)(3) = 0.25 + 2 - 0.75 = 1.5.
  it('reproduces the cubic through (0, 0, v 1) and (2, 4, v 3) at t = 1', () => {
    expect(hermite(0, 2, 0, 4, 1, 3, 1)).toBe(1.5);
  });

  it('reproduces the same cubic at t = 0.5 (p = 0.625) and with shifted times', () => {
    expect(hermite(0, 2, 0, 4, 1, 3, 0.5)).toBeCloseTo(0.625, 15);
    // Same cubic, time axis shifted by 100 s.
    expect(hermite(100, 102, 0, 4, 1, 3, 101)).toBe(1.5);
  });
});

describe('displayPositionAt on synthetic segments', () => {
  // Two segments sharing the maneuver time 10, with a velocity jump (position continuous).
  const seg0: InterpolationSegment = {
    index: 0,
    t_s: [0, 10],
    position_m: [0, 0, 0, 10, 0, 0],
    velocity_mps: [1, 0, 0, 1, 0, 0],
  };
  const seg1: InterpolationSegment = {
    index: 1,
    t_s: [10, 20],
    position_m: [10, 0, 0, 10, 100, 0],
    velocity_mps: [0, 10, 0, 0, 10, 0],
  };
  const segments = [seg0, seg1];

  it('returns the post-maneuver segment first sample at the maneuver time', () => {
    const at = displayPositionAt(segments, 10);
    expect(at).toMatchObject({ segmentIndex: 1, sampleIndex: 0, interpolated: false });
    expect(at?.position_m).toEqual([10, 0, 0]);
  });

  it('uses only the samples of the segment that holds the time', () => {
    // t = 5 is inside segment 0: a straight line at 1 m/s, never pulled by segment 1.
    const a = displayPositionAt(segments, 5);
    expect(a).toMatchObject({ segmentIndex: 0, sampleIndex: null, interpolated: true });
    expect(a?.position_m[0]).toBeCloseTo(5, 12);
    // t = 15 is inside segment 1: a straight line at 10 m/s along y.
    const b = displayPositionAt(segments, 15);
    expect(b).toMatchObject({ segmentIndex: 1, interpolated: true });
    expect(b?.position_m[0]).toBeCloseTo(10, 12);
    expect(b?.position_m[1]).toBeCloseTo(50, 12);
  });

  it('clamps outside the span and handles single-sample segments', () => {
    expect(displayPositionAt(segments, -5)?.t_s).toBe(0);
    expect(displayPositionAt(segments, 99)).toMatchObject({ t_s: 20, sampleIndex: 1 });
    const single: InterpolationSegment = {
      index: 1,
      t_s: [10],
      position_m: [10, 0, 0],
      velocity_mps: [0, 10, 0],
    };
    // Maneuver at the end of the span: the single-sample later segment wins.
    expect(displayPositionAt([seg0, single], 10)).toMatchObject({
      segmentIndex: 1,
      sampleIndex: 0,
    });
    expect(displayPositionAt([], 1)).toBeNull();
    expect(resultTimeSpan_s(segments)).toEqual({ start_s: 0, end_s: 20 });
  });
});

describe('displayPositionAt on real engine results (AC3)', () => {
  const cases: [string, SimulationResult][] = [
    ['default scenario', runEngine(newScenario())],
    ['maneuver on the grid at 3000 s', runEngine(withManeuver(3000))],
    ['maneuver off the grid at 2500.25 s', runEngine(withManeuver(2500.25))],
  ];

  for (const [name, result] of cases) {
    it(`${name}: equals the engine sample bit for bit at every sample time`, () => {
      let checked = 0;
      for (const segment of result.segments) {
        for (const [i, t] of segment.t_s.entries()) {
          const at = displayPositionAt(result.segments, t);
          expect(at).not.toBeNull();
          // At a time shared by two segments the later segment is shown.
          const later = result.segments.filter(
            (s) => s.index > segment.index && s.t_s[0] === t,
          ).length;
          if (later > 0) {
            continue;
          }
          expect(at?.segmentIndex).toBe(segment.index);
          expect(at?.sampleIndex).toBe(i);
          expect(at?.interpolated).toBe(false);
          for (const k of [0, 1, 2]) {
            expect(Object.is(at?.position_m[k], segment.position_m[3 * i + k])).toBe(true);
          }
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(100);
    });

    it(`${name}: at each maneuver time the post-maneuver first sample is returned`, () => {
      for (const event of result.events) {
        const after = result.segments[1];
        expect(after?.t_s[0]).toBe(event.t_s);
        const at = displayPositionAt(result.segments, event.t_s);
        expect(at?.segmentIndex).toBe(1);
        expect(at?.sampleIndex).toBe(0);
        for (const k of [0, 1, 2]) {
          expect(Object.is(at?.position_m[k], after?.position_m[k])).toBe(true);
        }
      }
    });

    it(`${name}: between samples the position is interpolated inside one segment`, () => {
      for (const segment of result.segments) {
        for (let i = 0; i + 1 < segment.t_s.length; i += 7) {
          const t0 = segment.t_s[i] ?? 0;
          const t1 = segment.t_s[i + 1] ?? 0;
          const at = displayPositionAt(result.segments, (t0 + t1) / 2);
          expect(at?.interpolated).toBe(true);
          expect(at?.segmentIndex).toBe(segment.index);
          // Within the segment's span: closer to the bracketing samples than the chord length.
          const chord = Math.hypot(
            (segment.position_m[3 * (i + 1)] ?? 0) - (segment.position_m[3 * i] ?? 0),
            (segment.position_m[3 * (i + 1) + 1] ?? 0) - (segment.position_m[3 * i + 1] ?? 0),
            (segment.position_m[3 * (i + 1) + 2] ?? 0) - (segment.position_m[3 * i + 2] ?? 0),
          );
          const d = Math.hypot(
            (at?.position_m[0] ?? 0) - (segment.position_m[3 * i] ?? 0),
            (at?.position_m[1] ?? 0) - (segment.position_m[3 * i + 1] ?? 0),
            (at?.position_m[2] ?? 0) - (segment.position_m[3 * i + 2] ?? 0),
          );
          expect(d).toBeLessThan(chord);
        }
      }
    });
  }

  it('an off-grid maneuver: just before it, the position comes from segment 0 only', () => {
    const result = cases[2]?.[1];
    const seg0 = result?.segments[0];
    const last = seg0?.t_s[seg0.t_s.length - 1] ?? 0;
    const at = displayPositionAt(result?.segments ?? [], last - 0.01);
    expect(at?.segmentIndex).toBe(0);
    expect(at?.interpolated).toBe(true);
  });
});
