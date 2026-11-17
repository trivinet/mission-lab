/**
 * Example scenarios (ML-FR-013). Each preset is a scenario FILE in the ML-TASK-033 format (the
 * `*.scenario.json` next to this module, imported as text) and is loaded through
 * `parseScenarioBytes`, the same function that loads a user's file. Nothing here builds a
 * Scenario object by hand.
 *
 * PRODUCT CHOICES, NOT PHYSICAL REFERENCES. The values were chosen to show distinct behaviour;
 * no test compares them with a reference value, and no claim is made that they match a real
 * mission. The owner confirms them at review (ML-TASK-034 report). Units are SI, angles in rad.
 */
import eccentricBurnText from './eccentric-inclined-burn.scenario.json?raw';
import escapeBurnText from './escape-burn.scenario.json?raw';
import leoText from './near-circular-leo.scenario.json?raw';
import { parseScenarioBytes } from '../persistence/scenario-file';
import type { LoadResult } from '../persistence/scenario-file';

export interface Preset {
  readonly id: string;
  /** Menu label. */
  readonly label: string;
  /** One sentence on what the preset shows. */
  readonly summary: string;
  /** The file text, exactly as a user's file would be. */
  readonly fileText: string;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'near-circular-leo',
    label: 'Near-circular LEO',
    summary: 'a = 6900 km, e = 0.001, i = 50 deg, no maneuver; 6000 s.',
    fileText: leoText,
  },
  {
    id: 'eccentric-inclined-burn',
    label: 'Eccentric inclined orbit, along-track burn',
    summary: 'a = 24000 km, e = 0.6, i = 60 deg; +300 m/s along-track at t = 18000 s; 40000 s.',
    fileText: eccentricBurnText,
  },
  {
    id: 'escape-burn',
    label: 'Escape burn from LEO',
    summary: 'a = 6800 km, e = 0.001, i = 30 deg; +3500 m/s along-track at t = 600 s; 12000 s.',
    fileText: escapeBurnText,
  },
];

/** Validates a preset with the user-file path (parseScenarioBytes on the file's UTF-8 bytes). */
export function loadPreset(preset: Preset): LoadResult {
  return parseScenarioBytes(new TextEncoder().encode(preset.fileText));
}
