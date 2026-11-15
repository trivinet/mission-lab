/**
 * Transcription check of the revision-4 formulas (tolerances-r4.ts) against every evaluated number
 * printed in docs/verification/tolerances.md revision 4: §6.8 table and first samples, §7 VT-15
 * table ("new version" column), §9.3.1 tables (VT-02, VT-12, VT-15) and the VT-16 L3 values.
 * Matching rule: half a unit in the last printed digit (as tolerances.test.ts), or the printed value
 * rounded up by less than one unit (the record prints some values rounded up; see matchesPrinted). Inputs come from the
 * reference side only (L2 grid states, Orekit event states of test-data/l3-orekit).
 */
import { describe, expect, it } from 'vitest';
import { VT15, gridCase, scaleOf, withAnomaly } from '../datasets/build-c';
import { l3Vt15Inputs, readL3, vt15R4Case, vt16R4Case } from '../datasets/build-d2';
import { conicOfState } from '../ref/maneuver';
import type { V3 } from '../ref/vec';
import { MARGIN, scales, U } from './tolerances';
import {
  L3_FACTOR,
  hyperbolicBound,
  prepareHyperbolicArc,
  propagationL3,
  vt02L3,
  vt12L3,
  vt15L3,
  vt15R4,
  type HyperbolicArc,
} from './tolerances-r4';

const MU = 3.986004418e14;

function matchesPrinted(value: number, printed: string): boolean {
  const p = Number(printed);
  const mant = printed.toLowerCase().split('e')[0] ?? printed;
  const decimals = (mant.split('.')[1] ?? '').length;
  const expPart = printed.toLowerCase().includes('e')
    ? Number(printed.toLowerCase().split('e')[1])
    : 0;
  const halfUnit = 0.5 * 10 ** (expPart - decimals);
  // Nearest rounding, or upward (ceiling) rounding of the last printed digit: revision 4 prints
  // several tolerances rounded up (conservative); the unrounded formula value is then below the
  // printed one by less than one unit of the last digit (never above it).
  const slack = 1e-12 * Math.abs(p);
  const nearest = Math.abs(value - p) <= halfUnit + slack;
  const ceiling = value <= p + slack && p - value < 2 * halfUnit + slack;
  return nearest || ceiling;
}

function check(label: string, value: number, printed: string): void {
  expect
    .soft(matchesPrinted(value, printed), `${label}: computed ${String(value)}, printed ${printed}`)
    .toBe(true);
}

type Obj = Record<string, unknown>;

function l3Arc(file: string, dtEnd: number): HyperbolicArc {
  const d = readL3('vt-16', file);
  const ev = (d.outputs as Obj).event as Obj;
  return prepareHyperbolicArc(MU, ev.position_m as V3, ev.velocityAfter_mps as V3, dtEnd);
}

