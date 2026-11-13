/**
 * Reference datasets of ML-TASK-011: every file under test-data/reference-cases parses, its
 * inputs validate with the @mission-lab/contracts validators, its numbers round-trip to binary64,
 * and its content is exactly what the committed reference code produces (reproducibility).
 *
 * Generation mode (writes the files; used once per dataset version, then committed):
 *   ML_WRITE_DATASETS=1 ML_CODE_REVISION=<commit of the reference code> pnpm vitest run \
 *     --project verification src/datasets/datasets.test.ts
 * followed by `pnpm prettier --write test-data/reference-cases`. In normal runs nothing is
 * written and every check below runs.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalRequestPayload,
  cartesianStateSchema,
  keplerianElementsSchema,
  physicalConstantsSchema,
  validateSimulationRequest,
  type SimulationRequest,
} from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { scales, l2aVsL2b, E_RK_TARGET_REL } from '../tol/tolerances';
import { buildAllDatasets, type DatasetFile } from './build';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA_DIR = join(ROOT, 'test-data', 'reference-cases');

function requestIdOf(body: Omit<SimulationRequest, 'requestId'>): string {
  return `sha256:${createHash('sha256').update(canonicalRequestPayload(body), 'utf8').digest('hex')}`;
}

const PROVENANCE_KEYS = ['codeRevision', 'date', 'runtime'];

const writeMode = process.env.ML_WRITE_DATASETS === '1';

const built: DatasetFile[] = buildAllDatasets(
  {
    codeRevision: process.env.ML_CODE_REVISION ?? 'unset',
    date: '2026-11-13',
    runtime: `Node.js ${process.version}`,
  },
  requestIdOf,
);

if (writeMode) {
  if (process.env.ML_CODE_REVISION === undefined) throw new Error('set ML_CODE_REVISION');
  for (const f of built) {
    const path = join(ROOT, f.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(f.data, null, 2)}\n`, 'utf8');
  }
}

function listJson(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJson(p));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = listJson(DATA_DIR).map((p) => ({
  rel: relative(ROOT, p).split(sep).join('/'),
  text: readFileSync(p, 'utf8'),
}));

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function parse(text: string): Record<string, Json> {
  return JSON.parse(text) as Record<string, Json>;
}

/** Deep equality with Object.is on numbers; producedBy provenance keys are skipped. */
function sameContent(a: unknown, b: unknown, path: string, diffs: string[]): void {
  if (diffs.length > 5) return;
  if (typeof a === 'number' || typeof b === 'number') {
    if (!Object.is(a, b)) diffs.push(`${path}: ${String(a)} != ${String(b)}`);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      diffs.push(`${path}: array shape`);
      return;
    }
    a.forEach((x, i) => {
      sameContent(x, b[i], `${path}[${String(i)}]`, diffs);
    });
    return;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join(',') !== kb.join(',')) {
      diffs.push(`${path}: keys ${ka.join(',')} != ${kb.join(',')}`);
      return;
    }
    for (const k of ka) {
      if (path.endsWith('.producedBy') && PROVENANCE_KEYS.includes(k)) continue;
      sameContent(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
        diffs,
      );
    }
    return;
  }
  if (a !== b) diffs.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

function walkNumbers(x: Json, visit: (n: number) => void): void {
  if (typeof x === 'number') visit(x);
  else if (Array.isArray(x))
    x.forEach((y) => {
      walkNumbers(y, visit);
    });
  else if (x !== null && typeof x === 'object')
    Object.values(x).forEach((y) => {
      walkNumbers(y, visit);
    });
}

function obj(x: Json | undefined): Record<string, Json> {
  if (x === null || x === undefined || typeof x !== 'object' || Array.isArray(x)) {
    throw new Error('expected object');
  }
  return x;
}

function nums(x: Json | undefined): number[] {
  if (!Array.isArray(x)) throw new Error('expected array');
  return x.map((v) => {
    if (typeof v !== 'number') throw new Error('expected number');
    return v;
  });
}

function vecs(x: Json | undefined): [number, number, number][] {
  if (!Array.isArray(x)) throw new Error('expected array');
  return x.map((v) => {
    const n = nums(v);
    return [n[0] ?? Number.NaN, n[1] ?? Number.NaN, n[2] ?? Number.NaN];
  });
}

function d3(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}

