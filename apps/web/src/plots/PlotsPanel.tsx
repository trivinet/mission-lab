/**
 * Plots of the analysis histories and the coast-vs-maneuver comparison (ML-FR-009, ML-FR-010,
 * ML-FR-008 AC2, ML-UX-004). Reads the result state and the playback store; never starts a run.
 *
 * The analysis is computed once per result (analysis-model.ts) and the plot data once per result
 * and selected quantity (useMemo); playback ticks only move the cursor lines and update the
 * cursor-time text. Every plot has a text alternative: the values at the cursor time and the
 * comparison table.
 */
import { HISTORY_QUANTITIES } from '@mission-lab/simulation';
import type { HistoryQuantity } from '@mission-lab/simulation';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { displayUnit, formatInputNumber } from '../format/units';
import { getPlaybackStore } from '../playback/playback-store';
import { sceneHookRequested } from '../scene/scene-hook';
import { resultToShow } from '../scene/scene-source';
import { getScenarioStore } from '../state/scenario-store';
import { analyse } from './analysis-model';
import { ComparisonTable } from './ComparisonTable';
import { PlotChart } from './PlotChart';
import { snapshotPlots } from './plot-hook';
import { buildPlotModel, sampleAt } from './plot-model';
import type { PlotModel } from './plot-model';
import { PLOT_COLORS } from './plot-style';
import { HISTORIES_FAILURE_TEXT, HISTORY_LABELS } from './quantity-labels';

const DEFAULT_SELECTION: readonly HistoryQuantity[] = [
  'altitude_m',
  'speed_mps',
  'trueAnomaly_rad',
];

function axisLabel(quantity: HistoryQuantity, unit: string): string {
  const { symbol } = displayUnit(unit);
  // The long name of altitude does not fit beside the axis; the caption keeps the full name.
  const name = quantity === 'altitude_m' ? 'Altitude' : HISTORY_LABELS[quantity];
  return `${name} (${symbol === '' ? 'dimensionless' : symbol})`;
}

/** The values at the playback time as text: the text alternative of one plot. */
function PlotReadout({ model, id }: { model: PlotModel; id: string }) {
  const t_s = useStore(getPlaybackStore(), (s) => s.t_s);
  const { symbol } = displayUnit(model.unit);
  const parts: string[] = [];
  for (const run of ['coast', 'maneuvered'] as const) {
    // At a time shared by two segments (the maneuver time) the later segment is the one shown.
    let held: { t_s: number; value: number | null; segmentIndex: number } | null = null;
    for (const source of model.sources) {
      if (source.run !== run) {
        continue;
      }
      const at = sampleAt(source, t_s);
      if (at !== null) {
        held = { ...at, segmentIndex: source.segmentIndex };
      }
    }
    if (held === null) {
      continue;
    }
    const name = run === 'coast' ? 'coast run' : 'maneuvered run';
    const value =
      held.value === null
        ? 'not defined'
        : `${formatInputNumber(displayUnit(model.unit).fromSi(held.value))}${symbol === '' ? '' : ` ${symbol}`}`;
    parts.push(`${name} ${value} (sample at t = ${formatInputNumber(held.t_s)} s)`);
  }
  const maneuvers =
    model.maneuverTimes_s.length === 0
      ? 'No maneuver.'
      : `Maneuver at t = ${model.maneuverTimes_s.map((t) => formatInputNumber(t)).join(', ')} s.`;
  return (
    <p id={id} className="plot-readout" data-testid={`plot-readout-${model.quantity}`}>
      At t = {formatInputNumber(t_s)} s: {parts.length === 0 ? 'no sample' : parts.join('; ')}.{' '}
      {maneuvers} The comparison table below lists the orbit before and after the maneuver.
    </p>
  );
}

function Legend({ hasManeuver, hasCoastRun }: { hasManeuver: boolean; hasCoastRun: boolean }) {
  return (
    <ul className="plot-legend" aria-label="Plot legend" data-testid="plot-legend">
      <li>
        <svg width="28" height="8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="28"
            y2="4"
            stroke={PLOT_COLORS.coast}
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        </svg>{' '}
        {hasCoastRun
          ? 'Coast run (dashed grey): the same scenario without the maneuver'
          : 'Coast (dashed grey): before any maneuver'}
      </li>
      {hasCoastRun && (
        <li>
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke={PLOT_COLORS.maneuver} strokeWidth="2" />
          </svg>{' '}
          Maneuvered run (solid teal): the scenario with its maneuver
        </li>
      )}
      {hasManeuver && (
        <li>
          <svg width="28" height="10" aria-hidden="true">
            <line x1="14" y1="0" x2="14" y2="10" stroke={PLOT_COLORS.marker} strokeWidth="2" />
          </svg>{' '}
          Maneuver time (amber vertical line)
        </li>
      )}
      <li>
        <svg width="28" height="10" aria-hidden="true">
          <line x1="14" y1="0" x2="14" y2="10" stroke="#6aa9ff" strokeWidth="2" />
        </svg>{' '}
        Playback time (blue vertical line)
      </li>
    </ul>
  );
}

