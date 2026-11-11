import { describe, expect, it } from 'vitest';
import type { ValidationCode } from './codes';
import type { SimulationRequest } from './request';
import { validRequest } from './test-fixtures';
import { validateSimulationRequest } from './validate';

type Mutable = Record<string, unknown> & SimulationRequest;

function issuesOf(input: unknown): { code: ValidationCode; path: string }[] {
  const result = validateSimulationRequest(input);
  return result.ok
    ? []
    : result.issues.map((issue) => ({ code: issue.code, path: issue.path.join('.') }));
}

function mutated(change: (request: Mutable) => void): Mutable {
  const request = validRequest() as Mutable;
  change(request);
  return request;
}

describe('SimulationRequest v1.0', () => {
  it('accepts the valid fixture', () => {
    expect(validateSimulationRequest(validRequest())).toEqual({ ok: true, value: validRequest() });
  });

  it('rejects an unknown schemaVersion', () => {
    expect(issuesOf(mutated((r) => (r.schemaVersion = '0.2' as '1.0')))).toEqual([
      { code: 'SCHEMA_VERSION_UNSUPPORTED', path: 'schemaVersion' },
    ]);
  });

  const ruleCases: [string, (r: Mutable) => void, ValidationCode, string][] = [
    [
      'requestId without prefix',
      (r) => (r.requestId = '0'.repeat(64)),
      'REQUEST_ID_INVALID',
      'requestId',
    ],
    [
      'requestId with uppercase hex',
      (r) => (r.requestId = `sha256:${'A'.repeat(64)}`),
      'REQUEST_ID_INVALID',
      'requestId',
    ],
    [
      'requestId too short',
      (r) => (r.requestId = `sha256:${'0'.repeat(63)}`),
      'REQUEST_ID_INVALID',
      'requestId',
    ],
    ['mu 0', (r) => (r.constants.mu_m3ps2 = 0), 'MU_NOT_POSITIVE', 'constants.mu_m3ps2'],
    ['mu -0', (r) => (r.constants.mu_m3ps2 = -0), 'MU_NOT_POSITIVE', 'constants.mu_m3ps2'],
    [
      'reference radius 0',
      (r) => (r.constants.referenceRadius_m = 0),
      'REFERENCE_RADIUS_NOT_POSITIVE',
      'constants.referenceRadius_m',
    ],
    [
      'constants source not a string',
      (r) => ((r.constants as Record<string, unknown>).source = 1),
      'TYPE_MISMATCH',
      'constants.source',
    ],
    [
      'constants missing',
      (r) => delete (r as Partial<SimulationRequest>).constants,
      'TYPE_MISMATCH',
      'constants',
    ],
    [
      'unknown field in constants',
      (r) => ((r.constants as Record<string, unknown>).j2 = 1),
      'UNKNOWN_FIELD',
      'constants.j2',
    ],
    [
      'top-level mu_m3ps2 (v0.2 shape, replaced by constants)',
      (r) => (r.mu_m3ps2 = 1),
      'UNKNOWN_FIELD',
      'mu_m3ps2',
    ],
    [
      'duration -0',
      (r) => {
        r.duration_s = -0;
        r.maneuvers = [];
      },
      'DURATION_NOT_POSITIVE',
      'duration_s',
    ],
    [
      'maneuver time < 0',
      (r) => {
        r.maneuvers[0] = { id: 'm1', t_s: -1, frame: 'RSW', deltaV_mps: [0, 0, 0] };
      },
      'MANEUVER_TIME_OUT_OF_RANGE',
      'maneuvers.0.t_s',
    ],
    [
      'empty maneuver id',
      (r) => {
        r.maneuvers[0] = { id: '', t_s: 1, frame: 'RSW', deltaV_mps: [0, 0, 0] };
      },
      'ID_EMPTY',
      'maneuvers.0.id',
    ],
    [
      'invalid epoch',
      (r) => (r.epoch = { scale: 'UTC', iso: '2030-02-30T00:00:00.000Z' }),
      'EPOCH_INVALID',
      'epoch.iso',
    ],
    [
      'central body other than EARTH',
      (r) => ((r as Record<string, unknown>).centralBody = 'MOON'),
      'UNSUPPORTED_VALUE',
      'centralBody',
    ],
    [
      'frame other than GCRF',
      (r) => ((r as Record<string, unknown>).frame = 'ITRF'),
      'UNSUPPORTED_VALUE',
      'frame',
    ],
    [
      'requestId not a string',
      (r) => ((r as Record<string, unknown>).requestId = 7),
      'TYPE_MISMATCH',
      'requestId',
    ],
    [
      'position Infinity',
      (r) =>
        (r.initialState = {
          position_m: [Number.POSITIVE_INFINITY, 0, 0],
          velocity_mps: [0, 0, 0],
        }),
      'NON_FINITE_NUMBER',
      'initialState.position_m.0',
    ],
    [
      'velocity with 2 components',
      (r) => ((r.initialState as Record<string, unknown>).velocity_mps = [1, 2]),
      'TYPE_MISMATCH',
      'initialState.velocity_mps',
    ],
    [
      'dynamics model other than TWO_BODY',
      (r) => ((r as Record<string, unknown>).dynamicsModel = 'J2'),
      'UNSUPPORTED_VALUE',
      'dynamicsModel',
    ],
    [
      'two maneuvers',
      (r) => r.maneuvers.push({ id: 'm2', t_s: 200, frame: 'RSW', deltaV_mps: [0, 0, 0] }),
      'MANEUVER_COUNT_EXCEEDED',
      'maneuvers',
    ],
    [
      'maneuver after duration',
      (r) => (r.duration_s = 50),
      'MANEUVER_TIME_OUT_OF_RANGE',
      'maneuvers.0.t_s',
    ],
    ['output step 0', (r) => (r.outputStep_s = 0), 'OUTPUT_STEP_NOT_POSITIVE', 'outputStep_s'],
    ['unknown field', (r) => (r.propagator = 'X'), 'UNKNOWN_FIELD', 'propagator'],
  ];

  it.each(ruleCases)('rejects %s', (_label, change, code, path) => {
    expect(issuesOf(mutated(change))).toEqual([{ code, path }]);
  });

  it('rejects a missing schemaVersion with that issue alone', () => {
    const input: Partial<Mutable> = validRequest();
    delete input.schemaVersion;
    input.duration_s = -1;
    expect(issuesOf(input)).toEqual([
      { code: 'SCHEMA_VERSION_UNSUPPORTED', path: 'schemaVersion' },
    ]);
  });

  it('reports duplicate maneuver ids together with the M1 count limit, and nothing else', () => {
    const input = mutated((r) =>
      r.maneuvers.push({ id: 'm1', t_s: 200, frame: 'RSW', deltaV_mps: [0, 0, 0] }),
    );
    expect(issuesOf(input)).toEqual([
      { code: 'MANEUVER_COUNT_EXCEEDED', path: 'maneuvers' },
      { code: 'ID_DUPLICATE', path: 'maneuvers.1.id' },
    ]);
  });

  it('accepts -0 in a vector and a maneuver at t_s = -0 (the canonical form distinguishes them)', () => {
    const input = mutated((r) => {
      r.initialState = { position_m: [-0, 2, 3], velocity_mps: [4, -0, 6] };
      r.maneuvers[0] = { id: 'm1', t_s: -0, frame: 'RSW', deltaV_mps: [-0, 0, 0] };
    });
    expect(issuesOf(input)).toEqual([]);
  });

  it('suppresses cross-field rules while the object has a type error', () => {
    // Maneuver at 100 s would be after a 50 s duration, but duration_s is not a number.
    const input = mutated((r) => ((r as Record<string, unknown>).duration_s = '50'));
    expect(issuesOf(input)).toEqual([{ code: 'TYPE_MISMATCH', path: 'duration_s' }]);
  });

  describe('non-finite numbers in every numeric location', () => {
    const locations: [string, (r: Mutable, v: number) => void][] = [
      ['constants.mu_m3ps2', (r, v) => (r.constants.mu_m3ps2 = v)],
      ['constants.referenceRadius_m', (r, v) => (r.constants.referenceRadius_m = v)],
      ['initialState.position_m.2', (r, v) => (r.initialState.position_m = [1, 2, v])],
      ['initialState.velocity_mps.1', (r, v) => (r.initialState.velocity_mps = [4, v, 6])],
      [
        'maneuvers.0.t_s',
        (r, v) => (r.maneuvers[0] = { id: 'm1', t_s: v, frame: 'RSW', deltaV_mps: [1, 2, 3] }),
      ],
      [
        'maneuvers.0.deltaV_mps.0',
        (r, v) => (r.maneuvers[0] = { id: 'm1', t_s: 1, frame: 'RSW', deltaV_mps: [v, 2, 3] }),
      ],
      ['duration_s', (r, v) => (r.duration_s = v)],
      ['outputStep_s', (r, v) => (r.outputStep_s = v)],
    ];
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const [path, set] of locations) {
      it.each(values)(`rejects ${path} = %s`, (value) => {
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
});
