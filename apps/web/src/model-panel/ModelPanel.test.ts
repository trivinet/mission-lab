import type { ResultModel, SimulationResult } from '@mission-lab/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResultState } from '../state/result-state';
import { ModelPanel, NOT_QUALIFIED_STATEMENT } from './ModelPanel';

/**
 * AC2: every model field is a sentinel that no code could know. The panel must show each one;
 * if the UI hard-coded any of them, the sentinel would be missing from the markup.
 * The panel reads only `result.model`, so the rest of the result is an empty stand-in.
 */
const SENTINEL_MODEL = {
  engineVersion: 'SENTINEL-ENGINE-9.8.7',
  centralBody: 'SENTINEL-BODY',
  dynamicsModel: 'SENTINEL-DYNAMICS',
  propagator: 'SENTINEL-PROPAGATOR',
  maneuverModel: 'SENTINEL-MANEUVER',
  frame: 'SENTINEL-FRAME',
  epoch: { scale: 'SENTINEL-SCALE', iso: 'SENTINEL-EPOCH-ISO' },
  timeConvention: 'SENTINEL time convention text',
  sampling: { duration_s: 123456.789, outputStep_s: 4321.0987 },
  constants: { mu_m3ps2: 7.7777777e13, referenceRadius_m: 9.9999e6, source: 'SENTINEL-SOURCE' },
  limitations: ['SENTINEL limitation one', 'SENTINEL limitation two', 'SENTINEL limitation three'],
} as unknown as ResultModel;

const RESULT = { model: SENTINEL_MODEL, segments: [], events: [] } as unknown as SimulationResult;

function html(state: ResultState): string {
  return renderToStaticMarkup(createElement(ModelPanel, { resultState: state }));
}

const SENTINEL_VALUES: readonly string[] = [
  'SENTINEL-ENGINE-9.8.7',
  'SENTINEL-BODY',
  'SENTINEL-DYNAMICS',
  'SENTINEL-PROPAGATOR',
  'SENTINEL-MANEUVER',
  'SENTINEL-FRAME',
  'SENTINEL-SCALE',
  'SENTINEL-EPOCH-ISO',
  'SENTINEL time convention text',
  '123456.789',
  '4321.0987',
  '77777777000000',
  '9999900',
  'SENTINEL-SOURCE',
  'SENTINEL limitation one',
  'SENTINEL limitation two',
  'SENTINEL limitation three',
];

describe('ModelPanel (AC2: nothing about the model is hard-coded)', () => {
  it('shows every sentinel value of a current result', () => {
    const out = html({ kind: 'current', result: RESULT, warnings: [] });
    for (const value of SENTINEL_VALUES) {
      expect(out, value).toContain(value);
    }
    expect(out).toContain('data-model="current"');
  });

  it('shows every limitation string as its own list item', () => {
    const out = html({ kind: 'current', result: RESULT, warnings: [] });
    expect(out.match(/data-testid="model-limitation"/g)?.length).toBe(
      SENTINEL_MODEL.limitations.length,
    );
  });

  it('marks a stale result stale and still shows its model', () => {
    const out = html({ kind: 'stale', result: RESULT });
    expect(out).toContain('data-model="stale"');
    expect(out).toContain('data-testid="model-stale"');
    for (const value of SENTINEL_VALUES) {
      expect(out, value).toContain(value);
    }
  });

  it('gives every numeric value its unit', () => {
    const out = html({ kind: 'current', result: RESULT, warnings: [] });
    expect(out).toContain('77777777000000 m³/s²');
    expect(out).toContain('9999900 m<');
    expect(out).toContain('123456.789 s<');
    expect(out).toContain('4321.0987 s<');
  });
});

describe('ModelPanel without a model', () => {
  const states: readonly ResultState[] = [
    { kind: 'none' },
    { kind: 'computing', runId: 1 },
    { kind: 'stale', result: null },
    { kind: 'error', diagnostics: [], message: 'boom' },
  ];
  for (const state of states) {
    it(`shows no model for state ${state.kind}`, () => {
      const out = html(state);
      expect(out).toContain('data-model="absent"');
      expect(out).toContain('data-testid="model-none"');
      expect(out).not.toContain('model-limitation');
      expect(out).not.toContain('data-testid="model-frame"');
    });
  }

  it('says there is no model when there is no result', () => {
    expect(html({ kind: 'none' })).toContain('No model');
  });
});

describe('not-qualified statement (AC3)', () => {
  const states: readonly ResultState[] = [
    { kind: 'none' },
    { kind: 'computing', runId: 1 },
    { kind: 'current', result: RESULT, warnings: [] },
    { kind: 'stale', result: RESULT },
    { kind: 'stale', result: null },
    { kind: 'error', diagnostics: [], message: 'boom' },
  ];
  for (const state of states) {
    it(`is present in state ${state.kind}`, () => {
      const out = html(state);
      expect(out).toContain('data-testid="not-qualified"');
      expect(out).toContain(NOT_QUALIFIED_STATEMENT);
    });
  }
});
