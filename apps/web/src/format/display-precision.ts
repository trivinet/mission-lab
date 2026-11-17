/**
 * Display resolution of the comparison table (ML-TASK-034; tolerances.md §5).
 *
 * THE RULE. A value of the table is converted to its display unit (units.ts), then shown with a
 * FIXED number of decimals that depends on the quantity's unit, and nothing else:
 *
 *   - m   -> km,      3 decimals  (resolution 1 m;      tolerances.md §5)
 *   - rad -> deg,     3 decimals  (resolution 0.001 deg; tolerances.md §5 names 0.001 deg steps)
 *   - m^2/s^2 -> km^2/s^2, 6 decimals (1e-6 km^2/s^2 = 1 m^2/s^2; about v * dv for dv = 1 mm/s at
 *                     a few km/s, the §5 velocity resolution)       [derived from §5, not stated there]
 *   - s -> s,         3 decimals  (resolution 1 ms)                 [product choice, not in §5]
 *   - dimensionless,  6 decimals  (eccentricity)                    [product choice, not in §5]
 *
 * A value that rounds to zero at that resolution (round-off such as Omega = 7e-16 deg when the
 * input is 0) is shown as zero with the same decimals, never as "-0.000" and never in
 * exponential notation, and is flagged `roundedToZero` so the table can say so. A nonzero value
 * that rounds to zero is NOT hidden: the full value stays available through `exactText`.
 *
 * This is formatting only. It changes no stored or plotted value (VI-03 (a) compares the module's
 * numbers with the plot, not with this text). `toFixed` is fine here: it is a display resolution,
 * unlike the CSV export, which must round-trip (csv-export.ts).
 */
import { displayUnit } from './units';

/** Decimals shown for each analysis-module unit string. */
const DECIMALS: Readonly<Record<string, number>> = {
  m: 3,
  rad: 3,
  'm^2/s^2': 6,
  s: 3,
};
const DEFAULT_DECIMALS = 6;

export function displayDecimals(unit: string): number {
  return DECIMALS[unit] ?? DEFAULT_DECIMALS;
}

export interface DisplayedValue {
  /** The text shown in the cell (no unit; the unit has its own column). */
  readonly text: string;
  /** The value is nonzero but zero at the display resolution. */
  readonly roundedToZero: boolean;
  /** Full precision, for a tooltip or a copy: display value and the SI value, both round-trip. */
  readonly exactText: string;
}

/** Shows `value_si` (analysis-module unit `unit`) at the display resolution. */
export function formatComparisonValue(value_si: number, unit: string): DisplayedValue {
  const { symbol, fromSi } = displayUnit(unit);
  const converted = fromSi(value_si);
  const decimals = displayDecimals(unit);
  let text = converted.toFixed(decimals);
  // A negative value that rounds to zero would print as "-0.000": show plain zero.
  const isZeroText = Number(text) === 0;
  if (isZeroText) {
    text = (0).toFixed(decimals);
  }
  const shownUnit = symbol === '' ? 'dimensionless' : symbol;
  const siUnit = unit === '1' ? 'dimensionless' : unit;
  return {
    text,
    roundedToZero: isZeroText && value_si !== 0,
    exactText: `${String(converted)} ${shownUnit} (SI: ${String(value_si)} ${siUnit})`,
  };
}
