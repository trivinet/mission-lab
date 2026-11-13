export const PACKAGE_NAME = '@mission-lab/simulation';
export const PACKAGE_VERSION = '0.0.0';

export { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
export { MODEL_LIMITATIONS, TIME_CONVENTION, buildResultModel } from './model';
export { buildSimulationRequest, computeRequestId, deriveRequestId } from './request';
export { runSimulation } from './run';
export { buildSamplingGrid, gridCandidateCount, sampleCount } from './sampling-grid';
export type { GridSegment } from './sampling-grid';
export { validateScenarioSemantics } from './semantic-validation';
export {
  SHA256_INITIAL_HASH,
  SHA256_ROUND_CONSTANTS,
  sha256,
  sha256HexOfUtf8,
  toLowerHex,
  utf8Encode,
} from './sha256';
