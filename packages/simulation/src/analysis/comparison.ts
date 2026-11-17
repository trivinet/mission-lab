/**
 * Coast-versus-maneuver comparison (ML-TASK-031; ML-FR-010 AC1, AC2; ML-SYS-001 §2.2).
 *
 * Inputs: the coast result (same scenario, no maneuver, same span), the maneuvered result, and the
 * maneuvered request (only for the RSW components of the applied Δv, which the result does not
 * carry: contracts-v1 §5 `ManeuverEvent` holds the inertial Δv and its magnitude).
 *
 * "Before" and "after" are the contract R8 event states of the maneuvered result:
 * before = (event.position_m, event.velocityBefore_mps) = last sample of segment n,
 * after  = (event.position_m, event.velocityAfter_mps)  = first sample of segment n + 1.
 * The coast run is propagated from the same initial state, so its orbit is the "before" orbit;
 * it is checked for consistency (same initial state, constants and span, no maneuver) and is what
 * the UI draws next to the maneuvered trajectory (FR-010 AC1). No coast sample enters the table:
 * the coast grid need not contain the maneuver time.
 *
 * Values: `stateQuantities` (state-quantities.ts) of each event state, i.e. stateToElements with
 * DEGENERACY_THRESHOLDS, stateIntegrals and closedOrbitQuantities of packages/astrodynamics. No
 * new physics. Differences are after − before (one binary64 subtraction); for Ω and ω the
 * difference is reduced to (−π, π] (normalizeAngle_rad to [0, 2π), then − TWO_PI_rad when > π),
 * the reduction tolerances.md §8 VI-03 applies to angle differences.
 *
 * Units SI; frame: the result frame (GCRF in M1); RSW is the local frame of the pre-maneuver state
 * (contracts-v1 §2). Pure, deterministic; never throws; no NaN or ±Infinity is returned: a value
 * that is not defined is `null` with a reason.
 */
