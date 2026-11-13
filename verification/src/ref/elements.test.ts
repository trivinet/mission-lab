/**
 * Self-validation of the L2c reference (tolerance record §9: L2c is validated first by its own
 * checks) and the VT-03 / VT-04 reference-vs-L1 cross-checks. Every bound below is a formula of
 * docs/verification/tolerances.md evaluated at the case's own scale, or derived in a comment.
 */
import { describe, expect, it } from 'vitest';
import { BELOW_TWO_PI, DEGENERATE, GRID } from '../datasets/cases';
import {
  E_HAT_EXACT_CIRCULAR,
  elementRows,
  iHatExactRetrograde,
  scales,
  U,
  vt03,
  vt04,
} from '../tol/tolerances';
import {
  elementsToState,
  perifocalToInertial,
  stateToElementView,
  stateToElementsRaw,
  type Elements,
} from './elements';
import { cross, dist, dot, norm, wrapPi, type V3 } from './vec';

const MU = 3.986004418e14; // proposed-architecture.md §3

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function randomElements(r: () => number): Elements {
  const e = 0.9 * r();
  const rp = 6.6e6 + 3e7 * r();
  return {
    semiMajorAxis_m: rp / (1 - e),
    eccentricity: e,
    inclination_rad: Math.PI * r(),
    raan_rad: 2 * Math.PI * r(),
    argPeriapsis_rad: 2 * Math.PI * r(),
    trueAnomaly_rad: 2 * Math.PI * r(),
  };
}

describe('L2c rotation matrix', () => {
  it('is orthonormal within its rounding bound', () => {
    // Each entry of Q = Rz(Ω)Rx(i)Rz(ω) has absolute error ≤ 9u (tolerance record §7 VT-02,
    // (3c_f + 3)u); a column then has error ≤ √3·9u, a Gram entry ≤ 2√3·9u + 3u. Margin M = 4.
    const bound = 4 * (2 * Math.sqrt(3) * 9 + 3) * U;
    const r = rng(11);
    for (let k = 0; k < 500; k++) {
      const q = perifocalToInertial(2 * Math.PI * r(), Math.PI * r(), 2 * Math.PI * r());
      const cols: V3[] = [0, 1, 2].map((j) => [q[0][j] ?? 0, q[1][j] ?? 0, q[2][j] ?? 0]);
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          const ca = cols[a];
          const cb = cols[b];
          if (ca === undefined || cb === undefined) throw new Error('index');
          expect(Math.abs(dot(ca, cb) - (a === b ? 1 : 0))).toBeLessThanOrEqual(bound);
        }
      }
      // Right-handed: det = +1 through the column triple product.
      const [c0, c1, c2] = cols as [V3, V3, V3];
      expect(Math.abs(dot(cross(c0, c1), c2) - 1)).toBeLessThanOrEqual(bound * 2);
    }
  });

  it('maps perifocal axes to the textbook directions in special configurations', () => {
    // Ω = 0, i = 0, ω = 0: identity, exactly (cos 0 = 1, sin 0 = 0).
    const s = elementsToState(
      {
        semiMajorAxis_m: 1e7,
        eccentricity: 0.25,
        inclination_rad: 0,
        raan_rad: 0,
        argPeriapsis_rad: 0,
        trueAnomaly_rad: 0,
      },
      MU,
    );
    expect(s.position_m[1]).toBe(0);
    expect(s.position_m[2]).toBe(0);
    expect(s.velocity_mps[0] === 0).toBe(true);
    // r_p = a(1 − e) = 7.5e6 and v_p = √(μ(1 + e)/(a(1 − e))) to a few ulps
    expect(Math.abs(s.position_m[0] - 7.5e6)).toBeLessThanOrEqual(4 * U * 7.5e6);
    const vp = Math.sqrt((MU * 1.25) / 7.5e6);
    expect(Math.abs(s.velocity_mps[1] - vp)).toBeLessThanOrEqual(8 * U * vp);
    // i = π/2, Ω = π/2, ω = 0, ν = 0: periapsis on the node line, which is the +y axis; the
    // velocity then lies along ±z (orbit plane spanned by y and z).
    const t = elementsToState(
      {
        semiMajorAxis_m: 1e7,
        eccentricity: 0,
        inclination_rad: Math.PI / 2,
        raan_rad: Math.PI / 2,
        argPeriapsis_rad: 0,
        trueAnomaly_rad: 0,
      },
      MU,
    );
    expect(Math.abs(t.position_m[1] - 1e7)).toBeLessThanOrEqual(8 * U * 1e7);
    expect(Math.abs(t.position_m[0])).toBeLessThanOrEqual(8 * U * 1e7);
    expect(t.velocity_mps[2]).toBeGreaterThan(0);
  });

  it('produces states satisfying the two-body invariants of its input elements', () => {
    // L1 checks of L2c: specific energy −μ/(2a), |h| = √(μp), ĥ = (sin Ω sin i, −cos Ω sin i,
    // cos i). Bounds: energy 5uκ_E|E| (VT-06 term (i)) plus the state's VT-02 error δE ≤
    // v δv + (μ/r²) δr, i.e. ≤ (2η_v(e)·v_p² + 2η_r(e)·g_p r_a)u; margin 4. Normal direction:
    // cross product 3uκ_h (B5) plus normalisation and state errors, bounded by the VT-02
    // relative budgets: ≤ 2(η_r + η_v + 3κ_h)u, margin 4.
    const r = rng(12);
    for (let k = 0; k < 1000; k++) {
      const el = randomElements(r);
      const s = elementsToState(el, MU);
      const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
      const rr = norm(s.position_m);
      const v2 = dot(s.velocity_mps, s.velocity_mps);
      const energy = v2 / 2 - MU / rr;
      const etaR = 31 + 2 / (1 - sc.e ** 2) + (1 + 3 * sc.e) / (1 - sc.e);
      const etaV = 25 + 1 / (1 - sc.e ** 2) + 7 / (1 + sc.e);
      const eBound =
        4 * (5 * sc.kappaE * sc.energy + (etaV * sc.vp * sc.vp + etaR * sc.gp * sc.ra) * 2) * U;
      expect(Math.abs(energy + sc.energy)).toBeLessThanOrEqual(eBound);
      const h = cross(s.position_m, s.velocity_mps);
      const hn = norm(h);
      const i = el.inclination_rad;
      const w: V3 = [
        Math.sin(el.raan_rad) * Math.sin(i),
        -Math.cos(el.raan_rad) * Math.sin(i),
        Math.cos(i),
      ];
      const dirErr = dist([h[0] / hn, h[1] / hn, h[2] / hn], w);
      expect(dirErr).toBeLessThanOrEqual(4 * 2 * (etaR + etaV + 3 * sc.kappaH + 10) * U);
    }
  });
});

