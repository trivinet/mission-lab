/**
 * What the scene draws, derived from the result state of the store (ML-TASK-021), and the
 * engine's reference radius for the Earth when there is no result. Pure: no store, no browser.
 *
 * - current: the result.
 * - stale: the previous result if there is one, drawn marked stale (visual-direction.md).
 * - none, computing, error: no trajectory, Earth only.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import { ENGINE_CONSTANTS } from '@mission-lab/simulation';
import type { ResultState } from '../state/result-state';

export function resultToShow(state: ResultState): SimulationResult | null {
  switch (state.kind) {
    case 'current':
    case 'stale':
      return state.result;
    case 'none':
    case 'computing':
    case 'error':
      return null;
  }
}

/**
 * The engine's reference radius [m]: `ENGINE_CONSTANTS.referenceRadius_m` of
 * `@mission-lab/simulation`, the same value `buildSimulationRequest` puts in every request. With
 * a result, the scene uses `result.model.constants.referenceRadius_m` instead.
 */
export function engineReferenceRadius_m(): number {
  return ENGINE_CONSTANTS.referenceRadius_m;
}
