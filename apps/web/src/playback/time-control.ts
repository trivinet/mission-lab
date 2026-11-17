/**
 * Pure helpers of the timeline: the times the controls can jump to and the wall-clock advance.
 * No store, no browser API. All times are s from the scenario epoch, as the engine reports them.
 */
import type { InterpolationSegment } from './interpolate';

/** Selectable time rates: simulated seconds per real second. */
export const PLAYBACK_RATES = [1, 10, 60, 300, 1000] as const;
export const DEFAULT_RATE = 300;

/** The longest real-time step one frame may advance, s (a hidden tab must not jump). */
export const MAX_FRAME_S = 0.25;

/**
 * The maneuver times of a result: the first sample time of every segment after the first
 * (a segment boundary is exactly a maneuver, contracts-v1 section 5.2).
 */
export function maneuverTimes_s(segments: readonly InterpolationSegment[]): readonly number[] {
  return segments.slice(1).map((segment) => segment.t_s[0] ?? Number.NaN);
}

/** The next maneuver time after t_s, wrapping to the first; null when there is none. */
export function nextManeuverTime_s(times_s: readonly number[], t_s: number): number | null {
  const first = times_s[0];
  if (first === undefined) {
    return null;
  }
  return times_s.find((time) => time > t_s) ?? first;
}

export interface Advance {
  readonly t_s: number;
  /** True when the end of the result was reached by this step. */
  readonly ended: boolean;
}

/** Advances the playback time by a real-time step at a rate; stops exactly at the end. */
export function advanceTime(t_s: number, realStep_s: number, rate: number, end_s: number): Advance {
  const step = Math.min(Math.max(realStep_s, 0), MAX_FRAME_S);
  const next = t_s + step * rate;
  return next >= end_s ? { t_s: end_s, ended: true } : { t_s: next, ended: false };
}
