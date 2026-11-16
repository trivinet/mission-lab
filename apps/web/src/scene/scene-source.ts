/**
 * What the scene draws, derived from the result state of the store (ML-TASK-021), and the
 * engine's reference radius for the Earth when there is no result. Pure: no store, no browser.
 *
 * - current: the result.
 * - stale: the previous result if there is one, drawn marked stale (visual-direction.md).
 * - none, computing, error: no trajectory, Earth only.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { newScenario } from '../state/default-scenario';
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

let cachedRadius_m: number | undefined;

/**
 * The engine's reference radius [m], read from the request the engine itself builds
 * (`constants.referenceRadius_m`, contracts-v1 section 4). The web app may not import
 * packages/astrodynamics, and the engine has no standalone export of the radius; the constants
 * do not depend on the scenario, so the request of the default scenario carries them. With a
 * result, the scene uses `result.model.constants.referenceRadius_m` instead.
 */
export function engineReferenceRadius_m(): number {
  if (cachedRadius_m === undefined) {
    const built = buildSimulationRequest(newScenario());
    if (!built.ok) {
      throw new Error('The engine rejected the default scenario; cannot read its constants.');
    }
    cachedRadius_m = built.value.constants.referenceRadius_m;
  }
  return cachedRadius_m;
}
