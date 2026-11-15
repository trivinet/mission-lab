/**
 * Reference-side checks of the ML-TASK-018 part C datasets (no engine involved):
 * every embedded request and scenario validates with the @mission-lab/contracts validators and
 * every requestId matches the contract payload; the VT-16 L2b references agree with L2a within
 * M·P_A + 2E_RK (validation of the RK reference, record §9.1/§9.2); stored VT-12 references
 * equal the committed reference function; the encoding helper round-trips special numbers.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalRequestPayload,
  validateScenario,
  validateSimulationRequest,
  type SimulationRequest,
} from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { prepareL2a, propagateL2a } from '../ref/kepler';
import { rswToInertialHp } from '../ref/rsw';
import { dist, type V3 } from '../ref/vec';
import { l2aVsL2b, scales } from '../tol/tolerances';
import { applyMutations, decodeValue } from './encoding';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIRS = ['vt-01', 'vt-06-07', 'vt-09', 'vt-12', 'vt-14', 'vt-15', 'vt-16', 'vt-18', 'vi-01'];

type Json = Record<string, unknown>;

function load(dir: string): { file: string; data: Json }[] {
  const p = join(ROOT, 'test-data', 'reference-cases', dir);
  return readdirSync(p)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => ({
      file: `${dir}/${n}`,
      data: JSON.parse(readFileSync(join(p, n), 'utf8')) as Json,
    }));
}

function requestIdOf(body: Omit<SimulationRequest, 'requestId'>): string {
  return `sha256:${createHash('sha256').update(canonicalRequestPayload(body), 'utf8').digest('hex')}`;
}

function walk(x: unknown, visit: (o: Json) => void): void {
  if (Array.isArray(x)) {
    x.forEach((y) => {
      walk(y, visit);
    });
  } else if (typeof x === 'object' && x !== null) {
    visit(x as Json);
    Object.values(x).forEach((y) => {
      walk(y, visit);
    });
  }
}

const all = DIRS.flatMap(load);

describe('part C datasets: inputs are contract-valid', () => {
  it('every embedded request validates and carries the contract requestId', () => {
    let n = 0;
    for (const { file, data } of all) {
      walk(data.inputs, (o) => {
        if (typeof o.requestId === 'string' && o.initialState !== undefined) {
          n++;
          const res = validateSimulationRequest(o);
          expect(res.ok, file).toBe(true);
          if (res.ok) {
            const { requestId, ...body } = res.value;
            expect(requestId, file).toBe(requestIdOf(body));
          }
        }
      });
    }
    expect(n).toBeGreaterThan(100);
  });

  it('every embedded scenario (VI-01, VT-18 base) validates', () => {
    let n = 0;
    for (const { file, data } of all) {
      walk(data.inputs, (o) => {
        if (o.initialOrbit !== undefined && o.schemaVersion === '1.0') {
          n++;
          expect(validateScenario(o).ok, file).toBe(true);
        }
      });
    }
    expect(n).toBeGreaterThanOrEqual(12);
  });
});

describe('part C datasets: reference self-consistency', () => {
  it('VT-16 L2b agrees with L2a within M·P_A + 2E_RK (RK reference validation)', () => {
    let n = 0;
    for (const { file, data } of all.filter((d) => d.file.startsWith('vt-16/'))) {
      const sc = (data.outputs as Json).stateComparison as Json | null;
      if (sc === null) continue;
      n++;
      const start = sc.startState as { position_m: V3; velocity_mps: V3 };
      const ps = sc.postScales as Record<string, number>;
      const s = scales(ps.mu_m3ps2 ?? NaN, ps.a_m ?? NaN, ps.e ?? NaN);
      const l2a = prepareL2a(start, ps.mu_m3ps2 ?? NaN);
      const l2b = sc.l2b as {
        position_m: V3[];
        velocity_mps: V3[];
        eRk_r_m: number[];
        eRk_v_mps: number[];
      };
      (sc.t_s as number[]).forEach((t, k) => {
        if (k === 0) return;
        const a = propagateL2a(l2a, t).state;
        const tol = l2aVsL2b(s, t, l2b.eRk_r_m[k] ?? NaN, l2b.eRk_v_mps[k] ?? NaN);
        expect(
          dist(a.position_m, l2b.position_m[k] ?? [NaN, NaN, NaN]),
          `${file} k=${String(k)}`,
        ).toBeLessThanOrEqual(tol.position_m);
        expect(
          dist(a.velocity_mps, l2b.velocity_mps[k] ?? [NaN, NaN, NaN]),
          `${file} k=${String(k)}`,
        ).toBeLessThanOrEqual(tol.velocity_mps);
      });
    }
    expect(n).toBe(3);
  });

  it('VT-12 t0 references equal the committed reference function', () => {
    for (const { file, data } of all.filter((d) => d.file.endsWith('-t0.json'))) {
      for (const c of (data.inputs as Json).cases as Json[]) {
        const req = c.request as SimulationRequest;
        const ref = rswToInertialHp(
          req.initialState.position_m,
          req.initialState.velocity_mps,
          c.deltaV_rsw_mps as V3,
        );
        expect(ref, file).toEqual(c.referenceDeltaV_inertial_mps);
      }
    }
  });

  it('encoding helper decodes special numbers and applies mutations without touching the base', () => {
    const v = decodeValue([
      { $number: '-0' },
      { $number: 'NaN' },
      { a: { $number: 'Infinity' } },
    ]) as unknown[];
    expect(Object.is(v[0], -0)).toBe(true);
    expect(Number.isNaN(v[1])).toBe(true);
    const base = { x: { y: 1 }, z: [1, 2] };
    const out = applyMutations(base, [
      { op: 'set', path: ['x', 'y'], value: { $number: '-Infinity' } },
      { op: 'set', path: ['z', 2], value: 3 },
      { op: 'delete', path: ['x'] },
    ]) as Json;
    expect(out).toEqual({ z: [1, 2, 3] });
    expect(base).toEqual({ x: { y: 1 }, z: [1, 2] });
  });
});
