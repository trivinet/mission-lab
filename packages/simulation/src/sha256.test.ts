import { describe, expect, it } from 'vitest';
import {
  SHA256_INITIAL_HASH,
  SHA256_ROUND_CONSTANTS,
  sha256,
  sha256HexOfUtf8,
  toLowerHex,
  utf8Encode,
} from './sha256';

/**
 * FIPS 180-4 §4.2.2 table of K0…K63, transcribed from
 * https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf (page 11), opened 2026-11-13.
 */
const FIPS_K = `
428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5
d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174
e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da
983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967
27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85
a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070
19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3
748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2`;

/** FIPS 180-4 §5.3.3 H(0) for SHA-256 (same document, page 15). */
const FIPS_H0 = '6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19';

function words(table: string): number[] {
  return table
    .trim()
    .split(/\s+/)
    .map((w) => Number.parseInt(w, 16));
}

/**
 * NIST CSRC example "SHA256.pdf" (Secure Hash Algorithm, Message Digest Length = 256), opened
 * 2026-11-13 at https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf
 * (FIPS 180-4 Appendix A.2 points to the NIST examples page). Digests as printed there.
 */
const NIST_EXAMPLES = [
  {
    name: 'One Block Message Sample',
    message: 'abc',
    digest: 'BA7816BF 8F01CFEA 414140DE 5DAE2223 B00361A3 96177A9C B410FF61 F20015AD',
  },
  {
    name: 'Two Block Message Sample',
    message: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    digest: '248D6A61 D20638B8 E5C02693 0C3E6039 A33CE459 64FF2167 F6ECEDD4 19DB06C1',
  },
];

interface NodeHash {
  update(data: Uint8Array): NodeHash;
  digest(encoding: 'hex'): string;
}
interface NodeCrypto {
  createHash(algorithm: 'sha256'): NodeHash;
}
interface NodeBuffer {
  from(text: string, encoding: 'utf8'): Uint8Array;
}

/**
 * Node's crypto, reached at test time only (the package source uses no platform crypto API,
 * contracts-v1 §7.3). The package compiles without Node types, so the shape used is declared here.
 */
function nodeModules(): { crypto: NodeCrypto; buffer: NodeBuffer } {
  const proc = (globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } })
    .process;
  const crypto = proc.getBuiltinModule('node:crypto') as NodeCrypto;
  const buffer = (proc.getBuiltinModule('node:buffer') as { Buffer: NodeBuffer }).Buffer;
  return { crypto, buffer };
}

describe('SHA-256 constants computed from their FIPS 180-4 definitions', () => {
  it('K0…K63 equal the §4.2.2 table', () => {
    expect(SHA256_ROUND_CONSTANTS).toEqual(words(FIPS_K));
    expect(SHA256_ROUND_CONSTANTS).toHaveLength(64);
  });

  it('H(0) equals the §5.3.3 values', () => {
    expect(SHA256_INITIAL_HASH).toEqual(words(FIPS_H0));
  });
});

describe('SHA-256 against the NIST example vectors', () => {
  for (const example of NIST_EXAMPLES) {
    it(example.name, () => {
      expect(sha256HexOfUtf8(example.message)).toBe(
        example.digest.replace(/\s+/g, '').toLowerCase(),
      );
    });
  }
});

describe('SHA-256 differential test against Node crypto (test-only oracle)', () => {
  const { crypto } = nodeModules();
  const nodeHex = (bytes: Uint8Array): string =>
    crypto.createHash('sha256').update(bytes).digest('hex');

  it('agrees for every length 0…300 bytes (all padding branches, 1–6 blocks)', () => {
    for (let length = 0; length <= 300; length++) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = (i * 151 + length * 7 + 13) & 0xff;
      }
      expect(toLowerHex(sha256(bytes)), `length ${String(length)}`).toBe(nodeHex(bytes));
    }
  });

  it('agrees on a 1 MiB message', () => {
    const bytes = new Uint8Array(1 << 20);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i ^ (i >>> 8)) & 0xff;
    }
    expect(toLowerHex(sha256(bytes))).toBe(nodeHex(bytes));
  });
});

describe('UTF-8 encoding', () => {
  const { buffer } = nodeModules();
  const samples = [
    '',
    'abc',
    '"sha256":{"a":3ff0000000000000}',
    'é ü ñ',
    '€ 中文',
    '😀 𝄞',
    'lone high \ud800 end',
    'lone low \udc00 end',
    'reversed \udc00\ud800',
    '\ud800',
  ];
  for (const text of samples) {
    it(`matches Node Buffer for ${JSON.stringify(text)}`, () => {
      expect(Array.from(utf8Encode(text))).toEqual(Array.from(buffer.from(text, 'utf8')));
    });
  }
});
