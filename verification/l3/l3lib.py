"""Shared helpers for the L3 Orekit reference datasets (ML-TASK-012 part B).

Independence (ADR-003): this code uses Orekit (through orekit_jpype) and the Python standard
library only. It does not import or read packages/astrodynamics, packages/simulation,
conformance/ or the L2 reference code in verification/src.

Conventions fixed here (see verification/l3/README.md for the reasoning):
- Frame: Orekit FramesFactory.getGCRF(), the root frame of Orekit's frame tree. No frame
  transformation is ever applied; every vector is defined and read in GCRF (tolerances.md §9.3).
- Time: the request epoch "2026-01-01T00:00:00.000Z" (UTC) is represented by the Orekit date
  2026-01-01T00:00:00 in TAI. Orekit's UTC scale needs the leap-second table of orekit-data, which
  is not installed. Two-body dynamics depends only on elapsed time, so the label of the origin
  has no effect on any number in the datasets; every sample date is epoch.shiftedBy(t_s).
- mu is passed explicitly to every Orekit orbit and propagator (never Orekit's Constants).
"""

from __future__ import annotations

import json
import math
import os
import platform
import subprocess
import sys
from decimal import Decimal
from importlib import metadata
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Interim dataset location, see README.md "Dataset location" (conflict reported in the ML-TASK-012
# part B report): test-data/reference-cases/ is enumerated by tests that this task may not change.
DATA_SUBDIR = Path("test-data") / "l3-orekit"

# --- Constants (contracts-v1.md §4: the request carries constants; values as written in
# docs/architecture/proposed-architecture.md §3, ML-ARCH-002, WGS 84; VT-19 primary-source status
# in docs/verification/l2-references-report.md). Passed explicitly to Orekit.
MU_M3PS2 = 3.986004418e14
REFERENCE_RADIUS_M = 6378137.0
CONSTANTS_SOURCE = (
    "WGS 84 values as written in docs/architecture/proposed-architecture.md §3 (ML-ARCH-002); "
    "passed explicitly to every Orekit orbit and propagator, Orekit's own constants not used"
)

EPOCH_ISO = "2026-01-01T00:00:00.000Z"

U = 2.0**-53  # binary64 unit round-off (tolerances.md §2)
M_MARGIN = 4.0  # tolerances.md §3

_vm_started = False


def start_vm():
    """Starts the JVM through orekit_jpype. No orekit-data is loaded (none is needed: GCRF and TAI
    are defined without data files)."""
    global _vm_started
    if not _vm_started:
        import orekit_jpype

        orekit_jpype.initVM()
        _vm_started = True


class Ok:
    """Lazy handle on the Orekit classes used here (imported after the JVM starts)."""

    def __init__(self):
        start_vm()
        from org.hipparchus.geometry.euclidean.threed import Vector3D
        from org.orekit.attitudes import FrameAlignedProvider
        from org.orekit.frames import FramesFactory, LOFType
        from org.orekit.orbits import CartesianOrbit, KeplerianOrbit, PositionAngleType
        from org.orekit.propagation.analytical import KeplerianPropagator
        from org.orekit.time import AbsoluteDate, TimeScalesFactory
        from org.orekit.utils import PVCoordinates

        self.Vector3D = Vector3D
        self.LOFType = LOFType
        self.CartesianOrbit = CartesianOrbit
        self.KeplerianOrbit = KeplerianOrbit
        self.PositionAngleType = PositionAngleType
        self.KeplerianPropagator = KeplerianPropagator
        self.PVCoordinates = PVCoordinates
        self.gcrf = FramesFactory.getGCRF()
        self.tai = TimeScalesFactory.getTAI()
        self.epoch = AbsoluteDate(2026, 1, 1, 0, 0, 0.0, self.tai)
        self.attitude = FrameAlignedProvider(self.gcrf)

    # -- element/state conversion -------------------------------------------------------------
    def elements_to_orbit(self, el):
        """Contract elements (a, e, i, Ω, ω, ν) → Orekit KeplerianOrbit. Orekit's constructor takes
        (a, e, i, perigee argument ω, RAAN Ω, anomaly, type, ...): ω comes before Ω."""
        return self.KeplerianOrbit(
            float(el["semiMajorAxis_m"]),
            float(el["eccentricity"]),
            float(el["inclination_rad"]),
            float(el["argPeriapsis_rad"]),
            float(el["raan_rad"]),
            float(el["trueAnomaly_rad"]),
            self.PositionAngleType.TRUE,
            self.gcrf,
            self.epoch,
            MU_M3PS2,
        )

    def pv_of(self, orbit_or_state):
        pv = orbit_or_state.getPVCoordinates()
        return vec(pv.getPosition()), vec(pv.getVelocity())

    def pvc(self, r, v):
        return self.PVCoordinates(self.v3(r), self.v3(v))

    def v3(self, x):
        return self.Vector3D(float(x[0]), float(x[1]), float(x[2]))

    def keplerian_from_state(self, r, v, date=None):
        return self.KeplerianOrbit(
            self.pvc(r, v), self.gcrf, self.epoch if date is None else date, MU_M3PS2
        )

    def cartesian_orbit(self, r, v, date):
        return self.CartesianOrbit(self.pvc(r, v), self.gcrf, date, MU_M3PS2)

    def propagator(self, r, v, date):
        """KeplerianPropagator on a CartesianOrbit built from the exact binary64 state (A4)."""
        return self.KeplerianPropagator(self.cartesian_orbit(r, v, date), self.attitude, MU_M3PS2)

    def date(self, t_s):
        return self.epoch.shiftedBy(float(t_s))

    @staticmethod
    def elements_of(ko):
        """Orekit KeplerianOrbit → dict (angles as Orekit returns them, not normalised)."""
        return {
            "semiMajorAxis_m": float(ko.getA()),
            "eccentricity": float(ko.getE()),
            "inclination_rad": float(ko.getI()),
            "raan_rad": float(ko.getRightAscensionOfAscendingNode()),
            "argPeriapsis_rad": float(ko.getPerigeeArgument()),
            "trueAnomaly_rad": float(ko.getTrueAnomaly()),
        }

    # -- RSW -----------------------------------------------------------------------------------
    def qsw_rotation(self, r, v):
        """Orekit LOFType.QSW rotation from inertial (GCRF) to the local frame at state (r, v)."""
        return self.LOFType.QSW.rotationFromInertial(self.pvc(r, v))

    def qsw_axes(self, r, v):
        """Q, S, W unit vectors expressed in GCRF: the images of the local x, y, z axes under the
        inverse rotation (the way Orekit maps a local vector to inertial)."""
        rot = self.qsw_rotation(r, v)
        return tuple(
            vec(rot.applyInverseTo(self.Vector3D(*e)))
            for e in ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))
        )

    def rsw_to_inertial(self, r, v, dv_rsw):
        """Δv_RSW [R, S, W] → GCRF with Orekit's QSW rotation (Q = R, S = S, W = W, README)."""
        rot = self.qsw_rotation(r, v)
        return vec(rot.applyInverseTo(self.v3(dv_rsw)))


