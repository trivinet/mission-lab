/**
 * Scenario → SimulationRequest, and the requestId (contracts-v1 §4, §7).
 */
import { EARTH_CONSTANTS, elementsToState } from '@mission-lab/astrodynamics';
import {
  canonicalRequestPayload,
  validateScenario,
  validateSimulationRequest,
} from '@mission-lab/contracts';
import type {
  Scenario,
  SimulationRequest,
  ValidationIssue,
  ValidationResult,
} from '@mission-lab/contracts';
import { validateScenarioSemantics } from './semantic-validation';
import { sha256HexOfUtf8 } from './sha256';

/**
 * requestId = "sha256:" + lowercase hex SHA-256 of the UTF-8 canonical payload (contracts-v1
 * §7.1–§7.3). The payload is `canonicalRequestPayload` of `@mission-lab/contracts` (every field
 * except `requestId`); the hash is the in-repo FIPS 180-4 implementation (sha256.ts).
 *
 * Precondition (contracts-v1 §7.2): the fields, other than `requestId`, pass
 * `validateSimulationRequest`; in particular every number is finite (otherwise
 * canonicalRequestPayload throws a TypeError).
 */
export function computeRequestId(request: Omit<SimulationRequest, 'requestId'>): string {
  return `sha256:${sha256HexOfUtf8(canonicalRequestPayload(request))}`;
}

/**
 * Replaces every −0 by +0 in a JSON-like value (numbers inside plain objects and arrays, at any
 * depth); every other value is returned unchanged (deep copy of objects and arrays). Contracts-v1
 * §11.4 P3 (owner decision 2026-11-13, resolves NQ-1): the scenario→request builder normalises −0
 * to +0 in every numeric field, so equivalent scenarios have the same requestId.
 *
 * `x === 0` is true for both zeros, so the result is +0 exactly for ±0 and x itself otherwise
 * (NaN and ±Infinity pass through unchanged; they cannot occur in validated data).
 */
export function normalizeNegativeZero<T>(value: T): T {
  return normalizeValue(value) as T;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'number') {
    return value === 0 ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }
  return value;
}

/**
 * Builds the SimulationRequest of a scenario (contracts-v1 §4), after structural (§6) and
 * semantic (§3) validation.
 *
 * Steps:
 * 1. `validateScenario(input)`; issues are returned unchanged.
 * 2. `validateScenarioSemantics(scenario)`; issues are returned unchanged.
 * 3. −0 → +0 on the validated scenario, every numeric field (normalizeNegativeZero; §11.4 P3).
 *    Done BEFORE the conversion so that elementsToState never sees −0: two scenarios that differ
 *    only in the sign of a zero then take the same arithmetic path, not merely paths whose
 *    results differ only in signs of zero.
 * 4. initialState = elementsToState(elements, EARTH_CONSTANTS.mu_m3ps2) (packages/astrodynamics;
 *    regular map, contracts-v1 §3 owner decision 4). The angles refer to the scenario frame
 *    (GCRF); the state is in GCRF, m and m/s.
 * 5. constants = { mu_m3ps2, referenceRadius_m, source } copied from EARTH_CONSTANTS.
 * 6. epoch, maneuvers (deep copies, same order), duration_s, outputStep_s copied.
 * 7. −0 → +0 again on every numeric field of the assembled request (normalizeNegativeZero). This
 *    is what guarantees that the request never contains −0: the conversion can produce −0 from
 *    +0 inputs (e.g. a product with a negative factor and an exact zero sine), and step 3 cannot
 *    prevent that. Normalising only here would also give equal requests; step 3 is kept so the
 *    conversion itself is the same for equivalent scenarios.
 *    Validation is unaffected: −0 and +0 pass and fail the same `≥ 0` / `> 0` rules.
 *    Consequence (contracts-v1 §5.2 rev. 3): segment 0 starts with a bit-identical copy of
 *    request.initialState, which is therefore free of −0 as well.
 * 8. requestId = computeRequestId(...).
 * 9. Self-check: the request is passed through `validateSimulationRequest`.
 *
 * Failure not foreseen by the contract: if elementsToState fails (only possible through overflow
 * for an extreme but structurally valid a), the result is one issue `NON_FINITE_NUMBER` at
 * `["initialOrbit", "elements"]` (the derived Cartesian state would not be finite). Reported for
 * owner decision.
 *
 * @param input Any value (typically the parsed scenario file or the editor's scenario).
 * @returns The request, or the issues. Never throws for JSON-like input (contracts-v1 §6).
 */
export function buildSimulationRequest(input: unknown): ValidationResult<SimulationRequest> {
  const structural = validateScenario(input);
  if (!structural.ok) {
    return structural;
  }
  const semantic = validateScenarioSemantics(structural.value);
  if (semantic.length > 0) {
    return { ok: false, issues: semantic };
  }
  const scenario: Scenario = normalizeNegativeZero(structural.value);
  const state = elementsToState(scenario.initialOrbit.elements, EARTH_CONSTANTS.mu_m3ps2);
  if (!state.ok) {
    const issue: ValidationIssue = {
      code: 'NON_FINITE_NUMBER',
      path: ['initialOrbit', 'elements'],
      message: `The Cartesian state of these elements cannot be computed (${state.reason}).`,
    };
    return { ok: false, issues: [issue] };
  }
  const { position_m, velocity_mps } = state.state;
  const withoutId: Omit<SimulationRequest, 'requestId'> = normalizeNegativeZero({
    schemaVersion: scenario.schemaVersion,
    centralBody: scenario.centralBody,
    constants: {
      mu_m3ps2: EARTH_CONSTANTS.mu_m3ps2,
      referenceRadius_m: EARTH_CONSTANTS.referenceRadius_m,
      source: EARTH_CONSTANTS.source,
    },
    dynamicsModel: 'TWO_BODY',
    frame: scenario.frame,
    epoch: { scale: scenario.epoch.scale, iso: scenario.epoch.iso },
    initialState: {
      position_m: [position_m[0], position_m[1], position_m[2]],
      velocity_mps: [velocity_mps[0], velocity_mps[1], velocity_mps[2]],
    },
    maneuvers: scenario.maneuvers.map((m) => ({
      id: m.id,
      t_s: m.t_s,
      frame: m.frame,
      deltaV_mps: [m.deltaV_mps[0], m.deltaV_mps[1], m.deltaV_mps[2]],
    })),
    duration_s: scenario.duration_s,
    outputStep_s: scenario.outputStep_s,
  });
  const request: SimulationRequest = { requestId: computeRequestId(withoutId), ...withoutId };
  return validateSimulationRequest(request);
}

/**
 * The requestId of the current scenario, for the staleness test of contracts-v1 §7.4: a displayed
 * result is stale exactly when its requestId differs from this value. Same steps and outcomes as
 * buildSimulationRequest (element→Cartesian conversion, engine constants, hash), so the UI
 * computes no physics.
 */
export function deriveRequestId(input: unknown): ValidationResult<string> {
  const built = buildSimulationRequest(input);
  return built.ok ? { ok: true, value: built.value.requestId } : built;
}
