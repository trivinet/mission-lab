/**
 * Checks the transcription of the approved formulas against every evaluated number printed in
 * docs/verification/tolerances.md (revision 3). A printed value with d significant digits is
 * matched within half a unit in its last digit (plus 1e-12 relative for binary64 evaluation).
 */
import { describe, expect, it } from 'vitest';
import {
  bRt,
  bVt,
  dtA,
  dtAlpha,
  dtEval,
  dtG,
  epsT,
  o1Threshold,
  pA,
  pB,
  pE,
  scales,
  U,
  vA,
  vB,
  vE,
  vt02,
  vt03,
  vt04,
  vt05AtZero,
  vt05L2a,
  vt08,
  iHatExactRetrograde,
  E_HAT_EXACT_CIRCULAR,
} from './tolerances';

// μ exactly as written in docs/architecture/proposed-architecture.md §3 and tolerances.md §4.
const MU = 3.986004418e14;

const CASES = {
  C1: scales(MU, 7.0e6, 0),
  C3: scales(MU, 1.0e7, 0.3),
  C4: scales(MU, 1.2e7, 0.4),
  C5: scales(MU, 2.6e7, 0.74),
  C6: scales(MU, 4.2e7, 0),
};
type CaseId = keyof typeof CASES;

function matchesPrinted(value: number, printed: string): boolean {
  const p = Number(printed);
  const mant = printed.toLowerCase().split('e')[0] ?? printed;
  const decimals = (mant.split('.')[1] ?? '').length;
  const expPart = printed.toLowerCase().includes('e')
    ? Number(printed.toLowerCase().split('e')[1])
    : 0;
  const halfUnit = 0.5 * 10 ** (expPart - decimals);
  return Math.abs(value - p) <= halfUnit + 1e-12 * Math.abs(p);
}

function check(label: string, value: number, printed: string): void {
  expect(
    matchesPrinted(value, printed),
    `${label}: computed ${String(value)}, printed ${printed}`,
  ).toBe(true);
}

const tenT = (c: CaseId): number => 10 * CASES[c].T;

