import type { ValidationIssue } from '@mission-lab/contracts';
import { useStore } from 'zustand';
import { getScenarioStore } from '../state/scenario-store';
import { ResultChip } from './ResultStatus';

interface Props {
  readonly issues: readonly ValidationIssue[];
}

export function Toolbar({ issues }: Props) {
  const store = getScenarioStore();
  const name = useStore(store, (s) => s.scenario.name);
  const { run, startNewScenario } = store.getState();
  const blocked = issues.length > 0;
  return (
    <header className="topbar" role="banner">
      <h1 className="brand">Mission Lab</h1>
      <span className="scenario-name" data-testid="scenario-name" title="Scenario name">
        {name === '' ? '(unnamed scenario)' : name}
      </span>
      <span className="sp" />
      {blocked && (
        <span className="run-blocked" data-testid="run-blocked" id="run-blocked">
          <span aria-hidden="true">&#10005;</span> {issues.length} problem
          {issues.length === 1 ? '' : 's'} prevent the run
        </span>
      )}
      <ResultChip />
      <button type="button" data-testid="new-scenario-button" onClick={startNewScenario}>
        New scenario
      </button>
      <button
        type="button"
        className="primary"
        data-testid="run-button"
        aria-describedby={blocked ? 'run-blocked' : undefined}
        onClick={() => {
          void run();
        }}
      >
        Run simulation
      </button>
    </header>
  );
}
