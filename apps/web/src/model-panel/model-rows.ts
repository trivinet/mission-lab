/**
 * Rows of the model panel (ML-FR-012 AC1). Every value is read from `SimulationResult.model`;
 * the labels and units are UI wording. Numbers are shown in their SI unit as `String(value)`:
 * no conversion, no rounding (display only).
 */
import type { ResultModel } from '@mission-lab/contracts';

export interface ModelRow {
  readonly id: string;
  readonly label: string;
  /** The value exactly as the result states it (or its SI number as text). */
  readonly value: string;
  /** Display unit of a numeric value; empty for text values. */
  readonly unit: string;
}

export function modelRows(model: ResultModel): readonly ModelRow[] {
  return [
    { id: 'dynamics', label: 'Dynamics model', value: model.dynamicsModel, unit: '' },
    { id: 'central-body', label: 'Central body', value: model.centralBody, unit: '' },
    {
      id: 'mu',
      label: 'Gravitational parameter',
      value: String(model.constants.mu_m3ps2),
      unit: 'm³/s²',
    },
    {
      id: 'radius',
      label: 'Reference radius',
      value: String(model.constants.referenceRadius_m),
      unit: 'm',
    },
    { id: 'constants-source', label: 'Constants source', value: model.constants.source, unit: '' },
    { id: 'propagator', label: 'Propagator', value: model.propagator, unit: '' },
    { id: 'maneuver-model', label: 'Maneuver model', value: model.maneuverModel, unit: '' },
    { id: 'frame', label: 'Frame', value: model.frame, unit: '' },
    { id: 'epoch', label: `Epoch (${model.epoch.scale})`, value: model.epoch.iso, unit: '' },
    { id: 'time-convention', label: 'Time convention', value: model.timeConvention, unit: '' },
    { id: 'engine-version', label: 'Engine version', value: model.engineVersion, unit: '' },
    { id: 'duration', label: 'Duration', value: String(model.sampling.duration_s), unit: 's' },
    {
      id: 'output-step',
      label: 'Output step',
      value: String(model.sampling.outputStep_s),
      unit: 's',
    },
  ];
}
