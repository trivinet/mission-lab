"""Case definitions of the L3 Orekit datasets (ML-TASK-012 part B).

The orbit grid is the one of m1-verification-plan.md §5 with the element values the Verification
Engineer chose for the L2 datasets (ML-TASK-011, recorded in test-data/reference-cases/vt-02/*.json
`inputs.elements`), so that every L3 case corresponds to an L2 case. The values are inputs, not
reference values. Sampling (duration, output step) and maneuvers likewise mirror the L2 VT-05,
VT-15 and VT-16 requests where a counterpart exists.
"""

import math

PI = math.pi  # binary64 nearest to π, as Math.PI in the contract (§3)
TWO_PI_BELOW = 6.283185307179585  # largest binary64 below fl(2π) (as in the L2 grid)


def el(a, e, i, raan, argp, nu):
    return {
        "semiMajorAxis_m": a,
        "eccentricity": e,
        "inclination_rad": i,
        "raan_rad": raan,
        "argPeriapsis_rad": argp,
        "trueAnomaly_rad": nu,
    }


# id, plan §5 row, description, elements, VT-05 duration (s), VT-05 output step (s)
GRID = [
    (
        "c1-circular-inclined",
        "C1",
        "Circular low orbit, inclined (argument of periapsis undefined)",
        el(7000000.0, 0.0, 0.9, 1.2, 0.0, 0.3),
        58240.0,
        364.0,
    ),
    (
        "c2-circular-equatorial",
        "C2",
        "Circular equatorial (doubly degenerate elements)",
        el(7000000.0, 0.0, 0.0, 0.0, 0.0, 0.7),
        58240.0,
        364.0,
    ),
    (
        "c3-elliptical-equatorial",
        "C3",
        "Elliptical equatorial (node undefined)",
        el(10000000.0, 0.3, 0.0, 0.0, 1.1, 2.0),
        99520.0,
        622.0,
    ),
    (
        "c4-moderate-inclined",
        "C4",
        "Moderately elliptical, inclined (general case)",
        el(12000000.0, 0.4, 0.5, 2.5, 4.0, 5.5),
        130880.0,
        818.0,
    ),
    (
        "c5-molniya",
        "C5",
        "Highly elliptical, Molniya-like (conditioning near perigee)",
        el(26000000.0, 0.74, 1.1, 4.2, 4.7, 0.2),
        417280.0,
        2608.0,
    ),
    (
        "c6-geo-radius",
        "C6",
        "Geostationary-scale radius, circular, slightly inclined (large scale, long period)",
        el(42000000.0, 0.0, 0.001, 3.0, 0.0, 1.0),
        856640.0,
        5354.0,
    ),
    (
        "c7-near-polar-retrograde",
        "C7",
        "Near-polar retrograde (i > 90°), near-circular (quadrant handling)",
        el(7000000.0, 0.01, 1.7, 5.0, 3.0, 6.2),
        58240.0,
        364.0,
    ),
    (
        "c8-angle-boundaries-a",
        "C8",
        "Angles at boundaries: Ω = 0, ω = π, ν just below 2π, i = π/2",
        el(7000000.0, 0.005, PI / 2, 0.0, PI, TWO_PI_BELOW),
        58240.0,
        364.0,
    ),
    (
        "c8-angle-boundaries-b",
        "C8",
        "Angles at boundaries, retrograde: Ω just below 2π, ω = 0, ν = π, i = 2.5",
        el(7000000.0, 0.01, 2.5, TWO_PI_BELOW, 0.0, PI),
        58240.0,
        364.0,
    ),
]

GRID_BY_ID = {g[0]: g for g in GRID}


def with_nu(grid_id, nu):
    e = dict(GRID_BY_ID[grid_id][3])
    e["trueAnomaly_rad"] = nu
    return e


def period_s(grid_id):
    """fl(2π/n), n = √(μ/a³), from the grid a (the binary64 period used for "after 1T" cases)."""
    from l3lib import MU_M3PS2

    a = GRID_BY_ID[grid_id][3]["semiMajorAxis_m"]
    return 2 * math.pi / math.sqrt(MU_M3PS2 / a**3)


