/**
 * Derived read-only quantities and the degenerate-orbit note (ML-FR-002 AC3, AC4).
 *
 * Everything shown comes from `describeScenarioOrbit` of `@mission-lab/simulation` (ML-TASK-027):
 * perigee and apogee radius and altitude, period and specific energy from `view.derived`, the
 * classification, undefined elements and convention from `view.degeneracy`. The UI only converts
 * units for display (m to km, rad to deg, m^2/s^2 to km^2/s^2). Outputs use no input chrome.
 */
import type { ReactNode } from 'react';
import { ENGINE_CONSTANTS, describeScenarioOrbit } from '@mission-lab/simulation';
import type { DegeneracyDescription, DerivedOrbitQuantities } from '@mission-lab/simulation';
import { useStore } from 'zustand';
import { formatInputNumber, toDeg, toKm, toKm2ps2 } from '../format/units';
import { getScenarioStore } from '../state/scenario-store';

interface Row {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: (d: DerivedOrbitQuantities) => number;
}

const ROWS: readonly Row[] = [
  {
    id: 'perigee-radius',
    label: 'Perigee radius',
    unit: 'km',
    value: (d) => toKm(d.perigeeRadius_m),
  },
  { id: 'apogee-radius', label: 'Apogee radius', unit: 'km', value: (d) => toKm(d.apogeeRadius_m) },
  {
    id: 'perigee-altitude',
    label: 'Perigee altitude',
    unit: 'km',
    value: (d) => toKm(d.perigeeAltitude_m),
  },
  {
    id: 'apogee-altitude',
    label: 'Apogee altitude',
    unit: 'km',
    value: (d) => toKm(d.apogeeAltitude_m),
  },
  { id: 'period', label: 'Period', unit: 's', value: (d) => d.period_s },
  {
    id: 'specific-energy',
    label: 'Specific energy',
    unit: 'km²/s²',
    value: (d) => toKm2ps2(d.specificEnergy_m2ps2),
  },
];

const CONVENTION_TEXT: Record<DegeneracyDescription['convention'], string> = {
  NONE: 'Not degenerate: Ω is the RAAN, ω the argument of perigee, ν the true anomaly.',
  CIRCULAR:
    'Circular orbit: the argument of perigee ω is undefined and reported as 0°; ν is then the argument of latitude (measured from the ascending node).',
  EQUATORIAL:
    'Equatorial orbit: the RAAN Ω is undefined and reported as 0°; ω is then the longitude of perigee (measured from +x, positive about the angular-momentum direction).',
  CIRCULAR_EQUATORIAL:
    'Circular equatorial orbit: Ω and ω are undefined and reported as 0°; ν is then the true longitude (measured from +x, positive about the angular-momentum direction).',
};

const ELEMENT_NAME = { raan_rad: 'Ω (RAAN)', argPeriapsis_rad: 'ω (argument of perigee)' } as const;

function Degeneracy({ d }: { readonly d: DegeneracyDescription }): ReactNode {
  const reported = d.reportedElements;
  return (
    <div data-testid="degeneracy" data-convention={d.convention}>
      <dl className="out">
        <dt>Classification</dt>
        <dd data-testid="degeneracy-convention">
          <span className="v">{d.convention.replace('_', ' ')}</span>
        </dd>
        <dt>Undefined elements</dt>
        <dd data-testid="degeneracy-undefined">
          {d.undefinedElements.length === 0 ? (
            <span className="v">none</span>
          ) : (
            <span className="v">{d.undefinedElements.map((e) => ELEMENT_NAME[e]).join(', ')}</span>
          )}
        </dd>
        <dt>Reported Ω, ω, ν</dt>
        <dd data-testid="degeneracy-reported">
          <span className="v">
            {formatInputNumber(toDeg(reported.raan_rad))}°,{' '}
            {formatInputNumber(toDeg(reported.argPeriapsis_rad))}°,{' '}
            {formatInputNumber(toDeg(reported.trueAnomaly_rad))}°
          </span>
        </dd>
      </dl>
      <p className="note" data-testid="degeneracy-note">
        {CONVENTION_TEXT[d.convention]}
      </p>
    </div>
  );
}

export function DerivedPanel() {
  const elements = useStore(getScenarioStore(), (s) => s.scenario.initialOrbit.elements);
  const described = describeScenarioOrbit(elements, ENGINE_CONSTANTS);

  return (
    <section className="panel" aria-labelledby="h-derived" data-testid="derived-panel">
      <h2 id="h-derived">
        Derived from inputs <span className="tag">computed</span>
      </h2>
      {described.ok ? (
        <>
          <dl className="out">
            {ROWS.map((row) => (
              <div key={row.id} style={{ display: 'contents' }}>
                <dt>{row.label}</dt>
                <dd data-testid={`derived-${row.id}`}>
                  <span className="v">
                    {formatInputNumber(row.value(described.view.derived))} {row.unit}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="note">
            Altitudes are above the reference sphere (radius{' '}
            {formatInputNumber(toKm(ENGINE_CONSTANTS.referenceRadius_m))} km), not geodetic
            altitude.
          </p>
          <Degeneracy d={described.view.degeneracy} />
        </>
      ) : (
        <p className="note" data-testid="derived-unavailable">
          Not available while the orbit inputs are invalid ({described.reason}). Fix the fields
          above.
        </p>
      )}
    </section>
  );
}
