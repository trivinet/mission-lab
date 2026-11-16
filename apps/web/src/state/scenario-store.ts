/**
 * The scenario store: one Scenario, the result state, and the validation issues of the last
 * rejected run (ML-FR-001, ML-UX-001, ML-UX-002, ML-UX-003).
 *
 * The store computes no physics. A run builds the request with the engine's own
 * buildSimulationRequest (validation, element-to-state conversion, requestId) and hands it to a
 * runner, which executes the engine in a Web Worker. The main thread never calls runSimulation.
 */
import type { Scenario, ValidationIssue } from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { createBrowserWorkerRunner } from '../worker/worker-runner';
import type { SimulationRunner } from '../worker/worker-runner';
import { newScenario } from './default-scenario';
import { INITIAL_RESULT_STATE, transitionResult } from './result-state';
import type { ResultEvent, ResultState } from './result-state';

/** Validation issues keyed by field path, joined with "." (for example "duration_s"). */
export type FieldIssues = Readonly<Record<string, readonly ValidationIssue[]>>;

export function groupIssuesByPath(issues: readonly ValidationIssue[]): FieldIssues {
  const grouped: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    (grouped[key] ??= []).push(issue);
  }
  return grouped;
}

export interface ScenarioStoreState {
  readonly scenario: Scenario;
  readonly resultState: ResultState;
  /** Issues of the last run that validation prevented; cleared per field when it is edited. */
  readonly validationIssues: FieldIssues;

  /** Display-only: does not make the result stale. */
  setName: (name: string) => void;
  /** Physical: UTC epoch as `YYYY-MM-DDTHH:MM:SS.sssZ`. */
  setEpochIso: (iso: string) => void;
  /** Physical: duration in seconds. */
  setDuration_s: (duration_s: number) => void;
  /** Physical: output step in seconds. */
  setOutputStep_s: (outputStep_s: number) => void;
  /** Replaces the scenario by a fresh default and resets the result (confirmation: ML-TASK-033). */
  startNewScenario: () => void;
  /** Resolves when this run has settled (finished, failed, or been superseded). */
  run: () => Promise<void>;
}

export type ScenarioStore = StoreApi<ScenarioStoreState>;

function withoutKey(issues: FieldIssues, key: string): FieldIssues {
  if (!(key in issues)) {
    return issues;
  }
  return Object.fromEntries(Object.entries(issues).filter(([k]) => k !== key));
}

export function createScenarioStore(runner: SimulationRunner): ScenarioStore {
  let lastRunId = 0;

  return createStore<ScenarioStoreState>()((set, get) => {
    const apply = (event: ResultEvent): void => {
      const next = transitionResult(get().resultState, event);
      if (next !== get().resultState) {
        set({ resultState: next });
      }
    };

    /** A change of a physical field: stale (ML-UX-002). A no-op change changes nothing. */
    const editPhysical = (
      fieldKey: string,
      changed: boolean,
      update: (scenario: Scenario) => Scenario,
    ): void => {
      if (!changed) {
        return;
      }
      set({
        scenario: update(get().scenario),
        validationIssues: withoutKey(get().validationIssues, fieldKey),
      });
      apply({ type: 'PHYSICAL_EDIT' });
    };

    return {
      scenario: newScenario(),
      resultState: INITIAL_RESULT_STATE,
      validationIssues: {},

      setName: (name) => {
        if (name !== get().scenario.name) {
          set({ scenario: { ...get().scenario, name } });
        }
      },
      setEpochIso: (iso) => {
        editPhysical('epoch.iso', iso !== get().scenario.epoch.iso, (s) => ({
          ...s,
          epoch: { scale: s.epoch.scale, iso },
        }));
      },
      setDuration_s: (duration_s) => {
        editPhysical('duration_s', !Object.is(duration_s, get().scenario.duration_s), (s) => ({
          ...s,
          duration_s,
        }));
      },
      setOutputStep_s: (outputStep_s) => {
        editPhysical(
          'outputStep_s',
          !Object.is(outputStep_s, get().scenario.outputStep_s),
          (s) => ({
            ...s,
            outputStep_s,
          }),
        );
      },
      startNewScenario: () => {
        // A run in flight finds no computing state when it returns, so it is ignored.
        set({
          scenario: newScenario(),
          resultState: INITIAL_RESULT_STATE,
          validationIssues: {},
        });
      },

      run: async () => {
        const built = buildSimulationRequest(get().scenario);
        if (!built.ok) {
          // Validation prevents the run; the result state does not change (ML-UX-001).
          set({ validationIssues: groupIssuesByPath(built.issues) });
          return;
        }
        if (Object.keys(get().validationIssues).length > 0) {
          set({ validationIssues: {} });
        }
        lastRunId += 1;
        const runId = lastRunId;
        apply({ type: 'RUN_STARTED', runId });
        const response = await runner(runId, built.value);
        // A superseded or stale run's response finds no matching computing state and is ignored.
        if (response.type === 'result') {
          apply({ type: 'RUN_FINISHED', runId, result: response.result });
        } else {
          apply({ type: 'RUN_CRASHED', runId, message: response.message });
        }
      },
    };
  });
}

let defaultStore: ScenarioStore | undefined;

/** The application's store. The worker is created lazily, on the first run. */
export function getScenarioStore(): ScenarioStore {
  defaultStore ??= createScenarioStore(createBrowserWorkerRunner());
  return defaultStore;
}
