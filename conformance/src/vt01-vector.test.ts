/**
 * VT-01 Vector utilities (L1) against the approved tolerances of tolerances.md §7 VT-01 (the
 * implementer's tests used provisional bounds) and the exact special inputs of §1, dataset
 * test-data/reference-cases/vt-01/vectors.json (phase 1). Engine functions: crossVec3, dotVec3,
 * normVec3, normalizeVec3, scaleVec3 (public API of packages/astrodynamics).
 */
import { crossVec3, dotVec3, normalizeVec3, normVec3, scaleVec3 } from '@mission-lab/astrodynamics';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { norm3 } from './support/run';

interface Vt01 {
  readonly inputs: { readonly triples: readonly { a: V3; b: V3; c: V3 }[] };
  readonly exactCases: {
    readonly crossUnit: { a: V3; b: V3; expected: V3 };
    readonly norms: readonly { x: V3; expected: number }[];
    readonly powerOfTwoScaling: { x: V3; factors: readonly number[] };
  };
  readonly tolerance: {
    readonly crossOrthogonality_rel: number;
    readonly tripleProduct_rel: number;
    readonly norm_rel: number;
    readonly unit_abs: number;
  };
}

const data = loadFamily('vt-01')[0]?.data as Vt01;
const ratios = new RatioRecorder('VT-01');

afterAll(() => {
  console.log(ratios.summary());
});

describe('VT-01 identities (approved tolerances)', () => {
  it('cross-product orthogonality, triple product, norm, normalisation on 200 triples', () => {
    const t = data.tolerance;
    const f: string[] = [];
    data.inputs.triples.forEach(({ a, b, c }, k) => {
      const na = norm3(a);
      const nb = norm3(b);
      const nc = norm3(c);
      const ab = crossVec3(a, b);
      const q1 = Math.abs(dotVec3(a, ab)) / (na * na * nb);
      const q2 = Math.abs(dotVec3(b, ab)) / (na * nb * nb);
      const q3 =
        Math.abs(dotVec3(a, crossVec3(b, c)) - dotVec3(b, crossVec3(c, a))) / (na * nb * nc);
      const q4 = Math.abs(normVec3(a) - na) / na;
      const u = normalizeVec3(a);
      const q5 = u.ok ? Math.abs(norm3(u.unit) - 1) : Infinity;
      const where = `triple ${String(k)}`;
      for (const [name, q, tol] of [
        ['(a) |a·(a×b)|', q1, t.crossOrthogonality_rel],
        ['(a) |b·(a×b)|', q2, t.crossOrthogonality_rel],
        ['(b) triple product', q3, t.tripleProduct_rel],
        ['(c) norm', q4, t.norm_rel],
        ['(d) unit norm', q5, t.unit_abs],
      ] as const) {
        ratios.record(name, q, tol, where);
        if (!(q <= tol))
          f.push(`${where} ${name}: ${q.toExponential(3)} > ${tol.toExponential(3)}`);
      }
    });
    expect(f).toEqual([]);
  });

  it('exact special inputs (tolerances.md §1)', () => {
    const ex = data.exactCases;
    const c = crossVec3(ex.crossUnit.a, ex.crossUnit.b);
    expect([0, 1, 2].every((i) => c[i] === ex.crossUnit.expected[i])).toBe(true);
    for (const n of ex.norms) expect(normVec3(n.x)).toBe(n.expected);
    for (const k of ex.powerOfTwoScaling.factors) {
      const s = scaleVec3(k, ex.powerOfTwoScaling.x);
      const x = ex.powerOfTwoScaling.x;
      expect([0, 1, 2].every((i) => Object.is(s[i], k * (x[i] ?? NaN)))).toBe(true);
    }
  });
});
