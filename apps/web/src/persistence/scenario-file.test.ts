import type { Scenario, SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { createScenarioStore, hasUnsavedChanges } from '../state/scenario-store';
import { handleRunMessage } from '../worker/run-handler';
import {
  MAX_SCENARIO_FILE_BYTES,
  parseScenarioBytes,
  parseScenarioText,
  serialiseScenario,
  serialiseValidScenario,
  suggestedFileName,
} from './scenario-file';
import type { LoadResult } from './scenario-file';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

function withManeuver(base: Scenario): Scenario {
  return {
    ...base,
    maneuvers: [{ id: 'maneuver-1', t_s: 1500, frame: 'RSW', deltaV_mps: [0, 12.5, -3.25] }],
  };
}

/** Circular (e = 0) and equatorial (i = 0): the degenerate element set of ADR-008. */
function degenerate(base: Scenario): Scenario {
  const e = base.initialOrbit.elements;
  return {
    ...base,
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: { ...e, eccentricity: 0, inclination_rad: 0, raan_rad: 0, argPeriapsis_rad: 0 },
    },
  };
}

const CASES: readonly (readonly [string, Scenario])[] = [
  ['default', newScenario()],
  ['maneuvered', withManeuver(newScenario())],
  ['degenerate', degenerate(newScenario())],
];

function runOf(request: SimulationRequest): SimulationResult {
  const { response } = handleRunMessage({ type: 'run', runId: 1, request });
  if (response.type !== 'result') {
    throw new Error('expected a result');
  }
  return response.result;
}

function requestOf(scenario: Scenario): SimulationRequest {
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error('expected a valid scenario');
  }
  return built.value;
}

function bytesOf(values: Float64Array): string {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('hex');
}

function parsedOk(result: LoadResult): Scenario {
  if (!result.ok) {
    throw new Error(`load rejected: ${result.failure.message}`);
  }
  return result.scenario;
}

describe('VT-17: scenario file round trip (ML-FR-011 AC2)', () => {
  for (const [label, scenario] of CASES) {
    it(`${label}: save -> load -> save is byte-identical and the loaded scenario is equal`, () => {
      const first = serialiseValidScenario(scenario);
      expect(first.ok).toBe(true);
      const text = first.ok ? first.text : '';
      const loaded = parsedOk(parseScenarioBytes(encode(text)));
      expect(loaded).toEqual(scenario);
      expect(serialiseScenario(loaded)).toBe(text);
      // Bytes, not just strings.
      expect(Buffer.from(encode(serialiseScenario(loaded))).equals(Buffer.from(encode(text)))).toBe(
        true,
      );
    });

    it(`${label}: load -> run gives the same requestId and bit-identical samples`, () => {
      const loaded = parsedOk(parseScenarioBytes(encode(serialiseScenario(scenario))));
      const original = runOf(requestOf(scenario));
      const reloaded = runOf(requestOf(loaded));
      expect(original.status).toBe('ok');
      expect(reloaded.requestId).toBe(original.requestId);
      expect(reloaded.segments).toHaveLength(original.segments.length);
      original.segments.forEach((segment, n) => {
        const other = reloaded.segments[n];
        expect(other).toBeDefined();
        expect(bytesOf(other?.t_s ?? new Float64Array())).toBe(bytesOf(segment.t_s));
        expect(bytesOf(other?.position_m ?? new Float64Array())).toBe(bytesOf(segment.position_m));
        expect(bytesOf(other?.velocity_mps ?? new Float64Array())).toBe(
          bytesOf(segment.velocity_mps),
        );
      });
    });
  }

  it('has the documented layout: fixed key order, 2-space indent, LF, one final newline', () => {
    const text = serialiseScenario(withManeuver(newScenario()));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(text.includes('\r')).toBe(false);
    expect(text.charCodeAt(0)).toBe(0x7b);
    const keys = Object.keys(JSON.parse(text) as Record<string, unknown>);
    expect(keys).toEqual([
      'schemaVersion',
      'id',
      'name',
      'centralBody',
      'frame',
      'epoch',
      'initialOrbit',
      'maneuvers',
      'duration_s',
      'outputStep_s',
    ]);
    expect(text).toContain('\n  "schemaVersion": "1.0",\n');
  });

  it('is independent of the key order of the in-memory object', () => {
    const scenario = withManeuver(newScenario());
    const shuffled = Object.fromEntries(Object.entries(scenario).reverse()) as unknown as Scenario;
    expect(serialiseScenario(shuffled)).toBe(serialiseScenario(scenario));
  });

  it('writes shortest round-trip decimals: every number parses back to the same binary64', () => {
    const base = newScenario();
    const scenario: Scenario = {
      ...base,
      initialOrbit: {
        kind: 'KEPLERIAN',
        elements: {
          ...base.initialOrbit.elements,
          inclination_rad: Math.PI / 3,
          eccentricity: 0.05,
        },
      },
      outputStep_s: 0.1 + 0.2,
    };
    const text = serialiseScenario(scenario);
    expect(text).toContain('"eccentricity": 0.05,');
    expect(text).toContain('"outputStep_s": 0.30000000000000004');
    const loaded = parsedOk(parseScenarioText(text));
    expect(Object.is(loaded.initialOrbit.elements.inclination_rad, Math.PI / 3)).toBe(true);
    expect(Object.is(loaded.outputStep_s, 0.1 + 0.2)).toBe(true);
  });

  it('-0 (contracts-v1 §11.4 P3): written as 0; a -0 in a file gives the same requestId as +0', () => {
    const base = withManeuver(newScenario());
    const withNegZero: Scenario = {
      ...base,
      maneuvers: [{ id: 'maneuver-1', t_s: -0, frame: 'RSW', deltaV_mps: [-0, 12.5, -3.25] }],
    };
    const text = serialiseScenario(withNegZero);
    expect(text).not.toMatch(/(?<![\w-])-0(?![.\d])/);
    // A hand-edited file that carries -0 is accepted, and normalised by the request builder.
    const handEdited = text.replace('"t_s": 0,', '"t_s": -0,');
    expect(handEdited).not.toBe(text);
    const loaded = parsedOk(parseScenarioText(handEdited));
    expect(Object.is(loaded.maneuvers[0]?.t_s, -0)).toBe(true);
    expect(serialiseScenario(loaded)).toBe(text);
    const plus = { ...loaded, maneuvers: [{ ...base.maneuvers[0], t_s: 0 }] } as Scenario;
    expect(requestOf(loaded).requestId).toBe(requestOf(plus).requestId);
  });

  it('accepts a leading byte-order mark and writes none', () => {
    const text = serialiseScenario(newScenario());
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(text)]);
    expect(parsedOk(parseScenarioBytes(withBom))).toEqual(parsedOk(parseScenarioText(text)));
    expect(encode(text)[0]).toBe(0x7b);
  });
});