def vec(v3):
    return [float(v3.getX()), float(v3.getY()), float(v3.getZ())]


# --- binary64 helpers used by the self-checks (evaluated by the test, tolerances.md budgets) ---


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(a):
    return math.sqrt(dot(a, a))


def sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def dist(a, b):
    return norm(sub(a, b))


def energy(r, v):
    return dot(v, v) / 2.0 - MU_M3PS2 / norm(r)


def zero_to_plus(x):
    """−0 → +0 (contracts-v1.md §11.4 P3: the request builder normalises −0 in every input)."""
    return 0.0 if x == 0.0 else x


# --- tolerance-record formulas (docs/verification/tolerances.md revision 3) -------------------


class Scales:
    """§4 derived scales and conditioning factors of a closed orbit (a > 0, 0 ≤ e < 1)."""

    def __init__(self, a, e):
        mu = MU_M3PS2
        self.a, self.e = a, e
        self.r_p = a * (1 - e)
        self.r_a = a * (1 + e)
        self.n = math.sqrt(mu / a**3)
        self.T = 2 * math.pi / self.n
        self.v_p = math.sqrt((mu / a) * (1 + e) / (1 - e))
        self.g_p = mu / self.r_p**2
        self.h = math.sqrt(mu * a * (1 - e * e))
        self.E_abs = mu / (2 * a)
        self.kappa_h = 1 / math.sqrt(1 - e * e)
        self.kappa_E = 4 / (1 - e) - 1
        self.kappa_b = 2 + 2 / (1 - e) + self.kappa_h
        self.kappa_bv = 4 + 4 / (1 - e)
        self.C_b = 20.0
        self.C_t = 7.5 * self.kappa_E + 4
        self.P_b = U * (self.C_b * self.kappa_b * self.r_a + 10 * self.kappa_E * a)
        self.V_b = U * (self.C_b * self.kappa_bv + 5 * self.kappa_E) * self.v_p

    # §6.1
    def dt_res(self, dt):
        e = self.e
        return U * ((25 + 65 * e) * abs(dt) + (12 + 114 * e + 130 * e * e) / self.n)

    def dt_g(self, dt):
        return U * (17.5 * abs(dt) + (2 + 35 * self.e) / self.n)

    def L(self, dt):
        return abs(dt) + 1 / self.n

    # §6.3 engine bound (unmargined)
    def P_E(self, dt):
        return self.P_b + self.v_p * (
            U * self.C_t * self.L(dt) + 2 * self.dt_res(dt) + self.dt_g(dt)
        )

    def V_E(self, dt):
        e = self.e
        r, g = self.dt_res(dt), self.dt_g(dt)
        return self.V_b + self.g_p * (U * self.C_t * self.L(dt) + r + 2 * (1 + e) * (r + g))

    # §7 VT-06 engine part
    def tau_E_eng(self, dt):
        return (self.v_p * self.V_b + self.g_p * self.P_b) / self.E_abs + (3 + 2 * self.e) * (
            self.v_p * self.g_p / self.E_abs
        ) * (self.dt_res(dt) + self.dt_g(dt))

    # §7 VT-07 engine part
    def tau_h_eng(self, dt):
        e = self.e
        return (
            self.P_b * self.v_p
            + self.r_a * self.V_b
            + (self.v_p**2 + 2 * (1 + e) * self.r_a * self.g_p) * (self.dt_res(dt) + self.dt_g(dt))
        ) / self.h

    # --- A6 (tolerances.md §9.3): Orekit obeys §6.3 with coefficients at most 2x ours ---
    def selfcheck_energy(self, dt):
        """VT-06 tolerance with the engine part doubled (A6): M[10uκ_E + 2τ_E,eng(Δt)]."""
        return M_MARGIN * (10 * U * self.kappa_E + 2 * self.tau_E_eng(dt))

    def selfcheck_h(self, dt):
        """VT-07 tolerance with the engine part doubled (A6): M[6uκ_h + 2(...)/h]."""
        return M_MARGIN * (6 * U * self.kappa_h + 2 * self.tau_h_eng(dt))

    def selfcheck_closure(self, N):
        """VT-08 tolerance with P_E, V_E doubled (A6)."""
        t = N * self.T
        w = U * (7.5 * self.kappa_E + 6)
        return (
            M_MARGIN * (2 * self.P_E(t) + w * self.v_p * t),
            M_MARGIN * (2 * self.V_E(t) + w * self.g_p * t),
        )

    # §9.3 L3 Orekit tolerance for an engine comparison: 3M·P_E (position), 3M·V_E (velocity)
    def l3_tolerance(self, dt):
        return 3 * M_MARGIN * self.P_E(dt), 3 * M_MARGIN * self.V_E(dt)

    # §7 VT-02 (two sides)
    def eta_r(self):
        e = self.e
        return 31 + 2 / (1 - e * e) + (1 + 3 * e) / (1 - e)

    def eta_v(self):
        e = self.e
        return 25 + 1 / (1 - e * e) + 7 / (1 + e)

    def vt02_tolerance(self):
        return (
            M_MARGIN * 2 * self.eta_r() * U * self.r_a,
            M_MARGIN * 2 * self.eta_v() * U * self.v_p,
        )

    # §7 VT-03 round trip
    def B_rt(self):
        e = self.e
        return (
            5 * self.kappa_E
            + 90 / (1 - e)
            + (6 * self.kappa_h + 55)
            + 31
            + 2 / (1 - e * e)
            + (1 + 3 * e) / (1 - e)
        )

    def B_vt(self):
        e = self.e
        return (
            2.5 * self.kappa_E
            + 90 / (1 - e)
            + (6 * self.kappa_h + 55)
            + 25
            + 1 / (1 - e * e)
            + 7 / (1 + e)
        )

    def vt03_tolerance(self):
        return M_MARGIN * self.B_rt() * U * self.r_a, M_MARGIN * self.B_vt() * U * self.v_p


