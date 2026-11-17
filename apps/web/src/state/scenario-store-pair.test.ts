import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import type { RunResponseMessage } from '../worker/protocol';
import { handleRunMessage } from '../worker/run-handler';
import type { SimulationRunner } from '../worker/worker-runner';
import { createScenarioStore } from './scenario-store';

/**
 * ML-TASK-032: with a maneuver, Run also runs the coast request in the worker; the five-state
 * rules and latest-run-wins apply to the pair (ML-FR-010 AC1, ML-UX-001, ML-UX-002).
 */

const realRunner: SimulationRunner = (runId, request) =>
  Promise.resolve().then(() => handleRunMessage({ type: 'run', runId, request }).response);

interface Deferred {
  readonly runId: number;
  readonly request: SimulationRequest;
  resolve: (response: RunResponseMessage) => void;
}

function controlledRunner(): { runner: SimulationRunner; runs: Deferred[] } {
  const runs: Deferred[] = [];
  const runner: SimulationRunner = (runId, request) =>
    new Promise((resolve) => {
      runs.push({ runId, request, resolve });
    });
  return { runner, runs };
}

function resultFor(runId: number, request: SimulationRequest): SimulationResult {
  const { response } = handleRunMessage({ type: 'run', runId, request });
  if (response.type !== 'result') {
    throw new Error('expected a result');
  }
  return response.result;
}

function withManeuver(store: ReturnType<typeof createScenarioStore>): void {
  const s = store.getState();
  s.addManeuver();
  s.setManeuverTime_s(0, 3000);
  s.setManeuverDeltaV_mps(0, 1, 100);
}

describe('coast run with a maneuver', () => {
  it('runs one request without a maneuver and none for the coast', async () => {
    const calls: SimulationRequest[] = [];
    const store = createScenarioStore((runId, request) => {
      calls.push(request);
      return realRunner(runId, request);
    });
    await store.getState().run();
    expect(calls).toHaveLength(1);
    const state = store.getState().resultState;
    expect(state.kind).toBe('current');
    expect(state.kind === 'current' && state.pair).toBeUndefined();
  });

  it('runs the maneuvered and the coast request through the runner and keeps both', async () => {
    const calls: { runId: number; request: SimulationRequest }[] = [];
    const store = createScenarioStore((runId, request) => {
      calls.push({ runId, request });
      return realRunner(runId, request);
    });
    withManeuver(store);
    await store.getState().run();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.request.maneuvers).toHaveLength(1);
    expect(calls[1]?.request.maneuvers).toHaveLength(0);
    expect(calls[1]?.runId).toBe(-(calls[0]?.runId ?? 0));
    const state = store.getState().resultState;
    if (state.kind !== 'current' || state.pair === undefined) {
      throw new Error('a current result with a coast pair was expected');
    }
    expect(state.result.events).toHaveLength(1);
    expect(state.pair.coast.events).toHaveLength(0);
    expect(state.pair.request.requestId).toBe(state.result.requestId);
  });

  it('goes stale and keeps the pair together on a physical edit', async () => {
    const store = createScenarioStore(realRunner);
    withManeuver(store);
    await store.getState().run();
    store.getState().setDuration_s(7000);
    const state = store.getState().resultState;
    expect(state.kind).toBe('stale');
    expect(state.kind === 'stale' && state.pair?.coast.status).toBe('ok');
  });

  it('stays computing until both runs are back, then becomes current', async () => {
    const { runner, runs } = controlledRunner();
    const store = createScenarioStore(runner);
    withManeuver(store);
    const done = store.getState().run();
    const [maneuvered, coast] = runs;
    if (maneuvered === undefined || coast === undefined) {
      throw new Error('two runner calls expected');
    }
    maneuvered.resolve({
      type: 'result',
      runId: maneuvered.runId,
      result: resultFor(maneuvered.runId, maneuvered.request),
    });
    await Promise.resolve();
    expect(store.getState().resultState.kind).toBe('computing');
    coast.resolve({
      type: 'result',
      runId: coast.runId,
      result: resultFor(coast.runId, coast.request),
    });
    await done;
    expect(store.getState().resultState.kind).toBe('current');
  });

  it('a superseded pair is discarded as a whole (latest run wins)', async () => {
    const { runner, runs } = controlledRunner();
    const store = createScenarioStore(runner);
    withManeuver(store);
    const first = store.getState().run();
    store.getState().setDuration_s(7000);
    const second = store.getState().run();
    const [a0, a1, b0, b1] = runs;
    if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) {
      throw new Error('four runner calls expected');
    }
    for (const run of [b0, b1]) {
      run.resolve({ type: 'result', runId: run.runId, result: resultFor(run.runId, run.request) });
    }
    await second;
    const latest = store.getState().resultState;
    expect(latest.kind).toBe('current');
    for (const run of [a0, a1]) {
      run.resolve({ type: 'result', runId: run.runId, result: resultFor(run.runId, run.request) });
    }
    await first;
    expect(store.getState().resultState).toBe(latest);
  });

  it('a failed coast run makes the run an error, not a half result', async () => {
    const store = createScenarioStore((runId, request) =>
      runId < 0
        ? Promise.resolve({ type: 'crashed', runId, message: 'coast boom' } as const)
        : realRunner(runId, request),
    );
    withManeuver(store);
    await store.getState().run();
    const state = store.getState().resultState;
    expect(state.kind).toBe('error');
    expect(state.kind === 'error' && state.message).toContain('coast boom');
  });
});
