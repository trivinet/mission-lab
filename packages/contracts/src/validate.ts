import type { z } from 'zod';
import { isStructuralValidationCode } from './codes';
import type { ValidationCode } from './codes';
import { SCHEMA_VERSION } from './primitives';
import { simulationRequestSchema } from './request';
import type { SimulationRequest } from './request';
import { simulationResultSchema } from './result';
import type { SimulationResult } from './result';
import { scenarioSchema } from './scenario';
import type { Scenario } from './scenario';

/** One rejected rule. `path` locates the offending field from the validated root. */
export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

type Issue = z.core.$ZodIssue;

function toPath(path: readonly PropertyKey[]): (string | number)[] {
  return path.map((key) => (typeof key === 'number' ? key : String(key)));
}

function codeOf(issue: Issue): ValidationCode {
  switch (issue.code) {
    case 'custom': {
      const code: unknown = issue.params?.code;
      return isStructuralValidationCode(code) ? code : 'SCHEMA_VIOLATION';
    }
    case 'invalid_type':
      return typeof issue.input === 'number' && !Number.isFinite(issue.input)
        ? 'NON_FINITE_NUMBER'
        : 'TYPE_MISMATCH';
    case 'invalid_value':
      return 'UNSUPPORTED_VALUE';
    case 'too_small':
    case 'too_big':
      // Only fixed-length tuples (Vec3) produce these.
      return 'TYPE_MISMATCH';
    default:
      return 'SCHEMA_VIOLATION';
  }
}

/** Maps zod issues to contract validation issues. */
export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.flatMap((issue): ValidationIssue[] => {
    const path = toPath(issue.path);
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        code: 'UNKNOWN_FIELD',
        path: [...path, key],
        message: `Unknown field "${key}".`,
      }));
    }
    return [{ code: codeOf(issue), path, message: issue.message }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Version gate for versioned roots: if the input is an object whose `schemaVersion` is not the
 * supported one (including missing), report only that, since other issues would be noise.
 */
function checkSchemaVersion(input: unknown): ValidationIssue | undefined {
  if (!isRecord(input) || input.schemaVersion === SCHEMA_VERSION) {
    return undefined;
  }
  return {
    code: 'SCHEMA_VERSION_UNSUPPORTED',
    path: ['schemaVersion'],
    message: `Unsupported or missing schemaVersion; this version reads "${SCHEMA_VERSION}".`,
  };
}

function run<T>(schema: z.ZodType<T>, input: unknown, versioned: boolean): ValidationResult<T> {
  if (versioned) {
    const versionIssue = checkSchemaVersion(input);
    if (versionIssue !== undefined) {
      return { ok: false, issues: [versionIssue] };
    }
  }
  const parsed = schema.safeParse(input, { reportInput: true });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, issues: toValidationIssues(parsed.error) };
}

/** Structural validation of a Scenario (e.g. a loaded file). Throwing scope: contracts-v1.md §6. */
export function validateScenario(input: unknown): ValidationResult<Scenario> {
  return run(scenarioSchema, input, true);
}

/** Structural validation of a SimulationRequest. Throwing scope: contracts-v1.md §6. */
export function validateSimulationRequest(input: unknown): ValidationResult<SimulationRequest> {
  return run(simulationRequestSchema, input, true);
}

/**
 * Structural validation of a SimulationResult. Must run in the realm that created the typed
 * arrays (class and buffer checks use instanceof). Throwing scope: contracts-v1.md §6.
 */
export function validateSimulationResult(input: unknown): ValidationResult<SimulationResult> {
  return run(simulationResultSchema, input, false);
}
