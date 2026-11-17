/**
 * ML-TASK-024 integration (AC2) and store checks: the playback time read from the store is the
 * time the marker is computed from and the time the hook reports; the marker at a sample time is
 * the scene vertex (VI-02); playback never touches the scenario store or the runner.
 */
import type { Scenario, SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest, runSimulation } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { buildSceneGeometry } from '../scene/scene-geometry';
import { buildSceneHookState } from '../scene/scene-hook';
import { markerAt } from '../scene/scene-marker';
import { SCENE_SCALE } from '../scene/scene-scale';
import { newScenario } from '../state/default-scenario';
import { createScenarioStore } from '../state/scenario-store';
import type { SimulationRunner } from '../worker/worker-runner';
import { createPlaybackStore } from './playback-store';
import { MAX_FRAME_S, advanceTime, maneuverTimes_s, nextManeuverTime_s } from './time-control';

function runEngine(scenario: Scenario): SimulationResult {
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error('scenario rejected');
  }
  const outcome = runSimulation(built.value);
  if (!outcome.ok) {
    throw new Error('run rejected');
  }
  return outcome.value;
}

const maneuvered: Scenario = {
  ...newScenario(),
  maneuvers: [{ id: 'm1', t_s: 3000, frame: 'RSW', deltaV_mps: [0, 100, 0] }],
};

describe('one playback time for read-out, marker and hook (AC2)', () => {
  const result = runEngine(maneuvered);
  const geometry = buildSceneGeometry(result);

  for (const t of [0, 1234.5, 2999.75, 3000, 3000.5, 6000]) {
    it(`t = ${String(t)} s: store, marker source and hook agree`, () => {
      const store = createPlaybackStore();
      store.getState().setTime_s(t);
      const storeT = store.getState().t_s;
      const marker = markerAt(result, storeT);
      const hook = buildSceneHookState({
        resultKind: 'current',
        geometry,
        fallbackReferenceRadius_m: 0,
        fallbackEpochIso: '',
        scale: SCENE_SCALE,
        axesVisible: false,
        marker,
        camera: null,
      });
      expect(hook.spacecraftMarker?.t_s).toBe(storeT);
      expect(Object.is(hook.spacecraftMarker?.t_s, storeT)).toBe(true);
    });
  }

  it('at a sample time the marker is the scene vertex; at the maneuver time it is segment 1 sample 0', () => {
    for (const segment of result.segments) {
      for (const [i, t] of segment.t_s.entries()) {
        const marker = markerAt(result, t);
        const owner = result.segments.filter((s) => s.t_s[0] === t && s.index > segment.index);
        if (owner.length > 0) {
          continue;
        }
        for (const k of [0, 1, 2]) {
          expect(
            Object.is(
              marker?.position[k],
              Math.fround((segment.position_m[3 * i + k] ?? 0) * SCENE_SCALE),
            ),
          ).toBe(true);
          expect(
            Object.is(marker?.position[k], geometry.segments[segment.index]?.vertices[3 * i + k]),
          ).toBe(true);
        }
      }
    }
    const atManeuver = markerAt(result, 3000);
    expect(atManeuver).toMatchObject({ segmentIndex: 1, sampleIndex: 0, interpolated: false });
  });

  it('between samples the marker is flagged interpolated and is a float32 scene value', () => {
    const marker = markerAt(result, 30);
    expect(marker?.interpolated).toBe(true);
    expect(marker?.sampleIndex).toBeNull();
    for (const v of marker?.position ?? []) {
      expect(Object.is(v, Math.fround(v))).toBe(true);
    }
  });
});

describe('playback helpers and store', () => {
  it('lists the maneuver times and jumps to the next one, wrapping', () => {
    const result = runEngine(maneuvered);
    const times = maneuverTimes_s(result.segments);
    expect(times).toEqual([3000]);
    expect(nextManeuverTime_s(times, 0)).toBe(3000);
    expect(nextManeuverTime_s(times, 3000)).toBe(3000);
    expect(nextManeuverTime_s([], 0)).toBeNull();
  });

  it('advances by step x rate, caps a long frame, and stops exactly at the end', () => {
    expect(advanceTime(0, 0.1, 300, 6000)).toEqual({ t_s: 30, ended: false });
    expect(advanceTime(0, 10, 100, 6000)).toEqual({ t_s: MAX_FRAME_S * 100, ended: false });
    expect(advanceTime(5990, 0.1, 300, 6000)).toEqual({ t_s: 6000, ended: true });
  });

  it('playback never starts a run or changes the result state', async () => {
    const requests: SimulationRequest[] = [];
    const runner: SimulationRunner = (_runId, request) => {
      requests.push(request);
      return Promise.reject(new Error('playback must not call the runner'));
    };
    const scenarioStore = createScenarioStore(runner);
    const before = scenarioStore.getState();
    const playback = createPlaybackStore();
    playback.getState().setPlaying(true);
    playback.getState().setRate(1000);
    playback.getState().setTime_s(1234);
    playback.getState().setPlaying(false);
    await Promise.resolve();
    expect(requests).toHaveLength(0);
    expect(scenarioStore.getState().resultState).toBe(before.resultState);
    expect(scenarioStore.getState().scenario).toBe(before.scenario);
  });
});
