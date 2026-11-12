import type { SimulationRequest } from './request';

/**
 * The IEEE-754 binary64 bit pattern of a finite number as 16 lowercase hexadecimal digits, most
 * significant first (sign, 11-bit biased exponent, 52-bit fraction). +0 and -0 differ.
 *
 * @throws TypeError on a non-finite number (precondition violation, not user input).
 */
export function binary64Hex(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('binary64Hex: non-finite number.');
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  const high = view.getUint32(0, false).toString(16).padStart(8, '0');
  const low = view.getUint32(4, false).toString(16).padStart(8, '0');
  return high + low;
}

/**
 * Canonical text of a value made of plain objects, arrays, strings and finite numbers
 * (contracts-v1.md §7.2): object keys sorted by UTF-16 code unit order at every level, no
 * insignificant whitespace, strings as JSON strings, numbers as bare 16-digit binary64 bit
 * patterns. The result is not JSON.
 *
 * @throws TypeError on a value outside that domain (precondition violation, not user input).
 */
function canonicalText(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return binary64Hex(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalText).join(',')}]`;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalText(record[key])}`);
    return `{${members.join(',')}}`;
  }
  throw new TypeError('canonicalText: unsupported value type.');
}

/**
 * The exact text whose SHA-256 digest defines `requestId` (contracts-v1.md §7): the canonical
 * text of the request with the `requestId` member removed.
 *
 * Precondition: `request` passes `validateSimulationRequest` (ignoring `requestId` itself).
 * Hashing is not done here; see contracts-v1.md §7.3.
 */
export function canonicalRequestPayload(request: Omit<SimulationRequest, 'requestId'>): string {
  const withoutId: Record<string, unknown> = { ...request };
  delete withoutId.requestId;
  return canonicalText(withoutId);
}
