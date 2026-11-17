/**
 * Timeline and playback controls (ML-FR-008, ML-UX-004). Reads and writes the playback store only;
 * it never starts a run and never changes the result state. Every control is a native element
 * (button, range input, select), so it is keyboard operable with the global visible focus ring.
 *
 * The displayed time is the store's `t_s`: the read-out, the slider and the spacecraft marker
 * (scene/WorkspaceScene.tsx) all read it from there.
 */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { formatInputNumber, utcLabel } from '../format/units';
import { resultToShow } from '../scene/scene-source';
import { getScenarioStore } from '../state/scenario-store';
import { displayPositionAt, resultTimeSpan_s } from './interpolate';
import { getPlaybackStore } from './playback-store';
import { PLAYBACK_RATES, advanceTime, maneuverTimes_s, nextManeuverTime_s } from './time-control';

export function Timeline() {
  const playbackStore = getPlaybackStore();
  const resultState = useStore(getScenarioStore(), (s) => s.resultState);
  const epochIso = useStore(getScenarioStore(), (s) => s.scenario.epoch.iso);
  const t_s = useStore(playbackStore, (s) => s.t_s);
  const playing = useStore(playbackStore, (s) => s.playing);
  const rate = useStore(playbackStore, (s) => s.rate);

  const result = resultToShow(resultState);
  const segments = result?.segments ?? null;
  const span = segments === null ? null : resultTimeSpan_s(segments);
  const start_s = span?.start_s ?? 0;
  const end_s = span?.end_s ?? 0;
  const maneuvers = segments === null ? [] : maneuverTimes_s(segments);
  const enabled = span !== null;

  // A different result (a new run, or none) restarts the timeline at its start, paused. The same
  // result shown stale keeps its object, so editing an input does not move the playback.
  useEffect(() => {
    const store = getPlaybackStore().getState();
    store.setPlaying(false);
    store.setTime_s(0);
  }, [result]);

  // The frame loop: advances the store's time while playing; stops exactly at the end.
  useEffect(() => {
    if (!playing || !enabled) {
      return;
    }
    let last: number | null = null;
    let frame = 0;
    const tick = (now: number): void => {
      const state = playbackStore.getState();
      if (last !== null) {
        const next = advanceTime(state.t_s, (now - last) / 1000, state.rate, end_s);
        state.setTime_s(next.t_s);
        if (next.ended) {
          state.setPlaying(false);
          return;
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, enabled, end_s, playbackStore]);

  const shownT_s = Math.min(Math.max(t_s, start_s), end_s);
  const at = segments === null ? null : displayPositionAt(segments, shownT_s);
  const utc = enabled ? utcLabel(epochIso, shownT_s) : null;
  const state = playbackStore.getState();

  const togglePlay = (): void => {
    if (playing) {
      state.setPlaying(false);
      return;
    }
    if (shownT_s >= end_s) {
      state.setTime_s(start_s);
    }
    state.setPlaying(true);
  };

  return (
    <section
      className="panel"
      aria-labelledby="h-timeline"
      data-testid="timeline"
      data-playing={playing ? 'true' : 'false'}
    >
      <h2 id="h-timeline">
        Timeline <span className="tag">display only</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="playback-start"
          disabled={!enabled}
          onClick={() => {
            state.setTime_s(start_s);
          }}
        >
          Jump to start
        </button>
        <button
          type="button"
          className="primary"
          data-testid="playback-toggle"
          disabled={!enabled}
          onClick={togglePlay}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          data-testid="playback-maneuver"
          disabled={maneuvers.length === 0}
          onClick={() => {
            const target = nextManeuverTime_s(maneuvers, shownT_s);
            if (target !== null) {
              state.setTime_s(target);
            }
          }}
        >
          Next maneuver
        </button>
        <button
          type="button"
          data-testid="playback-end"
          disabled={!enabled}
          onClick={() => {
            state.setTime_s(end_s);
            state.setPlaying(false);
          }}
        >
          Jump to end
        </button>
        <label className="flex items-center gap-2">
          Rate
          <select
            data-testid="playback-rate"
            value={rate}
            onChange={(e) => {
              state.setRate(Number(e.target.value));
            }}
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r} s/s
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2">
        <span>Time</span>
        <input
          type="range"
          className="flex-1"
          data-testid="playback-slider"
          aria-label="Playback time, seconds since epoch"
          aria-valuetext={`${formatInputNumber(shownT_s)} s`}
          min={start_s}
          max={end_s}
          step={1}
          value={shownT_s}
          disabled={!enabled}
          onChange={(e) => {
            state.setTime_s(Number(e.target.value));
          }}
        />
      </label>
      <dl className="out mt-2">
        <dt>t since epoch</dt>
        <dd data-testid="playback-readout" data-t-s={String(shownT_s)}>
          {enabled ? `${formatInputNumber(shownT_s)} s` : 'no result'}
        </dd>
        <dt>UTC</dt>
        <dd data-testid="playback-utc">{utc ?? '-'}</dd>
        <dt>Shown</dt>
        <dd data-testid="playback-source">
          {at === null
            ? '-'
            : `${at.interpolated ? 'interpolated (display only)' : 'engine sample'}, segment ${String(at.segmentIndex)}`}
        </dd>
      </dl>
      <p className="note">Playback never starts a simulation.</p>
    </section>
  );
}
