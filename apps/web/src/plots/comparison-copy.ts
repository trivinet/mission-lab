/**
 * The "copy exact values" text of the comparison table (ML-TASK-034): every cell at full
 * precision, in SI, as tab-separated text. Numbers are `String(x)`, the shortest decimal that
 * parses back to the same binary64. A value the analysis module reports as absent is `n/a`.
 * Formatting only.
 */
import type { ManeuverComparison } from '@mission-lab/simulation';

function cell(value: number | null): string {
  return value === null ? 'n/a' : Object.is(value, -0) ? '-0' : String(value);
}

export function exactComparisonText(maneuver: ManeuverComparison): string {
  const lines = [
    `# Maneuver ${maneuver.maneuverId} at t_s = ${cell(maneuver.t_s)}; SI units; difference = after - before`,
    'quantity\tunit_si\tbefore\tafter\tdifference',
    ...maneuver.rows.map((row) =>
      [row.quantity, row.unit, cell(row.before), cell(row.after), cell(row.difference)].join('\t'),
    ),
  ];
  return `${lines.join('\n')}\n`;
}
