/**
 * Adjacent binary64 values for boundary tests, computed from the bit pattern instead of typed
 * from memory. For a positive finite double, consecutive bit patterns (read as unsigned
 * integers) are consecutive doubles (IEEE-754 binary64 ordering of positive values).
 */
function withBits(value: number, change: (bits: bigint) => bigint): number {
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError('test-doubles: defined here for positive finite values only.');
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, change(view.getBigUint64(0)));
  return view.getFloat64(0);
}

/** The smallest double greater than `value` (positive finite `value`). */
export function nextUp(value: number): number {
  return withBits(value, (bits) => bits + 1n);
}

/** The largest double smaller than `value` (positive finite `value`). */
export function nextDown(value: number): number {
  return withBits(value, (bits) => bits - 1n);
}
