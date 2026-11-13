/**
 * Concrete element values of the orbit test grid (verification plan §5; tolerance record §4
 * cases C1…C8). Chosen by the Verification Engineer in ML-TASK-011; they are inputs, not
 * reference values. Semi-major axes and eccentricities of C1…C6 are the §4 evaluation scales.
 */
import type { Elements } from '../ref/elements';

/** Largest binary64 value below 2 * Math.PI (angle boundary case; the contract requires < 2π). */
export const BELOW_TWO_PI = 2 * Math.PI - 2 ** -50;

export interface GridCase {
  readonly id: string;
  /** Tolerance-record case this row instantiates (§4) or the plan §5 row. */
  readonly recordCase: string;
  readonly description: string;
  readonly elements: Elements;
}

function el(a: number, e: number, i: number, raan: number, argp: number, nu: number): Elements {
  return {
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: i,
    raan_rad: raan,
    argPeriapsis_rad: argp,
    trueAnomaly_rad: nu,
  };
}

export const GRID: readonly GridCase[] = [
  {
    id: 'c1-circular-inclined',
    recordCase: 'C1',
    description: 'Circular low orbit, inclined (argument of periapsis undefined)',
    elements: el(7.0e6, 0, 0.9, 1.2, 0, 0.3),
  },
  {
    id: 'c2-circular-equatorial',
    recordCase: 'C2',
    description: 'Circular equatorial (doubly degenerate elements)',
    elements: el(7.0e6, 0, 0, 0, 0, 0.7),
  },
  {
    id: 'c3-elliptical-equatorial',
    recordCase: 'C3',
    description: 'Elliptical equatorial (node undefined)',
    elements: el(1.0e7, 0.3, 0, 0, 1.1, 2.0),
  },
  {
    id: 'c4-moderate-inclined',
    recordCase: 'C4',
    description: 'Moderately elliptical, inclined (general case)',
    elements: el(1.2e7, 0.4, 0.5, 2.5, 4.0, 5.5),
  },
  {
    id: 'c5-molniya',
    recordCase: 'C5',
    description: 'Highly elliptical, Molniya-like (conditioning near perigee)',
    elements: el(2.6e7, 0.74, 1.1, 4.2, 4.7, 0.2),
  },
  {
    id: 'c6-geo-radius',
    recordCase: 'C6',
    description:
      'Geostationary-scale radius, circular, slightly inclined (large scale, long period)',
    elements: el(4.2e7, 0, 0.001, 3.0, 0, 1.0),
  },
  {
    id: 'c7-near-polar-retrograde',
    recordCase: 'C7',
    description: 'Near-polar retrograde (i > 90°), near-circular (quadrant handling)',
    elements: el(7.0e6, 0.01, 1.7, 5.0, 3.0, 6.2),
  },
  {
    id: 'c8-angle-boundaries-a',
    recordCase: 'C8',
    description: 'Angles at boundaries: Ω = 0, ω = π, ν just below 2π, i = π/2',
    elements: el(7.0e6, 0.005, Math.PI / 2, 0, Math.PI, BELOW_TWO_PI),
  },
  {
    id: 'c8-angle-boundaries-b',
    recordCase: 'C8',
    description: 'Angles at boundaries, retrograde: Ω just below 2π, ω = 0, ν = π, i = 2.5',
    elements: el(7.0e6, 0.01, 2.5, BELOW_TWO_PI, 0, Math.PI),
  },
];

export interface DegenerateCase extends GridCase {
  /** Expected classification under the approved thresholds ε_e = ε_i = 1e-5. */
  readonly expectCircular: boolean;
  readonly expectEquatorial: boolean;
  /** 'exact' = VT-04(a), 'near' = VT-04(b), 'regular' = above 2× both thresholds. */
  readonly kind: 'exact' | 'near' | 'regular';
}

export const DEGENERATE: readonly DegenerateCase[] = [
  {
    id: 'd1-circular-equatorial-prograde',
    recordCase: 'C2',
    description: 'Exactly circular, exactly equatorial prograde (i = 0)',
    elements: el(7.0e6, 0, 0, 0, 0, 0.7),
    expectCircular: true,
    expectEquatorial: true,
    kind: 'exact',
  },
  {
    id: 'd2-circular-equatorial-retrograde',
    recordCase: 'C2',
    description: 'Exactly circular, retrograde equatorial (i = Math.PI)',
    elements: el(7.0e6, 0, Math.PI, 0, 0, 0.7),
    expectCircular: true,
    expectEquatorial: true,
    kind: 'exact',
  },
  {
    id: 'd3-elliptical-equatorial-retrograde',
    recordCase: 'C3',
    description: 'Elliptical, retrograde equatorial (i = Math.PI) with Ω ≠ 0 given',
    elements: el(1.0e7, 0.3, Math.PI, 0.4, 1.1, 2.0),
    expectCircular: false,
    expectEquatorial: true,
    kind: 'exact',
  },
  {
    id: 'd4-circular-inclined',
    recordCase: 'C1',
    description: 'Exactly circular, inclined',
    elements: el(7.0e6, 0, 0.9, 1.2, 0, 0.3),
    expectCircular: true,
    expectEquatorial: false,
    kind: 'exact',
  },
  {
    id: 'd5-elliptical-equatorial-prograde',
    recordCase: 'C3',
    description: 'Elliptical, prograde equatorial (i = 0) with Ω ≠ 0 given',
    elements: el(1.0e7, 0.3, 0, 0.4, 1.1, 2.0),
    expectCircular: false,
    expectEquatorial: true,
    kind: 'exact',
  },
  {
    id: 'd6-near-circular',
    recordCase: 'C1',
    description: 'Near-circular below threshold (e = 1e-6), inclined',
    elements: el(7.0e6, 1e-6, 0.9, 1.2, 2.0, 0.3),
    expectCircular: true,
    expectEquatorial: false,
    kind: 'near',
  },
  {
    id: 'd7-near-equatorial-prograde',
    recordCase: 'C3',
    description: 'Near-equatorial prograde below threshold (i = 1e-6), elliptical',
    elements: el(1.0e7, 0.3, 1e-6, 0.4, 1.1, 2.0),
    expectCircular: false,
    expectEquatorial: true,
    kind: 'near',
  },
  {
    id: 'd8-near-equatorial-retrograde',
    recordCase: 'C3',
    description: 'Near-equatorial retrograde below threshold (i = π − 1e-6), elliptical',
    elements: el(1.0e7, 0.3, Math.PI - 1e-6, 0.4, 1.1, 2.0),
    expectCircular: false,
    expectEquatorial: true,
    kind: 'near',
  },
  {
    id: 'd9-near-circular-near-equatorial',
    recordCase: 'C2',
    description: 'Near-circular and near-equatorial below both thresholds (e = 1e-6, i = 2e-6)',
    elements: el(7.0e6, 1e-6, 2e-6, 0.4, 1.1, 2.0),
    expectCircular: true,
    expectEquatorial: true,
    kind: 'near',
  },
  {
    id: 'd10-small-but-regular',
    recordCase: 'C1',
    description: 'Small e and i above twice the thresholds (e = 1e-4, i = 1e-4): no convention',
    elements: el(7.0e6, 1e-4, 1e-4, 0.4, 1.1, 2.0),
    expectCircular: false,
    expectEquatorial: false,
    kind: 'regular',
  },
];
