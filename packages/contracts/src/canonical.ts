import type { SimulationRequest } from './request';

/**
 * Canonical JSON text of a value made of plain objects, arrays, strings and finite numbers
 * (contracts-v1.md §7.2): object keys sorted by UTF-16 code unit order at every level, no
 * insignificant whitespace, numbers in ECMAScript Number-to-String form (so -0 is written 0).
 *
 * @throws TypeError on a value outside that domain (precondition violation, not user input).
 */
function canonicalJson(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('canonicalJson: non-finite number.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(',')}}`;
  }
  throw new TypeError('canonicalJson: unsupported value type.');
}

/**
 * The byte-exact text whose SHA-256 digest defines `requestId` (contracts-v1.md §7): the canonical
 * JSON of the request with the `requestId` member removed.
 *
 * Precondition: `request` passes `validateSimulationRequest` (ignoring `requestId` itself).
 * Hashing is not done here; see contracts-v1.md §7.3.
 */
export function canonicalRequestPayload(request: Omit<SimulationRequest, 'requestId'>): string {
  const withoutId: Record<string, unknown> = { ...request };
  delete withoutId.requestId;
  return canonicalJson(withoutId);
}
