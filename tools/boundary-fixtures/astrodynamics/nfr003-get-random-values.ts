// expect: no-restricted-properties
export const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4));
