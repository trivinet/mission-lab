/**
 * VI-01 on the integrated app (ML-TASK-026 part A3): the app's own path, scenario -> store's
 * request builder -> the worker's handler (real engine) -> result, checked against the contract.
 * The engine-level exhaustive checks are in conformance/src/vi01-structure.test.ts; this test
 * shows the same structure holds for what the workspace actually runs, with a maneuver so that
 * there are two segments and one event. It asserts structure and metadata copies, not physics.
 */
import { validateSimulationResult } from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { handleRunMessage } from './run-handler';

describe('VI-01 request -> result structure through the worker handler', () => {
  const scenario = newScenario();
  scenario.maneuvers = [{ id: 'm1', t_s: 3000, frame: 'RSW', deltaV_mps: [0, 10, 0] }];
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error('scenario rejected');
  }
  const request = built.value;
  const { response } = handleRunMessage({ type: 'run', runId: 7, request });
  if (response.type !== 'result') {
    throw new Error('expected a result');
  }
  const result = response.result;

  it('is a contract-valid result for this request', () => {
    expect(validateSimulationResult(result).ok).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.requestId).toBe(request.requestId);
  });

  it('has one segment per maneuver boundary and one event per maneuver', () => {
    expect(result.segments.length).toBe(2);
    expect(result.segments.map((s) => s.index)).toEqual([0, 1]);
    expect(result.events.length).toBe(1);
    expect(result.events[0]?.maneuverId).toBe('m1');
    expect(result.events[0]?.t_s).toBe(3000);
    // The post-maneuver segment starts exactly at the maneuver time (contracts-v1 section 5.2).
    expect(result.segments[1]?.t_s[0]).toBe(3000);
  });

  it('copies the model metadata from the request, field by field', () => {
    expect(result.model.constants).toEqual(request.constants);
    expect(result.model.epoch).toEqual(request.epoch);
    expect(result.model.frame).toBe(request.frame);
    expect(result.model.centralBody).toBe(request.centralBody);
    expect(result.model.dynamicsModel).toBe(request.dynamicsModel);
    expect(result.model.sampling).toEqual({
      duration_s: request.duration_s,
      outputStep_s: request.outputStep_s,
    });
    expect(result.model.engineVersion.length).toBeGreaterThan(0);
    expect(result.model.timeConvention.length).toBeGreaterThan(0);
    expect(result.model.limitations.length).toBeGreaterThan(0);
  });
});
