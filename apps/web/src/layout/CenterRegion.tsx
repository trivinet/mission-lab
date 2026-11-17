import { WorkspaceScene } from '../scene';
import { ResultBanner } from './ResultStatus';

/**
 * Centre column: the result banner and the stable region ML-TASK-023 mounts the 3D scene into.
 * `WorkspaceScene` (ML-TASK-023) is mounted inside `data-testid="scene-container"`.
 * No scene code lives here.
 */
export function CenterRegion() {
  return (
    <div className="col" aria-label="Simulation view and analysis">
      <ResultBanner />
      <section className="panel vp" aria-labelledby="h-vp" data-testid="scene-region">
        <h2 id="h-vp">Simulation view (3D)</h2>
        <div className="scene-container" data-testid="scene-container">
          <WorkspaceScene />
        </div>
      </section>
    </div>
  );
}
