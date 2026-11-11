import { describe, expect, it } from 'vitest';
import type { ValidationCode } from './codes';
import type { Scenario } from './scenario';
import { validScenario } from './test-fixtures';
import { validateScenario } from './validate';

/** A scenario-shaped object that tests may corrupt freely. */
type Mutable = Record<string, unknown> & Scenario;

function issuesOf(input: unknown): { code: ValidationCode; path: string }[] {
  const result = validateScenario(input);
  if (result.ok) {
    return [];
  }
  return result.issues.map((issue) => ({ code: issue.code, path: issue.path.join('.') }));
}

function mutated(change: (scenario: Mutable) => void): Mutable {
  const scenario = validScenario() as Mutable;
  change(scenario);
  return scenario;
}

describe('Scenario v1.0', () => {
  it('accepts the valid fixture', () => {
    expect(validateScenario(validScenario())).toEqual({ ok: true, value: validScenario() });
  });

  it('round-trips through JSON text unchanged', () => {
    const text = JSON.stringify(validScenario());
    const loaded = validateScenario(JSON.parse(text));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value).toEqual(validScenario());
      expect(JSON.stringify(loaded.value)).toBe(text);
    }
  });

  it('accepts zero maneuvers', () => {
    expect(validateScenario(mutated((s) => (s.maneuvers = []))).ok).toBe(true);
  });

  it('accepts the closed boundaries of the structural ranges', () => {
    const scenario = mutated((s) => {
      s.initialOrbit.elements.eccentricity = 0;
      s.initialOrbit.elements.inclination_rad = Math.PI;
      s.initialOrbit.elements.raan_rad = 0;
      s.maneuvers = [{ id: 'm1', t_s: s.duration_s, frame: 'RSW', deltaV_mps: [0, 0, 0] }];
    });
    expect(validateScenario(scenario).ok).toBe(true);
    const atZero = mutated((s) => {
      s.maneuvers = [{ id: 'm1', t_s: 0, frame: 'RSW', deltaV_mps: [0, 0, 0] }];
    });
    expect(validateScenario(atZero).ok).toBe(true);
  });

  describe('schema version', () => {
    it.each([['2.0'], ['1'], [1], [null]])('rejects schemaVersion %j', (version) => {
      const input = mutated((s) => (s.schemaVersion = version as '1.0'));
      expect(issuesOf(input)).toEqual([
        { code: 'SCHEMA_VERSION_UNSUPPORTED', path: 'schemaVersion' },
      ]);
    });

    it('rejects a missing schemaVersion', () => {
      const input: Partial<Mutable> = validScenario();
      delete input.schemaVersion;
      expect(issuesOf(input)).toEqual([
        { code: 'SCHEMA_VERSION_UNSUPPORTED', path: 'schemaVersion' },
      ]);
    });
  });

  const ruleCases: [string, (s: Mutable) => void, ValidationCode, string][] = [
    [
      'semi-major axis 0',
      (s) => (s.initialOrbit.elements.semiMajorAxis_m = 0),
      'SEMI_MAJOR_AXIS_NOT_POSITIVE',
      'initialOrbit.elements.semiMajorAxis_m',
    ],
    [
      'semi-major axis < 0',
      (s) => (s.initialOrbit.elements.semiMajorAxis_m = -1),
      'SEMI_MAJOR_AXIS_NOT_POSITIVE',
      'initialOrbit.elements.semiMajorAxis_m',
    ],
    [
      'eccentricity < 0',
      (s) => (s.initialOrbit.elements.eccentricity = -0.01),
      'ECCENTRICITY_OUT_OF_RANGE',
      'initialOrbit.elements.eccentricity',
    ],
    [
      'eccentricity = 1',
      (s) => (s.initialOrbit.elements.eccentricity = 1),
      'ECCENTRICITY_OUT_OF_RANGE',
      'initialOrbit.elements.eccentricity',
    ],
    [
      'inclination < 0',
      (s) => (s.initialOrbit.elements.inclination_rad = -0.1),
      'INCLINATION_OUT_OF_RANGE',
      'initialOrbit.elements.inclination_rad',
    ],
    [
      'inclination > π',
      (s) => (s.initialOrbit.elements.inclination_rad = 3.2),
      'INCLINATION_OUT_OF_RANGE',
      'initialOrbit.elements.inclination_rad',
    ],
    [
      'RAAN = 2π',
      (s) => (s.initialOrbit.elements.raan_rad = 2 * Math.PI),
      'ANGLE_OUT_OF_RANGE',
      'initialOrbit.elements.raan_rad',
    ],
    [
      'arg. periapsis < 0',
      (s) => (s.initialOrbit.elements.argPeriapsis_rad = -1),
      'ANGLE_OUT_OF_RANGE',
      'initialOrbit.elements.argPeriapsis_rad',
    ],
    [
      'true anomaly > 2π',
      (s) => (s.initialOrbit.elements.trueAnomaly_rad = 7),
      'ANGLE_OUT_OF_RANGE',
      'initialOrbit.elements.trueAnomaly_rad',
    ],
    [
      'duration 0',
      (s) => {
        s.duration_s = 0;
        s.maneuvers = [];
      },
      'DURATION_NOT_POSITIVE',
      'duration_s',
    ],
    ['output step < 0', (s) => (s.outputStep_s = -1), 'OUTPUT_STEP_NOT_POSITIVE', 'outputStep_s'],
    [
      'maneuver time < 0',
      (s) => {
        s.maneuvers[0] = { id: 'm1', t_s: -1, frame: 'RSW', deltaV_mps: [0, 0, 0] };
      },
      'MANEUVER_TIME_OUT_OF_RANGE',
      'maneuvers.0.t_s',
    ],
    [
      'maneuver time > duration',
      (s) => {
        s.maneuvers[0] = { id: 'm1', t_s: 1000.5, frame: 'RSW', deltaV_mps: [0, 0, 0] };
      },
      'MANEUVER_TIME_OUT_OF_RANGE',
      'maneuvers.0.t_s',
    ],
    [
      'two maneuvers',
      (s) => s.maneuvers.push({ id: 'm2', t_s: 200, frame: 'RSW', deltaV_mps: [0, 0, 0] }),
      'MANEUVER_COUNT_EXCEEDED',
      'maneuvers',
    ],
    ['empty scenario id', (s) => (s.id = ''), 'ID_EMPTY', 'id'],
    [
      'empty maneuver id',
      (s) => {
        s.maneuvers[0] = { id: '', t_s: 1, frame: 'RSW', deltaV_mps: [0, 0, 0] };
      },
      'ID_EMPTY',
      'maneuvers.0.id',
    ],
    [
      'epoch without milliseconds',
      (s) => (s.epoch = { scale: 'UTC', iso: '2030-01-02T03:04:05Z' }),
      'EPOCH_INVALID',
      'epoch.iso',
    ],
    [
      'epoch with offset',
      (s) => (s.epoch = { scale: 'UTC', iso: '2030-01-02T03:04:05.678+01:00' }),
      'EPOCH_INVALID',
      'epoch.iso',
    ],
    [
      'epoch on 30 February',
      (s) => (s.epoch = { scale: 'UTC', iso: '2030-02-30T00:00:00.000Z' }),
      'EPOCH_INVALID',
      'epoch.iso',
    ],
    [
      'epoch at second 60',
      (s) => (s.epoch = { scale: 'UTC', iso: '2030-12-31T23:59:60.000Z' }),
      'EPOCH_INVALID',
      'epoch.iso',
    ],
    [
      'epoch scale TAI',
      (s) => ((s.epoch as Record<string, unknown>).scale = 'TAI'),
      'UNSUPPORTED_VALUE',
      'epoch.scale',
    ],
    [
      'central body other than EARTH',
      (s) => ((s as Record<string, unknown>).centralBody = 'MARS'),
      'UNSUPPORTED_VALUE',
      'centralBody',
    ],
    [
      'frame other than GCRF',
      (s) => ((s as Record<string, unknown>).frame = 'TEME'),
      'UNSUPPORTED_VALUE',
      'frame',
    ],
    [
      'orbit kind other than KEPLERIAN',
      (s) => ((s.initialOrbit as Record<string, unknown>).kind = 'CARTESIAN'),
      'UNSUPPORTED_VALUE',
      'initialOrbit.kind',
    ],
    [
      'maneuver frame other than RSW',
      (s) => ((s.maneuvers[0] as Record<string, unknown>).frame = 'GCRF'),
      'UNSUPPORTED_VALUE',
      'maneuvers.0.frame',
    ],
    ['unknown top-level field', (s) => (s.duration_S = 5), 'UNKNOWN_FIELD', 'duration_S'],
    [
      'unknown nested field',
      (s) => ((s.initialOrbit.elements as Record<string, unknown>).meanAnomaly_rad = 1),
      'UNKNOWN_FIELD',
      'initialOrbit.elements.meanAnomaly_rad',
    ],
    [
      'number as string',
      (s) => ((s as Record<string, unknown>).duration_s = '1000'),
      'TYPE_MISMATCH',
      'duration_s',
    ],
    [
      'missing field',
      (s) => delete (s as Partial<Scenario>).outputStep_s,
      'TYPE_MISMATCH',
      'outputStep_s',
    ],
    [
      'Δv with two components',
      (s) => ((s.maneuvers[0] as Record<string, unknown>).deltaV_mps = [1, 2]),
      'TYPE_MISMATCH',
      'maneuvers.0.deltaV_mps',
    ],
    [
      'Δv with four components',
      (s) => ((s.maneuvers[0] as Record<string, unknown>).deltaV_mps = [1, 2, 3, 4]),
      'TYPE_MISMATCH',
      'maneuvers.0.deltaV_mps',
    ],
  ];

  it.each(ruleCases)('rejects %s', (_label, change, code, path) => {
    expect(issuesOf(mutated(change))).toEqual([{ code, path }]);
  });

  it('rejects duplicate maneuver ids with ID_DUPLICATE (alongside the M1 count limit)', () => {
    const input = mutated((s) =>
      s.maneuvers.push({ id: 'm1', t_s: 200, frame: 'RSW', deltaV_mps: [0, 0, 0] }),
    );
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        { code: 'MANEUVER_COUNT_EXCEEDED', path: 'maneuvers' },
        { code: 'ID_DUPLICATE', path: 'maneuvers.1.id' },
      ]),
    );
  });

  describe('non-finite numbers', () => {
    const fields: [string, (s: Mutable, v: number) => void, string][] = [
      [
        'semiMajorAxis_m',
        (s, v) => (s.initialOrbit.elements.semiMajorAxis_m = v),
        'initialOrbit.elements.semiMajorAxis_m',
      ],
      [
        'eccentricity',
        (s, v) => (s.initialOrbit.elements.eccentricity = v),
        'initialOrbit.elements.eccentricity',
      ],
      [
        'trueAnomaly_rad',
        (s, v) => (s.initialOrbit.elements.trueAnomaly_rad = v),
        'initialOrbit.elements.trueAnomaly_rad',
      ],
      ['duration_s', (s, v) => (s.duration_s = v), 'duration_s'],
      ['outputStep_s', (s, v) => (s.outputStep_s = v), 'outputStep_s'],
      [
        'maneuver t_s',
        (s, v) => {
          s.maneuvers[0] = { id: 'm1', t_s: v, frame: 'RSW', deltaV_mps: [0, 0, 0] };
        },
        'maneuvers.0.t_s',
      ],
      [
        'Δv component',
        (s, v) => {
          s.maneuvers[0] = { id: 'm1', t_s: 1, frame: 'RSW', deltaV_mps: [0, v, 0] };
        },
        'maneuvers.0.deltaV_mps.1',
      ],
    ];
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const [label, set, path] of fields) {
      it.each(values)(`rejects ${label} = %s with NON_FINITE_NUMBER`, (value) => {
        expect(
          issuesOf(
            mutated((s) => {
              set(s, value);
            }),
          ),
        ).toEqual([{ code: 'NON_FINITE_NUMBER', path }]);
      });
    }
  });

  it.each([[null], [[]], ['scenario'], [42]])(
    'rejects non-object input %j without throwing',
    (input) => {
      const result = validateScenario(input);
      expect(result.ok).toBe(false);
    },
  );

  it('reports every independent violation, not only the first', () => {
    const input = mutated((s) => {
      s.duration_s = 0;
      s.outputStep_s = 0;
    });
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        { code: 'DURATION_NOT_POSITIVE', path: 'duration_s' },
        { code: 'OUTPUT_STEP_NOT_POSITIVE', path: 'outputStep_s' },
      ]),
    );
  });
});
