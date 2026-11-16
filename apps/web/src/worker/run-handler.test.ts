import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { handleRunMessage } from './run-handler';
import type { RunRequestMessage, RunResponseMessage } from './protocol';

function message(runId: number): RunRequestMessage {
  const built = buildSimulationRequest(newScenario());
  if (!built.ok) {
    throw new Error('default scenario rejected');
  }
  return { type: 'run', runId, request: built.value };
}

describe('handleRunMessage', () => {
  it('runs the real engine and echoes the run id', () => {
    const { response } = handleRunMessage(message(42));
    expect(response.type).toBe('result');
    if (response.type !== 'result') {
      return;
    }
    expect(response.runId).toBe(42);
    expect(response.result.status).toBe('ok');
    expect(response.result.segments.length).toBeGreaterThan(0);
  });

  it('lists every typed-array buffer for transfer, and transferring detaches (moves) them', () => {
    const { response, transfer } = handleRunMessage(message(1));
    if (response.type !== 'result') {
      throw new Error('expected a result');
    }
    const arrays = response.result.segments.flatMap((s) => [s.t_s, s.position_m, s.velocity_mps]);
    expect(transfer).toHaveLength(arrays.length);
    expect(new Set(transfer).size).toBe(transfer.length);

    const lengths = arrays.map((a) => a.length);
    const received: RunResponseMessage = structuredClone<RunResponseMessage>(response, {
      transfer,
    });
    // The source buffers are detached: they were moved, not copied.
    expect(arrays.every((a) => a.byteLength === 0)).toBe(true);
    if (received.type !== 'result') {
      throw new Error('expected a result');
    }
    const receivedArrays = received.result.segments.flatMap((s) => [
      s.t_s,
      s.position_m,
      s.velocity_mps,
    ]);
    expect(receivedArrays.map((a) => a.length)).toEqual(lengths);
  });

  it('answers "crashed" with a plain message for a request the engine rejects', () => {
    const bad = {
      type: 'run',
      runId: 3,
      request: { not: 'a request' },
    } as unknown as RunRequestMessage;
    const { response, transfer } = handleRunMessage(bad);
    expect(transfer).toEqual([]);
    expect(response.type).toBe('crashed');
    expect(response.runId).toBe(3);
  });

  it('answers "crashed" when the engine throws', () => {
    // A getter that throws makes the run fail in a way the engine does not handle.
    const hostile = {
      type: 'run',
      runId: 4,
      get request(): never {
        throw new Error('hostile request');
      },
    } as unknown as RunRequestMessage;
    const { response } = handleRunMessage(hostile);
    expect(response).toEqual({
      type: 'crashed',
      runId: 4,
      message: 'The simulation worker failed unexpectedly: hostile request',
    });
  });
});
