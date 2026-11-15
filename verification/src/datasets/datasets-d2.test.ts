/**
 * Reference-side checks of the ML-TASK-018 part D2 datasets (no engine involved):
 * - vt-15-r4: same request as version 1; every revision-4 value ≤ the version-1 approved value
 *   where one exists (no loosening, tolerances.md §7 VT-15 table note);
 * - vt-16-r4: same request as version 1; inside the validity gate; L2b in the asymptotic regime with
 *   E_RK ≤ 1e-10 r_max (§9.2 target, no loosening); L2b agrees with the independent 200-bit
 *   hyperbolic propagation within 2E_RK (validation of the reference, §9.2);
 * - l3-r4-*: one tolerance file per Orekit dataset, pinned to its id, version and generator commit;
 *   for every m = 0 maneuver file, Orekit's event pre-maneuver state equals the request's
 *   initialState (the precondition of the VT-12/VT-15 L3 rows, §9.3.1).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { E_RK_TARGET_REL } from '../tol/tolerances';
import { VT16_VALIDITY_GATE } from '../tol/tolerances-r4';
import { listL3, readL3 } from './build-d2';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
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

const o = (x: unknown): Json => x as Json;
const nums = (x: unknown): number[] => x as number[];

describe('part D2 datasets: vt-15-r4', () => {
  const v2 = load('vt-15-r4');
  const v1 = load('vt-15');
  it('cover the fourteen version-1 cases with the same requests', () => {
    expect(v2.map((f) => f.file.split('/')[1])).toEqual(v1.map((f) => f.file.split('/')[1]));
    v2.forEach((f, k) => {
      const old = v1[k];
      expect(old).toBeDefined();
      expect(o(o(f.data.inputs).request).requestId).toBe(o(o(old?.data.inputs).request).requestId);
      expect(f.data.version).toBe(2);
    });
  });

  it('never exceed the approved version-1 values (no loosening)', () => {
    v2.forEach((f, k) => {
      const t2 = o(f.data.tolerance);
      const t1 = o(v1[k]?.data.tolerance);
      if (typeof t1.semiMajorAxis_rel === 'number') {
        expect(Number(t2.semiMajorAxis_rel), f.file).toBeLessThanOrEqual(t1.semiMajorAxis_rel);
        expect(Number(t2.eccentricity_abs), f.file).toBeLessThanOrEqual(
          Number(t1.eccentricity_abs),
        );
      }
      for (const key of [
        'semiMajorAxis_rel',
        'eccentricity_abs',
        'planeNormal_rad',
        'planeRotation_rad',
      ]) {
        expect(Number(t2[key]) > 0, `${f.file} ${key}`).toBe(true);
      }
    });
  });
});

describe('part D2 datasets: vt-16-r4 (L2b hyperbolic references)', () => {
  const v2 = load('vt-16-r4');
  it('are the four hyperbolic arcs inside the validity gate, same requests as version 1', () => {
    expect(v2.map((f) => f.file)).toEqual([
      'vt-16-r4/c3-midrun-escape.json',
      'vt-16-r4/escape-clear.json',
      'vt-16-r4/hyperbolic-inbound.json',
      'vt-16-r4/hyperbolic-outbound.json',
    ]);
    const v1 = load('vt-16');
    for (const f of v2) {
      const name = f.file.split('/')[1];
      const old = v1.find((x) => x.file.split('/')[1] === name);
      expect(o(o(f.data.inputs).request).requestId).toBe(o(o(old?.data.inputs).request).requestId);
      const arc = o(o(f.data.outputs).arc);
      expect(Number(arc.energyOverScaleAtStart)).toBeGreaterThanOrEqual(VT16_VALIDITY_GATE);
    }
  });

  it('L2b: asymptotic, E_RK within the §9.2 target, and within 2E_RK of the 200-bit hyperbolic propagation', () => {
    for (const f of v2) {
      const out = o(f.data.outputs);
      const l2b = o(out.l2b);
      const arc = o(out.arc);
      expect(l2b.allAsymptotic).toBe(true);
      const eR = nums(l2b.eRk_r_m);
      const eV = nums(l2b.eRk_v_mps);
      const acc = o(f.data.referenceAccuracy);
      const mR = nums(acc.measured_r_m);
      const mV = nums(acc.measured_v_mps);
      eR.forEach((x, k) => {
        if (k === 0) return;
        expect(x, `${f.file} k=${String(k)}`).toBeLessThanOrEqual(
          E_RK_TARGET_REL * Number(arc.r_max_m),
        );
        expect(mR[k] ?? NaN, `${f.file} k=${String(k)} r`).toBeLessThanOrEqual(2 * x);
        expect(mV[k] ?? NaN, `${f.file} k=${String(k)} v`).toBeLessThanOrEqual(2 * (eV[k] ?? NaN));
      });
      const tol = o(f.data.tolerance);
      expect(tol.assertion).toBe('informative');
      const tR = nums(tol.vsL2b_position_m);
      const bR = nums(tol.engineBound_position_m);
      tR.forEach((x, k) => {
        expect(x).toBe(k === 0 ? 0 : (bR[k] ?? NaN) + 2 * (eR[k] ?? NaN));
      });
    }
  });
});

describe('part D2 datasets: l3-r4 tolerance files', () => {
  for (const family of ['vt-02', 'vt-05', 'vt-12', 'vt-15', 'vt-16']) {
    it(`${family}: one tolerance file per Orekit dataset, pinned to it`, () => {
      const tolFiles = load(`l3-r4-${family}`);
      const l3 = listL3(family);
      expect(tolFiles.map((f) => f.file.split('/')[1])).toEqual(
        l3.map((n) => n.replace(/^l3-orekit-/, '')),
      );
      tolFiles.forEach((f, k) => {
        const d = readL3(family, l3[k] ?? '');
        const src = o(o(f.data.inputs).l3);
        expect(src.dataset).toBe(d.id);
        expect(src.version).toBe(d.version);
        expect(src.generatorRevision).toBe(d.producedBy.codeRevision);
      });
    });
  }

  it('m = 0 maneuver files: Orekit event pre-maneuver state = request initialState (§9.3.1 precondition)', () => {
    for (const family of ['vt-12', 'vt-15', 'vt-16']) {
      for (const n of listL3(family)) {
        const d = readL3(family, n);
        const req = o(o(d.inputs).requestBody);
        const m0 = o((req.maneuvers as unknown[])[0]);
        if (m0.t_s !== 0) continue;
        const ev = o(o(d.outputs).event);
        const init = o(req.initialState);
        expect(ev.position_m, n).toEqual(init.position_m);
        expect(ev.velocityBefore_mps, n).toEqual(init.velocity_mps);
      }
    }
  });
});
