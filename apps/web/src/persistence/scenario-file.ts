/**
 * The scenario file (ML-FR-011): serialisation and validated parsing. Pure: no store and no
 * browser API.
 *
 * FORMAT (schemaVersion "1.0"): exactly one contracts `Scenario` object as UTF-8 JSON.
 * - Key order is fixed, the order of the contract's schema (contracts-v1 §3), at every level.
 * - Indent 2 spaces, LF line endings, one final newline, no BOM.
 * - Numbers are written by `JSON.stringify`, i.e. the shortest decimal that parses back to the
 *   same binary64 (ECMAScript Number::toString). −0 is written as `0`, so a saved file never
 *   carries −0 (consistent with contracts-v1 §11.4 P3, which normalises −0 to +0 for the
 *   requestId; the engine's request builder does the normalisation, this module does not).
 * - Nothing outside the Scenario is stored; the engine's constants come from the engine.
 *
 * Saving a scenario that the engine's validation rejects is refused (the file would not load).
 * Loading validates with the contract (structure) and the engine (semantics) and never touches
 * the caller's current scenario; it only returns a result.
 */
import { validateScenario } from '@mission-lab/contracts';
import type { Scenario, ValidationIssue } from '@mission-lab/contracts';
import { validateScenarioSemantics } from '@mission-lab/simulation';

/**
 * Largest scenario file the UI reads, in bytes (ML-FR-011 AC3). A scenario file is about 1 KiB
 * (one maneuver); 64 KiB leaves room for a very long name while rejecting a wrong file before it
 * is read. PROPOSED value; the owner confirms it at review (ML-TASK-033 report).
 */
export const MAX_SCENARIO_FILE_BYTES = 64 * 1024;

/** Why a file was not loaded. Each class has its own message (VT-18, FR-011 AC3). */
export type LoadFailureKind =
  'TOO_LARGE' | 'NOT_UTF8' | 'INVALID_JSON' | 'SCHEMA_VERSION' | 'SCHEMA' | 'OUT_OF_RANGE';

export interface LoadFailure {
  readonly kind: LoadFailureKind;
  /** One readable sentence. */
  readonly message: string;
  /** The engine's issues, when the failure comes from validation. */
  readonly issues: readonly ValidationIssue[];
}

export type LoadResult =
  | { readonly ok: true; readonly scenario: Scenario }
  | { readonly ok: false; readonly failure: LoadFailure };

/** Codes that mean a value has the right type but lies outside its allowed range. */
const RANGE_CODES: ReadonlySet<string> = new Set([
  'SEMI_MAJOR_AXIS_NOT_POSITIVE',
  'ECCENTRICITY_OUT_OF_RANGE',
  'INCLINATION_OUT_OF_RANGE',
  'ANGLE_OUT_OF_RANGE',
  'DURATION_NOT_POSITIVE',
  'OUTPUT_STEP_NOT_POSITIVE',
  'MANEUVER_TIME_OUT_OF_RANGE',
  'MANEUVER_COUNT_EXCEEDED',
  'PERIGEE_BELOW_REFERENCE_RADIUS',
  'SAMPLE_COUNT_EXCEEDED',
]);

function ordered(scenario: Scenario): Scenario {
  const e = scenario.initialOrbit.elements;
  return {
    schemaVersion: scenario.schemaVersion,
    id: scenario.id,
    name: scenario.name,
    centralBody: scenario.centralBody,
    frame: scenario.frame,
    epoch: { scale: scenario.epoch.scale, iso: scenario.epoch.iso },
    initialOrbit: {
      kind: scenario.initialOrbit.kind,
      elements: {
        semiMajorAxis_m: e.semiMajorAxis_m,
        eccentricity: e.eccentricity,
        inclination_rad: e.inclination_rad,
        raan_rad: e.raan_rad,
        argPeriapsis_rad: e.argPeriapsis_rad,
        trueAnomaly_rad: e.trueAnomaly_rad,
      },
    },
    maneuvers: scenario.maneuvers.map((m) => ({
      id: m.id,
      t_s: m.t_s,
      frame: m.frame,
      deltaV_mps: [m.deltaV_mps[0], m.deltaV_mps[1], m.deltaV_mps[2]],
    })),
    duration_s: scenario.duration_s,
    outputStep_s: scenario.outputStep_s,
  };
}