def scales_of_state(r, v):
    """Scales of the closed orbit through (r, v), evaluated in binary64 from the reference state
    (tolerances.md §4.1 item 2: conditioning from the reference side)."""
    E = energy(r, v)
    a = -MU_M3PS2 / (2 * E)
    rv = dot(r, v)
    ev = [
        ((dot(v, v) - MU_M3PS2 / norm(r)) * r[k] - rv * v[k]) / MU_M3PS2 for k in range(3)
    ]
    return Scales(a, norm(ev))


# --- number formatting (lossless, same text form as the existing datasets) ---------------------


def js_number(x: float) -> str:
    """ECMA-262 Number::toString of a finite binary64 (the form JSON.stringify writes in the
    existing datasets). Digits are Python's repr digits: both are the shortest decimal that
    round-trips to the binary64 value, correctly rounded."""
    if not math.isfinite(x):
        raise ValueError(f"non-finite number {x!r}")
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    t = Decimal(repr(abs(x))).as_tuple()
    digits = "".join(map(str, t.digits))  # repr of a non-zero float has no leading zero digit
    if digits[0] == "0":
        raise AssertionError(repr(x))
    n = len(digits) + t.exponent  # value = 0.digits × 10^n
    s = digits.rstrip("0")
    k = len(s)
    # value = s × 10^(n − k), ECMA-262 Number::toString cases
    if k <= n <= 21:
        out = s + "0" * (n - k)
    elif 0 < n <= 21:
        out = s[:n] + "." + s[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + s
    else:
        e = n - 1
        es = ("+" if e > 0 else "-") + str(abs(e))
        out = (s if k == 1 else s[0] + "." + s[1:]) + "e" + es
    assert float(sign + out) == x, (x, out)
    return sign + out


def encode(x):
    """Prepares a value for JSON: −0 becomes {"$number": "-0"} (the encoding of
    test-data/reference-cases/README.md), other floats stay floats."""
    if isinstance(x, float) and x == 0.0 and math.copysign(1.0, x) < 0:
        return {"$number": "-0"}
    if isinstance(x, list):
        return [encode(y) for y in x]
    if isinstance(x, dict):
        return {k: encode(y) for k, y in x.items()}
    return x


def dumps(x, indent=0) -> str:
    pad = "  " * indent
    if isinstance(x, bool):
        return "true" if x else "false"
    if x is None:
        return "null"
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float):
        return js_number(x)
    if isinstance(x, str):
        return json.dumps(x, ensure_ascii=False)
    if isinstance(x, list):
        if not x:
            return "[]"
        return "[" + ", ".join(dumps(y, indent + 1) for y in x) + "]"
    if isinstance(x, dict):
        if not x:
            return "{}"
        inner = ",\n".join(
            "  " * (indent + 1) + json.dumps(k, ensure_ascii=False) + ": " + dumps(v, indent + 1)
            for k, v in x.items()
        )
        return "{\n" + inner + "\n" + pad + "}"
    raise TypeError(type(x))


