/** Scenario fields (ML-FR-001 AC2) and the Keplerian elements (ML-FR-002). */
import type { ValidationIssue } from '@mission-lab/contracts';
import type { KeplerianElements } from '@mission-lab/contracts';
import { useStore } from 'zustand';
import { fromDeg, fromKm, identity, toDeg, toKm } from '../format/units';
import { getScenarioStore } from '../state/scenario-store';
import { NumberField, TextField } from './Fields';
import { FIELD, issuesForField } from './issue-map';
import { isAngleKey, normaliseAngles } from './normalise-angles';

interface Props {
  readonly issues: readonly ValidationIssue[];
}

type ElementKey = keyof KeplerianElements;

interface ElementRow {
  readonly key: ElementKey;
  readonly label: string;
  readonly testId: string;
  readonly unit: string;
  readonly field: string;
  readonly toDisplay: (stored: number) => number;
  readonly fromDisplay: (display: number) => number;
}

const ELEMENT_ROWS: readonly ElementRow[] = [
  {
    key: 'semiMajorAxis_m',
    label: 'Semi-major axis a',
    testId: 'a',
    unit: 'km',
    field: FIELD.semiMajorAxis,
    toDisplay: toKm,
    fromDisplay: fromKm,
  },
  {
    key: 'eccentricity',
    label: 'Eccentricity e',
    testId: 'e',
    unit: '-',
    field: FIELD.eccentricity,
    toDisplay: identity,
    fromDisplay: identity,
  },
  {
    key: 'inclination_rad',
    label: 'Inclination i',
    testId: 'i',
    unit: 'deg',
    field: FIELD.inclination,
    toDisplay: toDeg,
    fromDisplay: fromDeg,
  },
  {
    key: 'raan_rad',
    label: 'RAAN Ω',
    testId: 'raan',
    unit: 'deg',
    field: FIELD.raan,
    toDisplay: toDeg,
    fromDisplay: fromDeg,
  },
  {
    key: 'argPeriapsis_rad',
    label: 'Arg. of perigee ω',
    testId: 'argp',
    unit: 'deg',
    field: FIELD.argPeriapsis,
    toDisplay: toDeg,
    fromDisplay: fromDeg,
  },
  {
    key: 'trueAnomaly_rad',
    label: 'True anomaly ν',
    testId: 'nu',
    unit: 'deg',
    field: FIELD.trueAnomaly,
    toDisplay: toDeg,
    fromDisplay: fromDeg,
  },
];

export function ScenarioPanel({ issues }: Props) {
  const store = getScenarioStore();
  const scenario = useStore(store, (s) => s.scenario);
  const { setName, setEpochIso, setDuration_s, setOutputStep_s, setElement } = store.getState();
  const elements = scenario.initialOrbit.elements;

  return (
    <>
      <section className="panel" aria-labelledby="h-sc">
        <h2 id="h-sc">
          Scenario <span className="tag">editable</span>
        </h2>
        <TextField
          label="Name"
          unit=""
          testId="name"
          align="left"
          value={scenario.name}
          onChange={setName}
          issues={[]}
          note="Display only: changing the name does not stale the result."
        />
        <TextField
          label="Epoch (UTC)"
          unit="UTC"
          testId="epoch"
          wide
          value={scenario.epoch.iso}
          onChange={setEpochIso}
          issues={issuesForField(issues, FIELD.epoch)}
          note="Format YYYY-MM-DDTHH:MM:SS.sssZ"
        />
        <NumberField
          label="Duration"
          unit="s"
          testId="duration"
          stored={scenario.duration_s}
          toDisplay={identity}
          fromDisplay={identity}
          onCommit={setDuration_s}
          issues={issuesForField(issues, FIELD.duration)}
        />
        <NumberField
          label="Output step"
          unit="s"
          testId="step"
          stored={scenario.outputStep_s}
          toDisplay={identity}
          fromDisplay={identity}
          onCommit={setOutputStep_s}
          issues={issuesForField(issues, FIELD.outputStep)}
        />
      </section>

      <section className="panel" aria-labelledby="h-orbit">
        <h2 id="h-orbit">
          Initial orbit <span className="tag">editable</span>
        </h2>
        <p className="note" style={{ marginTop: 0 }}>
          Keplerian elements, Earth-centred, GCRF. Shown in km and deg; stored in m and rad.
        </p>
        {ELEMENT_ROWS.map((row) => (
          <NumberField
            key={row.key}
            label={row.label}
            unit={row.unit}
            testId={row.testId}
            stored={elements[row.key]}
            toDisplay={row.toDisplay}
            fromDisplay={row.fromDisplay}
            onCommit={(stored) => {
              setElement(row.key, stored);
            }}
            {...(isAngleKey(row.key)
              ? {
                  onBlur: () => {
                    normaliseAngles(store);
                  },
                }
              : {})}
            issues={issuesForField(issues, row.field)}
          />
        ))}
        <OrbitIssues issues={issuesForField(issues, FIELD.orbit)} />
      </section>
    </>
  );
}

/** Issues about the whole element set (perigee rule), not about one field. */
function OrbitIssues({ issues }: { readonly issues: readonly ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <ul className="issue-list" data-testid="error-orbit" aria-label="Orbit problems">
      {issues.map((issue, i) => (
        <li key={i} className="msg-line">
          <span aria-hidden="true">&#10005;</span> <span className="sr-only">Error: </span>
          {issue.message} <span className="code">({issue.code})</span>
        </li>
      ))}
    </ul>
  );
}
