import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { handleRunMessage } from '../worker/run-handler';
import type { RunResponseMessage } from '../worker/protocol';
import type { SimulationRunner } from '../worker/worker-runner';
import { DEFAULT_SCENARIO_VALUES } from './default-scenario';
import { createScenarioStore, groupIssuesByPath } from './scenario-store';

/** The real engine through the pure worker handler, resolved asynchronously. */
const realRunner: SimulationRunner = (runId, request) =>
  Promise.resolve().then(() => handleRunMessage({ type: 'run', runId, request }).response);

interface Deferred {
  readonly runId: number;
  readonly request: SimulationRequest;
  resolve: (response: RunResponseMessage) => void;
}

/** A runner whose runs finish only when the test says so. */
function controlledRunner(): { runner: SimulationRunner; runs: Deferred[] } {
  const runs: Deferred[] = [];
  const runner: SimulationRunner = (runId, request) =>
    new Promise((resolve) => {
      runs.push({ runId, request, resolve });
    });
  return { runner, runs };
}

function realResultFor(runId: number, request: SimulationRequest): SimulationResult {
  const { response } = handleRunMessage({ type: 'run', runId, request });
  if (response.type !== 'result') {
    throw new Error('expected a result');
  }
  return response.result;
}

describe('scenario store', () => {
  it('starts with a valid default scenario and result state none', () => {
    const store = createScenarioStore(realRunner);
    const { scenario, resultState, validationIssues } = store.getState();
    expect(resultState).toEqual({ kind: 'none' });
    expect(validationIssues).toEqual({});
    expect(scenario.duration_s).toBe(DEFAULT_SCENARIO_VALUES.duration_s);
  });

  it('none -> computing -> current with the real engine; keeps no error', async () => {
    const store = createScenarioStore(realRunner);
    const kinds = [store.getState().resultState.kind];
    store.subscribe((s) => {
      kinds.push(s.resultState.kind);
    });
    await store.getState().run();
    expect(kinds).toEqual(['none', 'computing', 'current']);
    const state = store.getState().resultState;
    expect(state.kind === 'current' && state.result.status).toBe('ok');
  });

  describe('physical edits (ML-UX-002)', () => {
    it.each([
      [
        'duration',
        (s: ReturnType<typeof createScenarioStore>) => {
          s.getState().setDuration_s(3000);
        },
      ],
      [
        'output step',
        (s: ReturnType<typeof createScenarioStore>) => {
          s.getState().setOutputStep_s(30);
        },
      ],
      [
        'epoch',
        (s: ReturnType<typeof createScenarioStore>) => {
          s.getState().setEpochIso('2027-02-03T04:05:06.000Z');
        },
      ],
    ])('editing the %s while current makes the result stale, not recomputed', async (_n, edit) => {
      const calls: number[] = [];
      const store = createScenarioStore((runId, request) => {
        calls.push(runId);
        return realRunner(runId, request);
      });
      await store.getState().run();
      expect(store.getState().resultState.kind).toBe('current');
      edit(store);
      const state = store.getState().resultState;
      expect(state.kind).toBe('stale');
      expect(state.kind === 'stale' && state.result?.status).toBe('ok');
      expect(calls).toEqual([1]); // never silently recomputed
    });

    it('editing the name while current does not make the result stale', async () => {
      const store = createScenarioStore(realRunner);
      await store.getState().run();
      store.getState().setName('Renamed');
      expect(store.getState().scenario.name).toBe('Renamed');
      expect(store.getState().resultState.kind).toBe('current');
    });

    it('setting a physical field to its current value changes nothing', async () => {
      const store = createScenarioStore(realRunner);
      await store.getState().run();
      store.getState().setDuration_s(DEFAULT_SCENARIO_VALUES.duration_s);
      expect(store.getState().resultState.kind).toBe('current');
    });

    it('editing while none or stale leaves the state as it is', async () => {
      const store = createScenarioStore(realRunner);
      store.getState().setDuration_s(1200);
      expect(store.getState().resultState.kind).toBe('none');
      await store.getState().run();
      store.getState().setDuration_s(1800);
      const stale = store.getState().resultState;
      store.getState().setDuration_s(2400);
      expect(store.getState().resultState).toBe(stale);
    });

    it('editing while computing makes the state stale and discards the run in flight', async () => {
      const { runner, runs } = controlledRunner();
      const store = createScenarioStore(runner);
      const done = store.getState().run();
      expect(store.getState().resultState.kind).toBe('computing');
      store.getState().setDuration_s(1200);
      expect(store.getState().resultState).toEqual({ kind: 'stale', result: null });
      const run = runs[0];
      if (run === undefined) {
        throw new Error('no run started');
      }
      run.resolve({
        type: 'result',
        runId: run.runId,
        result: realResultFor(run.runId, run.request),
      });
      await done;
      expect(store.getState().resultState).toEqual({ kind: 'stale', result: null });
    });
  });

  describe('superseded runs (latest wins)', () => {
    it('discards the result of an earlier run that finishes after a later one', async () => {
      const { runner, runs } = controlledRunner();
      const store = createScenarioStore(runner);
      const first = store.getState().run();
      store.getState().setDuration_s(1200); // second run uses a different scenario
      const second = store.getState().run();
      const [a, b] = runs;
      if (a === undefined || b === undefined) {
        throw new Error('two runs expected');
      }
      expect(b.runId).toBeGreaterThan(a.runId);
      expect(store.getState().resultState).toEqual({ kind: 'computing', runId: b.runId });

      // The later run finishes first, then the earlier one arrives late.
      b.resolve({ type: 'result', runId: b.runId, result: realResultFor(b.runId, b.request) });
      await second;
      const afterSecond = store.getState().resultState;
      expect(afterSecond.kind).toBe('current');

      a.resolve({ type: 'result', runId: a.runId, result: realResultFor(a.runId, a.request) });
      await first;
      expect(store.getState().resultState).toBe(afterSecond);
      expect(afterSecond.kind === 'current' && afterSecond.result.requestId).toBe(
        b.request.requestId,
      );
    });

    it('discards an earlier run that finishes while a later one is still computing', async () => {
      const { runner, runs } = controlledRunner();
      const store = createScenarioStore(runner);
      const first = store.getState().run();
      const second = store.getState().run();
      const [a, b] = runs;
      if (a === undefined || b === undefined) {
        throw new Error('two runs expected');
      }
      a.resolve({ type: 'result', runId: a.runId, result: realResultFor(a.runId, a.request) });
      await first;
      expect(store.getState().resultState).toEqual({ kind: 'computing', runId: b.runId });
      b.resolve({ type: 'crashed', runId: b.runId, message: 'later run failed' });
      await second;
      expect(store.getState().resultState.kind).toBe('error');
    });

    it('starting a new scenario discards a run in flight', async () => {
      const { runner, runs } = controlledRunner();
      const store = createScenarioStore(runner);
      const done = store.getState().run();
      store.getState().startNewScenario();
      expect(store.getState().resultState).toEqual({ kind: 'none' });
      const run = runs[0];
      if (run === undefined) {
        throw new Error('no run started');
      }
      run.resolve({
        type: 'result',
        runId: run.runId,
        result: realResultFor(run.runId, run.request),
      });
      await done;
      expect(store.getState().resultState).toEqual({ kind: 'none' });
    });
  });

  describe('error state', () => {
    it('a result with status "failed" gives the error state with its diagnostics', async () => {
      const store = createScenarioStore(async (runId, request) => {
        const ok = realResultFor(runId, request);
        await Promise.resolve();
        const failed: SimulationResult = {
          ...ok,
          status: 'failed',
          segments: [],
          events: [],
          diagnostics: [
            { severity: 'error', code: 'PROPAGATOR_NOT_CONVERGED', message: 'no convergence' },
          ],
        };
        return { type: 'result', runId, result: failed };
      });
      await store.getState().run();
      expect(store.getState().resultState).toEqual({
        kind: 'error',
        diagnostics: [
          { severity: 'error', code: 'PROPAGATOR_NOT_CONVERGED', message: 'no convergence' },
        ],
        message: 'no convergence',
      });
    });

    it('a worker failure gives the error state with a plain message, and a new run recovers', async () => {
      let fail = true;
      const store = createScenarioStore((runId, request) =>
        fail
          ? Promise.resolve({ type: 'crashed', runId, message: 'worker died' })
          : realRunner(runId, request),
      );
      await store.getState().run();
      expect(store.getState().resultState).toEqual({
        kind: 'error',
        diagnostics: [],
        message: 'worker died',
      });
      fail = false;
      await store.getState().run();
      expect(store.getState().resultState.kind).toBe('current');
    });

    it('a successful result with warnings is current and keeps the warnings', async () => {
      const store = createScenarioStore(async (runId, request) => {
        const ok = realResultFor(runId, request);
        await Promise.resolve();
        return {
          type: 'result',
          runId,
          result: {
            ...ok,
            diagnostics: [
              { severity: 'warning', code: 'REFERENCE_SPHERE_INTERSECTION', message: 'w', t_s: 10 },
            ],
          },
        };
      });
      await store.getState().run();
      const state = store.getState().resultState;
      expect(state.kind).toBe('current');
      expect(state.kind === 'current' && state.warnings).toHaveLength(1);
    });
  });

  describe('validation issues', () => {
    it('prevent the run, are kept per field path, and leave the result state unchanged', async () => {
      const calls: number[] = [];
      const store = createScenarioStore((runId, request) => {
        calls.push(runId);
        return realRunner(runId, request);
      });
      store.getState().setDuration_s(-5);
      store.getState().setOutputStep_s(Number.NaN);
      await store.getState().run();
      expect(calls).toEqual([]);
      expect(store.getState().resultState).toEqual({ kind: 'none' });
      const issues = store.getState().validationIssues;
      expect(Object.keys(issues).sort()).toEqual(['duration_s', 'outputStep_s']);
      expect(issues.duration_s?.[0]?.code).toBe('DURATION_NOT_POSITIVE');
    });

    it('editing a field clears its issues only; a valid run clears the rest', async () => {
      const store = createScenarioStore(realRunner);
      store.getState().setDuration_s(-5);
      store.getState().setOutputStep_s(-1);
      await store.getState().run();
      store.getState().setDuration_s(1200);
      expect(Object.keys(store.getState().validationIssues)).toEqual(['outputStep_s']);
      store.getState().setOutputStep_s(60);
      await store.getState().run();
      expect(store.getState().validationIssues).toEqual({});
      expect(store.getState().resultState.kind).toBe('current');
    });

    it('a rejected run from the stale state leaves it stale', async () => {
      const store = createScenarioStore(realRunner);
      await store.getState().run();
      store.getState().setDuration_s(-1);
      await store.getState().run();
      expect(store.getState().resultState.kind).toBe('stale');
    });
  });

  it('startNewScenario replaces the scenario and resets result and issues', async () => {
    const store = createScenarioStore(realRunner);
    const before = store.getState().scenario.id;
    store.getState().setName('Changed');
    await store.getState().run();
    store.getState().startNewScenario();
    expect(store.getState().scenario.id).not.toBe(before);
    expect(store.getState().scenario.name).toBe(DEFAULT_SCENARIO_VALUES.name);
    expect(store.getState().resultState).toEqual({ kind: 'none' });
  });
});

describe('groupIssuesByPath', () => {
  it('joins the path with dots', () => {
    const grouped = groupIssuesByPath([
      { code: 'ID_EMPTY', path: ['maneuvers', 0, 'id'], message: 'm' },
      { code: 'ID_EMPTY', path: ['maneuvers', 0, 'id'], message: 'n' },
    ]);
    expect(grouped['maneuvers.0.id']).toHaveLength(2);
  });
});
