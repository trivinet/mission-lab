/**
 * Independent construction of the normative sampling grid of contracts-v1.md §5.2 (owner
 * decision 2) for VI-01 and VT-09 (ML-TASK-018 part C). Written from the contract text only.
 *
 *  1. Candidates t_j = fl(j × h), one binary64 multiplication each (never accumulated), for
 *     j = 0, 1, 2, … while t_j < D (strict). t₀ = +0.
 *  2. D itself.
 *  3. Each maneuver time mᵢ; a candidate or D equal (===) to mᵢ is not duplicated and the single
 *     sample takes the value mᵢ (so a maneuver at −0 gives the sample time −0).
 * The union is sorted increasingly; values one ulp apart are distinct samples.
 * Segments: boundaries b₀ = 0, b₁ = m₁, …, b_{k+1} = D; segment n holds every sample t with
 * b_n ≤ t ≤ b_{n+1}, so a maneuver time appears as the last sample of one segment and the first
 * of the next.
 */

export interface GridResult {
  /** All distinct sample times, increasing. */
  readonly times: readonly number[];
  /** Sample times per segment (k maneuvers → k + 1 segments). */
  readonly segments: readonly (readonly number[])[];
  /** Total sample count as counted by SAMPLE_COUNT_EXCEEDED (boundary samples once per segment). */
  readonly sampleCount: number;
}

/** Grid candidates fl(j × h) < D. Throws if more than `limit` candidates would be produced. */
export function gridCandidates(duration_s: number, step_s: number, limit = 5_000_000): number[] {
  const out: number[] = [];
  for (let j = 0; ; j++) {
    const t = j * step_s;
    if (!(t < duration_s)) break;
    out.push(j === 0 ? 0 : t);
    if (out.length > limit) throw new RangeError('grid candidate limit exceeded');
  }
  return out;
}

/** Number of grid candidates without materialising them (same rule, counting only). */
export function countCandidates(duration_s: number, step_s: number): number {
  let j = 0;
  while (j * step_s < duration_s) j++;
  return j;
}

/**
 * Full §5.2 grid with maneuver times (k ≤ 1 in v1.0, but any sorted list is accepted).
 * maneuverTimes must lie in [0, D] (validated elsewhere).
 */
export function samplingGridWithManeuvers(
  duration_s: number,
  step_s: number,
  maneuverTimes: readonly number[],
): GridResult {
  const values: number[] = gridCandidates(duration_s, step_s);
  values.push(duration_s);
  for (const m of maneuverTimes) values.push(m);
  // Distinct by ===; for equal values the maneuver's own value is kept (only −0 vs +0 differs).
  const distinct: number[] = [];
  for (const v of values) {
    const idx = distinct.findIndex((x) => x === v);
    if (idx < 0) distinct.push(v);
  }
  for (const m of maneuverTimes) {
    const idx = distinct.findIndex((x) => x === m);
    if (idx >= 0) distinct[idx] = m;
  }
  distinct.sort((a, b) => a - b);
  const bounds = [0, ...maneuverTimes, duration_s];
  const segments: number[][] = [];
  for (let n = 0; n + 1 < bounds.length; n++) {
    const lo = bounds[n] ?? NaN;
    const hi = bounds[n + 1] ?? NaN;
    segments.push(distinct.filter((t) => t >= lo && t <= hi));
  }
  return {
    times: distinct,
    segments,
    sampleCount: segments.reduce((s, seg) => s + seg.length, 0),
  };
}

/**
 * Sample count of the §5.2 grid for large spans without materialising the candidates
 * (for SAMPLE_COUNT_EXCEEDED boundary cases). Candidates are counted; D and maneuver times add
 * one each unless equal to a candidate (or to D); each maneuver time is counted once more because
 * it appears in two segments.
 */
export function sampleCountLarge(
  duration_s: number,
  step_s: number,
  maneuverTimes: readonly number[],
): number {
  const nCand = countCandidates(duration_s, step_s);
  const isCandidate = (x: number): boolean => {
    // x is a candidate iff some j < nCand has fl(j × h) === x; check the nearest integers.
    const j0 = Math.round(x / step_s);
    for (let j = Math.max(0, j0 - 2); j <= j0 + 2; j++) {
      if (j < nCand && j * step_s === x) return true;
    }
    return false;
  };
  const extra: number[] = [];
  const add = (x: number): void => {
    if (!isCandidate(x) && !extra.some((y) => y === x)) extra.push(x);
  };
  add(duration_s);
  for (const m of maneuverTimes) add(m);
  return nCand + extra.length + maneuverTimes.length;
}
