/**
 * Self-validation of the independent §5.2 grid construction (contracts-v1.md §5.2, owner
 * decision 2) on cases worked out by hand from the contract text.
 */
import { describe, expect, it } from 'vitest';
import { countCandidates, sampleCountLarge, samplingGridWithManeuvers } from './grid';

describe('§5.2 sampling grid (independent construction)', () => {
  it('coast, D a multiple of h: 0, h, …, D', () => {
    const g = samplingGridWithManeuvers(60, 10, []);
    expect(g.times).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(g.segments).toEqual([[0, 10, 20, 30, 40, 50, 60]]);
    expect(g.sampleCount).toBe(7);
  });

  it('h ≥ D: exactly the two samples 0 and D', () => {
    expect(samplingGridWithManeuvers(5, 7, []).times).toEqual([0, 5]);
    expect(samplingGridWithManeuvers(5, 5, []).times).toEqual([0, 5]);
  });

  it('candidates are fl(j × h), not accumulated', () => {
    const g = samplingGridWithManeuvers(1, 0.1, []);
    // 3 × 0.1 = 0.30000000000000004 (one multiplication), not 0.1 + 0.1 + 0.1 accumulated.
    expect(g.times[3]).toBe(3 * 0.1);
    expect(g.times[3]).toBe(0.30000000000000004);
    // 10 × 0.1 rounds to exactly 1 = D: not a candidate (strict <), D appears once.
    expect(g.times.length).toBe(11);
    expect(g.times[10]).toBe(1);
  });

  it('maneuver on a grid point: once in each adjacent segment, not duplicated', () => {
    const g = samplingGridWithManeuvers(60, 10, [30]);
    expect(g.times).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(g.segments).toEqual([
      [0, 10, 20, 30],
      [30, 40, 50, 60],
    ]);
    expect(g.sampleCount).toBe(8);
  });

  it('maneuver off the grid is added; one ulp from a grid point stays distinct', () => {
    const m = 30 + 2 ** -48; // ulp(30) = 2^-48 · … ; next double above 30
    expect(m).toBeGreaterThan(30);
    const g = samplingGridWithManeuvers(60, 10, [m]);
    expect(g.segments[0]).toEqual([0, 10, 20, 30, m]);
    expect(g.segments[1]).toEqual([m, 40, 50, 60]);
  });

  it('maneuver at 0 and at D', () => {
    const a = samplingGridWithManeuvers(30, 10, [0]);
    expect(a.segments).toEqual([[0], [0, 10, 20, 30]]);
    const b = samplingGridWithManeuvers(30, 10, [30]);
    expect(b.segments).toEqual([[0, 10, 20, 30], [30]]);
  });

  it('maneuver at −0: the single sample takes the value −0', () => {
    const g = samplingGridWithManeuvers(30, 10, [-0]);
    expect(Object.is(g.times[0], -0)).toBe(true);
    expect(Object.is(g.segments[0]?.[0], -0)).toBe(true);
    expect(Object.is(g.segments[1]?.[0], -0)).toBe(true);
    expect(g.segments[1]).toEqual([-0, 10, 20, 30]);
  });

  it('large-span counting agrees with the materialised grid', () => {
    for (const [D, h, ms] of [
      [1000, 1, []],
      [999, 1, [500]],
      [1000, 0.1, [33.33]],
      [100, 7, [100]],
      [100, 7, [0]],
    ] as const) {
      expect(sampleCountLarge(D, h, ms)).toBe(samplingGridWithManeuvers(D, h, ms).sampleCount);
    }
    expect(countCandidates(999999, 1)).toBe(999999);
    expect(sampleCountLarge(999999, 1, [])).toBe(1_000_000);
    expect(sampleCountLarge(1_000_000, 1, [])).toBe(1_000_001);
    expect(sampleCountLarge(999999, 1, [500000])).toBe(1_000_001);
  });
});
