/**
 * Display unit conversions (the only conversions the UI performs; ML-TASK-022, AGENTS.md).
 *
 * State stays in SI (m, rad). The user types km and degrees; a typed value is converted ONCE, by
 * the `from*` function, and that result is what the store holds. The `to*` functions are used only
 * to show a stored value. These are unit scalings, not physics.
 */

/** m -> km. */
export function toKm(value_m: number): number {
  return value_m / 1000;
}

/** km -> m. */
export function fromKm(value_km: number): number {
  return value_km * 1000;
}

/** rad -> deg. */
export function toDeg(value_rad: number): number {
  return (value_rad * 180) / Math.PI;
}

/** deg -> rad. */
export function fromDeg(value_deg: number): number {
  return (value_deg * Math.PI) / 180;
}

/** Identity: for fields shown in their SI unit. */
export function identity(value: number): number {
  return value;
}

/**
 * Parses what the user typed. Blank or unparseable text is NaN, which the engine's validation
 * rejects with a field-level message (NON_FINITE_NUMBER); the UI does not invent a value.
 */
export function parseNumber(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') {
    return Number.NaN;
  }
  return Number(trimmed);
}

/** Text for a number in an input: up to 12 significant digits, no trailing zeros. */
export function formatInputNumber(value: number): string {
  if (Number.isNaN(value)) {
    return '';
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return String(Number(value.toPrecision(12)));
}

/**
 * UTC label of an elapsed time: epoch + t_s, millisecond precision, no leap-second handling
 * (the documented time convention, ADR-004 and `TIME_CONVENTION` of the engine). Null when the
 * result is not a representable instant.
 */
export function utcLabel(epochIso: string, elapsed_s: number): string | null {
  const ms = Date.parse(epochIso) + elapsed_s * 1000;
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) {
    return null;
  }
  return new Date(ms).toISOString();
}
