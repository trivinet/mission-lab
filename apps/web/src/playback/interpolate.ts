/**
 * Display interpolation of the spacecraft position between engine samples (ML-FR-008 AC3,
 * proposed-architecture.md section 5, Playback row; contracts-v1 section 14, Playback).
 *
 * DISPLAY ONLY. The values returned for a time that is not an engine sample time are not engine
 * output and must never feed a plot, a read-out of a physical quantity or an analysis. They exist
 * so the marker moves smoothly. At an engine sample time the engine sample is returned exactly
 * (same binary64 values, no arithmetic), so the scene shows Math.fround(sample * s) there (VI-02).
 *
 * Rules:
 * - Within one segment only. A segment is never mixed with its neighbour: the maneuver
 *   discontinuity (a velocity jump at a shared position) is never interpolated across.
 * - At a time that is an engine sample time of several segments (a maneuver time: the last sample
 *   of segment n and the first of segment n + 1) the LATER segment is used, so the post-maneuver
 *   segment n + 1 is shown (contracts-v1 section 14).
 * - A time before the first sample or after the last one is clamped to it.
 */

/** The part of a result segment the interpolation reads (structural, so tests can pass literals). */
export interface InterpolationSegment {
  readonly index: number;
  /** Sample times, s from epoch, strictly increasing. */
  readonly t_s: ArrayLike<number>;
  /** [x0, y0, z0, x1, ...] in m. */
  readonly position_m: ArrayLike<number>;
  /** [vx0, vy0, vz0, vx1, ...] in m/s. */
  readonly velocity_mps: ArrayLike<number>;
}

export interface DisplayPosition {
  /** Index of the segment the position belongs to. */
  readonly segmentIndex: number;
  /** Index of the engine sample when t_s is a sample time of that segment, otherwise null. */
  readonly sampleIndex: number | null;
  /** True when the position is interpolated (display only), false when it is an engine sample. */
  readonly interpolated: boolean;
  /** The time the position refers to, s: the requested time clamped to the result's span. */
  readonly t_s: number;
  /** Position, m, inertial GCRF. */
  readonly position_m: readonly [number, number, number];
}

/**
 * Cubic Hermite interpolation of one coordinate between two samples of one segment.
 *
 * With h = t1 - t0 and u = (t - t0) / h, the position is
 *
 *   p(t) = h00(u) p0 + h10(u) h v0 + h01(u) p1 + h11(u) h v1
 *
 *   h00 = 2u^3 - 3u^2 + 1    h10 = u^3 - 2u^2 + u
 *   h01 = -2u^3 + 3u^2       h11 = u^3 - u^2
 *
 * so that p(t0) = p0, p(t1) = p1, p'(t0) = v0 and p'(t1) = v1 (the basis functions of the cubic
 * Hermite spline). The velocities are the engine's velocity samples, in m/s. Not used at u = 0 or
 * u = 1: those are sample times and the sample is returned as is by displayPositionAt.
 */
export function hermite(
  t0_s: number,
  t1_s: number,
  p0_m: number,
  p1_m: number,
  v0_mps: number,
  v1_mps: number,
  t_s: number,
): number {
  const h = t1_s - t0_s;
  const u = (t_s - t0_s) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * p0_m + h10 * h * v0_mps + h01 * p1_m + h11 * h * v1_mps;
}

function sampleAt(segment: InterpolationSegment, i: number): [number, number, number] {
  return [
    segment.position_m[3 * i] ?? Number.NaN,
    segment.position_m[3 * i + 1] ?? Number.NaN,
    segment.position_m[3 * i + 2] ?? Number.NaN,
  ];
}

/** First and last sample time of a segment (segments always hold at least one sample). */
function span(segment: InterpolationSegment): { first: number; last: number } {
  return {
    first: segment.t_s[0] ?? Number.NaN,
    last: segment.t_s[segment.t_s.length - 1] ?? Number.NaN,
  };
}

/** Start and end time of the whole result, s (first sample of the first segment, last of the last). */
export function resultTimeSpan_s(
  segments: readonly InterpolationSegment[],
): { start_s: number; end_s: number } | null {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  return { start_s: span(first).first, end_s: span(last).last };
}

/** The display position at t_s (see the module comment for the rules). Null for no segments. */
export function displayPositionAt(
  segments: readonly InterpolationSegment[],
  t_s: number,
): DisplayPosition | null {
  const whole = resultTimeSpan_s(segments);
  if (whole === null) {
    return null;
  }
  const t = Math.min(Math.max(t_s, whole.start_s), whole.end_s);

  // Last segment whose span contains t: at a maneuver time that is segment n + 1.
  let segment: InterpolationSegment | undefined;
  for (let n = segments.length - 1; n >= 0; n -= 1) {
    const candidate = segments[n];
    if (candidate === undefined) {
      continue;
    }
    const { first, last } = span(candidate);
    if (first <= t && t <= last) {
      segment = candidate;
      break;
    }
  }
  if (segment === undefined) {
    return null;
  }

  // Bracketing interval by binary search, then the explicit sample-time check.
  const times = segment.t_s;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? Number.NaN) <= t) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  for (const i of [lo, hi]) {
    if (times[i] === t) {
      return {
        segmentIndex: segment.index,
        sampleIndex: i,
        interpolated: false,
        t_s: t,
        position_m: sampleAt(segment, i),
      };
    }
  }

  const t0 = times[lo] ?? Number.NaN;
  const t1 = times[hi] ?? Number.NaN;
  const p0 = sampleAt(segment, lo);
  const p1 = sampleAt(segment, hi);
  const v = (i: number, k: number): number => segment.velocity_mps[3 * i + k] ?? Number.NaN;
  return {
    segmentIndex: segment.index,
    sampleIndex: null,
    interpolated: true,
    t_s: t,
    position_m: [
      hermite(t0, t1, p0[0], p1[0], v(lo, 0), v(hi, 0), t),
      hermite(t0, t1, p0[1], p1[1], v(lo, 1), v(hi, 1), t),
      hermite(t0, t1, p0[2], p1[2], v(lo, 2), v(hi, 2), t),
    ],
  };
}
