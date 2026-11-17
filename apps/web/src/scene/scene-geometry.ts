/**
 * Segment-to-geometry code: the engine result to the vertex arrays the renderer draws. Pure; it
 * imports neither three nor any browser API, so Vitest tests it without WebGL (VI-02).
 *
 * The only arithmetic on engine samples is toSceneCoordinate (Math.fround(x * s)). Segments are
 * never joined: each segment of the result becomes its own vertex array, so the maneuver
 * discontinuity (a velocity jump at a shared position, contracts-v1 section 5.2) is never drawn
 * as a connecting line.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import { SCENE_SCALE, toSceneCoordinate, toSceneVertices } from './scene-scale';

/** Segment 0 is the part before any maneuver (coast); later segments follow a maneuver. */
export type SegmentKind = 'coast' | 'maneuvered';

export interface SceneSegment {
  readonly index: number;
  readonly kind: SegmentKind;
  /** [x0, y0, z0, x1, ...] in scene units; each component is Math.fround(sample_m * s). */
  readonly vertices: Float32Array;
  /** Sample times of the segment, s from epoch, the result's own array (read-only here). */
  readonly t_s: Float64Array;
}

export interface SceneManeuverMarker {
  readonly maneuverId: string;
  readonly t_s: number;
  /** Three components in scene units, Math.fround(event.position_m[i] * s). */
  readonly position: Float32Array;
}

export interface SceneGeometry {
  readonly scale: number;
  /** The engine's reference radius, m (result.model.constants.referenceRadius_m). */
  readonly referenceRadius_m: number;
  readonly epochIso: string;
  /** Segments of the shown result. With a coast pair they are all 'maneuvered'. */
  readonly segments: readonly SceneSegment[];
  /**
   * The coast run drawn next to a maneuvered result (ML-FR-010 AC1): same scenario without the
   * maneuver, kind 'coast'. Empty when there is no coast pair.
   */
  readonly coastSegments: readonly SceneSegment[];
  readonly maneuverMarkers: readonly SceneManeuverMarker[];
  /** The result the geometry was built from (kept for the test hook's source arrays). */
  readonly source: SimulationResult;
  /** The coast result the coast segments were built from, or null. */
  readonly coastSource: SimulationResult | null;
}

/** Earth sphere radius in scene units: the engine's reference radius times the scene scale. */
export function earthRadiusScene(referenceRadius_m: number, s: number = SCENE_SCALE): number {
  return referenceRadius_m * s;
}

export function buildSceneGeometry(
  result: SimulationResult,
  s: number = SCENE_SCALE,
  coast?: SimulationResult,
): SceneGeometry {
  // Without a coast run, segment 0 (before any maneuver) is the coast part. With one, the whole
  // shown result is the maneuvered run and the coast run is drawn separately.
  const segments = result.segments.map((segment): SceneSegment => ({
    index: segment.index,
    kind: coast === undefined && segment.index === 0 ? 'coast' : 'maneuvered',
    vertices: toSceneVertices(segment.position_m, s),
    t_s: segment.t_s,
  }));
  const coastSegments = (coast?.segments ?? []).map((segment): SceneSegment => ({
    index: segment.index,
    kind: 'coast',
    vertices: toSceneVertices(segment.position_m, s),
    t_s: segment.t_s,
  }));
  const maneuverMarkers = result.events.map((event): SceneManeuverMarker => ({
    maneuverId: event.maneuverId,
    t_s: event.t_s,
    position: Float32Array.of(
      toSceneCoordinate(event.position_m[0], s),
      toSceneCoordinate(event.position_m[1], s),
      toSceneCoordinate(event.position_m[2], s),
    ),
  }));
  return {
    scale: s,
    referenceRadius_m: result.model.constants.referenceRadius_m,
    epochIso: result.model.epoch.iso,
    segments,
    coastSegments,
    maneuverMarkers,
    source: result,
    coastSource: coast ?? null,
  };
}

/** Number of samples over all segments (boundary samples count once per segment). */
export function totalSampleCount(geometry: SceneGeometry): number {
  return geometry.segments.reduce((total, segment) => total + segment.t_s.length, 0);
}

export interface SampleLocation {
  readonly segmentIndex: number;
  readonly sampleIndex: number;
}

/**
 * Maps a flat sample index (0 .. totalSampleCount - 1, segments in order) to a segment and a
 * sample in it. Index arithmetic only; the marker position is read from the vertex array.
 */
export function locateSample(geometry: SceneGeometry, flatIndex: number): SampleLocation | null {
  let remaining = flatIndex;
  for (const segment of geometry.segments) {
    if (remaining < segment.t_s.length) {
      return { segmentIndex: segment.index, sampleIndex: remaining };
    }
    remaining -= segment.t_s.length;
  }
  return null;
}

/** The three scene coordinates of one sample, copied from the vertex array unchanged. */
export function sampleVertex(
  geometry: SceneGeometry,
  location: SampleLocation,
): Float32Array | null {
  const segment = geometry.segments[location.segmentIndex];
  if (segment === undefined || location.sampleIndex >= segment.t_s.length) {
    return null;
  }
  return segment.vertices.slice(3 * location.sampleIndex, 3 * location.sampleIndex + 3);
}
