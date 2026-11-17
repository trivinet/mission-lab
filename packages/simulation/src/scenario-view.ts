/**
 * Scenario-view of the initial orbit for the editor (ML-TASK-027; ML-FR-002 AC2–AC4).
 *
 * apps/web may import only @mission-lab/simulation and @mission-lab/contracts (ADR-002, eslint
 * boundaries), so this module exposes what the editor needs from packages/astrodynamics. It adds
 * no physics: every number comes from an astrodynamics function (`normalizeAngle_rad`,
 * `elementsToState`, `stateToElements`, `closedOrbitQuantities`); the only arithmetic done here is
 * radius − reference radius for the two altitudes, which `ClosedOrbitQuantities` documents
 * ("subtract the reference radius for altitude") and the contract defines as altitude above the
 * reference sphere (proposed-architecture §3; MODEL_LIMITATIONS).
 *
 * Units: SI (m, s, rad, m^3/s^2, m^2/s^2). Frame: the angles refer to the scenario frame (GCRF in
 * M1, ADR-004); i from its +z axis, Ω from its +x axis. Pure: no clock, I/O or randomness; the
 * input is never mutated; no function throws; no NaN or ±Infinity is returned.
 */
import {
  closedOrbitQuantities,
  elementsToState,
  normalizeAngle_rad,
  stateToElements,
} from '@mission-lab/astrodynamics';
import type {
  ClosedOrbitQuantitiesFailure,
  DegenerateConvention,
  ElementsToStateFailure,
  StateToElementsFailure,
} from '@mission-lab/astrodynamics';
import type { KeplerianElements } from '@mission-lab/contracts';
import { DEGENERACY_THRESHOLDS } from './degeneracy-thresholds';

/** The constants the view needs (a subset of the contract's `constants`, contracts-v1 §4). */
export interface ScenarioViewConstants {
  /** Gravitational parameter μ [m^3/s^2]; finite, > 0. */
  readonly mu_m3ps2: number;
  /** Reference-sphere radius [m]; finite, > 0. Altitudes are measured above this sphere. */
  readonly referenceRadius_m: number;
}

/** Ω, ω, ν of the input, each mapped to [0, 2π) rad by `normalizeAngle_rad` (ML-FR-002 AC2). */
export interface NormalizedOrbitAngles {
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
}

/** Derived read-only quantities of ML-FR-002 AC4 (plus the other `closedOrbitQuantities` outputs). */
export interface DerivedOrbitQuantities {
  /** Perigee radius r_p = a(1 − e) [m] (closedOrbitQuantities, D6). */
  readonly perigeeRadius_m: number;
  /** Apogee radius r_a = a(1 + e) [m] (closedOrbitQuantities, D6). */
  readonly apogeeRadius_m: number;
  /** r_p − referenceRadius_m [m]: altitude above the reference sphere, not geodetic altitude. */
  readonly perigeeAltitude_m: number;
  /** r_a − referenceRadius_m [m]: altitude above the reference sphere, not geodetic altitude. */
  readonly apogeeAltitude_m: number;
  /** Period T = 2π sqrt(a^3/μ) [s] (closedOrbitQuantities, D7). */
  readonly period_s: number;
  /** Specific orbital energy ξ = −μ/(2a) [m^2/s^2] (closedOrbitQuantities, D4). */
  readonly specificEnergy_m2ps2: number;
  /** Mean motion n = sqrt(μ/a^3) [rad/s] (closedOrbitQuantities, D7). */
  readonly meanMotion_radps: number;
  /** |h| = sqrt(μ a (1 − e^2)) [m^2/s] (closedOrbitQuantities, D3, D4). */
  readonly specificAngularMomentum_m2ps: number;
}

/** An element whose classical definition does not exist under a degenerate convention. */
export type UndefinedElement = 'raan_rad' | 'argPeriapsis_rad';

/** What the reported Ω denotes (architecture §3 as refined by ADR-008). */
export type RaanMeaning = 'RAAN' | 'ASSIGNED_ZERO';
/** What the reported ω denotes. */
export type ArgPeriapsisMeaning =
  'ARGUMENT_OF_PERIAPSIS' | 'LONGITUDE_OF_PERIAPSIS' | 'ASSIGNED_ZERO';
/** What the reported ν denotes. */
export type TrueAnomalyMeaning = 'TRUE_ANOMALY' | 'ARGUMENT_OF_LATITUDE' | 'TRUE_LONGITUDE';

