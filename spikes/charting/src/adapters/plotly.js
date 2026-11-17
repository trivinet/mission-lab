// Plotly adapter, plotly.js-basic-dist-min (scatter, bar, pie only; SVG renderer for lines).
//
// Gap: one maneuvered trace with an explicit gap element whose y is NaN (typed arrays are used,
// so NaN rather than null), connectgaps false. Marker: layout shape + annotation. External cursor:
// a second layout shape moved with Plotly.relayout.
import Plotly from 'plotly.js-basic-dist-min';
import { withGapElement } from '../data.js';

export const adapter = {
  create(container, input, { width, height, theme, cursorT_s }) {
    const gap = withGapElement(input);
    const mx = Float64Array.from(gap.x);
    const my = Float64Array.from(gap.y, (v) => (v === null ? Number.NaN : v));
    const traces = [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Coast (no maneuver)',
        x: input.coast.t,
        y: input.coast.y,
        connectgaps: false,
        line: { color: theme.coast, width: 1.5, dash: 'dash' },
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Maneuvered',
        x: mx,
        y: my,
        connectgaps: false,
        line: { color: theme.maneuver, width: 1.75, dash: 'solid' },
      },
    ];
    const axis = {
      color: theme.text2,
      gridcolor: theme.border,
      linecolor: theme.border,
      zerolinecolor: theme.border,
    };
    const vline = (x, color, width) => ({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      line: { color, width },
    });
    const layout = {
      width,
      height,
      margin: { l: 78, r: 24, t: 36, b: 52 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: theme.text2, family: theme.font, size: 12 },
      xaxis: { ...axis, title: { text: 'Time since epoch (s)' }, range: [0, input.tMax_s] },
      yaxis: { ...axis, title: { text: `${input.label} (${input.unit})` } },
      legend: { orientation: 'h', x: 0, y: 1.12 },
      shapes: [vline(input.burnT_s, theme.marker, 2), vline(cursorT_s, theme.cursor, 2)],
      annotations: [
        {
          x: input.burnT_s,
          xref: 'x',
          y: 1,
          yref: 'paper',
          text: 'Maneuver (burn)',
          showarrow: false,
          xanchor: 'left',
          yanchor: 'top',
          font: { color: theme.marker },
        },
      ],
    };
    const ready = Plotly.newPlot(container, traces, layout, { displayModeBar: false });
    return {
      ready,
      setCursor: (t) => {
        void Plotly.relayout(container, { 'shapes[1].x0': t, 'shapes[1].x1': t });
      },
      destroy: () => Plotly.purge(container),
      readback() {
        const toList = (arr) => Array.from(arr, (v) => (Number.isNaN(v) ? null : v));
        const [coast, man] = container.data; // public gd.data
        return {
          coast: { x: toList(coast.x), y: toList(coast.y) },
          maneuvered: {
            x: Array.from(man.x, (v, k) => (Number.isNaN(man.y[k]) ? null : v)),
            y: toList(man.y),
          },
        };
      },
    };
  },
};
