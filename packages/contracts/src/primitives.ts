import { z } from 'zod';
import type { StructuralValidationCode } from './codes';

/** Version string of every versioned contract object in this release (contracts-v1.md §9). */
export const SCHEMA_VERSION = '1.0';

/** Attaches a stable code to a refinement. The code is read back by `toValidationIssues`. */
export function rule(
  code: StructuralValidationCode,
  message: string,
): { message: string; params: { code: StructuralValidationCode } } {
  return { message, params: { code } };
}

/**
 * Finite IEEE-754 double. zod 4 `z.number()` rejects NaN, +Infinity and -Infinity
 * (behaviour checked against zod 4.6.7 and pinned by the tests of this package).
 */
export const finiteNumberSchema = z.number();

/** Three finite components. Frame and unit are given by the field that holds it. */
export const vec3Schema = z
  .tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema])
  .readonly();

/** Non-empty identifier. Not interpreted; compared by exact string equality. */
export const idSchema = z
  .string()
  .refine((value) => value.length > 0, rule('ID_EMPTY', 'Identifier must be a non-empty string.'));

const EPOCH_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * True when `iso` is exactly `YYYY-MM-DDTHH:MM:SS.sssZ` and denotes an existing calendar instant
 * (e.g. rejects February 30 and second 60). Pure: parses the string, reads no clock.
 */
export function isCanonicalUtcIso(iso: string): boolean {
  if (!EPOCH_ISO_PATTERN.test(iso)) {
    return false;
  }
  const epochMs = Date.parse(iso);
  return Number.isFinite(epochMs) && new Date(epochMs).toISOString() === iso;
}

/** Scenario epoch: a labelled UTC instant (ADR-004). */
export const epochSchema = z.strictObject({
  scale: z.literal('UTC'),
  iso: z
    .string()
    .refine(
      isCanonicalUtcIso,
      rule(
        'EPOCH_INVALID',
        'Epoch must be a valid UTC instant formatted YYYY-MM-DDTHH:MM:SS.sssZ.',
      ),
    ),
});

export type Vec3 = z.infer<typeof vec3Schema>;
export type Epoch = z.infer<typeof epochSchema>;
