/**
 * Display options of the 3D view. Deliberately a separate store with no import of the scenario
 * store: a display option can never mark a result stale or start a run (ML-FR-007 AC4).
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

export interface SceneOptionsState {
  /** Inertial GCRF axes (ML-FR-007 AC3). */
  readonly axesVisible: boolean;
  /** Flat sample index of the spacecraft marker (ML-TASK-024 replaces this by playback time). */
  readonly markerFlatIndex: number;
  setAxesVisible: (visible: boolean) => void;
  setMarkerFlatIndex: (index: number) => void;
}

export type SceneOptionsStore = StoreApi<SceneOptionsState>;

export function createSceneOptionsStore(): SceneOptionsStore {
  return createStore<SceneOptionsState>()((set) => ({
    axesVisible: false,
    markerFlatIndex: 0,
    setAxesVisible: (axesVisible) => {
      set({ axesVisible });
    },
    setMarkerFlatIndex: (markerFlatIndex) => {
      set({ markerFlatIndex });
    },
  }));
}

let defaultOptions: SceneOptionsStore | undefined;

export function getSceneOptionsStore(): SceneOptionsStore {
  defaultOptions ??= createSceneOptionsStore();
  return defaultOptions;
}
