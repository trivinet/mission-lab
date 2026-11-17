/**
 * The worker's logic as a pure function (no `self`, no postMessage), so that a Vitest test can
 * drive it without a browser. simulation.worker.ts is only the thin message plumbing around it.
 */
import { runSimulation } from '@mission-lab/simulation';
import { packHistories, packedBuffers } from './analysis-pack';
import type { RunRequestMessage, RunResponseMessage } from './protocol';

export interface HandledRun {
  readonly response: RunResponseMessage;
  /** Buffers to pass in the postMessage transfer list (architecture §5). */
  readonly transfer: ArrayBuffer[];
  /** Time spent on the analysis (histories), ms; absent when none was computed. */
  readonly analysis_ms?: number;
}

export function handleRunMessage(message: RunRequestMessage): HandledRun {
  try {
    const outcome = runSimulation(message.request);
    if (!outcome.ok) {
      const codes = outcome.issues.map((issue) => issue.code).join(', ');
      return {
        response: {
          type: 'crashed',
          runId: message.runId,
          message: `The engine rejected a request that had passed validation (${codes}).`,
        },
        transfer: [],
      };
    }
    const result = outcome.value;
    // Each typed array owns its whole ArrayBuffer (contracts-v1 §5.2, R11), so transferring the
    // buffers moves the data without copying.
    const transfer: ArrayBuffer[] = [];
    for (const segment of result.segments) {
      for (const array of [segment.t_s, segment.position_m, segment.velocity_mps]) {
        if (array.buffer instanceof ArrayBuffer) {
          transfer.push(array.buffer);
        }
      }
    }
    if (result.status !== 'ok') {
      return { response: { type: 'result', runId: message.runId, result }, transfer };
    }
    // The O(N) analysis runs here, off the main thread (ML-TASK-044, D-1); the main thread
    // receives ready typed arrays. It is computed before the post, because the transfer detaches
    // the result's arrays.
    const analysisStarted_ms = performance.now();
    const analysis = packHistories(result);
    const analysis_ms = performance.now() - analysisStarted_ms;
    transfer.push(...packedBuffers(analysis));
    return {
      response: { type: 'result', runId: message.runId, result, analysis },
      transfer,
      analysis_ms,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      response: {
        type: 'crashed',
        runId: message.runId,
        message: `The simulation worker failed unexpectedly: ${detail}`,
      },
      transfer: [],
    };
  }
}
