/**
 * Machine-readable code registry, contract v1.0.
 *
 * Codes are stable: a published code is never renamed, removed or given a new meaning. New codes
 * may be added in a minor contract version. Semantics, severities, emitters and traceability of
 * every code are in docs/architecture/contracts-v1.md §8.
 */

/** Rejections produced by the structural validators of this package. */
export const STRUCTURAL_VALIDATION_CODES = [
  'SCHEMA_VERSION_UNSUPPORTED',
  'TYPE_MISMATCH',
  'UNKNOWN_FIELD',
  'NON_FINITE_NUMBER',
  'UNSUPPORTED_VALUE',
  'SCHEMA_VIOLATION',
  'ID_EMPTY',
  'ID_DUPLICATE',
  'EPOCH_INVALID',
  'DURATION_NOT_POSITIVE',
  'OUTPUT_STEP_NOT_POSITIVE',
  'SEMI_MAJOR_AXIS_NOT_POSITIVE',
  'ECCENTRICITY_OUT_OF_RANGE',
  'INCLINATION_OUT_OF_RANGE',
  'ANGLE_OUT_OF_RANGE',
  'MANEUVER_COUNT_EXCEEDED',
  'MANEUVER_TIME_OUT_OF_RANGE',
  'MU_NOT_POSITIVE',
  'REFERENCE_RADIUS_NOT_POSITIVE',
  'REQUEST_ID_INVALID',
  'ENGINE_VERSION_INVALID',
  'MAGNITUDE_NEGATIVE',
  'SEGMENT_EMPTY',
  'TYPED_ARRAY_LENGTH_MISMATCH',
  'SAMPLE_TIMES_NOT_INCREASING',
  'SEGMENT_INDEX_MISMATCH',
  'SEGMENT_COUNT_MISMATCH',
  'SEGMENT_BOUNDARY_MISMATCH',
  'SEGMENT_TIME_SPAN_MISMATCH',
  'VELOCITY_INCREMENT_MISMATCH',
  'TYPED_ARRAY_BUFFER_NOT_OWNED',
  'DIAGNOSTIC_SEVERITY_MISMATCH',
  'RESULT_STATUS_INCONSISTENT',
] as const;

/**
 * Rejections that need physical constants or measured limits and are therefore emitted by
 * `packages/simulation`, not by this package. Reserved here so the registry is complete.
 */
export const SEMANTIC_VALIDATION_CODES = [
  'PERIGEE_BELOW_REFERENCE_RADIUS',
  'SAMPLE_COUNT_EXCEEDED',
] as const;

/** Conditions found while running a structurally and semantically valid request. */
export const RUNTIME_DIAGNOSTIC_CODES = [
  'PROPAGATOR_NOT_CONVERGED',
  'NON_FINITE_STATE',
  'ESCAPE_TRAJECTORY',
  'REFERENCE_SPHERE_INTERSECTION',
  'INTERNAL_ERROR',
] as const;

export const DIAGNOSTIC_CODES = [
  ...STRUCTURAL_VALIDATION_CODES,
  ...SEMANTIC_VALIDATION_CODES,
  ...RUNTIME_DIAGNOSTIC_CODES,
] as const;

export type StructuralValidationCode = (typeof STRUCTURAL_VALIDATION_CODES)[number];
export type SemanticValidationCode = (typeof SEMANTIC_VALIDATION_CODES)[number];
export type ValidationCode = StructuralValidationCode | SemanticValidationCode;
export type RuntimeDiagnosticCode = (typeof RUNTIME_DIAGNOSTIC_CODES)[number];
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

/** Severities of a diagnostic, in increasing order of gravity. */
export const DIAGNOSTIC_SEVERITIES = ['info', 'warning', 'error'] as const;
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

function allWithSeverity<const C extends string>(
  codes: readonly C[],
  severity: DiagnosticSeverity,
): Record<C, DiagnosticSeverity> {
  return Object.fromEntries(codes.map((code) => [code, severity])) as Record<C, DiagnosticSeverity>;
}

/**
 * The only severity a `Diagnostic` with a given code may carry (contracts-v1.md §8). A validation
 * code reported as a diagnostic is always an error. Enforced by `diagnosticSchema`.
 */
export const DIAGNOSTIC_CODE_SEVERITY: Readonly<Record<DiagnosticCode, DiagnosticSeverity>> =
  Object.freeze({
    ...allWithSeverity(STRUCTURAL_VALIDATION_CODES, 'error'),
    ...allWithSeverity(SEMANTIC_VALIDATION_CODES, 'error'),
    PROPAGATOR_NOT_CONVERGED: 'error',
    NON_FINITE_STATE: 'error',
    ESCAPE_TRAJECTORY: 'warning',
    REFERENCE_SPHERE_INTERSECTION: 'warning',
    INTERNAL_ERROR: 'error',
  });

const structuralCodeSet: ReadonlySet<string> = new Set(STRUCTURAL_VALIDATION_CODES);

export function isStructuralValidationCode(value: unknown): value is StructuralValidationCode {
  return typeof value === 'string' && structuralCodeSet.has(value);
}
