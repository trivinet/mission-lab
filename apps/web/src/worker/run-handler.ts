/**
 * The worker's logic as a pure function (no `self`, no postMessage), so that a Vitest test can
 * drive it without a browser. simulation.worker.ts is only the thin message plumbing around it.
 */
import { runSimulation } from '@mission-lab/simulation';
import type { RunRequestMessage, RunResponseMessage } from './protocol';

export interface HandledRun {
  readonly response: RunResponseMessage;
  /** Buffers to pass in the postMessage transfer list (architecture §5). */
  readonly transfer: ArrayBuffer[];
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
    return { response: { type: 'result', runId: message.runId, result }, transfer };
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
