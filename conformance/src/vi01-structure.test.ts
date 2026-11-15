/**
 * VI-01 Request → result structure (contracts-v1.md §13), the −0 rule (§11.4 P3), the
 * failed-result shape (rectilinear collision) and VT-10 determinism, against
 * test-data/reference-cases/vi-01/structure.json (ML-TASK-018 part C, committed in phase 1).
 * All checks are exact (tolerances.md §1, §8 VI-01).
 */
import { createHash } from 'node:crypto';
import {
  canonicalRequestPayload,
  validateSimulationResult,
  type Scenario,
  type SimulationRequest,
  type SimulationResult,
} from '@mission-lab/contracts';
import { buildSimulationRequest, deriveRequestId, runSimulation } from '@mission-lab/simulation';
import {
  applyMutations,
  samplingGridWithManeuvers,
  type Mutation,
} from '@mission-lab/verification';
import { describe, expect, it } from 'vitest';
import { loadFamily } from './support/datasets';
import { firstBitDifference, runRequest } from './support/run';

interface ScenarioCase {
  readonly id: string;
  readonly scenario: Scenario;
  readonly expected: {
    readonly status: string;
    readonly runtimeDiagnosticCodes: readonly string[];
    readonly segmentTimes_s: readonly (readonly number[])[];
    readonly events: readonly { maneuverId: string; t_s: number }[];
  };
}

interface Vi01 {
  readonly inputs: {
    readonly scenarios: readonly ScenarioCase[];
    readonly negativeZeroManeuverRequest: { readonly base: SimulationRequest };
    readonly rectilinearCollision: {
      readonly request: SimulationRequest;
      readonly fallTime_s: number;
    };
    readonly negativeZeroScenarios: {
      readonly base: Scenario;
      readonly variants: readonly { id: string; path: (string | number)[] }[];
    };
  };
}

const data = loadFamily('vi-01')[0]?.data as Vi01;

function requestIdOf(body: Omit<SimulationRequest, 'requestId'>): string {
  return `sha256:${createHash('sha256').update(canonicalRequestPayload(body), 'utf8').digest('hex')}`;
}

/** Every request field except requestId (the canonical payload's input, contracts-v1 §7.2). */
function bodyOf(r: SimulationRequest): Omit<SimulationRequest, 'requestId'> {
  return {
    schemaVersion: r.schemaVersion,
    centralBody: r.centralBody,
    constants: r.constants,
    dynamicsModel: r.dynamicsModel,
    frame: r.frame,
    epoch: r.epoch,
    initialState: r.initialState,
    maneuvers: r.maneuvers,
    duration_s: r.duration_s,
    outputStep_s: r.outputStep_s,
  };
}

function build(scenario: unknown): SimulationRequest {
  const res = buildSimulationRequest(scenario);
  if (!res.ok) throw new Error(`buildSimulationRequest rejected: ${JSON.stringify(res.issues)}`);
  return res.value;
}

