import { PROVISIONAL_MAX_SAMPLE_COUNT } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import {
  SOFT_SAMPLE_WARNING_THRESHOLD,
  scenarioSampleCount,
  softWarningCount,
  softWarningText,
} from './sample-warning';

describe('soft sample warning (owner decision 2026-11-17)', () => {
  it('uses the 250 000 threshold', () => {
    expect(SOFT_SAMPLE_WARNING_THRESHOLD).toBe(250_000);
  });

  it('is absent for the default scenario (101 samples)', () => {
    const scenario = newScenario();
    expect(scenarioSampleCount(scenario)).toBe(101);
    expect(softWarningCount(scenario)).toBeNull();
  });

  it('shows for 30 days at 10 s (259 201 samples, the engine count)', () => {
    const scenario = { ...newScenario(), duration_s: 30 * 86_400, outputStep_s: 10 };
    expect(softWarningCount(scenario)).toBe(259_201);
    expect(softWarningText(259_201)).toContain('259 201');
    expect(softWarningText(259_201)).toContain('performance-envelope.md');
  });

  it('is absent exactly at the threshold and shown one sample above', () => {
    const at = { ...newScenario(), duration_s: 249_999, outputStep_s: 1 };
    expect(scenarioSampleCount(at)).toBe(250_000);
    expect(softWarningCount(at)).toBeNull();
    const above = { ...newScenario(), duration_s: 250_000, outputStep_s: 1 };
    expect(softWarningCount(above)).toBe(250_001);
  });

  it('is absent above the engine limit, where the run is refused (D-2), and shown at the limit', () => {
    const atLimit = { ...newScenario(), duration_s: 999_999, outputStep_s: 1 };
    expect(scenarioSampleCount(atLimit)).toBe(PROVISIONAL_MAX_SAMPLE_COUNT);
    expect(softWarningCount(atLimit)).toBe(1_000_000);
    const over = { ...newScenario(), duration_s: 1_000_000, outputStep_s: 1 };
    expect(scenarioSampleCount(over)).toBe(1_000_001);
    expect(softWarningCount(over)).toBeNull();
  });

  it('is absent while the inputs are unusable (no count to show)', () => {
    expect(softWarningCount({ ...newScenario(), outputStep_s: 0 })).toBeNull();
    expect(softWarningCount({ ...newScenario(), duration_s: Number.NaN })).toBeNull();
  });
});