describe('tolerance formulas reproduce the approved record (transcription check)', () => {
  it('§4 derived scales and conditioning factors', () => {
    const rows: [CaseId, string, string, string, string, string, string, string, string][] = [
      // case, T, v_p, g_p, h, |E|, κ_E, κ_bv, C_t
      ['C1', '5.829e3', '7.546e3', '8.135', '5.282e10', '2.847e7', '3.0000', '8.0000', '26.50'],
      ['C3', '9.952e3', '8.604e3', '8.135', '6.023e10', '1.993e7', '4.7143', '9.7143', '39.36'],
      ['C4', '1.308e4', '8.804e3', '7.689', '6.339e10', '1.661e7', '5.6667', '10.667', '46.50'],
      ['C5', '4.172e4', '1.013e4', '8.723', '6.847e10', '7.665e6', '14.385', '19.385', '111.9'],
      ['C6', '8.566e4', '3.081e3', '0.2260', '1.294e11', '4.745e6', '3.0000', '8.0000', '26.50'],
    ];
    for (const [c, T, vp, gp, h, E, kE, kbv, Ct] of rows) {
      const s = CASES[c];
      check(`${c} T`, s.T, T);
      check(`${c} vp`, s.vp, vp);
      check(`${c} gp`, s.gp, gp);
      check(`${c} h`, s.h, h);
      check(`${c} E`, s.energy, E);
      check(`${c} kE`, s.kappaE, kE);
      check(`${c} kbv`, s.kappaBV, kbv);
      check(`${c} Ct`, s.Ct, Ct);
    }
    check('C5 kh', CASES.C5.kappaH, '1.4868');
    check('C5 kb', CASES.C5.kappaB, '11.179');
    check('C3 kb', CASES.C3.kappaB, '5.9054');
  });

  it('§6.1 budgets as equivalent coefficients and seconds at Δt = 10T', () => {
    // ε = (A·10T + B/n)/L in units of u; L = 10T + 1/n. Equivalent coefficient = budget/(u L).
    const eq = (c: CaseId, f: (dt: number) => number): number =>
      f(tenT(c)) / (U * (tenT(c) + 1 / CASES[c].n));
    const rows: [CaseId, string, string, string, string, string, string][] = [
      // δt_eval, ε_t, δt_g, δt_res(s), δt_g(s), δt_alpha
      ['C1', '11.9', '24.8', '17.3', '1.63e-10', '1.13e-10', '14.8'],
      ['C3', '21.7', '44.7', '17.4', '5.02e-10', '1.96e-10', '37.7'],
      ['C4', '25.0', '51.4', '17.5', '7.59e-10', '2.58e-10', '51.2'],
      ['C5', '36.4', '74.6', '17.7', '3.51e-9', '8.31e-10', '181.4'],
      ['C6', '11.9', '24.8', '17.3', '2.40e-9', '1.67e-9', '14.8'],
    ];
    for (const [c, ev, et, eg, res, g, al] of rows) {
      const s = CASES[c];
      check(
        `${c} dtEval`,
        eq(c, (dt) => dtEval(s, dt)),
        ev,
      );
      check(
        `${c} epsT`,
        eq(c, (dt) => epsT(s, dt)),
        et,
      );
      check(
        `${c} dtG`,
        eq(c, (dt) => dtG(s, dt)),
        eg,
      );
      check(`${c} res s`, epsT(s, tenT(c)), res);
      check(`${c} g s`, dtG(s, tenT(c)), g);
      check(
        `${c} alpha`,
        eq(c, (dt) => dtAlpha(s, dt)),
        al,
      );
    }
    // O-1 threshold in seconds at 10T
    check('C1 O-1', o1Threshold(CASES.C1, tenT('C1')), '2.60e-10');
    check('C3 O-1', o1Threshold(CASES.C3, tenT('C3')), '9.25e-10');
    check('C4 O-1', o1Threshold(CASES.C4, tenT('C4')), '1.51e-9');
    // Record finding F-1 (l2-references-report.md): the record prints 1.21e-8 s for C5, but its own
    // equivalent coefficient 256.0u gives 256.0 u L = 1.2045e-8 s. The formula is normative (§4);
    // the coefficient and the formula value are checked, the printed seconds value is not.
    check(
      'C5 O-1 coefficient',
      eq('C5', (dt) => o1Threshold(CASES.C5, dt)),
      '256.0',
    );
    check('C5 O-1 formula value', o1Threshold(CASES.C5, tenT('C5')), '1.20e-8');
    check('C6 O-1', o1Threshold(CASES.C6, tenT('C6')), '3.82e-9');
  });

  it('§6.6 evaluated engine and L2a bounds', () => {
    const rows: [CaseId, ...string[]][] = [
      [
        'C1',
        '1.010e-7',
        '1.466e-10',
        '4.732e-6',
        '7.388e-9',
        '1.773e-6',
        '1.904e-9',
        '1.418e-7',
        '2.023e-10',
      ],
      [
        'C3',
        '2.228e-7',
        '2.081e-10',
        '1.434e-5',
        '2.263e-8',
        '4.791e-6',
        '4.412e-9',
        '4.765e-7',
        '6.091e-10',
      ],
      [
        'C4',
        '3.151e-7',
        '2.362e-10',
        '2.199e-5',
        '3.324e-8',
        '7.424e-6',
        '6.284e-9',
        '7.614e-7',
        '9.280e-10',
      ],
      [
        'C5',
        '1.538e-6',
        '5.169e-10',
        '1.344e-4',
        '2.088e-7',
        '5.945e-5',
        '4.944e-8',
        '5.084e-6',
        '6.688e-9',
      ],
      [
        'C6',
        '6.062e-7',
        '5.985e-11',
        '2.839e-5',
        '3.016e-9',
        '1.064e-5',
        '7.772e-10',
        '8.510e-7',
        '8.260e-11',
      ],
    ];
    for (const [c, Pb, Vb, PE, VE, PA, VA, PE0, VE0] of rows) {
      const s = CASES[c];
      const t = tenT(c);
      check(`${c} Pb`, pB(s), Pb ?? '');
      check(`${c} Vb`, vB(s), Vb ?? '');
      check(`${c} PE`, pE(s, t), PE ?? '');
      check(`${c} VE`, vE(s, t), VE ?? '');
      check(`${c} PA`, pA(s, t), PA ?? '');
      check(`${c} VA`, vA(s, t), VA ?? '');
      check(`${c} PE0`, pE(s, 0), PE0 ?? '');
      check(`${c} VE0`, vE(s, 0), VE0 ?? '');
    }
    // δt_A appears only inside P_A/V_A; its formula is covered by the rows above.
    expect(dtA(CASES.C1, 0)).toBeGreaterThan(0);
  });

  it('§7 VT-02, VT-03, VT-04, VT-05, VT-08 evaluated tolerances', () => {
    const vt02Rows: [CaseId, string, string][] = [
      ['C1', '2.11e-7', '2.21e-10'],
      ['C3', '4.15e-7', '2.41e-10'],
      ['C4', '5.53e-7', '2.44e-10'],
      ['C5', '1.92e-6', '2.81e-10'],
      ['C6', '1.27e-6', '9.03e-11'],
    ];
    for (const [c, r, v] of vt02Rows) {
      check(`${c} VT-02 r`, vt02(CASES[c]).position_m, r);
      check(`${c} VT-02 v`, vt02(CASES[c]).velocity_mps, v);
    }
    check('C1 B_rt', bRt(CASES.C1), '200.0');
    check('C1 B_vt', bVt(CASES.C1), '191.5');
    check('C5 B_rt', bRt(CASES.C5), '529.8');
    check('C5 B_vt', bVt(CASES.C5), '477.3');
    const vt03Rows: [CaseId, string, string][] = [
      ['C1', '6.22e-7', '6.42e-10'],
      ['C3', '1.44e-6', '8.91e-10'],
      ['C4', '2.07e-6', '1.00e-9'],
      ['C5', '1.06e-5', '2.15e-9'],
      ['C6', '3.73e-6', '2.62e-10'],
    ];
    for (const [c, r, v] of vt03Rows) {
      check(`${c} VT-03 r`, vt03(CASES[c]).position_m, r);
      check(`${c} VT-03 v`, vt03(CASES[c]).velocity_mps, v);
    }
    // VT-04(a) at C1/C2 scale with i = Math.PI, κ_h = 1: 6.8e-7 m, 7.3e-10 m/s.
    const t04 = vt04(CASES.C1, E_HAT_EXACT_CIRCULAR, iHatExactRetrograde(CASES.C1));
    check('VT-04a r', t04.position_m, '6.8e-7');
    check('VT-04a v', t04.velocity_mps, '7.3e-10');
    const vt05Rows: [CaseId, string, string][] = [
      ['C1', '2.60e-5', '3.72e-8'],
      ['C3', '7.65e-5', '1.08e-7'],
      ['C4', '1.18e-4', '1.58e-7'],
      ['C5', '7.75e-4', '1.03e-6'],
      ['C6', '1.56e-4', '1.52e-8'],
    ];
    for (const [c, r, v] of vt05Rows) {
      check(`${c} VT-05 r`, vt05L2a(CASES[c], tenT(c)).position_m, r);
      check(`${c} VT-05 v`, vt05L2a(CASES[c], tenT(c)).velocity_mps, v);
    }
    check('C1 VT-05(0) r', vt05AtZero(CASES.C1).position_m, '5.7e-7');
    check('C1 VT-05(0) v', vt05AtZero(CASES.C1).velocity_mps, '8.1e-10');
    const vt08Rows: [CaseId, string, string][] = [
      ['C1', '2.45e-5', '3.56e-8'],
      ['C3', '7.31e-5', '1.05e-7'],
      ['C4', '1.13e-4', '1.55e-7'],
      ['C5', '7.51e-4', '1.02e-6'],
      ['C6', '1.47e-4', '1.45e-8'],
    ];
    for (const [c, r, v] of vt08Rows) {
      check(`${c} VT-08 r`, vt08(CASES[c], tenT(c)).position_m, r);
      check(`${c} VT-08 v`, vt08(CASES[c], tenT(c)).velocity_mps, v);
    }
  });
});
