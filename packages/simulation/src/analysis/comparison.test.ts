/**
 * Plumbing and structure tests of compareCoastAndManeuver (ML-TASK-031). Before/after values are
 * checked to be stateQuantities of the R8 event states (Object.is), differences after − before,
 * the Δv fields copies of the event and the request. FR-010 AC3 (values against independent
 * references) is the Verification Engineer's; no reference value appears here.
 */
import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { leoScenario, maneuver, requestOf, runOk } from '../test-fixtures';
import { buildCoastRequest } from './coast-request';
import { COMPARISON_QUANTITIES, compareCoastAndManeuver } from './comparison';
import type { ComparisonQuantity, ComparisonRow, ManeuverComparison } from './comparison';
import { stateQuantities } from './state-quantities';
import type { StateQuantities } from './state-quantities';
import { defaultLikeScenario } from './test-helpers';
import type { Scenario } from '@mission-lab/contracts';

interface Pair {
  readonly request: SimulationRequest;
  readonly maneuvered: SimulationResult;
  readonly coast: SimulationResult;
}

function pairOf(scenario: Scenario): Pair {
  const request = requestOf(scenario);
  const coastRequest = buildCoastRequest(scenario);
  if (!coastRequest.ok) {
    throw new Error('coast request rejected');
  }
  return { request, maneuvered: runOk(request), coast: runOk(coastRequest.value) };
}

function compared(pair: Pair): ManeuverComparison {
  const outcome = compareCoastAndManeuver(pair.coast, pair.maneuvered, pair.request);
  if (!outcome.ok) {
    throw new Error(`comparison failed: ${outcome.reason}`);
  }
  expect(outcome.comparison.maneuvers).toHaveLength(1);
  const m = outcome.comparison.maneuvers[0];
  if (m === undefined) {
    throw new Error('no maneuver comparison');
  }
  return m;
}

function rowOf(m: ManeuverComparison, quantity: ComparisonQuantity): ComparisonRow {
  const r = m.rows.find((x) => x.quantity === quantity);
  if (r === undefined) {
    throw new Error(`no row ${quantity}`);
  }
  return r;
}

function quantitiesOf(r: readonly number[], v: readonly number[], result: SimulationResult) {
  const q = stateQuantities(
    [r[0] ?? Number.NaN, r[1] ?? Number.NaN, r[2] ?? Number.NaN],
    [v[0] ?? Number.NaN, v[1] ?? Number.NaN, v[2] ?? Number.NaN],
    result.model.constants,
  );
  if (!q.ok) {
    throw new Error('state rejected');
  }
  return q.quantities;
}

function expectedValue(q: StateQuantities, quantity: ComparisonQuantity): number | null {
  switch (quantity) {
    case 'specificEnergy_m2ps2':
      return q.specificEnergy_m2ps2;
    case 'periapsisRadius_m':
    case 'apoapsisRadius_m':
    case 'period_s':
      return q.closedOrbit?.[quantity] ?? null;
    default:
      return q.elements?.[quantity] ?? null;
  }
}

const burn_s = 3000;
const defaultBurn = pairOf(defaultLikeScenario({ maneuvers: [maneuver(burn_s, [0, 100, 0])] }));
const leoBurn = pairOf(leoScenario({ maneuvers: [maneuver(1000, [0, 50, 0])] }));
const escapeBurn = pairOf(leoScenario({ maneuvers: [maneuver(1000, [0, 4000, 0])] }));

