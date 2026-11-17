/**
 * Display unit conversions (the only conversions the UI performs; ML-TASK-022, AGENTS.md).
 *
 * State stays in SI (m, rad). The user types km and degrees; a typed value is converted ONCE, by
 * the `from*` function, and that result is what the store holds. The `to*` functions are used only
 * to show a stored value. These are unit scalings, not physics.
 */
import { utcIsoAtElapsed } from '@mission-lab/simulation';

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
 * UTC label of an elapsed time: the engine's `utcIsoAtElapsed` (epoch + t_s, millisecond
 * precision, no leap-second handling; ADR-004). Null when the engine declines. No date
 * arithmetic happens in the UI.
 */
export function utcLabel(epochIso: string, elapsed_s: number): string | null {
  const label = utcIsoAtElapsed(epochIso, elapsed_s);
  return label.ok ? label.iso : null;
}

/** m^2/s^2 -> km^2/s^2 (unit scaling only). */
export function toKm2ps2(value_m2ps2: number): number {
  return value_m2ps2 / 1e6;
}

/** How a quantity of an SI unit (as the analysis module reports it) is shown. */
export interface DisplayUnit {
  /** Symbol shown after the number; '' for a dimensionless quantity. */
  readonly symbol: string;
  /** SI -> display scaling (unit scaling only). */
  readonly fromSi: (value: number) => number;
}

/** Display unit of an analysis-module unit string (km, km/s, deg, km^2/s^2, s, none). */
export function displayUnit(unit: string): DisplayUnit {
  switch (unit) {
    case 'm':
      return { symbol: 'km', fromSi: toKm };
    case 'm/s':
      return { symbol: 'km/s', fromSi: toKm };
    case 'rad':
      return { symbol: 'deg', fromSi: toDeg };
    case 'm^2/s^2':
      return { symbol: 'km²/s²', fromSi: toKm2ps2 };
    case 's':
      return { symbol: 's', fromSi: identity };
    default:
      return { symbol: '', fromSi: identity };
  }
}

/** A number of an analysis-module unit, converted for display, without its unit. */
export function formatDisplayValue(value_si: number, unit: string): string {
  return formatInputNumber(displayUnit(unit).fromSi(value_si));
}

/** The same with its unit symbol; dimensionless quantities have none. */
export function formatWithUnit(value_si: number, unit: string): string {
  const { symbol } = displayUnit(unit);
  const text = formatDisplayValue(value_si, unit);
  return symbol === '' ? text : `${text} ${symbol}`;
}
