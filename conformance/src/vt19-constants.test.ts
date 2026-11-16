/**
 * VT-19 Constants vs primary sources (plan §3): bit equality of the engine's exported constants
 * with the values transcribed from the documents actually obtained. Full evidence, citations,
 * hashes and the list of what could NOT be reached: docs/verification/vt-19-constants.md.
 *
 * Evidence layer: L1 (value equality of exported constants). No L2/L3 content.
 *
 * Source documents (read in full text form on 2026-11-16):
 *   [TN36] G. Petit and B. Luzum (eds.), IERS Conventions (2010), IERS Technical Note No. 36,
 *          Verlag des Bundesamts fuer Kartographie und Geodaesie, Frankfurt am Main, 2010,
 *          https://www.iers.org/fileadmin/SharedDocs/Publikationen/EN/IERS/Publications/tn/TechnNote36/tn36.pdf
 *          SHA-256 b0570ff245a6d76977dc56918c64130cc5bf68b679fa8fffb989137f2b833eea
 *   - Table 1.1 (p. 18), "Earth constants": GM = 3.986004418e14 m^3/s^2 (TCG-compatible,
 *     uncertainty 8e5 m^3/s^2).
 *   - Table 1.2 (p. 19), GRS80 parameters: aE = 6378137 m.
 *
 * NOT covered here, because the document could not be reached from this environment:
 * NGA.STND.0036_1.0.0_WGS84 (2014). So the WGS 84 attribution of both values, and the GM
 * atmosphere variant, are unverified (see the report). These tests check numerical equality with
 * the sources above only; they do not claim a WGS 84 confirmation.
 */
import {
  EARTH_CONSTANTS,
  EARTH_GM_m3ps2,
  EARTH_REFERENCE_RADIUS_m,
} from '@mission-lab/astrodynamics';
import { describe, expect, it } from 'vitest';

/** Source literals exactly as printed (mantissa x 10^exponent written in JS exponent form). */
const TN36_GM_EARTH_m3ps2 = '3.986004418e14'; // TN36 Table 1.1, p. 18
const TN36_GRS80_AE_m = '6378137'; // TN36 Table 1.2, p. 19

/** Big-endian IEEE-754 binary64 bit pattern as 16 hex digits. */
function bits(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

describe('VT-19 constants vs IERS TN36 (L1, bit equality)', () => {
  it('GM equals TN36 Table 1.1 value; binary64 42f6a8665bda5400, an exact integer', () => {
    expect(Object.is(EARTH_GM_m3ps2, Number(TN36_GM_EARTH_m3ps2))).toBe(true);
    expect(bits(EARTH_GM_m3ps2)).toBe('42f6a8665bda5400');
    expect(Number.isInteger(EARTH_GM_m3ps2)).toBe(true);
    expect(EARTH_GM_m3ps2).toBe(398600441800000);
  });

  it('reference radius equals TN36 Table 1.2 (GRS80) aE; binary64 415854a640000000', () => {
    expect(Object.is(EARTH_REFERENCE_RADIUS_m, Number(TN36_GRS80_AE_m))).toBe(true);
    expect(bits(EARTH_REFERENCE_RADIUS_m)).toBe('415854a640000000');
  });

  it('the constants record carries the same values as the scalar exports', () => {
    expect(Object.is(EARTH_CONSTANTS.mu_m3ps2, EARTH_GM_m3ps2)).toBe(true);
    expect(Object.is(EARTH_CONSTANTS.referenceRadius_m, EARTH_REFERENCE_RADIUS_m)).toBe(true);
  });

  it('is not the IERS zero-tide equatorial radius (6378136.6) nor the GRS80 GM (3.986005e14)', () => {
    // Guards against silently swapping in a different, close-by convention (docs report §4).
    expect(EARTH_REFERENCE_RADIUS_m).not.toBe(6378136.6);
    expect(EARTH_GM_m3ps2).not.toBe(3.986005e14);
  });
});