describe('revision-4 formulas reproduce the approved record (transcription check)', () => {
  it('§6.8 hyperbolic arcs: table and first samples', () => {
    const rows: [string, HyperbolicArc, number, string[], string][] = [
      // label, arc, first-sample Δt, [ratio, |a|, e, rmin, rmax, κE, x, Pb, Pb|a|, εt, M·P, M·V], first M·P
      [
        'L2 c3-midrun-escape',
        vt16R4Case('c3-midrun-escape').arc,
        60,
        [
          '0.2145',
          '1.0282e7',
          '2.0748',
          '1.105e7',
          '3.245e7',
          '4.722',
          '1.448',
          '3.90e-7',
          '2.74e-7',
          '2.50e-11',
          '4.551e-6',
          '3.412e-9',
        ],
        '1.603e-6',
      ],
      [
        'L3 c3-midrun-escape',
        l3Arc('l3-orekit-c3-midrun-escape.json', 15000),
        1000,
        [
          '0.2145',
          '1.0282e7',
          '2.0748',
          '1.105e7',
          '1.083e8',
          '4.722',
          '2.530',
          '1.24e-6',
          '7.24e-7',
          '1.22e-10',
          '1.904e-5',
          '1.435e-8',
        ],
        '5.580e-6',
      ],
      [
        'L2 escape-clear',
        vt16R4Case('escape-clear').arc,
        60,
        [
          '0.0786',
          '2.0519e7',
          '1.3411',
          '7.000e6',
          '4.239e7',
          '12.725',
          '1.468',
          '8.88e-7',
          '5.79e-7',
          '3.58e-11',
          '1.039e-5',
          '1.105e-8',
        ],
        '3.607e-6',
      ],
      [
        'L3 c1-escape-prograde',
        l3Arc('l3-orekit-c1-escape-prograde.json', 20000),
        1000,
        [
          '0.0786',
          '2.0519e7',
          '1.3411',
          '7.000e6',
          '1.175e8',
          '12.725',
          '2.296',
          '2.43e-6',
          '1.06e-6',
          '1.34e-10',
          '3.428e-5',
          '3.833e-8',
        ],
        '1.083e-5',
      ],
      [
        'L2 hyperbolic-inbound',
        vt16R4Case('hyperbolic-inbound').arc,
        60,
        [
          '0.0549',
          '3.0103e7',
          '1.1714',
          '5.159e6',
          '3.821e7',
          '24.340',
          '1.602',
          '1.35e-6',
          '1.13e-6',
          '9.06e-11',
          '2.234e-5',
          '4.302e-8',
        ],
        '5.628e-6',
      ],
      [
        'L2 hyperbolic-outbound',
        vt16R4Case('hyperbolic-outbound').arc,
        60,
        [
          '0.0549',
          '3.0103e7',
          '1.1714',
          '7.000e6',
          '4.380e7',
          '18.202',
          '1.049',
          '1.24e-6',
          '9.64e-7',
          '3.51e-11',
          '1.269e-5',
          '1.136e-8',
        ],
        '5.163e-6',
      ],
    ];
    for (const [label, arc, first, p, pFirst] of rows) {
      const end = hyperbolicBound(arc, arc.dtEnd);
      const vals = [
        arc.energyRatio,
        arc.aAbs,
        arc.e,
        arc.rMin,
        arc.rMax,
        arc.kappaE,
        arc.xEnd,
        arc.pBgen,
        arc.pBgenAbsAForm,
        end.epsTgen,
        MARGIN * end.pEgen,
        MARGIN * end.vEgen,
      ];
      const names = [
        'ratio',
        '|a|',
        'e',
        'r_min',
        'r_max',
        'κ_E',
        'x(end)',
        'P_b,gen',
        '|a| form',
        'ε_t,gen',
        'M·P_E,gen',
        'M·V_E,gen',
      ];
      vals.forEach((v, i) => {
        check(`${label} ${names[i] ?? ''}`, v, p[i] ?? 'NaN');
      });
      check(`${label} first sample M·P_E,gen`, MARGIN * hyperbolicBound(arc, first).pEgen, pFirst);
    }
  });

  it('§9.3.1 VT-16 L3 hyperbolic end and first-sample values, elliptic segment after the burn', () => {
    const c3 = l3Arc('l3-orekit-c3-midrun-escape.json', 15000);
    const c1 = l3Arc('l3-orekit-c1-escape-prograde.json', 20000);
    check('C3 end r', L3_FACTOR * hyperbolicBound(c3, 15000).pEgen, '5.712e-5');
    check('C3 end v', L3_FACTOR * hyperbolicBound(c3, 15000).vEgen, '4.304e-8');
    check('C1 end r', L3_FACTOR * hyperbolicBound(c1, 20000).pEgen, '1.028e-4');
    check('C1 end v', L3_FACTOR * hyperbolicBound(c1, 20000).vEgen, '1.150e-7');
    check('C3 first r', L3_FACTOR * hyperbolicBound(c3, 1000).pEgen, '1.674e-5');
    check('C3 first v', L3_FACTOR * hyperbolicBound(c3, 1000).vEgen, '3.304e-9');
    check('C1 first r', L3_FACTOR * hyperbolicBound(c1, 1000).pEgen, '3.248e-5');
    check('C1 first v', L3_FACTOR * hyperbolicBound(c1, 1000).vEgen, '7.110e-9');
    const d = readL3('vt-16', 'l3-orekit-c4-midrun-retro-subsurface.json');
    const ev = (d.outputs as Obj).event as Obj;
    const post = conicOfState(MU, ev.position_m as V3, ev.velocityAfter_mps as V3);
    check('C4 a⁺', post.semiMajorAxis_m, '8.4482e6');
    check('C4 e⁺', post.eccentricity, '0.61416');
    const sPost = scales(MU, post.semiMajorAxis_m, post.eccentricity);
    check('C4 last r', propagationL3(sPost, 5999.5).position_m, '3.73e-5');
    check('C4 last v', propagationL3(sPost, 5999.5).velocity_mps, '1.71e-7');
  });

  it('§7 VT-15 revision-4 table ("new version" column, κ_h⁺, a⁺)', () => {
    // id: [a⁺, κ_h⁺, |δa⁺|/a⁺, |δe⁺|, δψ_n, |δψ|]
    const table: Record<string, string[]> = {
      'c1-circular-prograde': [
        '7.1919e6',
        '1.0000',
        '1.52e-14',
        '4.14e-14',
        '6.65e-15',
        '2.62e-14',
      ],
      'c1-circular-prograde-after-1T': [
        '7.1919e6',
        '1.0000',
        '1.063e-12',
        '1.061e-12',
        '2.76e-13',
        '2.95e-13',
      ],
      'c1-normal': ['7.0049e6', '1.0000', '1.55e-14', '3.02e-14', '7.09e-15', '2.66e-14'],
      'c3-apogee-circularise': [
        '1.3000e7',
        '1.0000',
        '1.60e-14',
        '3.93e-14',
        '1.17e-14',
        '3.15e-14',
      ],
      'c4-perigee-prograde': ['1.2676e7', '1.0000', '2.95e-14', '4.34e-14', '6.60e-15', '2.66e-14'],
      'c4-perigee-prograde-after-1T': [
        '1.2676e7',
        '1.0000',
        '9.114e-12',
        '5.203e-12',
        '5.69e-13',
        '5.89e-13',
      ],
      'c4-perigee-retrograde': [
        '1.1399e7',
        '1.0000',
        '2.61e-14',
        '4.31e-14',
        '6.61e-15',
        '2.66e-14',
      ],
      'c4-apogee-prograde': ['1.2283e7', '1.0000', '9.40e-15', '3.95e-14', '7.09e-15', '2.71e-14'],
      'c4-apogee-prograde-after-1T': [
        '1.2283e7',
        '1.0000',
        '8.812e-12',
        '1.208e-11',
        '6.45e-13',
        '6.65e-13',
      ],
      'c4-perigee-normal': ['1.2008e7', '1.0000', '2.91e-14', '3.08e-14', '6.79e-15', '2.68e-14'],
      'c4-radial': ['1.2126e7', '1.0404', '2.44e-14', '2.99e-14', '6.82e-15', '2.69e-14'],
      'c4-combined': ['1.1723e7', '1.0392', '2.34e-14', '2.98e-14', '6.82e-15', '2.69e-14'],
      'c5-perigee-prograde': ['2.7844e7', '1.0000', '7.56e-14', '4.50e-14', '6.40e-15', '2.85e-14'],
      'c5-apogee-raise-perigee': [
        '2.7143e7',
        '1.0000',
        '6.84e-15',
        '3.80e-14',
        '1.07e-14',
        '3.28e-14',
      ],
    };
    expect(VT15.map((s) => s.id).sort()).toEqual(Object.keys(table).sort());
    for (const sp of VT15) {
      const c = vt15R4Case(sp);
      const t = vt15R4(c.inputs);
      const p = table[sp.id] ?? [];
      check(`${sp.id} a⁺`, c.inputs.aPlus, p[0] ?? '');
      check(`${sp.id} κ_h⁺`, t.kappaHPlus, p[1] ?? '');
      check(`${sp.id} a rel`, t.aRelative, p[2] ?? '');
      check(`${sp.id} e abs`, t.eAbsolute, p[3] ?? '');
      check(`${sp.id} δψ_n`, t.planeNormal_rad, p[4] ?? '');
      check(`${sp.id} δψ`, t.planeRotation_rad, p[5] ?? '');
      // κ_h⁻ is the grid case's (record table note).
      expect(c.inputs.sPre.kappaH).toBe(
        scaleOf(withAnomaly(gridCase(sp.orbit).elements, 0)).kappaH,
      );
    }
  });

  it('§7 VT-15 C3 circularisation: corrected tangential a⁺ = 143.7u and the general e⁺ formula', () => {
    const sp = VT15.find((s) => s.id === 'c3-apogee-circularise');
    if (sp === undefined) throw new Error('case');
    const t = vt15R4(vt15R4Case(sp).inputs);
    check('a rel in u', t.aRelative / U, '143.7');
    expect(t.eFormula).toBe('general');
  });

  it('§9.3.1 VT-15 L3 table (inputs from the Orekit event states)', () => {
    const table: Record<string, string[]> = {
      'c1-circular-prograde': ['2.49e-14', '6.42e-14', '1.20e-14', '4.13e-14'],
      'c1-circular-prograde-after-1T': ['3.17e-12', '3.12e-12', '8.19e-13', '8.48e-13'],
      'c1-normal': ['2.66e-14', '5.05e-14', '1.33e-14', '4.26e-14'],
      'c3-apogee-circularise': ['2.79e-14', '7.80e-14', '2.70e-14', '5.67e-14'],
      'c4-perigee-prograde': ['4.83e-14', '6.74e-14', '1.18e-14', '4.18e-14'],
      'c4-perigee-prograde-after-1T': ['2.73e-11', '1.56e-11', '1.70e-12', '1.73e-12'],
      'c4-perigee-retrograde': ['4.26e-14', '6.69e-14', '1.18e-14', '4.19e-14'],
      'c4-apogee-prograde': ['1.54e-14', '6.10e-14', '1.33e-14', '4.33e-14'],
      'c4-apogee-prograde-after-1T': ['2.64e-11', '3.62e-11', '1.93e-12', '1.96e-12'],
      'c4-perigee-normal': ['4.94e-14', '5.23e-14', '1.24e-14', '4.24e-14'],
      'c4-radial': ['4.08e-14', '4.97e-14', '1.22e-14', '4.22e-14'],
      'c4-combined': ['3.91e-14', '4.96e-14', '1.22e-14', '4.22e-14'],
      'c5-perigee-prograde': ['1.24e-13', '7.00e-14', '1.12e-14', '4.44e-14'],
      'c5-apogee-raise-perigee': ['1.12e-14', '5.86e-14', '2.40e-14', '5.72e-14'],
    };
    for (const [id, p] of Object.entries(table)) {
      const t = vt15L3(l3Vt15Inputs(readL3('vt-15', `l3-orekit-${id}.json`)));
      check(`${id} a`, t.aRelative, p[0] ?? '');
      check(`${id} e`, t.eAbsolute, p[1] ?? '');
      check(`${id} δψ_n`, t.planeNormal_rad, p[2] ?? '');
      check(`${id} δψ`, t.planeRotation_rad, p[3] ?? '');
    }
  });

  it('§9.3.1 VT-02 L3 table', () => {
    const rows: [number, number, string, string][] = [
      [7.0e6, 0, '3.17e-7', '3.32e-10'],
      [1.0e7, 0.3, '6.22e-7', '3.61e-10'],
      [1.2e7, 0.4, '8.29e-7', '3.66e-10'],
      [2.6e7, 0.74, '2.88e-6', '4.22e-10'],
      [4.2e7, 0, '1.90e-6', '1.35e-10'],
    ];
    for (const [a, e, pr, pv] of rows) {
      const t = vt02L3(scales(MU, a, e));
      check(`VT-02 L3 r a=${String(a)}`, t.position_m, pr);
      check(`VT-02 L3 v a=${String(a)}`, t.velocity_mps, pv);
    }
    // c7 / c8 rows (LEO scale, e = 0.01 and 0.005).
    const c7 = gridCase('c7-near-polar-retrograde').elements;
    const t7 = vt02L3(scales(MU, c7.semiMajorAxis_m, c7.eccentricity));
    check('VT-02 L3 c7 r', t7.position_m, '3.21e-7');
    check('VT-02 L3 c7 v', t7.velocity_mps, '3.34e-10');
  });

  it('§9.3.1 VT-12 L3 table', () => {
    const rows: [number, number, string, string][] = [
      [0.4, 80, '5.08e-14', '4.06e-12'],
      [0.4, 100, '5.08e-14', '5.08e-12'],
      [0.4, 200, '5.08e-14', '1.02e-11'],
      [0, 80.78, '4.93e-14', '3.98e-12'],
      [0.3, 80.78, '5.01e-14', '4.04e-12'],
      [0.74, 80.78, '5.71e-14', '4.61e-12'],
      [0.01, 80.78, '4.93e-14', '3.98e-12'],
    ];
    for (const [e, dv, pRel, pAbs] of rows) {
      const k = 1 / Math.sqrt(1 - e * e);
      check(`VT-12 L3 rel e=${String(e)}`, vt12L3(k), pRel);
      check(`VT-12 L3 abs e=${String(e)} Δv=${String(dv)}`, vt12L3(k) * dv, pAbs);
    }
    // ‖(30, −60, 45)‖ = 80.78 m/s, as printed.
    check('combined ‖Δv‖', Math.hypot(30, -60, 45), '80.78');
  });

  it('§9.3 L3 propagation row at C1, 10T (approved value 5.7e-5 m / 8.9e-8 m/s)', () => {
    const s = scales(MU, 7.0e6, 0);
    const t = propagationL3(s, 10 * s.T);
    check('C1 r', t.position_m, '5.7e-5');
    check('C1 v', t.velocity_mps, '8.9e-8');
  });
});
