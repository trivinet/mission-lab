import { describe, expect, it } from 'vitest';
import { buildSimulationRequest } from '../request';
import { leoScenario, maneuver } from '../test-fixtures';
import { buildCoastRequest } from './coast-request';

describe('buildCoastRequest', () => {
  it('is buildSimulationRequest of the scenario with no maneuver (same span and state)', () => {
    const scenario = leoScenario({ maneuvers: [maneuver(1000, [0, 50, 0])] });
    const before: unknown = JSON.parse(JSON.stringify(scenario));
    const coast = buildCoastRequest(scenario);
    const own = buildSimulationRequest(scenario);
    const expected = buildSimulationRequest({ ...scenario, maneuvers: [] });
    if (!coast.ok || !own.ok || !expected.ok) {
      throw new Error('rejected');
    }
    expect(coast.value).toEqual(expected.value);
    expect(coast.value.maneuvers).toEqual([]);
    expect(coast.value.duration_s).toBe(own.value.duration_s);
    expect(coast.value.outputStep_s).toBe(own.value.outputStep_s);
    expect(coast.value.epoch).toEqual(own.value.epoch);
    expect(coast.value.initialState).toEqual(own.value.initialState);
    expect(coast.value.requestId).not.toBe(own.value.requestId);
    expect(scenario).toEqual(before);
  });

  it('a scenario without maneuver gives its own request', () => {
    const scenario = leoScenario();
    expect(buildCoastRequest(scenario)).toEqual(buildSimulationRequest(scenario));
  });

  it('an invalid scenario returns the same issues as buildSimulationRequest', () => {
    for (const input of [
      null,
      42,
      { ...leoScenario(), duration_s: -1 },
      { schemaVersion: '9.9' },
    ]) {
      const coast = buildCoastRequest(input);
      expect(coast.ok).toBe(false);
      expect(coast).toEqual(buildSimulationRequest(input));
    }
  });
});