/** Every check of contracts-v1 §13 VI-01 that applies to an ok result. Returns the failures. */
function vi01Checks(request: SimulationRequest, result: SimulationResult): string[] {
  const f: string[] = [];
  const v = validateSimulationResult(result);
  if (!v.ok) f.push(`validateSimulationResult: ${JSON.stringify(v.issues)}`);
  if (result.requestId !== request.requestId) f.push('requestId differs from the request');
  const c = result.model.constants;
  if (!Object.is(c.mu_m3ps2, request.constants.mu_m3ps2)) f.push('constants.mu_m3ps2');
  if (!Object.is(c.referenceRadius_m, request.constants.referenceRadius_m)) {
    f.push('constants.referenceRadius_m');
  }
  if (c.source !== request.constants.source) f.push('constants.source');
  if (!Object.is(result.model.sampling.duration_s, request.duration_s))
    f.push('sampling.duration_s');
  if (!Object.is(result.model.sampling.outputStep_s, request.outputStep_s)) {
    f.push('sampling.outputStep_s');
  }
  if (firstBitDifference(result.model.epoch, request.epoch) !== null) f.push('model.epoch');
  // Grid: independent construction of §5.2 from the request's own values.
  const grid = samplingGridWithManeuvers(
    request.duration_s,
    request.outputStep_s,
    request.maneuvers.map((m) => m.t_s),
  );
  if (result.segments.length !== grid.segments.length) {
    f.push(`segment count ${String(result.segments.length)} vs ${String(grid.segments.length)}`);
  } else {
    grid.segments.forEach((exp, n) => {
      const d = firstBitDifference(Array.from(result.segments[n]?.t_s ?? []), exp);
      if (d !== null) f.push(`segment ${String(n)} t_s vs §5.2 grid: ${d}`);
    });
  }
  if (result.events.length !== request.maneuvers.length) f.push('event count');
  request.maneuvers.forEach((m, i) => {
    const e = result.events[i];
    if (e === undefined) return;
    if (e.maneuverId !== m.id) f.push(`event ${String(i)} maneuverId`);
    if (!Object.is(e.t_s, m.t_s))
      f.push(`event ${String(i)} t_s ${String(e.t_s)} vs ${String(m.t_s)}`);
  });
  const s0 = result.segments[0];
  if (s0 !== undefined) {
    for (let j = 0; j < 3; j++) {
      if (!Object.is(s0.position_m[j], request.initialState.position_m[j])) {
        f.push(`first sample position[${String(j)}] not bit-identical to initialState`);
      }
      if (!Object.is(s0.velocity_mps[j], request.initialState.velocity_mps[j])) {
        f.push(`first sample velocity[${String(j)}] not bit-identical to initialState`);
      }
    }
  }
  // Typed-array ownership (owner decision 7), checked directly.
  const buffers = new Set<ArrayBufferLike>();
  let arrays = 0;
  result.segments.forEach((seg, n) => {
    for (const [name, arr] of [
      ['t_s', seg.t_s],
      ['position_m', seg.position_m],
      ['velocity_mps', seg.velocity_mps],
    ] as const) {
      arrays++;
      const where = `segment ${String(n)} ${name}`;
      if (!(arr instanceof Float64Array)) f.push(`${where}: not Float64Array`);
      if (arr.byteOffset !== 0) f.push(`${where}: byteOffset ${String(arr.byteOffset)}`);
      if (!(arr.buffer instanceof ArrayBuffer)) f.push(`${where}: buffer not an ArrayBuffer`);
      if (typeof SharedArrayBuffer !== 'undefined' && arr.buffer instanceof SharedArrayBuffer) {
        f.push(`${where}: SharedArrayBuffer`);
      }
      if (arr.buffer.byteLength !== arr.byteLength)
        f.push(`${where}: does not own the whole buffer`);
      buffers.add(arr.buffer);
    }
  });
  if (buffers.size !== arrays) f.push('two typed arrays share a buffer');
  return f;
}

