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
 * Builds the SimulationRequest of a scenario (contracts-v1 §4), after structural (§6) and
 * semantic (§3) validation.
 *
 * Steps:
 * 1. `validateScenario(input)`; issues are returned unchanged.
 * 2. `validateScenarioSemantics(scenario)`; issues are returned unchanged.
 * 3. initialState = elementsToState(elements, EARTH_CONSTANTS.mu_m3ps2) (packages/astrodynamics;
 *    regular map, contracts-v1 §3 owner decision 4). The angles refer to the scenario frame
 *    (GCRF); the state is in GCRF, m and m/s.
 * 4. constants = { mu_m3ps2, referenceRadius_m, source } copied from EARTH_CONSTANTS.
 * 5. epoch, maneuvers (deep copies, same order), duration_s, outputStep_s copied unchanged. No
 *    value is transformed: in particular −0 is NOT mapped to +0 (contracts-v1 §12 NQ-1 is an open
 *    owner question; see the ML-TASK-017 report).
 * 6. requestId = computeRequestId(...).
 * 7. Self-check: the request is passed through `validateSimulationRequest`.
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
  const scenario: Scenario = structural.value;
  const semantic = validateScenarioSemantics(scenario);
  if (semantic.length > 0) {
    return { ok: false, issues: semantic };
  }
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
  const withoutId: Omit<SimulationRequest, 'requestId'> = {
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
  };
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