/** A valid scenario file as a mutable plain object, for building invalid variants. */
function validJson(): Record<string, unknown> {
  return JSON.parse(serialiseScenario(withManeuver(newScenario()))) as Record<string, unknown>;
}

function mutated(change: (json: Record<string, unknown>) => void): string {
  const json = validJson();
  change(json);
  return JSON.stringify(json);
}

function elements(json: Record<string, unknown>): Record<string, unknown> {
  return (json.initialOrbit as { elements: Record<string, unknown> }).elements;
}

interface InvalidCase {
  readonly label: string;
  readonly bytes: Uint8Array;
  readonly kind: string;
  readonly message: string;
  readonly code?: string;
}

const INVALID: readonly InvalidCase[] = [
  {
    label: 'invalid JSON',
    bytes: encode('{"schemaVersion": "1.0", '),
    kind: 'INVALID_JSON',
    message: 'The file is not valid JSON, so it is not a scenario file.',
  },
  {
    label: 'empty file',
    bytes: encode(''),
    kind: 'INVALID_JSON',
    message: 'The file is not valid JSON, so it is not a scenario file.',
  },
  {
    label: 'not UTF-8',
    bytes: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
    kind: 'NOT_UTF8',
    message: 'The file is not valid UTF-8 text, so it is not a scenario file.',
  },
  {
    label: 'missing schemaVersion',
    bytes: encode(
      mutated((j) => {
        delete j.schemaVersion;
      }),
    ),
    kind: 'SCHEMA_VERSION',
    message:
      'The schema version of this file is missing or not supported; this app reads version "1.0".',
    code: 'SCHEMA_VERSION_UNSUPPORTED',
  },
  {
    label: 'unknown schemaVersion',
    bytes: encode(
      mutated((j) => {
        j.schemaVersion = '2.0';
      }),
    ),
    kind: 'SCHEMA_VERSION',
    message:
      'The schema version of this file is missing or not supported; this app reads version "1.0".',
    code: 'SCHEMA_VERSION_UNSUPPORTED',
  },
  {
    label: 'schema violation: unknown field',
    bytes: encode(
      mutated((j) => {
        j.extra = 1;
      }),
    ),
    kind: 'SCHEMA',
    message: 'The file does not match the scenario format.',
    code: 'UNKNOWN_FIELD',
  },
  {
    label: 'schema violation: wrong type',
    bytes: encode(
      mutated((j) => {
        j.duration_s = '6000';
      }),
    ),
    kind: 'SCHEMA',
    message: 'The file does not match the scenario format.',
    code: 'TYPE_MISMATCH',
  },
  {
    label: 'schema violation: top level is not an object',
    bytes: encode('[1, 2]'),
    kind: 'SCHEMA',
    message: 'The file does not match the scenario format.',
    code: 'TYPE_MISMATCH',
  },
  {
    label: 'schema violation: invalid epoch',
    bytes: encode(
      mutated((j) => {
        j.epoch = { scale: 'UTC', iso: '2026-02-30T00:00:00.000Z' };
      }),
    ),
    kind: 'SCHEMA',
    message: 'The file does not match the scenario format.',
    code: 'EPOCH_INVALID',
  },
  {
    label: 'out of range: eccentricity',
    bytes: encode(
      mutated((j) => {
        elements(j).eccentricity = 1.5;
      }),
    ),
    kind: 'OUT_OF_RANGE',
    message: 'The file has values outside their allowed range.',
    code: 'ECCENTRICITY_OUT_OF_RANGE',
  },
  {
    label: 'out of range: maneuver after the end',
    bytes: encode(
      mutated((j) => {
        j.maneuvers = [{ id: 'maneuver-1', t_s: 99999, frame: 'RSW', deltaV_mps: [0, 1, 0] }];
      }),
    ),
    kind: 'OUT_OF_RANGE',
    message: 'The file has values outside their allowed range.',
    code: 'MANEUVER_TIME_OUT_OF_RANGE',
  },
  {
    label: 'out of range (engine semantic rule): perigee below the reference radius',
    bytes: encode(
      mutated((j) => {
        elements(j).semiMajorAxis_m = 1000;
        elements(j).eccentricity = 0;
      }),
    ),
    kind: 'OUT_OF_RANGE',
    message: 'The file has values outside their allowed range.',
    code: 'PERIGEE_BELOW_REFERENCE_RADIUS',
  },
  {
    label: 'out of range (engine semantic rule): too many samples',
    bytes: encode(
      mutated((j) => {
        j.outputStep_s = 1e-9;
      }),
    ),
    kind: 'OUT_OF_RANGE',
    message: 'The file has values outside their allowed range.',
    code: 'SAMPLE_COUNT_EXCEEDED',
  },
  {
    label: 'file over the size limit',
    bytes: new Uint8Array(MAX_SCENARIO_FILE_BYTES + 1).fill(0x20),
    kind: 'TOO_LARGE',
    message: 'The file is too large to be a scenario (limit 64 KiB).',
  },
];

