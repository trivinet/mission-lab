import { z } from 'zod';
import { DIAGNOSTIC_CODE_SEVERITY, DIAGNOSTIC_CODES, DIAGNOSTIC_SEVERITIES } from './codes';
import { epochSchema, finiteNumberSchema, idSchema, rule, vec3Schema } from './primitives';
import { physicalConstantsSchema, requestIdSchema } from './request';
import { samplingFields } from './scenario';

const float64ArraySchema = z.instanceof(Float64Array);

const SEGMENT_ARRAYS = ['t_s', 'position_m', 'velocity_mps'] as const;

/** Index of the first non-finite element, or -1. */
function firstNonFinite(values: Float64Array): number {
  return values.findIndex((value) => !Number.isFinite(value));
}

/**
 * True when the view is the whole of its own, transferable ArrayBuffer (contracts-v1.md §5.2,
 * owner decision 7). Distinctness across arrays is checked at result level.
 */
function ownsWholeBuffer(values: Float64Array): boolean {
  return (
    values.buffer instanceof ArrayBuffer &&
    values.byteOffset === 0 &&
    values.buffer.byteLength === values.byteLength
  );
}

interface SegmentArrays {
  readonly t_s: Float64Array;
  readonly position_m: Float64Array;
  readonly velocity_mps: Float64Array;
}

/** R2, R3 and R5 hold: the cross-segment invariants can be evaluated on this segment. */
function isWellFormed(segment: SegmentArrays): boolean {
  const sampleCount = segment.t_s.length;
  return (
    sampleCount > 0 &&
    segment.position_m.length === 3 * sampleCount &&
    segment.velocity_mps.length === 3 * sampleCount &&
    SEGMENT_ARRAYS.every((field) => firstNonFinite(segment[field]) < 0)
  );
}

/** Element `at` of a typed array known to be long enough (well-formed segment). */
function element(values: Float64Array, at: number): number {
  return values[at] ?? Number.NaN;
}

/** True when the three components starting at `offset` are bit-identical to `vector`. */
function sameVector(values: Float64Array, offset: number, vector: readonly number[]): boolean {
  return [0, 1, 2].every((i) => Object.is(element(values, offset + i), vector[i]));
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
    for (const field of SEGMENT_ARRAYS) {
      if (!ownsWholeBuffer(segment[field])) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          ...rule(
            'TYPED_ARRAY_BUFFER_NOT_OWNED',
            `${field} must be the whole of its own ArrayBuffer (byteOffset 0, same byteLength).`,
          ),
        });
      }
    }
    let timesFinite = true;
    for (const field of SEGMENT_ARRAYS) {
      const at = firstNonFinite(segment[field]);
      if (at >= 0) {
        timesFinite = timesFinite && field !== 't_s';
        ctx.addIssue({
          code: 'custom',
          path: [field, at],
          ...rule('NON_FINITE_NUMBER', `${field} contains a non-finite value.`),
        });
      }
    }
    if (!timesFinite) {
      return;
    }
    for (let k = 1; k < sampleCount; k += 1) {
      if (!(element(segment.t_s, k) > element(segment.t_s, k - 1))) {
        ctx.addIssue({
          code: 'custom',
          path: ['t_s', k],
          ...rule('SAMPLE_TIMES_NOT_INCREASING', 't_s must be strictly increasing in a segment.'),
        });
        break;
      }
    }
  });

/**
 * Applied impulsive maneuver, expressed in the inertial frame of the result.
 * `velocityAfter_mps[i]` is the binary64 sum `velocityBefore_mps[i] + deltaV_inertial_mps[i]`
 * (one rounding, bit-exact). `deltaV_magnitude_mps` is the Euclidean norm of
 * `deltaV_inertial_mps`; its exactness is not checked here (VT-13).
 */
export const maneuverEventSchema = z
  .strictObject({
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
  })
  .superRefine((event, ctx) => {
    for (const i of [0, 1, 2] as const) {
      const sum = event.velocityBefore_mps[i] + event.deltaV_inertial_mps[i];
      if (!Object.is(event.velocityAfter_mps[i], sum)) {
        ctx.addIssue({
          code: 'custom',
          path: ['velocityAfter_mps', i],
          ...rule(
            'VELOCITY_INCREMENT_MISMATCH',
            'velocityAfter_mps[i] must equal velocityBefore_mps[i] + deltaV_inertial_mps[i].',
          ),
        });
      }
    }
  });

export const diagnosticSeveritySchema = z.enum(DIAGNOSTIC_SEVERITIES);
export const diagnosticCodeSchema = z.enum(DIAGNOSTIC_CODES);

/** `message` is for logs; user interfaces map `code` (and the time `t_s`) to their own text. */
export const diagnosticSchema = z
  .strictObject({
    severity: diagnosticSeveritySchema,
    code: diagnosticCodeSchema,
    message: z.string(),
    t_s: finiteNumberSchema.optional(),
  })
  .superRefine((diagnostic, ctx) => {
    if (diagnostic.severity !== DIAGNOSTIC_CODE_SEVERITY[diagnostic.code]) {
      ctx.addIssue({
        code: 'custom',
        path: ['severity'],
        ...rule(
          'DIAGNOSTIC_SEVERITY_MISMATCH',
          `Code ${diagnostic.code} has severity "${DIAGNOSTIC_CODE_SEVERITY[diagnostic.code]}".`,
        ),
      });
    }
  });

