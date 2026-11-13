import { describe, expect, it } from 'vitest';
import { loadFamily } from './datasets';

// Inventory of test-data/reference-cases/ as committed by ML-TASK-011 (l2-references-report.md §5).
describe('reference dataset inventory', () => {
  it.each([
    ['vt-02', 9],
    ['vt-03', 9],
    ['vt-04', 10],
    ['vt-05', 9],
    ['vt-08', 18],
  ])('%s has %i datasets', (family, count) => {
    expect(loadFamily(family)).toHaveLength(count);
  });
});