import { normalizeAngle_rad, TWO_PI_rad } from '@mission-lab/astrodynamics';
import type { ConicType, DegenerateConvention, Vec3 } from '@mission-lab/astrodynamics';
import type { ManeuverEvent, SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { stateQuantities } from './state-quantities';
import type { StateQuantities } from './state-quantities';

/** Rows of the comparison table (ML-FR-010 AC2), in this order. */
export type ComparisonQuantity =
  | 'semiMajorAxis_m'
  | 'eccentricity'
  | 'inclination_rad'
  | 'raan_rad'
  | 'argPeriapsis_rad'
  | 'periapsisRadius_m'
  | 'apoapsisRadius_m'
  | 'period_s'
  | 'specificEnergy_m2ps2';

export type ComparisonUnit = 'm' | '1' | 'rad' | 's' | 'm^2/s^2';

export const COMPARISON_QUANTITIES: readonly {
  readonly quantity: ComparisonQuantity;
  readonly unit: ComparisonUnit;
}[] = Object.freeze([
  { quantity: 'semiMajorAxis_m', unit: 'm' },
  { quantity: 'eccentricity', unit: '1' },
  { quantity: 'inclination_rad', unit: 'rad' },
  { quantity: 'raan_rad', unit: 'rad' },
  { quantity: 'argPeriapsis_rad', unit: 'rad' },
  { quantity: 'periapsisRadius_m', unit: 'm' },
  { quantity: 'apoapsisRadius_m', unit: 'm' },
  { quantity: 'period_s', unit: 's' },
  { quantity: 'specificEnergy_m2ps2', unit: 'm^2/s^2' },
]);

/** Why a before, after or difference value is `null`. */
export type ComparisonValueAbsence =
  /** stateToElements declined for that state (e.g. exactly parabolic: SEMI_MAJOR_AXIS_UNDEFINED). */
  | 'ELEMENTS_UNAVAILABLE'
  /** closedOrbitQuantities declined: open (hyperbolic) orbit, no apoapsis and no period. */
  | 'NOT_CLOSED_ORBIT'
  /** stateIntegrals declined (unreachable for a valid result: r ≠ 0, finite). */
  | 'ENERGY_UNAVAILABLE'
  /** Difference only: one of the two values is null. */
  | 'OPERAND_UNAVAILABLE'
  /**
   * Difference only: the element is undefined or has a different meaning on the two sides under
   * the degenerate-element convention (ADR-008), e.g. ω of a circular orbit, or Ω of an
   * equatorial one; the difference of two such numbers is not the change of one element.
   */
  | 'NOT_COMPARABLE';

/** One table row. `difference` = after − before (angles reduced to (−π, π]). */
export interface ComparisonRow {
  readonly quantity: ComparisonQuantity;
  readonly unit: ComparisonUnit;
  readonly before: number | null;
  readonly after: number | null;
  readonly difference: number | null;
  /** Reasons for each null (absent key = value present). */
  readonly absent: {
    readonly before?: ComparisonValueAbsence;
    readonly after?: ComparisonValueAbsence;
    readonly difference?: ComparisonValueAbsence;
  };
}

/** Classification of one event state (ADR-008; conic from the sign of ξ). */
export interface StateClassification {
  readonly convention: DegenerateConvention | null;
  readonly conic: ConicType | null;
}

/** The applied impulsive Δv (contracts-v1 §5 ManeuverEvent and the request maneuver). */
export interface AppliedDeltaV {
  /** Δv in the result frame [m/s] (event.deltaV_inertial_mps, copied). */
  readonly inertial_mps: Vec3;
  /** Δv in the RSW frame of the pre-maneuver state [m/s], as requested (request maneuver). */
  readonly rsw_mps: Vec3;
  /** |Δv| [m/s] (event.deltaV_magnitude_mps, copied). */
  readonly magnitude_mps: number;
}

/** Comparison for one maneuver event. */
export interface ManeuverComparison {
  readonly maneuverId: string;
  /** Maneuver time [s from epoch]. */
  readonly t_s: number;
  readonly before: StateClassification;
  readonly after: StateClassification;
  /** Rows in the order of COMPARISON_QUANTITIES. */
  readonly rows: readonly ComparisonRow[];
  readonly deltaV: AppliedDeltaV;
}

export interface CoastManeuverComparison {
  readonly coastRequestId: string;
  readonly maneuveredRequestId: string;
  /** One entry per event of the maneuvered result, in event order (one in M1). */
  readonly maneuvers: readonly ManeuverComparison[];
}

/** Why `compareCoastAndManeuver` returns no comparison. */
export type CompareFailure =
  /** coast.status is 'failed'. */
  | 'COAST_RESULT_FAILED'
  /** maneuvered.status is 'failed'. */
  | 'MANEUVERED_RESULT_FAILED'
  /** The coast result has a maneuver event. */
  | 'COAST_HAS_MANEUVER'
  /** The maneuvered result has no maneuver event. */
  | 'NO_MANEUVER'
  /** The two results differ in duration_s, epoch or constants (μ, reference radius). */
  | 'SPAN_OR_MODEL_MISMATCH'
  /** The first samples of segment 0 differ (not bit-identical): not the same initial state. */
  | 'INITIAL_STATE_MISMATCH'
  /** maneuveredRequest.requestId differs from maneuvered.requestId. */
  | 'REQUEST_RESULT_MISMATCH'
  /** An event's maneuverId is not in maneuveredRequest.maneuvers. */
  | 'MANEUVER_NOT_IN_REQUEST'
  /** An event state could not be evaluated (unreachable for a valid result, R5). */
  | 'NON_FINITE_STATE';

export type CompareResult =
  | { readonly ok: true; readonly comparison: CoastManeuverComparison }
  | { readonly ok: false; readonly reason: CompareFailure };

function firstSample(result: SimulationResult): number[] | null {
  const s = result.segments[0];
  if (s === undefined || s.t_s.length === 0) {
    return null;
  }
  return [...Array.from(s.position_m.subarray(0, 3)), ...Array.from(s.velocity_mps.subarray(0, 3))];
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

/** Angle difference after − before reduced to (−π, π] (see module header). */
function angleDifference_rad(after_rad: number, before_rad: number): number | null {
  const wrapped = normalizeAngle_rad(after_rad - before_rad);
  if (!wrapped.ok) {
    return null;
  }
  return wrapped.angle_rad > Math.PI ? wrapped.angle_rad - TWO_PI_rad : wrapped.angle_rad;
}

/** Ω is comparable when it is the RAAN on both sides (neither side equatorial). */
function raanComparable(b: DegenerateConvention, a: DegenerateConvention): boolean {
  const isRaan = (c: DegenerateConvention): boolean => c === 'NONE' || c === 'CIRCULAR';
  return isRaan(b) && isRaan(a);
}

/**
 * ω is comparable when it has the same, computed meaning on both sides: argument of periapsis
 * (NONE) on both, or longitude of periapsis (EQUATORIAL) on both. Circular: ω is assigned 0.
 */
function argPeriapsisComparable(b: DegenerateConvention, a: DegenerateConvention): boolean {
  return b === a && (a === 'NONE' || a === 'EQUATORIAL');
}

interface SideValue {
  readonly value: number | null;
  readonly absent?: ComparisonValueAbsence;
}

function sideValue(q: StateQuantities, quantity: ComparisonQuantity): SideValue {
  if (quantity === 'specificEnergy_m2ps2') {
    return q.specificEnergy_m2ps2 === null
      ? { value: null, absent: 'ENERGY_UNAVAILABLE' }
      : { value: q.specificEnergy_m2ps2 };
  }
  if (q.elements === null) {
    return { value: null, absent: 'ELEMENTS_UNAVAILABLE' };
  }
  switch (quantity) {
    case 'semiMajorAxis_m':
      return { value: q.elements.semiMajorAxis_m };
    case 'eccentricity':
      return { value: q.elements.eccentricity };
    case 'inclination_rad':
      return { value: q.elements.inclination_rad };
    case 'raan_rad':
      return { value: q.elements.raan_rad };
    case 'argPeriapsis_rad':
      return { value: q.elements.argPeriapsis_rad };
    case 'periapsisRadius_m':
    case 'apoapsisRadius_m':
    case 'period_s':
      return q.closedOrbit === null
        ? { value: null, absent: 'NOT_CLOSED_ORBIT' }
        : { value: q.closedOrbit[quantity] };
  }
}

function row(
  quantity: ComparisonQuantity,
  unit: ComparisonUnit,
  before: StateQuantities,
  after: StateQuantities,
): ComparisonRow {
  const b = sideValue(before, quantity);
  const a = sideValue(after, quantity);
  const absent: { -readonly [K in keyof ComparisonRow['absent']]: ComparisonValueAbsence } = {};
  if (b.absent !== undefined) {
    absent.before = b.absent;
  }
  if (a.absent !== undefined) {
    absent.after = a.absent;
  }
  let difference: number | null = null;
  if (b.value === null || a.value === null) {
    absent.difference = 'OPERAND_UNAVAILABLE';
  } else if (quantity === 'raan_rad' || quantity === 'argPeriapsis_rad') {
    const cb = before.elements?.convention ?? 'NONE';
    const ca = after.elements?.convention ?? 'NONE';
    const comparable =
      quantity === 'raan_rad' ? raanComparable(cb, ca) : argPeriapsisComparable(cb, ca);
    if (comparable) {
      difference = angleDifference_rad(a.value, b.value);
    }
    if (difference === null) {
      absent.difference = 'NOT_COMPARABLE';
    }
  } else {
    difference = a.value - b.value;
    if (!Number.isFinite(difference)) {
      difference = null;
      absent.difference = 'OPERAND_UNAVAILABLE';
    }
  }
  return { quantity, unit, before: b.value, after: a.value, difference, absent };
}

function classify(q: StateQuantities): StateClassification {
  return { convention: q.elements?.convention ?? null, conic: q.elements?.conic ?? null };
}

function compareEvent(
  event: ManeuverEvent,
  request: SimulationRequest,
  constants: { mu_m3ps2: number; referenceRadius_m: number },
): ManeuverComparison | CompareFailure {
  const requested = request.maneuvers.find((m) => m.id === event.maneuverId);
  if (requested === undefined) {
    return 'MANEUVER_NOT_IN_REQUEST';
  }
  const before = stateQuantities(event.position_m, event.velocityBefore_mps, constants);
  const after = stateQuantities(event.position_m, event.velocityAfter_mps, constants);
  if (!before.ok || !after.ok) {
    return 'NON_FINITE_STATE';
  }
  return {
    maneuverId: event.maneuverId,
    t_s: event.t_s,
    before: classify(before.quantities),
    after: classify(after.quantities),
    rows: COMPARISON_QUANTITIES.map(({ quantity, unit }) =>
      row(quantity, unit, before.quantities, after.quantities),
    ),
    deltaV: {
      inertial_mps: [...event.deltaV_inertial_mps],
      rsw_mps: [...requested.deltaV_mps],
      magnitude_mps: event.deltaV_magnitude_mps,
    },
  };
}

/**
 * Before/after values and differences of a, e, i, Ω, ω, r_p, r_a, T and ξ across each maneuver,
 * plus the applied Δv (ML-FR-010 AC2). See module header for the definitions.
 *
 * @param coast Result of the coast request (`buildCoastRequest` of the same scenario, run).
 * @param maneuvered Result of the scenario's own request.
 * @param maneuveredRequest The request that produced `maneuvered` (same requestId).
 */
export function compareCoastAndManeuver(
  coast: SimulationResult,
  maneuvered: SimulationResult,
  maneuveredRequest: SimulationRequest,
): CompareResult {
  if (coast.status !== 'ok') {
    return { ok: false, reason: 'COAST_RESULT_FAILED' };
  }
  if (maneuvered.status !== 'ok') {
    return { ok: false, reason: 'MANEUVERED_RESULT_FAILED' };
  }
  if (coast.events.length > 0) {
    return { ok: false, reason: 'COAST_HAS_MANEUVER' };
  }
  if (maneuvered.events.length === 0) {
    return { ok: false, reason: 'NO_MANEUVER' };
  }
  if (maneuveredRequest.requestId !== maneuvered.requestId) {
    return { ok: false, reason: 'REQUEST_RESULT_MISMATCH' };
  }
  const cm = coast.model;
  const mm = maneuvered.model;
  if (
    !Object.is(cm.sampling.duration_s, mm.sampling.duration_s) ||
    cm.epoch.iso !== mm.epoch.iso ||
    !Object.is(cm.constants.mu_m3ps2, mm.constants.mu_m3ps2) ||
    !Object.is(cm.constants.referenceRadius_m, mm.constants.referenceRadius_m)
  ) {
    return { ok: false, reason: 'SPAN_OR_MODEL_MISMATCH' };
  }
  const c0 = firstSample(coast);
  const m0 = firstSample(maneuvered);
  if (c0 === null || m0 === null || !sameNumbers(c0, m0)) {
    return { ok: false, reason: 'INITIAL_STATE_MISMATCH' };
  }
  const constants = {
    mu_m3ps2: mm.constants.mu_m3ps2,
    referenceRadius_m: mm.constants.referenceRadius_m,
  };
  const maneuvers: ManeuverComparison[] = [];
  for (const event of maneuvered.events) {
    const compared = compareEvent(event, maneuveredRequest, constants);
    if (typeof compared === 'string') {
      return { ok: false, reason: compared };
    }
    maneuvers.push(compared);
  }
  return {
    ok: true,
    comparison: {
      coastRequestId: coast.requestId,
      maneuveredRequestId: maneuvered.requestId,
      maneuvers,
    },
  };
}
