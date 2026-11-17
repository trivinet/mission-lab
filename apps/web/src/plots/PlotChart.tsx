/**
 * One uPlot chart (ADR-010): the series of a PlotModel, axis titles with units, the maneuver
 * marker and the playback cursor. It draws the arrays it is given; display units only change the
 * tick labels (the data stays SI, so what uPlot holds equals the analysis module's output).
 *
 * The playback cursor is a DOM line on the plot area moved from the playback store directly, so a
 * playback tick costs one style write per chart and no React render.
 */
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { displayUnit, fromDeg } from '../format/units';
import { getPlaybackStore } from '../playback/playback-store';
import { registerPlot } from './plot-hook';
import type { PlotHookEntry } from './plot-hook';
import type { PlotModel } from './plot-model';
import { PLOT_COLORS, PLOT_HEIGHT_PX, seriesStyle } from './plot-style';

/** Axis increments for an angle axis, in rad, chosen as round numbers of degrees (ticks only). */
const ANGLE_AXIS_INCREMENTS = [
  1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 45, 60, 90, 180,
].map(fromDeg);

function tickText(value: number): string {
  return String(Number(value.toPrecision(9)));
}

export interface PlotChartProps {
  readonly model: PlotModel;
  /** Id of the text alternative that describes this chart. */
  readonly describedBy: string;
  readonly title: string;
  readonly yLabel: string;
  readonly stale: boolean;
}

export function PlotChart({ model, describedBy, title, yLabel, stale }: PlotChartProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (element === null) {
      return;
    }
    const unit = displayUnit(model.unit);
    const axisBase = {
      stroke: PLOT_COLORS.text2,
      grid: { stroke: PLOT_COLORS.border, width: 1 },
      ticks: { stroke: PLOT_COLORS.border, width: 1 },
      font: `11px ${PLOT_COLORS.font}`,
      labelFont: `12px ${PLOT_COLORS.font}`,
    };
    const u = new uPlot(
      {
        width: Math.max(element.clientWidth, 200),
        height: PLOT_HEIGHT_PX,
        legend: { show: false },
        cursor: { show: false },
        select: { show: false, left: 0, top: 0, width: 0, height: 0 },
        scales: { x: { time: false } },
        axes: [
          {
            ...axisBase,
            label: 'Time since epoch (s)',
            values: (_u, splits) => splits.map((v) => tickText(v)),
          },
          {
            ...axisBase,
            label: yLabel,
            size: 78,
            ...(model.unit === 'rad' ? { incrs: ANGLE_AXIS_INCREMENTS } : {}),
            values: (_u, splits) => splits.map((v) => tickText(unit.fromSi(v))),
          },
        ],
        series: [
          {},
          ...model.series.map((s) => ({
            label: s.label,
            spanGaps: false,
            points: { show: false },
            ...seriesStyle(s.run),
          })),
        ],
        hooks: {
          draw: [
            (chart) => {
              // The maneuver marker: a vertical line with a label, in the marker colour.
              const { left, top, width, height } = chart.bbox;
              const ctx = chart.ctx;
              for (const t of model.maneuverTimes_s) {
                const x = Math.round(chart.valToPos(t, 'x', true));
                if (x < left || x > left + width) {
                  continue;
                }
                ctx.save();
                ctx.strokeStyle = PLOT_COLORS.marker;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + height);
                ctx.stroke();
                ctx.fillStyle = PLOT_COLORS.marker;
                ctx.font = `${String(12 * devicePixelRatio)}px ${PLOT_COLORS.font}`;
                ctx.fillText('Maneuver', x + 6, top + 14 * devicePixelRatio);
                ctx.restore();
              }
            },
          ],
        },
      },
      [model.x, ...model.series.map((s) => s.values)],
      element,
    );

    // The playback cursor (ML-FR-008 AC2): follows the one playback time.
    const line = document.createElement('div');
    line.className = 'plot-cursor';
    line.dataset.testid = 'plot-cursor';
    u.over.appendChild(line);
    const lastX = model.x[model.x.length - 1];
    const firstX = model.x[0];
    let shownT: number | null = null;
    let visible = false;
    const moveCursor = (t_s: number): void => {
      shownT = t_s;
      visible = firstX !== undefined && lastX !== undefined && t_s >= firstX && t_s <= lastX;
      line.style.display = visible ? 'block' : 'none';
      line.dataset.tS = String(t_s);
      if (visible) {
        line.style.left = `${String(u.valToPos(t_s, 'x'))}px`;
      }
    };
    moveCursor(getPlaybackStore().getState().t_s);
    const unsubscribe = getPlaybackStore().subscribe((state, previous) => {
      if (state.t_s !== previous.t_s) {
        moveCursor(state.t_s);
      }
    });

    // The canvas carries no information alone: it is named and described by the text around it.
    const canvas = u.ctx.canvas;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', title);
    canvas.setAttribute('aria-describedby', describedBy);

    const resize = new ResizeObserver(() => {
      const width = element.clientWidth;
      if (width > 0 && width !== u.width) {
        u.setSize({ width, height: PLOT_HEIGHT_PX });
        moveCursor(getPlaybackStore().getState().t_s);
      }
    });
    resize.observe(element);

    const unregister = registerPlot(model.quantity, (): PlotHookEntry => ({
      quantity: model.quantity,
      unit: model.unit,
      x: Array.from(u.data[0] as ArrayLike<number>),
      series: model.series.map((s, i) => {
        const style = seriesStyle(s.run);
        return {
          id: s.id,
          run: s.run,
          segmentIndex: s.segmentIndex,
          piece: s.piece,
          label: s.label,
          plotted: Array.from((u.data[i + 1] ?? []) as ArrayLike<number | null>),
          style: { stroke: style.stroke, dash: style.dash ?? null },
        };
      }),
      // Plain arrays for the test hook (a Float64Array time array does not serialise as one).
      sources: model.sources.map((source) => ({
        ...source,
        t_s: Array.from(source.t_s),
        values: Array.from(source.values),
      })),
      maneuverTimes_s: model.maneuverTimes_s,
      axisLabels: u.axes.map((axis) => (typeof axis.label === 'string' ? axis.label : '')),
      cursor: { t_s: shownT, visible },
    }));

    return () => {
      unregister();
      unsubscribe();
      resize.disconnect();
      u.destroy();
    };
  }, [model, describedBy, title, yLabel]);

  return (
    <div
      ref={host}
      className={stale ? 'plot-host stale' : 'plot-host'}
      data-testid={`plot-${model.quantity}`}
      data-series-count={model.series.length}
    />
  );
}
