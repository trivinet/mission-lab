import type { SimulationRequest } from '@mission-lab/contracts';
import type { RunRequestMessage, RunResponseMessage } from './protocol';

/** Runs one request and resolves with the worker's response for that run id. Never rejects. */
export type SimulationRunner = (
  runId: number,
  request: SimulationRequest,
) => Promise<RunResponseMessage>;

/** The part of `Worker` the host uses; a test double can implement it. */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<RunResponseMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: RunRequestMessage): void;
  terminate(): void;
}

/**
 * Worker host. The worker is created on the first run and re-created after a worker failure.
 * A worker error resolves every pending run as `crashed` with a plain message.
 */
export function createWorkerRunner(createWorker: () => WorkerLike): SimulationRunner {
  let worker: WorkerLike | null = null;
  const pending = new Map<number, (response: RunResponseMessage) => void>();

  function failAll(message: string): void {
    const waiting = [...pending.entries()];
    pending.clear();
    worker?.terminate();
    worker = null;
    for (const [runId, resolve] of waiting) {
      resolve({ type: 'crashed', runId, message });
    }
  }

  function ensureWorker(): WorkerLike {
    if (worker !== null) {
      return worker;
    }
    const created = createWorker();
    created.onmessage = (event) => {
      const resolve = pending.get(event.data.runId);
      pending.delete(event.data.runId);
      resolve?.(event.data);
    };
    created.onerror = (event) => {
      failAll(
        event.message === ''
          ? 'The simulation worker failed.'
          : `The simulation worker failed: ${event.message}`,
      );
    };
    created.onmessageerror = () => {
      failAll('The simulation worker sent a message that could not be read.');
    };
    worker = created;
    return created;
  }

  return (runId, request) =>
    new Promise<RunResponseMessage>((resolve) => {
      try {
        const target = ensureWorker();
        pending.set(runId, resolve);
        target.postMessage({ type: 'run', runId, request });
      } catch (error) {
        pending.delete(runId);
        const detail = error instanceof Error ? error.message : String(error);
        resolve({
          type: 'crashed',
          runId,
          message: `The simulation worker could not start: ${detail}`,
        });
      }
    });
}

/** The production runner: a Vite module worker. */
export function createBrowserWorkerRunner(): SimulationRunner {
  return createWorkerRunner(
    () => new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }),
  );
}
