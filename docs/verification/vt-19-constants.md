# VT-19: constants against primary sources

Task: ML-TASK-011 (VT-19 part). Plan reference: `m1-verification-plan.md` §3.
Date: 2026-11-16. Author role: Verification Engineer.
Evidence layer: L1 only (value equality). No L2/L3 content applies.

## 1. Result in one paragraph

The ERA coefficients in ADR-004 are confirmed against IERS Conventions (2010). The engine's GM
value is confirmed as a number against IERS Conventions (2010) Table 1.1, and the reference radius
equals the GRS80 semi-major axis printed in the same document. **The WGS 84 standard itself
(NGA.STND.0036) could not be reached**, so the attribution of both values to WGS 84, and the
"atmosphere included" variant of GM, are **not verified** by a primary WGS 84 source. No value was
found to disagree with any source obtained.

## 2. Documents obtained

| Id | Document | URL | Retrieved | Size | SHA-256 |
|---|---|---|---|---|---|
| TN36 | G. Petit, B. Luzum (eds.), IERS Conventions (2010), IERS Technical Note No. 36, Verlag des BKG, Frankfurt am Main 2010, ISSN 1019-4568 | https://www.iers.org/fileadmin/SharedDocs/Publikationen/EN/IERS/Publications/tn/TechnNote36/tn36.pdf (link taken from the iers.org TN36 page) | 2026-11-16 | 2926081 bytes | `b0570ff245a6d76977dc56918c64130cc5bf68b679fa8fffb989137f2b833eea` |

The PDF was saved in the agent scratch directory outside the repository and is not committed.
Page numbers below are the printed page numbers, which equal the PDF page indices.
Text was extracted with `pdftotext` (xpdf 4.00); Table 1.1 was read from the raw content-stream
order because the layout mode misaligns its rows.

## 3. Documents NOT obtained (exactly what was tried)

| Item | Attempts | Outcome |
|---|---|---|
| NGA.STND.0036_1.0.0_WGS84 (2014) | `curl` and `WebFetch` to `earth-info.nga.mil/GandG/publications/NGA_STND_0036_1_0_0_WGS84/NGA.STND.0036_1.0.0_WGS84.pdf` (https and http), `earth-info.nga.mil/` , `earth-info.nga.mil/php/download.php?file=coord-wgs84`, `earth-info.nga.mil/index.php?dir=wgs84&action=wgs84` | connection timed out (30 to 40 s) every time |
| same | `nsgreg.nga.mil/doc/view?i=4085`, `nsgreg.nga.mil/`, `nsgreg.nga.mil/GandG/wgs84.jsp` and `.html` | connection reset (curl error 35; WebFetch ECONNRESET) |
| same, official mirror | Web search for `NGA.STND.0036` found no mirror on an official domain. A copy exists at `w3.uch.edu.tw` (a university site) and on Scribd; neither is an official mirror and their authenticity cannot be checked against an NGA hash, so they were **not used** | not obtained |
| IAU 2000 Resolution B1.8 (primary text) | guessed `iau.org/static/resolutions/IAU2000_French.pdf` and `_English.pdf`, `iau.org/administration/resolutions/general_assemblies/`, `iau.org/Iau/Publications/List/Resolutions`, plus a site-restricted search | all HTTP 404; the search returned only secondary reprints, not used |

Consequence: nothing in this report is cited to NGA.STND.0036. Wherever it would be needed, the
item is marked unverified.

## 4. Constant-by-constant comparison

### 4.1 Earth gravitational parameter GM

| Field | Content |
|---|---|
| Value under test | `EARTH_GM_m3ps2 = 3.986004418e14` m³/s², `packages/astrodynamics/src/constants.ts` line 34; proposed with the same value in `docs/architecture/proposed-architecture.md` §3, row "μ (Earth)" (line 53) |
| Source value | TN36 Table 1.1 "Body constants / Earth constants", row "GM", 3.986004418 × 10¹⁴ m³s⁻², uncertainty 8 × 10⁵ m³s⁻², reference [7] (Ries et al., 1992), p. 18. Footnote there: TCG-compatible value. Text on p. 19 gives the TT-compatible value as 3.986004415 × 10¹⁴ m³s⁻² |
| Comparison | Decimal strings identical. `Number("3.986004418e14")` is the integer 398600441800000 (< 2⁵³), exactly representable; binary64 `0x42f6a8665bda5400`. Engine bits equal source bits (test `conformance/src/vt19-constants.test.ts`) |
| Verdict | **Matches IERS TN36 (bit equal). WGS 84 NGA value: NOT VERIFIED (document unreachable).** |

Convention notes.

- TN36 gives the value as TCG-compatible, with an uncertainty of 8e5 m³/s², about 2e-9 relative.
  The TT-compatible figure differs by about 3 m³/s² (3.986004415e14). The M1 model has no relativistic
  time-scale content, so this is irrelevant at the model's accuracy; the engine's simulation time
  is plain SI seconds.
- TN36 Table 1.2 lists GRS80 with GM = 3.986005 × 10¹⁴ m³s⁻² (p. 19). That is a different number from
  the engine's. The engine value is therefore not the GRS80 GM.
