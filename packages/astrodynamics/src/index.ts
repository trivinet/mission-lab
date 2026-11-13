export const PACKAGE_NAME = '@mission-lab/astrodynamics';
export const PACKAGE_VERSION = '0.0.0';

export {
  EARTH_CONSTANTS,
  EARTH_CONSTANTS_SOURCE,
  EARTH_GM_m3ps2,
  EARTH_REFERENCE_RADIUS_m,
} from './constants';
export type { CentralBodyConstants } from './constants';

export {
  addVec3,
  crossVec3,
  dotVec3,
  mulMat3,
  mulMat3Vec3,
  normalizeVec3,
  normVec3,
  scaleVec3,
  subVec3,
  transposeMat3,
} from './vector3';
export type { Mat3, NormalizeVec3Failure, NormalizeVec3Result, Vec3 } from './vector3';

export {
  STUMPFF_SERIES_SWITCH,
  STUMPFF_SERIES_TERMS,
  stumpff,
  stumpffC,
  stumpffS,
} from './stumpff';
export type { StumpffValues } from './stumpff';

export {
  KEPLER_MAX_BRACKET_EXPANSIONS,
  KEPLER_MAX_ITERATIONS,
  KEPLER_MAX_POLISH_STEPS,
  propagateKeplerUniversal,
  propagateKeplerUniversalAt,
} from './kepler-universal';
export type {
  KeplerPropagationFailure,
  KeplerPropagationOptions,
  KeplerPropagationResult,
  KeplerSolveDiagnostics,
  KeplerTimeEquationData,
  LagrangeCoefficients,
} from './kepler-universal';
export { normalizeAngle_rad, TWO_PI_rad } from './angles';
export type { NormalizeAngleResult } from './angles';

export { elementsToState, stateToElements } from './elements';
export type {
  CartesianState,
  ConicType,
  DegeneracyThresholds,
  DegenerateConvention,
  ElementsToStateFailure,
  ElementsToStateResult,
  KeplerianElements,
  StateToElementsFailure,
  StateToElementsResult,
  StateToElementsSuccess,
} from './elements';

export { closedOrbitQuantities, stateIntegrals } from './orbit-quantities';
export type {
  ClosedOrbitQuantities,
  ClosedOrbitQuantitiesFailure,
  ClosedOrbitQuantitiesResult,
  StateIntegrals,
  StateIntegralsFailure,
  StateIntegralsResult,
} from './orbit-quantities';

export { rswBasis, rswToInertial } from './rsw';
export type { RswBasis, RswBasisFailure, RswBasisResult } from './rsw';

export { applyImpulsiveManeuver } from './maneuver';
export type {
  ImpulsiveManeuverApplication,
  ImpulsiveManeuverFailure,
  ImpulsiveManeuverResult,
} from './maneuver';

export {
  classifyEscape,
  detectReferenceSphereIntersection,
  ESCAPE_ENERGY_BOUND_FACTOR,
} from './trajectory-flags';
export type {
  ConicRegime,
  EscapeClassification,
  EscapeClassificationFailure,
  EscapeClassificationResult,
  ReferenceSphereIntersection,
  ReferenceSphereIntersectionFailure,
  ReferenceSphereIntersectionReason,
  ReferenceSphereIntersectionResult,
} from './trajectory-flags';
