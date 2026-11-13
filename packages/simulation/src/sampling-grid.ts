/**
 * Sampling grid and segment split of a run (contracts-v1 §5.2, normative; owner decision 2 of
 * 2026-11-11).
 *
 * For D = duration_s, h = outputStep_s and maneuver times m_1 … m_k (seconds from the epoch):
 *   1. grid candidates t_j = fl(j × h) (ONE binary64 multiplication of the integer j by h, never
 *      accumulated), j = 0, 1, …, kept while t_j < D (strict); t_0 = +0;
 *   2. D itself;
 *   3. each m_i; a grid point or D equal (===) to m_i is not duplicated and the single sample
 *      takes the value m_i (matters only for m_i = −0).
 * The union is sorted increasingly. Segment n holds every sample t with b_n ≤ t ≤ b_{n+1}, with
 * b_0 = 0, b_i = m_i, b_{k+1} = D, so a boundary time appears once in each adjacent segment.
 *
 * Monotonicity used below: x ↦ fl(x) is non-decreasing (round to nearest), so j ↦ fl(j × h) is
 * non-decreasing; it is strictly increasing for j < 2^51 (contracts-v1 §5.2, last paragraph).
 *
 * Units: seconds. No physics. Pure functions.
 */

/** Above this many grid candidates the count is not resolved exactly (contracts-v1 §5.2). */
const EXACT_COUNT_LIMIT = 2 ** 51;

/**
 * Number of grid candidates t_j = fl(j × h) < D (rule 1), i.e. the smallest j with fl(j × h) ≥ D.
 *
 * @param duration_s D [s], finite, > 0.
 * @param outputStep_s h [s], finite, > 0.
 * @returns The exact count when it is below 2^51. Otherwise a number ≥ 2^51 (the estimate
 *   ceil(D/h) or +Infinity if D/h overflows): far above any sample limit, so only "too many"
 *   is meaningful then.
 */
export function gridCandidateCount(duration_s: number, outputStep_s: number): number {
  const estimate = Math.ceil(duration_s / outputStep_s);
  if (!(estimate < EXACT_COUNT_LIMIT)) {
    return estimate;
  }
  // fl(D/h) is within a relative 2^-53 of D/h, so the estimate is within one or two of the
  // answer; the loops correct it using only the defining products (monotone in j).
  let j = estimate;
  while (j > 0 && (j - 1) * outputStep_s >= duration_s) {
    j--;
  }
  while (j * outputStep_s < duration_s) {
    j++;
  }
  return j;
}

/** True if some grid candidate fl(j × h), 0 ≤ j < candidateCount, is === t. */
function isGridCandidate(t: number, outputStep_s: number, candidateCount: number): boolean {
  // If fl(j h) = t then |t/h − j| < 1/2 for j < 2^51, so j = round(t/h); ±1 is a safety margin.
  const centre = Math.round(t / outputStep_s);
  for (let j = Math.max(0, centre - 1); j <= centre + 1 && j < candidateCount; j++) {
    if (j * outputStep_s === t) {
      return true;
    }
  }
  return false;
}

/**
 * Total number of samples of the §5.2 grid summed over all segments (boundary samples counted
 * once per segment), as checked by SAMPLE_COUNT_EXCEEDED (contracts-v1 §3, §5.2).
 *
 * @param duration_s D [s] > 0.  @param outputStep_s h [s] > 0.
 * @param maneuverTimes_s maneuver times [s], each in [0, D] (−0 allowed), any order.
 * @returns The count; computed without enumerating the grid (see gridCandidateCount for the
 *   meaning of values ≥ 2^51).
 */
export function sampleCount(
  duration_s: number,
  outputStep_s: number,
  maneuverTimes_s: readonly number[],
): number {
  const candidates = gridCandidateCount(duration_s, outputStep_s);
  let union = candidates + 1; // rule 2: D is never a candidate (candidates are < D).
  const extra: number[] = [];
  for (const m of maneuverTimes_s) {
    const duplicate =
      m === duration_s ||
      extra.includes(m) ||
      (candidates < EXACT_COUNT_LIMIT && isGridCandidate(m, outputStep_s, candidates));
    if (!duplicate) {
      extra.push(m);
      union += 1;
    }
  }
  // Each maneuver adds one segment, whose first sample repeats the previous segment's last.
  return union + maneuverTimes_s.length;
}

/** The sample times of one segment. */
export interface GridSegment {
  /** b_n [s]: 0 for segment 0, the maneuver time for later segments (bit-identical). */
  readonly start_s: number;
  /** Sample times [s], strictly increasing; the first equals b_n, the last b_{n+1}. */
  readonly times_s: readonly number[];
}

/**
 * The §5.2 grid split into segments.
 *
 * Precondition: the caller has checked `sampleCount` against the sample limit (the grid is
 * enumerated). Inputs as `sampleCount`.
 * @returns maneuverTimes_s.length + 1 segments; the maneuver times are taken in increasing order
 *   (stable for equal times), which is the order of the events.
 */
export function buildSamplingGrid(
  duration_s: number,
  outputStep_s: number,
  maneuverTimes_s: readonly number[],
): GridSegment[] {
  const candidates = gridCandidateCount(duration_s, outputStep_s);
  const times: number[] = [];
  for (let j = 0; j < candidates; j++) {
    times.push(j * outputStep_s); // rule 1: one multiplication, j exact
  }
  times.push(duration_s); // rule 2
  const boundaries = [...maneuverTimes_s].sort((a, b) => a - b);
  for (const m of boundaries) {
    const index = times.indexOf(m); // === comparison: −0 finds +0
    if (index >= 0) {
      times[index] = m; // rule 3: the shared sample takes the value m
    } else {
      times.push(m);
    }
  }
  times.sort((a, b) => a - b);

  const starts = [0, ...boundaries];
  const ends = [...boundaries, duration_s];
  return starts.map((start_s, n) => {
    const end = ends[n] ?? duration_s;
    return { start_s, times_s: times.filter((t) => start_s <= t && t <= end) };
  });
}
