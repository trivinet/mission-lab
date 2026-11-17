/**
 * VI-02 (ML-FR-007 AC2): every rendered vertex equals the engine sample scaled once,
 * Math.fround(sample * s), bit for bit (Object.is on each component), segment by segment.
 *
 * The expected value is written out here in the test (Math.fround(x * s)) from the engine's own
 * result samples; the code under test is buildSceneGeometry and buildSceneHookState, which the
 * renderer uses. The engine is the real one (buildSimulationRequest + runSimulation).
 */
import type { Scenario, SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest, runSimulation } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { ERA_REVOLUTIONS_PER_UT1_DAY, earthRotationAngle_rad } from './earth-orientation';
import {
  buildSceneGeometry,
  earthRadiusScene,
  locateSample,
  sampleVertex,
  totalSampleCount,
} from './scene-geometry';
import { buildSceneHookState } from './scene-hook';
import { SCENE_SCALE } from './scene-scale';

function runEngine(scenario: Scenario): SimulationResult {
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error(`scenario rejected: ${JSON.stringify(built.issues)}`);
  }
  const outcome = runSimulation(built.value);
  if (!outcome.ok) {
    throw new Error(`run rejected: ${JSON.stringify(outcome.issues)}`);
  }
  expect(outcome.value.status).toBe('ok');
  return outcome.value;
}

function withManeuver(t_s: number, deltaV_mps: [number, number, number]): Scenario {
  return {
    ...newScenario(),
    maneuvers: [{ id: 'burn-1', t_s, frame: 'RSW', deltaV_mps }],
  };
}

const CASES: readonly { readonly name: string; readonly scenario: () => Scenario }[] = [
  { name: 'default scenario (no maneuver, 101 samples)', scenario: () => newScenario() },
  {
    name: 'maneuver on the output grid (t = 3000 s, along-track)',
    scenario: () => withManeuver(3000, [0, 100, 0]),
  },
  {
    name: 'maneuver off the grid (t = 2500.25 s, radial and cross-track)',
    scenario: () => withManeuver(2500.25, [30, 0, 20]),
  },
];

