/**
 * Transcription check of tolerances-vi03.ts against every evaluated number the record prints for
 * the rows it uses (tolerance record revision 5: §8 VI-03 (b) "Evaluated examples", §7 VT-12,
 * §7 VT-13). A printed value with k significant digits is matched to half a unit of its last digit.
 */
import { describe, expect, it } from 'vitest';
import {
  nearThreshold,
  vi03Tolerances,
  vt12InertialDeltaV,
  vt13Magnitude,
  vt13MagnitudeVsRsw,
  type Vi03Inputs,
} from './tolerances-vi03';

function printed(x: number, text: string): void {
  const p = Number(text);
  const digits = text.replace(/e.*$/i, '').replace(/[-.]/g, '').replace(/^0+/, '').length;
  const exp = Math.floor(Math.log10(Math.abs(p)));
  const half = 0.5 * 10 ** (exp - digits + 1);
  expect(Math.abs(x - p), `${String(x)} vs printed ${text}`).toBeLessThanOrEqual(half);
}

function inputs(kappaH: number, inc: number, e: number): Vi03Inputs {
  return {
    radius_m: 7e6,
    altitude_m: 6e5,
    speed_mps: 7.5e3,
    semiMajorAxis_m: 7e6,
    eccentricity: e,
    inclination_rad: inc,
    iPrime_rad: Math.min(inc, Math.PI - inc),
    kappaE: 3,
    kappaH,
    energyScale_m2ps2: 8.5e7,
    closed: true,
  };
}

describe('§8 VI-03 (b) evaluated examples (M·2·per side)', () => {
  it('κ_h = 1, sin i = 1, e = 0.1: i 1.2e-14, Ω 9.4e-15, ω 3.9e-13, ν 3.9e-13 rad', () => {
    const t = vi03Tolerances(inputs(1, Math.PI / 2, 0.1));
    printed(t.inclination_rad.value ?? NaN, '1.2e-14');
    printed(t.raan_rad.value ?? NaN, '9.4e-15');
    printed(t.argPeriapsis_rad.value ?? NaN, '3.9e-13');
    printed(t.trueAnomaly_rad.value ?? NaN, '3.9e-13');
  });
  it('C4-like (κ_h = 1.091, i = 0.5, e = 0.4): i 1.2e-14, Ω 1.4e-14, ω 1.1e-13, ν 1.05e-13', () => {
    const t = vi03Tolerances(inputs(1.091, 0.5, 0.4));
    printed(t.inclination_rad.value ?? NaN, '1.2e-14');
    printed(t.raan_rad.value ?? NaN, '1.4e-14');
    printed(t.argPeriapsis_rad.value ?? NaN, '1.1e-13');
    printed(t.trueAnomaly_rad.value ?? NaN, '1.05e-13');
  });
  it('C5-like (κ_h = 1.487, i = 63.4°, e = 0.74): i 1.4e-14, Ω 1.2e-14, ω 6.8e-14, ν 6.2e-14', () => {
    const t = vi03Tolerances(inputs(1.487, (63.4 * Math.PI) / 180, 0.74));
    printed(t.inclination_rad.value ?? NaN, '1.4e-14');
    printed(t.raan_rad.value ?? NaN, '1.2e-14');
    printed(t.argPeriapsis_rad.value ?? NaN, '6.8e-14');
    printed(t.trueAnomaly_rad.value ?? NaN, '6.2e-14');
  });
  it('e row M·60u = 240u ≈ 2.7e-14; ‖r‖, ‖v‖ rows 24u relative', () => {
    const s = inputs(1, 1, 0.1);
    const t = vi03Tolerances(s);
    printed(t.eccentricity.value ?? NaN, '2.7e-14');
    expect(t.radius_m.value).toBe(24 * 2 ** -53 * s.radius_m);
    expect(t.speed_mps.value).toBe(24 * 2 ** -53 * s.speed_mps);
  });
  it('open orbit: e, ω, ν not asserted (record silent); circular / equatorial rows absent', () => {
    const t = vi03Tolerances({ ...inputs(1, 1, 1.3), closed: false });
    expect(t.eccentricity.value).toBeNull();
    expect(t.argPeriapsis_rad.value).toBeNull();
    expect(t.trueAnomaly_rad.value).toBeNull();
    expect(t.inclination_rad.value).not.toBeNull();
    const c = vi03Tolerances(inputs(1, 1, 1e-7));
    expect(c.argPeriapsis_rad.value).toBeNull();
    expect(c.trueAnomaly_rad.value).toBeNull();
    const q = vi03Tolerances(inputs(1, 1e-7, 0.1));
    expect(q.raan_rad.value).toBeNull();
    expect(q.argPeriapsis_rad.value).not.toBeNull();
  });
  it('factor-2 exclusion around ε = 1e-5', () => {
    expect(nearThreshold(5e-6, 1)).toBe(true);
    expect(nearThreshold(2e-5, 1)).toBe(true);
    expect(nearThreshold(4.9e-6, 1)).toBe(false);
    expect(nearThreshold(0.1, 1.5e-5)).toBe(true);
    expect(nearThreshold(0.1, 0.5)).toBe(false);
  });
});

describe('§7 VT-12 / VT-13 evaluated values', () => {
  it('VT-12: e = 0 3.3e-14 relative; C5 3.8e-14', () => {
    printed(vt12InertialDeltaV(1, 1), '3.3e-14');
    printed(vt12InertialDeltaV(1.4868, 1), '3.8e-14');
  });
  it('VT-13: 24u ≈ 2.7e-15 relative; physics cross-check e = 0 1.9e-14', () => {
    printed(vt13Magnitude(1), '2.7e-15');
    printed(vt13MagnitudeVsRsw(1, 1), '1.9e-14');
  });
});
