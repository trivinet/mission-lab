import { z } from 'zod';
import { epochSchema, finiteNumberSchema, rule, SCHEMA_VERSION, vec3Schema } from './primitives';
import { checkManeuverTiming, maneuverListSchema, samplingFields } from './scenario';

/** `sha256:` followed by 64 lowercase hexadecimal digits (contracts-v1.md §7). */
export const REQUEST_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;

export const requestIdSchema = z
  .string()
  .refine(
    (value) => REQUEST_ID_PATTERN.test(value),
    rule('REQUEST_ID_INVALID', 'requestId must be "sha256:" followed by 64 lowercase hex digits.'),
  );

export const muSchema = finiteNumberSchema.refine(
  (value) => value > 0,
  rule('MU_NOT_POSITIVE', 'mu_m3ps2 must be > 0.'),
);

/**
 * Physical constants of a run (contracts-v1.md §4, owner decision 1). Values come from
 * `packages/astrodynamics`; the contract fixes none. Copied unchanged into `result.model.constants`.
 */
export const physicalConstantsSchema = z.strictObject({
  mu_m3ps2: muSchema,
  referenceRadius_m: finiteNumberSchema.refine(
    (value) => value > 0,
    rule('REFERENCE_RADIUS_NOT_POSITIVE', 'referenceRadius_m must be > 0.'),
  ),
  source: z.string(),
});

/** Cartesian state in the request frame at the request epoch (t_s = 0). */
export const cartesianStateSchema = z.strictObject({
  position_m: vec3Schema,
  velocity_mps: vec3Schema,
});

/** What the engine receives: fully resolved, Cartesian, self-contained (contracts-v1.md §4). */
export const simulationRequestSchema = z
  .strictObject({
    requestId: requestIdSchema,
    schemaVersion: z.literal(SCHEMA_VERSION),
    centralBody: z.literal('EARTH'),
    constants: physicalConstantsSchema,
    dynamicsModel: z.literal('TWO_BODY'),
    frame: z.literal('GCRF'),
    epoch: epochSchema,
    initialState: cartesianStateSchema,
    maneuvers: maneuverListSchema,
    ...samplingFields,
  })
  .superRefine(checkManeuverTiming);

export type PhysicalConstants = z.infer<typeof physicalConstantsSchema>;
export type CartesianState = z.infer<typeof cartesianStateSchema>;
export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