describe('compareCoastAndManeuver: plumbing', () => {
  for (const [name, pair] of [
    ['default-like orbit, +100 m/s along S', defaultBurn],
    ['LEO, +50 m/s along S', leoBurn],
    ['escape burn', escapeBurn],
  ] as const) {
    it(`${name}: rows are stateQuantities of the R8 event states, difference = after − before`, () => {
      const m = compared(pair);
      const event = pair.maneuvered.events[0];
      if (event === undefined) {
        throw new Error('no event');
      }
      expect(m.maneuverId).toBe(event.maneuverId);
      expect(m.t_s).toBe(event.t_s);
      expect(m.rows.map((r) => [r.quantity, r.unit])).toEqual(
        COMPARISON_QUANTITIES.map((q) => [q.quantity, q.unit]),
      );
      const before = quantitiesOf(event.position_m, event.velocityBefore_mps, pair.maneuvered);
      const after = quantitiesOf(event.position_m, event.velocityAfter_mps, pair.maneuvered);
      expect(m.before).toEqual({
        convention: before.elements?.convention,
        conic: before.elements?.conic,
      });
      expect(m.after).toEqual({
        convention: after.elements?.convention,
        conic: after.elements?.conic,
      });
      for (const r of m.rows) {
        const b = expectedValue(before, r.quantity);
        const a = expectedValue(after, r.quantity);
        expect(Object.is(r.before, b), `${r.quantity} before`).toBe(true);
        expect(Object.is(r.after, a), `${r.quantity} after`).toBe(true);
        if (
          r.difference !== null &&
          r.quantity !== 'raan_rad' &&
          r.quantity !== 'argPeriapsis_rad'
        ) {
          expect(Object.is(r.difference, (a ?? Number.NaN) - (b ?? Number.NaN))).toBe(true);
        }
        for (const x of [r.before, r.after, r.difference]) {
          expect(x === null || Number.isFinite(x)).toBe(true);
        }
      }
      expect(m.deltaV.inertial_mps).toEqual(event.deltaV_inertial_mps);
      expect(Object.is(m.deltaV.magnitude_mps, event.deltaV_magnitude_mps)).toBe(true);
      expect(m.deltaV.rsw_mps).toEqual(pair.request.maneuvers[0]?.deltaV_mps);
    });
  }

  it('before is the last sample of segment n and after the first sample of segment n + 1', () => {
    const m = compared(defaultBurn);
    const seg0 = defaultBurn.maneuvered.segments[0];
    const seg1 = defaultBurn.maneuvered.segments[1];
    if (seg0 === undefined || seg1 === undefined) {
      throw new Error('expected two segments');
    }
    const k = seg0.t_s.length - 1;
    const before = quantitiesOf(
      Array.from(seg0.position_m.subarray(3 * k, 3 * k + 3)),
      Array.from(seg0.velocity_mps.subarray(3 * k, 3 * k + 3)),
      defaultBurn.maneuvered,
    );
    const after = quantitiesOf(
      Array.from(seg1.position_m.subarray(0, 3)),
      Array.from(seg1.velocity_mps.subarray(0, 3)),
      defaultBurn.maneuvered,
    );
    expect(Object.is(rowOf(m, 'semiMajorAxis_m').before, before.elements?.semiMajorAxis_m)).toBe(
      true,
    );
    expect(Object.is(rowOf(m, 'semiMajorAxis_m').after, after.elements?.semiMajorAxis_m)).toBe(
      true,
    );
  });

  it('angle differences of Ω and ω lie in (−π, π]', () => {
    for (const pair of [defaultBurn, leoBurn]) {
      const m = compared(pair);
      for (const q of ['raan_rad', 'argPeriapsis_rad'] as const) {
        const d = rowOf(m, q).difference;
        if (d !== null) {
          expect(d).toBeGreaterThan(-Math.PI);
          expect(d).toBeLessThanOrEqual(Math.PI);
        }
      }
    }
  });
});

describe('compareCoastAndManeuver: behaviour of a prograde tangential burn', () => {
  it('a, r_a, T and ξ increase; Δv fields are the requested and applied increment', () => {
    const m = compared(defaultBurn);
    for (const q of [
      'semiMajorAxis_m',
      'apoapsisRadius_m',
      'period_s',
      'specificEnergy_m2ps2',
    ] as const) {
      expect(rowOf(m, q).difference, q).toBeGreaterThan(0);
    }
    expect(m.deltaV.rsw_mps).toEqual([0, 100, 0]);
    expect(m.before.conic).toBe('ELLIPTIC');
    expect(m.after.conic).toBe('ELLIPTIC');
    for (const r of m.rows) {
      expect(r.absent).toEqual({});
    }
  });
});

describe('compareCoastAndManeuver: hyperbolic after-state', () => {
  it('r_p, r_a and T after are null (NOT_CLOSED_ORBIT); a, e, ξ are reported', () => {
    const m = compared(escapeBurn);
    expect(m.after.conic).toBe('HYPERBOLIC');
    for (const q of ['periapsisRadius_m', 'apoapsisRadius_m', 'period_s'] as const) {
      const r = rowOf(m, q);
      expect(r.before).not.toBeNull();
      expect(r.after).toBeNull();
      expect(r.difference).toBeNull();
      expect(r.absent).toEqual({ after: 'NOT_CLOSED_ORBIT', difference: 'OPERAND_UNAVAILABLE' });
    }
    expect(rowOf(m, 'semiMajorAxis_m').after).toBeLessThan(0);
    expect(rowOf(m, 'eccentricity').after).toBeGreaterThan(1);
    expect(rowOf(m, 'specificEnergy_m2ps2').after).toBeGreaterThan(0);
  });
});

