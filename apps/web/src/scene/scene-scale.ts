/**
 * The single scene-scale conversion (contracts-v1 decision 4, ML-FR-007 AC2).
 *
 * One scene unit is 10^6 m (1000 km): s = 1e-6 scene units per metre. Reasons: it is a power of
 * ten, so the scale is easy to state and to read back in the scene-state hook; a low Earth orbit
 * (a = 7 x 10^6 m) lands at about 7 scene units and a geostationary one at about 42, which keeps
 * the whole M1 range well inside float32 precision (24-bit significand, relative error 6e-8) and
 * inside a camera frustum of a few hundred units. It is a display choice, not a physical constant.
 *
 * The scene coordinate of an engine sample component x [m] is exactly Math.fround(x * s): one
 * binary64 multiplication followed by one rounding to binary32. Nothing else in the renderer
 * touches a sample (VI-02 compares every vertex with this expression bit for bit).
 */
export const SCENE_SCALE = 1e-6;

/** The one conversion: x in metres to a scene coordinate (binary32 value held in a number). */
export function toSceneCoordinate(x_m: number, s: number = SCENE_SCALE): number {
  return Math.fround(x_m * s);
}

/** Converts every component of an engine array (positions in m) to a new Float32Array. */
export function toSceneVertices(source_m: Float64Array, s: number = SCENE_SCALE): Float32Array {
  const out = new Float32Array(source_m.length);
  for (const [i, x_m] of source_m.entries()) {
    out[i] = toSceneCoordinate(x_m, s);
  }
  return out;
}
