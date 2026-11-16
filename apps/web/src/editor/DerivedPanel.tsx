/**
 * Derived read-only quantities (ML-FR-002 AC3, AC4): perigee/apogee radius and altitude, period,
 * specific energy, and the degenerate-configuration note.
 *
 * BLOCKED (ML-TASK-022 report): these are computed by `closedOrbitQuantities` and the degeneracy
 * thresholds/convention of `@mission-lab/astrodynamics`, which apps/web may not import (ADR-002,
 * eslint boundaries) and which `@mission-lab/simulation` does not re-export. The UI must not
 * reimplement them. The panel states the quantities and shows no value until an engine export is
 * reachable from apps/web.
 */
const QUANTITIES = [
  'Perigee radius',
  'Apogee radius',
  'Perigee altitude',
  'Apogee altitude',
  'Period',
  'Specific energy',
] as const;

export function DerivedPanel() {
  return (
    <section className="panel" aria-labelledby="h-derived" data-testid="derived-panel">
      <h2 id="h-derived">
        Derived from inputs <span className="tag">computed</span>
      </h2>
      <dl className="out">
        {QUANTITIES.map((q) => (
          <div key={q} style={{ display: 'contents' }}>
            <dt>{q}</dt>
            <dd>
              <span className="na" style={{ display: 'inline' }}>
                &mdash;
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="note" data-testid="derived-blocked">
        Not available yet: the engine functions for these values (and the degenerate-orbit
        convention thresholds) are not exported to the web app. The UI does not compute them.
      </p>
    </section>
  );
}
