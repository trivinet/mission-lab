import { describe, expect, it } from 'vitest';
import { binary64Hex, canonicalRequestPayload } from './canonical';
import { validRequest } from './test-fixtures';

/**
 * Bit patterns derived by hand from the IEEE-754 binary64 layout, not from running the code:
 * 1 sign bit, 11 exponent bits with bias 1023, 52 fraction bits; value = (-1)^s × 1.f × 2^(e-1023)
 * for normal numbers, (-1)^s × 0.f × 2^-1022 for e = 0. The first three hex digits are sign and
 * exponent; the following ones are the fraction.
 */
const INDEPENDENT_VECTORS: [string, number, string][] = [
  ['+0: all bits zero', 0, '0000000000000000'],
  ['-0: sign bit only', -0, '8000000000000000'],
  ['1 = 1.0 × 2^0: e = 1023 = 0x3ff', 1, '3ff0000000000000'],
  ['-1: sign bit + 0x3ff', -1, 'bff0000000000000'],
  ['2 = 1.0 × 2^1: e = 0x400', 2, '4000000000000000'],
  ['0.5 = 1.0 × 2^-1: e = 0x3fe', 0.5, '3fe0000000000000'],
  ['1.5 = 1.1b × 2^0: fraction 1000b…', 1.5, '3ff8000000000000'],
  ['3 = 1.1b × 2^1', 3, '4008000000000000'],
  ['4 = 1.0 × 2^2: e = 0x401', 4, '4010000000000000'],
  ['5 = 1.01b × 2^2', 5, '4014000000000000'],
  ['6 = 1.1b × 2^2', 6, '4018000000000000'],
  ['10 = 1.01b × 2^3: e = 0x402', 10, '4024000000000000'],
  ['100 = 1.1001b × 2^6: e = 0x405', 100, '4059000000000000'],
  ['1000 = 1.111101b × 2^9: e = 0x408, fraction 1111 0100b…', 1000, '408f400000000000'],
  ['Number.MIN_VALUE = 2^-1074: e = 0, fraction LSB only', Number.MIN_VALUE, '0000000000000001'],
  [
    'Number.MAX_VALUE = (2 - 2^-52) × 2^1023: e = 0x7fe, fraction all ones',
    Number.MAX_VALUE,
    '7fefffffffffffff',
  ],
  ['-Number.MAX_VALUE', -Number.MAX_VALUE, 'ffefffffffffffff'],
];

describe('binary64Hex (contracts-v1.md §7.2, owner decision 8)', () => {
  it.each(INDEPENDENT_VECTORS)('%s', (_label, value, expected) => {
    expect(binary64Hex(value)).toBe(expected);
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY]])(
    'throws TypeError on %s (precondition violation)',
    (value) => {
      expect(() => binary64Hex(value)).toThrow(TypeError);
    },
  );

  it('distinguishes two adjacent doubles', () => {
    // 1 + 2^-52 is the double just above 1 (fraction LSB set); 2^-52 is exact as a power of two.
    expect(binary64Hex(1 + Number.EPSILON)).toBe('3ff0000000000001');
  });
});

describe('canonicalRequestPayload (contracts-v1.md §7.2)', () => {
  it('produces the text derived by hand from the §7.2 rules for the fixture', () => {
    // Derived from the written definition and the vectors above, not from running the
    // implementation: members sorted by UTF-16 code units, requestId removed, no whitespace,
    // numbers as bare binary64 bit patterns.
    const expected =
      '{"centralBody":"EARTH",' +
      '"constants":{"mu_m3ps2":3ff0000000000000,"referenceRadius_m":3fe0000000000000,' +
      '"source":"placeholder"},' +
      '"duration_s":408f400000000000,"dynamicsModel":"TWO_BODY",' +
      '"epoch":{"iso":"2030-01-02T03:04:05.678Z","scale":"UTC"},"frame":"GCRF",' +
      '"initialState":{"position_m":[3ff0000000000000,4000000000000000,4008000000000000],' +
      '"velocity_mps":[4010000000000000,4014000000000000,4018000000000000]},' +
      '"maneuvers":[{"deltaV_mps":[3ff0000000000000,4000000000000000,4008000000000000],' +
      '"frame":"RSW","id":"m1","t_s":4059000000000000}],' +
      '"outputStep_s":4024000000000000,"schemaVersion":"1.0"}';
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
      constants: {
        source: request.constants.source,
        referenceRadius_m: request.constants.referenceRadius_m,
        mu_m3ps2: request.constants.mu_m3ps2,
      },
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

  it('changes when any input changes, including constants, the maneuver id and the sign of 0', () => {
    const base = canonicalRequestPayload(validRequest());
    const constants = validRequest().constants;
    const variants = [
      { ...validRequest(), duration_s: 1001 },
      { ...validRequest(), constants: { ...constants, mu_m3ps2: 2 } },
      { ...validRequest(), constants: { ...constants, referenceRadius_m: 2 } },
      { ...validRequest(), constants: { ...constants, source: 'other' } },
      { ...validRequest(), maneuvers: [] },
      {
        ...validRequest(),
        maneuvers: [
          { id: 'other', t_s: 100, frame: 'RSW' as const, deltaV_mps: [1, 2, 3] as const },
        ],
      },
      { ...validRequest(), epoch: { scale: 'UTC' as const, iso: '2030-01-02T03:04:05.679Z' } },
      {
        ...validRequest(),
        initialState: { position_m: [1, 2, 3] as const, velocity_mps: [4, 5, -0] as const },
      },
    ];
    const payloads = variants.map(canonicalRequestPayload);
    for (const payload of payloads) {
      expect(payload).not.toBe(base);
    }
    expect(new Set(payloads).size).toBe(payloads.length);
  });

  it('writes +0 and -0 differently (owner decision 8)', () => {
    const withZero = (z: number) => ({
      ...validRequest(),
      initialState: {
        position_m: [z, 2, 3] as const,
        velocity_mps: [4, 5, 6] as const,
      },
    });
    expect(canonicalRequestPayload(withZero(0))).toContain('"position_m":[0000000000000000,');
    expect(canonicalRequestPayload(withZero(-0))).toContain('"position_m":[8000000000000000,');
  });

  it('throws TypeError on a non-finite number (precondition violation)', () => {
    const request = { ...validRequest(), duration_s: Number.NaN };
    expect(() => canonicalRequestPayload(request)).toThrow(TypeError);
  });
});