def prettier_format(text: str, rel_path: str) -> str:
    """Formats JSON text with the repository's Prettier (version pinned in package.json) as if it
    were the file rel_path of the repository (configuration resolved from that path), so that
    `pnpm format:check` accepts it wherever it is written. Prettier keeps number literals."""
    node = os.environ.get("NODE", "node")
    cli = REPO_ROOT / "node_modules" / "prettier" / "bin" / "prettier.cjs"
    if not cli.exists():
        raise SystemExit("node_modules/prettier missing: run `pnpm install --frozen-lockfile` first")
    res = subprocess.run(
        [node, str(cli), "--stdin-filepath", str(REPO_ROOT / rel_path)],
        input=text.encode("utf-8"),
        capture_output=True,
        check=True,
        cwd=REPO_ROOT,
    )
    return res.stdout.decode("utf-8")


def render_json(data, rel_path: str) -> bytes:
    """Final file bytes: lossless numbers (dumps), then Prettier."""
    return prettier_format(dumps(encode(data)) + "\n", rel_path).encode("utf-8")


def write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


# --- provenance ------------------------------------------------------------------------------


def environment():
    """Tool versions, read at run time (no absolute paths are recorded)."""
    start_vm()
    import jpype
    from java.lang import System

    def jar_name(cls):
        loc = str(jpype.JClass(cls).class_.getProtectionDomain().getCodeSource().getLocation())
        return loc.rsplit("/", 1)[-1]

    return {
        "orekitJar": jar_name("org.orekit.time.AbsoluteDate"),
        "hipparchusJar": jar_name("org.hipparchus.util.FastMath"),
        "orekitJpype": metadata.version("orekit_jpype"),
        "jpype1": metadata.version("JPype1"),
        "python": platform.python_version(),
        "jdk": f"{System.getProperty('java.version')} ({System.getProperty('java.vendor')}, "
        f"{System.getProperty('java.vm.name')} {System.getProperty('java.vm.version')})",
        "os": f"{platform.system()} {platform.release()} {platform.machine()}",
    }


def git_rev_for(paths) -> str:
    out = subprocess.run(
        ["git", "log", "-1", "--format=%H", "--"] + [str(p) for p in paths],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return out


def ensure_utf8_stdout():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