/**
 * Degenerate classification and the convention that applies (ML-FR-002 AC3; ADR-008), as decided
 * by `stateToElements` on the Cartesian state of the input elements with DEGENERACY_THRESHOLDS.
 *
 * The meanings restate the `DegenerateConvention` documentation of packages/astrodynamics
 * (architecture §3, ADR-008 decisions 1 and 3):
 * - NONE: Ω = RAAN, ω = argument of periapsis, ν = true anomaly; nothing undefined.
 * - CIRCULAR: ω undefined, ω := 0; ν := argument of latitude (from the ascending node).
 * - EQUATORIAL: Ω undefined, Ω := 0; ω := longitude of periapsis (from +x).
 * - CIRCULAR_EQUATORIAL: Ω and ω undefined, Ω := 0, ω := 0; ν := true longitude (from +x).
 * In the equatorial cases the angles from +x are measured positively about the angular-momentum
 * direction (sense of motion), also for retrograde orbits (ADR-008 decision 3).
 */
export interface DegeneracyDescription {
  readonly convention: DegenerateConvention;
  readonly circular: boolean;
  readonly equatorial: boolean;
  /** Elements whose classical definition does not exist, in field order. Empty for NONE. */
  readonly undefinedElements: readonly UndefinedElement[];
  readonly raanMeaning: RaanMeaning;
  readonly argPeriapsisMeaning: ArgPeriapsisMeaning;
  readonly trueAnomalyMeaning: TrueAnomalyMeaning;
  /**
   * The elements as the engine reports them for this orbit: `stateToElements` of the state, with
   * the convention applied. e and i are the values computed from the state and are never set to
   * zero (ADR-008 decision 1); they can differ from the input by rounding.
   */
  readonly reportedElements: KeplerianElements;
}

/** Successful output of `describeScenarioOrbit`. */
export interface ScenarioOrbitView {
  readonly normalizedAngles: NormalizedOrbitAngles;
  readonly derived: DerivedOrbitQuantities;
  readonly degeneracy: DegeneracyDescription;
}

/**
 * Why `describeScenarioOrbit` declines. Codes are passed through from the astrodynamics function
 * that declined; the first two are checked here.
 */
export type DescribeScenarioOrbitFailure =
  /** An element, μ or the reference radius is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** referenceRadius_m ≤ 0. */
  | 'REFERENCE_RADIUS_NOT_POSITIVE'
  | ElementsToStateFailure
  | ClosedOrbitQuantitiesFailure
  | StateToElementsFailure;

/** Result of `describeScenarioOrbit`. Never contains NaN or ±Infinity. */
export type DescribeScenarioOrbitResult =
  | { readonly ok: true; readonly view: ScenarioOrbitView }
  | { readonly ok: false; readonly reason: DescribeScenarioOrbitFailure };

/**
 * Read-only view of a scenario's initial Keplerian elements for the editor: normalised angles
 * (ML-FR-002 AC2), derived quantities (AC4) and the degenerate classification with its convention
 * (AC3).
 *
 * Inputs: `elements` in SI (a [m], e [-], i, Ω, ω, ν [rad], referred to the scenario frame, GCRF);
 * `constants` μ [m^3/s^2] and reference radius [m] (the editor passes the engine's
 * `EARTH_CONSTANTS`, re-exported by this package). Nothing is mutated.
 *
 * Steps (all physics in packages/astrodynamics):
 * 1. μ and referenceRadius_m finite (else NON_FINITE_INPUT); referenceRadius_m > 0 (else
 *    REFERENCE_RADIUS_NOT_POSITIVE).
 * 2. Ω, ω, ν → `normalizeAngle_rad` (NON_FINITE_ANGLE → NON_FINITE_INPUT).
 * 3. state = `elementsToState` of the elements with the normalised angles and μ (regular map, no
 *    special-casing; contracts-v1 §3, ADR-008). Its failures (non-finite a, e, i; a ≤ 0; e outside
 *    [0, 1); i outside [0, π]; non-finite result) are returned unchanged. For a validated scenario
 *    this is the state that `buildSimulationRequest` puts in the request, up to its −0 → +0 rule.
 * 4. `closedOrbitQuantities(a, e, μ)`; failures returned unchanged. Altitudes = radius −
 *    referenceRadius_m.
 * 5. `stateToElements(state, μ, DEGENERACY_THRESHOLDS)`; failures returned unchanged. Its
 *    `convention` is the classification.
 *
 * Why detection runs on the state, not on the input e and i: ADR-008 decision 1 states that the
 * convention applies only to state→elements and that e and i are always reported as computed from
 * the state; the Cartesian state is authoritative (architecture §3). The classification shown in
 * the editor is therefore the one the engine applies to every element view of this orbit
 * (initial elements of the result, histories). The comparison is the record's rule: strict
 * e < ε_e, strict min(i, π − i) < ε_i, plus the exactly degenerate state (e exactly 0, node vector
 * exactly 0). Near a threshold, the computed e or i differs from the input by rounding
 * (tolerances.md §10: about 1e-13 for e at N = 0), so an input within that distance of a
 * threshold can be classified either way.
 *
 * Sources: ML-FR-002 AC2–AC4; ADR-008; architecture §3 "Classical elements"; the cited functions
 * of packages/astrodynamics and their documented derivations. Thresholds: DEGENERACY_THRESHOLDS
 * (ADR-008; tolerances.md §10, §15).
 */
