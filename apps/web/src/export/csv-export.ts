/**
 * CSV export of a simulation result (ML-FR-014 AC1). Pure: no store, no browser API.
 *
 * FORMAT (UTF-8, LF line endings, one final newline, no BOM):
 *   - Header block: lines that start with `# `, giving what the numbers are: the document, frame,
 *     epoch (with its time scale), the meaning of `t_s`, the units, the request id, the model and
 *     the segment convention. A reader skips lines that start with `#`.
 *   - One column-name row, with the unit in each name:
 *       segment,t_s,x_m,y_m,z_m,vx_mps,vy_mps,vz_mps
 *   - One data row per sample of every segment, in segment order and time order.
 *
 * `segment` is the trajectory segment's `index`. A maneuver ends one segment and starts the next,
 * and its instant is a sample of BOTH (contract R8): it appears twice with the same `t_s` and
 * the same position, once with the velocity before and once with the velocity after the burn.
 * The segment column keeps the two sides explicit.
 *
 * NUMBERS: every value is written with `String(x)`, the ECMAScript Number-to-String shortest
 * decimal, so `Object.is(Number(cell), value)` holds (tolerances.md §1, §8 VI-01). Never
 * `toFixed`. Negative zero is written `-0`, because `String(-0)` is `0` and would not round-trip.
 * The values are the result's values in SI, not converted.
 */
import type { SimulationResult } from '@mission-lab/contracts';

export const CSV_COLUMNS = [
  'segment',
  't_s',
  'x_m',
  'y_m',
  'z_m',
  'vx_mps',
  'vy_mps',
  'vz_mps',
] as const;

/** The shortest round-trip decimal of a finite number; -0 is `-0`. */
export function csvNumber(value: number): string {
  return Object.is(value, -0) ? '-0' : String(value);
}

export type CsvResult =
  | { readonly ok: true; readonly text: string; readonly rowCount: number }
  | { readonly ok: false; readonly reason: 'RESULT_FAILED' };

export function resultToCsv(result: SimulationResult): CsvResult {
  if (result.status !== 'ok') {
    return { ok: false, reason: 'RESULT_FAILED' };
  }
  const { model } = result;
  const lines: string[] = [
    '# Mission Lab simulation result (ML-FR-014)',
    `# frame: ${model.frame} (inertial); central body: ${model.centralBody}`,
    `# epoch: ${model.epoch.iso} (time scale ${model.epoch.scale}); t_s is elapsed seconds since this epoch`,
    '# units: t_s in s; x_m, y_m, z_m position in m; vx_mps, vy_mps, vz_mps velocity in m/s (SI, not converted)',
    `# requestId: ${result.requestId}`,
    `# model: ${model.dynamicsModel}, ${model.propagator}, ${model.maneuverModel}`,
    '# segment: trajectory segment index. A maneuver instant is the last row of one segment and the first row of the next (same t_s and position, velocity before then after the burn)',
    '# numbers: shortest round-trip decimals; Number(cell) equals the result value exactly',
    CSV_COLUMNS.join(','),
  ];
  let rowCount = 0;
  for (const segment of result.segments) {
    for (let k = 0; k < segment.t_s.length; k += 1) {
      const cells = [
        String(segment.index),
        csvNumber(segment.t_s[k] ?? Number.NaN),
        ...[0, 1, 2].map((c) => csvNumber(segment.position_m[3 * k + c] ?? Number.NaN)),
        ...[0, 1, 2].map((c) => csvNumber(segment.velocity_mps[3 * k + c] ?? Number.NaN)),
      ];
      lines.push(cells.join(','));
      rowCount += 1;
    }
  }
  return { ok: true, text: `${lines.join('\n')}\n`, rowCount };
}

/** A file name for the download: the scenario name made safe, plus a fixed suffix. */
export function csvFileName(scenarioName: string): string {
  const slug = scenarioName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return `${slug === '' ? 'scenario' : slug}.result.csv`;
}