describe('compareCoastAndManeuver: degenerate convention', () => {
  it('ω difference is NOT_COMPARABLE when the before-orbit is circular (ω assigned 0)', () => {
    const circular = pairOf(
      leoScenario({
        initialOrbit: {
          kind: 'KEPLERIAN',
          elements: {
            semiMajorAxis_m: 7000000,
            eccentricity: 0,
            inclination_rad: 0.9,
            raan_rad: 1,
            argPeriapsis_rad: 0,
            trueAnomaly_rad: 0.5,
          },
        },
        maneuvers: [maneuver(1200, [0, 100, 0])],
      }),
    );
    const m = compared(circular);
    expect(m.before.convention).toBe('CIRCULAR');
    expect(m.after.convention).toBe('NONE');
    const omega = rowOf(m, 'argPeriapsis_rad');
    expect(omega.before).toBe(0);
    expect(omega.difference).toBeNull();
    expect(omega.absent).toEqual({ difference: 'NOT_COMPARABLE' });
    // Ω is the RAAN on both sides (inclined orbit): comparable.
    expect(rowOf(m, 'raan_rad').difference).not.toBeNull();
  });
});

describe('compareCoastAndManeuver: maneuver at t = 0', () => {
  it('before-state is the request initial state', () => {
    const pair = pairOf(leoScenario({ maneuvers: [maneuver(0, [10, 0, 0])] }));
    const m = compared(pair);
    const q = quantitiesOf(
      pair.request.initialState.position_m,
      pair.request.initialState.velocity_mps,
      pair.maneuvered,
    );
    expect(Object.is(rowOf(m, 'eccentricity').before, q.elements?.eccentricity)).toBe(true);
  });
});

describe('compareCoastAndManeuver: failures (no exception)', () => {
  const { coast, maneuvered, request } = defaultBurn;

  it('COAST_RESULT_FAILED / MANEUVERED_RESULT_FAILED', () => {
    const failed = (r: SimulationResult): SimulationResult => ({
      ...r,
      status: 'failed',
      segments: [],
      events: [],
    });
    expect(compareCoastAndManeuver(failed(coast), maneuvered, request)).toEqual({
      ok: false,
      reason: 'COAST_RESULT_FAILED',
    });
    expect(compareCoastAndManeuver(coast, failed(maneuvered), request)).toEqual({
      ok: false,
      reason: 'MANEUVERED_RESULT_FAILED',
    });
  });

  it('COAST_HAS_MANEUVER and NO_MANEUVER when the runs are swapped', () => {
    expect(compareCoastAndManeuver(maneuvered, maneuvered, request).ok).toBe(false);
    expect(compareCoastAndManeuver(maneuvered, maneuvered, request)).toEqual({
      ok: false,
      reason: 'COAST_HAS_MANEUVER',
    });
    expect(compareCoastAndManeuver(coast, coast, request)).toEqual({
      ok: false,
      reason: 'NO_MANEUVER',
    });
  });

  it('REQUEST_RESULT_MISMATCH when the request is not the one that produced the result', () => {
    expect(compareCoastAndManeuver(coast, maneuvered, leoBurn.request)).toEqual({
      ok: false,
      reason: 'REQUEST_RESULT_MISMATCH',
    });
  });

  it('SPAN_OR_MODEL_MISMATCH for a coast run over a different span', () => {
    const shorter = buildCoastRequest(defaultLikeScenario({ duration_s: 5940 }));
    if (!shorter.ok) {
      throw new Error('rejected');
    }
    expect(compareCoastAndManeuver(runOk(shorter.value), maneuvered, request)).toEqual({
      ok: false,
      reason: 'SPAN_OR_MODEL_MISMATCH',
    });
  });

  it('INITIAL_STATE_MISMATCH for a coast run of another orbit', () => {
    const other = buildCoastRequest(leoScenario());
    if (!other.ok) {
      throw new Error('rejected');
    }
    expect(compareCoastAndManeuver(runOk(other.value), maneuvered, request)).toEqual({
      ok: false,
      reason: 'INITIAL_STATE_MISMATCH',
    });
  });

  it('MANEUVER_NOT_IN_REQUEST when the event id is not in the request', () => {
    const renamed: SimulationRequest = {
      ...request,
      maneuvers: request.maneuvers.map((x) => ({ ...x, id: 'other-burn' })),
    };
    expect(compareCoastAndManeuver(coast, maneuvered, renamed)).toEqual({
      ok: false,
      reason: 'MANEUVER_NOT_IN_REQUEST',
    });
  });
});

describe('compareCoastAndManeuver: determinism', () => {
  it('two evaluations are bit-identical', () => {
    const a = compareCoastAndManeuver(
      defaultBurn.coast,
      defaultBurn.maneuvered,
      defaultBurn.request,
    );
    const b = compareCoastAndManeuver(
      defaultBurn.coast,
      defaultBurn.maneuvered,
      defaultBurn.request,
    );
    expect(b).toEqual(a);
    if (!a.ok || !b.ok) {
      throw new Error('comparison failed');
    }
    a.comparison.maneuvers[0]?.rows.forEach((r, j) => {
      const s = b.comparison.maneuvers[0]?.rows[j];
      expect(Object.is(r.before, s?.before) && Object.is(r.after, s?.after)).toBe(true);
      expect(Object.is(r.difference, s?.difference)).toBe(true);
    });
  });
});
