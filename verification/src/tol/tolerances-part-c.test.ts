/**
 * Transcription check of the part-C formulas (VT-01, VT-06, VT-07, VT-11 … VT-15) against every
 * evaluated number printed in docs/verification/tolerances.md revision 3 (ML-TASK-018 part C).
 * Same matching rule as tolerances.test.ts: half a unit in the last printed digit.
 */
import { describe, expect, it } from 'vitest';
import {
  U,
  scales,
  tauEEng,
  vt06,
  vt07,
  vt11,
  vt12,
  vt13,
  vt14,
  vt15,
  VT01_CROSS_ORTHOGONALITY,
  VT01_NORM,
  VT01_TRIPLE_PRODUCT,
  VT01_UNIT,
} from './tolerances';

const MU = 3.986004418e14;
const C1 = scales(MU, 7.0e6, 0);
const C3 = scales(MU, 1.0e7, 0.3);
const C4 = scales(MU, 1.2e7, 0.4);
const C5 = scales(MU, 2.6e7, 0.74);
const C6 = scales(MU, 4.2e7, 0);

function matchesPrinted(value: number, printed: string): boolean {
  const p = Number(printed);
  const mant = printed.toLowerCase().split('e')[0] ?? printed;
  const decimals = (mant.split('.')[1] ?? '').length;
  const expPart = printed.toLowerCase().includes('e')
    ? Number(printed.toLowerCase().split('e')[1])
    : 0;
  const halfUnit = 0.5 * 10 ** (expPart - decimals);
  return Math.abs(value - p) <= halfUnit + 1e-12 * Math.abs(p);
}

function check(label: string, value: number, printed: string): void {
  expect(
    matchesPrinted(value, printed),
    `${label}: computed ${String(value)}, printed ${printed}`,
  ).toBe(true);
}

describe('part C tolerance formulas reproduce the approved record (transcription check)', () => {
  it('VT-01 fixed tolerances (§7 VT-01)', () => {
    check('(a) in u', VT01_CROSS_ORTHOGONALITY / U, '23.3');
    check('(a)', VT01_CROSS_ORTHOGONALITY, '2.6e-15');
    check('(b) in u', VT01_TRIPLE_PRODUCT / U, '46.6');
    check('(b)', VT01_TRIPLE_PRODUCT, '5.2e-15');
    check('(c)', VT01_NORM, '2.7e-15');
    expect(VT01_NORM / U).toBe(24);
    check('(d)', VT01_UNIT, '3.1e-15');
    expect(VT01_UNIT / U).toBe(28);
  });

  it('VT-06 and VT-07 at Δt = 10T (§7)', () => {
    check('C1 VT-06', vt06(C1, 10 * C1.T), '7.4e-12');
    check('C3 VT-06', vt06(C3, 10 * C3.T), '3.60e-11');
    check('C4 VT-06', vt06(C4, 10 * C4.T), '6.41e-11');
    check('C5 VT-06', vt06(C5, 10 * C5.T), '9.06e-10');
    check('C6 VT-06', vt06(C6, 10 * C6.T), '7.4e-12');
    check('C1 VT-07', vt07(C1, 10 * C1.T), '3.7e-12');
    check('C3 VT-07', vt07(C3, 10 * C3.T), '1.65e-11');
    check('C4 VT-07', vt07(C4, 10 * C4.T), '2.86e-11');
    check('C5 VT-07', vt07(C5, 10 * C5.T), '3.8e-10');
    check('C6 VT-07', vt07(C6, 10 * C6.T), '3.7e-12');
  });

  it('VT-11, VT-12, VT-13 (§7)', () => {
    check('VT-11 e=0', vt11(1).orthonormality, '1.64e-14');
    check('VT-11 C5', vt11(C5.kappaH).orthonormality, '1.90e-14');
    check('VT-11 R', vt11(1).rParallel, '3.6e-15');
    check('VT-11 W e=0', vt11(1).wParallel, '8.9e-15');
    check('VT-12 e=0', vt12(1), '3.3e-14');
    check('VT-12 C5', vt12(C5.kappaH), '3.8e-14');
    check('VT-13 magnitude', vt13(1).magnitude, '2.7e-15');
    check('VT-13 rotation e=0', vt13(1).rotationNorm, '1.9e-14');
  });

  it('VT-14 at C1, m = T, t = 10T (§7)', () => {
    check('τ_E,eng(T) C1', tauEEng(C1, C1.T), '2.55e-13');
    const t = vt14(C1, C1.T, 10 * C1.T);
    check('VT-14 r', t.position_m, '6.8e-4');
    check('VT-14 v', t.velocity_mps, '7.6e-7');
    expect(() => vt14(C4, C4.T, 10 * C4.T)).toThrow(RangeError);
  });

  it('VT-15 at C4, +100 m/s along S at m = T (§7)', () => {
    check('τ_E,eng(T) C4', tauEEng(C4, C4.T), '2.15e-12');
    // Perigee r = 7.2e6, a⁺ = 1.268e7; apogee r = 1.68e7, a⁺ = 1.228e7 (record's rounded inputs).
    const peri = vt15(C4, C4.T, 1.268e7, 7.2e6);
    check('perigee a⁺', peri.aRelative, '9.1e-12');
    check('perigee e⁺', peri.eAbsolute, '5.2e-12');
    const apo = vt15(C4, C4.T, 1.228e7, 1.68e7);
    check('apogee a⁺', apo.aRelative, '8.8e-12');
    check('apogee e⁺', apo.eAbsolute, '1.2e-11');
  });
});
