import { validateScenario } from '@mission-lab/contracts';
import {
  buildSimulationRequest,
  runSimulation,
  validateScenarioSemantics,
} from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO_VALUES, newScenario } from './default-scenario';

describe('newScenario', () => {
  it('passes the contracts validation and the engine semantic validation', () => {
    const scenario = newScenario();
    const structural = validateScenario(scenario);
    expect(structural.ok).toBe(true);
    expect(validateScenarioSemantics(scenario)).toEqual([]);
  });

  it('runs successfully through the real runSimulation (ML-FR-001 AC1)', () => {
    const built = buildSimulationRequest(newScenario());
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const outcome = runSimulation(built.value);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.status).toBe('ok');
    expect(outcome.value.diagnostics).toEqual([]);
    expect(outcome.value.requestId).toBe(built.value.requestId);
    const samples = outcome.value.segments.reduce((n, s) => n + s.t_s.length, 0);
    expect(samples).toBe(
      DEFAULT_SCENARIO_VALUES.duration_s / DEFAULT_SCENARIO_VALUES.outputStep_s + 1,
    );
  });

  it('puts the default orbit above the engine reference radius (not a physical reference)', () => {
    const built = buildSimulationRequest(newScenario());
    if (!built.ok) {
      throw new Error('default scenario rejected');
    }
    const periapsisRadius_m =
      DEFAULT_SCENARIO_VALUES.semiMajorAxis_m * (1 - DEFAULT_SCENARIO_VALUES.eccentricity);
    expect(periapsisRadius_m).toBeGreaterThan(built.value.constants.referenceRadius_m);
  });

  it('gives every new scenario its own identifier', () => {
    expect(newScenario().id).not.toBe(newScenario().id);
  });
});
