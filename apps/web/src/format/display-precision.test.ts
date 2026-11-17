/**
 * ML-TASK-034 display precision: the stated rule of display-precision.ts, applied to the
 * comparison table only. Expected strings are written by hand from the rule (fixed decimals per
 * unit), not produced by the function.
 */
import { describe, expect, it } from 'vitest';
import { displayDecimals, formatComparisonValue } from './display-precision';

describe('display rule: fixed decimals per unit', () => {
  it('uses 3 decimals for km and deg, 6 for km^2/s^2 and dimensionless, 3 for s', () => {
    expect(displayDecimals('m')).toBe(3);
    expect(displayDecimals('rad')).toBe(3);
    expect(displayDecimals('m^2/s^2')).toBe(6);
    expect(displayDecimals('s')).toBe(3);
    expect(displayDecimals('1')).toBe(6);
  });

  it('shows metres as km with 3 decimals', () => {
    expect(formatComparisonValue(7_000_000, 'm').text).toBe('7000.000');
    expect(formatComparisonValue(6_912_345.678, 'm').text).toBe('6912.346');
    expect(formatComparisonValue(-1234.6, 'm').text).toBe('-1.235');
  });

  it('shows radians as degrees with 3 decimals', () => {
    expect(formatComparisonValue(Math.PI / 4, 'rad').text).toBe('45.000');
    expect(formatComparisonValue(Math.PI, 'rad').text).toBe('180.000');
  });

  it('shows eccentricity with 6 decimals, seconds with 3, energy in km^2/s^2 with 6', () => {
    expect(formatComparisonValue(0.01, '1').text).toBe('0.010000');
    expect(formatComparisonValue(5828.123456, 's').text).toBe('5828.123');
    expect(formatComparisonValue(-28_500_000, 'm^2/s^2').text).toBe('-28.500000');
  });
});

describe('round-off level values', () => {
  it('shows an angle of 7e-16 deg as zero, with the same decimals, and flags it', () => {
    const shown = formatComparisonValue((7e-16 * Math.PI) / 180, 'rad');
    expect(shown.text).toBe('0.000');
    expect(shown.roundedToZero).toBe(true);
    // The full value is kept, not lost.
    expect(shown.exactText).toContain('e-16');
  });

  it('never shows a negative zero', () => {
    expect(formatComparisonValue(-1e-9, 'm').text).toBe('0.000');
    expect(formatComparisonValue(-7e-16, 'rad').text).toBe('0.000');
    expect(formatComparisonValue(-0, 'm').text).toBe('0.000');
  });

  it('does not flag an exact zero, and does not flag a value that shows a nonzero digit', () => {
    expect(formatComparisonValue(0, 'rad').roundedToZero).toBe(false);
    expect(formatComparisonValue(0, 'rad').text).toBe('0.000');
    expect(formatComparisonValue(1000, 'm').roundedToZero).toBe(false);
  });

  it('never uses exponential notation in the cell', () => {
    for (const v of [1e-300, -1e-300, 1e-16, 5e-7]) {
      expect(formatComparisonValue(v, 'm').text).not.toMatch(/e/i);
    }
  });
});

describe('the full value stays available', () => {
  it('exactText carries the shortest round-trip display and SI numbers', () => {
    const value = 6_912_345.678901234;
    const shown = formatComparisonValue(value, 'm');
    expect(shown.exactText).toBe(`${String(value / 1000)} km (SI: ${String(value)} m)`);
    expect(Object.is(Number(String(value)), value)).toBe(true);
  });
});
