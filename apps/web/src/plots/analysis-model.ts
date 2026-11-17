/**
 * The analysis of one shown result, computed once per result and cached on the result object
 * (ML-FR-009, ML-FR-010). It calls the analysis module of @mission-lab/simulation and does no
 * physics itself. It is never called per frame or per playback tick: the plots, the comparison
 * table and the text alternatives read the cached object.
 *
 * Cost note (ML-TASK-026 envelope): computeHistories evaluates every sample of every quantity
 * (stateToElements and friends) and returns JS number arrays, so at 1e6 samples it is the
 * heaviest step of showing a result, on the main thread (not measured here; see the task report).
 */
import { compareCoastAndManeuver, computeHistories } from '@mission-lab/simulation';
import type { SimulationResult } from '@mission-lab/contracts';
import type { CompareResult, ComputeHistoriesResult } from '@mission-lab/simulation';
import type { CoastPair } from '../state/result-state';

export interface AnalysisModel {
  /** Histories of the shown (maneuvered or only) result. */
  readonly histories: ComputeHistoriesResult;
  /** Histories of the coast run; null when there is no coast pair. */
  readonly coastHistories: ComputeHistoriesResult | null;
  /** The comparison table data; null when there is no coast pair (no maneuver). */
  readonly comparison: CompareResult | null;
  /** Maneuver times (s from epoch) of the shown result, from its events. */
  readonly maneuverTimes_s: readonly number[];
}

const cache = new WeakMap<SimulationResult, AnalysisModel>();

/** The analysis of `result`; the same object for the same result (computed once). */
export function analyse(result: SimulationResult, pair: CoastPair | undefined): AnalysisModel {
  const cached = cache.get(result);
  if (cached !== undefined) {
    return cached;
  }
  const model: AnalysisModel = {
    histories: computeHistories(result),
    coastHistories: pair === undefined ? null : computeHistories(pair.coast),
    comparison:
      pair === undefined ? null : compareCoastAndManeuver(pair.coast, result, pair.request),
    maneuverTimes_s: result.events.map((event) => event.t_s),
  };
  cache.set(result, model);
  return model;
}
