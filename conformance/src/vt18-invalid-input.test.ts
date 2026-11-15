/**
 * VT-18 Invalid input handling (ML-FR-002 AC2, FR-005 AC2, FR-011 AC3), dataset
 * test-data/reference-cases/vt-18/invalid-inputs.json (phase 1). Exact: the multiset of
 * {code, path} equals the expected one; structural via validateScenario (packages/contracts),
 * semantic via validateScenarioSemantics (packages/simulation); a rejected scenario never yields
 * a request (buildSimulationRequest returns the same issues) and so never a result.
 */
import { validateScenario, type Scenario } from '@mission-lab/contracts';
import {
  buildSimulationRequest,
  runSimulation,
  validateScenarioSemantics,
} from '@mission-lab/simulation';
import { applyMutations, decodeValue, type Mutation } from '@mission-lab/verification';
import { describe, expect, it } from 'vitest';
import { loadFamily } from './support/datasets';

interface Vt18Case {
  readonly id: string;
  readonly mutations: readonly Mutation[];
  readonly replaceInput?: unknown;
  readonly layer: 'structural' | 'semantic' | 'accepted';
  readonly expected: readonly { code: string; path: (string | number)[] }[];
  readonly run?: boolean;
}

interface Vt18 {
  readonly inputs: { readonly baseScenario: Scenario; readonly cases: readonly Vt18Case[] };
}

const data = loadFamily('vt-18')[0]?.data as Vt18;

const key = (i: { code: string; path: readonly (string | number)[] }): string =>
  `${i.code} @ ${JSON.stringify(i.path)}`;
const keys = (l: readonly { code: string; path: readonly (string | number)[] }[]): string[] =>
  l.map(key).sort();

describe('VT-18 invalid-input classes: exact code and path; never a result', () => {
  it.each(data.inputs.cases.map((c) => ({ id: c.id, c })))('$id', ({ c }) => {
    const input =
      c.replaceInput !== undefined
        ? decodeValue(c.replaceInput)
        : applyMutations(data.inputs.baseScenario, c.mutations);
    const structural = validateScenario(input);
    const built = buildSimulationRequest(input);
    if (c.layer === 'structural') {
      expect(structural.ok).toBe(false);
      if (!structural.ok) expect(keys(structural.issues)).toEqual(keys(c.expected));
      expect(built.ok).toBe(false);
      if (!built.ok) expect(keys(built.issues)).toEqual(keys(c.expected));
    } else {
      expect(structural.ok, JSON.stringify(structural)).toBe(true);
      if (!structural.ok) return;
      const semantic = validateScenarioSemantics(structural.value);
      expect(keys(semantic)).toEqual(keys(c.expected));
      if (c.layer === 'semantic') {
        expect(built.ok).toBe(false);
        if (!built.ok) expect(keys(built.issues)).toEqual(keys(c.expected));
      } else {
        expect(built.ok, JSON.stringify(built)).toBe(true);
        if (built.ok && c.run === true) {
          const res = runSimulation(built.value);
          expect(res.ok).toBe(true);
          if (res.ok) expect(res.value.status, JSON.stringify(res.value.diagnostics)).toBe('ok');
        }
      }
    }
    // A scenario is not a request: the runner never produces a result from it.
    expect(runSimulation(input).ok).toBe(false);
  });
});
