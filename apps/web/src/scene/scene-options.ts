/**
 * Display options of the 3D view. Deliberately a separate store with no import of the scenario
 * store: a display option can never mark a result stale or start a run (ML-FR-007 AC4).
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

export interface SceneOptionsState {
  /** Inertial GCRF axes (ML-FR-007 AC3). */
  readonly axesVisible: boolean;
  setAxesVisible: (visible: boolean) => void;
}

export type SceneOptionsStore = StoreApi<SceneOptionsState>;

export function createSceneOptionsStore(): SceneOptionsStore {
  return createStore<SceneOptionsState>()((set) => ({
    axesVisible: false,
    setAxesVisible: (axesVisible) => {
      set({ axesVisible });
    },
  }));
}

let defaultOptions: SceneOptionsStore | undefined;

export function getSceneOptionsStore(): SceneOptionsStore {
  defaultOptions ??= createSceneOptionsStore();
  return defaultOptions;
}
