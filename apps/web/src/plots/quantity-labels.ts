/** Names shown for the analysis module's quantities and absence reasons (text only, no values). */
import type {
  ComparisonQuantity,
  ComparisonValueAbsence,
  CompareFailure,
  ComputeHistoriesFailure,
  HistoryQuantity,
} from '@mission-lab/simulation';

export const HISTORY_LABELS: Readonly<Record<HistoryQuantity, string>> = {
  radius_m: 'Radius',
  altitude_m: 'Altitude above the reference sphere',
  speed_mps: 'Speed',
  trueAnomaly_rad: 'True anomaly',
  semiMajorAxis_m: 'Semi-major axis',
  eccentricity: 'Eccentricity',
  inclination_rad: 'Inclination',
  raan_rad: 'RAAN',
  argPeriapsis_rad: 'Argument of periapsis',
  specificEnergy_m2ps2: 'Specific orbital energy',
  periapsisRadius_m: 'Periapsis radius',
  apoapsisRadius_m: 'Apoapsis radius',
  period_s: 'Orbital period',
};

export const COMPARISON_LABELS: Readonly<Record<ComparisonQuantity, string>> = {
  semiMajorAxis_m: 'Semi-major axis',
  eccentricity: 'Eccentricity',
  inclination_rad: 'Inclination',
  raan_rad: 'RAAN',
  argPeriapsis_rad: 'Argument of periapsis',
  periapsisRadius_m: 'Periapsis radius',
  apoapsisRadius_m: 'Apoapsis radius',
  period_s: 'Orbital period',
  specificEnergy_m2ps2: 'Specific orbital energy',
};

/** Why a table value is absent, in plain words. */
export const ABSENCE_TEXT: Readonly<Record<ComparisonValueAbsence, string>> = {
  ELEMENTS_UNAVAILABLE: 'orbital elements are not defined for this state',
  NOT_CLOSED_ORBIT: 'the orbit is open (no apoapsis or period)',
  ENERGY_UNAVAILABLE: 'energy is not defined for this state',
  OPERAND_UNAVAILABLE: 'one of the two values is absent',
  NOT_COMPARABLE:
    'the angle has a different meaning before and after, so the difference is not defined',
};

export const COMPARE_FAILURE_TEXT: Readonly<Record<CompareFailure, string>> = {
  COAST_RESULT_FAILED: 'the coast run failed',
  MANEUVERED_RESULT_FAILED: 'the maneuvered run failed',
  COAST_HAS_MANEUVER: 'the coast run contains a maneuver',
  NO_MANEUVER: 'the result has no maneuver',
  SPAN_OR_MODEL_MISMATCH: 'the two runs differ in duration, epoch or model constants',
  INITIAL_STATE_MISMATCH: 'the two runs do not start from the same state',
  REQUEST_RESULT_MISMATCH: 'the request does not belong to the result',
  MANEUVER_NOT_IN_REQUEST: 'a maneuver of the result is not in the request',
  NON_FINITE_STATE: 'a state could not be evaluated',
};

export const HISTORIES_FAILURE_TEXT: Readonly<Record<ComputeHistoriesFailure, string>> = {
  RESULT_FAILED: 'the run failed, so there are no histories',
  NON_FINITE_SAMPLE: 'a sample could not be evaluated',
};
