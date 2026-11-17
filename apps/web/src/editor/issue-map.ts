/**
 * Maps engine validation issues (contract path) to editor fields. Codes and messages come from the
 * engine's validation; nothing is re-implemented here (ML-FR-002 AC2).
 */
import type { ValidationIssue } from '@mission-lab/contracts';

/** Field keys of the editor, equal to the dotted contract path of the field. */
export const FIELD = {
  epoch: 'epoch.iso',
  duration: 'duration_s',
  outputStep: 'outputStep_s',
  semiMajorAxis: 'initialOrbit.elements.semiMajorAxis_m',
  eccentricity: 'initialOrbit.elements.eccentricity',
  inclination: 'initialOrbit.elements.inclination_rad',
  raan: 'initialOrbit.elements.raan_rad',
  argPeriapsis: 'initialOrbit.elements.argPeriapsis_rad',
  trueAnomaly: 'initialOrbit.elements.trueAnomaly_rad',
  /** Issues about the element set as a whole (the perigee rule). */
  orbit: 'initialOrbit.elements',
  /** Issues about the maneuver list as a whole (the M1 one-maneuver limit). */
  maneuverList: 'maneuvers',
} as const;

export function maneuverTimeKey(index: number): string {
  return `maneuvers.${String(index)}.t_s`;
}

export function maneuverDeltaVKey(index: number, component: 0 | 1 | 2): string {
  return `maneuvers.${String(index)}.deltaV_mps.${String(component)}`;
}

/** The field key an issue belongs to. */
export function fieldKeyOf(issue: ValidationIssue): string {
  return issue.path.join('.');
}

/**
 * The issues shown at one field. An issue at a maneuver's whole Δv vector (path ends at
 * `deltaV_mps`) is shown at each of its three components.
 */
export function issuesForField(
  issues: readonly ValidationIssue[],
  key: string,
): readonly ValidationIssue[] {
  const vectorKey = key.replace(/\.[012]$/, '');
  return issues.filter((issue) => {
    const k = fieldKeyOf(issue);
    return k === key || (vectorKey !== key && k === vectorKey);
  });
}
