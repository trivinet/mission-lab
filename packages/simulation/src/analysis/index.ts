/**
 * Analysis module (proposed-architecture §2 module E; ML-TASK-031): data for the plots and the
 * comparison table, derived only from SimulationResult (and the request for the RSW Δv).
 */
export { buildCoastRequest } from './coast-request';
export { COMPARISON_QUANTITIES, compareCoastAndManeuver } from './comparison';
export type {
  AppliedDeltaV,
  CoastManeuverComparison,
  CompareFailure,
  CompareResult,
  ComparisonQuantity,
  ComparisonRow,
  ComparisonUnit,
  ComparisonValueAbsence,
  ManeuverComparison,
  StateClassification,
} from './comparison';
export { HISTORY_QUANTITIES, computeHistories, historySeries } from './histories';
export type {
  ComputeHistoriesFailure,
  ComputeHistoriesResult,
  HistoryQuantity,
  HistorySeries,
  HistoryUnit,
  ResultHistories,
  SegmentHistory,
} from './histories';
export { stateQuantities } from './state-quantities';
export type {
  AnalysisConstants,
  ReportedClosedOrbit,
  ReportedElements,
  StateQuantities,
  StateQuantitiesFailure,
  StateQuantitiesResult,
} from './state-quantities';
