export const PACKAGE_NAME = '@mission-lab/simulation';
export const PACKAGE_VERSION = '1.0.0';

export { DEGENERACY_THRESHOLDS } from './degeneracy-thresholds';
export { ERA_AT_J2000_rev, ERA_RATE_revpday, earthRotationAngle_rad } from './earth-rotation';
export type { EarthRotationAngleFailure, EarthRotationAngleResult } from './earth-rotation';
export { ENGINE_CONSTANTS } from './engine-constants';
export { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
export { MODEL_LIMITATIONS, TIME_CONVENTION, buildResultModel } from './model';
export { buildSimulationRequest, computeRequestId, deriveRequestId } from './request';
export { runSimulation } from './run';
export { describeScenarioOrbit } from './scenario-view';
export type {
  ArgPeriapsisMeaning,
  DegeneracyDescription,
  DerivedOrbitQuantities,
  DescribeScenarioOrbitFailure,
  DescribeScenarioOrbitResult,
  NormalizedOrbitAngles,
  RaanMeaning,
  ScenarioOrbitView,
  ScenarioViewConstants,
  TrueAnomalyMeaning,
  UndefinedElement,
} from './scenario-view';
export type {
  CentralBodyConstants,
  DegeneracyThresholds,
  DegenerateConvention,
} from '@mission-lab/astrodynamics';
export { buildSamplingGrid, gridCandidateCount, sampleCount } from './sampling-grid';
export type { GridSegment } from './sampling-grid';
export { validateScenarioSemantics } from './semantic-validation';
export { utcIsoAtElapsed } from './utc-label';
export type { UtcLabelFailure, UtcLabelResult } from './utc-label';
export {
  SHA256_INITIAL_HASH,
  SHA256_ROUND_CONSTANTS,
  sha256,
  sha256HexOfUtf8,
  toLowerHex,
  utf8Encode,
} from './sha256';
export {
  COMPARISON_QUANTITIES,
  HISTORY_QUANTITIES,
  buildCoastRequest,
  compareCoastAndManeuver,
  computeHistories,
  historySeries,
  stateQuantities,
} from './analysis';
export type {
  AnalysisConstants,
  AppliedDeltaV,
  CoastManeuverComparison,
  CompareFailure,
  CompareResult,
  ComparisonQuantity,
  ComparisonRow,
  ComparisonUnit,
  ComparisonValueAbsence,
  ComputeHistoriesFailure,
  ComputeHistoriesResult,
  HistoryQuantity,
  HistorySeries,
  HistoryUnit,
  ManeuverComparison,
  ReportedClosedOrbit,
  ReportedElements,
  ResultHistories,
  SegmentHistory,
  StateClassification,
  StateQuantities,
  StateQuantitiesFailure,
  StateQuantitiesResult,
} from './analysis';
export type {
  ClosedOrbitQuantitiesFailure,
  ConicType,
  StateIntegralsFailure,
  StateToElementsFailure,
} from '@mission-lab/astrodynamics';
