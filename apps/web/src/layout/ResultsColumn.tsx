/** Right column: diagnostics (errors, warnings) and a summary of the shown result. */
import { useStore } from 'zustand';
import { ModelPanel } from '../model-panel';
import { getScenarioStore } from '../state/scenario-store';

export function ResultsColumn() {
  const resultState = useStore(getScenarioStore(), (s) => s.resultState);

  const diagnostics =
    resultState.kind === 'error'
      ? resultState.diagnostics
      : resultState.kind === 'current'
        ? resultState.warnings
        : [];
  const shown =
    resultState.kind === 'current' || resultState.kind === 'stale' ? resultState.result : null;
  // A count of the samples the engine returned, not a computed physical quantity.
  const sampleCount =
    shown === null ? null : shown.segments.reduce((n, segment) => n + segment.t_s.length, 0);

  return (
    <div
      className="col"
      role="group"
      aria-label="Results and assumptions"
      data-state={resultState.kind}
    >
      <section className="panel" aria-labelledby="h-diag" data-testid="diagnostics-panel">
        <h2 id="h-diag">Diagnostics</h2>
        {resultState.kind === 'error' && diagnostics.length === 0 && (
          <div className="diag err" data-testid="diagnostic">
            <b>
              <span aria-hidden="true">&#10005;</span> Error:
            </b>{' '}
            <span>{resultState.message}</span>
          </div>
        )}
        {diagnostics.map((d, i) => (
          <div
            key={i}
            className={d.severity === 'error' ? 'diag err' : 'diag warn'}
            data-testid="diagnostic"
            data-severity={d.severity}
          >
            <b>
              <span aria-hidden="true">{d.severity === 'error' ? '✕' : '▲'}</span>{' '}
              {d.severity === 'error' ? 'Error' : 'Warning'} <span className="code">{d.code}</span>:
            </b>{' '}
            <span>{d.message}</span>
          </div>
        ))}
        {diagnostics.length === 0 && resultState.kind !== 'error' && (
          <p className="note" style={{ marginTop: 0 }}>
            {resultState.kind === 'current' ? 'No diagnostics.' : 'No diagnostics to show.'}
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="h-sum" data-testid="summary-panel">
        <h2 id="h-sum">
          Result <span className="tag">engine output</span>
        </h2>
        <dl className="out">
          <dt>Samples</dt>
          <dd
            data-testid="sample-count"
            className={resultState.kind === 'stale' ? 'stale-val' : ''}
          >
            {sampleCount === null ? '—' : String(sampleCount)}
          </dd>
          <dt>Maneuver events</dt>
          <dd data-testid="event-count" className={resultState.kind === 'stale' ? 'stale-val' : ''}>
            {shown === null ? '—' : String(shown.events.length)}
          </dd>
        </dl>
        {resultState.kind === 'stale' && (
          <p className="note">Stale: from the previous run, not the current inputs.</p>
        )}
      </section>

      <ModelPanel resultState={resultState} />
    </div>
  );
}
