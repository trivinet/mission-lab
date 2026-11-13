import { describe, expect, it } from 'vitest';
import { buildSamplingGrid, gridCandidateCount, sampleCount } from './sampling-grid';
import { bitEqual } from './test-fixtures';

function times(D: number, h: number, m: number[] = []): number[][] {
  return buildSamplingGrid(D, h, m).map((s) => [...s.times_s]);
}

function total(D: number, h: number, m: number[] = []): number {
  return buildSamplingGrid(D, h, m).reduce((n, s) => n + s.times_s.length, 0);
}

describe('§5.2 grid without maneuver', () => {
  it('step divides the duration', () => {
    expect(times(10, 2)).toEqual([[0, 2, 4, 6, 8, 10]]);
  });

  it('step does not divide the duration: the last candidate < D, then D', () => {
    expect(times(10, 3)).toEqual([[0, 3, 6, 9, 10]]);
  });

  it('outputStep ≥ duration gives exactly [0, D]', () => {
    expect(times(5, 5)).toEqual([[0, 5]]);
    expect(times(5, 7)).toEqual([[0, 5]]);
  });

  it('t0 is +0', () => {
    expect(Object.is(buildSamplingGrid(10, 3, [])[0]?.times_s[0], 0)).toBe(true);
  });

  it('candidates are one multiplication fl(j × h), never accumulated (h = 0.1)', () => {
    const grid = times(1, 0.1)[0] ?? [];
    expect(grid).toHaveLength(11);
    for (let j = 0; j < 10; j++) {
      expect(Object.is(grid[j], j * 0.1)).toBe(true);
    }
    expect(grid[10]).toBe(1);
    // Accumulating would give 0.7999999999999999 at j = 8; the multiplication gives 0.8.
    let accumulated = 0;
    for (let j = 0; j < 8; j++) {
      accumulated += 0.1;
    }
    expect(accumulated).not.toBe(0.8);
    expect(grid[8]).toBe(0.8);
    expect(grid[3]).toBe(0.30000000000000004);
  });

  it('a candidate that rounds up to ≥ D is not a candidate (D = 0.3, h = 0.1)', () => {
    // 3 × 0.1 = 0.30000000000000004 > 0.3, so the candidates are 0, 0.1, 0.2.
    expect(times(0.3, 0.1)).toEqual([[0, 0.1, 0.2, 0.3]]);
  });

  it('a candidate equal to D is not duplicated (D = 3 × 0.1 exactly)', () => {
    const D = 3 * 0.1;
    expect(times(D, 0.1)).toEqual([[0, 0.1, 0.2, D]]);
  });
});

describe('§5.2 grid with one maneuver', () => {
  it('maneuver on a grid point: boundary once in each segment', () => {
    expect(times(10, 2, [4])).toEqual([
      [0, 2, 4],
      [4, 6, 8, 10],
    ]);
  });

  it('maneuver off the grid is inserted', () => {
    expect(times(10, 2, [5])).toEqual([
      [0, 2, 4, 5],
      [5, 6, 8, 10],
    ]);
  });

  it('maneuver at 0: segment 0 is the single sample [0]', () => {
    expect(times(10, 2, [0])).toEqual([[0], [0, 2, 4, 6, 8, 10]]);
  });

  it('maneuver at −0: the shared sample takes the value −0 in both segments', () => {
    const grid = buildSamplingGrid(10, 2, [-0]);
    expect(grid).toHaveLength(2);
    expect(grid[0]?.times_s).toHaveLength(1);
    expect(Object.is(grid[0]?.times_s[0], -0)).toBe(true);
    expect(Object.is(grid[1]?.times_s[0], -0)).toBe(true);
    expect(Object.is(grid[1]?.start_s, -0)).toBe(true);
    expect(grid[1]?.times_s.slice(1)).toEqual([2, 4, 6, 8, 10]);
  });

  it('maneuver at D: the last segment is the single sample [D]', () => {
    expect(times(10, 3, [10])).toEqual([[0, 3, 6, 9, 10], [10]]);
  });

  it('values one ulp apart are distinct samples (maneuver at 0.3, grid point 3 × 0.1)', () => {
    const grid = times(1, 0.1, [0.3]);
    expect(grid[0]?.at(-1)).toBe(0.3);
    expect(grid[1]?.slice(0, 2)).toEqual([0.3, 0.30000000000000004]);
    expect(grid[0]).not.toContain(0.30000000000000004);
  });

  it('maneuver equal to a rounded grid point is not duplicated (0.30000000000000004)', () => {
    const grid = times(1, 0.1, [3 * 0.1]);
    expect(grid[0]).toEqual([0, 0.1, 0.2, 3 * 0.1]);
    expect(grid[1]?.[0]).toBe(3 * 0.1);
    expect(grid[1]).toHaveLength(8);
  });

  it('segment start_s is the boundary, bit-identical', () => {
    const m = 1234.5678;
    const grid = buildSamplingGrid(5000, 60, [m]);
    expect(Object.is(grid[0]?.start_s, 0)).toBe(true);
    expect(Object.is(grid[1]?.start_s, m)).toBe(true);
    expect(Object.is(grid[0]?.times_s.at(-1), m)).toBe(true);
    expect(Object.is(grid[1]?.times_s[0], m)).toBe(true);
  });
});

describe('sample count without enumeration', () => {
  const cases: [number, number, number[]][] = [
    [10, 2, []],
    [10, 3, []],
    [5, 5, []],
    [5, 7, []],
    [1, 0.1, []],
    [0.3, 0.1, []],
    [3 * 0.1, 0.1, []],
    [1, 0.1, [0.3]],
    [1, 0.1, [3 * 0.1]],
    [10, 2, [0]],
    [10, 2, [-0]],
    [10, 2, [4]],
    [10, 2, [5]],
    [10, 3, [10]],
    [86400, 0.1, [43200.05]],
    [86400, 7, [86399.999]],
    [5400.3, 0.7, [0.7 * 1000]],
    [1e-3, 1e-7, [5e-4]],
    [123456.789, 1 / 3, [100000 / 3]],
  ];
  for (const [D, h, m] of cases) {
    it(`D = ${String(D)}, h = ${String(h)}, m = [${m.map(String).join(', ')}]`, () => {
      expect(sampleCount(D, h, m)).toBe(total(D, h, m));
    });
  }

  it('the enumerated grid is strictly increasing in every segment', () => {
    for (const [D, h, m] of cases) {
      for (const segment of buildSamplingGrid(D, h, m)) {
        let increasing = true;
        for (let k = 1; k < segment.times_s.length; k++) {
          increasing &&= (segment.times_s[k] ?? 0) > (segment.times_s[k - 1] ?? 0);
        }
        expect(increasing).toBe(true);
      }
    }
  });

  it('candidate count matches a direct scan of fl(j × h) < D', () => {
    for (const [D, h] of cases) {
      let j = 0;
      while (j * h < D) {
        j++;
      }
      expect(gridCandidateCount(D, h)).toBe(j);
    }
  });

  it('is at least 2^51 when the grid is astronomically large', () => {
    expect(gridCandidateCount(1e20, 1e-5)).toBeGreaterThanOrEqual(2 ** 51);
    expect(sampleCount(1e300, 1e-300, [])).toBe(Infinity);
  });

  it('grid of a 0.1 s step has the same values as one multiplication per index', () => {
    const grid = buildSamplingGrid(100, 0.1, [])[0]?.times_s ?? [];
    const expected = Array.from({ length: grid.length - 1 }, (_, j) => j * 0.1);
    expect(bitEqual(grid.slice(0, -1), expected)).toBe(true);
  });
});
