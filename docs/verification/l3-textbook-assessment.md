# L3 Textbook Assessment — Wakker, *Fundamentals of Astrodynamics*

**Document ID:** ML-VER-009 · **Date:** 2026-11-11 (published 2026-11-16) · **Author:** Verification Engineer (ML-TASK-012 part A) · **Status:** Accepted by the owner on 2026-11-16, published **without values from the book** (owner decision OA-15, option 1). The book is not used as a source of reference numbers; gate G1 recorded the textbook as an accepted L3 gap ([G1-review.md](../releases/G1-review.md), decision 3).

Assesses whether the textbook the owner offered under decision D-5 (`docs/releases/G0-review.md`)
can serve as an external reference (evidence layer L3, `m1-verification-plan.md` §2) for the M1
test families VT-01…VT-19. No reference dataset is created here and no number from the book is
reproduced in this document or anywhere in the repository. The draft of 2026-11-11 contained the
book's example and table values; they were removed before publication. The book's locations
(section, equation, page) are kept so a reader with the book can find each item.

Citations give chapter, section, equation number and **book page** (the page number printed in the
running header). PDF page = book page + 8 for the body of the book.

## 1. How the book was read, and the limits of that reading

- The Read tool could not render the PDF (the page renderer `pdftoppm` is not installed). The text
  layer was extracted instead with `pdftotext` 4.00 (Xpdf, Glyph & Cog), the only PDF tool present
  on the dev machine (bundled with Git for Windows).
- **Equations were not seen.** The book was typeset in WordPerfect and its formulas are embedded
  objects that the text layer does not contain: only the equation numbers survive. Every statement
  below about what an equation expresses is inferred from the surrounding prose, not from the
  formula itself. Before any equation is used as a reference, a second reader must check it on a
  rendered page.
- **Figures were not seen.** Several of the book's numerical results are read from figures.
- **Tables were partly scrambled.** Column alignment in Appendix B and in Table 22.1 was lost in
  extraction.
- Pages actually read in full (text layer): front matter and contents (PDF 1–8); book pp. 1–12,
  160–174, 248–249, 250–284, 285–290, 313–322, 598–600, 604–612, 671–682. Pages searched by keyword
  only (not read in full): the whole text, for "example", "Stumpff", "universal variable",
  "f- and g", "radial", "along-track", "cross-track", "WGS", "IERS", "GCRF", "ICRF",
  "rotation angle"; and pp. 22–23, 132–139, 198–202, 291–312 for specific passages.
- Not read: chapters 2–4, 7, 9, 10, 14–21, 23 (out of M1 scope), most of chapter 5, chapter 8
  beyond the equation-solving passage, and the remainder of chapter 12.

## 2. Bibliographic identification

| Field | Value (title and copyright pages) |
|---|---|
| Title | Fundamentals of Astrodynamics |
| Author | Karel F. Wakker, Faculty of Aerospace Engineering, Delft University of Technology |
| Publisher | Institutional Repository, Library, Delft University of Technology, Delft, The Netherlands |
| Date | January 2015 |
| ISBN | 978-94-6186-419-2 |
| Distribution | Downloadable from the TU Delft repository (repository.tudelft.nl) |
| Local file | `Fundamentals_of_Astrodynamics_VersieRepository_250115.pdf`, 21 440 528 bytes, SHA-256 `5d6f3f8d6170a05c4fcad566cfee98a713830e78294a26e251e073ed7b106362` |

**Version ambiguity (open).** The title page says January 2015, but the text refers to events up to
mid-2015, and the file-name suffix may be a date or a repository version tag. Every future citation
should carry the SHA-256 above.

**Terms of use (copyright page), paraphrased.** All rights reserved; individuals may copy parts
for personal, non-commercial use with full credit to the author, his affiliation and the title. No
open licence is stated. **Owner decision (2026-11-16):** the public repository cites and
paraphrases the book only; no passage, table, figure or example value is stored.

## 3. Coverage of the M1 test families

Legend: **Eq** = closed-form relation or algorithm, usable as a cited analytical reference (L1) or
as the documented basis of an independent L2 method; **Ex** = worked numerical example with stated
inputs and outputs (a potential L3 case, values not reproduced here); **—** = nothing found in the
pages read.

