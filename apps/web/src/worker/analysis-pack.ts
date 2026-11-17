/**
 * Packs the analysis module's histories into transferable typed arrays (ML-TASK-044, D-1).
 *
 * The worker calls `computeHistories` (the analysis module, unchanged) and this file only copies
 * its output: one Float64Array per quantity and segment, `NaN` standing for the module's `null`
 * ("not defined at this sample"). No value is converted or recomputed. `unpackSeries` is the
 * inverse used on the main thread for the quantities that are plotted; the round trip is exact
 * (tested with Object.is). A defined value that is itself NaN cannot be told from "not defined",
 * so such a result is reported as a failure instead of being packed.
 */
import { HISTORY_QUANTITIES, computeHistories } from '@mission-lab/simulation';
import type { ComputeHistoriesFailure, HistoryQuantity } from '@mission-lab/simulation';
import type { SimulationResult } from '@mission-lab/contracts';

export interface PackedSegmentHistory {
  readonly segmentIndex: number;
  /** One array per quantity, aligned with the segment's `t_s`; NaN = not defined (module null). */
  readonly values: Readonly<Record<HistoryQuantity, Float64Array>>;
}

export type PackedHistories =
  | { readonly ok: true; readonly segments: readonly PackedSegmentHistory[] }
  | { readonly ok: false; readonly reason: ComputeHistoriesFailure };

export function packHistories(result: SimulationResult): PackedHistories {
  const computed = computeHistories(result);
  if (!computed.ok) {
    return { ok: false, reason: computed.reason };
  }
  const segments: PackedSegmentHistory[] = [];
  for (const segment of computed.histories.segments) {
    const values: Partial<Record<HistoryQuantity, Float64Array>> = {};
    for (const { quantity } of HISTORY_QUANTITIES) {
      const series = segment.series.find((s) => s.quantity === quantity);
      const source = series?.values ?? [];
      const packed = new Float64Array(source.length);
      for (let k = 0; k < source.length; k += 1) {
        const value = source[k] ?? null;
        if (value === null) {
          packed[k] = Number.NaN;
        } else if (Number.isNaN(value)) {
          return { ok: false, reason: 'NON_FINITE_SAMPLE' };
        } else {
          packed[k] = value;
        }
      }
      values[quantity] = packed;
    }
    segments.push({
      segmentIndex: segment.segmentIndex,
      values: values as Record<HistoryQuantity, Float64Array>,
    });
  }
  return { ok: true, segments };
}

/** The ArrayBuffers of a packed analysis, for the postMessage transfer list. */
export function packedBuffers(packed: PackedHistories): ArrayBuffer[] {
  if (!packed.ok) {
    return [];
  }
  const buffers: ArrayBuffer[] = [];
  for (const segment of packed.segments) {
    for (const array of Object.values(segment.values)) {
      if (array.buffer instanceof ArrayBuffer) {
        buffers.push(array.buffer);
      }
    }
  }
  return buffers;
}

/** Inverse of the packing for one series: NaN becomes null, every other value is kept as is. */
export function unpackSeries(packed: Float64Array): (number | null)[] {
  const out = new Array<number | null>(packed.length);
  for (let k = 0; k < packed.length; k += 1) {
    const value = packed[k] ?? Number.NaN;
    out[k] = Number.isNaN(value) ? null : value;
  }
  return out;
}
