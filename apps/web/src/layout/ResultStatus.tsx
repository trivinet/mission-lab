/** Result-state chip and banner (ML-UX-001, ML-UX-002), wired to the ML-TASK-021 store. */
import { useStore } from 'zustand';
import type { ResultState } from '../state/result-state';
import { getScenarioStore } from '../state/scenario-store';

type Kind = ResultState['kind'];

const CHIP: Record<Kind, { icon: string; label: string }> = {
  none: { icon: '○', label: 'No result' },
  computing: { icon: '◜', label: 'Computing…' },
  current: { icon: '✓', label: 'Result current' },
  stale: { icon: '◆', label: 'Result stale' },
  error: { icon: '✕', label: 'Run failed' },
};

export function useResultKind(): Kind {
  return useStore(getScenarioStore(), (s) => s.resultState.kind);
}

export function ResultChip() {
  const kind = useResultKind();
  const { icon, label } = CHIP[kind];
  return (
    <span className={`chip st-${kind}`} data-testid="result-state" data-state={kind} role="status">
      <span className={kind === 'computing' ? 'spin' : undefined} aria-hidden="true">
        {icon}
      </span>{' '}
      {label}
    </span>
  );
}

export function ResultBanner() {
  const state = useStore(getScenarioStore(), (s) => s.resultState);
  const icon = CHIP[state.kind].icon;
  let text: string;
  switch (state.kind) {
    case 'none':
      text = 'No result yet. Edit the scenario and run the simulation.';
      break;
    case 'computing':
      text = 'Computing in a background worker. The interface stays interactive.';
      break;
    case 'stale':
      text =
        'Stale: inputs changed after this result was computed. Values shown are from the previous run (italic). Run again to update.';
      break;
    case 'error':
      text = `Run failed: ${state.message}`;
      break;
    case 'current':
      return null;
  }
  return (
    <div
      className={`banner b-${state.kind}`}
      role={state.kind === 'error' ? 'alert' : 'status'}
      data-testid="result-banner"
      data-state={state.kind}
    >
      <span className={state.kind === 'computing' ? 'spin' : undefined} aria-hidden="true">
        {icon}
      </span>{' '}
      {text}
    </div>
  );
}
