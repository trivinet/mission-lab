import { DerivedPanel } from './editor/DerivedPanel';
import { ManeuverPanel } from './editor/ManeuverPanel';
import { ScenarioPanel } from './editor/ScenarioPanel';
import { useLiveIssues } from './editor/useIssues';
import { CenterRegion } from './layout/CenterRegion';
import { useResultKind } from './layout/ResultStatus';
import { ResultsColumn } from './layout/ResultsColumn';
import { Toolbar } from './layout/Toolbar';

export function App() {
  const issues = useLiveIssues();
  const state = useResultKind();
  return (
    <div className="app" data-state={state}>
      <a className="skip" href="#main">
        Skip to workspace
      </a>
      <Toolbar issues={issues} />
      <main className="ws" id="main" aria-label="Workspace" data-testid="workspace" tabIndex={-1}>
        <div className="col" aria-label="Scenario editor" data-testid="editor-column">
          <ScenarioPanel issues={issues} />
          <DerivedPanel />
          <ManeuverPanel issues={issues} />
        </div>
        <CenterRegion />
        <ResultsColumn />
      </main>
    </div>
  );
}
