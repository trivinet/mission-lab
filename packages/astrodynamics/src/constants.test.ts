import { describe, expect, it } from 'vitest';
import {
  EARTH_CONSTANTS,
  EARTH_CONSTANTS_SOURCE,
  EARTH_GM_m3ps2,
  EARTH_REFERENCE_RADIUS_m,
} from './constants';

// Behaviour and invariants only. Checking the VALUES against the primary source is VT-19
// (Verification Engineer); a unit test comparing a literal with itself would prove nothing.
describe('Earth constants record', () => {
  it('exposes the contract shape { mu_m3ps2, referenceRadius_m, source }', () => {
    expect(Object.keys(EARTH_CONSTANTS).sort()).toEqual(
      ['mu_m3ps2', 'referenceRadius_m', 'source'].sort(),
    );
    expect(EARTH_CONSTANTS.mu_m3ps2).toBe(EARTH_GM_m3ps2);
    expect(EARTH_CONSTANTS.referenceRadius_m).toBe(EARTH_REFERENCE_RADIUS_m);
    expect(EARTH_CONSTANTS.source).toBe(EARTH_CONSTANTS_SOURCE);
  });

  it('satisfies the contract rules: finite and > 0 (MU_NOT_POSITIVE, REFERENCE_RADIUS_NOT_POSITIVE)', () => {
    expect(Number.isFinite(EARTH_CONSTANTS.mu_m3ps2)).toBe(true);
    expect(EARTH_CONSTANTS.mu_m3ps2).toBeGreaterThan(0);
    expect(Number.isFinite(EARTH_CONSTANTS.referenceRadius_m)).toBe(true);
    expect(EARTH_CONSTANTS.referenceRadius_m).toBeGreaterThan(0);
  });

  it('holds values that are exact binary64 integers (no representation error in the literal)', () => {
    expect(Number.isSafeInteger(EARTH_GM_m3ps2)).toBe(true);
    expect(Number.isSafeInteger(EARTH_REFERENCE_RADIUS_m)).toBe(true);
  });

  it('carries a non-empty source citation', () => {
    expect(EARTH_CONSTANTS.source.trim().length).toBeGreaterThan(0);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(EARTH_CONSTANTS)).toBe(true);
  });
});