describe('L2c state → elements → state round trip (VT-03 bound, reference self-check)', () => {
  it('meets the VT-03 tolerance on the grid and on random orbits', () => {
    const r = rng(13);
    const els = [
      ...GRID.map((g) => g.elements),
      ...Array.from({ length: 2000 }, () => randomElements(r)),
    ];
    for (const el of els) {
      const s0 = elementsToState(el, MU);
      const raw = stateToElementsRaw(s0, MU);
      const s1 = elementsToState(raw, MU);
      const tol = vt03(scales(MU, el.semiMajorAxis_m, el.eccentricity));
      expect(dist(s1.position_m, s0.position_m)).toBeLessThanOrEqual(tol.position_m);
      expect(dist(s1.velocity_mps, s0.velocity_mps)).toBeLessThanOrEqual(tol.velocity_mps);
    }
  });

  it('recovers the input elements of non-degenerate orbits within the VI-03 element rows', () => {
    // One-sided comparison (exact input vs reference extraction from the L2c state); the rows
    // of §8 VI-03(b) are two-sided, so they are conservative here. Inputs within the factor-2
    // band of a threshold are excluded (§7 VT-04, §8).
    const r = rng(14);
    for (let k = 0; k < 2000; k++) {
      const el = randomElements(r);
      const sinI = Math.sin(el.inclination_rad);
      if (el.eccentricity < 1e-3 || sinI < 1e-3) continue;
      const s = elementsToState(el, MU);
      const got = stateToElementsRaw(s, MU);
      const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
      const rows = elementRows(sc.kappaH, el.eccentricity, sinI);
      // The VT-02 state error moves the elements too; it is inside the VT-03 angle budget of
      // the record, which the rows below (derived for an exact state) do not contain. Add the
      // VT-02 relative state budget 2(η_r + η_v)u/e for e, ω, ν (e-vector sensitivity ≤ 3δv/v +
      // 2δr/r, §10) and 2(η_r + η_v)u for i, Ω.
      const etaR = 31 + 2 / (1 - sc.e ** 2) + (1 + 3 * sc.e) / (1 - sc.e);
      const etaV = 25 + 1 / (1 - sc.e ** 2) + 7 / (1 + sc.e);
      const st = 4 * 3 * (etaR + etaV) * U;
      expect(Math.abs(got.eccentricity - el.eccentricity)).toBeLessThanOrEqual(rows.e + st);
      expect(Math.abs(got.inclination_rad - el.inclination_rad)).toBeLessThanOrEqual(rows.i + st);
      expect(Math.abs(wrapPi(got.raan_rad - el.raan_rad))).toBeLessThanOrEqual(
        (rows.raan ?? 0) + st / sinI,
      );
      expect(Math.abs(wrapPi(got.argPeriapsis_rad - el.argPeriapsis_rad))).toBeLessThanOrEqual(
        (rows.argp ?? 0) + st / el.eccentricity + st / sinI,
      );
      expect(Math.abs(wrapPi(got.trueAnomaly_rad - el.trueAnomaly_rad))).toBeLessThanOrEqual(
        (rows.nu ?? 0) + st / el.eccentricity,
      );
      const a = sc.a;
      expect(Math.abs(got.semiMajorAxis_m - a) / a).toBeLessThanOrEqual(
        4 * (5.5 * sc.kappaE + 2 * sc.kappaE * (etaR + etaV)) * U,
      );
    }
  });
});

