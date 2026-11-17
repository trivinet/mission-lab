/**
 * Plot-state test hook (VI-03 (a) in the browser, ML-FR-008 AC2, ML-FR-010 AC1). Like the scene
 * hook it exists only when the URL carries `?sceneHook=1` and is read-only: `get()` builds a
 * snapshot on demand from the live charts.
 *
 * `plotted` is read back from uPlot's own data store (`u.data`), not from the plot model, so a
 * test compares what the library holds against the analysis module's output (`sources`, the
 * module arrays the plot was built from).
 */
import type { PlotSource, RunKind } from './plot-model';

export interface PlotHookSeries {
  readonly id: string;
  readonly run: RunKind;
  readonly segmentIndex: number;
  readonly piece: number;
  readonly label: string;
  /** From uPlot's data store; null = gap. */
  readonly plotted: (number | null)[];
  /** The line style the chart draws this series with. */
  readonly style: { readonly stroke: string; readonly dash: readonly number[] | null };
}

export interface PlotHookEntry {
  readonly quantity: string;
  readonly unit: string;
  /** From uPlot's data store. */
  readonly x: number[];
  readonly series: readonly PlotHookSeries[];
  /** The analysis module's output for each segment shown. */
  readonly sources: readonly PlotSource[];
  readonly maneuverTimes_s: readonly number[];
  /** The playback cursor of this chart: the time it shows and whether it is inside the axis. */
  readonly cursor: { readonly t_s: number | null; readonly visible: boolean };
}

export interface PlotsTestHook {
  readonly get: () => readonly PlotHookEntry[];
}

declare global {
  interface Window {
    __missionLabPlots?: PlotsTestHook;
  }
}

const readers = new Map<string, () => PlotHookEntry>();

/** Registers a live chart; returns the function that removes it. */
export function registerPlot(id: string, read: () => PlotHookEntry): () => void {
  readers.set(id, read);
  return () => {
    if (readers.get(id) === read) {
      readers.delete(id);
    }
  };
}

export function snapshotPlots(): readonly PlotHookEntry[] {
  return [...readers.values()].map((read) => read());
}
