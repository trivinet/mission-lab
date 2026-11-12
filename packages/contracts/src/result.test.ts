import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC_CODE_SEVERITY, DIAGNOSTIC_CODES } from './codes';
import type { DiagnosticSeverity, ValidationCode } from './codes';
import { diagnosticSchema } from './result';
import type { ManeuverEvent, SimulationResult, TrajectorySegment } from './result';
import { nextUp } from './test-doubles';
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

/** A segment owning its buffers, with every position component `p` and velocity component `v`. */
function seg(index: number, times: number[], p: number, v: number): TrajectorySegment {
  return {
    index,
    t_s: new Float64Array(times),
    position_m: new Float64Array(3 * times.length).fill(p),
    velocity_mps: new Float64Array(3 * times.length).fill(v),
  };
}

function firstEvent(result: SimulationResult): ManeuverEvent {
  const found = result.events[0];
  if (found === undefined) {
    throw new Error('fixture has no event');
  }
  return found;
}

describe('SimulationResult v1.0', () => {
  it('accepts the valid fixture and returns it with the same typed-array instances', () => {
    const input = validResult();
    const validated = validateSimulationResult(input);
    expect(validated).toEqual({ ok: true, value: input });
    if (validated.ok) {
      expect(segment(validated.value, 0).t_s).toBe(segment(input, 0).t_s);
    }
  });

  it('accepts a coast result: one segment from 0 to duration_s, no events', () => {
    const coast = mutated((r) => {
      r.events = [];
      r.segments = [seg(0, [0, 50, 1000], 1, 2)];
    });
    expect(issuesOf(coast)).toEqual([]);
  });

  it('accepts a single-sample segment (maneuver at t_s = 0)', () => {
    const atZero = mutated((r) => {
      r.segments = [seg(0, [0], 1, 2), seg(1, [0, 1000], 1, 3)];
      r.events = [{ ...firstEvent(r), t_s: 0 }];
    });
    expect(issuesOf(atZero)).toEqual([]);
  });

  it('accepts a single-sample last segment (maneuver at t_s = duration_s)', () => {
    const atEnd = mutated((r) => {
      r.segments = [seg(0, [0, 50, 1000], 1, 2), seg(1, [1000], 1, 3)];
      r.events = [{ ...firstEvent(r), t_s: 1000 }];
    });
    expect(issuesOf(atEnd)).toEqual([]);
  });

  it('accepts a zero-Δv maneuver: one event, two segments, equal velocities', () => {
    const zero = mutated((r) => {
      r.segments = [seg(0, [0, 50, 100], 1, 2), seg(1, [100, 1000], 1, 2)];
      r.events = [
        {
          ...firstEvent(r),
          velocityAfter_mps: [2, 2, 2],
          deltaV_inertial_mps: [0, 0, 0],
          deltaV_magnitude_mps: 0,
        },
      ];
    });
    expect(issuesOf(zero)).toEqual([]);
  });

  it('accepts a first sample time of -0 (R10 compares with === 0)', () => {
    const input = mutated((r) => (segment(r, 0).t_s[0] = -0));
    expect(issuesOf(input)).toEqual([]);
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

type Expected = { code: ValidationCode; path: string }[];
type Case = [string, (r: Mutable) => void, Expected];

describe('SimulationResult v1.0: maneuver boundary is bit-exact (R8, owner decision 5)', () => {
  const cases: Case[] = [
    [
      'last position of segment 0 differs from the event position',
      (r) => (segment(r, 0).position_m[6] = 2),
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.position_m' }],
    ],
    [
      'first position of segment 1 differs from the event position',
      (r) => (segment(r, 1).position_m[2] = 2),
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.position_m' }],
    ],
    [
      'boundary position +0 on the segments but -0 on the event',
      (r) => {
        segment(r, 0).position_m[6] = 0;
        segment(r, 1).position_m[0] = 0;
        r.events[0] = { ...firstEvent(r), position_m: [-0, 1, 1] };
      },
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.position_m' }],
    ],
    [
      'last velocity of segment 0 differs from velocityBefore',
      (r) => (segment(r, 0).velocity_mps[7] = 5),
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.velocityBefore_mps' }],
    ],
    [
      'first velocity of segment 1 differs from velocityAfter',
      (r) => (segment(r, 1).velocity_mps[0] = 5),
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.velocityAfter_mps' }],
    ],
    [
      'velocityAfter one ulp above velocityBefore + deltaV (segment consistent)',
      (r) => {
        const off = nextUp(3);
        segment(r, 1).velocity_mps[2] = off;
        r.events[0] = { ...firstEvent(r), velocityAfter_mps: [3, 3, off] };
      },
      [{ code: 'VELOCITY_INCREMENT_MISMATCH', path: 'events.0.velocityAfter_mps.2' }],
    ],
    [
      'velocityAfter +0 where (-0) + (-0) = -0',
      (r) => {
        segment(r, 0).velocity_mps[6] = -0;
        segment(r, 1).velocity_mps[0] = 0;
        r.events[0] = {
          ...firstEvent(r),
          velocityBefore_mps: [-0, 2, 2],
          deltaV_inertial_mps: [-0, 1, 1],
          velocityAfter_mps: [0, 3, 3],
        };
      },
      [{ code: 'VELOCITY_INCREMENT_MISMATCH', path: 'events.0.velocityAfter_mps.0' }],
    ],
  ];

  it.each(cases)('rejects %s', (_label, change, expected) => {
    expect(issuesOf(mutated(change))).toEqual(expected);
  });
});

describe('SimulationResult v1.0: time span (R10) and ordering (R6)', () => {
  const cases: Case[] = [
    [
      'first sample time not 0',
      (r) => (segment(r, 0).t_s[0] = 1),
      [{ code: 'SEGMENT_TIME_SPAN_MISMATCH', path: 'segments.0.t_s.0' }],
    ],
    [
      'last sample time not model.sampling.duration_s',
      (r) => (r.model.sampling.duration_s = 999),
      [{ code: 'SEGMENT_TIME_SPAN_MISMATCH', path: 'segments.1.t_s.1' }],
    ],
    [
      'last sample time one ulp above duration_s',
      (r) => (segment(r, 1).t_s[1] = nextUp(1000)),
      [{ code: 'SEGMENT_TIME_SPAN_MISMATCH', path: 'segments.1.t_s.1' }],
    ],
    [
      'event before 0 (also off the boundary)',
      (r) => (r.events[0] = { ...firstEvent(r), t_s: -5 }),
      [
        { code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.t_s' },
        { code: 'MANEUVER_TIME_OUT_OF_RANGE', path: 'events.0.t_s' },
      ],
    ],
    [
      'decreasing sample times',
      (r) => (segment(r, 0).t_s[1] = 120),
      [{ code: 'SAMPLE_TIMES_NOT_INCREASING', path: 'segments.0.t_s.2' }],
    ],
    [
      'boundary time one ulp apart between segments',
      (r) => (segment(r, 1).t_s[0] = nextUp(100)),
      [{ code: 'SEGMENT_BOUNDARY_MISMATCH', path: 'events.0.t_s' }],
    ],
  ];

  it.each(cases)('rejects %s', (_label, change, expected) => {
    expect(issuesOf(mutated(change))).toEqual(expected);
  });
});

describe('SimulationResult v1.0: status rules (R7, R9)', () => {
  const error = { severity: 'error' as const, code: 'INTERNAL_ERROR' as const, message: 'x' };
  const cases: Case[] = [
    [
      'failed with events but no segments',
      (r) => {
        r.status = 'failed';
        r.segments = [];
        r.diagnostics = [error];
      },
      [{ code: 'RESULT_STATUS_INCONSISTENT', path: 'status' }],
    ],
    [
      'failed with only a warning diagnostic',
      (r) => {
        r.status = 'failed';
        r.segments = [];
        r.events = [];
      },
      [{ code: 'RESULT_STATUS_INCONSISTENT', path: 'status' }],
    ],
    [
      'ok with an error diagnostic and a segment-count mismatch',
      (r) => {
        r.diagnostics = [error];
        r.segments = [segment(r, 0)];
      },
      [
        { code: 'RESULT_STATUS_INCONSISTENT', path: 'status' },
        { code: 'SEGMENT_COUNT_MISMATCH', path: 'segments' },
      ],
    ],
  ];

  it.each(cases)('rejects %s', (_label, change, expected) => {
    expect(issuesOf(mutated(change))).toEqual(expected);
  });

  it('accepts a failed result carrying SAMPLE_COUNT_EXCEEDED (engine backstop)', () => {
    const failed = mutated((r) => {
      r.status = 'failed';
      r.segments = [];
      r.events = [];
      r.diagnostics = [{ severity: 'error', code: 'SAMPLE_COUNT_EXCEEDED', message: 'x' }];
    });
    expect(issuesOf(failed)).toEqual([]);
  });
});

describe('SimulationResult v1.0: typed-array buffer ownership (owner decision 7)', () => {
  const cases: Case[] = [
    [
      'a view with a non-zero byteOffset',
      (r) => (segment(r, 0).t_s = new Float64Array([9, 0, 50, 100]).subarray(1)),
      [{ code: 'TYPED_ARRAY_BUFFER_NOT_OWNED', path: 'segments.0.t_s' }],
    ],
    [
      'a view shorter than its buffer',
      (r) => {
        const view = new Float64Array(new ArrayBuffer(64), 0, 3);
        view.set([0, 50, 100]);
        segment(r, 0).t_s = view;
      },
      [{ code: 'TYPED_ARRAY_BUFFER_NOT_OWNED', path: 'segments.0.t_s' }],
    ],
    [
      'a SharedArrayBuffer (not transferable)',
      (r) => {
        const view = new Float64Array(new SharedArrayBuffer(16));
        view.set([100, 1000]);
        (segment(r, 1) as Record<string, unknown>).t_s = view;
      },
      [{ code: 'TYPED_ARRAY_BUFFER_NOT_OWNED', path: 'segments.1.t_s' }],
    ],
    [
      'two arrays sharing one buffer',
      (r) => {
        const s1 = segment(r, 1);
        s1.velocity_mps = new Float64Array(s1.position_m.buffer);
        r.events[0] = {
          ...firstEvent(r),
          velocityAfter_mps: [1, 1, 1],
          deltaV_inertial_mps: [-1, -1, -1],
        };
      },
      [{ code: 'TYPED_ARRAY_BUFFER_NOT_OWNED', path: 'segments.1.velocity_mps' }],
    ],
  ];

  it.each(cases)('rejects %s', (_label, change, expected) => {
    expect(issuesOf(mutated(change))).toEqual(expected);
  });
});

describe('SimulationResult v1.0: diagnostic severities (§8)', () => {
  it.each(DIAGNOSTIC_CODES.map((code) => [code, DIAGNOSTIC_CODE_SEVERITY[code]] as const))(
    'accepts %s with severity %s',
    (code, severity) => {
      expect(diagnosticSchema.safeParse({ severity, code, message: 'x' }).success).toBe(true);
    },
  );

  it('maps the runtime and semantic codes to the severities of the §8.2/§8.3 tables', () => {
    const runtimeAndSemantic = [
      'PROPAGATOR_NOT_CONVERGED',
      'NON_FINITE_STATE',
      'ESCAPE_TRAJECTORY',
      'REFERENCE_SPHERE_INTERSECTION',
      'INTERNAL_ERROR',
      'PERIGEE_BELOW_REFERENCE_RADIUS',
      'SAMPLE_COUNT_EXCEEDED',
    ] as const;
    expect(runtimeAndSemantic.map((code) => DIAGNOSTIC_CODE_SEVERITY[code])).toEqual([
      'error',
      'error',
      'warning',
      'warning',
      'error',
      'error',
      'error',
    ]);
  });

  const wrong: [string, DiagnosticSeverity][] = [
    ['INTERNAL_ERROR', 'warning'],
    ['ESCAPE_TRAJECTORY', 'info'],
  ];
  it.each(wrong)('rejects %s with severity %s', (code, severity) => {
    const input = mutated((r) => {
      r.diagnostics = [{ severity, code: code as 'INTERNAL_ERROR', message: 'x' }];
    });
    expect(issuesOf(input)).toEqual([
      { code: 'DIAGNOSTIC_SEVERITY_MISMATCH', path: 'diagnostics.0.severity' },
    ]);
  });

  it('rejects a warning code raised to error in an ok result (severity and status)', () => {
    const input = mutated((r) => {
      r.diagnostics = [{ severity: 'error', code: 'ESCAPE_TRAJECTORY', message: 'x' }];
    });
    expect(issuesOf(input)).toEqual([
      { code: 'DIAGNOSTIC_SEVERITY_MISMATCH', path: 'diagnostics.0.severity' },
      { code: 'RESULT_STATUS_INCONSISTENT', path: 'status' },
    ]);
  });
});

describe('SimulationResult v1.0: engineVersion is Semantic Versioning 2.0.0', () => {
  it.each([['0.1.0'], ['10.20.30'], ['1.0.0-alpha.1'], ['1.0.0+build.5'], ['1.0.0-rc.1+exp.5']])(
    'accepts %s',
    (version) => {
      expect(issuesOf(mutated((r) => (r.model.engineVersion = version)))).toEqual([]);
    },
  );

  // Each rejection follows from semver.org 2.0.0 items 2 (no leading zeroes in X.Y.Z),
  // 9 (pre-release identifiers non-empty, numeric ones without leading zeroes) and 10 (build
  // identifiers non-empty).
  it.each([
    ['1.0'],
    ['01.0.0'],
    ['1.01.0'],
    ['1.0.0-01'],
    ['1.0.0-'],
    ['1.0.0+'],
    ['1.0.0-a..b'],
    ['v1.0.0'],
    ['1.0.0 '],
  ])('rejects %j', (version) => {
    expect(issuesOf(mutated((r) => (r.model.engineVersion = version)))).toEqual([
      { code: 'ENGINE_VERSION_INVALID', path: 'model.engineVersion' },
    ]);
  });
});

describe('SimulationResult v1.0: non-finite values in every numeric location', () => {
  const locations: [string, (r: Mutable, v: number) => void][] = [
    ['model.sampling.duration_s', (r, v) => (r.model.sampling.duration_s = v)],
    ['model.sampling.outputStep_s', (r, v) => (r.model.sampling.outputStep_s = v)],
    ['model.constants.mu_m3ps2', (r, v) => (r.model.constants.mu_m3ps2 = v)],
    ['model.constants.referenceRadius_m', (r, v) => (r.model.constants.referenceRadius_m = v)],
    ['segments.1.index', (r, v) => (segment(r, 1).index = v)],
    ['segments.0.t_s.1', (r, v) => (segment(r, 0).t_s[1] = v)],
    ['segments.0.t_s.2', (r, v) => (segment(r, 0).t_s[2] = v)],
    ['segments.1.position_m.0', (r, v) => (segment(r, 1).position_m[0] = v)],
    ['segments.0.velocity_mps.8', (r, v) => (segment(r, 0).velocity_mps[8] = v)],
    ['events.0.t_s', (r, v) => (r.events[0] = { ...firstEvent(r), t_s: v })],
    [
      'events.0.position_m.0',
      (r, v) => (r.events[0] = { ...firstEvent(r), position_m: [v, 1, 1] }),
    ],
    [
      'events.0.velocityBefore_mps.1',
      (r, v) => (r.events[0] = { ...firstEvent(r), velocityBefore_mps: [2, v, 2] }),
    ],
    [
      'events.0.velocityAfter_mps.2',
      (r, v) => (r.events[0] = { ...firstEvent(r), velocityAfter_mps: [3, 3, v] }),
    ],
    [
      'events.0.deltaV_inertial_mps.0',
      (r, v) => (r.events[0] = { ...firstEvent(r), deltaV_inertial_mps: [v, 1, 1] }),
    ],
    [
      'events.0.deltaV_magnitude_mps',
      (r, v) => (r.events[0] = { ...firstEvent(r), deltaV_magnitude_mps: v }),
    ],
    [
      'diagnostics.0.t_s',
      (r, v) =>
        (r.diagnostics[0] = {
          severity: 'warning',
          code: 'ESCAPE_TRAJECTORY',
          message: 'x',
          t_s: v,
        }),
    ],
  ];
  const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const [path, set] of locations) {
    it.each(values)(`rejects ${path} = %s with that issue alone`, (value) => {
      expect(
        issuesOf(
          mutated((r) => {
            set(r, value);
          }),
        ),
      ).toEqual([{ code: 'NON_FINITE_NUMBER', path }]);
    });
  }
});

describe('SimulationResult v1.0: cross-field rules under a type error', () => {
  it('reports only the type error when an event field has the wrong type', () => {
    // Without suppression the boundary rule would also fire (event t_s is not the number 100).
    const input = mutated((r) => ((firstEvent(r) as Record<string, unknown>).t_s = '100'));
    expect(issuesOf(input)).toEqual([{ code: 'TYPE_MISMATCH', path: 'events.0.t_s' }]);
  });
});
