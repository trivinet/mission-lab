/**
 * Quantities of one result state (ML-TASK-031; ML-FR-009, ML-FR-010). Shared by the histories and
 * the comparison so that both report the same numbers for the same state.
 *
 * No new physics (task contract, acceptance criterion 2): every number is the output of an
 * existing packages/astrodynamics function applied to the state, or the documented altitude
 * subtraction radius − reference radius (the same operation as `describeScenarioOrbit`, see
 * scenario-view.ts; `ClosedOrbitQuantities` documents "subtract the reference radius for
 * altitude", and the contract defines altitude as above the reference sphere, MODEL_LIMITATIONS):
 * - radius |r| [m]:                         normVec3(position_m)
 * - speed |v| [m/s]:                        normVec3(velocity_mps)
 * - altitude [m]:                           |r| − referenceRadius_m
 * - a, e, i, Ω, ω, ν, convention, conic:    stateToElements(state, μ, DEGENERACY_THRESHOLDS)
 * - specific energy ξ [m^2/s^2]:            stateIntegrals(r, v, μ).specificEnergy_m2ps2
 * - r_p, r_a [m], period T [s]:             closedOrbitQuantities(a, e, μ) with a, e from
 *                                           stateToElements (declines for an open orbit)
 *
 * Units SI. Frame: r, v in the result frame (GCRF in M1, ADR-004); the angles refer to its axes
 * (i from +z, Ω from +x). Pure; never throws; a number that is not defined is `null` with the
 * failure reason of the function that declined, never NaN or ±Infinity.
 */
import {
  closedOrbitQuantities,
  normVec3,
  stateIntegrals,
  stateToElements,
} from '@mission-lab/astrodynamics';
import type {
  ClosedOrbitQuantitiesFailure,
  ConicType,
  DegenerateConvention,
  StateIntegralsFailure,
  StateToElementsFailure,
  Vec3,
} from '@mission-lab/astrodynamics';
import { DEGENERACY_THRESHOLDS } from '../degeneracy-thresholds';

/** Constants taken from `SimulationResult.model.constants` (contracts-v1 §5). */
export interface AnalysisConstants {
  /** μ [m^3/s^2]. */
  readonly mu_m3ps2: number;
  /** Reference-sphere radius [m]; altitude is measured above this sphere (not geodetic). */
  readonly referenceRadius_m: number;
}

/** The classical elements as reported by `stateToElements` (ADR-008 convention applied). */
export interface ReportedElements {
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
  readonly convention: DegenerateConvention;
  readonly conic: ConicType;
}

/** Closed-orbit quantities of `closedOrbitQuantities` that the analysis reports. */
export interface ReportedClosedOrbit {
  readonly periapsisRadius_m: number;
  readonly apoapsisRadius_m: number;
  readonly period_s: number;
}

/**
 * Everything the analysis reports for one state. A group is `null` when its function declined;
 * the matching `...Failure` field then holds the reason (otherwise `null`).
 */
export interface StateQuantities {
  readonly radius_m: number;
  readonly altitude_m: number;
  readonly speed_mps: number;
  readonly elements: ReportedElements | null;
  readonly elementsFailure: StateToElementsFailure | null;
  readonly specificEnergy_m2ps2: number | null;
  readonly specificEnergyFailure: StateIntegralsFailure | null;
  readonly closedOrbit: ReportedClosedOrbit | null;
  /**
   * Why there is no closed-orbit group: the `closedOrbitQuantities` reason ('NOT_CLOSED_ORBIT' for
   * a hyperbolic state: apoapsis and period do not exist), or 'ELEMENTS_UNAVAILABLE' when
   * `stateToElements` itself declined.
   */
  readonly closedOrbitFailure: ClosedOrbitQuantitiesFailure | 'ELEMENTS_UNAVAILABLE' | null;
}

/** Why `stateQuantities` returns nothing at all. */
export type StateQuantitiesFailure =
  /** A component of r or v, μ or the reference radius is not finite. */
  'NON_FINITE_INPUT';

export type StateQuantitiesResult =
  | { readonly ok: true; readonly quantities: StateQuantities }
  | { readonly ok: false; readonly reason: StateQuantitiesFailure };

/**
 * Quantities of the state (r [m], v [m/s]) in the result frame, with μ and the reference radius
 * of the result (see module header for the function behind each value).
 *
 * Domain: finite inputs. A valid ok SimulationResult has only finite samples (contract R5) and
 * finite constants, so the failure is unreachable from such a result; it guards direct callers.
 */
export function stateQuantities(
  position_m: Vec3,
  velocity_mps: Vec3,
  constants: AnalysisConstants,
): StateQuantitiesResult {
  const finite = [
    ...position_m,
    ...velocity_mps,
    constants.mu_m3ps2,
    constants.referenceRadius_m,
  ].every((x) => Number.isFinite(x));
  if (!finite) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  const radius_m = normVec3(position_m);
  const speed_mps = normVec3(velocity_mps);
  const altitude_m = radius_m - constants.referenceRadius_m;
  if (!Number.isFinite(radius_m) || !Number.isFinite(speed_mps) || !Number.isFinite(altitude_m)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }

  const integrals = stateIntegrals(position_m, velocity_mps, constants.mu_m3ps2);
  const converted = stateToElements(
    { position_m, velocity_mps },
    constants.mu_m3ps2,
    DEGENERACY_THRESHOLDS,
  );

  let elements: ReportedElements | null = null;
  let elementsFailure: StateToElementsFailure | null = null;
  let closedOrbit: ReportedClosedOrbit | null = null;
  let closedOrbitFailure: StateQuantities['closedOrbitFailure'] = null;
  if (converted.ok) {
    elements = {
      ...converted.elements,
      convention: converted.convention,
      conic: converted.conic,
    };
    const closed = closedOrbitQuantities(
      converted.elements.semiMajorAxis_m,
      converted.elements.eccentricity,
      constants.mu_m3ps2,
    );
    if (closed.ok) {
      closedOrbit = {
        periapsisRadius_m: closed.quantities.periapsisRadius_m,
        apoapsisRadius_m: closed.quantities.apoapsisRadius_m,
        period_s: closed.quantities.period_s,
      };
    } else {
      closedOrbitFailure = closed.reason;
    }
  } else {
    elementsFailure = converted.reason;
    closedOrbitFailure = 'ELEMENTS_UNAVAILABLE';
  }

  return {
    ok: true,
    quantities: {
      radius_m,
      altitude_m,
      speed_mps,
      elements,
      elementsFailure,
      specificEnergy_m2ps2: integrals.ok ? integrals.integrals.specificEnergy_m2ps2 : null,
      specificEnergyFailure: integrals.ok ? null : integrals.reason,
      closedOrbit,
      closedOrbitFailure,
    },
  };
}
