/**
 * The scenario store: one Scenario, the result state, and the validation issues of the last
 * rejected run (ML-FR-001, ML-UX-001, ML-UX-002, ML-UX-003).
 *
 * The store computes no physics. A run builds the request with the engine's own
 * buildSimulationRequest (validation, element-to-state conversion, requestId) and hands it to a
 * runner, which executes the engine in a Web Worker. The main thread never calls runSimulation.
 */
import type {
  ImpulsiveManeuver,
  KeplerianElements,
  Scenario,
  ValidationIssue,
} from '@mission-lab/contracts';
import { buildSimulationRequest } from '@mission-lab/simulation';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { createBrowserWorkerRunner } from '../worker/worker-runner';
import type { SimulationRunner } from '../worker/worker-runner';
import { nextManeuverId } from './maneuver-id';
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
  /** Physical: one Keplerian element, in SI (m, rad; eccentricity dimensionless). */
  setElement: (key: keyof KeplerianElements, value: number) => void;
  /**
   * Physical: appends a maneuver (t = 0 s, Δv = 0 m/s). The M1 one-maneuver limit is enforced by
   * the engine's validation, not here, so a second maneuver is rejected with its message at run.
   */
  addManeuver: () => void;
  /** Physical: sets the time (s since epoch) of the maneuver at `index`. */
  setManeuverTime_s: (index: number, t_s: number) => void;
  /** Physical: sets one RSW component (0 = R, 1 = S, 2 = W) of the maneuver at `index`, m/s. */
  setManeuverDeltaV_mps: (index: number, component: 0 | 1 | 2, value: number) => void;
  /** Physical: removes the maneuver at `index`. */
  removeManeuver: (index: number) => void;
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

function replaceManeuver(
  maneuvers: Scenario['maneuvers'],
  index: number,
  patch: Partial<ImpulsiveManeuver>,
): Scenario['maneuvers'] {
  return maneuvers.map((m, i) => (i === index ? { ...m, ...patch } : m));
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
      setElement: (key, value) => {
        editPhysical(
          `initialOrbit.elements.${key}`,
          !Object.is(value, get().scenario.initialOrbit.elements[key]),
          (s) => ({
            ...s,
            initialOrbit: {
              ...s.initialOrbit,
              elements: { ...s.initialOrbit.elements, [key]: value },
            },
          }),
        );
      },
      addManeuver: () => {
        // A new maneuver is a physical change; clear the stale list-level issue (count limit).
        editPhysical('maneuvers', true, (s) => ({
          ...s,
          maneuvers: [
            ...s.maneuvers,
            {
              id: nextManeuverId(s.maneuvers.map((m) => m.id)),
              t_s: 0,
              frame: 'RSW',
              deltaV_mps: [0, 0, 0],
            },
          ],
        }));
      },
      setManeuverTime_s: (index, t_s) => {
        const current = get().scenario.maneuvers[index];
        editPhysical(
          `maneuvers.${String(index)}.t_s`,
          current !== undefined && !Object.is(current.t_s, t_s),
          (s) => ({ ...s, maneuvers: replaceManeuver(s.maneuvers, index, { t_s }) }),
        );
      },
      setManeuverDeltaV_mps: (index, component, value) => {
        const current = get().scenario.maneuvers[index];
        editPhysical(
          `maneuvers.${String(index)}.deltaV_mps.${String(component)}`,
          current !== undefined && !Object.is(current.deltaV_mps[component], value),
          (s) => {
            const deltaV_mps: [number, number, number] = [0, 0, 0];
            for (const i of [0, 1, 2] as const) {
              deltaV_mps[i] = i === component ? value : (current?.deltaV_mps[i] ?? 0);
            }
            return { ...s, maneuvers: replaceManeuver(s.maneuvers, index, { deltaV_mps }) };
          },
        );
      },
      removeManeuver: (index) => {
        editPhysical('maneuvers', index >= 0 && index < get().scenario.maneuvers.length, (s) => ({
          ...s,
          maneuvers: s.maneuvers.filter((_, i) => i !== index),
        }));
        // Issues of the removed row's fields no longer apply.
        set({
          validationIssues: Object.fromEntries(
            Object.entries(get().validationIssues).filter(([k]) => !k.startsWith('maneuvers.')),
          ),
        });
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
