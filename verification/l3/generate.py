"""Generates the L3 Orekit reference datasets (ML-TASK-012 part B).

Usage (from the repository root, with the pinned environment of verification/l3/README.md):

    python -B verification/l3/generate.py --code-revision <commit> --date YYYY-MM-DD [--out DIR]

<commit> is the commit that contains this script unchanged (the script is committed before the
datasets are generated; selfcheck.py --repro verifies that the generator has not changed since).
--out defaults to the repository's dataset directory (l3lib.DATA_SUBDIR). The files are written
with shortest round-trip numbers and then formatted by the repository's Prettier.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cases  # noqa: E402
import l3lib  # noqa: E402
from l3lib import (  # noqa: E402
    CONSTANTS_SOURCE,
    EPOCH_ISO,
    MU_M3PS2,
    REFERENCE_RADIUS_M,
    Ok,
    dot,
    energy,
    norm,
    scales_of_state,
    zero_to_plus,
)

SCRIPT = "verification/l3/generate.py"
STATUS = (
    "Committed before any engine run on it (tolerances.md §4.1 item 1). Not yet reviewed or "
    "approved; immutable once approved, corrections create a new version (plan §6)."
)
NUMBER_FORMAT = (
    "Every number is the shortest decimal that round-trips to the binary64 value, in the "
    "ECMA-262 Number::toString form; JSON.parse restores the exact binary64. −0 is written as "
    '{"$number": "-0"} (test-data/reference-cases/README.md encoding); request inputs are '
    "normalised to +0 (contracts-v1.md §11.4 P3)."
)
FRAME_TIME = (
    "Orekit frame FramesFactory.getGCRF() (root of Orekit's frame tree; no transformation "
    "applied). Epoch 2026-01-01T00:00:00.000Z represented in Orekit as 2026-01-01T00:00:00 TAI "
    "(UTC needs the leap-second table of orekit-data, not installed; two-body motion depends only "
    "on elapsed time, so the label of the origin changes no number); sample date = "
    "epoch.shiftedBy(t_s) with the binary64 t_s (tolerances.md §9.3)."
)


def model():
    return {
        "dynamics": "TWO_BODY: point-mass two-body, Earth-centred (ML-SYS-001 §5.1)",
        "centralBody": "EARTH",
        "frame": "GCRF (all vectors and angles)",
        "mu_m3ps2": MU_M3PS2,
        "referenceRadius_m": REFERENCE_RADIUS_M,
        "constantsSource": CONSTANTS_SOURCE,
        "units": "SI: m, m/s, s, rad, m³/s²",
        "time": "t_s: elapsed SI seconds from the epoch (contracts-v1.md §2)",
    }


def constants():
    return {
        "mu_m3ps2": MU_M3PS2,
        "referenceRadius_m": REFERENCE_RADIUS_M,
        "source": CONSTANTS_SOURCE,
    }


def produced_by(env, rev, date, orekit_api):
    return {
        "tool": f"Orekit ({env['orekitJar']}, {env['hipparchusJar']}) through orekit_jpype "
        f"{env['orekitJpype']}, JPype1 {env['jpype1']}",
        "script": SCRIPT,
        "codeRevision": rev,
        "date": date,
        "runtime": f"Python {env['python']}; JDK {env['jdk']}; {env['os']}",
        "environment": "verification/l3/README.md, verification/l3/requirements.txt",
        "orekitApi": orekit_api,
        "frameAndTime": FRAME_TIME,
        "layer": "L3 (external tool, organisational independence; m1-verification-plan.md §2)",
        "independence": "Generated from Orekit and the contracts only. packages/astrodynamics, "
        "packages/simulation, conformance/ and the L2 reference code were not read or run.",
        "numberFormat": NUMBER_FORMAT,
    }


def request_body(r0, v0, maneuvers, duration, step):
    return {
        "schemaVersion": "1.0",
        "centralBody": "EARTH",
        "constants": constants(),
        "dynamicsModel": "TWO_BODY",
        "frame": "GCRF",
        "epoch": {"scale": "UTC", "iso": EPOCH_ISO},
        "initialState": {"position_m": r0, "velocity_mps": v0},
        "maneuvers": maneuvers,
        "duration_s": duration,
        "outputStep_s": step,
    }


REQUEST_NOTE = (
    "inputs.requestBody is a SimulationRequest without requestId (contracts-v1.md §4); the "
    "consumer adds requestId = \"sha256:\" + hex(SHA-256(canonicalRequestPayload(body))) (§7) with "
    "@mission-lab/contracts. Its initialState is the Orekit element→state of inputs.elements with "
    "−0 normalised to +0, and is exactly the state given to Orekit (assumption A4)."
)


def sample_times(duration, step, m=None):
    """contracts-v1.md §5.2: t_j = fl(j·h) while t_j < D, plus D, plus the maneuver time."""
    ts = []
    j = 0
    while True:
        t = float(j) * step
        if not t < duration:
            break
        ts.append(t)
        j += 1
    ts.append(duration)
    if m is not None and m not in ts:
        ts.append(m)
    return sorted(ts)


def propagate(ok, r0, v0, t0, times):
    """States at the given times from the segment initial state (r0, v0) at t0. The sample at t0
    is the initial state itself (contracts-v1.md §5.2 revision 3: copied, not propagated)."""
    prop = ok.propagator(r0, v0, ok.date(t0))
    rs, vs = [], []
    for t in times:
        if t == t0:
            rs.append(list(r0))
            vs.append(list(v0))
        else:
            r, v = ok.pv_of(prop.propagate(ok.date(t)))
            rs.append(r)
            vs.append(v)
    return rs, vs


def elliptic_tolerances(r0, v0, t0, times):
    """tolerances.md §9.3 L3-Orekit tolerance 3M·P_E(Δt), 3M·V_E(Δt) per sample, scales from the
    reference state (§4.1 item 2)."""
    sc = scales_of_state(r0, v0)
    pos, vel = [], []
    for t in times:
        p, v = sc.l3_tolerance(t - t0)
        pos.append(p)
        vel.append(v)
    return sc, pos, vel


def scales_record(sc):
    return {
        "a_m": sc.a,
        "e": sc.e,
        "r_a_m": sc.r_a,
        "v_p_mps": sc.v_p,
        "g_p_mps2": sc.g_p,
        "n_radps": sc.n,
        "T_s": sc.T,
        "kappa_E": sc.kappa_E,
        "kappa_h": sc.kappa_h,
        "u": l3lib.U,
        "M": l3lib.M_MARGIN,
    }


def vt02(ok, env, rev, date, gid, row, desc, elements):
    orbit = ok.elements_to_orbit(elements)
    r, v = ok.pv_of(orbit)
    sc = l3lib.Scales(elements["semiMajorAxis_m"], elements["eccentricity"])
    tp, tv = sc.vt02_tolerance()
    return {
        "id": f"l3-orekit/vt-02/{gid}",
        "version": 1,
        "family": "VT-02 Elements → Cartesian (ML-FR-003 AC1)",
        "description": desc,
        "gridCase": row,
        "status": STATUS,
        "inputs": {"constants": constants(), "elements": elements},
        "model": model(),
        "producedBy": produced_by(
            env,
            rev,
            date,
            "new KeplerianOrbit(a, e, i, ω, Ω, ν, PositionAngleType.TRUE, GCRF, epoch, μ)"
            ".getPVCoordinates()",
        ),
        "method": {
            "reference": "L3 Orekit",
            "elementToState": "Orekit KeplerianOrbit with the true anomaly. Orekit's argument "
            "order is (a, e, i, perigee argument ω, RAAN Ω, anomaly); the contract fields are "
            "mapped by name. Angles are given unchanged (no re-normalisation, contracts-v1.md §3).",
        },
        "outputs": {"position_m": r, "velocity_mps": v},
        "tolerance": {
            "record": "docs/verification/tolerances.md revision 3 §7 VT-02",
            "formula": "‖Δr‖ ≤ M·2η_r(e)·u·r_a, ‖Δv‖ ≤ M·2η_v(e)·u·v_p",
            "status": "The record writes this formula for engine vs L2c (both sides with the "
            "same element→state budget). The record has no row for Orekit element→state; using "
            "it for L3 assumes Orekit's map obeys the same budget (A6-like, not stated for "
            "VT-02). To be confirmed by the reviewer before an engine run (ML-TASK-012 report).",
            "evaluatedAt": {**scales_record(sc), "eta_r": sc.eta_r(), "eta_v": sc.eta_v()},
            "position_m": tp,
            "velocity_mps": tv,
        },
    }


def vt05(ok, env, rev, date, gid, row, desc, elements, duration, step):
    r0, v0 = ok.pv_of(ok.elements_to_orbit(elements))
    r0 = [zero_to_plus(x) for x in r0]
    v0 = [zero_to_plus(x) for x in v0]
    ts = sample_times(duration, step)
    rs, vs = propagate(ok, r0, v0, 0.0, ts)
    sc, tp, tv = elliptic_tolerances(r0, v0, 0.0, ts)
    nper = duration / sc.T
    return {
        "id": f"l3-orekit/vt-05/{gid}",
        "version": 1,
        "family": "VT-05 Circular and elliptical propagation (ML-FR-004 AC1)",
        "description": f"{desc}. Coast of {len(ts) - 1} output steps of {l3lib.js_number(step)} s "
        f"(≈ {nper:.3f} periods), fractional and multi-period times.",
        "gridCase": row,
        "status": STATUS,
        "inputs": {
            "requestBody": request_body(r0, v0, [], duration, step),
            "requestNote": REQUEST_NOTE,
            "elements": elements,
            "initialStateFrom": f"l3-orekit/vt-02/{gid} outputs (Orekit element→state)",
        },
        "model": model(),
        "producedBy": produced_by(
            env,
            rev,
            date,
            "KeplerianPropagator(CartesianOrbit(PV(r0, v0), GCRF, epoch, μ), "
            "FrameAlignedProvider(GCRF), μ).propagate(epoch.shiftedBy(t_s))",
        ),
        "method": {
            "reference": "L3 Orekit",
            "propagator": "org.orekit.propagation.analytical.KeplerianPropagator, initial orbit "
            "type CartesianOrbit (the exact binary64 request state), μ passed explicitly. Every "
            "sample is propagated from the initial state at its own date (no chaining).",
            "firstSample": "t_s = 0 is the initial state itself (contracts-v1.md §5.2 revision 3).",
            "sampling": "contracts-v1.md §5.2 grid: t_j = fl(j·h) while t_j < D, plus D.",
        },
        "outputs": {"t_s": ts, "position_m": rs, "velocity_mps": vs},
        "tolerance": {
            "record": "docs/verification/tolerances.md revision 3 §9.3 (L3 Orekit), §7 VT-05",
            "formula": "‖Δr‖ ≤ 3M·P_E(Δt), ‖Δv‖ ≤ 3M·V_E(Δt) (§6.3 with assumption A6)",
            "status": "Valid only while assumption A6 holds for this case: see the self-check "
            "(verification/l3/selfcheck.py) results in the ML-TASK-012 part B report.",
            "evaluatedAt": scales_record(sc),
            "position_m": tp,
            "velocity_mps": tv,
        },
    }


def time_to_radius(ok, ko, n, radius, is_hyperbolic):
    """Time from the state of KeplerianOrbit ko until the radius first equals `radius` on the
    inbound branch (before periapsis), or None if that radius is not on the conic or the inbound
    crossing is already past. Uses Orekit's own anomaly conversions."""
    a, e = float(ko.getA()), float(ko.getE())
    p = a * (1 - e * e)
    c = (p / radius - 1) / e
    if not -1.0 <= c <= 1.0:
        return None
    nu_c = -math.acos(c)  # inbound crossing (−π < ν < 0)
    m_now = float(ko.getMeanAnomaly())
    kc = ok.KeplerianOrbit(
        a,
        e,
        float(ko.getI()),
        float(ko.getPerigeeArgument()),
        float(ko.getRightAscensionOfAscendingNode()),
        nu_c,
        ok.PositionAngleType.TRUE,
        ok.gcrf,
        ko.getDate(),
        MU_M3PS2,
    )
    m_c = float(kc.getMeanAnomaly())
    if is_hyperbolic:
        dm = m_c - m_now
        return dm / n if dm >= 0 else None
    return ((m_c - m_now) % (2 * math.pi)) / n


