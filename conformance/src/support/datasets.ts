/**
 * Reads the committed reference datasets of test-data/reference-cases/ (ML-TASK-011). Test-side
 * helper only: it parses JSON and never computes or adjusts a reference value or a tolerance.
 * JSON.parse restores the exact binary64 values (datasets' `producedBy.numberFormat`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type V3 = readonly [number, number, number];

export interface StateJson {
  readonly position_m: V3;
  readonly velocity_mps: V3;
}

export interface ElementsJson {
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly raan_rad: number;
  readonly argPeriapsis_rad: number;
  readonly trueAnomaly_rad: number;
}

export interface ConstantsJson {
  readonly mu_m3ps2: number;
  readonly referenceRadius_m: number;
}

export interface Classification {
  readonly circular: boolean;
  readonly equatorial: boolean;
  readonly retrograde: boolean;
}

export interface ThresholdsJson {
  readonly epsilon_e: number;
  readonly epsilon_i: number;
}

export interface Vt02Dataset {
  readonly id: string;
  readonly gridCase: string;
  readonly inputs: { readonly constants: ConstantsJson; readonly elements: ElementsJson };
  readonly outputs: StateJson;
  readonly tolerance: { readonly position_m: number; readonly velocity_mps: number };
}

export interface ElementRowsJson {
  readonly eccentricity: number | null;
  readonly inclination_rad: number | null;
  readonly raan_rad: number | null;
  readonly argPeriapsis_rad: number | null;
  readonly trueAnomaly_rad: number | null;
}

export interface Vt03Dataset {
  readonly id: string;
  readonly gridCase: string;
  readonly inputs: { readonly constants: ConstantsJson; readonly state: StateJson };
  readonly method: { readonly convention: { readonly thresholds: ThresholdsJson } };
  readonly outputs: {
    readonly roundTripExpected: StateJson;
    readonly referenceElements: {
      readonly elementsRegular: ElementsJson;
      readonly elementView: ElementsJson;
      readonly classification: Classification;
    };
  };
  readonly tolerance: {
    readonly position_m: number;
    readonly velocity_mps: number;
    readonly elementRows: ElementRowsJson;
  };
}

export interface Vt04Dataset {
  readonly id: string;
  readonly kind: string;
  readonly inputs: {
    readonly constants: ConstantsJson;
    readonly elements: ElementsJson;
    readonly state: StateJson;
  };
  readonly method: { readonly convention: { readonly thresholds: ThresholdsJson } };
  readonly outputs: {
    readonly classification: Classification;
    readonly elementView: ElementsJson;
    readonly roundTripExpected: StateJson;
  };
  readonly tolerance: {
    readonly position_m: number;
    readonly velocity_mps: number;
    readonly eccentricity_abs: number;
    readonly inclination_abs_rad: number;
  };
}

export interface RequestJson {
  readonly constants: ConstantsJson;
  readonly initialState: StateJson;
  readonly duration_s: number;
  readonly outputStep_s: number;
}

export interface Vt05Dataset {
  readonly id: string;
  readonly gridCase: string;
  readonly inputs: { readonly request: RequestJson };
  readonly outputs: {
    readonly t_s: readonly number[];
    readonly l2a: { readonly position_m: readonly V3[]; readonly velocity_mps: readonly V3[] };
    readonly l2b: { readonly position_m: readonly V3[]; readonly velocity_mps: readonly V3[] };
  };
  readonly tolerance: {
    readonly vsL2a: {
      readonly position_m: readonly number[];
      readonly velocity_mps: readonly number[];
    };
    readonly vsL2b: {
      readonly position_m: readonly number[];
      readonly velocity_mps: readonly number[];
    };
  };
}

export interface Vt08Dataset {
  readonly id: string;
  readonly gridCase: string;
  readonly inputs: { readonly request: RequestJson; readonly periods: number };
  readonly outputs: { readonly finalExpected: StateJson };
  readonly tolerance: { readonly position_m: number; readonly velocity_mps: number };
}

const here = fileURLToPath(new URL('.', import.meta.url));

/** Absolute path of test-data/reference-cases/. */
export const REFERENCE_CASES_DIR = join(here, '..', '..', '..', 'test-data', 'reference-cases');

/** All datasets of one family directory (e.g. 'vt-05'), sorted by file name. */
export function loadFamily(family: string): { file: string; data: unknown }[] {
  const dir = join(REFERENCE_CASES_DIR, family);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      file: `${family}/${name}`,
      data: JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown,
    }));
}
