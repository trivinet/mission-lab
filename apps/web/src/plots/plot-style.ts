/**
 * Colours and line styles of the plots. Hex values are the approved tokens of
 * docs/design/design-tokens.md (a canvas cannot read CSS variables): coast dashed grey, maneuvered
 * solid teal, maneuver marker amber. The style, not only the colour, tells the runs apart.
 */
import type { RunKind } from './plot-model';

export const PLOT_COLORS = {
  text2: '#a8b3c0', // --text-2
  border: '#2f3b4a', // --border
  coast: '#a8b3c0', // --coast
  maneuver: '#3dd6c6', // --maneuver
  marker: '#ffb454', // --marker
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

export const PLOT_HEIGHT_PX = 220;

export function seriesStyle(run: RunKind): {
  stroke: string;
  width: number;
  dash?: number[];
} {
  return run === 'coast'
    ? { stroke: PLOT_COLORS.coast, width: 1.5, dash: [6, 4] }
    : { stroke: PLOT_COLORS.maneuver, width: 1.75 };
}
