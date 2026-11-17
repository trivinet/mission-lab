/**
 * Time histories per trajectory segment (ML-TASK-031; ML-FR-009 AC1, AC3; ML-SYS-001 §2.2).
 *
 * Derived only from a SimulationResult (proposed-architecture §2 module E; ADR-002): the samples
 * of each segment and `model.constants` (μ, reference radius). Each value is `stateQuantities`
 * (state-quantities.ts) of that sample, i.e. an existing packages/astrodynamics function applied
 * to the sample; see that module for the function behind each quantity. No interpolation, no
 * resampling: one value per stored sample, at the sample's own `t_s`.
 *
 * Segments are never joined across a maneuver: segment n's history ends with the pre-maneuver
 * sample at the event time and segment n + 1's starts with the post-maneuver sample at the same
 * time (contract R8), so a plot draws a step, not a ramp, at the maneuver.
 *
 * Elements are constant between maneuvers in two-body motion, so their histories are flat on each
 * segment by design (ML-SYS-001 §2.2: a visible conservation check); the variation shown is the
 * engine's rounding and propagation error.
 *
 * Not provided (no packages/astrodynamics function exists; adding one is out of scope of this
 * task): flight-path angle and mean anomaly (ML-SYS-001 §2.2). Reported to the coordinator.
 *
 * Units SI (unit of each series in `HistorySeries.unit`). Frame: the result frame (GCRF in M1);
 * angles refer to its axes. Pure, deterministic; never throws; no NaN or ±Infinity is returned:
 * a value that is not defined at a sample is `null`, with the reason in the segment.
 */
import type {
  ClosedOrbitQuantitiesFailure,
  ConicType,
  DegenerateConvention,
  StateIntegralsFailure,
  StateToElementsFailure,
} from '@mission-lab/astrodynamics';
import type { SimulationResult } from '@mission-lab/contracts';
import { stateQuantities } from './state-quantities';
import type { StateQuantities } from './state-quantities';

/** Identifier of a history quantity (the name carries the unit suffix). */
export type HistoryQuantity =
  | 'radius_m'
  | 'altitude_m'
  | 'speed_mps'
  | 'trueAnomaly_rad'
  | 'semiMajorAxis_m'
  | 'eccentricity'
  | 'inclination_rad'
  | 'raan_rad'
  | 'argPeriapsis_rad'
  | 'specificEnergy_m2ps2'
  | 'periapsisRadius_m'
  | 'apoapsisRadius_m'
  | 'period_s';

/** Unit of a series ('1' = dimensionless). SI; the UI converts for display. */
export type HistoryUnit = 'm' | 'm/s' | 'rad' | '1' | 'm^2/s^2' | 's';

/**
 * The quantities in their fixed output order, with unit and source function. The `trueAnomaly_rad`,
 * `raan_rad` and `argPeriapsis_rad` values are those reported by `stateToElements` under the
 * degenerate-element convention of the sample (ADR-008; `SegmentHistory.convention`): e.g. for a
 * CIRCULAR sample ω is the assigned 0 and ν the argument of latitude.
 */
export const HISTORY_QUANTITIES: readonly {
  readonly quantity: HistoryQuantity;
  readonly unit: HistoryUnit;
  readonly source: string;
}[] = Object.freeze([
  { quantity: 'radius_m', unit: 'm', source: 'normVec3(position_m)' },
  {
    quantity: 'altitude_m',
    unit: 'm',
    source: 'normVec3(position_m) - referenceRadius_m (above the reference sphere)',
  },
  { quantity: 'speed_mps', unit: 'm/s', source: 'normVec3(velocity_mps)' },
  { quantity: 'trueAnomaly_rad', unit: 'rad', source: 'stateToElements(...).elements' },
  { quantity: 'semiMajorAxis_m', unit: 'm', source: 'stateToElements(...).elements' },
  { quantity: 'eccentricity', unit: '1', source: 'stateToElements(...).elements' },
  { quantity: 'inclination_rad', unit: 'rad', source: 'stateToElements(...).elements' },
  { quantity: 'raan_rad', unit: 'rad', source: 'stateToElements(...).elements' },
  { quantity: 'argPeriapsis_rad', unit: 'rad', source: 'stateToElements(...).elements' },
  { quantity: 'specificEnergy_m2ps2', unit: 'm^2/s^2', source: 'stateIntegrals(r, v, mu)' },
  { quantity: 'periapsisRadius_m', unit: 'm', source: 'closedOrbitQuantities(a, e, mu)' },
  { quantity: 'apoapsisRadius_m', unit: 'm', source: 'closedOrbitQuantities(a, e, mu)' },
  { quantity: 'period_s', unit: 's', source: 'closedOrbitQuantities(a, e, mu)' },
]);

/** One quantity over one segment. `values[k]` belongs to `t_s[k]`; `null` = not defined there. */
export interface HistorySeries {
  readonly quantity: HistoryQuantity;
  readonly unit: HistoryUnit;
  readonly segmentIndex: number;
  /** Sample times [s from epoch], the segment's `t_s` (bit-identical copies). */
  readonly t_s: readonly number[];
  readonly values: readonly (number | null)[];
}

