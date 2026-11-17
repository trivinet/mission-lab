/**
 * ML-FR-007 AC4: a display option never starts a run and never changes the result state.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { createScenarioStore } from '../state/scenario-store';
import type { SimulationRunner } from '../worker/worker-runner';
import { createSceneOptionsStore } from './scene-options';
import { resultToShow } from './scene-source';

describe('display options (AC4)', () => {
  it('toggling an option starts no run and leaves the result state untouched', async () => {
    const requests: SimulationRequest[] = [];
    const runner: SimulationRunner = (_runId, request) => {
      requests.push(request);
      return Promise.reject(new Error('the runner must not be called by a display option'));
    };
    const scenarioStore = createScenarioStore(runner);
    const options = createSceneOptionsStore();
    const before = scenarioStore.getState();

    options.getState().setAxesVisible(true);
    options.getState().setAxesVisible(false);
    await Promise.resolve();

    expect(requests).toHaveLength(0);
    expect(scenarioStore.getState().resultState).toBe(before.resultState);
    expect(scenarioStore.getState().scenario).toBe(before.scenario);
    expect(options.getState().axesVisible).toBe(false);
  });

  it('the scene draws no trajectory for none, computing and error', () => {
    expect(resultToShow({ kind: 'none' })).toBeNull();
    expect(resultToShow({ kind: 'computing', runId: 1 })).toBeNull();
    expect(resultToShow({ kind: 'error', diagnostics: [], message: 'x' })).toBeNull();
    expect(resultToShow({ kind: 'stale', result: null })).toBeNull();
  });
});
