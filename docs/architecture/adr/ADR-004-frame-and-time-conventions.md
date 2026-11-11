# ADR-004 — Frame, time and Earth-orientation conventions for M1

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-003, OD-005 · **Mitigates:** R-002

## Context
ML-SYS-001 §5.2 and §5.6 require a precisely declared inertial frame and time scale before
implementation, and forbid treating TEME, GCRF, EME2000 and Earth-fixed frames as interchangeable.
§9.3 also asks for a high-quality Earth, which must be oriented somehow (review finding F-08).

## Decision

**Frame.** One frame, id `GCRF`: origin at Earth's centre of mass, axes aligned with the
Geocentric Celestial Reference Frame. M1 accepts and produces no other frame. The RSW frame is a
local frame used only to express maneuver inputs.

**Time.** The scenario epoch is `{ scale: "UTC", iso }`. All physics uses `t_s`, elapsed SI
seconds from that epoch (float64). One module converts between epoch + `t_s` and a displayed UTC
timestamp, without leap-second handling.

**Earth orientation (display only).** The Earth mesh is rotated about inertial +Z by the Earth
Rotation Angle, ERA = 2π (0.7790572732640 + 1.00273781191135448 · T_u), T_u = JD(UT1) − 2451545.0
(IERS Conventions 2010), with UT1 approximated by UTC. Precession, nutation and polar motion are
ignored. The constants are to be confirmed against the primary source by the Verification
Engineer.

## Rationale
- For point-mass two-body dynamics the equations are identical in any inertial frame, so naming
  GCRF costs nothing now and makes later interoperability (CCSDS messages, Orekit comparison)
  unambiguous.
- `t_s` keeps calendar arithmetic out of the physics and makes results reproducible and exactly
  comparable.
- Not rotating the Earth would look wrong; a full IAU 2006/2000A reduction is unjustified for an
  illustrative backdrop. The simplified orientation is off by roughly the accumulated precession
  since J2000 (a few tenths of a degree) plus |UT1 − UTC| < 0.9 s of rotation. That is invisible
  at globe scale and unacceptable for ground tracks — which is why M1 derives no numeric output
  from it.

## Consequences
- The UI must label the Earth orientation as illustrative and list it under model limitations
  (ML-FR-012).
- Ground tracks, sub-satellite points and geodetic altitude are **out of M1**. Introducing them
  (M2) requires a new ADR defining the full inertial→Earth-fixed transformation.
- If a leap second falls inside a simulated span, displayed UTC labels after it are 1 s off.
  Recorded as a limitation.
