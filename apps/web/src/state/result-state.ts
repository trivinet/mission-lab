/**
 * The five result states of ML-UX-001 and their transitions (ML-UX-002). Pure: no store, no
 * browser API. The store applies these transitions; the tests drive them directly.
 *
 * | from               | event             | to                                                    |
 * |--------------------|-------------------|-------------------------------------------------------|
 * | none               | RUN_STARTED       | computing                                             |
 * | current            | RUN_STARTED       | computing                                             |
 * | stale              | RUN_STARTED       | computing                                             |
 * | error              | RUN_STARTED       | computing                                             |
 * | computing          | RUN_STARTED       | computing (new run id; the earlier run is superseded) |
 * | computing          | RUN_FINISHED ok   | current (only if run id matches), keeps warnings      |
 * | computing          | RUN_FINISHED fail | error (only if run id matches), keeps diagnostics     |
 * | computing          | RUN_CRASHED       | error (only if run id matches), plain message         |
 * | current            | PHYSICAL_EDIT     | stale (keeps the old result, marked stale)            |
 * | computing          | PHYSICAL_EDIT     | stale (no result; the run in flight is discarded)     |
 * | none, stale, error | PHYSICAL_EDIT     | unchanged                                             |
 * | any other state    | RUN_FINISHED/CRASHED | unchanged (late or superseded run: ignored)        |
 *
 * An ignored event returns the same state object it received.
 */
import type { Diagnostic, SimulationResult } from '@mission-lab/contracts';

export type ResultState =
  | { readonly kind: 'none' }
  | { readonly kind: 'computing'; readonly runId: number }
  | {
      readonly kind: 'current';
      readonly result: SimulationResult;
      /** Diagnostics of severity "warning" of the successful result (ML-UX-001). */
      readonly warnings: readonly Diagnostic[];
    }
  | {
      readonly kind: 'stale';
      /** The result of the previous scenario, shown only as stale; null if none was available. */
      readonly result: SimulationResult | null;
    }
  | {
      readonly kind: 'error';
      readonly diagnostics: readonly Diagnostic[];
      /** Plain-language summary: the first error diagnostic, or the worker failure text. */
      readonly message: string;
    };

export type ResultEvent =
  | { readonly type: 'RUN_STARTED'; readonly runId: number }
  | { readonly type: 'RUN_FINISHED'; readonly runId: number; readonly result: SimulationResult }
  | { readonly type: 'RUN_CRASHED'; readonly runId: number; readonly message: string }
  | { readonly type: 'PHYSICAL_EDIT' };

export const INITIAL_RESULT_STATE: ResultState = { kind: 'none' };

export function transitionResult(state: ResultState, event: ResultEvent): ResultState {
  switch (event.type) {
    case 'RUN_STARTED':
      return { kind: 'computing', runId: event.runId };
    case 'RUN_FINISHED': {
      if (state.kind !== 'computing' || state.runId !== event.runId) {
        return state;
      }
      const { result } = event;
      if (result.status === 'failed') {
        const first = result.diagnostics.find((d) => d.severity === 'error');
        return {
          kind: 'error',
          diagnostics: result.diagnostics,
          message: first?.message ?? 'The simulation failed.',
        };
      }
      return {
        kind: 'current',
        result,
        warnings: result.diagnostics.filter((d) => d.severity === 'warning'),
      };
    }
    case 'RUN_CRASHED':
      if (state.kind !== 'computing' || state.runId !== event.runId) {
        return state;
      }
      return { kind: 'error', diagnostics: [], message: event.message };
    case 'PHYSICAL_EDIT':
      if (state.kind === 'current') {
        return { kind: 'stale', result: state.result };
      }
      if (state.kind === 'computing') {
        return { kind: 'stale', result: null };
      }
      return state;
  }
}
