import { describe, expect, it } from 'vitest';
import type { ValidationCode } from './codes';
import type { ManeuverEvent, SimulationResult, TrajectorySegment } from './result';
import { validResult } from './test-fixtures';
import { validateSimulationResult } from './validate';

type Mutable = Record<string, unknown> & SimulationResult;

function issuesOf(input: unknown): { code: ValidationCode; path: string }[] {
  const result = validateSimulationResult(input);
  return result.ok
    ? []
    : result.issues.map((issue) => ({ code: issue.code, path: issue.path.join('.') }));
}

function mutated(change: (result: Mutable) => void): Mutable {
  const result = validResult() as Mutable;
  change(result);
  return result;
}

function segment(result: SimulationResult, n: number): TrajectorySegment {
  const found = result.segments[n];
  if (found === undefined) {
    throw new Error(`fixture has no segment ${String(n)}`);
  }
  return found;
}

function firstEvent(result: SimulationResult): ManeuverEvent {
  const found = result.events[0];
  if (found === undefined) {
    throw new Error('fixture has no event');
  }
  return found;
}

describe('SimulationResult v1.0', () => {
  it('accepts the valid fixture', () => {
    expect(validateSimulationResult(validResult()).ok).toBe(true);
  });

  it('accepts a coast result: one segment, no events', () => {
    const coast = mutated((r) => {
      r.events = [];
      r.segments = [segment(r, 0)];
    });
    expect(validateSimulationResult(coast).ok).toBe(true);
  });

  it('accepts a single-sample segment (maneuver at t_s = 0)', () => {
    const atZero = mutated((r) => {
      r.segments = [
        {
          index: 0,
          t_s: new Float64Array([0]),
          position_m: new Float64Array(3),
          velocity_mps: new Float64Array(3),
        },
        {
          index: 1,
          t_s: new Float64Array([0, 1000]),
          position_m: new Float64Array(6),
          velocity_mps: new Float64Array(6),
        },
      ];
      r.events = [{ ...firstEvent(r), t_s: 0 }];
    });
    expect(validateSimulationResult(atZero).ok).toBe(true);
  });

  it('accepts a failed result with an error diagnostic and no trajectory', () => {
    const failed = mutated((r) => {
      r.status = 'failed';
      r.segments = [];
      r.events = [];
      r.diagnostics = [
        { severity: 'error', code: 'PROPAGATOR_NOT_CONVERGED', message: 'x', t_s: 5 },
      ];
    });
    expect(validateSimulationResult(failed).ok).toBe(true);
  });

  const ruleCases: [string, (r: Mutable) => void, ValidationCode, string][] = [
    [
      'position_m length 3N - 1',
      (r) => (segment(r, 0).position_m = new Float64Array(8)),
      'TYPED_ARRAY_LENGTH_MISMATCH',
      'segments.0.position_m',
    ],
    [
      'velocity_mps length N',
      (r) => (segment(r, 1).velocity_mps = new Float64Array(2)),
      'TYPED_ARRAY_LENGTH_MISMATCH',
      'segments.1.velocity_mps',
    ],
    [
      't_s as Float32Array',
      (r) => ((segment(r, 0) as Record<string, unknown>).t_s = new Float32Array([0, 50, 100])),
      'TYPE_MISMATCH',
      'segments.0.t_s',
    ],
    [
      'position_m as plain array',
      (r) =>
        ((segment(r, 0) as Record<string, unknown>).position_m = Array.from(
          { length: 9 },
          () => 1,
        )),
      'TYPE_MISMATCH',
      'segments.0.position_m',
    ],
    [
      'NaN in position_m',
      (r) => (segment(r, 0).position_m[4] = Number.NaN),
      'NON_FINITE_NUMBER',
      'segments.0.position_m.4',
    ],
    [
      'Infinity in velocity_mps',
      (r) => (segment(r, 1).velocity_mps[0] = Number.POSITIVE_INFINITY),
      'NON_FINITE_NUMBER',
      'segments.1.velocity_mps.0',
    ],
    [
      'repeated t_s in a segment',
      (r) => (segment(r, 0).t_s[1] = 0),
      'SAMPLE_TIMES_NOT_INCREASING',
      'segments.0.t_s.1',
    ],
    [
      'segment index out of order',
      (r) => (segment(r, 1).index = 2),
      'SEGMENT_INDEX_MISMATCH',
      'segments.1.index',
    ],
    [
      'k events but k segments',
      (r) => (r.segments = [segment(r, 0)]),
      'SEGMENT_COUNT_MISMATCH',
      'segments',
    ],
    [
      'event time not at boundary',
      (r) => (r.events[0] = { ...firstEvent(r), t_s: 99 }),
      'SEGMENT_BOUNDARY_MISMATCH',
      'events.0.t_s',
    ],
    [
      'segments not sharing boundary time',
      (r) => (segment(r, 1).t_s[0] = 100.5),
      'SEGMENT_BOUNDARY_MISMATCH',
      'events.0.t_s',
    ],
    [
      'ok with error diagnostic',
      (r) => r.diagnostics.push({ severity: 'error', code: 'INTERNAL_ERROR', message: 'x' }),
      'RESULT_STATUS_INCONSISTENT',
      'status',
    ],
    [
      'failed without error diagnostic',
      (r) => {
        r.status = 'failed';
        r.segments = [];
        r.events = [];
      },
      'RESULT_STATUS_INCONSISTENT',
      'status',
    ],
    [
      'failed with segments',
      (r) => {
        r.status = 'failed';
        r.diagnostics = [{ severity: 'error', code: 'INTERNAL_ERROR', message: 'x' }];
      },
      'RESULT_STATUS_INCONSISTENT',
      'status',
    ],
    [
      'unregistered diagnostic code',
      (r) => ((r.diagnostics[0] as Record<string, unknown>).code = 'SOMETHING_ELSE'),
      'UNSUPPORTED_VALUE',
      'diagnostics.0.code',
    ],
    [
      'negative Δv magnitude',
      (r) => (r.events[0] = { ...firstEvent(r), deltaV_magnitude_mps: -1 }),
      'MAGNITUDE_NEGATIVE',
      'events.0.deltaV_magnitude_mps',
    ],
    [
      'engine version not semver',
      (r) => (r.model.engineVersion = '1.0'),
      'ENGINE_VERSION_INVALID',
      'model.engineVersion',
    ],
    [
      'propagator other than KEPLER_UNIVERSAL_VARIABLE',
      (r) => ((r.model as Record<string, unknown>).propagator = 'RK4'),
      'UNSUPPORTED_VALUE',
      'model.propagator',
    ],
    [
      'reference radius 0',
      (r) => (r.model.constants.referenceRadius_m = 0),
      'REFERENCE_RADIUS_NOT_POSITIVE',
      'model.constants.referenceRadius_m',
    ],
    [
      'sampling step 0',
      (r) => (r.model.sampling.outputStep_s = 0),
      'OUTPUT_STEP_NOT_POSITIVE',
      'model.sampling.outputStep_s',
    ],
    ['malformed requestId', (r) => (r.requestId = 'abc'), 'REQUEST_ID_INVALID', 'requestId'],
  ];

  it.each(ruleCases)('rejects %s', (_label, change, code, path) => {
    expect(issuesOf(mutated(change))).toEqual([{ code, path }]);
  });

  it('rejects an empty segment with SEGMENT_EMPTY', () => {
    const input = mutated((r) => {
      r.events = [];
      r.segments = [
        {
          index: 0,
          t_s: new Float64Array(0),
          position_m: new Float64Array(0),
          velocity_mps: new Float64Array(0),
        },
      ];
    });
    expect(issuesOf(input)).toEqual([{ code: 'SEGMENT_EMPTY', path: 'segments.0.t_s' }]);
  });
});
