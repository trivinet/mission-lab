import { z } from 'zod';
import { DIAGNOSTIC_CODES } from './codes';
import { epochSchema, finiteNumberSchema, idSchema, rule, vec3Schema } from './primitives';
import { muSchema, requestIdSchema } from './request';
import { samplingFields } from './scenario';

const float64ArraySchema = z.instanceof(Float64Array);

/** Index of the first non-finite element, or -1. */
function firstNonFinite(values: Float64Array): number {
  return values.findIndex((value) => !Number.isFinite(value));
}

/**
 * Continuous arc between discontinuities, columnar. For N samples: `t_s` has N elements,
 * `position_m` and `velocity_mps` have 3N elements laid out [x0, y0, z0, x1, y1, z1, ...].
 */
export const trajectorySegmentSchema = z
  .strictObject({
    index: finiteNumberSchema,
    t_s: float64ArraySchema,
    position_m: float64ArraySchema,
    velocity_mps: float64ArraySchema,
  })
  .superRefine((segment, ctx) => {
    const sampleCount = segment.t_s.length;
    if (sampleCount === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['t_s'],
        ...rule('SEGMENT_EMPTY', 'A segment must contain at least one sample.'),
      });
    }
    for (const field of ['position_m', 'velocity_mps'] as const) {
      if (segment[field].length !== 3 * sampleCount) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          ...rule(
            'TYPED_ARRAY_LENGTH_MISMATCH',
            `${field} must have 3N elements where N = t_s.length = ${String(sampleCount)}.`,
          ),
        });
      }
    }
    for (const field of ['t_s', 'position_m', 'velocity_mps'] as const) {
      const at = firstNonFinite(segment[field]);
      if (at >= 0) {
        ctx.addIssue({
          code: 'custom',
          path: [field, at],
          ...rule('NON_FINITE_NUMBER', `${field} contains a non-finite value.`),
        });
      }
    }
    for (let k = 1; k < sampleCount; k += 1) {
      const previous = segment.t_s[k - 1];
      const current = segment.t_s[k];
      if (previous === undefined || current === undefined || !(current > previous)) {
        ctx.addIssue({
          code: 'custom',
          path: ['t_s', k],
          ...rule('SAMPLE_TIMES_NOT_INCREASING', 't_s must be strictly increasing in a segment.'),
        });
        break;
      }
    }
  });

/** Applied impulsive maneuver, expressed in the inertial frame of the result. */
export const maneuverEventSchema = z.strictObject({
  maneuverId: idSchema,
  t_s: finiteNumberSchema,
  position_m: vec3Schema,
  velocityBefore_mps: vec3Schema,
  velocityAfter_mps: vec3Schema,
  deltaV_inertial_mps: vec3Schema,
  deltaV_magnitude_mps: finiteNumberSchema.refine(
    (value) => value >= 0,
    rule('MAGNITUDE_NEGATIVE', 'deltaV_magnitude_mps must be >= 0.'),
  ),
});

export const diagnosticSeveritySchema = z.enum(['info', 'warning', 'error']);
export const diagnosticCodeSchema = z.enum(DIAGNOSTIC_CODES);

export const diagnosticSchema = z.strictObject({
  severity: diagnosticSeveritySchema,
  code: diagnosticCodeSchema,
  message: z.string(),
  t_s: finiteNumberSchema.optional(),
});

/** Semantic version core with optional pre-release and build metadata (semver.org 2.0.0). */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const resultModelSchema = z.strictObject({
  engineVersion: z
    .string()
    .refine(
      (value) => SEMVER_PATTERN.test(value),
      rule('ENGINE_VERSION_INVALID', 'engineVersion must be a semantic version.'),
    ),
  centralBody: z.literal('EARTH'),
  dynamicsModel: z.literal('TWO_BODY'),
  propagator: z.literal('KEPLER_UNIVERSAL_VARIABLE'),
  maneuverModel: z.literal('IMPULSIVE'),
  frame: z.literal('GCRF'),
  epoch: epochSchema,
  timeConvention: z.string(),
  sampling: z.strictObject(samplingFields),
  constants: z.strictObject({
    mu_m3ps2: muSchema,
    referenceRadius_m: finiteNumberSchema.refine(
      (value) => value > 0,
      rule('REFERENCE_RADIUS_NOT_POSITIVE', 'referenceRadius_m must be > 0.'),
    ),
    source: z.string(),
  }),
  limitations: z.array(z.string()),
});

/** Immutable output of one run, identified by `requestId` (contracts-v1.md §5). */
export const simulationResultSchema = z
  .strictObject({
    requestId: requestIdSchema,
    model: resultModelSchema,
    segments: z.array(trajectorySegmentSchema),
    events: z.array(maneuverEventSchema),
    diagnostics: z.array(diagnosticSchema),
    status: z.enum(['ok', 'failed']),
  })
  .superRefine((result, ctx) => {
    result.segments.forEach((segment, position) => {
      if (segment.index !== position) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', position, 'index'],
          ...rule('SEGMENT_INDEX_MISMATCH', 'segments[n].index must equal n.'),
        });
      }
    });

    const hasError = result.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
    if (result.status === 'failed') {
      if (!hasError || result.segments.length > 0 || result.events.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          ...rule(
            'RESULT_STATUS_INCONSISTENT',
            'A failed result has at least one error diagnostic and no segments or events.',
          ),
        });
      }
      return;
    }

    if (hasError) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        ...rule('RESULT_STATUS_INCONSISTENT', 'An ok result has no error diagnostic.'),
      });
    }
    if (result.segments.length !== result.events.length + 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments'],
        ...rule('SEGMENT_COUNT_MISMATCH', 'An ok result with k events has k + 1 segments.'),
      });
      return;
    }
    result.events.forEach((event, n) => {
      const before = result.segments[n]?.t_s;
      const after = result.segments[n + 1]?.t_s;
      const lastBefore = before?.[before.length - 1];
      const firstAfter = after?.[0];
      if (lastBefore !== event.t_s || firstAfter !== event.t_s) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', n, 't_s'],
          ...rule(
            'SEGMENT_BOUNDARY_MISMATCH',
            'events[n].t_s must equal the last t_s of segment n and the first t_s of segment n + 1.',
          ),
        });
      }
    });
  });

export type TrajectorySegment = z.infer<typeof trajectorySegmentSchema>;
export type ManeuverEvent = z.infer<typeof maneuverEventSchema>;
export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type ResultModel = z.infer<typeof resultModelSchema>;
export type SimulationResult = z.infer<typeof simulationResultSchema>;
