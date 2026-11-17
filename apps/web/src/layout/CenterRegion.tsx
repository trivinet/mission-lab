import { Timeline } from '../playback';
import { PlotsPanel } from '../plots/PlotsPanel';
import { WorkspaceScene } from '../scene';
import { ResultBanner } from './ResultStatus';

/**
 * Centre column: the result banner and the region that holds the 3D scene. `WorkspaceScene`
 * (ML-TASK-023) is mounted inside `data-testid="scene-container"`; no scene code lives here.
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
      <Timeline />
      <PlotsPanel />
    </div>
  );
}
