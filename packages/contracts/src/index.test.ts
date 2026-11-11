import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('contracts placeholder', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@mission-lab/contracts');
  });
});