describe.each(CASES)('VI-02: $name', ({ scenario }) => {
  const result = runEngine(scenario());

  it('every vertex component is Math.fround(sample * s), by Object.is', () => {
    const geometry = buildSceneGeometry(result, SCENE_SCALE);
    expect(geometry.scale).toBe(SCENE_SCALE);
    expect(geometry.segments).toHaveLength(result.segments.length);

    let compared = 0;
    for (const [n, segment] of result.segments.entries()) {
      const vertices = geometry.segments[n]?.vertices;
      expect(vertices).toBeInstanceOf(Float32Array);
      expect(vertices?.length).toBe(segment.position_m.length);
      for (const [i, sample] of segment.position_m.entries()) {
        const expected = Math.fround(sample * SCENE_SCALE);
        const actual = vertices?.[i];
        if (!Object.is(actual, expected)) {
          throw new Error(
            `segment ${String(n)} component ${String(i)}: ${String(actual)} != ${String(expected)}`,
          );
        }
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
    // Recorded as evidence in the task report.
    console.info(`VI-02 ${scenario().name}: ${String(compared)} components compared`);
  });

  it('the hook state exposes those same arrays, the scale and the source samples', () => {
    const geometry = buildSceneGeometry(result);
    const state = buildSceneHookState({
      resultKind: 'current',
      geometry,
      fallbackReferenceRadius_m: 0,
      fallbackEpochIso: '',
      scale: geometry.scale,
      axesVisible: false,
      markerFlatIndex: 0,
      camera: null,
    });
    expect(state.scale).toBe(SCENE_SCALE);
    expect(state.segments.map((s) => s.vertices)).toEqual(geometry.segments.map((s) => s.vertices));
    state.segments.forEach((s, n) => {
      expect(s.vertices).toBe(geometry.segments[n]?.vertices);
    });
    expect(state.sourcePosition_m?.map((a) => a)).toEqual(result.segments.map((s) => s.position_m));
    for (const [n, source] of (state.sourcePosition_m ?? []).entries()) {
      const vertices = state.segments[n]?.vertices;
      for (const [i, sample] of source.entries()) {
        expect(Object.is(vertices?.[i], Math.fround(sample * state.scale))).toBe(true);
      }
    }
  });

  it('never joins segments: one array per segment, separate buffers, no shared vertex array', () => {
    const geometry = buildSceneGeometry(result);
    expect(geometry.segments).toHaveLength(result.events.length + 1);
    const buffers = new Set(geometry.segments.map((s) => s.vertices.buffer));
    expect(buffers.size).toBe(geometry.segments.length);
    for (const [n, segment] of geometry.segments.entries()) {
      // Vertex count is exactly that segment's own samples (3 per sample): nothing was added.
      expect(segment.vertices.length).toBe(3 * (result.segments[n]?.t_s.length ?? -1));
      expect(segment.kind).toBe(n === 0 ? 'coast' : 'maneuvered');
    }
    expect(totalSampleCount(geometry)).toBe(
      result.segments.reduce((total, s) => total + s.t_s.length, 0),
    );
  });

  it('maneuver markers are the scaled event positions and match the segment boundary vertex', () => {
    const geometry = buildSceneGeometry(result);
    expect(geometry.maneuverMarkers).toHaveLength(result.events.length);
    for (const [k, event] of result.events.entries()) {
      const marker = geometry.maneuverMarkers[k];
      expect(marker?.maneuverId).toBe(event.maneuverId);
      for (const axis of [0, 1, 2] as const) {
        expect(
          Object.is(marker?.position[axis], Math.fround(event.position_m[axis] * SCENE_SCALE)),
        ).toBe(true);
      }
      // First vertex of the following segment is the same engine sample (contracts-v1 R8).
      const after = geometry.segments[k + 1]?.vertices;
      expect(Array.from(marker?.position ?? [])).toEqual(Array.from(after?.subarray(0, 3) ?? []));
    }
  });
});

describe('Earth radius and sample location', () => {
  const result = runEngine(newScenario());

  it('the Earth radius is the result reference radius times s, with no other factor', () => {
    const geometry = buildSceneGeometry(result);
    expect(geometry.referenceRadius_m).toBe(result.model.constants.referenceRadius_m);
    expect(earthRadiusScene(geometry.referenceRadius_m)).toBe(
      result.model.constants.referenceRadius_m * SCENE_SCALE,
    );
  });

  it('locates flat sample indices and reads the vertex unchanged', () => {
    const scenario = withManeuver(3000, [0, 100, 0]);
    const geometry = buildSceneGeometry(runEngine(scenario));
    const second = geometry.segments[1];
    expect(second).toBeDefined();
    const first = geometry.segments[0]?.t_s.length ?? 0;
    expect(locateSample(geometry, 0)).toEqual({ segmentIndex: 0, sampleIndex: 0 });
    expect(locateSample(geometry, first)).toEqual({ segmentIndex: 1, sampleIndex: 0 });
    expect(locateSample(geometry, totalSampleCount(geometry))).toBeNull();
    const vertex = sampleVertex(geometry, { segmentIndex: 1, sampleIndex: 2 });
    expect(Array.from(vertex ?? [])).toEqual(Array.from(second?.vertices.subarray(6, 9) ?? []));
    expect(sampleVertex(geometry, { segmentIndex: 9, sampleIndex: 0 })).toBeNull();
  });
});

describe('Earth orientation (illustrative, ADR-004)', () => {
  it('at J2000.0 the angle is 2 pi times the ADR-004 constant', () => {
    // Pinned to the constant as written in ADR-004; this restates the formula, it is not an
    // independent check of the IERS value (not verified, see the task report).
    expect(earthRotationAngle_rad('2000-01-01T12:00:00.000Z', 0)).toBe(
      2 * Math.PI * 0.779057273264,
    );
  });

  it('one day later the angle advances by 2 pi times the ADR-004 rate', () => {
    const a = earthRotationAngle_rad('2000-01-01T12:00:00.000Z', 0);
    const b = earthRotationAngle_rad('2000-01-01T12:00:00.000Z', 86_400);
    expect(b - a).toBeCloseTo(2 * Math.PI * ERA_REVOLUTIONS_PER_UT1_DAY, 12);
    expect(earthRotationAngle_rad('2000-01-02T12:00:00.000Z', 0)).toBeCloseTo(b, 12);
  });
});
