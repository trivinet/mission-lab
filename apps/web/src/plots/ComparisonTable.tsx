/**
 * Coast-versus-maneuver comparison (ML-FR-010 AC2): before, after and difference of the orbit
 * quantities across the maneuver, and the applied Δv. Every number is the analysis module's
 * (compareCoastAndManeuver); this component only formats it. It is also the text alternative of
 * the plots (ADR-010 consequences): the table is plain HTML.
 */
import type { CompareResult, ComparisonRow, ManeuverComparison } from '@mission-lab/simulation';
import { displayUnit, formatDisplayValue, formatInputNumber } from '../format/units';
import { ABSENCE_TEXT, COMPARE_FAILURE_TEXT, COMPARISON_LABELS } from './quantity-labels';

type Side = 'before' | 'after' | 'difference';

function Cell({ row, side, stale }: { row: ComparisonRow; side: Side; stale: boolean }) {
  const value = row[side];
  const reason = row.absent[side];
  const testId = `cmp-${side}`;
  if (value === null) {
    return (
      <td data-testid={testId} data-absent={reason ?? 'UNKNOWN'} className="na">
        n/a
        <span className="absent-reason">
          {' '}
          ({reason === undefined ? 'not available' : ABSENCE_TEXT[reason]})
        </span>
      </td>
    );
  }
  return (
    <td data-testid={testId} data-value-si={String(value)} className={stale ? 'stale-val' : ''}>
      {formatDisplayValue(value, row.unit)}
    </td>
  );
}

function DeltaVRow({
  label,
  vector,
  testId,
}: {
  label: string;
  vector: readonly number[];
  testId: string;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>[{vector.map((c) => formatInputNumber(c)).join(', ')}] m/s</dd>
    </>
  );
}

function ManeuverBlock({ maneuver, stale }: { maneuver: ManeuverComparison; stale: boolean }) {
  const classification =
    maneuver.before.convention === maneuver.after.convention
      ? (maneuver.before.convention ?? 'n/a')
      : `${maneuver.before.convention ?? 'n/a'} before, ${maneuver.after.convention ?? 'n/a'} after`;
  return (
    <div data-testid="comparison-maneuver" data-maneuver-id={maneuver.maneuverId}>
      <h3 className="cmp-h">
        Maneuver {maneuver.maneuverId} at t = {formatInputNumber(maneuver.t_s)} s
      </h3>
      <dl className="out" aria-label="Applied delta-v">
        <DeltaVRow
          label="Δv, inertial (GCRF: X, Y, Z)"
          vector={maneuver.deltaV.inertial_mps}
          testId="cmp-dv-inertial"
        />
        <DeltaVRow
          label="Δv, RSW (radial, along-track, cross-track)"
          vector={maneuver.deltaV.rsw_mps}
          testId="cmp-dv-rsw"
        />
        <dt>|Δv|</dt>
        <dd data-testid="cmp-dv-magnitude">
          {formatInputNumber(maneuver.deltaV.magnitude_mps)} m/s
        </dd>
        <dt>Element convention (ADR-008)</dt>
        <dd data-testid="cmp-convention">{classification}</dd>
      </dl>
      <table className="cmp" data-testid="comparison-table">
        <caption className="sr-only">
          Orbit before and after maneuver {maneuver.maneuverId}, with the difference (after minus
          before)
        </caption>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Difference</th>
            <th scope="col">Unit</th>
          </tr>
        </thead>
        <tbody>
          {maneuver.rows.map((row) => {
            const { symbol } = displayUnit(row.unit);
            return (
              <tr key={row.quantity} data-testid={`comparison-row-${row.quantity}`}>
                <th scope="row">{COMPARISON_LABELS[row.quantity]}</th>
                <Cell row={row} side="before" stale={stale} />
                <Cell row={row} side="after" stale={stale} />
                <Cell row={row} side="difference" stale={stale} />
                <td className="unit-cell">{symbol === '' ? 'dimensionless' : symbol}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface ComparisonTableProps {
  readonly comparison: CompareResult | null;
  readonly stale: boolean;
  readonly hasResult: boolean;
}

export function ComparisonTable({ comparison, stale, hasResult }: ComparisonTableProps) {
  return (
    <section
      className="panel"
      aria-labelledby="h-compare"
      data-testid="comparison-panel"
      id="comparison-panel"
    >
      <h2 id="h-compare">
        Coast vs maneuver <span className="tag">computed</span>
      </h2>
      {!hasResult && <p className="note">No result yet: run the simulation.</p>}
      {hasResult && comparison === null && (
        <p className="note" data-testid="comparison-none">
          No maneuver in this result, so there is nothing to compare. Add a maneuver and run.
        </p>
      )}
      {comparison !== null && !comparison.ok && (
        <p className="diag err" data-testid="comparison-failed" role="status">
          Comparison unavailable: {COMPARE_FAILURE_TEXT[comparison.reason]}.
        </p>
      )}
      {comparison?.ok === true &&
        comparison.comparison.maneuvers.map((m) => (
          <ManeuverBlock key={m.maneuverId} maneuver={m} stale={stale} />
        ))}
      {stale && comparison?.ok === true && (
        <p className="note">Stale: from the previous run, not the current inputs.</p>
      )}
    </section>
  );
}