/** All series of one segment, plus the per-sample classification and failure reasons. */
export interface SegmentHistory {
  readonly segmentIndex: number;
  readonly t_s: readonly number[];
  /** Series in the order of HISTORY_QUANTITIES. */
  readonly series: readonly HistorySeries[];
  /** Degenerate-element convention per sample (ADR-008); `null` where stateToElements declined. */
  readonly convention: readonly (DegenerateConvention | null)[];
  /** Conic type per sample (sign of ξ); `null` where stateToElements declined. */
  readonly conic: readonly (ConicType | null)[];
  /** Per sample: stateToElements failure, or `null`. Elements and closed-orbit values are null. */
  readonly elementsFailure: readonly (StateToElementsFailure | null)[];
  /** Per sample: stateIntegrals failure, or `null`. */
  readonly specificEnergyFailure: readonly (StateIntegralsFailure | null)[];
  /**
   * Per sample: why r_p, r_a and T are null ('NOT_CLOSED_ORBIT' on a hyperbolic sample: no
   * apoapsis, no period), or `null` when they are defined.
   */
  readonly closedOrbitFailure: readonly (
    ClosedOrbitQuantitiesFailure | 'ELEMENTS_UNAVAILABLE' | null
  )[];
}

/** Histories of one result. */
export interface ResultHistories {
  readonly requestId: string;
  /** One entry per result segment, in segment order; `segments[n].segmentIndex === n`. */
  readonly segments: readonly SegmentHistory[];
}

/** Why `computeHistories` returns no histories. */
export type ComputeHistoriesFailure =
  /** `result.status === 'failed'`: there are no samples (contract R1). */
  | 'RESULT_FAILED'
  /**
   * A sample could not be evaluated (non-finite input to stateQuantities). Unreachable for a result
   * that passes validateSimulationResult (R5); guards hand-built inputs.
   */
  | 'NON_FINITE_SAMPLE';

export type ComputeHistoriesResult =
  | { readonly ok: true; readonly histories: ResultHistories }
  | {
      readonly ok: false;
      readonly reason: ComputeHistoriesFailure;
      /** Segment and sample of a NON_FINITE_SAMPLE failure. */
      readonly segmentIndex?: number;
      readonly sampleIndex?: number;
    };

function valueOf(q: StateQuantities, quantity: HistoryQuantity): number | null {
  switch (quantity) {
    case 'radius_m':
      return q.radius_m;
    case 'altitude_m':
      return q.altitude_m;
    case 'speed_mps':
      return q.speed_mps;
    case 'trueAnomaly_rad':
      return q.elements?.trueAnomaly_rad ?? null;
    case 'semiMajorAxis_m':
      return q.elements?.semiMajorAxis_m ?? null;
    case 'eccentricity':
      return q.elements?.eccentricity ?? null;
    case 'inclination_rad':
      return q.elements?.inclination_rad ?? null;
    case 'raan_rad':
      return q.elements?.raan_rad ?? null;
    case 'argPeriapsis_rad':
      return q.elements?.argPeriapsis_rad ?? null;
    case 'specificEnergy_m2ps2':
      return q.specificEnergy_m2ps2;
    case 'periapsisRadius_m':
      return q.closedOrbit?.periapsisRadius_m ?? null;
    case 'apoapsisRadius_m':
      return q.closedOrbit?.apoapsisRadius_m ?? null;
    case 'period_s':
      return q.closedOrbit?.period_s ?? null;
  }
}

/**
 * Time histories of every HISTORY_QUANTITIES entry for each segment of an ok SimulationResult.
 *
 * Input: a SimulationResult (contracts-v1 §5) as returned by `runSimulation`; it is read, never
 * mutated. μ and the reference radius come from `result.model.constants`.
 * Output: per segment, one series per quantity with the segment's `t_s`, its index, unit and id.
 */
export function computeHistories(result: SimulationResult): ComputeHistoriesResult {
  if (result.status !== 'ok') {
    return { ok: false, reason: 'RESULT_FAILED' };
  }
  const constants = {
    mu_m3ps2: result.model.constants.mu_m3ps2,
    referenceRadius_m: result.model.constants.referenceRadius_m,
  };
  const segments: SegmentHistory[] = [];
  for (const segment of result.segments) {
    const count = segment.t_s.length;
    const t_s = Array.from(segment.t_s);
    const samples: StateQuantities[] = [];
    for (let k = 0; k < count; k++) {
      const r = segment.position_m;
      const v = segment.velocity_mps;
      const evaluated = stateQuantities(
        [r[3 * k] ?? Number.NaN, r[3 * k + 1] ?? Number.NaN, r[3 * k + 2] ?? Number.NaN],
        [v[3 * k] ?? Number.NaN, v[3 * k + 1] ?? Number.NaN, v[3 * k + 2] ?? Number.NaN],
        constants,
      );
      if (!evaluated.ok) {
        return {
          ok: false,
          reason: 'NON_FINITE_SAMPLE',
          segmentIndex: segment.index,
          sampleIndex: k,
        };
      }
      samples.push(evaluated.quantities);
    }
    const series = HISTORY_QUANTITIES.map(({ quantity, unit }): HistorySeries => ({
      quantity,
      unit,
      segmentIndex: segment.index,
      t_s,
      values: samples.map((q) => valueOf(q, quantity)),
    }));
    segments.push({
      segmentIndex: segment.index,
      t_s,
      series,
      convention: samples.map((q) => q.elements?.convention ?? null),
      conic: samples.map((q) => q.elements?.conic ?? null),
      elementsFailure: samples.map((q) => q.elementsFailure),
      specificEnergyFailure: samples.map((q) => q.specificEnergyFailure),
      closedOrbitFailure: samples.map((q) => q.closedOrbitFailure),
    });
  }
  return { ok: true, histories: { requestId: result.requestId, segments } };
}

/** The series of `quantity` in a segment history (convenience for the plots). */
export function historySeries(
  segment: SegmentHistory,
  quantity: HistoryQuantity,
): HistorySeries | undefined {
  return segment.series.find((s) => s.quantity === quantity);
}
