/**
 * Playback state: the one source of the displayed time (ML-FR-008 AC2). The timeline read-out,
 * the spacecraft marker and any future plot cursor read `t_s` from here.
 *
 * Deliberately a separate store with no import of the scenario store: playback can never mark a
 * result stale, change the result state or start a run (the store has no runner).
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { DEFAULT_RATE } from './time-control';

export interface PlaybackState {
  /** Playback time, s from the scenario epoch. */
  readonly t_s: number;
  readonly playing: boolean;
  /** Simulated seconds per real second. */
  readonly rate: number;
  setTime_s: (t_s: number) => void;
  setPlaying: (playing: boolean) => void;
  setRate: (rate: number) => void;
}

export type PlaybackStore = StoreApi<PlaybackState>;

export function createPlaybackStore(): PlaybackStore {
  return createStore<PlaybackState>()((set) => ({
    t_s: 0,
    playing: false,
    rate: DEFAULT_RATE,
    setTime_s: (t_s) => {
      set({ t_s });
    },
    setPlaying: (playing) => {
      set({ playing });
    },
    setRate: (rate) => {
      set({ rate });
    },
  }));
}

let defaultStore: PlaybackStore | undefined;

export function getPlaybackStore(): PlaybackStore {
  defaultStore ??= createPlaybackStore();
  return defaultStore;
}