def time_to_periapsis(ko, n, is_hyperbolic):
    m_now = float(ko.getMeanAnomaly())
    if is_hyperbolic:
        return -m_now / n if m_now <= 0 else None
    return ((-m_now) % (2 * math.pi)) / n


def maneuver(ok, env, rev, date, spec):
    fam, cid, gid, kind, elements, m, dv, duration, step, desc = spec
    r0, v0 = ok.pv_of(ok.elements_to_orbit(elements))
    r0 = [zero_to_plus(x) for x in r0]
    v0 = [zero_to_plus(x) for x in v0]
    ts = sample_times(duration, step, m)
    t_seg0 = [t for t in ts if t <= m]
    t_seg1 = [t for t in ts if t >= m]
    rs0, vs0 = propagate(ok, r0, v0, 0.0, t_seg0)
    r_m, v_minus = rs0[-1], vs0[-1]

    q, s, w = ok.qsw_axes(r_m, v_minus)
    dv_i = ok.rsw_to_inertial(r_m, v_minus, dv)
    v_plus = [v_minus[k] + dv_i[k] for k in range(3)]  # one binary64 addition (R12)
    dv_mag = norm(dv_i)
    rs1, vs1 = propagate(ok, r_m, v_plus, m, t_seg1)

    ko_before = ok.keplerian_from_state(r_m, v_minus, ok.date(m))
    ko_after = ok.keplerian_from_state(r_m, v_plus, ok.date(m))
    el_before = ok.elements_of(ko_before)
    el_after = ok.elements_of(ko_after)
    e_after = energy(r_m, v_plus)
    hyper = e_after > 0
    a_after = el_after["semiMajorAxis_m"]
    n_after = math.sqrt(MU_M3PS2 / abs(a_after) ** 3)
    rp_after = a_after * (1 - el_after["eccentricity"])

    sc0, tp0, tv0 = elliptic_tolerances(r0, v0, 0.0, t_seg0)
    seg1_tol = None
    if not hyper:
        sc1, tp1, tv1 = elliptic_tolerances(r_m, v_plus, m, t_seg1)
        seg1_tol = {"evaluatedAt": scales_record(sc1), "position_m": tp1, "velocity_mps": tv1}

    span = duration - m
    t_sphere = time_to_radius(ok, ko_after, n_after, REFERENCE_RADIUS_M, hyper)
    t_peri = time_to_periapsis(ko_after, n_after, hyper)
    radial_rate = dot(r_m, v_plus) / norm(r_m)
    expected = {
        "ESCAPE_TRAJECTORY": hyper,
        "REFERENCE_SPHERE_INTERSECTION": rp_after <= REFERENCE_RADIUS_M
        and t_sphere is not None
        and t_sphere <= span,
        "basis": "contracts-v1.md §8.3 and §11.3 D1–D6 applied to the Orekit post-maneuver orbit: "
        "escape ⇔ specific energy > 0 (cases chosen far from 0); intersection ⇔ the radius "
        "reaches referenceRadius_m within [m, D] (inbound crossing time from Orekit's anomaly "
        "conversion). Discrete expectations; not a tolerance.",
    }
    post = {
        "specificEnergy_Jpkg": e_after,
        "energyScale_Jpkg": dot(v_plus, v_plus) / 2 + MU_M3PS2 / norm(r_m),
        "semiMajorAxis_m": a_after,
        "eccentricity": el_after["eccentricity"],
        "periapsisRadius_m": rp_after,
        "radialVelocity_mps": radial_rate,
        "timeToPeriapsis_s": t_peri,
        "timeToReferenceSphere_s": t_sphere,
        "minSampledRadius_m": min(norm(r) for r in rs1),
    }

    data = {
        "id": f"l3-orekit/{fam}/{cid}",
        "version": 1,
        "family": {
            "vt-12": "VT-12 Maneuver frame transformation (ML-FR-006 AC2); also VT-11, VT-13, VT-15",
            "vt-15": "VT-15 Post-maneuver orbit (ML-FR-006 AC5, ML-FR-010 AC3); also VT-12, VT-13",
            "vt-16": "VT-16 Escape / surface intersection (ML-FR-006 AC6); also VT-12, VT-15",
        }[fam],
        "description": desc,
        "gridCase": cases.GRID_BY_ID[gid][1],
        "kind": kind,
        "status": STATUS,
        "inputs": {
            "requestBody": request_body(
                r0, v0, [{"id": "m1", "t_s": m, "frame": "RSW", "deltaV_mps": dv}], duration, step
            ),
            "requestNote": REQUEST_NOTE,
            "elements": elements,
            "maneuverTime_s": m,
        },
        "model": model(),
        "producedBy": produced_by(
            env,
            rev,
            date,
            "KeplerianPropagator(CartesianOrbit) per segment; LOFType.QSW.rotationFromInertial(PV)"
            ".applyInverseTo(Δv_RSW) for the inertial Δv; new KeplerianOrbit(PV, GCRF, date, μ) "
            "for the elements",
        ),
        "method": {
            "reference": "L3 Orekit",
            "rswMapping": "Contract RSW (R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R, pre-maneuver "
            "state; contracts-v1.md §2, §3.1) = Orekit LOFType.QSW with Q ↔ R, S ↔ S, W ↔ W, "
            "Δv_RSW = [ΔvR, ΔvS, ΔvW] given to Orekit as the local vector (x, y, z) unchanged. "
            "The mapping is checked numerically by selfcheck.py (axes vs the contract definitions "
            "in binary64, VT-11 bounds). Only the rotation is used (no frame-rate term).",
            "impulse": "Position unchanged; velocityAfter[k] = velocityBefore[k] + "
            "deltaV_inertial[k], one binary64 addition per component (contracts-v1.md R12); "
            "deltaV_magnitude = √(Σ Δv_I,k²) in binary64.",
            "segments": "Segment 0 from the request initial state, segment 1 from the event state "
            "(position_m, velocityAfter_mps); first sample of each segment copied from its "
            "initial state (contracts-v1.md §5.2 revision 3); sample times per §5.2.",
            "elements": "Orekit KeplerianOrbit from the event state, angles exactly as Orekit "
            "returns them (Orekit's ranges, no normalisation, no ADR-008 convention: for "
            "near-circular or near-equatorial states the angles Orekit returns for ω, Ω, ν are "
            "not comparable with the engine's convention; compare a, e, i, and the state).",
        },
        "outputs": {
            "event": {
                "t_s": m,
                "position_m": r_m,
                "velocityBefore_mps": v_minus,
                "deltaV_inertial_mps": dv_i,
                "velocityAfter_mps": v_plus,
                "deltaV_magnitude_mps": dv_mag,
            },
            "rswAxes": {"R": q, "S": s, "W": w},
            "elementsBefore": el_before,
            "elementsAfter": el_after,
            "postManeuver": post,
            "expectedWarnings": expected if fam == "vt-16" else None,
            "segments": [
                {"t_s": t_seg0, "position_m": rs0, "velocity_mps": vs0},
                {"t_s": t_seg1, "position_m": rs1, "velocity_mps": vs1},
            ],
        },
        "tolerance": {
            "record": "docs/verification/tolerances.md revision 3: §7 VT-11/VT-12 (frame), VT-13, "
            "VT-15 (a⁺, e⁺), §9.3 (states)",
            "frame": "VT-12: ‖ΔΔv_I‖ ≤ 8(12κ_h + 25)u·‖Δv_RSW‖ (κ_h of the pre-maneuver orbit). "
            "Valid against these Δv_I only when the engine's event state equals this one "
            "bit-for-bit (maneuver at t_s = 0); for m > 0 the event states differ by propagation "
            "error and the comparison must restart from the engine's event state.",
            "segment0": {
                "formula": "3M·P_E(t), 3M·V_E(t) (§9.3)",
                "evaluatedAt": scales_record(sc0),
                "position_m": tp0,
                "velocity_mps": tv0,
            },
            "segment1": seg1_tol,
            "segment1Note": "Segment 1 starts from the Orekit event state. An engine comparison "
            "must either restart the reference from the engine's event state (rerun "
            "generate.propagate) or add the VT-14 transport term; for a hyperbolic segment no "
            "tolerance is evaluated (tolerances.md §7 VT-16: generalised budget per dataset, not "
            "derived here; open item O-5).",
        },
    }
    if data["outputs"]["expectedWarnings"] is None:
        del data["outputs"]["expectedWarnings"]
    return data


def build_all(rev, date):
    ok = Ok()
    env = l3lib.environment()
    out = []
    for gid, row, desc, elements, duration, step in cases.GRID:
        out.append((f"vt-02/l3-orekit-{gid}.json", vt02(ok, env, rev, date, gid, row, desc, elements)))
        out.append(
            (
                f"vt-05/l3-orekit-{gid}.json",
                vt05(ok, env, rev, date, gid, row, desc, elements, duration, step),
            )
        )
    for spec in cases.maneuver_cases():
        out.append((f"{spec[0]}/l3-orekit-{spec[1]}.json", maneuver(ok, env, rev, date, spec)))
    return out


def main(argv=None):
    l3lib.ensure_utf8_stdout()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--code-revision", required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--out", default=str(l3lib.REPO_ROOT / l3lib.DATA_SUBDIR))
    args = ap.parse_args(argv)
    out_dir = Path(args.out)
    count = 0
    for rel, data in build_all(args.code_revision, args.date):
        content = l3lib.render_json(data, (l3lib.DATA_SUBDIR / rel).as_posix())
        l3lib.write_bytes(out_dir / rel, content)
        count += 1
    print(f"wrote {count} datasets to {out_dir}")


if __name__ == "__main__":
    main()