describe('reference datasets (test-data/reference-cases)', () => {
  it('are exactly the datasets the committed reference code builds (no missing, no stale)', () => {
    const onDisk = files.map((f) => f.rel).sort();
    const expected = built.map((f) => f.path).sort();
    expect(onDisk).toEqual(expected);
    expect(new Set(built.map((f) => String(f.data.id))).size).toBe(built.length);
  });

  it('reproduce bit-for-bit from the reference code (provenance fields excepted)', () => {
    for (const f of built) {
      const disk = files.find((x) => x.rel === f.path);
      expect(disk, f.path).toBeDefined();
      if (disk === undefined) continue;
      const diffs: string[] = [];
      sameContent(parse(disk.text), JSON.parse(JSON.stringify(f.data)), '', diffs);
      expect(diffs, f.path).toEqual([]);
    }
  });

  it('carry provenance with a code revision', () => {
    for (const f of files) {
      const pb = obj(parse(f.text).producedBy);
      expect(
        typeof pb.codeRevision === 'string' && /^[0-9a-f]{7,40}$/.test(pb.codeRevision),
        f.rel,
      ).toBe(true);
    }
  });

  it('contain only finite numbers written as shortest round-trip decimals', () => {
    for (const f of files) {
      walkNumbers(parse(f.text), (n) => {
        expect(Number.isFinite(n), f.rel).toBe(true);
      });
      // Every numeric token of the file text (outside string literals) is the shortest round-trip
      // form of its value.
      const noStrings = f.text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
      const tokens =
        noStrings.match(/(?<=[\s[:,])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?=[\s,\]}])/g) ?? [];
      expect(tokens.length, f.rel).toBeGreaterThan(0);
      for (const tok of tokens) {
        const v = Number(tok);
        expect(String(v) === tok || JSON.stringify(v) === tok, `${f.rel}: ${tok}`).toBe(true);
      }
    }
  });

  it('have inputs that validate with the @mission-lab/contracts validators', () => {
    for (const f of files) {
      const d = parse(f.text);
      const inputs = obj(d.inputs);
      if (inputs.request !== undefined) {
        const res = validateSimulationRequest(inputs.request);
        expect(res.ok, f.rel).toBe(true);
        if (res.ok) {
          const { requestId, ...body } = res.value;
          expect(requestId, f.rel).toBe(requestIdOf(body));
        }
      }
      if (inputs.constants !== undefined) {
        expect(physicalConstantsSchema.safeParse(inputs.constants).success, f.rel).toBe(true);
      }
      for (const key of ['elements', 'gridElements']) {
        if (inputs[key] !== undefined) {
          expect(keplerianElementsSchema.safeParse(inputs[key]).success, `${f.rel} ${key}`).toBe(
            true,
          );
        }
      }
      if (inputs.state !== undefined) {
        expect(cartesianStateSchema.safeParse(inputs.state).success, f.rel).toBe(true);
      }
    }
  });

  it('VT-05: stored L2a and L2b agree within M·P_A + 2E_RK, and their accuracy records hold', () => {
    const vt05 = files.filter((f) => f.rel.includes('/vt-05/'));
    expect(vt05.length).toBe(9);
    for (const f of vt05) {
      const d = parse(f.text);
      const out = obj(d.outputs);
      const t = nums(out.t_s);
      const a = obj(out.l2a);
      const b = obj(out.l2b);
      const ar = vecs(a.position_m);
      const av = vecs(a.velocity_mps);
      const br = vecs(b.position_m);
      const bv = vecs(b.velocity_mps);
      const eR = nums(b.eRk_r_m);
      const eV = nums(b.eRk_v_mps);
      const ev = obj(obj(d.tolerance).evaluatedAt);
      const sc = scales(Number(ev.mu_m3ps2), Number(ev.a_m), Number(ev.e));
      const acc = obj(d.referenceAccuracy);
      const accA = obj(acc.l2a);
      const accB = obj(acc.l2b);
      expect(accB.allAsymptotic, f.rel).toBe(true);
      const req = obj(obj(d.inputs).request);
      const s0 = obj(req.initialState);
      expect(ar[0]).toEqual(nums(s0.position_m));
      expect(av[0]).toEqual(nums(s0.velocity_mps));
      t.forEach((ti, k) => {
        const tol = l2aVsL2b(sc, ti, eR[k] ?? Number.NaN, eV[k] ?? Number.NaN);
        expect(d3(ar[k] ?? [], br[k] ?? []), `${f.rel} k=${String(k)}`).toBeLessThanOrEqual(
          tol.position_m,
        );
        expect(d3(av[k] ?? [], bv[k] ?? []), `${f.rel} k=${String(k)}`).toBeLessThanOrEqual(
          tol.velocity_mps,
        );
        expect(eR[k] ?? Number.NaN).toBeLessThanOrEqual(E_RK_TARGET_REL * sc.ra);
        expect(nums(accA.measured_r_m)[k] ?? Number.NaN).toBeLessThanOrEqual(
          nums(accA.bound_r_m)[k] ?? Number.NaN,
        );
        expect(nums(accA.measured_v_mps)[k] ?? Number.NaN).toBeLessThanOrEqual(
          nums(accA.bound_v_mps)[k] ?? Number.NaN,
        );
        expect(nums(accB.measured_r_m)[k] ?? Number.NaN).toBeLessThanOrEqual(2 * (eR[k] ?? 0));
        expect(nums(accB.measured_v_mps)[k] ?? Number.NaN).toBeLessThanOrEqual(2 * (eV[k] ?? 0));
      });
    }
  });

  it('VT-02: measured L2c error is within its stated bound', () => {
    for (const f of files.filter((x) => x.rel.includes('/vt-02/'))) {
      const acc = obj(parse(f.text).referenceAccuracy);
      expect(Number(acc.measured_position_m), f.rel).toBeLessThanOrEqual(
        Number(acc.bound_position_m),
      );
      expect(Number(acc.measured_velocity_mps), f.rel).toBeLessThanOrEqual(
        Number(acc.bound_velocity_mps),
      );
    }
  });
});
