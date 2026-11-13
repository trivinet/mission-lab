/**
 * SHA-256 (FIPS 180-4), synchronous, in-repo (contracts-v1 §7.3, owner decision 8 of 2026-11-11).
 *
 * Primary source actually opened (2026-11-13):
 *   NIST, FIPS PUB 180-4 "Secure Hash Standard (SHS)", August 2015,
 *   https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf (DOI 10.6028/NIST.FIPS.180-4).
 *   Used: §2.2.2 and §3.2 (word operations: addition modulo 2^32, SHR, ROTR), §4.1.2 Eqs. 4.2–4.7
 *   (Ch, Maj, Σ0, Σ1, σ0, σ1), §4.2.2 (K0…K63: "the first thirty-two bits of the fractional parts
 *   of the cube roots of the first sixty-four prime numbers"), §5.1.1 (padding), §5.2.1 (parsing
 *   into 512-bit blocks of sixteen big-endian 32-bit words), §5.3.3 (H(0): "the first thirty-two
 *   bits of the fractional parts of the square roots of the first eight prime numbers"), §6.2.1
 *   and §6.2.2 (hash computation).
 *
 * Constants are COMPUTED here from those definitions with exact integer arithmetic (BigInt), not
 * typed in: K_t = floor(cbrt(p_t) · 2^32) mod 2^32 = floor(cbrt(p_t · 2^96)) mod 2^32, and
 * H(0)_i = floor(sqrt(p_i) · 2^32) mod 2^32 = floor(sqrt(p_i · 2^64)) mod 2^32. The unit tests
 * compare them with the hexadecimal tables of §4.2.2 and §5.3.3, transcribed into the test file
 * from the document above.
 *
 * Text is hashed as its UTF-8 encoding (contracts-v1 §7.1). The encoder below follows the UTF-8
 * definition (1–4 bytes per Unicode scalar value). A lone UTF-16 surrogate is not a scalar value;
 * it is encoded as U+FFFD (the replacement behaviour of the WHATWG TextEncoder and of Node's
 * Buffer). It cannot occur in a canonical request payload: `JSON.stringify` escapes lone
 * surrogates (ECMAScript 2019 well-formed JSON.stringify), and every other payload character is
 * ASCII.
 *
 * Pure and deterministic; no platform crypto API, no I/O.
 */

const WORD_MASK = 0xffffffffn;

/** Floor of the k-th root (k = 2 or 3) of a non-negative BigInt, by integer Newton iteration. */
function integerRoot(n: bigint, k: 2n | 3n): bigint {
  if (n < 2n) {
    return n;
  }
  // Start above the root: 2^ceil(bits/k) > n^(1/k).
  const bits = BigInt(n.toString(2).length);
  let x = 1n << ((bits + k - 1n) / k);
  for (;;) {
    // Newton step for x^k = n, integer form; decreases monotonically while x > floor root.
    const y = ((k - 1n) * x + n / x ** (k - 1n)) / k;
    if (y >= x) {
      return x;
    }
    x = y;
  }
}

/** The first `count` prime numbers, by trial division. */
function firstPrimes(count: number): number[] {
  const primes: number[] = [];
  for (let candidate = 2; primes.length < count; candidate++) {
    if (primes.every((p) => candidate % p !== 0)) {
      primes.push(candidate);
    }
  }
  return primes;
}

const PRIMES_64 = firstPrimes(64);

/** FIPS 180-4 §4.2.2: K0…K63 computed from the definition (see module comment). */
export const SHA256_ROUND_CONSTANTS: readonly number[] = Object.freeze(
  PRIMES_64.map((p) => Number(integerRoot(BigInt(p) << 96n, 3n) & WORD_MASK)),
);

/** FIPS 180-4 §5.3.3: H(0)_0…H(0)_7 computed from the definition (see module comment). */
export const SHA256_INITIAL_HASH: readonly number[] = Object.freeze(
  PRIMES_64.slice(0, 8).map((p) => Number(integerRoot(BigInt(p) << 64n, 2n) & WORD_MASK)),
);

const K = Uint32Array.from(SHA256_ROUND_CONSTANTS);
const H0 = Uint32Array.from(SHA256_INITIAL_HASH);

/** Element i of a word array; indices are always in range here (the 0 is never used). */
function word(words: Uint32Array, i: number): number {
  return words[i] ?? 0;
}

/** ROTR^n(x) on a 32-bit word (FIPS 180-4 §3.2 item 4). */
function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * UTF-8 encoding of a JavaScript string (sequence of UTF-16 code units). Lone surrogates are
 * encoded as U+FFFD (module comment).
 */
export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

/**
 * SHA-256 digest of a byte string (FIPS 180-4 §6.2). Returns the 32-byte digest
 * H(N)_0 ‖ … ‖ H(N)_7, big-endian.
 *
 * Domain: message length < 2^53 bytes (JavaScript array limit; the standard allows < 2^64 bits).
 */
export function sha256(message: Uint8Array): Uint8Array {
  const length = message.length;
  // §5.1.1: append bit 1 (byte 0x80), k zero bits, then the 64-bit big-endian bit length ℓ.
  const paddedLength = Math.ceil((length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  // ℓ = 8·length as two 32-bit words (§3.1 item 3): high = floor(length / 2^29).
  view.setUint32(paddedLength - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(paddedLength - 4, (length * 8) >>> 0, false);

  const H = Uint32Array.from(H0);
  const W = new Uint32Array(64);
  for (let block = 0; block < paddedLength; block += 64) {
    // §6.2.2 step 1: message schedule.
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(block + 4 * t, false);
    }
    for (let t = 16; t < 64; t++) {
      const w2 = word(W, t - 2);
      const w15 = word(W, t - 15);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10); // σ1, Eq. 4.7
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3); // σ0, Eq. 4.6
      W[t] = s1 + word(W, t - 7) + s0 + word(W, t - 16); // stored modulo 2^32
    }
    // Step 2: working variables.
    let a = word(H, 0);
    let b = word(H, 1);
    let c = word(H, 2);
    let d = word(H, 3);
    let e = word(H, 4);
    let f = word(H, 5);
    let g = word(H, 6);
    let h = word(H, 7);
    // Step 3.
    for (let t = 0; t < 64; t++) {
      const bigSigma1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25); // Eq. 4.5
      const ch = (e & f) ^ (~e & g); // Eq. 4.2
      const t1 = (h + bigSigma1 + ch + word(K, t) + word(W, t)) >>> 0;
      const bigSigma0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22); // Eq. 4.4
      const maj = (a & b) ^ (a & c) ^ (b & c); // Eq. 4.3
      const t2 = (bigSigma0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    // Step 4 (Uint32Array stores modulo 2^32).
    H[0] = word(H, 0) + a;
    H[1] = word(H, 1) + b;
    H[2] = word(H, 2) + c;
    H[3] = word(H, 3) + d;
    H[4] = word(H, 4) + e;
    H[5] = word(H, 5) + f;
    H[6] = word(H, 6) + g;
    H[7] = word(H, 7) + h;
  }
  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) {
    out.setUint32(4 * i, word(H, i), false);
  }
  return digest;
}

/** Lowercase hexadecimal text of a byte string. */
export function toLowerHex(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    text += byte.toString(16).padStart(2, '0');
  }
  return text;
}

/** Lowercase hex SHA-256 digest of the UTF-8 encoding of `text`. */
export function sha256HexOfUtf8(text: string): string {
  return toLowerHex(sha256(utf8Encode(text)));
}