def maneuver_cases():
    """Maneuver datasets: (family dir, case id, grid id, kind, elements, m_s, Δv_RSW, D_s, h_s,
    description). Δv in contract order [ΔvR radial, ΔvS along-track, ΔvW cross-track]."""
    c = []
    # VT-12: frame transformation. Pure axes on C4 away from an apsis (ν = 1 rad, so R, S and the
    # velocity direction are all distinct), and a combined Δv on the other grid cases. t = 0, so
    # the pre-maneuver state is the request's initial state exactly.
    for kind, dv in (("radial", [80.0, 0.0, 0.0]), ("along-track", [0.0, 100.0, 0.0]),
                     ("cross-track", [0.0, 0.0, 200.0])):
        c.append(("vt-12", f"c4-{kind}-nu1", "c4-moderate-inclined", kind,
                  with_nu("c4-moderate-inclined", 1.0), 0.0, dv, 600.0, 60.0,
                  f"Moderately elliptical, inclined, ν₀ = 1 rad; pure {kind} Δv_RSW at t_s = 0"))
    for gid in ("c1-circular-inclined", "c3-elliptical-equatorial", "c5-molniya",
                "c7-near-polar-retrograde", "c8-angle-boundaries-b"):
        c.append(("vt-12", f"{gid}-combined", gid, "combined", dict(GRID_BY_ID[gid][3]), 0.0,
                  [30.0, -60.0, 45.0], 600.0, 60.0,
                  f"{GRID_BY_ID[gid][2]}; combined Δv_RSW at t_s = 0"))

    # VT-15: post-maneuver orbit (mirrors the L2 VT-15 set of ML-TASK-018 part C).
    t1 = period_s("c1-circular-inclined")
    t4 = period_s("c4-moderate-inclined")
    v15 = [
        ("c1-circular-prograde", "c1-circular-inclined", "apsis-tangential", 0.3, 0.0, [0.0, 100.0, 0.0]),
        ("c1-circular-prograde-after-1T", "c1-circular-inclined", "apsis-tangential", 0.3, t1, [0.0, 100.0, 0.0]),
        ("c1-normal", "c1-circular-inclined", "normal", 0.3, 0.0, [0.0, 0.0, 200.0]),
        ("c3-apogee-circularise", "c3-elliptical-equatorial", "apsis-tangential", PI, 0.0, [0.0, 904.4606822357873, 0.0]),
        ("c4-perigee-prograde", "c4-moderate-inclined", "apsis-tangential", 0.0, 0.0, [0.0, 100.0, 0.0]),
        ("c4-perigee-prograde-after-1T", "c4-moderate-inclined", "apsis-tangential", 0.0, t4, [0.0, 100.0, 0.0]),
        ("c4-perigee-retrograde", "c4-moderate-inclined", "apsis-tangential", 0.0, 0.0, [0.0, -100.0, 0.0]),
        ("c4-apogee-prograde", "c4-moderate-inclined", "apsis-tangential", PI, 0.0, [0.0, 100.0, 0.0]),
        ("c4-apogee-prograde-after-1T", "c4-moderate-inclined", "apsis-tangential", PI, t4, [0.0, 100.0, 0.0]),
        ("c4-perigee-normal", "c4-moderate-inclined", "normal", 0.0, 0.0, [0.0, 0.0, -150.0]),
        ("c4-radial", "c4-moderate-inclined", "radial", 1.0, 0.0, [80.0, 0.0, 0.0]),
        ("c4-combined", "c4-moderate-inclined", "combined", 1.0, 0.0, [30.0, -60.0, 45.0]),
        ("c5-perigee-prograde", "c5-molniya", "apsis-tangential", 0.0, 0.0, [0.0, 50.0, 0.0]),
        ("c5-apogee-raise-perigee", "c5-molniya", "apsis-tangential", PI, 0.0, [0.0, 200.0, 0.0]),
    ]
    for cid, gid, kind, nu, m, dv in v15:
        when = "t_s = 0" if m == 0 else "t_s = T (one period after the epoch)"
        c.append(("vt-15", cid, gid, kind, with_nu(gid, nu), m, dv, m + 600.0, 60.0,
                  f"{GRID_BY_ID[gid][2]}, ν₀ = {nu!r} rad; {kind} burn Δv_RSW = {dv} m/s at {when}"))

    # VT-16: post-maneuver escape (hyperbolic) and sub-surface periapsis (plan §5 last row).
    c.append(("vt-16", "c1-escape-prograde", "c1-circular-inclined", "escape",
              dict(GRID_BY_ID["c1-circular-inclined"][3]), 0.0, [0.0, 4000.0, 0.0], 20000.0, 1000.0,
              "C1 orbit, prograde +4000 m/s at t_s = 0: hyperbolic, departing from periapsis"))
    c.append(("vt-16", "c3-midrun-escape", "c3-elliptical-equatorial", "escape",
              dict(GRID_BY_ID["c3-elliptical-equatorial"][3]), 5000.0, [0.0, 5000.0, 0.0], 20000.0,
              1000.0, "C3 orbit, prograde +5000 m/s at t_s = 5000 s (grid point): hyperbolic"))
    c.append(("vt-16", "c4-midrun-retro-subsurface", "c4-moderate-inclined", "subsurface",
              dict(GRID_BY_ID["c4-moderate-inclined"][3]), 3000.5, [0.0, -1500.0, 0.0], 9000.0,
              250.0, "C4 orbit, retrograde −1500 m/s off-grid at t_s = 3000.5 s: bound, outbound "
              "at the burn, periapsis below the reference sphere; the span covers apoapsis, the "
              "descent and the crossing of the sphere"))
    return c
