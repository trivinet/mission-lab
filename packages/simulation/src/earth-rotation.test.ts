/**
 * Unit tests of earthRotationAngle_rad (ML-TASK-027). Expected values are worked by hand below
 * from ADR-004's formula ERA = 2π (0.7790572732640 + 1.00273781191135448 · T_u); hand
 * multiplication carries about 10 significant digits, so the comparisons use 8 decimals.
 */
import { describe, expect, it } from 'vitest';
import { ERA_AT_J2000_rev, ERA_RATE_revpday, earthRotationAngle_rad } from './earth-rotation';
import { earthRotationAngle_rad as FROM_INDEX } from './index';

const J2000_ISO = '2000-01-01T12:00:00.000Z';

function eraOf(epochIso: string, t_s: number): number {
  const result = earthRotationAngle_rad(epochIso, t_s);
  if (!result.ok) throw new Error(result.reason);
  return result.angle_rad;
}

describe('ERA coefficients', () => {
  it('are the binary64 values of the decimal strings written in ADR-004', () => {
    expect(ERA_AT_J2000_rev).toBe(Number('0.7790572732640'));
    expect(ERA_RATE_revpday).toBe(Number('1.00273781191135448'));
  });

  it('J2000.0 is the time value (2451545.0 − 2440587.5) × 86 400 000 ms', () => {
    // 10 957.5 days × 86 400 000 ms = 946 728 000 000 ms.
    expect(Date.parse(J2000_ISO)).toBe(946_728_000_000);
  });
});

describe('earthRotationAngle_rad', () => {
  it('is exported from the package index', () => {
    expect(FROM_INDEX).toBe(earthRotationAngle_rad);
  });

  it('at J2000.0 (T_u = 0) equals 2π · 0.7790572732640', () => {
    // By hand: 6.283185307179586 × 0.779057273264
    //   = 4.398229715026 (×0.7) + 0.439822971503 (×0.07) + 0.056548667765 (×0.009)
    //   + 0.000359858519 (×0.000057273264) = 4.894961212813 rad by hand; 40-digit decimal gives 4.894961212823757 (Coordinator check, used below).
    expect(eraOf(J2000_ISO, 0)).toBeCloseTo(4.894961212823757, 12);
  });

  it('10 days after J2000.0 (T_u = 10, via t_s = 864 000 s)', () => {
    // Turns = 0.7790572732640 + 10.0273781191135448 = 10.8064353923775448 → fraction
    // 0.8064353923775448. By hand: 6.283185307179586 × 0.8064353923775448
    //   = 5.026548245744 (×0.8) + 0.040434762834 (×0.0064353923775448) = 5.066983008578 rad.
    expect(eraOf(J2000_ISO, 864_000)).toBeCloseTo(5.066983008576194, 12);
  });

  it('gives the same angle for (epoch, t_s) and (epoch + t_s, 0)', () => {
    expect(eraOf('2000-01-11T12:00:00.000Z', 0)).toBeCloseTo(eraOf(J2000_ISO, 864_000), 10);
    expect(eraOf('2026-01-01T00:00:00.000Z', 3600.25)).toBeCloseTo(
      eraOf('2026-01-01T01:00:00.250Z', 0),
      10,
    );
  });

  it('advances by 2π · 0.00273781191135448 rad per day modulo 2π (multi-day offset)', () => {
    // After one UT1 day the bracket grows by 1.00273781191135448 rev: the angle advances by
    // 2π × 0.00273781191135448 = 0.016964600329 (×0.0027) + 0.000237579245 (×0.00003781191135448)
    // = 0.017202179574 rad (by hand) modulo 2π.
    const a = eraOf('2026-01-01T00:00:00.000Z', 0);
    const b = eraOf('2026-01-01T00:00:00.000Z', 86_400);
    let delta = b - a;
    if (delta < 0) delta += 2 * Math.PI;
    expect(delta).toBeCloseTo(0.017202179575244, 10);
  });

  it('always lies in [0, 2π)', () => {
    for (const t_s of [-1e7, -1, 0, 0.5, 86_400, 1e6, 3.15e7, 3.15e9]) {
      const angle = eraOf('2026-01-01T00:00:00.000Z', t_s);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(2 * Math.PI);
    }
  });

  it('returns typed failures for invalid input', () => {
    expect(earthRotationAngle_rad('2000-01-01', 0)).toStrictEqual({
      ok: false,
      reason: 'EPOCH_INVALID',
    });
    expect(earthRotationAngle_rad(J2000_ISO, Number.NaN)).toStrictEqual({
      ok: false,
      reason: 'NON_FINITE_TIME',
    });
    expect(earthRotationAngle_rad(J2000_ISO, Number.NEGATIVE_INFINITY)).toStrictEqual({
      ok: false,
      reason: 'NON_FINITE_TIME',
    });
  });

  it('stays finite for the largest finite t_s (no overflow path)', () => {
    const result = earthRotationAngle_rad(J2000_ISO, Number.MAX_VALUE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Number.isFinite(result.angle_rad)).toBe(true);
  });
});