describe('L2c degenerate-element convention (VT-04 reference)', () => {
  it('classifies every degenerate case as expected', () => {
    for (const c of DEGENERATE) {
      const view = stateToElementView(elementsToState(c.elements, MU), MU);
      expect(view.circular, c.id).toBe(c.expectCircular);
      expect(view.equatorial, c.id).toBe(c.expectEquatorial);
      if (view.equatorial) expect(view.elements.raan_rad, c.id).toBe(0);
      if (view.circular) expect(view.elements.argPeriapsis_rad, c.id).toBe(0);
      // e and i are never zeroed (ADR-008).
      expect(view.elements.eccentricity).toBe(
        stateToElementsRaw(elementsToState(c.elements, MU), MU).eccentricity,
      );
    }
  });

  it('round-trips state → view → state within the VT-04 tolerance', () => {
    for (const c of DEGENERATE) {
      const el = c.elements;
      const s0 = elementsToState(el, MU);
      const view = stateToElementView(s0, MU);
      const s1 = elementsToState(view.elements, MU);
      const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
      const iPrime = Math.min(el.inclination_rad, Math.PI - el.inclination_rad);
      let eConv = 0;
      let iConv = 0;
      if (view.circular) eConv = el.eccentricity === 0 ? E_HAT_EXACT_CIRCULAR : el.eccentricity;
      if (view.equatorial) {
        if (el.inclination_rad === 0) iConv = 0;
        else if (el.inclination_rad === Math.PI) iConv = iHatExactRetrograde(sc);
        else iConv = iPrime;
      }
      const tol = vt04(sc, eConv, iConv);
      expect(dist(s1.position_m, s0.position_m), c.id).toBeLessThanOrEqual(tol.position_m);
      expect(dist(s1.velocity_mps, s0.velocity_mps), c.id).toBeLessThanOrEqual(tol.velocity_mps);
    }
  });

  it('assigns the substitute angles of the documented convention', () => {
    const view = (el: Elements) => stateToElementView(elementsToState(el, MU), MU).elements;
    const angleTol = 1e-13; // ≈ 900u: far below any convention effect, far above rounding
    // Prograde equatorial: ϖ = Ω + ω, ν kept.
    const d5 = DEGENERATE.find((d) => d.id === 'd5-elliptical-equatorial-prograde');
    if (d5 === undefined) throw new Error('missing case');
    expect(Math.abs(wrapPi(view(d5.elements).argPeriapsis_rad - 1.5))).toBeLessThan(angleTol);
    // Retrograde equatorial (i = π): ϖ = ω − Ω (measured in the sense of motion).
    const d3 = DEGENERATE.find((d) => d.id === 'd3-elliptical-equatorial-retrograde');
    if (d3 === undefined) throw new Error('missing case');
    expect(Math.abs(wrapPi(view(d3.elements).argPeriapsis_rad - 0.7))).toBeLessThan(angleTol);
    expect(Math.abs(wrapPi(view(d3.elements).trueAnomaly_rad - 2.0))).toBeLessThan(angleTol);
    // Circular equatorial retrograde: ν := true longitude = given ν when Ω = ω = 0.
    const d2 = DEGENERATE.find((d) => d.id === 'd2-circular-equatorial-retrograde');
    if (d2 === undefined) throw new Error('missing case');
    expect(Math.abs(wrapPi(view(d2.elements).trueAnomaly_rad - 0.7))).toBeLessThan(angleTol);
    // Circular inclined: ν := argument of latitude ω + ν.
    expect(
      Math.abs(
        wrapPi(
          view({
            semiMajorAxis_m: 7e6,
            eccentricity: 0,
            inclination_rad: 0.9,
            raan_rad: 1.2,
            argPeriapsis_rad: 0.5,
            trueAnomaly_rad: 0.3,
          }).trueAnomaly_rad - 0.8,
        ),
      ),
    ).toBeLessThan(angleTol);
  });

  it('uses the boundary value just below 2π', () => {
    expect(BELOW_TWO_PI).toBeLessThan(2 * Math.PI);
    expect(BELOW_TWO_PI + 2 ** -50).toBe(2 * Math.PI);
  });
});