/** The canonical file text of a scenario. Total: no validation (see `serialiseValidScenario`). */
export function serialiseScenario(scenario: Scenario): string {
  return `${JSON.stringify(ordered(scenario), null, 2)}\n`;
}

/** Structural plus semantic validation, the same checks a load applies. */
export function scenarioIssues(scenario: unknown): readonly ValidationIssue[] {
  const structural = validateScenario(scenario);
  if (!structural.ok) {
    return structural.issues;
  }
  return validateScenarioSemantics(structural.value);
}

export type SaveResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** The file text, or the issues that make the scenario unsavable. */
export function serialiseValidScenario(scenario: Scenario): SaveResult {
  const issues = scenarioIssues(scenario);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, text: serialiseScenario(scenario) };
}

function fail(
  kind: LoadFailureKind,
  message: string,
  issues: readonly ValidationIssue[] = [],
): LoadResult {
  return { ok: false, failure: { kind, message, issues } };
}

/** Rejects a file by size before it is read (ML-FR-011 AC3). */
export function checkFileSize(sizeBytes: number): LoadFailure | null {
  if (sizeBytes > MAX_SCENARIO_FILE_BYTES) {
    return {
      kind: 'TOO_LARGE',
      message: `The file is too large to be a scenario (limit ${String(MAX_SCENARIO_FILE_BYTES / 1024)} KiB).`,
      issues: [],
    };
  }
  return null;
}

/** Parses and validates the bytes of a scenario file. Never throws. */
export function parseScenarioBytes(bytes: Uint8Array): LoadResult {
  const tooLarge = checkFileSize(bytes.byteLength);
  if (tooLarge !== null) {
    return { ok: false, failure: tooLarge };
  }
  let text: string;
  try {
    // ignoreBOM: true keeps a leading byte-order mark (added by some editors) in the text, where
    // it is removed below; it is not part of the JSON text.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return fail('NOT_UTF8', 'The file is not valid UTF-8 text, so it is not a scenario file.');
  }
  return parseScenarioText(text.startsWith('﻿') ? text.slice(1) : text);
}

/** Parses and validates the text of a scenario file. Never throws. */
export function parseScenarioText(text: string): LoadResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('INVALID_JSON', 'The file is not valid JSON, so it is not a scenario file.');
  }
  const structural = validateScenario(json);
  if (!structural.ok) {
    const [first] = structural.issues;
    if (first?.code === 'SCHEMA_VERSION_UNSUPPORTED') {
      return fail(
        'SCHEMA_VERSION',
        'The schema version of this file is missing or not supported; this app reads version "1.0".',
        structural.issues,
      );
    }
    const rangeOnly = structural.issues.every((issue) => RANGE_CODES.has(issue.code));
    return rangeOnly
      ? fail('OUT_OF_RANGE', 'The file has values outside their allowed range.', structural.issues)
      : fail('SCHEMA', 'The file does not match the scenario format.', structural.issues);
  }
  const semantic = validateScenarioSemantics(structural.value);
  if (semantic.length > 0) {
    return fail('OUT_OF_RANGE', 'The file has values outside their allowed range.', semantic);
  }
  return { ok: true, scenario: structural.value };
}

/** One line per issue for display: "path: message (CODE)". */
export function describeIssue(issue: ValidationIssue): string {
  const where = issue.path.length === 0 ? 'file' : issue.path.join('.');
  return `${where}: ${issue.message} (${issue.code})`;
}

/** A file name for a download: the scenario name made safe, plus a fixed suffix. */
export function suggestedFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return `${slug === '' ? 'scenario' : slug}.scenario.json`;
}
