import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import type { PackedHistories } from './analysis-pack';

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
  /** Time spent computing and packing the histories in the worker (ML-TASK-044), ms. */
  readonly analysis_ms?: number;
  /** Wall-clock time (ms since the Unix epoch) at which the worker called postMessage. */
  readonly workerPostedAt_ms: number;
}

/** Worker → main thread. Typed arrays of `result` are transferred, not copied. */
export type RunResponseMessage =
  | {
      readonly type: 'result';
      readonly runId: number;
      readonly result: SimulationResult;
      /**
       * The analysis histories of `result`, computed in the worker by the analysis module and
       * transferred as typed arrays (ML-TASK-044). Absent when the run failed.
       */
      readonly analysis?: PackedHistories;
      readonly timing?: WorkerTiming;
    }
  | {
      readonly type: 'crashed';
      readonly runId: number;
      readonly message: string;
      readonly timing?: WorkerTiming;
    };