/**
 * Semantic Versioning 2.0.0, the regular expression suggested by semver.org (FAQ, "Is there a
 * suggested regular expression"), with its capture groups made non-capturing. Checked against
 * https://semver.org/spec/v2.0.0.html on 2026-11-11.
 */
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?:[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const resultModelSchema = z.strictObject({
  engineVersion: z
    .string()
    .refine(
      (value) => SEMVER_PATTERN.test(value),
      rule('ENGINE_VERSION_INVALID', 'engineVersion must be a Semantic Versioning 2.0.0 string.'),
    ),
  centralBody: z.literal('EARTH'),
  dynamicsModel: z.literal('TWO_BODY'),
  propagator: z.literal('KEPLER_UNIVERSAL_VARIABLE'),
  maneuverModel: z.literal('IMPULSIVE'),
  frame: z.literal('GCRF'),
  epoch: epochSchema,
  timeConvention: z.string(),
  sampling: z.strictObject(samplingFields),
  constants: physicalConstantsSchema,
  limitations: z.array(z.string()),
});

/** Output of one run, identified by `requestId`; must not be mutated (contracts-v1.md §5). */
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
    const seenBuffers = new Set<ArrayBufferLike>();
    result.segments.forEach((segment, position) => {
      if (segment.index !== position) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', position, 'index'],
          ...rule('SEGMENT_INDEX_MISMATCH', 'segments[n].index must equal n.'),
        });
      }
      for (const field of SEGMENT_ARRAYS) {
        const buffer = segment[field].buffer;
        if (seenBuffers.has(buffer)) {
          ctx.addIssue({
            code: 'custom',
            path: ['segments', position, field],
            ...rule(
              'TYPED_ARRAY_BUFFER_NOT_OWNED',
              `${field} shares its ArrayBuffer with another array of the result.`,
            ),
          });
        }
        seenBuffers.add(buffer);
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
    // R8 and R10 read sample values; they run only when every segment satisfies R2, R3 and R5.
    if (!result.segments.every(isWellFormed)) {
      return;
    }

    result.events.forEach((event, n) => {
      const before = result.segments[n];
      const after = result.segments[n + 1];
      if (before === undefined || after === undefined) {
        return;
      }
      const last = before.t_s.length - 1;
      const boundaryChecks: [boolean, string, string][] = [
        [
          Object.is(element(before.t_s, last), event.t_s) &&
            Object.is(element(after.t_s, 0), event.t_s),
          't_s',
          'events[n].t_s must equal the last t_s of segment n and the first t_s of segment n + 1.',
        ],
        [
          sameVector(before.position_m, 3 * last, event.position_m) &&
            sameVector(after.position_m, 0, event.position_m),
          'position_m',
          'events[n].position_m must equal the last position of segment n and the first of n + 1.',
        ],
        [
          sameVector(before.velocity_mps, 3 * last, event.velocityBefore_mps),
          'velocityBefore_mps',
          'events[n].velocityBefore_mps must equal the last velocity of segment n.',
        ],
        [
          sameVector(after.velocity_mps, 0, event.velocityAfter_mps),
          'velocityAfter_mps',
          'events[n].velocityAfter_mps must equal the first velocity of segment n + 1.',
        ],
      ];
      for (const [holds, field, message] of boundaryChecks) {
        if (!holds) {
          ctx.addIssue({
            code: 'custom',
            path: ['events', n, field],
            ...rule('SEGMENT_BOUNDARY_MISMATCH', message),
          });
        }
      }
    });

    const duration = result.model.sampling.duration_s;
    const first = result.segments[0];
    const lastIndex = result.segments.length - 1;
    const final = result.segments[lastIndex];
    if (first !== undefined && element(first.t_s, 0) !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments', 0, 't_s', 0],
        ...rule('SEGMENT_TIME_SPAN_MISMATCH', 'The first sample time of an ok result must be 0.'),
      });
    }
    if (final !== undefined && !Object.is(element(final.t_s, final.t_s.length - 1), duration)) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments', lastIndex, 't_s', final.t_s.length - 1],
        ...rule(
          'SEGMENT_TIME_SPAN_MISMATCH',
          'The last sample time of an ok result must equal model.sampling.duration_s.',
        ),
      });
    }
    result.events.forEach((event, n) => {
      if (!(event.t_s >= 0 && event.t_s <= duration)) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', n, 't_s'],
          ...rule('MANEUVER_TIME_OUT_OF_RANGE', 'Event time must be in [0, duration_s].'),
        });
      }
    });
  });

export type TrajectorySegment = z.infer<typeof trajectorySegmentSchema>;
export type ManeuverEvent = z.infer<typeof maneuverEventSchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type ResultModel = z.infer<typeof resultModelSchema>;
export type SimulationResult = z.infer<typeof simulationResultSchema>;
