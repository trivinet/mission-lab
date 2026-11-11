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
    ['mu 0', (r) => (r.mu_m3ps2 = 0), 'MU_NOT_POSITIVE', 'mu_m3ps2'],
    ['mu NaN', (r) => (r.mu_m3ps2 = Number.NaN), 'NON_FINITE_NUMBER', 'mu_m3ps2'],
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
});
