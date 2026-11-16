import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';

/** Main thread → worker. The request is already validated and built by buildSimulationRequest. */
export interface RunRequestMessage {
  readonly type: 'run';
  /** Echoed in the response; the store keeps only the latest run (latest wins). */
  readonly runId: number;
  readonly request: SimulationRequest;
}

/** Worker → main thread. Typed arrays of `result` are transferred, not copied. */
export type RunResponseMessage =
  | { readonly type: 'result'; readonly runId: number; readonly result: SimulationResult }
  | { readonly type: 'crashed'; readonly runId: number; readonly message: string };
