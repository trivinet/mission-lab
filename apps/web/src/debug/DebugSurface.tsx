/**
 * Plain, neutral debug surface for the store and the worker (ML-TASK-021). No visual design:
 * the scenario editor is ML-TASK-022 and the visual language is ML-TASK-020. Every element has a
 * data-testid so the e2e tests can drive it.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import { getScenarioStore } from '../state/scenario-store';

function numberFromInput(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

export function DebugSurface() {
  const store = getScenarioStore();
  const scenario = useStore(store, (s) => s.scenario);
  const resultState = useStore(store, (s) => s.resultState);
  const issues = useStore(store, (s) => s.validationIssues);
  const { setName, setDuration_s, setOutputStep_s, run, startNewScenario } = store.getState();
  // Main-thread interaction probe for the ML-UX-003 e2e test: it increments on every click.
  const [pings, setPings] = useState(0);

  const shown =
    resultState.kind === 'current' || resultState.kind === 'stale' ? resultState.result : null;
  const sampleCount =
    shown === null
      ? null
      : shown.segments.reduce((total, segment) => total + segment.t_s.length, 0);
  const diagnostics =
    resultState.kind === 'error'
      ? resultState.diagnostics
      : resultState.kind === 'current'
        ? resultState.warnings
        : [];

  return (
    <section aria-label="Store debug surface" data-testid="debug-surface" className="space-y-3">
      <h2 className="font-semibold">Debug surface (store and worker)</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Name (display only)
          <input
            data-testid="input-name"
            className="border border-neutral-600 bg-neutral-900 px-2 py-1"
            value={scenario.name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col text-sm">
          Duration (s)
          <input
            data-testid="input-duration-s"
            type="number"
            className="border border-neutral-600 bg-neutral-900 px-2 py-1"
            value={Number.isNaN(scenario.duration_s) ? '' : scenario.duration_s}
            onChange={(e) => {
              setDuration_s(numberFromInput(e.target.value));
            }}
          />
        </label>
        <label className="flex flex-col text-sm">
          Output step (s)
          <input
            data-testid="input-output-step-s"
            type="number"
            className="border border-neutral-600 bg-neutral-900 px-2 py-1"
            value={Number.isNaN(scenario.outputStep_s) ? '' : scenario.outputStep_s}
            onChange={(e) => {
              setOutputStep_s(numberFromInput(e.target.value));
            }}
          />
        </label>
        <button
          type="button"
          data-testid="run-button"
          className="border border-neutral-500 px-3 py-1"
          onClick={() => {
            void run();
          }}
        >
          Run
        </button>
        <button
          type="button"
          data-testid="new-scenario-button"
          className="border border-neutral-500 px-3 py-1"
          onClick={startNewScenario}
        >
          New scenario
        </button>
        <button
          type="button"
          data-testid="ping-button"
          className="border border-neutral-500 px-3 py-1"
          onClick={() => {
            setPings((n) => n + 1);
          }}
        >
          Ping (UI probe)
        </button>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 text-sm">
        <dt>Result state</dt>
        <dd data-testid="result-state">{resultState.kind}</dd>
        <dt>Samples</dt>
        <dd data-testid="sample-count">{sampleCount ?? '-'}</dd>
        <dt>Pings</dt>
        <dd data-testid="ping-count">{pings}</dd>
        {resultState.kind === 'error' && (
          <>
            <dt>Error</dt>
            <dd data-testid="error-message">{resultState.message}</dd>
          </>
        )}
      </dl>

      <ul data-testid="diagnostics" aria-label="Diagnostics" className="text-sm">
        {diagnostics.map((d, i) => (
          <li key={i}>
            {d.severity} {d.code}: {d.message}
          </li>
        ))}
      </ul>

      <ul data-testid="validation-issues" aria-label="Validation issues" className="text-sm">
        {Object.entries(issues).flatMap(([path, list]) =>
          list.map((issue, i) => (
            <li key={`${path}-${String(i)}`} data-testid={`issue-${path}`}>
              {path}: {issue.code} {issue.message}
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
