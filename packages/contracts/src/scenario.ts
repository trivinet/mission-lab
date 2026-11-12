import { z } from 'zod';
import {
  epochSchema,
  finiteNumberSchema,
  idSchema,
  rule,
  SCHEMA_VERSION,
  vec3Schema,
} from './primitives';

/** M1 limit on the number of maneuvers (ML-FR-005 AC2, review finding F-04). */
export const M1_MAX_MANEUVERS = 1;

const TWO_PI = 2 * Math.PI;

const angleSchema = finiteNumberSchema.refine(
  (value) => value >= 0 && value < TWO_PI,
  rule('ANGLE_OUT_OF_RANGE', 'Angle must be normalised to [0, 2π) rad.'),
);

/** Classical elements in SI units. Angles in rad. Eccentricity is dimensionless. */
export const keplerianElementsSchema = z.strictObject({
  semiMajorAxis_m: finiteNumberSchema.refine(
    (value) => value > 0,
    rule('SEMI_MAJOR_AXIS_NOT_POSITIVE', 'Semi-major axis must be > 0 m.'),
  ),
  eccentricity: finiteNumberSchema.refine(
    (value) => value >= 0 && value < 1,
    rule('ECCENTRICITY_OUT_OF_RANGE', 'Eccentricity must be in [0, 1) for an M1 input orbit.'),
  ),
  inclination_rad: finiteNumberSchema.refine(
    (value) => value >= 0 && value <= Math.PI,
    rule('INCLINATION_OUT_OF_RANGE', 'Inclination must be in [0, π] rad.'),
  ),
  raan_rad: angleSchema,
  argPeriapsis_rad: angleSchema,
  trueAnomaly_rad: angleSchema,
});

/** Instantaneous velocity change expressed in the local RSW frame of the pre-maneuver state. */
export const impulsiveManeuverSchema = z.strictObject({
  id: idSchema,
  t_s: finiteNumberSchema.refine(
    (value) => value >= 0,
    rule('MANEUVER_TIME_OUT_OF_RANGE', 'Maneuver time must be in [0, duration_s].'),
  ),
  frame: z.literal('RSW'),
  /** [radial R, along-track S, cross-track W], m/s. */
  deltaV_mps: vec3Schema,
});

export const maneuverListSchema = z
  .array(impulsiveManeuverSchema)
  .refine(
    (list) => list.length <= M1_MAX_MANEUVERS,
    rule(
      'MANEUVER_COUNT_EXCEEDED',
      `At most ${String(M1_MAX_MANEUVERS)} maneuver is supported in this release (M1).`,
    ),
  );

const positiveDuration = finiteNumberSchema.refine(
  (value) => value > 0,
  rule('DURATION_NOT_POSITIVE', 'duration_s must be > 0.'),
);

const positiveOutputStep = finiteNumberSchema.refine(
  (value) => value > 0,
  rule('OUTPUT_STEP_NOT_POSITIVE', 'outputStep_s must be > 0.'),
);

export const samplingFields = {
  duration_s: positiveDuration,
  outputStep_s: positiveOutputStep,
};

interface ManeuverTimingInput {
  readonly maneuvers: readonly { readonly id: string; readonly t_s: number }[];
  readonly duration_s: number;
}

/** Cross-field rules shared by Scenario and SimulationRequest. */
export function checkManeuverTiming(value: ManeuverTimingInput, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  value.maneuvers.forEach((maneuver, index) => {
    if (maneuver.t_s > value.duration_s) {
      ctx.addIssue({
        code: 'custom',
        path: ['maneuvers', index, 't_s'],
        ...rule('MANEUVER_TIME_OUT_OF_RANGE', 'Maneuver time must be in [0, duration_s].'),
      });
    }
    if (seen.has(maneuver.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['maneuvers', index, 'id'],
        ...rule('ID_DUPLICATE', 'Maneuver identifiers must be unique.'),
      });
    }
    seen.add(maneuver.id);
  });
}

/** Editable definition; the persisted scenario file (contracts-v1.md §3). */
export const scenarioSchema = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: idSchema,
    name: z.string(),
    centralBody: z.literal('EARTH'),
    frame: z.literal('GCRF'),
    epoch: epochSchema,
    initialOrbit: z.strictObject({
      kind: z.literal('KEPLERIAN'),
      elements: keplerianElementsSchema,
    }),
    maneuvers: maneuverListSchema,
    ...samplingFields,
  })
  .superRefine(checkManeuverTiming);

export type KeplerianElements = z.infer<typeof keplerianElementsSchema>;
export type ImpulsiveManeuver = z.infer<typeof impulsiveManeuverSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
