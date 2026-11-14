/**
 * Decoding of the special-number encoding and mutation lists of the VT-18 / VI-01 datasets
 * (ML-TASK-018 part C). JSON cannot carry NaN, ±∞ or −0; the datasets write them as
 * {"$number": "NaN" | "Infinity" | "-Infinity" | "-0"}.
 */

export type JsonPath = readonly (string | number)[];

export interface Mutation {
  readonly op: 'set' | 'delete';
  readonly path: JsonPath;
  readonly value?: unknown;
}

const SPECIAL: Readonly<Record<string, number>> = {
  NaN: Number.NaN,
  Infinity: Number.POSITIVE_INFINITY,
  '-Infinity': Number.NEGATIVE_INFINITY,
  '-0': -0,
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Replaces every {"$number": …} wrapper by its binary64 value (deep, returns a new value). */
export function decodeValue(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(decodeValue);
  if (isRecord(x)) {
    const keys = Object.keys(x);
    if (keys.length === 1 && keys[0] === '$number' && typeof x.$number === 'string') {
      const v = SPECIAL[x.$number];
      if (v === undefined) throw new RangeError(`unknown $number ${x.$number}`);
      return v;
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = decodeValue(x[k]);
    return out;
  }
  return x;
}

/** Deep copy (structured, keeps −0) of a JSON-like value. */
export function deepCopy<T>(x: T): T {
  return structuredClone(x);
}

/** Applies the mutations in order to a deep copy of `base`. */
export function applyMutations(base: unknown, mutations: readonly Mutation[]): unknown {
  const root = deepCopy(base);
  for (const mu of mutations) {
    if (mu.path.length === 0) throw new RangeError('empty mutation path');
    let parent: unknown = root;
    for (const key of mu.path.slice(0, -1)) {
      parent = (parent as Record<string | number, unknown>)[key];
    }
    const last = mu.path.at(-1);
    if (last === undefined) throw new RangeError('empty mutation path');
    const container = parent as Record<string | number, unknown>;
    if (mu.op === 'delete') {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete container[last];
    } else {
      container[last] = decodeValue(mu.value);
    }
  }
  return root;
}
