import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';

/** Main thread → worker. The request is already validated and built by buildSimulationRequest. */
export interface RunRequestMessage {
  readonly type: 'run';
  /** Echoed in the response; the store keeps only the latest run (latest wins). */
  readonly runId: number;
  readonly request: SimulationRequest;
}

/** Diagnostic timing the worker attaches to a response (ML-TASK-026 harness); the UI ignores it. */
export interface WorkerTiming {
  /** Time spent in the engine handler (validation, propagation, result checks), ms. */
  readonly engine_ms: number;
  /** Wall-clock time (ms since the Unix epoch) at which the worker called postMessage. */
  readonly workerPostedAt_ms: number;
}

/** Worker → main thread. Typed arrays of `result` are transferred, not copied. */
export type RunResponseMessage =
  | {
      readonly type: 'result';
      readonly runId: number;
      readonly result: SimulationResult;
      readonly timing?: WorkerTiming;
    }
  | {
      readonly type: 'crashed';
      readonly runId: number;
      readonly message: string;
      readonly timing?: WorkerTiming;
    };
