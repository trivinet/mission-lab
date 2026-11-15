/**
 * Helpers for running the engine's public runner and reading its columnar result (ML-TASK-018
 * part C). Test-side only: no reference value or tolerance is computed here.
 */
import type { SimulationResult } from '@mission-lab/contracts';
import { runSimulation } from '@mission-lab/simulation';
import type { V3 } from './datasets';

/** Runs a request that is expected to be structurally valid; throws with the issues otherwise. */
export function runRequest(request: unknown): SimulationResult {
  const res = runSimulation(request);
  if (!res.ok) {
    throw new Error(`runSimulation rejected the request: ${JSON.stringify(res.issues)}`);
  }
  return res.value;
}

export interface Sample {
  readonly segment: number;
  readonly k: number;
  readonly t: number;
  readonly r: V3;
  readonly v: V3;
}

export function samplesOf(result: SimulationResult): Sample[] {
  const out: Sample[] = [];
  result.segments.forEach((seg, n) => {
    for (let k = 0; k < seg.t_s.length; k++) {
      out.push({
        segment: n,
        k,
        t: seg.t_s[k] ?? NaN,
        r: [
          seg.position_m[3 * k] ?? NaN,
          seg.position_m[3 * k + 1] ?? NaN,
          seg.position_m[3 * k + 2] ?? NaN,
        ],
        v: [
          seg.velocity_mps[3 * k] ?? NaN,
          seg.velocity_mps[3 * k + 1] ?? NaN,
          seg.velocity_mps[3 * k + 2] ?? NaN,
        ],
      });
    }
  });
  return out;
}

export function segmentSamples(result: SimulationResult, n: number): Sample[] {
  return samplesOf(result).filter((s) => s.segment === n);
}

/** Bit pattern key of a binary64 (distinguishes −0 from +0). */
export function bitsKey(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

/**
 * Deep bit-identity: numbers by Object.is, typed arrays element by element (and same class and
 * length), arrays and plain objects recursively with the same keys. Returns the first difference.
 */
export function firstBitDifference(a: unknown, b: unknown, path = ''): string | null {
  if (typeof a === 'number' || typeof b === 'number') {
    return Object.is(a, b) ? null : `${path}: ${String(a)} vs ${String(b)}`;
  }
  if (a instanceof Float64Array || b instanceof Float64Array) {
    if (!(a instanceof Float64Array) || !(b instanceof Float64Array) || a.length !== b.length) {
      return `${path}: typed array class or length`;
    }
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i]))
        return `${path}[${String(i)}]: ${String(a[i])} vs ${String(b[i])}`;
    }
    return null;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return `${path}: array shape`;
    for (let i = 0; i < a.length; i++) {
      const d = firstBitDifference(a[i], b[i], `${path}[${String(i)}]`);
      if (d !== null) return d;
    }
    return null;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join(',') !== kb.join(',')) return `${path}: keys ${ka.join(',')} vs ${kb.join(',')}`;
    for (const k of ka) {
      const d = firstBitDifference(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
      );
      if (d !== null) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
}

/** Test-side binary64 helpers (the test's own evaluation, counted in the record's budgets). */
export function dot3(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function norm3(a: V3): number {
  return Math.sqrt(dot3(a, a));
}
