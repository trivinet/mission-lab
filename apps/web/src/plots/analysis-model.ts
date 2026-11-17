/**
 * The analysis of one shown result (ML-FR-009, ML-FR-010). It does no physics itself.
 *
 * The O(N) part, the histories of every quantity, is computed by the analysis module inside the
 * simulation worker and arrives as transferred typed arrays next to the result (ML-TASK-044,
 * D-1; worker/analysis-pack.ts). The store registers them here with `attachAnalysis`; the main
 * thread only unpacks the quantities that are plotted (a NaN becomes the module's null, every
 * other value is copied unchanged) and calls `compareCoastAndManeuver`, which reads only the
 * first sample of the coast run and the maneuver events (O(1) in the number of samples).
 * It is never called per frame or per playback tick: the plots, the comparison table and the text
 * alternatives read the cached object.
 */
import { compareCoastAndManeuver, HISTORY_QUANTITIES } from '@mission-lab/simulation';
import type { SimulationResult } from '@mission-lab/contracts';
import type {
  CompareResult,
  ComputeHistoriesFailure,
  HistoryQuantity,
} from '@mission-lab/simulation';
import type { CoastPair } from '../state/result-state';
import { unpackSeries } from '../worker/analysis-pack';
import type { PackedHistories } from '../worker/analysis-pack';
import type { PlotHistories } from './plot-model';

/** Why there are no histories to plot. */
export type HistoriesFailure = ComputeHistoriesFailure | 'ANALYSIS_UNAVAILABLE';

/** The histories of one run, unpacked on demand for the quantities that are plotted. */
export type RunHistories =
  | { readonly ok: true; readonly forQuantity: (quantity: HistoryQuantity) => PlotHistories }
  | { readonly ok: false; readonly reason: HistoriesFailure };

export interface AnalysisModel {
  /** Histories of the shown (maneuvered or only) result. */
  readonly histories: RunHistories;
  /** Histories of the coast run; null when there is no coast pair. */
  readonly coastHistories: RunHistories | null;
  /** The comparison table data; null when there is no coast pair (no maneuver). */
  readonly comparison: CompareResult | null;
  /** Maneuver times (s from epoch) of the shown result, from its events. */
  readonly maneuverTimes_s: readonly number[];
}

const attached = new WeakMap<SimulationResult, PackedHistories>();
const cache = new WeakMap<SimulationResult, AnalysisModel>();

/** Registers the worker's histories of `result`; called by the store when a response arrives. */
export function attachAnalysis(result: SimulationResult, packed: PackedHistories): void {
  attached.set(result, packed);
  cache.delete(result);
}

function runHistories(result: SimulationResult): RunHistories {
  const packed = attached.get(result);
  if (packed === undefined) {
    return { ok: false, reason: 'ANALYSIS_UNAVAILABLE' };
  }
  if (!packed.ok) {
    return { ok: false, reason: packed.reason };
  }
  const byQuantity = new Map<HistoryQuantity, PlotHistories>();
  return {
    ok: true,
    forQuantity: (quantity) => {
      const known = byQuantity.get(quantity);
      if (known !== undefined) {
        return known;
      }
      const unit = HISTORY_QUANTITIES.find((q) => q.quantity === quantity)?.unit;
      if (unit === undefined) {
        throw new Error(`unknown history quantity ${quantity}`);
      }
      const built: PlotHistories = {
        segments: result.segments.map((segment, i) => {
          const values = packed.segments[i]?.values[quantity];
          return {
            segmentIndex: segment.index,
            // The engine's own time array, not a copy.
            t_s: segment.t_s,
            series: [
              {
                quantity,
                t_s: segment.t_s,
                values: values === undefined ? [] : unpackSeries(values),
              },
            ],
          };
        }),
      };
      byQuantity.set(quantity, built);
      return built;
    },
  };
}

/** The analysis of `result`; the same object for the same result (computed once). */
export function analyse(result: SimulationResult, pair: CoastPair | undefined): AnalysisModel {
  const cached = cache.get(result);
  if (cached !== undefined) {
    return cached;
  }
  const model: AnalysisModel = {
    histories: runHistories(result),
    coastHistories: pair === undefined ? null : runHistories(pair.coast),
    comparison:
      pair === undefined ? null : compareCoastAndManeuver(pair.coast, result, pair.request),
    maneuverTimes_s: result.events.map((event) => event.t_s),
  };
  cache.set(result, model);
  return model;
}
