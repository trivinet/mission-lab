/** One impulsive RSW maneuver: add, edit, remove (ML-FR-005). */
import type { ValidationIssue } from '@mission-lab/contracts';
import { useStore } from 'zustand';
import { formatInputNumber, identity, utcLabel } from '../format/units';
import { getScenarioStore } from '../state/scenario-store';
import { NumberField } from './Fields';
import { FIELD, issuesForField, maneuverDeltaVKey, maneuverTimeKey } from './issue-map';

interface Props {
  readonly issues: readonly ValidationIssue[];
}

const COMPONENTS = [
  { index: 0, label: 'Δv radial (R)', testId: 'dv-r' },
  { index: 1, label: 'Δv along-track (S)', testId: 'dv-s' },
  { index: 2, label: 'Δv cross-track (W)', testId: 'dv-w' },
] as const;

export function ManeuverPanel({ issues }: Props) {
  const store = getScenarioStore();
  const scenario = useStore(store, (s) => s.scenario);
  const resultState = useStore(store, (s) => s.resultState);
  const { addManeuver, removeManeuver, setManeuverTime_s, setManeuverDeltaV_mps } =
    store.getState();

  // Total |dv| is the engine's own value (ManeuverEvent.deltaV_magnitude_mps) from the last run.
  const shownResult =
    resultState.kind === 'current' || resultState.kind === 'stale' ? resultState.result : null;
  const events = shownResult?.events ?? [];
  const listIssues = issuesForField(issues, FIELD.maneuverList);

  return (
    <section className="panel" aria-labelledby="h-mn">
      <h2 id="h-mn">
        Maneuver (impulsive, RSW) <span className="tag">editable</span>
      </h2>

      {scenario.maneuvers.length === 0 && (
        <p className="note" style={{ marginTop: 0 }} data-testid="no-maneuver">
          No maneuver: the run is a coast.
        </p>
      )}

      {scenario.maneuvers.map((maneuver, index) => {
        const event = events.find((e) => e.maneuverId === maneuver.id);
        const utc = utcLabel(scenario.epoch.iso, maneuver.t_s);
        return (
          <fieldset
            key={maneuver.id}
            className="maneuver"
            data-testid={`maneuver-${String(index)}`}
          >
            <legend>Maneuver {index + 1}</legend>
            <NumberField
              label="Time since epoch"
              unit="s"
              testId={`m${String(index)}-time`}
              stored={maneuver.t_s}
              toDisplay={identity}
              fromDisplay={identity}
              onCommit={(t_s) => {
                setManeuverTime_s(index, t_s);
              }}
              issues={issuesForField(issues, maneuverTimeKey(index))}
              note={utc === null ? 'UTC: not representable' : `= ${utc} UTC`}
            />
            {COMPONENTS.map((c) => (
              <NumberField
                key={c.index}
                label={c.label}
                unit="m/s"
                testId={`m${String(index)}-${c.testId}`}
                stored={maneuver.deltaV_mps[c.index]}
                toDisplay={identity}
                fromDisplay={identity}
                onCommit={(value) => {
                  setManeuverDeltaV_mps(index, c.index, value);
                }}
                issues={issuesForField(issues, maneuverDeltaVKey(index, c.index))}
              />
            ))}
            <dl className="out">
              <dt>
                Total |&Delta;v| <span className="tag">computed</span>
              </dt>
              <dd data-testid={`dv-total-${String(index)}`}>
                {event === undefined ? (
                  <span className="na" style={{ display: 'inline' }}>
                    run to compute
                  </span>
                ) : (
                  <span className={resultState.kind === 'stale' ? 'v stale-val' : 'v'}>
                    {formatInputNumber(event.deltaV_magnitude_mps)} m/s
                  </span>
                )}
              </dd>
            </dl>
            <button
              type="button"
              data-testid={`remove-maneuver-${String(index)}`}
              onClick={() => {
                removeManeuver(index);
              }}
            >
              Remove maneuver {index + 1}
            </button>
          </fieldset>
        );
      })}

      {listIssues.length > 0 && (
        <ul className="issue-list" data-testid="error-maneuvers" aria-label="Maneuver problems">
          {listIssues.map((issue, i) => (
            <li key={i} className="msg-line">
              <span aria-hidden="true">&#10005;</span> <span className="sr-only">Error: </span>
              {issue.message} <span className="code">({issue.code})</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" data-testid="add-maneuver" onClick={addManeuver}>
        Add maneuver
      </button>

      <p className="note" data-testid="rsw-note">
        RSW frame of the pre-maneuver state: R is radial (along the position vector), W is the orbit
        normal, and S = W &times; R completes the right-handed set, in the orbital plane
        perpendicular to R. On a non-circular orbit S is <strong>not</strong> the velocity
        direction. One maneuver only in M1. Total |&Delta;v| is the engine&apos;s value from the
        last run.
      </p>
    </section>
  );
}
