/**
 * Unit tests for angles.ts (normalizeAngle_rad). Exact cases use `toBe` (Object.is, which
 * distinguishes +0 from −0). No tolerance is needed: every expected value below is exact by the
 * argument stated next to it.
 */
import { describe, expect, it } from 'vitest';
import { normalizeAngle_rad, TWO_PI_rad } from './angles';

function angleOf(x: number): number {
  const res = normalizeAngle_rad(x);
  if (!res.ok) {
    throw new Error(`unexpected failure for ${String(x)}`);
  }
  return res.angle_rad;
}

describe('normalizeAngle_rad', () => {
  it('TWO_PI_rad is exactly 2 * Math.PI', () => {
    expect(TWO_PI_rad).toBe(Math.PI + Math.PI);
  });

  it('keeps values already in [0, 2π) unchanged', () => {
    for (const x of [0, 1e-300, 1, Math.PI, 6, TWO_PI_rad - 2 ** -50]) {
      expect(angleOf(x)).toBe(x);
    }
  });

  it('maps −0 to +0', () => {
    expect(angleOf(-0)).toBe(0);
    expect(Object.is(angleOf(-0), 0)).toBe(true);
  });

  it('maps exact multiples of 2 * Math.PI to +0', () => {
    for (const k of [1, -1, 2, -2, 4, -4, 1024]) {
      // k * TWO_PI_rad is exact for power-of-two k, and the remainder of an exact multiple is ±0.
      const r = angleOf(k * TWO_PI_rad);
      expect(Object.is(r, 0)).toBe(true);
    }
  });

  it('maps tiny negative angles whose shifted value rounds to 2π to +0 (OQ-1)', () => {
    // -1e-300 + TWO_PI_rad rounds to TWO_PI_rad (1e-300 is far below half an ulp of 2π).
    expect(Object.is(angleOf(-1e-300), 0)).toBe(true);
    expect(Object.is(angleOf(-(2 ** -60)), 0)).toBe(true);
  });

  it('shifts negative angles by one period', () => {
    // −π: (−π) % 2π = −π, and −π + 2π = π exactly (Sterbenz: 2π and π within a factor 2).
    expect(angleOf(-Math.PI)).toBe(Math.PI);
    // −1: −1 + 2π rounds once; the expected value is the same single rounding.
    expect(angleOf(-1)).toBe(-1 + TWO_PI_rad);
  });

  it('reduces values above one period with an exact remainder', () => {
    // 7 % 2π = 7 − 2π, exact (Sterbenz: 2π ≤ 7 ≤ 2·2π).
    expect(angleOf(7)).toBe(7 - TWO_PI_rad);
    // −7: (−7) % 2π = −(7 − 2π) exactly, then + 2π: one rounding.
    expect(angleOf(-7)).toBe(-(7 - TWO_PI_rad) + TWO_PI_rad);
  });

  it('returns a value in [0, 2π) for a spread of finite inputs, including huge ones', () => {
    const xs = [-1e300, -1e15, -123.456, -TWO_PI_rad + 1e-12, 1e-320, 3.5e10, 1e300, 5e-324];
    for (const x of xs) {
      const r = angleOf(x);
      expect(r >= 0 && r < TWO_PI_rad).toBe(true);
    }
  });

  it('rejects NaN and infinities without returning NaN', () => {
    for (const x of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(normalizeAngle_rad(x)).toEqual({ ok: false, reason: 'NON_FINITE_ANGLE' });
    }
  });
});
