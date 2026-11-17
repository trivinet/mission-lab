/**
 * Plumbing and structure tests of computeHistories (ML-TASK-031). They check that each value is
 * the documented astrodynamics function of its own sample (Object.is), the segment split, flat
 * element histories, hyperbolic handling and determinism. Correctness against independent
 * references is VI-03 (b), Verification Engineer; no reference value appears here.
 */
import {
  closedOrbitQuantities,
  normVec3,
  stateIntegrals,
  stateToElements,
} from '@mission-lab/astrodynamics';
import type { SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { DEGENERACY_THRESHOLDS } from '../degeneracy-thresholds';
import { leoScenario, maneuver, requestOf, runOk } from '../test-fixtures';
import { HISTORY_QUANTITIES, computeHistories, historySeries } from './histories';
import type { HistoryQuantity, ResultHistories, SegmentHistory } from './histories';
import { defaultLikeScenario, stateAt } from './test-helpers';

function historiesOf(result: SimulationResult): ResultHistories {
  const computed = computeHistories(result);
  if (!computed.ok) {
    throw new Error(`computeHistories failed: ${computed.reason}`);
  }
  return computed.histories;
}

function values(segment: SegmentHistory, quantity: HistoryQuantity): readonly (number | null)[] {
  const series = historySeries(segment, quantity);
  if (series === undefined) {
    throw new Error(`no series ${quantity}`);
  }
  return series.values;
}

function numbers(segment: SegmentHistory, quantity: HistoryQuantity): number[] {
  return values(segment, quantity).map((x) => {
    if (x === null) {
      throw new Error(`${quantity} has a null value`);
    }
    return x;
  });
}

function spread(xs: readonly number[]): number {
  return Math.max(...xs) - Math.min(...xs);
}

const coast = runOk(requestOf(defaultLikeScenario()));
const burnTime_s = 3000;
const tangential = runOk(
  requestOf(defaultLikeScenario({ maneuvers: [maneuver(burnTime_s, [0, 100, 0])] })),
);
const escape = runOk(requestOf(leoScenario({ maneuvers: [maneuver(1000, [0, 4000, 0])] })));

describe('computeHistories: plumbing (each value is the function of its own sample)', () => {
  for (const [name, result] of [
    ['coast', coast],
    ['tangential burn', tangential],
    ['escape', escape],
  ] as const) {
    it(`${name}: Object.is per value against the astrodynamics functions`, () => {
      const { mu_m3ps2, referenceRadius_m } = result.model.constants;
      const histories = historiesOf(result);
      expect(histories.requestId).toBe(result.requestId);
      expect(histories.segments).toHaveLength(result.segments.length);
      result.segments.forEach((segment, n) => {
        const h = histories.segments[n];
        if (h === undefined) {
          throw new Error('missing segment');
        }
        expect(h.segmentIndex).toBe(n);
        expect(h.t_s.every((t, k) => Object.is(t, segment.t_s[k]))).toBe(true);
        expect(h.t_s).toHaveLength(segment.t_s.length);
        expect(h.series.map((s) => [s.quantity, s.unit])).toEqual(
          HISTORY_QUANTITIES.map((q) => [q.quantity, q.unit]),
        );
        for (const s of h.series) {
          expect(s.segmentIndex).toBe(n);
          expect(s.t_s).toBe(h.t_s);
          expect(s.values).toHaveLength(segment.t_s.length);
        }
        for (let k = 0; k < segment.t_s.length; k++) {
          const { r, v } = stateAt(segment, k);
          const el = stateToElements(
            { position_m: r, velocity_mps: v },
            mu_m3ps2,
            DEGENERACY_THRESHOLDS,
          );
          const integ = stateIntegrals(r, v, mu_m3ps2);
          if (!el.ok || !integ.ok) {
            throw new Error('fixture state rejected');
          }
          const closed = closedOrbitQuantities(
            el.elements.semiMajorAxis_m,
            el.elements.eccentricity,
            mu_m3ps2,
          );
          const expected: Record<HistoryQuantity, number | null> = {
            radius_m: normVec3(r),
            altitude_m: normVec3(r) - referenceRadius_m,
            speed_mps: normVec3(v),
            trueAnomaly_rad: el.elements.trueAnomaly_rad,
            semiMajorAxis_m: el.elements.semiMajorAxis_m,
            eccentricity: el.elements.eccentricity,
            inclination_rad: el.elements.inclination_rad,
            raan_rad: el.elements.raan_rad,
            argPeriapsis_rad: el.elements.argPeriapsis_rad,
            specificEnergy_m2ps2: integ.integrals.specificEnergy_m2ps2,
            periapsisRadius_m: closed.ok ? closed.quantities.periapsisRadius_m : null,
            apoapsisRadius_m: closed.ok ? closed.quantities.apoapsisRadius_m : null,
            period_s: closed.ok ? closed.quantities.period_s : null,
          };
          for (const s of h.series) {
            expect(
              Object.is(s.values[k], expected[s.quantity]),
              `${s.quantity}[${String(k)}]`,
            ).toBe(true);
          }
          expect(h.convention[k]).toBe(el.convention);
          expect(h.conic[k]).toBe(el.conic);
          expect(h.elementsFailure[k]).toBeNull();
          expect(h.closedOrbitFailure[k]).toBe(closed.ok ? null : closed.reason);
        }
      });
    });
  }

  it('returns no NaN or ±Infinity: every value is finite or null', () => {
    for (const result of [coast, tangential, escape]) {
      for (const segment of historiesOf(result).segments) {
        for (const s of segment.series) {
          expect(s.values.every((x) => x === null || Number.isFinite(x))).toBe(true);
        }
      }
    }
  });
});

describe('computeHistories: segment split at the maneuver (never joined)', () => {
  it('one history per segment; boundary samples are the R8 event states', () => {
    const histories = historiesOf(tangential);
    expect(histories.segments).toHaveLength(2);
    const [before, after] = histories.segments;
    const event = tangential.events[0];
    if (before === undefined || after === undefined || event === undefined) {
      throw new Error('expected two segments and one event');
    }
    expect(before.t_s.at(-1)).toBe(burnTime_s);
    expect(after.t_s[0]).toBe(burnTime_s);
    expect(before.t_s.every((t) => t <= burnTime_s)).toBe(true);
    expect(after.t_s.every((t) => t >= burnTime_s)).toBe(true);
    expect(Object.is(numbers(before, 'speed_mps').at(-1), normVec3(event.velocityBefore_mps))).toBe(
      true,
    );
    expect(Object.is(numbers(after, 'speed_mps')[0], normVec3(event.velocityAfter_mps))).toBe(true);
    // Same position on both sides of the event: same radius.
    expect(Object.is(numbers(before, 'radius_m').at(-1), numbers(after, 'radius_m')[0])).toBe(true);
    // A +100 m/s along-track burn raises a: the step is visible across the boundary.
    const aBefore = numbers(before, 'semiMajorAxis_m').at(-1) ?? Number.NaN;
    const aAfter = numbers(after, 'semiMajorAxis_m')[0] ?? Number.NaN;
    expect(aAfter).toBeGreaterThan(aBefore);
  });
});

describe('computeHistories: flat element histories between maneuvers', () => {
  // Smoke bounds for this unit test only (not approved tolerances): two-body elements are
  // constant on a segment, so their spread is propagation and conversion rounding, many orders of
  // magnitude below these bounds. VI-03 (b) is the toleranced check.
  const relativeBound = 1e-9;
  const absoluteBound_rad = 1e-9;

  for (const [name, result] of [
    ['coast', coast],
    ['tangential burn', tangential],
  ] as const) {
    it(`${name}: a, e, i, Ω, ω, r_p, r_a, T, ξ flat on each segment; ν and r vary`, () => {
      for (const segment of historiesOf(result).segments) {
        for (const q of [
          'semiMajorAxis_m',
          'periapsisRadius_m',
          'apoapsisRadius_m',
          'period_s',
          'specificEnergy_m2ps2',
        ] as const) {
          const xs = numbers(segment, q);
          expect(spread(xs) / Math.abs(xs[0] ?? 1), q).toBeLessThan(relativeBound);
        }
        for (const q of [
          'eccentricity',
          'inclination_rad',
          'raan_rad',
          'argPeriapsis_rad',
        ] as const) {
          const xs = numbers(segment, q);
          // Ω and ω of the default-like orbit start at 0 and may wrap to just below 2π.
          const wrapped = xs.map((x) => (x > Math.PI ? x - 2 * Math.PI : x));
          expect(spread(wrapped), q).toBeLessThan(absoluteBound_rad);
        }
        if (segment.t_s.length > 2) {
          expect(spread(numbers(segment, 'trueAnomaly_rad'))).toBeGreaterThan(0);
          expect(spread(numbers(segment, 'radius_m'))).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('computeHistories: hyperbolic segment', () => {
  it('reports what is defined and marks r_p, r_a and T as not defined, without throwing', () => {
    const histories = historiesOf(escape);
    const after = histories.segments[1];
    if (after === undefined) {
      throw new Error('expected a post-maneuver segment');
    }
    expect(after.conic.every((c) => c === 'HYPERBOLIC')).toBe(true);
    expect(after.closedOrbitFailure.every((f) => f === 'NOT_CLOSED_ORBIT')).toBe(true);
    for (const q of ['periapsisRadius_m', 'apoapsisRadius_m', 'period_s'] as const) {
      expect(values(after, q).every((x) => x === null)).toBe(true);
    }
    expect(numbers(after, 'semiMajorAxis_m').every((a) => a < 0)).toBe(true);
    expect(numbers(after, 'eccentricity').every((e) => e > 1)).toBe(true);
    expect(numbers(after, 'specificEnergy_m2ps2').every((x) => x > 0)).toBe(true);
    for (const q of ['radius_m', 'altitude_m', 'speed_mps', 'trueAnomaly_rad'] as const) {
      expect(numbers(after, q)).toHaveLength(after.t_s.length);
    }
    // The pre-maneuver segment is still elliptic with every value defined.
    const before = histories.segments[0];
    expect(before?.conic.every((c) => c === 'ELLIPTIC')).toBe(true);
    expect(before?.closedOrbitFailure.every((f) => f === null)).toBe(true);
  });
});

describe('computeHistories: failures', () => {
  it('RESULT_FAILED for a failed result', () => {
    const failed: SimulationResult = { ...coast, status: 'failed', segments: [], events: [] };
    expect(computeHistories(failed)).toEqual({ ok: false, reason: 'RESULT_FAILED' });
  });

  it('NON_FINITE_SAMPLE for a hand-built segment with a NaN (no exception)', () => {
    const segment = coast.segments[0];
    if (segment === undefined) {
      throw new Error('no segment');
    }
    const position_m = new Float64Array(segment.position_m);
    position_m[4] = Number.NaN;
    const bad: SimulationResult = { ...coast, segments: [{ ...segment, position_m }] };
    expect(computeHistories(bad)).toEqual({
      ok: false,
      reason: 'NON_FINITE_SAMPLE',
      segmentIndex: 0,
      sampleIndex: 1,
    });
  });
});

describe('computeHistories: determinism and purity', () => {
  it('two evaluations are bit-identical and the result is not mutated', () => {
    const snapshot = tangential.segments.map((s) => [
      Array.from(s.t_s),
      Array.from(s.position_m),
      Array.from(s.velocity_mps),
    ]);
    const first = historiesOf(tangential);
    const second = historiesOf(tangential);
    expect(second).toEqual(first);
    first.segments.forEach((segment, n) => {
      segment.series.forEach((s, j) => {
        const other = second.segments[n]?.series[j];
        expect(s.values.every((x, k) => Object.is(x, other?.values[k]))).toBe(true);
      });
    });
    expect(
      tangential.segments.map((s) => [
        Array.from(s.t_s),
        Array.from(s.position_m),
        Array.from(s.velocity_mps),
      ]),
    ).toEqual(snapshot);
  });
});
