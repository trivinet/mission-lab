/**
 * The spacecraft marker at a playback time (ML-FR-008). Pure: no three, no browser API.
 *
 * The position is the display position of playback/interpolate.ts (the engine sample at a sample
 * time, a display-only cubic Hermite value between samples), converted with the one scene-scale
 * conversion (toSceneCoordinate). At a sample time that is Math.fround(sample * s), identical to
 * the vertex of the trajectory (VI-02).
 */
import { displayPositionAt } from '../playback/interpolate';
import type { SimulationResult } from '@mission-lab/contracts';
import { SCENE_SCALE, toSceneCoordinate } from './scene-scale';

export interface SceneMarker {
  readonly segmentIndex: number;
  /** Engine sample index when t_s is a sample time of the segment, otherwise null. */
  readonly sampleIndex: number | null;
  /** True when the position is a display-only interpolation, false when it is an engine sample. */
  readonly interpolated: boolean;
  /** The playback time the marker was computed from (clamped to the result's span), s. */
  readonly t_s: number;
  /** Three components in scene units. */
  readonly position: Float32Array;
}

export function markerAt(
  result: SimulationResult,
  t_s: number,
  s: number = SCENE_SCALE,
): SceneMarker | null {
  const at = displayPositionAt(result.segments, t_s);
  if (at === null) {
    return null;
  }
  return {
    segmentIndex: at.segmentIndex,
    sampleIndex: at.sampleIndex,
    interpolated: at.interpolated,
    t_s: at.t_s,
    position: Float32Array.of(
      toSceneCoordinate(at.position_m[0], s),
      toSceneCoordinate(at.position_m[1], s),
      toSceneCoordinate(at.position_m[2], s),
    ),
  };
}
