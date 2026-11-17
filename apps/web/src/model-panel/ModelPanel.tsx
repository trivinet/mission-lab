/**
 * Model and assumptions panel (ML-TASK-025; ML-FR-012; ML-UX-004).
 *
 * Shows, for the current or stale result, the model that produced it, rendered from
 * `SimulationResult.model`. Nothing about the model is written here: labels are UI wording, every
 * value and every limitation comes from the result. The not-qualified statement is UI text and is
 * always visible, outside the collapsible part.
 */
import type { ResultState } from '../state/result-state';
import { modelRows } from './model-rows';

/** UI wording (for owner review): permanent, visible whatever the result state. */
export const NOT_QUALIFIED_STATEMENT =
  'Not qualified for operational use. Mission Lab is an educational and exploratory tool: do not use its results for real spacecraft navigation, mission planning or operations.';

export function ModelPanel({ resultState }: { readonly resultState: ResultState }) {
  const result =
    resultState.kind === 'current' || resultState.kind === 'stale' ? resultState.result : null;
  const model = result === null ? null : result.model;
  const stale = resultState.kind === 'stale';

  let absent = 'No model: there is no result yet. Run the scenario to see the model used.';
  if (resultState.kind === 'computing') {
    absent = 'Computing: the model will be shown when the run finishes.';
  } else if (resultState.kind === 'error') {
    absent = 'No model: the last run failed and produced no result.';
  }

  return (
    <section
      className="panel"
      aria-labelledby="h-model"
      data-testid="model-panel"
      data-model={model === null ? 'absent' : stale ? 'stale' : 'current'}
    >
      <h2 id="h-model">
        Model and assumptions <span className="tag">engine metadata</span>
      </h2>

      <p className="notqual" data-testid="not-qualified" role="note">
        <span aria-hidden="true">&#9888;</span> {NOT_QUALIFIED_STATEMENT}
      </p>

      {model === null ? (
        <p className="note" data-testid="model-none">
          {absent}
        </p>
      ) : (
        <details className="model-details" open>
          <summary data-testid="model-toggle">Model details</summary>
          {stale && (
            <p className="note" data-testid="model-stale">
              Stale: this is the model of the previous run, not of the current inputs.
            </p>
          )}
          <dl className={stale ? 'out model-list stale-val' : 'out model-list'}>
            {modelRows(model).map((row) => (
              <div
                className={row.longText === true ? 'model-row model-row-long' : 'model-row'}
                key={row.id}
              >
                <dt>{row.label}</dt>
                <dd data-testid={`model-${row.id}`}>
                  {row.value}
                  {row.unit === '' ? '' : ` ${row.unit}`}
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="model-sub" id="h-limits">
            Limitations
          </h3>
          <ul className="limits" aria-labelledby="h-limits" data-testid="model-limitations">
            {model.limitations.map((text, i) => (
              <li key={i} data-testid="model-limitation">
                {text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
