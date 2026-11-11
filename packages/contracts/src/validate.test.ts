import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toValidationIssues } from './validate';

describe('toValidationIssues', () => {
  it('maps a custom issue without a registered code to SCHEMA_VIOLATION (contract defect)', () => {
    const error = new z.ZodError([
      { code: 'custom', path: ['x', 0], message: 'unregistered', input: 1 },
    ]);
    expect(toValidationIssues(error)).toEqual([
      { code: 'SCHEMA_VIOLATION', path: ['x', 0], message: 'unregistered' },
    ]);
  });

  it('maps a custom issue carrying a semantic code to SCHEMA_VIOLATION (not emitted here)', () => {
    const error = new z.ZodError([
      {
        code: 'custom',
        path: [],
        message: 'm',
        input: 1,
        params: { code: 'PERIGEE_BELOW_REFERENCE_RADIUS' },
      },
    ]);
    expect(toValidationIssues(error)).toEqual([
      { code: 'SCHEMA_VIOLATION', path: [], message: 'm' },
    ]);
  });
});