- GM with versus without the atmosphere: this distinction is **defined by the WGS 84 standard**,
  which was not obtained, so it is not verified here. TN36 does not make the distinction in
  Table 1.1. Physical reasoning (not a source citation): for a point-mass model of satellite motion
  the attracting mass that matters is that of the whole Earth including its atmosphere, which is
  the usual choice for Earth-satellite two-body work, so an "atmosphere included" GM is the right
  variant in principle. The claim that the number 3.986004418e14 is the atmosphere-included WGS 84
  value remains for the owner to confirm against NGA.STND.0036 (the engine header attributes it to
  an NGA 2012 ICG presentation, a secondary document).

### 4.2 Reference radius

| Field | Content |
|---|---|
| Value under test | `EARTH_REFERENCE_RADIUS_m = 6378137` m, `constants.ts` line 48; proposed as "WGS 84 equatorial radius" in `proposed-architecture.md` §3 (line 54) |
| Source value | TN36 Table 1.2, "Parameters of the Geodetic Reference System GRS80", row aE = 6378137 m, p. 19 |
| Comparison | Equal; exact integer, binary64 `0x415854a640000000`. Engine bits equal source bits (test) |
| Verdict | **Matches the GRS80 semi-major axis in TN36. WGS 84 semi-major axis: NOT VERIFIED (document unreachable).** |

Convention notes.

- TN36 Table 1.1 gives a different equatorial radius for the IERS conventions: aE = 6378136.6 m
  (uncertainty 0.1 m, from Groten 2004, "zero tide" value). The engine's 6378137 m differs from it
  by 0.4 m. This is a legitimate different convention, not an error, as long as the radius is
  documented as the GRS80/WGS 84 value. It is used only for the display altitude and the surface
  flag (architecture §3), so 0.4 m is far below any consequence for M1 outputs; a guard test fails
  if the engine ever silently switches to 6378136.6.
- That WGS 84 uses the same a as GRS80 is widely stated, but it is **not shown by any document
  obtained here** and is not asserted by this report.

### 4.3 ERA coefficients (ADR-004)

| Field | Content |
|---|---|
| Value under test | `docs/architecture/adr/ADR-004-frame-and-time-conventions.md` line 21: ERA = 2π (0.7790572732640 + 1.00273781191135448 · T_u), T_u = JD(UT1) − 2451545.0 |
| Source value | TN36 Eq. (5.14), §5.5.3 "Earth Rotation Angle", p. 52: ERA(T_u) = 2π(0.7790572732640 + 1.00273781191135448 T_u), T_u = Julian UT1 date − 2451545.0. Table 1.1, p. 18: ERA at J2000.0 = 0.7790572732640 rev and rate 1.00273781191135448 rev/UT1 day, both "Defining", reference [3] (IAU XXIV General Assembly, 2000) |
| Comparison | Both coefficient strings and the epoch JD 2451545.0 are textually identical. No engine export exists, so no code test |
| Verdict | **Matches IERS TN36 (string equality).** IAU 2000 Resolution B1.8 primary text not reached (§3) |

Notes.

- The rate has 18 significant digits and is not representable in binary64: `1.00273781191135448`
  parses to 1.0027378119113546 (`0x3ff00b36cdc9f32b`), a difference of about 1.2e-16 rev/day.
  The offset 0.7790572732640 parses to `0x3fe8ee0984cc2772`. If ERA is ever computed, TN36 Eq. (5.15)
  (UT1 day fraction + 0.7790572732640 + 0.00273781191135448 T_u, modulo 2π) is the form TN36
  recommends to limit rounding. For M1 (display only) this is immaterial.
- ADR-004 writes 2π, TN36 writes the same factor with the π glyph lost in text extraction;
  the "rev" unit of Table 1.1 confirms the 2π factor.

## 5. Summary table

| Constant | Value under test | Source value | Citation | Verdict |
|---|---|---|---|---|
| GM | 3.986004418e14 m³/s² (`constants.ts:34`) | 3.986004418 × 10¹⁴ m³s⁻² | IERS TN36 (2010), Table 1.1, p. 18 | Match, bit equal. WGS 84 / atmosphere variant unverified |
| Reference radius | 6378137 m (`constants.ts:48`) | 6378137 m (GRS80 aE) | IERS TN36 (2010), Table 1.2, p. 19 | Match, bit equal. WGS 84 a unverified |
| ERA offset | 0.7790572732640 rev (ADR-004 l. 21) | 0.7790572732640 rev | TN36 Table 1.1 p. 18; Eq. (5.14) §5.5.3 p. 52 | Match (string) |
| ERA rate | 1.00273781191135448 rev/UT1 day (ADR-004 l. 21) | 1.00273781191135448 rev/UT1 day | same | Match (string) |

## 6. Not verified

- WGS 84 GM, with and without atmosphere, and WGS 84 semi-major axis against NGA.STND.0036.
  Needed: a copy of NGA.STND.0036 (2014) obtained by the owner or from a reachable network, then
  compare the GM and a values. If both stay as they are, only the attribution text in `constants.ts`
  and architecture §3 changes, which is the engineering owner's call, not made here.
- The statement in the engine's source header that the value is the "mass of atmosphere included"
  WGS 84 parameter.
- IAU 2000 Resolution B1.8 primary text.
- The engine citation string `EARTH_CONSTANTS_SOURCE` (constants.ts) names an NGA 2012 ICG
  document; that citation was not checked here.
