/**
 * UTC labels of simulation times (ML-TASK-027; ML-FR-005 AC1; ADR-004 "Time").
 *
 * Time convention (TIME_CONVENTION in model.ts; contracts-v1 §2 "Epoch", "Simulation time";
 * ADR-004; proposed-architecture §3 "UTC labels"): the epoch is a UTC instant written
 * `YYYY-MM-DDTHH:MM:SS.sssZ`; every t_s is elapsed SI seconds since that epoch (binary64); the
 * displayed UTC timestamp is epoch + t_s WITHOUT leap-second handling. If a leap second falls
 * inside the span, labels after it are 1 s off (ADR-004 consequences; MODEL_LIMITATIONS).
 *
 * This is the one module that converts epoch + t_s to a displayed timestamp (ADR-004). It uses the
 * ECMAScript time value (milliseconds since 1970-01-01T00:00:00Z on a uniform 86 400 000 ms day,
 * i.e. leap seconds not counted), through `Date.parse` and `Date.prototype.toISOString`, exactly as
 * `isCanonicalUtcIso` of packages/contracts does. That leap-second-free day is what makes the
 * result "epoch + t_s without leap-second handling". (ECMA-262 §21.4.1 "Time Values and Time
 * Range" was not opened in this task; the behaviour is the one the contracts validator already
 * relies on and is checked by the unit tests.) No clock is read: `Date` is used only to parse and
 * format a given instant.
 */
import { isCanonicalUtcIso } from '@mission-lab/contracts';

/** Milliseconds per second (SI prefix). */
const MS_PER_S = 1000;

/**
 * Largest |time value| in ms that an ECMAScript Date can hold (ECMA-262 time range, ±1e8 days ×
 * 86 400 000 ms; not opened in this task). Beyond it `toISOString` throws, so it is checked first.
 */
const MAX_TIME_VALUE_ms = 8.64e15;

/** Why a label could not be produced. */
export type UtcLabelFailure =
  /** The epoch is not a canonical UTC ISO string (`isCanonicalUtcIso` is false). */
  | 'EPOCH_INVALID'
  /** t_s is NaN or ±Infinity. */
  | 'NON_FINITE_TIME'
  /** epoch + t_s is not representable as `YYYY-MM-DDTHH:MM:SS.sssZ` (year outside 0000–9999). */
  | 'OUT_OF_RANGE';

/** Result of `utcIsoAtElapsed`. */
export type UtcLabelResult =
  | { readonly ok: true; readonly iso: string }
  | { readonly ok: false; readonly reason: UtcLabelFailure };

/**
 * Parses a canonical epoch to its ECMAScript time value [ms since 1970-01-01T00:00:00Z, leap
 * seconds not counted]. Undefined when `isCanonicalUtcIso(epochIso)` is false. Internal.
 */
export function epochTimeValue_ms(epochIso: string): number | undefined {
  return isCanonicalUtcIso(epochIso) ? Date.parse(epochIso) : undefined;
}

/**
 * The UTC label of the instant epoch + t_s, as a canonical ISO string `YYYY-MM-DDTHH:MM:SS.sssZ`
 * (the form `isCanonicalUtcIso` accepts; contracts-v1 §2 "Epoch").
 *
 * Inputs: `epochIso`, the scenario epoch (UTC, canonical form, millisecond precision); `t_s`,
 * elapsed SI seconds since the epoch (any finite binary64; negative values give earlier instants).
 * Frame: none (time scale UTC, labels only; no physics).
 *
 * Evaluation (fixed):
 * 1. epochIso not canonical → EPOCH_INVALID; t_s not finite → NON_FINITE_TIME.
 * 2. epoch_ms = Date.parse(epochIso) (an integer: the epoch has whole milliseconds).
 * 3. offset_ms = Math.round(t_s * 1000): the label has millisecond resolution, so the elapsed time
 *    is rounded to the NEAREST millisecond, halves toward +∞ (Math.round). `t_s * 1000` is one
 *    binary64 multiplication; for t_s whose decimal millisecond part is exactly .5 the product may
 *    already be rounded, so a tie can fall either way by one ulp. Rounding the offset (not the sum)
 *    keeps every step exact integer arithmetic for |values| < 2^53.
 * 4. label_ms = epoch_ms + offset_ms; |label_ms| > 8.64e15 → OUT_OF_RANGE.
 * 5. iso = new Date(label_ms).toISOString(); not canonical (year outside 0000–9999) → OUT_OF_RANGE.
 *
 * Leap seconds: none (step 4 adds elapsed seconds on a uniform 86 400 s day). This is the M1
 * convention, not a claim about the true UTC label across a leap second.
 *
 * Sources: ADR-004 "Time"; contracts-v1 §2; TIME_CONVENTION (model.ts). Pure; never throws.
 */
export function utcIsoAtElapsed(epochIso: string, t_s: number): UtcLabelResult {
  const epoch_ms = epochTimeValue_ms(epochIso);
  if (epoch_ms === undefined) {
    return { ok: false, reason: 'EPOCH_INVALID' };
  }
  if (!Number.isFinite(t_s)) {
    return { ok: false, reason: 'NON_FINITE_TIME' };
  }
  const label_ms = epoch_ms + Math.round(t_s * MS_PER_S);
  if (!(Math.abs(label_ms) <= MAX_TIME_VALUE_ms)) {
    return { ok: false, reason: 'OUT_OF_RANGE' };
  }
  const iso = new Date(label_ms).toISOString();
  if (!isCanonicalUtcIso(iso)) {
    return { ok: false, reason: 'OUT_OF_RANGE' };
  }
  return { ok: true, iso };
}
