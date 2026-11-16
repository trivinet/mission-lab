import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { handleRunMessage } from './run-handler';
import type { RunRequestMessage, RunResponseMessage } from './protocol';
import { createWorkerRunner } from './worker-runner';
import type { WorkerLike } from './worker-runner';

function request() {
  const built = buildSimulationRequest(newScenario());
  if (!built.ok) {
    throw new Error('default scenario rejected');
  }
  return built.value;
}

/** A worker double that answers through the real pure handler, asynchronously. */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  onmessageerror: WorkerLike['onmessageerror'] = null;
  terminated = false;
  readonly received: RunRequestMessage[] = [];
  constructor(private readonly mode: 'answer' | 'hold' = 'answer') {}
  postMessage(message: RunRequestMessage): void {
    this.received.push(message);
    if (this.mode === 'hold') {
      return;
    }
    const { response } = handleRunMessage(message);
    queueMicrotask(() => this.onmessage?.({ data: response } as MessageEvent<RunResponseMessage>));
  }
  terminate(): void {
    this.terminated = true;
  }
  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

describe('createWorkerRunner', () => {
  it('creates the worker lazily and answers with the matching run id', async () => {
    let created = 0;
    const runner = createWorkerRunner(() => {
      created += 1;
      return new FakeWorker();
    });
    expect(created).toBe(0);
    const response = await runner(5, request());
    expect(created).toBe(1);
    expect(response.type).toBe('result');
    expect(response.runId).toBe(5);
    await runner(6, request());
    expect(created).toBe(1);
  });

  it('turns a worker error into "crashed" for every pending run and re-creates the worker', async () => {
    const workers: FakeWorker[] = [];
    const runner = createWorkerRunner(() => {
      const w = new FakeWorker(workers.length === 0 ? 'hold' : 'answer');
      workers.push(w);
      return w;
    });
    const a = runner(1, request());
    const b = runner(2, request());
    workers[0]?.fail('script error');
    expect(await a).toEqual({
      type: 'crashed',
      runId: 1,
      message: 'The simulation worker failed: script error',
    });
    expect((await b).type).toBe('crashed');
    expect(workers[0]?.terminated).toBe(true);

    const after = await runner(3, request());
    expect(workers).toHaveLength(2);
    expect(after.type).toBe('result');
  });

  it('turns a worker that cannot start into "crashed"', async () => {
    const runner = createWorkerRunner(() => {
      throw new Error('no worker here');
    });
    expect(await runner(1, request())).toEqual({
      type: 'crashed',
      runId: 1,
      message: 'The simulation worker could not start: no worker here',
    });
  });
});
