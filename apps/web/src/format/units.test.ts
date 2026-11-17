import { describe, expect, it } from 'vitest';
import { formatInputNumber, fromDeg, fromKm, parseNumber, toDeg, toKm, utcLabel } from './units';

describe('display unit conversions', () => {
  it('km <-> m is exact for typed values exact in binary64', () => {
    for (const km of [0, 1, 7000, 0.5]) {
      expect(toKm(fromKm(km))).toBe(km);
    }
    expect(fromKm(7000)).toBe(7_000_000);
    expect(toKm(7_000_000)).toBe(7000);
  });

  it('a typed value is converted once: the stored value is exactly that one conversion', () => {
    const typed = parseNumber('6778.137');
    const stored = fromKm(typed);
    expect(stored).toBe(Number('6778.137') * 1000);
    // Showing it and re-typing what is shown gives the same stored value.
    expect(fromKm(parseNumber(formatInputNumber(toKm(stored))))).toBe(stored);
  });

  it('deg -> rad -> deg shows the typed angle at the displayed precision', () => {
    for (const deg of [0, 30, 45, 90, 97.4, 180, 359.999]) {
      expect(formatInputNumber(toDeg(fromDeg(deg)))).toBe(formatInputNumber(deg));
    }
  });

  it('0 and 180 deg map to the exact rad endpoints of the inclination range', () => {
    expect(fromDeg(0)).toBe(0);
    expect(fromDeg(180)).toBe(Math.PI);
    expect(toDeg(Math.PI)).toBe(180);
  });

  it('parseNumber gives NaN for blank or non-numeric text, never a default', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('   ')).toBeNaN();
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('-1.5e3')).toBe(-1500);
    expect(parseNumber('Infinity')).toBe(Infinity);
  });

  it('formatInputNumber trims to 12 significant digits', () => {
    expect(formatInputNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatInputNumber(7000)).toBe('7000');
    expect(formatInputNumber(Number.NaN)).toBe('');
  });

  it('utcLabel is epoch + elapsed seconds in UTC, millisecond precision', () => {
    expect(utcLabel('2026-01-01T00:00:00.000Z', 3600)).toBe('2026-01-01T01:00:00.000Z');
    expect(utcLabel('2026-01-01T00:00:00.000Z', 0.5)).toBe('2026-01-01T00:00:00.500Z');
    expect(utcLabel('not a date', 1)).toBeNull();
    expect(utcLabel('2026-01-01T00:00:00.000Z', Number.NaN)).toBeNull();
  });
});
