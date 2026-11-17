/**
 * Unit tests of utcIsoAtElapsed (ML-TASK-027). Expected labels are calendar arithmetic done by
 * hand in the comments (uniform 86 400 s days, no leap seconds: the M1 convention).
 */
import { isCanonicalUtcIso } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { utcIsoAtElapsed } from './utc-label';

const EPOCH = '2026-01-01T00:00:00.000Z';

describe('utcIsoAtElapsed', () => {
  it('returns the epoch itself at t_s = 0 (and −0)', () => {
    expect(utcIsoAtElapsed(EPOCH, 0)).toStrictEqual({ ok: true, iso: EPOCH });
    expect(utcIsoAtElapsed(EPOCH, -0)).toStrictEqual({ ok: true, iso: EPOCH });
    const odd = '2030-01-02T03:04:05.678Z';
    expect(utcIsoAtElapsed(odd, 0)).toStrictEqual({ ok: true, iso: odd });
  });

  it('keeps fractional seconds to the millisecond and rounds to the nearest millisecond', () => {
    // 1.5 s → .500
    expect(utcIsoAtElapsed(EPOCH, 1.5)).toStrictEqual({
      ok: true,
      iso: '2026-01-01T00:00:01.500Z',
    });
    // 0.0004 s = 0.4 ms → rounds down to .000; 0.0006 s = 0.6 ms → .001
    expect(utcIsoAtElapsed(EPOCH, 0.0004)).toStrictEqual({ ok: true, iso: EPOCH });
    expect(utcIsoAtElapsed(EPOCH, 0.0006)).toStrictEqual({
      ok: true,
      iso: '2026-01-01T00:00:00.001Z',
    });
    // 59.9996 s → 59 999.6 ms → 60 000 ms: carries into the minute.
    expect(utcIsoAtElapsed(EPOCH, 59.9996)).toStrictEqual({
      ok: true,
      iso: '2026-01-01T00:01:00.000Z',
    });
    // Epoch with milliseconds: 05.678 + 0.5 s = 06.178.
    expect(utcIsoAtElapsed('2030-01-02T03:04:05.678Z', 0.5)).toStrictEqual({
      ok: true,
      iso: '2030-01-02T03:04:06.178Z',
    });
  });

  it('handles a multi-day offset across a month and year boundary', () => {
    // 3 days 4 h 5 min 6.789 s = 3·86400 + 4·3600 + 5·60 + 6.789 = 273 906.789 s.
    expect(utcIsoAtElapsed('2025-12-30T00:00:00.000Z', 273906.789)).toStrictEqual({
      ok: true,
      iso: '2026-01-02T04:05:06.789Z',
    });
    // 2028 is a leap year (divisible by 4, not by 100): Feb 28 + 1 day = Feb 29.
    expect(utcIsoAtElapsed('2028-02-28T12:00:00.000Z', 86400)).toStrictEqual({
      ok: true,
      iso: '2028-02-29T12:00:00.000Z',
    });
  });

  it('uses uniform 86 400 s days across a year end (M1 convention, no leap seconds)', () => {
    // Whatever the leap-second history of a date, the M1 convention adds 86 400 s per day, so the
    // label is the same clock time on the next day.
    expect(utcIsoAtElapsed('2016-12-31T12:00:00.000Z', 86400)).toStrictEqual({
      ok: true,
      iso: '2017-01-01T12:00:00.000Z',
    });
  });

  it('allows negative t_s (earlier instant)', () => {
    expect(utcIsoAtElapsed(EPOCH, -1)).toStrictEqual({
      ok: true,
      iso: '2025-12-31T23:59:59.000Z',
    });
  });

  it('always returns a canonical ISO string', () => {
    for (const t_s of [0, 0.001, 1e-9, 12345.6789, 1e6, 3.15e7]) {
      const result = utcIsoAtElapsed(EPOCH, t_s);
      expect(result.ok).toBe(true);
      if (result.ok) expect(isCanonicalUtcIso(result.iso)).toBe(true);
    }
  });

  it('returns typed failures for invalid input', () => {
    expect(utcIsoAtElapsed('2026-01-01T00:00:00Z', 0)).toStrictEqual({
      ok: false,
      reason: 'EPOCH_INVALID',
    });
    expect(utcIsoAtElapsed('2026-02-30T00:00:00.000Z', 0)).toStrictEqual({
      ok: false,
      reason: 'EPOCH_INVALID',
    });
    expect(utcIsoAtElapsed(EPOCH, Number.NaN)).toStrictEqual({
      ok: false,
      reason: 'NON_FINITE_TIME',
    });
    expect(utcIsoAtElapsed(EPOCH, Number.POSITIVE_INFINITY)).toStrictEqual({
      ok: false,
      reason: 'NON_FINITE_TIME',
    });
    // 1e12 s ≈ 31 700 years: past year 9999.
    expect(utcIsoAtElapsed(EPOCH, 1e12)).toStrictEqual({ ok: false, reason: 'OUT_OF_RANGE' });
    // 1e300 s: beyond the ECMAScript time range (must not throw).
    expect(utcIsoAtElapsed(EPOCH, 1e300)).toStrictEqual({ ok: false, reason: 'OUT_OF_RANGE' });
    expect(utcIsoAtElapsed(EPOCH, -1e300)).toStrictEqual({ ok: false, reason: 'OUT_OF_RANGE' });
  });
});
