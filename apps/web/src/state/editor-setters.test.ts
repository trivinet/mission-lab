import { describe, expect, it } from 'vitest';
import { handleRunMessage } from '../worker/run-handler';
import type { SimulationRunner } from '../worker/worker-runner';
import { DEFAULT_SCENARIO_VALUES } from './default-scenario';
import { createScenarioStore } from './scenario-store';
import type { ScenarioStore } from './scenario-store';

/** The real engine through the pure worker handler. */
const realRunner: SimulationRunner = (runId, request) =>
  Promise.resolve().then(() => handleRunMessage({ type: 'run', runId, request }).response);

describe('element and maneuver setters (ML-TASK-022; same physical-edit path as ML-TASK-021)', () => {
  const edits: [string, (s: ScenarioStore) => void][] = [
    [
      'semi-major axis',
      (s) => {
        s.getState().setElement('semiMajorAxis_m', 8_000_000);
      },
    ],
    [
      'eccentricity',
      (s) => {
        s.getState().setElement('eccentricity', 0.2);
      },
    ],
    [
      'inclination',
      (s) => {
        s.getState().setElement('inclination_rad', 1);
      },
    ],
    [
      'raan',
      (s) => {
        s.getState().setElement('raan_rad', 1);
      },
    ],
    [
      'argument of periapsis',
      (s) => {
        s.getState().setElement('argPeriapsis_rad', 1);
      },
    ],
    [
      'true anomaly',
      (s) => {
        s.getState().setElement('trueAnomaly_rad', 1);
      },
    ],
    [
      'add maneuver',
      (s) => {
        s.getState().addManeuver();
      },
    ],
  ];

  it.each(edits)('editing %s while current makes the result stale', async (_n, edit) => {
    const store = createScenarioStore(realRunner);
    await store.getState().run();
    expect(store.getState().resultState.kind).toBe('current');
    edit(store);
    expect(store.getState().resultState.kind).toBe('stale');
  });

  it('maneuver edits and removal are physical edits', async () => {
    const store = createScenarioStore(realRunner);
    store.getState().addManeuver();
    await store.getState().run();
    expect(store.getState().resultState.kind).toBe('current');
    store.getState().setManeuverTime_s(0, 100);
    expect(store.getState().resultState.kind).toBe('stale');
    await store.getState().run();
    store.getState().setManeuverDeltaV_mps(0, 1, 25);
    expect(store.getState().scenario.maneuvers[0]?.deltaV_mps).toEqual([0, 25, 0]);
    expect(store.getState().resultState.kind).toBe('stale');
    await store.getState().run();
    const state = store.getState().resultState;
    expect(state.kind === 'current' && state.result.events).toHaveLength(1);
    store.getState().removeManeuver(0);
    expect(store.getState().scenario.maneuvers).toEqual([]);
    expect(store.getState().resultState.kind).toBe('stale');
  });

  it('a no-op element edit keeps the result current', async () => {
    const store = createScenarioStore(realRunner);
    await store.getState().run();
    store.getState().setElement('eccentricity', DEFAULT_SCENARIO_VALUES.eccentricity);
    expect(store.getState().resultState.kind).toBe('current');
  });

  it('a second maneuver is rejected at run by the engine, with its message', async () => {
    const store = createScenarioStore(realRunner);
    store.getState().addManeuver();
    store.getState().addManeuver();
    await store.getState().run();
    expect(store.getState().resultState.kind).toBe('none');
    expect(store.getState().validationIssues.maneuvers?.[0]?.code).toBe('MANEUVER_COUNT_EXCEEDED');
  });

  it('a perigee below the reference radius prevents the run', async () => {
    const store = createScenarioStore(realRunner);
    store.getState().setElement('semiMajorAxis_m', 6_000_000);
    await store.getState().run();
    expect(store.getState().resultState.kind).toBe('none');
    expect(store.getState().validationIssues['initialOrbit.elements']?.[0]?.code).toBe(
      'PERIGEE_BELOW_REFERENCE_RADIUS',
    );
  });
});
