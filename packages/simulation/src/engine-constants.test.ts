import { EARTH_CONSTANTS } from '@mission-lab/astrodynamics';
import { describe, expect, it } from 'vitest';
import { ENGINE_CONSTANTS } from './engine-constants';
import { ENGINE_CONSTANTS as FROM_INDEX } from './index';
import { leoScenario, requestOf } from './test-fixtures';

describe('ENGINE_CONSTANTS', () => {
  it('is the astrodynamics EARTH_CONSTANTS object, frozen and exported from the index', () => {
    expect(ENGINE_CONSTANTS).toBe(EARTH_CONSTANTS);
    expect(FROM_INDEX).toBe(ENGINE_CONSTANTS);
    expect(Object.isFrozen(ENGINE_CONSTANTS)).toBe(true);
  });

  it('equals the constants that buildSimulationRequest puts into the request', () => {
    const request = requestOf(leoScenario());
    expect(request.constants).toStrictEqual({
      mu_m3ps2: ENGINE_CONSTANTS.mu_m3ps2,
      referenceRadius_m: ENGINE_CONSTANTS.referenceRadius_m,
      source: ENGINE_CONSTANTS.source,
    });
  });
});
