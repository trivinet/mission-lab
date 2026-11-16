import { buildSimulationRequest, runSimulation } from '@mission-lab/simulation';
import type { Diagnostic, SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { newScenario } from './default-scenario';
import { INITIAL_RESULT_STATE, transitionResult } from './result-state';
import type { ResultEvent, ResultState } from './result-state';

/** A real result from the real engine (the state machine does not look inside it). */
function realResult(): SimulationResult {
  const built = buildSimulationRequest(newScenario());
  if (!built.ok) {
    throw new Error('default scenario rejected');
  }
  const run = runSimulation(built.value);
  if (!run.ok) {
    throw new Error('request rejected');
  }
  return run.value;
}

const result = realResult();
const warning: Diagnostic = {
  severity: 'warning',
  code: 'REFERENCE_SPHERE_INTERSECTION',
  message: 'test warning',
};
const info: Diagnostic = { severity: 'info', code: 'REFERENCE_SPHERE_INTERSECTION', message: 'i' };
const failedResult: SimulationResult = {
  ...result,
  status: 'failed',
  segments: [],
  events: [],
  diagnostics: [{ severity: 'error', code: 'INTERNAL_ERROR', message: 'engine failed here' }],
};

const none: ResultState = { kind: 'none' };
const computing: ResultState = { kind: 'computing', runId: 7 };
const current: ResultState = { kind: 'current', result, warnings: [] };
const stale: ResultState = { kind: 'stale', result };
const error: ResultState = { kind: 'error', diagnostics: [], message: 'x' };

const started = (runId: number): ResultEvent => ({ type: 'RUN_STARTED', runId });
const finished = (runId: number, r: SimulationResult = result): ResultEvent => ({
  type: 'RUN_FINISHED',
  runId,
  result: r,
});
const crashed = (runId: number): ResultEvent => ({ type: 'RUN_CRASHED', runId, message: 'boom' });
const edit: ResultEvent = { type: 'PHYSICAL_EDIT' };

describe('result state machine', () => {
  it('starts in none', () => {
    expect(INITIAL_RESULT_STATE).toEqual(none);
  });

  describe('RUN_STARTED', () => {
    it.each([
      ['none', none],
      ['current', current],
      ['stale', stale],
      ['error', error],
    ])('%s -> computing', (_name, from) => {
      expect(transitionResult(from, started(1))).toEqual({ kind: 'computing', runId: 1 });
    });

    it('computing -> computing with the new run id (supersedes the earlier run)', () => {
      expect(transitionResult(computing, started(8))).toEqual({ kind: 'computing', runId: 8 });
    });
  });

  describe('RUN_FINISHED', () => {
    it('computing -> current, keeping only the warning diagnostics', () => {
      const withDiagnostics: SimulationResult = { ...result, diagnostics: [warning, info] };
      const next = transitionResult(computing, finished(7, withDiagnostics));
      expect(next).toEqual({ kind: 'current', result: withDiagnostics, warnings: [warning] });
    });

    it('computing -> error when the result has status "failed", keeping its diagnostics', () => {
      const next = transitionResult(computing, finished(7, failedResult));
      expect(next).toEqual({
        kind: 'error',
        diagnostics: failedResult.diagnostics,
        message: 'engine failed here',
      });
    });

    it('is ignored for a different run id (superseded run)', () => {
      expect(transitionResult(computing, finished(6))).toBe(computing);
    });

    it.each([
      ['none', none],
      ['current', current],
      ['stale', stale],
      ['error', error],
    ])('is ignored in %s (late result)', (_name, from) => {
      expect(transitionResult(from, finished(7))).toBe(from);
    });
  });

  describe('RUN_CRASHED', () => {
    it('computing -> error with a plain message and no diagnostics', () => {
      expect(transitionResult(computing, crashed(7))).toEqual({
        kind: 'error',
        diagnostics: [],
        message: 'boom',
      });
    });

    it('is ignored for a different run id', () => {
      expect(transitionResult(computing, crashed(1))).toBe(computing);
    });

    it.each([
      ['none', none],
      ['current', current],
      ['stale', stale],
      ['error', error],
    ])('is ignored in %s', (_name, from) => {
      expect(transitionResult(from, crashed(7))).toBe(from);
    });
  });

  describe('PHYSICAL_EDIT', () => {
    it('current -> stale, keeping the old result as stale (never current)', () => {
      expect(transitionResult(current, edit)).toEqual({ kind: 'stale', result });
    });

    it('computing -> stale without a result', () => {
      expect(transitionResult(computing, edit)).toEqual({ kind: 'stale', result: null });
    });

    it.each([
      ['none', none],
      ['stale', stale],
      ['error', error],
    ])('is ignored in %s', (_name, from) => {
      expect(transitionResult(from, edit)).toBe(from);
    });
  });

  it('full path of VE-02: none -> computing -> current -> stale', () => {
    let state = INITIAL_RESULT_STATE;
    const seen = [state.kind];
    for (const event of [started(1), finished(1), edit]) {
      state = transitionResult(state, event);
      seen.push(state.kind);
    }
    expect(seen).toEqual(['none', 'computing', 'current', 'stale']);
  });
});
