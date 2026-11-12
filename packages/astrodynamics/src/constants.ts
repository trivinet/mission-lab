/**
 * Physical constants of the M1 two-body Earth model.
 *
 * Scope (ML-TASK-013): the Earth gravitational parameter and the reference-sphere radius only.
 * No other physical constant (Earth rotation, J2, ...) belongs here until a task assigns it.
 *
 * Source actually read for both values (accessed 2026-11-12):
 *   National Geospatial-Intelligence Agency (NGA), "World Geodetic System 1984", reference-frame
 *   description submitted to the UN International Committee on GNSS (ICG), 2012, page 2,
 *   section "Defining Parameters", table of the four WGS 84 defining parameters.
 *   URL: https://www.unoosa.org/pdf/icg/2012/template/WGS_84.pdf
 *   That document names NIMA Technical Report 8350.2 (and its addendum, and IS-GPS-200) as its
 *   references. The NGA standard itself (NGA.STND.0036 / NIMA TR8350.2) was NOT reached:
 *   earth-info.nga.mil timed out from this environment. Confirmation against that text is part
 *   of VT-19 (m1-verification-plan.md §3).
 *
 * The values also match docs/architecture/proposed-architecture.md §3, which proposes them.
 *
 * Both values are exactly representable in binary64: 398600441800000 < 2^53 and 6378137 < 2^53
 * are integers, so the literals below carry no representation error.
 */

/**
 * Geocentric gravitational constant of the Earth, GM [m^3/s^2].
 *
 * WGS 84 defining parameter "Geocentric Gravitational Constant (Mass of Earth's Atmosphere
 * Included)", value 3.986004418 x 10^14 m^3/s^2 (NGA 2012 ICG document, p. 2, defining-parameters
 * table; see module header). This is the value with the atmosphere included, which is the one
 * intended for a point-mass model of the whole Earth. It is NOT the GPS navigation-message value
 * (3.9860050 x 10^14 m^3/s^2), which the same document lists separately in a footnote.
 *
 * Frame/time: a scalar; no frame. Unit: m^3/s^2 (SI).
 */
export const EARTH_GM_m3ps2 = 3.986004418e14;

/**
 * Radius of the M1 reference sphere [m]: the WGS 84 ellipsoid semi-major axis a.
 *
 * WGS 84 defining parameter "Semi-major Axis", a = 6378137.0 m (NGA 2012 ICG document, p. 2,
 * defining-parameters table; see module header).
 *
 * Use (proposed-architecture §3, contracts-v1 §4): altitude above the reference SPHERE, the
 * perigee-above-surface rule and the surface-intersection flag. It is not a geodetic altitude:
 * the WGS 84 flattening is deliberately not used in M1.
 *
 * Unit: m (SI).
 */
export const EARTH_REFERENCE_RADIUS_m = 6378137;

/**
 * Citation string carried in `SimulationRequest.constants.source` (contracts-v1 §4). It is part
 * of the canonical request payload, so changing this text changes every `requestId`.
 */
export const EARTH_CONSTANTS_SOURCE =
  'WGS 84 defining parameters: GM (mass of Earth atmosphere included) and semi-major axis a. ' +
  'NGA, "World Geodetic System 1984", UN ICG reference-frame description, 2012, p. 2 ' +
  '(cites NIMA TR8350.2).';

/**
 * Constants record shaped like the contract's `constants` object
 * (`{ mu_m3ps2, referenceRadius_m, source }`, contracts-v1 §4). Declared structurally here because
 * this package may not import `packages/contracts` (ADR-002).
 */
export interface CentralBodyConstants {
  /** Gravitational parameter [m^3/s^2]; > 0. */
  readonly mu_m3ps2: number;
  /** Reference-sphere radius [m]; > 0. */
  readonly referenceRadius_m: number;
  /** Human-readable citation of the values. */
  readonly source: string;
}

/** Earth constants for M1 (frozen). Values and source: see the module header. */
export const EARTH_CONSTANTS: CentralBodyConstants = Object.freeze({
  mu_m3ps2: EARTH_GM_m3ps2,
  referenceRadius_m: EARTH_REFERENCE_RADIUS_m,
  source: EARTH_CONSTANTS_SOURCE,
});
