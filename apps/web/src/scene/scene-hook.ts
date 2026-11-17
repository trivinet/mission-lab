/**
 * Scene-state test hook (VI-02, ML-FR-007 AC2). Lets a test read the exact Float32 vertex arrays
 * the renderer uploads, the scale used and the object positions, without screenshots.
 *
 * Enabled only when the page URL carries the query flag `?sceneHook=1` (any build, including the
 * production build the e2e tests run against). Without the flag `window.__missionLabScene` does
 * not exist. The hook is read-only: `get()` returns a snapshot built from the live scene.
 *
 * The vertex arrays in the snapshot are the very arrays given to the GPU buffers (not copies), so
 * a test of the snapshot is a test of what is drawn. `sourcePosition_m` holds the engine arrays
 * (read-only, by reference) so a browser test can recompute Math.fround(sample * scale).
 */
import type { ResultState } from '../state/result-state';
import { EARTH_ORIENTATION_LABEL, earthRotationAngle_rad } from './earth-orientation';
import { earthRadiusScene, locateSample, sampleVertex } from './scene-geometry';
import type { SceneGeometry, SegmentKind } from './scene-geometry';

export interface SceneHookSegment {
  readonly index: number;
  readonly kind: SegmentKind;
  readonly vertices: Float32Array;
}

export interface SceneHookState {
  readonly scale: number;
  readonly resultKind: ResultState['kind'];
  /** True when the trajectory shown is a previous result (state stale). */
  readonly stale: boolean;
  readonly referenceRadius_m: number;
  readonly earthRadius_scene: number;
  readonly earth: {
    readonly orientation: 'illustrative';
    readonly label: string;
    readonly rotationZ_rad: number;
  };
  readonly segments: readonly SceneHookSegment[];
  readonly maneuverMarkers: readonly {
    readonly maneuverId: string;
    readonly position: Float32Array;
  }[];
  readonly spacecraftMarker: {
    readonly segmentIndex: number;
    readonly sampleIndex: number;
    readonly t_s: number;
    readonly position: Float32Array;
  } | null;
  readonly axesVisible: boolean;
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  } | null;
  /** Engine position arrays (m), one per segment, by reference; null without a trajectory. */
  readonly sourcePosition_m: readonly Float64Array[] | null;
}

export interface SceneHookInput {
  readonly resultKind: ResultState['kind'];
  readonly geometry: SceneGeometry | null;
  /** Reference radius for the Earth when there is no geometry. */
  readonly fallbackReferenceRadius_m: number;
  readonly fallbackEpochIso: string;
  readonly scale: number;
  readonly axesVisible: boolean;
  readonly markerFlatIndex: number;
  readonly camera: SceneHookState['camera'];
}

export function buildSceneHookState(input: SceneHookInput): SceneHookState {
  const { geometry } = input;
  const referenceRadius_m = geometry?.referenceRadius_m ?? input.fallbackReferenceRadius_m;
  const location = geometry === null ? null : locateSample(geometry, input.markerFlatIndex);
  const markerPosition =
    geometry === null || location === null ? null : sampleVertex(geometry, location);
  const markerSegment =
    geometry === null || location === null ? undefined : geometry.segments[location.segmentIndex];
  const markerTime_s =
    markerSegment === undefined || location === null
      ? 0
      : (markerSegment.t_s[location.sampleIndex] ?? 0);
  return {
    scale: input.scale,
    resultKind: input.resultKind,
    stale: input.resultKind === 'stale' && geometry !== null,
    referenceRadius_m,
    earthRadius_scene: earthRadiusScene(referenceRadius_m, input.scale),
    earth: {
      orientation: 'illustrative',
      label: EARTH_ORIENTATION_LABEL,
      rotationZ_rad: earthRotationAngle_rad(
        geometry?.epochIso ?? input.fallbackEpochIso,
        markerTime_s,
      ),
    },
    segments:
      geometry?.segments.map((s) => ({ index: s.index, kind: s.kind, vertices: s.vertices })) ?? [],
    maneuverMarkers:
      geometry?.maneuverMarkers.map((m) => ({
        maneuverId: m.maneuverId,
        position: m.position,
      })) ?? [],
    spacecraftMarker:
      location === null || markerPosition === null
        ? null
        : {
            segmentIndex: location.segmentIndex,
            sampleIndex: location.sampleIndex,
            t_s: markerTime_s,
            position: markerPosition,
          },
    axesVisible: input.axesVisible,
    camera: input.camera,
    sourcePosition_m: geometry?.source.segments.map((s) => s.position_m) ?? null,
  };
}

export interface SceneTestHook {
  readonly get: () => SceneHookState;
}

declare global {
  interface Window {
    __missionLabScene?: SceneTestHook;
  }
}

/** True when the URL asks for the hook (`?sceneHook=1`). */
export function sceneHookRequested(search: string): boolean {
  return new URLSearchParams(search).get('sceneHook') === '1';
}
