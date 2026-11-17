/**
 * ML-FR-002 AC2 (contracts-v1 OQ-1: "the editor normalises before building the scenario").
 *
 * Replaces Ω, ω and ν of the store's scenario by the engine's normalised angles
 * (`describeScenarioOrbit(...).view.normalizedAngles`, built on `normalizeAngle_rad`; the result is
 * in [0, 2 pi) rad). The UI does no angle arithmetic. If the orbit is otherwise invalid the engine
 * declines and nothing changes: the live field messages stay. An angle already in range is not
 * rewritten, so the result is not staled by a no-op.
 */
import type { KeplerianElements } from '@mission-lab/contracts';
import { ENGINE_CONSTANTS, describeScenarioOrbit } from '@mission-lab/simulation';
import type { ScenarioStore } from '../state/scenario-store';

export const ANGLE_KEYS = ['raan_rad', 'argPeriapsis_rad', 'trueAnomaly_rad'] as const;
export type AngleKey = (typeof ANGLE_KEYS)[number];

export function isAngleKey(key: keyof KeplerianElements): key is AngleKey {
  return (ANGLE_KEYS as readonly string[]).includes(key);
}

export function normaliseAngles(store: ScenarioStore): void {
  const { scenario, setElement } = store.getState();
  const elements = scenario.initialOrbit.elements;
  const described = describeScenarioOrbit(elements, ENGINE_CONSTANTS);
  if (!described.ok) {
    return;
  }
  const normalised = described.view.normalizedAngles;
  for (const key of ANGLE_KEYS) {
    if (!Object.is(normalised[key], elements[key])) {
      setElement(key, normalised[key]);
    }
  }
}