describe('VT-18 (ML-FR-011 AC3): invalid files are rejected with a message', () => {
  for (const c of INVALID) {
    it(`${c.label}: rejected as ${c.kind}`, () => {
      const result = parseScenarioBytes(c.bytes);
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.failure.kind).toBe(c.kind);
      expect(result.failure.message).toBe(c.message);
      if (c.code !== undefined) {
        expect(result.failure.issues.map((i) => i.code)).toContain(c.code);
      }
    });

    it(`${c.label}: the current scenario is unchanged (deep equality) after the rejection`, () => {
      const store = createScenarioStore(() => Promise.reject(new Error('not used')));
      store.getState().setName('My work');
      store.getState().setDuration_s(4321);
      const before = structuredClone(store.getState().scenario);
      const savedBefore = store.getState().savedText;
      const result = parseScenarioBytes(c.bytes);
      if (result.ok) {
        store.getState().loadScenario(result.scenario);
      }
      expect(result.ok).toBe(false);
      expect(store.getState().scenario).toEqual(before);
      expect(store.getState().savedText).toBe(savedBefore);
      expect(hasUnsavedChanges(store.getState())).toBe(true);
    });
  }

  it('a file exactly at the size limit is not rejected for size', () => {
    const padded = serialiseScenario(newScenario()).padEnd(MAX_SCENARIO_FILE_BYTES, ' ');
    expect(parseScenarioBytes(encode(padded)).ok).toBe(true);
  });

  it('refuses to save a scenario the engine rejects', () => {
    const base = newScenario();
    const bad: Scenario = { ...base, duration_s: -1 };
    const result = serialiseValidScenario(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain('DURATION_NOT_POSITIVE');
    }
  });
});

describe('unsaved changes (ML-FR-011 AC4)', () => {
  const store = () => createScenarioStore(() => Promise.reject(new Error('not used')));

  it('a new scenario has none; any edit (name included) makes them; reverting clears them', () => {
    const s = store();
    expect(hasUnsavedChanges(s.getState())).toBe(false);
    s.getState().setName('Other');
    expect(hasUnsavedChanges(s.getState())).toBe(true);
    s.getState().setName('New scenario');
    expect(hasUnsavedChanges(s.getState())).toBe(false);
    s.getState().setDuration_s(1234);
    expect(hasUnsavedChanges(s.getState())).toBe(true);
  });

  it('markSaved clears them; loadScenario and startNewScenario start clean', () => {
    const s = store();
    s.getState().setDuration_s(1234);
    const saved = serialiseValidScenario(s.getState().scenario);
    expect(saved.ok).toBe(true);
    s.getState().markSaved(saved.ok ? saved.text : '');
    expect(hasUnsavedChanges(s.getState())).toBe(false);
    s.getState().setDuration_s(2000);
    s.getState().loadScenario(withManeuver(newScenario()));
    expect(hasUnsavedChanges(s.getState())).toBe(false);
    expect(s.getState().resultState.kind).toBe('none');
    s.getState().setDuration_s(3000);
    s.getState().startNewScenario();
    expect(hasUnsavedChanges(s.getState())).toBe(false);
  });
});

describe('suggestedFileName', () => {
  it('makes a safe file name', () => {
    expect(suggestedFileName('My orbit / test')).toBe('My-orbit-test.scenario.json');
    expect(suggestedFileName('')).toBe('scenario.scenario.json');
    expect(suggestedFileName('../../x')).toBe('x.scenario.json');
  });
});
