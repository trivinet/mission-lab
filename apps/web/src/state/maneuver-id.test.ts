import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { createScenarioStore } from './scenario-store';
import type { ScenarioStore } from './scenario-store';
import { nextManeuverId } from './maneuver-id';

const neverRuns = () => Promise.reject(new Error('not used'));

function storeWithEdits(): ScenarioStore {
  const store = createScenarioStore(neverRuns);
  const s = store.getState();
  s.setDuration_s(5000);
  s.addManeuver();
  s.setManeuverTime_s(0, 3000);
  s.setManeuverDeltaV_mps(0, 1, 12);
  return store;
}

function requestIdOf(store: ScenarioStore): string {
  const built = buildSimulationRequest(store.getState().scenario);
  if (!built.ok) {
    throw new Error('scenario rejected');
  }
  return built.value.requestId;
}

const ids = (store: ScenarioStore): string[] =>
  store.getState().scenario.maneuvers.map((m) => m.id);

describe('deterministic maneuver ids (contracts-v1 section 14)', () => {
  it('nextManeuverId is the first free m<k>', () => {
    expect(nextManeuverId([])).toBe('m1');
    expect(nextManeuverId(['m1'])).toBe('m2');
    expect(nextManeuverId(['m2'])).toBe('m1');
    expect(nextManeuverId(['m1', 'm2', 'other'])).toBe('m3');
  });

  it('two identical scenarios built independently by the same edits have the same requestId', () => {
    const a = storeWithEdits();
    const b = storeWithEdits();
    // The scenario ids are random and differ; they are not part of the request.
    expect(a.getState().scenario.id).not.toBe(b.getState().scenario.id);
    expect(ids(a)).toEqual(['m1']);
    expect(requestIdOf(a)).toBe(requestIdOf(b));
  });

  it('add, remove, add again gives the same id again', () => {
    const store = createScenarioStore(neverRuns);
    store.getState().addManeuver();
    expect(ids(store)).toEqual(['m1']);
    store.getState().removeManeuver(0);
    expect(ids(store)).toEqual([]);
    store.getState().addManeuver();
    expect(ids(store)).toEqual(['m1']);
  });

  it('with several maneuvers a freed id is reused, never duplicated', () => {
    const store = createScenarioStore(neverRuns);
    store.getState().addManeuver();
    store.getState().addManeuver();
    expect(ids(store)).toEqual(['m1', 'm2']);
    store.getState().removeManeuver(0);
    store.getState().addManeuver();
    expect(ids(store)).toEqual(['m2', 'm1']);
    expect(new Set(ids(store)).size).toBe(2);
  });
});
