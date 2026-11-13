/**
 * Semantic validation of a structurally valid Scenario (contracts-v1 §3 "Semantic rules", §6,
 * §8.2; owner decision 3 of 2026-11-11). Runs before a request is built; a rejection produces no
 * SimulationRequest and no SimulationResult.
 */
import { EARTH_CONSTANTS } from '@mission-lab/astrodynamics';
import type { Scenario, ValidationIssue } from '@mission-lab/contracts';
import { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
import { sampleCount } from './sampling-grid';

/**
 * Semantic issues of a scenario that passed `validateScenario`.
 *
 * Rules, in schema field order (contracts-v1 §3 table):
 * - `PERIGEE_BELOW_REFERENCE_RADIUS` at `["initialOrbit", "elements"]` unless the perigee radius
 *   r_p = a · (1 − e) [m] (evaluated as written: one subtraction, one multiplication, binary64) is
 *   strictly greater than the reference radius of the engine constants (EARTH_CONSTANTS,
 *   referenceRadius_m [m]; ML-FR-002 AC2 "not above"). The computed value decides; no rounding
 *   band (VT-18 uses inputs whose evaluation is exact).
 * - `SAMPLE_COUNT_EXCEEDED` at `["outputStep_s"]` if the §5.2 sample count (sampleCount) exceeds
 *   PROVISIONAL_MAX_SAMPLE_COUNT (a placeholder pending ML-NFR-004, see limits.ts).
 *
 * @param scenario A structurally valid Scenario (precondition, not re-checked).
 * @returns The issues (possibly empty), never throws for such input.
 */
export function validateScenarioSemantics(scenario: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { semiMajorAxis_m, eccentricity } = scenario.initialOrbit.elements;
  const perigeeRadius_m = semiMajorAxis_m * (1 - eccentricity);
  if (!(perigeeRadius_m > EARTH_CONSTANTS.referenceRadius_m)) {
    issues.push({
      code: 'PERIGEE_BELOW_REFERENCE_RADIUS',
      path: ['initialOrbit', 'elements'],
      message: `Perigee radius a(1 - e) = ${String(perigeeRadius_m)} m is not above the reference radius ${String(EARTH_CONSTANTS.referenceRadius_m)} m.`,
    });
  }
  const count = sampleCount(
    scenario.duration_s,
    scenario.outputStep_s,
    scenario.maneuvers.map((m) => m.t_s),
  );
  if (count > PROVISIONAL_MAX_SAMPLE_COUNT) {
    issues.push({
      code: 'SAMPLE_COUNT_EXCEEDED',
      path: ['outputStep_s'],
      message: `The run would produce ${String(count)} samples; the limit is ${String(PROVISIONAL_MAX_SAMPLE_COUNT)}.`,
    });
  }
  return issues;
}
