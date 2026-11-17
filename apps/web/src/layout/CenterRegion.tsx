import { ResultBanner } from './ResultStatus';

/**
 * Centre column: the result banner and the stable region ML-TASK-023 mounts the 3D scene into.
 * The container `data-testid="scene-container"` is empty by design; mount `WorkspaceScene` there.
 * No scene code lives here (ML-TASK-022).
 */
export function CenterRegion() {
  return (
    <div className="col" aria-label="Simulation view and analysis">
      <ResultBanner />
      <section className="panel vp" aria-labelledby="h-vp" data-testid="scene-region">
        <h2 id="h-vp">Simulation view (3D)</h2>
        <div className="scene-container" data-testid="scene-container" />
      </section>
    </div>
  );
}
