/**
 * The coast request of a scenario (ML-TASK-031; ML-FR-010 AC1).
 *
 * The coast run is the same scenario with no maneuver, over the same span: same epoch, initial
 * orbit, duration_s and outputStep_s, `maneuvers: []`. It is built with `buildSimulationRequest`
 * like any request, so it has its own requestId, and the UI runs it through the worker like any
 * run. No physics here.
 */
import { validateScenario } from '@mission-lab/contracts';
import type { SimulationRequest, ValidationResult } from '@mission-lab/contracts';
import { buildSimulationRequest } from '../request';

/**
 * SimulationRequest of `input` with its maneuver list emptied.
 *
 * Steps: `validateScenario(input)` (issues returned unchanged, so an invalid scenario is reported
 * exactly as by `buildSimulationRequest`); then `buildSimulationRequest({ ...scenario,
 * maneuvers: [] })`. The input is not mutated. Never throws for JSON-like input.
 */
export function buildCoastRequest(input: unknown): ValidationResult<SimulationRequest> {
  const structural = validateScenario(input);
  if (!structural.ok) {
    return structural;
  }
  return buildSimulationRequest({ ...structural.value, maneuvers: [] });
}
