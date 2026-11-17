// uPlot adapter. Canvas 2D renderer, DOM legend, shared x for all series.
//
// Gap: uPlot needs ONE sorted x for all series, so the discontinuity (two samples at the burn
// time with different values) is expressed as two series: "before burn" and "after burn", both
// styled as "Maneuvered", on the coast grid, null elsewhere. A line cannot join two series.
// Marker: canvas drawn in the `draw` hook. External cursor: an absolutely positioned DOM line on
// `u.over` (cheap, independent of the hover crosshair).
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { alignedOnCoastGrid } from '../data.js';

export const adapter = {
  create(container, input, { width, height, theme, cursorT_s }) {
    const { pre, post } = alignedOnCoastGrid(input);
    const data = [input.coast.t, input.coast.y, pre, post];
    const axisBase = {
      stroke: theme.text2,
      grid: { stroke: theme.border, width: 1 },
      ticks: { stroke: theme.border },
      font: `11px ${theme.font}`,
      labelFont: `12px ${theme.font}`,
    };
    const man = { stroke: theme.maneuver, width: 1.75, spanGaps: false, points: { show: false } };
    const opts = {
      width,
      height,
      scales: { x: { time: false } },
      axes: [
        { ...axisBase, label: 'Time since epoch (s)' },
        { ...axisBase, label: `${input.label} (${input.unit})`, size: 70 },
      ],
      series: [
        { label: 'Time (s)' },
        {
          label: 'Coast (no maneuver)',
          stroke: theme.coast,
          width: 1.5,
          dash: [6, 4],
          spanGaps: false,
          points: { show: false },
        },
        { ...man, label: 'Maneuvered (before burn)' },
        { ...man, label: 'Maneuvered (after burn)' },
      ],
      hooks: {
        draw: [
          (u) => {
            // maneuver marker: vertical line + label, in canvas pixels
            const x = Math.round(u.valToPos(input.burnT_s, 'x', true));
            const { left, top, width: w, height: h } = u.bbox;
            if (x < left || x > left + w) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = theme.marker;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + h);
            ctx.stroke();
            ctx.fillStyle = theme.marker;
            ctx.font = `12px ${theme.font}`;
            ctx.fillText('Maneuver (burn)', x + 6, top + 14);
            ctx.restore();
          },
        ],
      },
    };
    const u = new uPlot(opts, data, container);
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;top:0;bottom:0;width:0;border-left:2px solid ${theme.cursor};pointer-events:none`;
    line.dataset.testid = 'time-cursor';
    u.over.appendChild(line);
    const setCursor = (t) => {
      line.style.left = `${u.valToPos(t, 'x')}px`;
    };
    setCursor(cursorT_s);
    return {
      ready: Promise.resolve(),
      setCursor,
      destroy: () => u.destroy(),
      readback() {
        const d = u.data; // the library's own store
        const maneuvered = { x: [], y: [] };
        for (const col of [2, 3]) {
          for (let k = 0; k < d[col].length; k += 1) {
            const v = d[col][k];
            if (v !== null) {
              maneuvered.x.push(d[0][k]);
              maneuvered.y.push(v);
            }
          }
          if (col === 2) {
            maneuvered.x.push(null);
            maneuvered.y.push(null); // the gap between the two series
          }
        }
        return { coast: { x: Array.from(d[0]), y: Array.from(d[1]) }, maneuvered };
      },
    };
  },
};
