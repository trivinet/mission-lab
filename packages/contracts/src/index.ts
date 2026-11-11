/**
 * @mission-lab/contracts — normative simulation contracts v1.0.
 * Field semantics, units, frames, invariants and versioning: docs/architecture/contracts-v1.md.
 * Types are inferred from the zod schemas, which are the single source of truth.
 */
export const PACKAGE_NAME = '@mission-lab/contracts';
export const PACKAGE_VERSION = '0.0.0';

export * from './codes';
export { SCHEMA_VERSION, epochSchema, isCanonicalUtcIso, vec3Schema } from './primitives';
export type { Epoch, Vec3 } from './primitives';
export {
  M1_MAX_MANEUVERS,
  impulsiveManeuverSchema,
  keplerianElementsSchema,
  scenarioSchema,
} from './scenario';
export type { ImpulsiveManeuver, KeplerianElements, Scenario } from './scenario';
export {
  REQUEST_ID_PATTERN,
  cartesianStateSchema,
  physicalConstantsSchema,
  requestIdSchema,
  simulationRequestSchema,
} from './request';
export type { CartesianState, PhysicalConstants, SimulationRequest } from './request';
export {
  diagnosticCodeSchema,
  diagnosticSchema,
  diagnosticSeveritySchema,
  maneuverEventSchema,
  resultModelSchema,
  simulationResultSchema,
  trajectorySegmentSchema,
} from './result';
export type {
  Diagnostic,
  ManeuverEvent,
  ResultModel,
  SimulationResult,
  TrajectorySegment,
} from './result';
export {
  toValidationIssues,
  validateScenario,
  validateSimulationRequest,
  validateSimulationResult,
} from './validate';
export type { ValidationIssue, ValidationResult } from './validate';
export { binary64Hex, canonicalRequestPayload } from './canonical';
