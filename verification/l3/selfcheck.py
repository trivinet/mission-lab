"""Self-checks of the L3 Orekit datasets (ML-TASK-012 part B), run before the data are used.

Usage (repository root, pinned environment of verification/l3/README.md):

    python -B verification/l3/selfcheck.py [--data DIR] [--repro]

Checks (each bound is a formula of docs/verification/tolerances.md revision 3, cited per check;
no bound is invented here; where the record has none, the measured value is reported as
"info" and is not a pass):

1. VT-02 files: elements → state is recomputed (must equal the file bit-for-bit), then the Orekit
   round trip state → KeplerianOrbit → state is compared with the VT-03 bound M·B_rt·u·r_a,
   M·B_vt·u·v_p (§7 VT-03). Element differences of the round trip are reported (info).
2. VT-05 files and every elliptic segment of the maneuver files: energy and angular momentum on
   every sample against VT-06/VT-07 with the engine part doubled (assumption A6, §9.3), and for
   VT-05 the full-period closure after N = 1 and N = 10 periods against VT-08 with P_E, V_E
   doubled (A6 check of §9.3: "closure and energy of its own output").
3. Maneuver files: Orekit QSW axes vs the contract RSW definition evaluated in binary64 (VT-11
   bounds), Orekit Δv_I vs ΔvR·R + ΔvS·S + ΔvW·W (VT-12 bound), velocityAfter = velocityBefore
   + Δv_I bit-exact (R12), ‖Δv_I‖ vs ‖Δv_RSW‖ (VT-13 physics cross-check), Orekit a⁺, e⁺, i⁺ vs
   binary64 closed forms (VT-15 terms (ii)+(iii), e-vector 60u, VI-03(b) i row).
4. Hyperbolic segments (A6′ for Orekit's hyperbolic propagation; open item O-13, criterion of
   tolerances.md revision 5, §9.3.1 "A6′ hyperbolic criterion"): on every sample, the energy
   deviation, the angular-momentum deviation and the Kepler time-of-flight residual (hyperbolic
   Kepler equation in 40-digit decimal arithmetic) are checked pass/fail against 2× the §6.8 engine
   bounds mapped into each measured quantity, with the margin M and the test's own evaluation
   error: energy M[10uκ_E + 2τ_E,gen(Δt)], angular momentum M[6uκ_h + 2τ_h,gen(Δt)], time of flight
   M·2·B_tof(Δt). Arc-wide factors from the segment's first state (reference side, §6.8 N4). Arcs
   below the §7 VT-16 validity gate (E/(v²/2 + μ/r) < 0.05 at the start) are measured only (info;
   the record claims no bound there).
5. --repro: the generator files are unchanged since the commit recorded in the datasets, and a
   fresh run of generate.py with the recorded revision and date reproduces every file
   byte-for-byte.
6. --restart DIR (optional): the invariant checks of items 2 and 4 on Orekit arcs restarted from
   engine event states (tolerances.md §9.3.2; files with outputs.t_s, position_m, velocity_mps).

Exit status 0 only if every pass/fail check passes.

The generator files (generate.py, l3lib.py, cases.py) are not changed by the hyperbolic checks
(ML-TASK-018 part D3): the hyperbolic formulas live in this file only.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from decimal import Decimal, getcontext
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import generate  # noqa: E402
import l3lib  # noqa: E402
from l3lib import (  # noqa: E402
    M_MARGIN,
    MU_M3PS2,
    U,
    Ok,
    cross,
    dist,
    dot,
    energy,
    norm,
    scales_of_state,
    sub,
)

GENERATOR_FILES = ["verification/l3/generate.py", "verification/l3/l3lib.py", "verification/l3/cases.py"]


def decode(x):
    if isinstance(x, dict):
        if list(x.keys()) == ["$number"]:
            return {"-0": -0.0, "NaN": math.nan, "Infinity": math.inf, "-Infinity": -math.inf}[
                x["$number"]
            ]
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    if isinstance(x, int) and not isinstance(x, bool):
        return float(x)
    return x


def load(path):
    with open(path, encoding="utf-8") as f:
        return decode(json.load(f))


class Report:
    def __init__(self):
        self.rows = []
        self.failures = 0

    def check(self, case, name, measured, bound, source):
        ok = measured <= bound
        if not ok:
            self.failures += 1
        self.rows.append((case, name, measured, bound, measured / bound if bound else math.inf,
                          "PASS" if ok else "FAIL", source))

    def exact(self, case, name, ok, source):
        if not ok:
            self.failures += 1
        self.rows.append((case, name, 0.0 if ok else 1.0, 0.0, 0.0, "PASS" if ok else "FAIL", source))

    def info(self, case, name, measured, source):
        self.rows.append((case, name, measured, None, None, "info", source))

    def print(self):
        for case, name, meas, bound, ratio, status, src in self.rows:
            b = "-" if bound is None else f"{bound:.3e}"
            r = "-" if ratio is None else f"{ratio:.3g}"
            print(f"{status:4} {case:52} {name:34} {meas:.3e} {b:>10} {r:>7}  {src}")
        n = sum(1 for r in self.rows if r[5] != "info")
        print(f"\n{n} pass/fail checks, {self.failures} failures; "
              f"{len(self.rows) - n} informational measurements")


def same_bits(a, b):
    return all(
        x == y and math.copysign(1.0, x) == math.copysign(1.0, y) for x, y in zip(a, b)
    ) and len(a) == len(b)


def angle_diff(a, b):
    d = (a - b) % (2 * math.pi)
    return min(d, 2 * math.pi - d)


# --- 1. VT-02 -----------------------------------------------------------------------------------


def check_vt02(ok, rep, case, d):
    el = d["inputs"]["elements"]
    o = ok.elements_to_orbit(el)
    r1, v1 = ok.pv_of(o)
    rep.exact(case, "recompute = file (bit-exact)",
              same_bits(r1, d["outputs"]["position_m"]) and same_bits(v1, d["outputs"]["velocity_mps"]),
              "determinism of the stored value")
    ko = ok.keplerian_from_state(r1, v1)
    e1 = ok.elements_of(ko)
    # A KeplerianOrbit built from PV keeps that PV, so the state is rebuilt from the extracted
    # element values (new orbit object) to make the round trip real.
    r2, v2 = ok.pv_of(ok.elements_to_orbit(e1))
    sc = l3lib.Scales(el["semiMajorAxis_m"], el["eccentricity"])
    tr, tv = sc.vt03_tolerance()
    rep.check(case, "round trip ‖Δr‖ (m)", dist(r2, r1), tr, "VT-03 M·B_rt·u·r_a")
    rep.check(case, "round trip ‖Δv‖ (m/s)", dist(v2, v1), tv, "VT-03 M·B_vt·u·v_p")
    rep.info(case, "elements: |Δa|/a", abs(e1["semiMajorAxis_m"] - el["semiMajorAxis_m"]) / el["semiMajorAxis_m"], "no bound in record")
    rep.info(case, "elements: |Δe|", abs(e1["eccentricity"] - el["eccentricity"]), "no bound in record")
    rep.info(case, "elements: |Δi| (rad)", abs(e1["inclination_rad"] - el["inclination_rad"]), "no bound in record")
    lam1 = e1["raan_rad"] + e1["argPeriapsis_rad"] + e1["trueAnomaly_rad"]
    lam0 = el["raan_rad"] + el["argPeriapsis_rad"] + el["trueAnomaly_rad"]
    if el["inclination_rad"] < math.pi / 2:
        rep.info(case, "elements: |Δ(Ω+ω+ν)| (rad)", angle_diff(lam1, lam0), "no bound in record")
    if el["eccentricity"] > 1e-3 and 1e-3 < el["inclination_rad"] < math.pi - 1e-3:
        for k in ("raan_rad", "argPeriapsis_rad", "trueAnomaly_rad"):
            rep.info(case, f"elements: |Δ{k}| (rad)", angle_diff(e1[k], el[k]), "no bound in record")
    return r1, v1


def cross_l2_vt02(rep, case, gid, r1, v1, el):
    p = l3lib.REPO_ROOT / "test-data" / "reference-cases" / "vt-02" / f"{gid}.json"
    if not p.exists():
        return
    l2 = load(p)
    sc = l3lib.Scales(el["semiMajorAxis_m"], el["eccentricity"])
    tp, tv = sc.vt02_tolerance()
    rep.check(case, "L3 vs L2c ‖Δr‖ (m)", dist(r1, l2["outputs"]["position_m"]), tp,
              "VT-02 M·2η_r·u·r_a (cross-check)")
    rep.check(case, "L3 vs L2c ‖Δv‖ (m/s)", dist(v1, l2["outputs"]["velocity_mps"]), tv,
              "VT-02 M·2η_v·u·v_p (cross-check)")


# --- 2. invariants ------------------------------------------------------------------------------


def check_invariants(rep, case, label, t0, ts, rs, vs):
    r0, v0 = rs[0], vs[0]
    E0 = energy(r0, v0)
    h0 = cross(r0, v0)
    if E0 < 0:
        sc = scales_of_state(r0, v0)
        worst_e = worst_h = (0.0, 1.0)
        for t, r, v in zip(ts, rs, vs):
            de = abs(energy(r, v) - E0) / abs(E0)
            dh = dist(cross(r, v), h0) / norm(h0)
            be, bh = sc.selfcheck_energy(t - t0), sc.selfcheck_h(t - t0)
            if de / be > worst_e[0] / worst_e[1]:
                worst_e = (de, be)
            if dh / bh > worst_h[0] / worst_h[1]:
                worst_h = (dh, bh)
        rep.check(case, f"{label} energy (worst sample)", worst_e[0], worst_e[1],
                  "VT-06 with 2×engine part (A6)")
        rep.check(case, f"{label} ang. momentum (worst)", worst_h[0], worst_h[1],
                  "VT-07 with 2×engine part (A6)")
    else:
        check_hyperbolic(rep, case, label, t0, ts, rs, vs)


# --- 4. hyperbolic arcs: A6′ criterion (tolerances.md revision 5, §6.8, §9.3.1; O-13) -----------

VT16_VALIDITY_GATE = 0.05  # §7 VT-16, owner decision 2026-11-15 (E/(v²/2 + μ/r) at the start)


def _solve_hyperbolic_kepler(Mh, e):
    """e sinh F − F = Mh by Newton (binary64; tolerance evaluation only)."""
    F = math.asinh(Mh / e)
    for _ in range(100):
        step = (e * math.sinh(F) - F - Mh) / (e * math.cosh(F) - 1)
        F -= step
        if abs(step) <= 4e-16 * max(1.0, abs(F)):
            return F
    raise RuntimeError("hyperbolic Kepler: no convergence")


class HypArc:
    """§6.8 arc-wide factors of a hyperbolic arc from its first state (r0, v0) and the Δt of its
    last sample, evaluated in binary64 from the reference side (here: the Orekit segment's first
    state, which is the input of Orekit's propagation; §4.1 item 2, §6.8 review N4)."""

    def __init__(self, r0v, v0v, dt_end):
        mu = MU_M3PS2
        self.r0 = norm(r0v)
        v2 = dot(v0v, v0v)
        self.v0 = math.sqrt(v2)
        rv = dot(r0v, v0v)
        self.E = v2 / 2 - mu / self.r0
        if not self.E > 0:
            raise ValueError("HypArc: E ≤ 0")
        self.h = norm(cross(r0v, v0v))
        self.ratio = self.E / (v2 / 2 + mu / self.r0)
        self.a = mu / (2 * self.E)  # |a|
        self.e = math.sqrt(1 + 2 * self.E * self.h * self.h / (mu * mu))
        self.p = self.h * self.h / mu
        self.n = math.sqrt(mu / self.a**3)
        self.sinhF0 = rv / (math.sqrt(mu * self.a) * self.e)
        self.coshF0 = (1 + self.r0 / self.a) / self.e
        self.F0 = math.asinh(self.sinhF0)
        self.q0 = self.r0 * self.v0 / math.sqrt(mu * self.a)
        self.cosphi0 = self.h / (self.r0 * self.v0)
        x_end, r_end = self.at(dt_end)
        passed = self.F0 < 0 <= self.F0 + x_end
        self.r_min = self.a * (self.e - 1) if passed else min(self.r0, r_end)
        self.r_max = max(self.r0, r_end)
        self.v_max = math.sqrt(mu * (2 / self.r_min + 1 / self.a))
        self.g_max = mu / self.r_min**2
        self.kappa_E = 1 + 4 * self.a / self.r_min
        # max of r v / h on the arc: r v = √(μ(2r + r²/|a|)) increases with r
        self.kappa_h = self.r_max * math.sqrt(mu * (2 / self.r_max + 1 / self.a)) / self.h
        Kb = self.r0 * (1 + 2 * self.r_max / self.p) + self.r_max / self.cosphi0 + self.r_max
        Kbv = 2 * self.v_max + 2 * (1 + 2 * self.r0 / self.p) * self.v0
        self.P_b = U * (20 * Kb + 10 * self.kappa_E * self.r_max + 2 * self.a)
        self.V_b = U * (20 * Kbv + 5 * self.kappa_E * self.v_max + 2 * self.a * self.v0 / self.r_min)
        # TOF measurement conditioning: 1/(e cosh F + e sinh F) = e^(−F)/e ≤ e^(−F0)/e on the arc
        self.w = max(1.0, math.exp(-self.F0) / self.e)

    def at(self, dt):
        F = _solve_hyperbolic_kepler(self.e * self.sinhF0 - self.F0 + self.n * dt, self.e)
        return F - self.F0, self.a * (self.e * math.cosh(F) - 1)

    def terms(self, dt):
        """ε_t,gen, δt_g,gen, δt_ph of §6.8 at Δt (seconds)."""
        x, r = self.at(dt)
        ch, sh = math.cosh(x), math.sinh(x)
        cm1, smx = ch - 1, sh - x
        e, sF, ra = self.e, abs(self.sinhF0), self.r0 / self.a
        t1, t2, t3 = e * self.sinhF0 * cm1, e * self.coshF0 * smx, ra * x
        s_eval = (
            (3 * self.q0 + 2 * e * sF) * cm1
            + e * sF * (2.5 * x * sh + 2 * ch + 8 * cm1)
            + (4 * ra + e * self.coshF0) * smx
            + e * self.coshF0 * (2.5 * x * cm1 + 2 * sh + 11.5 * smx)
            + 4 * ra * x
            + 2 * (abs(t1) + abs(t2) + abs(t3))
            + 2 * self.n * dt
        )
        eps = U * (2 * s_eval + (r / self.a) * x) / self.n
        dtg = U * (2.5 * x * cm1 + 2 * sh + 12.5 * smx) / self.n
        dtph = U * (7.5 * self.kappa_E * dt + dt + 2.5 * x * self.r_max / (self.a * self.n))
        return eps, dtg, dtph

    def bounds(self, dt):
        """A6′ criterion (revision 5 §9.3.1): energy (relative), |Δh|/h, TOF residual (s)."""
        eps, dtg, dtph = self.terms(dt)
        off = eps + dtg  # off-orbit time-like error δt_off (§6.1 item 4, §6.8)
        tau_E = (
            self.v_max * self.V_b
            + self.g_max * self.P_b
            + (self.g_max * self.v_max + 2 * self.v_max**3 / self.r_min) * off
        ) / self.E
        tau_h = (
            self.P_b * self.v_max
            + self.r_max * self.V_b
            + (self.v_max**2 + 2 * self.v_max**2 * self.r_max / self.r_min) * off
        ) / self.h
        P_off = self.P_b + self.v_max * off
        V_off = self.V_b + (2 * self.v_max**2 / self.r_min) * off
        b_tof = dtph + eps + (self.w / self.n) * (
            (P_off * self.v_max + self.r_max * V_off) / math.sqrt(MU_M3PS2 * self.a) + P_off / self.a
        )
        return (
            M_MARGIN * (10 * U * self.kappa_E + 2 * tau_E),
            M_MARGIN * (6 * U * self.kappa_h + 2 * tau_h),
            M_MARGIN * 2 * b_tof,
        )


def check_hyperbolic(rep, case, label, t0, ts, rs, vs):
    r0, v0 = rs[0], vs[0]
    E0 = energy(r0, v0)
    h0 = cross(r0, v0)
    des = [abs(energy(r, v) - E0) / abs(E0) for r, v in zip(rs, vs)]
    dhs = [dist(cross(r, v), h0) / norm(h0) for r, v in zip(rs, vs)]
    tofs = hyperbolic_tof_residuals(t0, ts, rs, vs)
    arc = HypArc(r0, v0, ts[-1] - t0)
    if not arc.ratio >= VT16_VALIDITY_GATE:
        rep.info(case, f"{label} hyperbolic energy max dev", max(des), "below the §7 VT-16 gate")
        rep.info(case, f"{label} hyperbolic |Δh|/h max", max(dhs), "below the §7 VT-16 gate")
        rep.info(case, f"{label} hyperbolic Kepler TOF max |δt| (s)", max(tofs), "below the gate")
        return
    worst = {"E": (0.0, 1.0), "h": (0.0, 1.0), "t": (0.0, 1.0)}
    for t, de, dh, dtof in zip(ts, des, dhs, tofs):
        if t == t0:
            continue  # first sample = event state (R8), deviation 0 by construction
        be, bh, bt = arc.bounds(t - t0)
        for key, meas, bound in (("E", de, be), ("h", dh, bh), ("t", dtof, bt)):
            if meas / bound > worst[key][0] / worst[key][1]:
                worst[key] = (meas, bound)
    src = "A6′ hyperbolic, tolerances.md rev. 5 §9.3.1"
    rep.check(case, f"{label} hyp. energy (worst sample)", *worst["E"], f"{src}: M[10uκ_E + 2τ_E,gen]")
    rep.check(case, f"{label} hyp. ang. momentum (worst)", *worst["h"], f"{src}: M[6uκ_h + 2τ_h,gen]")
    rep.check(case, f"{label} hyp. Kepler TOF |δt| (s)", *worst["t"], f"{src}: M·2·B_tof")


def hyperbolic_tof_residuals(t0, ts, rs, vs):
    """Per sample |(t − t0) − √(−a³/μ)[(e sinh H − H) − (e sinh H0 − H0)]| with H from each state:
    e cosh H = 1 − r/a, e sinh H = r·v/√(−μa), H = ln((e cosh H + e sinh H)/e). Exact decimal
    images of the binary64 states, 40 significant digits."""
    getcontext().prec = 40
    mu = Decimal(MU_M3PS2)

    def D3(x):
        return [Decimal(c) for c in x]

    r0, v0 = D3(rs[0]), D3(vs[0])

    def dotD(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    rn0 = dotD(r0, r0).sqrt()
    a = 1 / (2 / rn0 - dotD(v0, v0) / mu)  # a < 0
    rv0 = dotD(r0, v0)
    ecv = 1 - rn0 / a
    esv = rv0 / (-mu * a).sqrt()
    e = (ecv * ecv - esv * esv).sqrt()

    def mean_anom(r, v):
        rn = dotD(r, r).sqrt()
        c = 1 - rn / a
        s = dotD(r, v) / (-mu * a).sqrt()
        H = ((c + s) / e).ln()
        return s - H

    m0 = mean_anom(r0, v0)
    k = (-(a**3) / mu).sqrt()
    out = []
    for t, r, v in zip(ts, rs, vs):
        dt = Decimal(t) - Decimal(t0)
        out.append(float(abs(dt - k * (mean_anom(D3(r), D3(v)) - m0))))
    return out


def check_closure(ok, rep, case, r0, v0):
    sc = scales_of_state(r0, v0)
    E = energy(r0, v0)
    a = -MU_M3PS2 / (2 * E)
    T = 2 * math.pi * math.sqrt(a**3 / MU_M3PS2)  # VT-08: T from the initial state (vis-viva)
    prop = ok.propagator(r0, v0, ok.date(0.0))
    for N in (1, 10):
        r, v = ok.pv_of(prop.propagate(ok.date(N * T)))
        br, bv = sc.selfcheck_closure(N)
        rep.check(case, f"closure N={N} ‖Δr‖ (m)", dist(r, r0), br, "VT-08 with 2×P_E (A6)")
        rep.check(case, f"closure N={N} ‖Δv‖ (m/s)", dist(v, v0), bv, "VT-08 with 2×V_E (A6)")


def check_vt05(ok, rep, case, d):
    req = d["inputs"]["requestBody"]
    r0 = req["initialState"]["position_m"]
    v0 = req["initialState"]["velocity_mps"]
    o = d["outputs"]
    rep.exact(case, "first sample = initial state",
              same_bits(o["position_m"][0], r0) and same_bits(o["velocity_mps"][0], v0),
              "contracts §5.2 rev. 3")
    check_invariants(rep, case, "coast", 0.0, o["t_s"], o["position_m"], o["velocity_mps"])
    check_closure(ok, rep, case, r0, v0)
    return r0, v0


def cross_l2_vt05(rep, case, gid, d):
    p = l3lib.REPO_ROOT / "test-data" / "reference-cases" / "vt-05" / f"{gid}.json"
    if not p.exists():
        return
    l2 = load(p)
    o = d["outputs"]
    if l2["outputs"]["t_s"] != o["t_s"]:
        rep.info(case, "L3 vs L2a: sample times differ", 1.0, "cross-check skipped")
        return
    l2a = l2["outputs"]["l2a"]
    dr = max(dist(a, b) for a, b in zip(o["position_m"], l2a["position_m"]))
    dv = max(dist(a, b) for a, b in zip(o["velocity_mps"], l2a["velocity_mps"]))
    tol = d["tolerance"]
    rep.info(case, "L3 vs L2a max ‖Δr‖ (m)", dr, f"initial states differ (L2c vs Orekit); "
             f"§9.3 tol at end {tol['position_m'][-1]:.2e} m")
    rep.info(case, "L3 vs L2a max ‖Δv‖ (m/s)", dv, f"§9.3 tol at end {tol['velocity_mps'][-1]:.2e}")


# --- 3. maneuvers -------------------------------------------------------------------------------


def unit(x):
    n = norm(x)
    return [c / n for c in x]


def check_maneuver(ok, rep, case, d):
    ev = d["outputs"]["event"]
    r, vm, dvi, vp = ev["position_m"], ev["velocityBefore_mps"], ev["deltaV_inertial_mps"], ev["velocityAfter_mps"]
    dv = d["inputs"]["requestBody"]["maneuvers"][0]["deltaV_mps"]
    axes = d["outputs"]["rswAxes"]
    Rq, Sq, Wq = axes["R"], axes["S"], axes["W"]
    # contract definitions, binary64 (contracts-v1.md §2): R = r/‖r‖, W = (r×v)/‖r×v‖, S = W×R
    R = unit(r)
    W = unit(cross(r, vm))
    S = cross(W, R)
    kh = norm(r) * norm(vm) / norm(cross(r, vm))  # VT-11: r v / h ≤ κ_h
    rep.check(case, "Orekit Q vs R = r/‖r‖", dist(Rq, R), 32 * U, "VT-11 R ∥ r: M·2ε_R = 32u")
    rep.check(case, "Orekit W vs (r×v)/‖r×v‖", dist(Wq, W), 4 * (12 * kh + 8) * U,
              "VT-11 W: 4(12κ_h + 8)u")
    rep.check(case, "Orekit S vs W×R", dist(Sq, S), 4 * (12 * kh + 25) * U,
              "VT-11 orthonormality/handedness bound")
    B = [Rq, Sq, Wq]
    orth = max(abs(dot(B[i], B[j]) - (1.0 if i == j else 0.0)) for i in range(3) for j in range(3))
    rep.check(case, "Orekit axes |BᵀB − I|max", orth, 4 * (12 * kh + 25) * U, "VT-11 4(12κ_h + 25)u")
    rep.check(case, "Orekit ‖R×S − W‖", dist(cross(Rq, Sq), Wq), 4 * (12 * kh + 25) * U,
              "VT-11 4(12κ_h + 25)u")
    ref = [dv[0] * R[k] + dv[1] * S[k] + dv[2] * W[k] for k in range(3)]
    dvn = norm(dv)
    if dvn > 0:
        rep.check(case, "Δv_I Orekit vs contract (rel)", dist(dvi, ref) / dvn,
                  8 * (12 * kh + 25) * U, "VT-12 8(12κ_h + 25)u")
        rep.check(case, "‖Δv_I‖ vs ‖Δv_RSW‖ (rel)", abs(ev["deltaV_magnitude_mps"] - dvn) / dvn,
                  4 * (12 * kh + 31) * U, "VT-13 4(12κ_h + 31)u")
    rep.exact(case, "v⁺ = fl(v⁻ + Δv_I) (R12)",
              same_bits(vp, [vm[k] + dvi[k] for k in range(3)]), "contracts R12, exact")
    # elements after (VT-15 terms (ii)+(iii); e-vector 60u; VI-03(b) i row)
    rn = norm(r)
    v2 = dot(vp, vp)
    Ep = v2 / 2 - MU_M3PS2 / rn
    a_cf = 1 / (2 / rn - v2 / MU_M3PS2)
    ev_cf = [((v2 - MU_M3PS2 / rn) * r[k] - dot(r, vp) * vp[k]) / MU_M3PS2 for k in range(3)]
    e_cf = norm(ev_cf)
    h = cross(r, vp)
    i_cf = math.atan2(math.hypot(h[0], h[1]), h[2])
    el = d["outputs"]["elementsAfter"]
    scale = v2 / 2 + MU_M3PS2 / rn
    if abs(Ep) >= 0.1 * scale:
        b_a = M_MARGIN * (U * v2 + 10 * U * scale) / abs(Ep)
        rep.check(case, "a⁺ Orekit vs vis-viva (rel)", abs(el["semiMajorAxis_m"] - a_cf) / abs(a_cf),
                  b_a, "VT-15 M[u v⁺² + 10u(v⁺²/2 + μ/r)]/|E⁺|")
    rep.check(case, "e⁺ Orekit vs e-vector", abs(el["eccentricity"] - e_cf), M_MARGIN * 60 * U,
              "VT-15/VI-03(b) e: M·60u")
    kh_p = rn * math.sqrt(v2) / norm(h)
    rep.check(case, "i⁺ Orekit vs atan2 (rad)", abs(el["inclination_rad"] - i_cf),
              M_MARGIN * 2 * (4.3 * kh_p + 9.2) * U, "VI-03(b) i: M·2(4.3κ_h + 9.2)u")
    segs = d["outputs"]["segments"]
    for k, sg in enumerate(segs):
        if len(sg["t_s"]) > 1:
            check_invariants(rep, case, f"seg{k}", sg["t_s"][0], sg["t_s"], sg["position_m"],
                             sg["velocity_mps"])
    rep.exact(case, "seg1 first sample = event state",
              same_bits(segs[1]["position_m"][0], r) and same_bits(segs[1]["velocity_mps"][0], vp),
              "contracts §5.2 rev. 3, R8")
    rep.exact(case, "seg0 last sample = event (before)",
              same_bits(segs[0]["position_m"][-1], r) and same_bits(segs[0]["velocity_mps"][-1], vm),
              "contracts R8")


# --- 5. reproducibility -------------------------------------------------------------------------


def check_repro(rep, data_dir, files):
    revs = {(load(p)["producedBy"]["codeRevision"], load(p)["producedBy"]["date"]) for p in files}
    if len(revs) != 1:
        rep.exact("repro", "single codeRevision/date", False, str(revs))
        return
    rev, date = revs.pop()
    changed = subprocess.run(["git", "diff", "--quiet", rev, "--"] + GENERATOR_FILES,
                             cwd=l3lib.REPO_ROOT).returncode
    rep.exact("repro", f"generator unchanged since {rev[:12]}", changed == 0,
              "git diff --quiet <rev> -- generator files")
    with tempfile.TemporaryDirectory() as tmp:
        generate.main(["--code-revision", rev, "--date", date, "--out", tmp])
        new = sorted(p.relative_to(tmp).as_posix() for p in Path(tmp).rglob("*.json"))
        old = sorted(p.relative_to(data_dir).as_posix() for p in files)
        rep.exact("repro", f"same file set ({len(old)} files)", new == old, "")
        diff = [f for f in old if (Path(tmp) / f).read_bytes() != (data_dir / f).read_bytes()]
        rep.exact("repro", "byte-identical regeneration", not diff and new == old,
                  ", ".join(diff[:5]))


def main(argv=None):
    l3lib.ensure_utf8_stdout()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", default=str(l3lib.REPO_ROOT / l3lib.DATA_SUBDIR))
    ap.add_argument("--repro", action="store_true")
    ap.add_argument("--restart", default=None,
                    help="also check the Orekit arcs restarted from engine event states in DIR")
    args = ap.parse_args(argv)
    data_dir = Path(args.data)
    files = sorted(data_dir.rglob("*.json"))
    if not files:
        raise SystemExit(f"no datasets under {data_dir}")
    ok = Ok()
    rep = Report()
    for p in files:
        d = load(p)
        fam = p.parent.name
        case = d["id"].removeprefix("l3-orekit/")
        gid = p.stem.removeprefix("l3-orekit-")
        if fam == "vt-02":
            r1, v1 = check_vt02(ok, rep, case, d)
            cross_l2_vt02(rep, case, gid, r1, v1, d["inputs"]["elements"])
        elif fam == "vt-05":
            check_vt05(ok, rep, case, d)
            cross_l2_vt05(rep, case, gid, d)
        else:
            check_maneuver(ok, rep, case, d)
    if args.restart:
        for p in sorted(Path(args.restart).glob("*.json")):
            d = load(p)
            out = d.get("outputs", {})
            if not {"t_s", "position_m", "velocity_mps"} <= set(out) or len(out["t_s"]) < 2:
                continue
            check_invariants(rep, d.get("id", p.stem), "restarted", out["t_s"][0], out["t_s"],
                             out["position_m"], out["velocity_mps"])
    if args.repro:
        check_repro(rep, data_dir, files)
    rep.print()
    sys.exit(1 if rep.failures else 0)


if __name__ == "__main__":
    main()
