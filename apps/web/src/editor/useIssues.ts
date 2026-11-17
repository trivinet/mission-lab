import { useMemo } from 'react';
import type { ValidationIssue } from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { useStore } from 'zustand';
import { getScenarioStore } from '../state/scenario-store';

/**
 * The engine's validation issues for the scenario as it is now, field by field, as the user
 * types. This is the same `buildSimulationRequest` that `run()` uses, so the live messages and the
 * run's rejection can never disagree. Validation prevents the run; it never changes the result
 * state (ML-UX-001).
 */
export function useLiveIssues(): readonly ValidationIssue[] {
  const scenario = useStore(getScenarioStore(), (s) => s.scenario);
  return useMemo(() => {
    const built = buildSimulationRequest(scenario);
    return built.ok ? [] : built.issues;
  }, [scenario]);
}