export function describeScenarioOrbit(
  elements: KeplerianElements,
  constants: ScenarioViewConstants,
): DescribeScenarioOrbitResult {
  const { mu_m3ps2, referenceRadius_m } = constants;
  if (!Number.isFinite(mu_m3ps2) || !Number.isFinite(referenceRadius_m)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(referenceRadius_m > 0)) {
    return { ok: false, reason: 'REFERENCE_RADIUS_NOT_POSITIVE' };
  }

  const raan = normalizeAngle_rad(elements.raan_rad);
  const argp = normalizeAngle_rad(elements.argPeriapsis_rad);
  const nu = normalizeAngle_rad(elements.trueAnomaly_rad);
  if (!raan.ok || !argp.ok || !nu.ok) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  const normalizedAngles: NormalizedOrbitAngles = {
    raan_rad: raan.angle_rad,
    argPeriapsis_rad: argp.angle_rad,
    trueAnomaly_rad: nu.angle_rad,
  };

  const state = elementsToState(
    {
      semiMajorAxis_m: elements.semiMajorAxis_m,
      eccentricity: elements.eccentricity,
      inclination_rad: elements.inclination_rad,
      ...normalizedAngles,
    },
    mu_m3ps2,
  );
  if (!state.ok) {
    return { ok: false, reason: state.reason };
  }

  const quantities = closedOrbitQuantities(
    elements.semiMajorAxis_m,
    elements.eccentricity,
    mu_m3ps2,
  );
  if (!quantities.ok) {
    return { ok: false, reason: quantities.reason };
  }
  const q = quantities.quantities;
  const derived: DerivedOrbitQuantities = {
    perigeeRadius_m: q.periapsisRadius_m,
    apogeeRadius_m: q.apoapsisRadius_m,
    perigeeAltitude_m: q.periapsisRadius_m - referenceRadius_m,
    apogeeAltitude_m: q.apoapsisRadius_m - referenceRadius_m,
    period_s: q.period_s,
    specificEnergy_m2ps2: q.specificEnergy_m2ps2,
    meanMotion_radps: q.meanMotion_radps,
    specificAngularMomentum_m2ps: q.specificAngularMomentum_m2ps,
  };
  if (!Number.isFinite(derived.perigeeAltitude_m) || !Number.isFinite(derived.apogeeAltitude_m)) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }

  const reported = stateToElements(state.state, mu_m3ps2, DEGENERACY_THRESHOLDS);
  if (!reported.ok) {
    return { ok: false, reason: reported.reason };
  }

  return {
    ok: true,
    view: {
      normalizedAngles,
      derived,
      degeneracy: describeConvention(reported.convention, reported.elements),
    },
  };
}

/** Maps the engine's convention to the editor's description (see DegeneracyDescription). */
function describeConvention(
  convention: DegenerateConvention,
  reportedElements: KeplerianElements,
): DegeneracyDescription {
  switch (convention) {
    case 'NONE':
      return {
        convention,
        circular: false,
        equatorial: false,
        undefinedElements: [],
        raanMeaning: 'RAAN',
        argPeriapsisMeaning: 'ARGUMENT_OF_PERIAPSIS',
        trueAnomalyMeaning: 'TRUE_ANOMALY',
        reportedElements,
      };
    case 'CIRCULAR':
      return {
        convention,
        circular: true,
        equatorial: false,
        undefinedElements: ['argPeriapsis_rad'],
        raanMeaning: 'RAAN',
        argPeriapsisMeaning: 'ASSIGNED_ZERO',
        trueAnomalyMeaning: 'ARGUMENT_OF_LATITUDE',
        reportedElements,
      };
    case 'EQUATORIAL':
      return {
        convention,
        circular: false,
        equatorial: true,
        undefinedElements: ['raan_rad'],
        raanMeaning: 'ASSIGNED_ZERO',
        argPeriapsisMeaning: 'LONGITUDE_OF_PERIAPSIS',
        trueAnomalyMeaning: 'TRUE_ANOMALY',
        reportedElements,
      };
    case 'CIRCULAR_EQUATORIAL':
      return {
        convention,
        circular: true,
        equatorial: true,
        undefinedElements: ['raan_rad', 'argPeriapsis_rad'],
        raanMeaning: 'ASSIGNED_ZERO',
        argPeriapsisMeaning: 'ASSIGNED_ZERO',
        trueAnomalyMeaning: 'TRUE_LONGITUDE',
        reportedElements,
      };
  }
}
