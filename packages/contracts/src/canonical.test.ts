import { describe, expect, it } from 'vitest';
import { canonicalRequestPayload } from './canonical';
import { validRequest } from './test-fixtures';

describe('canonicalRequestPayload (contracts-v1.md §7.2)', () => {
  it('produces the text derived by hand from the §7.2 rules for the fixture', () => {
    // Derived from the written definition, not from running the implementation: members sorted
    // by UTF-16 code units, requestId removed, no whitespace, shortest round-trip numbers.
    const expected =
      '{"centralBody":"EARTH","duration_s":1000,"dynamicsModel":"TWO_BODY",' +
      '"epoch":{"iso":"2030-01-02T03:04:05.678Z","scale":"UTC"},"frame":"GCRF",' +
      '"initialState":{"position_m":[1,2,3],"velocity_mps":[4,5,6]},' +
      '"maneuvers":[{"deltaV_mps":[1,2,3],"frame":"RSW","id":"m1","t_s":100}],' +
      '"mu_m3ps2":1,"outputStep_s":10,"schemaVersion":"1.0"}';
    expect(canonicalRequestPayload(validRequest())).toBe(expected);
  });

  it('does not depend on member insertion order', () => {
    const request = validRequest();
    const reordered = {
      outputStep_s: request.outputStep_s,
      maneuvers: request.maneuvers,
      initialState: {
        velocity_mps: request.initialState.velocity_mps,
        position_m: request.initialState.position_m,
      },
      epoch: { scale: request.epoch.scale, iso: request.epoch.iso },
      schemaVersion: request.schemaVersion,
      frame: request.frame,
      dynamicsModel: request.dynamicsModel,
      mu_m3ps2: request.mu_m3ps2,
      duration_s: request.duration_s,
      centralBody: request.centralBody,
      requestId: request.requestId,
    };
    expect(canonicalRequestPayload(reordered)).toBe(canonicalRequestPayload(request));
  });

  it('ignores requestId', () => {
    const other = { ...validRequest(), requestId: `sha256:${'f'.repeat(64)}` };
    expect(canonicalRequestPayload(other)).toBe(canonicalRequestPayload(validRequest()));
  });

  it('changes when any input changes, including the maneuver id', () => {
    const base = canonicalRequestPayload(validRequest());
    const variants = [
      { ...validRequest(), duration_s: 1001 },
      { ...validRequest(), mu_m3ps2: 2 },
      { ...validRequest(), maneuvers: [] },
      {
        ...validRequest(),
        maneuvers: [
          { id: 'other', t_s: 100, frame: 'RSW' as const, deltaV_mps: [1, 2, 3] as const },
        ],
      },
      { ...validRequest(), epoch: { scale: 'UTC' as const, iso: '2030-01-02T03:04:05.679Z' } },
    ];
    for (const variant of variants) {
      expect(canonicalRequestPayload(variant)).not.toBe(base);
    }
  });

  it('writes numbers in ECMAScript shortest round-trip form and -0 as 0', () => {
    const request = {
      ...validRequest(),
      initialState: {
        position_m: [0.1, -0, 1e21] as const,
        velocity_mps: [1e-7, 123.456, -5] as const,
      },
    };
    expect(canonicalRequestPayload(request)).toContain(
      '"initialState":{"position_m":[0.1,0,1e+21],"velocity_mps":[1e-7,123.456,-5]}',
    );
  });

  it('throws TypeError on a non-finite number (precondition violation)', () => {
    const request = { ...validRequest(), duration_s: Number.NaN };
    expect(() => canonicalRequestPayload(request)).toThrow(TypeError);
  });
});
