/**
 * Colours and sizes of the 3D view. Trajectory and marker colours are the approved tokens of
 * docs/design/design-tokens.md (hex copied; the renderer cannot read CSS variables). The Earth
 * and axes colours are scene-only and carry no meaning. Sizes are view constants in scene units
 * or pixels; none is applied to an engine sample.
 */
export const SCENE_COLORS = {
  background: '#0d1117', // --bg-base
  coast: '#a8b3c0', // --coast, drawn dashed
  maneuver: '#3dd6c6', // --maneuver, drawn solid
  maneuverMarker: '#ffb454', // --marker
  spacecraft: '#e6edf3', // --text
  earthFill: '#16314f',
  earthGrid: '#3b6ea5',
  primeMeridian: '#6aa9ff', // --accent
} as const;

/** Opacity of a stale trajectory (visual-direction.md: stale stays visible but muted). */
export const STALE_OPACITY = 0.5;

export const COAST_DASH = { dashSize: 0.25, gapSize: 0.15 } as const;

/** Marker sizes in screen pixels (not attenuated): the maneuver marker is the larger. */
export const MARKER_SIZE_PX = { spacecraft: 8, maneuver: 12 } as const;

/** Length of the inertial axes helper, in scene units. */
export const AXES_LENGTH = 10;

/** Initial camera position (scene units, GCRF axes; +Z is up) and distance limits. */
export const INITIAL_CAMERA_POSITION: readonly [number, number, number] = [14, -16, 10];
export const CAMERA_DISTANCE_LIMITS = { min: 8, max: 400 } as const;
