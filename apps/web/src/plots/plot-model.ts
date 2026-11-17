/**
 * The data of one plot, built from the analysis module's histories (ML-FR-009 AC1, AC2; ADR-010).
 * Pure: no uPlot, no DOM, no physics. Every plotted value is an element of a module output array
 * (Object.is equal); nothing is converted, resampled or unwrapped.
 *
 * uPlot draws all series on one sorted x array, so x is the sorted union of the sample times of
 * every run and segment shown (equal times once), and a series holds `null` at the x values it
 * has no sample for. A line is never drawn across a null (spanGaps off), and:
 *
 * - Segments are separate series, so no line joins the two sides of a maneuver (the shared
 *   maneuver time carries the pre-maneuver value in one series and the post-maneuver value in the
 *   next).
 * - Angle quantities (unit rad) break the line where two consecutive samples of a segment differ
 *   by more than pi, which is how a wrap across 0 / 2 pi shows (ADR-010 angle policy). The values
 *   are unchanged. The break is made by alternating the pieces between two series (`piece` 0 and
 *   1) of the same segment, so the number of series stays fixed however many wraps there are.
 */
import type {
  HistoryQuantity,
  HistoryUnit,
  ResultHistories,
  SegmentHistory,
} from '@mission-lab/simulation';

export type RunKind = 'coast' | 'maneuvered';

/** One uPlot series: the samples of one run segment (one piece of it), aligned to `x`. */
export interface PlotSeries {
  readonly id: string;
  readonly run: RunKind;
  readonly segmentIndex: number;
  /** 0 or 1: pieces of a segment alternate between two series so a line breaks between them. */
  readonly piece: 0 | 1;
  readonly label: string;
  /** `values[i]` belongs to `x[i]`; null where this series has no sample (a gap). */
  readonly values: (number | null)[];
}

/** The module's own output for one segment, by reference (what the plot must show exactly). */
export interface PlotSource {
  readonly run: RunKind;
  readonly segmentIndex: number;
  readonly t_s: readonly number[];
  readonly values: readonly (number | null)[];
}

export interface PlotModel {
  readonly quantity: HistoryQuantity;
  readonly unit: HistoryUnit;
  /** Sorted union of the sample times, s from epoch. */
  readonly x: number[];
  readonly series: readonly PlotSeries[];
  readonly sources: readonly PlotSource[];
  /** Maneuver times, s from epoch (the marker). */
  readonly maneuverTimes_s: readonly number[];
}

/** Style class of a run: coast dashed grey, maneuvered solid teal (design-tokens.md). */
export function runOf(segmentIndex: number, hasCoastRun: boolean): RunKind {
  // Without a coast run, segment 0 (before any maneuver) is the coast part, as in the scene.
  return !hasCoastRun && segmentIndex === 0 ? 'coast' : 'maneuvered';
}

/** Sorted union of ascending arrays, equal values once. */
export function mergeTimes(arrays: readonly (readonly number[])[]): number[] {
  let merged: number[] = [];
  for (const next of arrays) {
    const out: number[] = [];
    let i = 0;
    let j = 0;
    while (i < merged.length || j < next.length) {
      const a = merged[i];
      const b = next[j];
      if (a !== undefined && (b === undefined || a < b)) {
        out.push(a);
        i += 1;
      } else if (b !== undefined && (a === undefined || b < a)) {
        out.push(b);
        j += 1;
      } else if (a !== undefined) {
        out.push(a);
        i += 1;
        j += 1;
      }
    }
    merged = out;
  }
  return merged;
}

function segmentSeries(
  run: RunKind,
  segment: SegmentHistory,
  quantity: HistoryQuantity,
  unit: HistoryUnit,
  x: readonly number[],
  hasCoastRun: boolean,
): { series: PlotSeries[]; source: PlotSource } {
  const found = segment.series.find((s) => s.quantity === quantity);
  const t_s = found?.t_s ?? [];
  const values = found?.values ?? [];
  const pieces: [(number | null)[], (number | null)[]] = [
    new Array<number | null>(x.length).fill(null),
    new Array<number | null>(x.length).fill(null),
  ];
  let parity: 0 | 1 = 0;
  let previous: number | null = null;
  let xi = 0;
  for (let k = 0; k < t_s.length; k += 1) {
    const t = t_s[k];
    if (t === undefined) {
      continue;
    }
    while (xi < x.length && (x[xi] ?? Number.POSITIVE_INFINITY) < t) {
      xi += 1;
    }
    const value = values[k] ?? null;
    if (
      unit === 'rad' &&
      value !== null &&
      previous !== null &&
      Math.abs(value - previous) > Math.PI
    ) {
      parity = parity === 0 ? 1 : 0;
    }
    pieces[parity][xi] = value;
    previous = value;
  }
  const label =
    run === 'coast'
      ? hasCoastRun
        ? 'Coast run'
        : 'Coast (before any maneuver)'
      : segment.segmentIndex === 0
        ? 'Maneuvered run, before the maneuver'
        : `Maneuvered run, after maneuver ${String(segment.segmentIndex)}`;
  const series: PlotSeries[] = [];
  for (const piece of [0, 1] as const) {
    if (piece === 1 && !pieces[1].some((v) => v !== null)) {
      continue;
    }
    series.push({
      id: `${run}-${String(segment.segmentIndex)}-${String(piece)}`,
      run,
      segmentIndex: segment.segmentIndex,
      piece,
      label,
      values: pieces[piece],
    });
  }
  return { series, source: { run, segmentIndex: segment.segmentIndex, t_s, values } };
}

/**
 * The plot of `quantity`. `coast` is the coast run's histories (present with a maneuver); the
 * shown result's own segments are `histories`. Plot order: the coast run first, so the maneuvered
 * run is drawn over it where they coincide (before the maneuver).
 */
export function buildPlotModel(
  histories: ResultHistories,
  coast: ResultHistories | null,
  quantity: HistoryQuantity,
  unit: HistoryUnit,
  maneuverTimes_s: readonly number[],
): PlotModel {
  const hasCoastRun = coast !== null;
  const parts: { run: RunKind; segment: SegmentHistory }[] = [
    ...(coast?.segments ?? []).map((segment) => ({ run: 'coast' as const, segment })),
    ...histories.segments.map((segment) => ({
      run: runOf(segment.segmentIndex, hasCoastRun),
      segment,
    })),
  ];
  const x = mergeTimes(parts.map((p) => p.segment.t_s));
  const series: PlotSeries[] = [];
  const sources: PlotSource[] = [];
  for (const { run, segment } of parts) {
    const built = segmentSeries(run, segment, quantity, unit, x, hasCoastRun);
    series.push(...built.series);
    sources.push(built.source);
  }
  return { quantity, unit, x, series, sources, maneuverTimes_s };
}

export interface ValueAtTime {
  readonly t_s: number;
  readonly value: number | null;
}

/**
 * The engine sample a source holds at `t_s`: the last sample with time <= t_s, or null when t_s
 * is before the segment or after it. Sample-and-hold: no interpolation of a derived quantity.
 */
export function sampleAt(source: PlotSource, t_s: number): ValueAtTime | null {
  const times = source.t_s;
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined || t_s < first || t_s > last) {
    return null;
  }
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((times[mid] ?? Number.POSITIVE_INFINITY) <= t_s) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { t_s: times[lo] ?? t_s, value: source.values[lo] ?? null };
}
