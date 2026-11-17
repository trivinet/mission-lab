// Apache ECharts adapter, tree-shaken (core + line + grid + legend + markLine + graphic + canvas).
//
// Gap: one maneuvered series with an explicit gap element ([burn time, null]); connectNulls is
// false so ECharts breaks the line. Marker: series.markLine (labelled). External cursor: a
// `graphic` line updated with setOption (documented, declarative); `?cursor=zr` switches to a
// direct zrender element (`getZr().add`), which is lighter but uses the lower-level API.
import { LineChart } from 'echarts/charts';
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { withGapElement } from '../data.js';

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  GraphicComponent,
  CanvasRenderer,
]);

const GRID = { left: 78, right: 24, top: 44, bottom: 52 };

export const adapter = {
  create(container, input, { width, height, theme, cursorT_s }) {
    const cursorImpl = new URLSearchParams(location.search).get('cursor') ?? 'option';
    const chart = echarts.init(container, null, { renderer: 'canvas', width, height });
    const coastPairs = new Array(input.coast.t.length);
    for (let k = 0; k < coastPairs.length; k += 1)
      coastPairs[k] = [input.coast.t[k], input.coast.y[k]];
    const gap = withGapElement(input);
    const manPairs = new Array(gap.x.length);
    for (let k = 0; k < manPairs.length; k += 1) manPairs[k] = [gap.x[k], gap.y[k]];

    const axisText = { color: theme.text2, fontFamily: theme.font };
    const axis = {
      axisLine: { lineStyle: { color: theme.border } },
      axisLabel: axisText,
      splitLine: { lineStyle: { color: theme.border } },
      nameTextStyle: { color: theme.text2, fontFamily: theme.font, fontSize: 12 },
    };
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: GRID,
      legend: { top: 4, textStyle: { color: theme.text2, fontFamily: theme.font } },
      xAxis: {
        ...axis,
        type: 'value',
        min: 0,
        max: input.tMax_s,
        name: 'Time since epoch (s)',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        ...axis,
        type: 'value',
        scale: true,
        name: `${input.label} (${input.unit})`,
        nameLocation: 'middle',
        nameGap: 58,
      },
      series: [
        {
          name: 'Coast (no maneuver)',
          type: 'line',
          data: coastPairs,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { type: 'dashed', color: theme.coast, width: 1.5 },
          itemStyle: { color: theme.coast },
        },
        {
          name: 'Maneuvered',
          type: 'line',
          data: manPairs,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { type: 'solid', color: theme.maneuver, width: 1.75 },
          itemStyle: { color: theme.maneuver },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: { color: theme.marker, width: 2, type: 'solid' },
            label: {
              formatter: 'Maneuver (burn)',
              color: theme.marker,
              fontFamily: theme.font,
              position: 'insideEndTop',
            },
            data: [{ xAxis: input.burnT_s }],
          },
        },
      ],
    });

    let zrLine = null;
    const place = (t) => {
      const x = chart.convertToPixel({ xAxisIndex: 0 }, t);
      return { x1: x, y1: GRID.top, x2: x, y2: height - GRID.bottom };
    };
    const style = { stroke: theme.cursor, lineWidth: 2 };
    if (cursorImpl === 'zr') {
      zrLine = new echarts.graphic.Line({ shape: place(cursorT_s), style, silent: true, z: 100 });
      chart.getZr().add(zrLine);
    }
    const setCursor = (t) => {
      if (zrLine) {
        zrLine.attr({ shape: place(t) });
      } else {
        chart.setOption({
          graphic: [
            { id: 'time-cursor', type: 'line', shape: place(t), style, silent: true, z: 100 },
          ],
        });
      }
    };
    if (!zrLine) setCursor(cursorT_s);

    return {
      ready: Promise.resolve(),
      setCursor,
      destroy: () => chart.dispose(),
      /** Reads the values ECharts actually holds per series (its data store), gap = null. */
      readback() {
        const model = chart.getModel();
        const out = [];
        for (const si of [0, 1]) {
          const data = model.getSeriesByIndex(si).getData();
          const store = data.getStore();
          const xs = [];
          const ys = [];
          for (let k = 0; k < data.count(); k += 1) {
            const y = store.get(1, k);
            const gapped = Number.isNaN(y);
            xs.push(gapped ? null : store.get(0, k));
            ys.push(gapped ? null : y);
          }
          out.push({ x: xs, y: ys });
        }
        return { coast: out[0], maneuvered: out[1] };
      },
    };
  },
};