describe('VI-01 request → result structure (contracts-v1 §13)', () => {
  it.each(data.inputs.scenarios.map((c) => ({ id: c.id, c })))('$id', ({ c }) => {
    const request = build(c.scenario);
    const result = runRequest(request);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe(c.expected.status);
    expect(result.diagnostics.map((d) => d.code)).toEqual(c.expected.runtimeDiagnosticCodes);
    expect(vi01Checks(request, result)).toEqual([]);
    // Dataset grid (committed) equals the per-segment sample times.
    const d = firstBitDifference(
      result.segments.map((s) => Array.from(s.t_s)),
      c.expected.segmentTimes_s,
    );
    expect(d).toBeNull();
    expect(result.events.map((e) => ({ maneuverId: e.maneuverId, t_s: e.t_s }))).toEqual(
      c.expected.events,
    );
  });

  it('request with a maneuver at −0: grid sample −0 in both segments (§5.2 item 3)', () => {
    const base = data.inputs.negativeZeroManeuverRequest.base;
    const body = bodyOf(base);
    const m0 = base.maneuvers[0];
    if (m0 === undefined) throw new Error('dataset');
    const withNegZero: Omit<SimulationRequest, 'requestId'> = {
      ...body,
      maneuvers: [{ ...m0, t_s: -0 }],
    };
    const request: SimulationRequest = { requestId: requestIdOf(withNegZero), ...withNegZero };
    expect(request.requestId).not.toBe(base.requestId);
    const result = runRequest(request);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    expect(vi01Checks(request, result)).toEqual([]);
    expect(Object.is(result.segments[0]?.t_s[0], -0)).toBe(true);
    expect(result.segments[0]?.t_s.length).toBe(1);
    expect(Object.is(result.segments[1]?.t_s[0], -0)).toBe(true);
    expect(Object.is(result.events[0]?.t_s, -0)).toBe(true);
  });

  it('failed-result shape: rectilinear collision → status failed, one NON_FINITE_STATE error', () => {
    const { request, fallTime_s } = data.inputs.rectilinearCollision;
    const result = runRequest(request);
    console.log(
      `[conformance] VI-01 rectilinear: status ${result.status}; diagnostics ${JSON.stringify(
        result.diagnostics.map((d) => ({ code: d.code, severity: d.severity, t_s: d.t_s })),
      )}; reference fall time ${String(fallTime_s)} s`,
    );
    expect(validateSimulationResult(result).ok).toBe(true);
    expect(result.status).toBe('failed');
    expect(result.segments).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.requestId).toBe(request.requestId);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((d) => d.code)).toEqual(['NON_FINITE_STATE']);
    const t = errors[0]?.t_s;
    expect(typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= request.duration_s).toBe(
      true,
    );
  });
});

describe('−0 rule (contracts-v1 §11.4 P3): equivalent scenarios, same requestId', () => {
  const { base, variants } = data.inputs.negativeZeroScenarios;
  const id0 = deriveRequestId(base);
  const payload0 = canonicalRequestPayload(bodyOf(build(base)));

  it.each(variants.map((v) => ({ id: v.id, v })))('−0 at $id', ({ v }) => {
    const mutated = applyMutations(base, [{ op: 'set', path: v.path, value: { $number: '-0' } }]);
    expect(id0.ok).toBe(true);
    const id1 = deriveRequestId(mutated);
    expect(id1.ok).toBe(true);
    if (id0.ok && id1.ok) expect(id1.value).toBe(id0.value);
    expect(canonicalRequestPayload(bodyOf(build(mutated)))).toBe(payload0);
  });

  it('−0 in every zero field at once', () => {
    const muts: Mutation[] = variants.map((v) => ({
      op: 'set',
      path: v.path,
      value: { $number: '-0' },
    }));
    const mutated = applyMutations(base, muts);
    const id1 = deriveRequestId(mutated);
    expect(id0.ok && id1.ok && id1.value === id0.value).toBe(true);
  });
});

describe('VT-10 determinism (exact): repeated runs are bit-identical', () => {
  const requests: { id: string; request: unknown }[] = [
    ...data.inputs.scenarios.map((c) => ({ id: `vi-01 ${c.id}`, request: build(c.scenario) })),
    { id: 'vi-01 rectilinear', request: data.inputs.rectilinearCollision.request },
  ];
  for (const f of loadFamily('vt-09')) {
    const d = f.data as { inputs: { requests: SimulationRequest[] } };
    d.inputs.requests.forEach((r, i) =>
      requests.push({ id: `${f.file} #${String(i)}`, request: r }),
    );
  }
  for (const f of loadFamily('vt-16')) {
    const d = f.data as { inputs: { request: SimulationRequest } };
    requests.push({ id: f.file, request: d.inputs.request });
  }

  it.each(requests)('$id', ({ request }) => {
    const a = runSimulation(request);
    const b = runSimulation(structuredClone(request));
    expect(firstBitDifference(a, b)).toBeNull();
    if (a.ok) {
      expect(a.value.requestId).toBe((request as SimulationRequest).requestId);
    }
  });
});