| VT | Family | What the book offers | Usable as |
|---|---|---|---|
| VT-01 | Vector/matrix utilities | Orthogonality of the composed rotation matrix and the resulting identities: §11.8, eqs. (11.43)–(11.45), pp. 273–274 (Eq) | L1 citation only |
| VT-02 | Elements → Cartesian | Two derivations: spherical trigonometry, §11.8, eqs. (11.26)–(11.38), pp. 268–271; rotation matrices, eqs. (11.39)–(11.42), pp. 272–273 (Eq). **No numerical example found** | Basis for L2c, not L3 |
| VT-03 | Round trip state ↔ elements | Inverse transformation, §11.10, eqs. (11.60)–(11.67), pp. 276–278 (Eq). No numerical example | L1/L2 basis only |
| VT-04 | Degenerate elements | Undefined elements and their substitutes (longitude of perigee, argument of latitude, true/mean longitude): §11.5, p. 262; conditions for undefined elements: p. 278 (prose); equinoctial elements: §22.4, p. 598 | Documentation support; not numeric |
| VT-05 | Circular and elliptical propagation | Kepler's equation and the E–ν relation, §6.5, eqs. (6.31)–(6.36), pp. 167–169; iterative solution described, p. 170; series solution, pp. 172–174; closed-form elliptic f and g, eqs. (11.90)–(11.95), pp. 282–283; Taylor-series f and g, eqs. (11.68)–(11.79), pp. 279–281 (Eq). **Ex:** a highly elliptical orbit, p. 169; the geostationary radius, p. 162 | Eq: L1 and L2a basis. Ex: weak L3, 3–5 significant digits |
| VT-06 | Energy conservation | Energy integral and vis-viva, eq. (6.21), p. 163; relations of a, p, e to energy and angular momentum, p. 160 (Eq) | L1 citation |
| VT-07 | Angular momentum conservation | eq. (11.80), p. 282; eq. (11.37), p. 271 (Eq) | L1 citation |
| VT-08 | Full-period closure | Period, eqs. (6.25)–(6.29), pp. 164–165 (Eq) | L1 citation |
| VT-09 | Sampling independence | — | — |
| VT-10 | Determinism | — (not a physics question) | — |
| VT-11 | RSW basis | Gauss's decomposition of a perturbing acceleration into radial, in-plane (direction of motion) and angular-momentum components: §22.5, p. 599. Geometrically the Mission Lab RSW triad, with different letters (see §5) | L1 citation (definition) |
| VT-12 | Maneuver frame transformation | Rotation of that frame to inertial axes, eq. (22.49), p. 600 (Eq). No numerical example | Basis for L2c, not L3 |
| VT-13 | Impulsive velocity change | Definition of the impulsive shot: §1.7, pp. 22–23 (prose) | Conceptual only |
| VT-14 | Zero-magnitude maneuver | — | — |
| VT-15 | Post-maneuver orbit | Hohmann impulses, eqs. (12.20)–(12.23), p. 290; plane changes for circular orbits, eqs. (13.8)–(13.18), pp. 315–318; linearised Gauss equations, eqs. (22.62)–(22.63), pp. 605–606 (Eq). **Ex:** Table 22.1, p. 610; spherical-triangle examples, pp. 315–316; two exact consequences stated in prose, pp. 316–317 | Eq: L1. Ex: weak L3 at percent level (Table 22.1) or 0.1° level (ch. 13) |
| VT-16 | Escape / surface intersection | Hyperbolic position–time equation (8.23) and its iterative solution, §8.4, pp. 198–200 (Eq). No usable example | L1/L2 basis only |
| VT-17 | Serialisation round trip | — (not a physics question) | — |
| VT-18 | Invalid input handling | — (not a physics question) | — |
| VT-19 | Constants | Earth constants in Appendix B (see §4). **No Earth Rotation Angle expression.** GMST by an IAU convention, p. 260 | Secondary source only; does not cover ERA |

### 3.1 Candidate L3 cases (locations only)

| ID | Location | What it would check | Stated precision | Gaps for use as a reference case |
|---|---|---|---|---|
| WK-01 | §6.5, p. 169 (with Fig. 6.8, p. 170) | Period and the time ↔ anomaly relation of a highly elliptical Earth orbit | 3 significant digits (period), 0.1° (anomaly) | Earth radius used for the stated altitudes not given. About 1e-3 relative only |
| WK-02 | §6.2, p. 162 | Radius and altitude of the geostationary orbit from its period | 5 significant digits | Period given to 1 s; radius for the altitude not named. About 1e-4 relative |
| WK-03 | §22.7, Table 22.1, p. 610 | Optimum location, direction and magnitude of a single small impulse for five element changes | 3 significant digits | From the **linearised** equations: first-order agreement only; ω, Ω and the burn point must be chosen by the verifier; table columns scrambled in extraction |
| WK-04 | §13.1, p. 315 | Geometry of a combined inclination and node change | 0.1° | Pure spherical geometry, no orbit size, no Δv |
| WK-05 | §13.2, p. 316 | Geometry of a node change at constant inclination | 0.1° | As WK-04 |

