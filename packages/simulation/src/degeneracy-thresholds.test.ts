import { describe, expect, it } from 'vitest';
import { DEGENERACY_THRESHOLDS } from './degeneracy-thresholds';
import { DEGENERACY_THRESHOLDS as FROM_INDEX } from './index';

describe('DEGENERACY_THRESHOLDS', () => {
  it('equals the approved values of ADR-008 and tolerances.md §15 (ε_e = ε_i = 1e-5)', () => {
    // Values transcribed from ADR-008 "Thresholds and target value" and tolerances.md §15,
    // row "Thresholds ε_e, ε_i (§10)".
    expect(DEGENERACY_THRESHOLDS).toEqual({
      circularEccentricity: 1e-5,
      equatorialInclination_rad: 1e-5,
    });
  });

  it('is frozen and exported from the package index', () => {
    expect(Object.isFrozen(DEGENERACY_THRESHOLDS)).toBe(true);
    expect(FROM_INDEX).toBe(DEGENERACY_THRESHOLDS);
  });
});