export function PlotsPanel() {
  const resultState = useStore(getScenarioStore(), (s) => s.resultState);
  const [selected, setSelected] = useState<readonly HistoryQuantity[]>(DEFAULT_SELECTION);

  const result = resultToShow(resultState);
  const pair =
    resultState.kind === 'current' || resultState.kind === 'stale' ? resultState.pair : undefined;
  const stale = resultState.kind === 'stale' && result !== null;

  // Once per result (and cached on it): never per frame, never on a display-only change.
  const analysis = useMemo(() => (result === null ? null : analyse(result, pair)), [result, pair]);

  const models = useMemo(() => {
    const histories = analysis?.histories;
    if (analysis === null || !histories?.ok) {
      return [];
    }
    return HISTORY_QUANTITIES.filter(({ quantity }) => selected.includes(quantity)).map(
      ({ quantity, unit }) =>
        buildPlotModel(
          histories.histories,
          analysis.coastHistories?.ok === true ? analysis.coastHistories.histories : null,
          quantity,
          unit,
          analysis.maneuverTimes_s,
        ),
    );
  }, [analysis, selected]);

  useEffect(() => {
    if (!sceneHookRequested(window.location.search)) {
      return;
    }
    window.__missionLabPlots = { get: snapshotPlots };
    return () => {
      delete window.__missionLabPlots;
    };
  }, []);

  const toggle = (quantity: HistoryQuantity, on: boolean): void => {
    setSelected((current) => (on ? [...current, quantity] : current.filter((q) => q !== quantity)));
  };

  const failure = analysis !== null && !analysis.histories.ok ? analysis.histories.reason : null;

  return (
    <>
      <section
        className="panel"
        aria-labelledby="h-plots"
        data-testid="plots-panel"
        data-stale={stale ? 'true' : 'false'}
      >
        <h2 id="h-plots">
          Plots <span className="tag">engine output</span>
        </h2>
        <fieldset className="plot-select">
          <legend>Quantities to plot</legend>
          {HISTORY_QUANTITIES.map(({ quantity }) => (
            <label key={quantity} className="plot-toggle">
              <input
                type="checkbox"
                data-testid={`plot-toggle-${quantity}`}
                checked={selected.includes(quantity)}
                onChange={(e) => {
                  toggle(quantity, e.target.checked);
                }}
              />
              {HISTORY_LABELS[quantity]}
            </label>
          ))}
        </fieldset>
        {result === null && (
          <p className="note">No result yet: run the simulation to see the plots.</p>
        )}
        {failure !== null && (
          <p className="diag err" role="status">
            No plots: {HISTORIES_FAILURE_TEXT[failure]}.
          </p>
        )}
        {analysis !== null && analysis.histories.ok && (
          <>
            {stale && (
              <p className="note" data-testid="plots-stale-note">
                <span aria-hidden="true">&#9670;</span> Stale: the plots show the previous run, not
                the current inputs.
              </p>
            )}
            <Legend
              hasManeuver={analysis.maneuverTimes_s.length > 0}
              hasCoastRun={analysis.coastHistories !== null}
            />
            {models.length === 0 && <p className="note">Select a quantity to plot.</p>}
            <div className="plot-grid">
              {models.map((model) => {
                const textId = `plot-text-${model.quantity}`;
                const title = `${HISTORY_LABELS[model.quantity]} against time`;
                return (
                  <figure
                    key={model.quantity}
                    className="plot-fig"
                    data-testid={`plot-figure-${model.quantity}`}
                  >
                    <figcaption>{title}</figcaption>
                    <PlotChart
                      model={model}
                      describedBy={textId}
                      title={title}
                      yLabel={axisLabel(model.quantity, model.unit)}
                      stale={stale}
                    />
                    <PlotReadout model={model} id={textId} />
                  </figure>
                );
              })}
            </div>
            <p className="note">
              Elements are constant between maneuvers in two-body motion, so their curves are flat;
              the small wiggle is numerical error. An angle line breaks where it wraps past 360 deg.
            </p>
          </>
        )}
      </section>
      <ComparisonTable
        comparison={analysis?.comparison ?? null}
        stale={stale}
        hasResult={result !== null}
      />
    </>
  );
}
