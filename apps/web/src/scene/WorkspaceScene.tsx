/**
 * The 3D simulation view (ML-FR-007): Earth, trajectory, spacecraft marker, maneuver markers,
 * camera controls and display options, plus a text summary so no information lives in the 3D
 * view alone. It reads the scenario store and renders what the result holds; it never starts a
 * run and computes no physics (see scene-scale.ts, scene-geometry.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { getScenarioStore } from '../state/scenario-store';
import { SceneCanvas } from './SceneCanvas';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import type { CameraSnapshot } from './SceneCanvas';
import { EARTH_ORIENTATION_LABEL } from './earth-orientation';
import { getPlaybackStore } from '../playback/playback-store';
import { buildSceneGeometry } from './scene-geometry';
import { buildSceneHookState, sceneHookRequested } from './scene-hook';
import { markerAt } from './scene-marker';
import { getSceneOptionsStore } from './scene-options';
import { SCENE_SCALE } from './scene-scale';
import { engineReferenceRadius_m, resultToShow } from './scene-source';
import { SCENE_COLORS } from './scene-style';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

const STATE_NOTE = {
  none: 'No result yet: Earth only.',
  computing: 'Computing: Earth only until the run finishes.',
  current: 'Result is current.',
  stale: 'Inputs changed since this result: the trajectory shown is stale.',
  error: 'The last run failed: Earth only.',
} as const;

const BUTTON =
  'min-h-7 rounded border border-[#5f7289] bg-[#1c242e] px-3 text-[13px] text-[#e6edf3] hover:bg-[#242f3b]';

export function WorkspaceScene() {
  const scenarioStore = getScenarioStore();
  const optionsStore = getSceneOptionsStore();
  const resultState = useStore(scenarioStore, (s) => s.resultState);
  const epochIso = useStore(scenarioStore, (s) => s.scenario.epoch.iso);
  const axesVisible = useStore(optionsStore, (s) => s.axesVisible);
  // The one playback time (ML-FR-008 AC2): the marker is computed from it, nothing else.
  const playbackT_s = useStore(getPlaybackStore(), (s) => s.t_s);
  const [resetNonce, setResetNonce] = useState(0);
  const [webgl] = useState(webglAvailable);
  const cameraRef = useRef<(() => CameraSnapshot) | null>(null);

  const result = resultToShow(resultState);
  const geometry = useMemo(() => (result === null ? null : buildSceneGeometry(result)), [result]);
  const stale = resultState.kind === 'stale' && geometry !== null;
  const markerState = useMemo(
    () => (result === null ? null : markerAt(result, playbackT_s)),
    [result, playbackT_s],
  );

  const hookState = buildSceneHookState({
    resultKind: resultState.kind,
    geometry,
    fallbackReferenceRadius_m: engineReferenceRadius_m(),
    fallbackEpochIso: epochIso,
    scale: SCENE_SCALE,
    axesVisible,
    marker: markerState,
    camera: null,
  });

  // The test hook (VI-02): only with ?sceneHook=1. It reads the latest render's state on demand.
  const latest = useRef(hookState);
  latest.current = hookState;
  useEffect(() => {
    if (!sceneHookRequested(window.location.search)) {
      return;
    }
    window.__missionLabScene = {
      get: () => ({ ...latest.current, camera: cameraRef.current?.() ?? null }),
    };
    return () => {
      delete window.__missionLabScene;
    };
  }, []);

  const marker = hookState.spacecraftMarker;
  const viewLabel =
    'Orbit view, inertial GCRF axes, +Z up. Arrow keys orbit, plus and minus zoom, Home resets the camera.';

  return (
    <section
      aria-label="3D view"
      data-testid="workspace-scene"
      data-result-kind={resultState.kind}
      className="flex flex-col gap-2 text-[13px] text-[#e6edf3]"
    >
      <div
        className="relative h-[420px] overflow-hidden rounded-lg border border-[#2f3b4a] [&_canvas:focus-visible]:outline-2 [&_canvas:focus-visible]:-outline-offset-2 [&_canvas:focus-visible]:outline-[#9cc4ff]"
        style={{ background: SCENE_COLORS.background }}
      >
        {webgl ? (
          <SceneErrorBoundary>
            <SceneCanvas
              geometry={geometry}
              stale={stale}
              earthRadius_scene={hookState.earthRadius_scene}
              earthRotationZ_rad={hookState.earth.rotationZ_rad ?? 0}
              axesVisible={axesVisible}
              spacecraftPosition={marker?.position ?? null}
              resetNonce={resetNonce}
              cameraRef={cameraRef}
              label={viewLabel}
            />
          </SceneErrorBoundary>
        ) : (
          <p role="alert" className="p-4 text-[#e0ad3c]" data-testid="scene-no-webgl">
            The 3D view needs WebGL, which is not available here. The summary below still shows the
            result.
          </p>
        )}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
          <span
            data-testid="earth-orientation-label"
            className="rounded bg-[#151b23]/90 px-2 py-0.5 text-[11px] text-[#a8b3c0]"
          >
            {EARTH_ORIENTATION_LABEL}
          </span>
          {stale && (
            <span
              data-testid="scene-stale-chip"
              className="rounded bg-[#1c242e] px-2 py-0.5 text-[12px] text-[#e0ad3c]"
            >
              {'◆'} Stale: previous result
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="camera-reset"
          className={BUTTON}
          onClick={() => {
            setResetNonce((n) => n + 1);
          }}
        >
          Reset camera
        </button>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="option-axes"
            checked={axesVisible}
            onChange={(e) => {
              optionsStore.getState().setAxesVisible(e.target.checked);
            }}
          />
          Inertial axes (GCRF: X red, Y green, Z blue)
        </label>
        <p className="text-[11px] text-[#8c99a8]">
          Display options and playback never start a simulation.
        </p>
      </div>

      <div data-testid="scene-summary" className="text-[#a8b3c0]">
        <p data-testid="scene-state-note">{STATE_NOTE[resultState.kind]}</p>
        <ul aria-label="Trajectory legend and segments" className="mt-1 space-y-0.5">
          <li>
            <span aria-hidden="true" style={{ color: SCENE_COLORS.coast }}>
              {'- - -'}
            </span>{' '}
            Coast (dashed grey): before any maneuver
          </li>
          <li>
            <span aria-hidden="true" style={{ color: SCENE_COLORS.maneuver }}>
              {'——'}
            </span>{' '}
            Maneuvered (solid teal): after a maneuver
          </li>
          <li>
            <span aria-hidden="true" style={{ color: SCENE_COLORS.maneuverMarker }}>
              {'■'}
            </span>{' '}
            Maneuver point (large amber square); spacecraft marker (small white square)
          </li>
          {geometry?.segments.map((segment) => (
            <li key={segment.index} data-testid={`segment-summary-${String(segment.index)}`}>
              Segment {segment.index} ({segment.kind}): {segment.t_s.length} samples, t ={' '}
              {String(segment.t_s[0])} to {String(segment.t_s[segment.t_s.length - 1])} s
            </li>
          ))}
          {geometry?.maneuverMarkers.map((m) => (
            <li key={m.maneuverId}>
              Maneuver {m.maneuverId} at t = {String(m.t_s)} s
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