**The book has no example with which an element→state conversion or a propagation could be checked
numerically** to more than about five significant digits.

## 4. Constants stated by the book, compared in kind with Mission Lab

Mission Lab's constants are μ = 3.986004418 × 10¹⁴ m³/s² and reference radius 6 378 137 m
(`packages/astrodynamics/src/constants.ts`), confirmed against IERS Conventions 2010 in
[vt-19-constants.md](vt-19-constants.md). Values printed in the book are not reproduced.

| Quantity | Where in the book | Source the book attributes | Comparison with Mission Lab |
|---|---|---|---|
| Earth gravitational parameter | p. 9 (prose); Tables B.2, B.4, pp. 672–673 | Appendix B footnote: compilations (Allen's Astrophysical Quantities, NASA NSSDC, NASA JPL SSD, The Astronomical Almanac Online) | Same digits as Mission Lab's μ after unit conversion; the book does not name WGS 84 |
| Equatorial radius of the "reference ellipsoid" | Table B.2, p. 672; rounded in Table B.6, p. 674 | Same footnote; ellipsoid not named | **Differs from 6 378 137 m at the sub-metre level.** Book cases that use it differ from Mission Lab's reference sphere |
| Earth mean radius | Tables B.1, B.2, B.4 | Same footnote | Not used by M1. Book examples stating an altitude may use it |
| Flattening, polar radius, rotation rate, G | Tables B.1, B.2; p. 9 | Same footnote | Not used by M1. Flattening: p. 264 and Table B.2 disagree in the extracted text |
| Earth Rotation Angle coefficients | Not given | — | **Not covered**; VT-19 uses IERS Conventions 2010 |

The book is a secondary compilation and cannot be the primary source for VT-19.

## 5. Conventions that differ from Mission Lab's

| Topic | Book | Mission Lab | Conversion a reference case needs |
|---|---|---|---|
| Maneuver / perturbation axes | Letters **S, N, W**: S radial, N in-plane in the direction of motion, W along the angular momentum (§22.5, p. 599) | Letters **R, S, W** (contracts-v1) | Book S → ML R, book N → ML S, book W → ML W. **The letter S names different axes** |
| Chapter 9 relative-motion frame | X radial, Y along-track, Z cross-track (p. 204) | RSW | Letters only; M1 has no relative motion |
| Pure out-of-plane impulse | An inclination change at constant speed needs an impulse with a component against the velocity (§13.3, eq. (13.18), p. 318) | A pure W component is perpendicular to the plane and raises the speed | A case built on (13.17)/(13.18) must carry its S component |
| Inertial frame | Non-rotating geocentric equatorial frame (§11.3, p. 251); GCRF described (p. 248) | `GCRF` (ADR-004) | None for two-body dynamics |
| Inclination range | Closed at 180° in §11.5, open in §11.9–11.10 | i ∈ [0°, 180°] | None for i < 180° |
| Degenerate elements | Substitutes described; no fixed assignment rule (p. 262) | ADR-008 convention | Consistent in kind |
| Units | km, km/s, degrees, hours | SI internally | Unit conversion only |
| Propagation algorithm | Universal variables explicitly not presented (§11.11, p. 278) | Universal-variable Kepler (ADR-005) | None; suits use as a basis for L2 methods |

No statement in the pages read contradicts an approved Mission Lab document.

## 6. Verdict

1. **Strong as an analytical (L1) reference and as a citable basis for the L2 methods**, once a
   second reader has checked each equation on a rendered page.
2. **Weak as an L3 numerical reference.** Five worked examples (WK-01…WK-05), all with 3–5
   significant digits, several with an unstated Earth radius, one from linearised equations. They
   could catch gross convention errors only, and cannot back any family at float64-tolerance
   precision.
3. **Not covered by the book:** VT-02; VT-05 at tolerance precision and all hyperbolic or
   post-maneuver propagation (VT-16); VT-12; VT-15 at tolerance precision; VT-19.
4. **Outcome (owner, 2026-11-16).** The book is cited, never transcribed. Orekit (ML-TASK-012
   part B) is the L3 source for M1; the textbook stays an accepted L3 gap (G1-review.md decision 3).

## 7. Not verified

- No equation body, figure or table layout was seen on a rendered page.
- Whether the worked examples are internally consistent.
- Which file revision this is (§2).
- Chapters not read (§1).
