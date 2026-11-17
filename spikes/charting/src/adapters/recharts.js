// Recharts adapter (React 19, SVG). Written with createElement (no JSX transform needed).
//
// Recharts takes one table of rows and draws every <Line> from it, so (like uPlot) the
// maneuvered run is two lines ("before burn" and "after burn") on the coast grid, null where a
// segment is absent; connectNulls is false. Marker: <ReferenceLine x=burn>. External cursor: a
// second <ReferenceLine x=t>, driven by React state (the whole chart re-renders on each update).
// Read-back: Recharts exposes no public accessor for the plotted points, so readback() re-renders
// once with a `dot` render prop that records the value each point is drawn with.
import { createElement as h } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { alignedOnCoastGrid } from '../data.js';

function Chart({ rows, input, theme, width, height, cursorT, collect }) {
  const dotFor = (bucket) =>
    collect
      ? (p) => {
          bucket.set(p.index, [p.payload.t, p.value]);
          return null;
        }
      : false;
  const man = {
    type: 'linear',
    stroke: theme.maneuver,
    strokeWidth: 1.75,
    isAnimationActive: false,
    connectNulls: false,
  };
  return h(
    LineChart,
    { width, height, data: rows, margin: { top: 8, right: 24, left: 8, bottom: 8 } },
    h(CartesianGrid, { stroke: theme.border }),
    h(XAxis, {
      dataKey: 't',
      type: 'number',
      domain: [0, input.tMax_s],
      stroke: theme.text2,
      tick: { fill: theme.text2, fontSize: 11 },
      label: {
        value: 'Time since epoch (s)',
        position: 'insideBottom',
        offset: -4,
        fill: theme.text2,
        fontSize: 12,
      },
      height: 44,
    }),
    h(YAxis, {
      domain: ['auto', 'auto'],
      stroke: theme.text2,
      tick: { fill: theme.text2, fontSize: 11 },
      label: {
        value: `${input.label} (${input.unit})`,
        angle: -90,
        position: 'insideLeft',
        fill: theme.text2,
        fontSize: 12,
        style: { textAnchor: 'middle' },
      },
      width: 70,
    }),
    h(Legend, { verticalAlign: 'top', height: 28 }),
    h(Line, {
      dataKey: 'coast',
      name: 'Coast (no maneuver)',
      type: 'linear',
      stroke: theme.coast,
      strokeWidth: 1.5,
      strokeDasharray: '6 4',
      dot: dotFor(collect?.coast),
      isAnimationActive: false,
      connectNulls: false,
    }),
    h(Line, { ...man, dataKey: 'pre', name: 'Maneuvered', dot: dotFor(collect?.pre) }),
    h(Line, {
      ...man,
      dataKey: 'post',
      name: 'Maneuvered (after burn)',
      legendType: 'none',
      dot: dotFor(collect?.post),
    }),
    h(ReferenceLine, {
      x: input.burnT_s,
      stroke: theme.marker,
      strokeWidth: 2,
      ifOverflow: 'visible',
      label: {
        value: 'Maneuver (burn)',
        fill: theme.marker,
        position: 'insideTopRight',
        fontSize: 12,
      },
    }),
    h(ReferenceLine, { x: cursorT, stroke: theme.cursor, strokeWidth: 2, ifOverflow: 'visible' }),
  );
}

export const adapter = {
  create(container, input, { width, height, theme, cursorT_s }) {
    const { n, pre, post } = alignedOnCoastGrid(input);
    const rows = new Array(n);
    for (let k = 0; k < n; k += 1) {
      rows[k] = { t: input.coast.t[k], coast: input.coast.y[k], pre: pre[k], post: post[k] };
    }
    const root = createRoot(container);
    const props = { rows, input, theme, width, height };
    const render = (cursorT, collect) =>
      flushSync(() => root.render(h(Chart, { ...props, cursorT, collect })));
    let cursorT = cursorT_s;
    const ready = new Promise((resolve) => {
      queueMicrotask(() => {
        render(cursorT);
        resolve();
      });
    });
    return {
      ready,
      setCursor: (t) => {
        cursorT = t;
        render(t);
      },
      destroy: () => root.unmount(),
      readback() {
        const collect = { coast: new Map(), pre: new Map(), post: new Map() };
        render(cursorT, collect);
        const seen = (map) =>
          [...map.entries()]
            .sort((a, b) => a[0] - b[0])
            .map((e) => e[1])
            .filter(([, v]) => v !== null && v !== undefined);
        const coast = seen(collect.coast);
        const preP = seen(collect.pre);
        const postP = seen(collect.post);
        const man = {
          x: [...preP.map((p) => p[0]), null, ...postP.map((p) => p[0])],
          y: [...preP.map((p) => p[1]), null, ...postP.map((p) => p[1])],
        };
        render(cursorT); // back to the normal rendering
        return { coast: { x: coast.map((p) => p[0]), y: coast.map((p) => p[1]) }, maneuvered: man };
      },
    };
  },
};
