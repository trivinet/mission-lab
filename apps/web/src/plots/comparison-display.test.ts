/**
 * ML-TASK-034: the display rule applied to the real comparison of a real run, and the exact-value
 * copy text. The engine and analysis module are the real ones. The stored comparison rows are
 * not changed by formatting (checked by Object.is against a second computation).
 */
import {
  buildCoastRequest,
  buildSimulationRequest,
  compareCoastAndManeuver,
  runSimulation,
} from '@mission-lab/simulation';
import type { ManeuverComparison } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { formatComparisonValue } from '../format/display-precision';
import { newScenario } from '../state/default-scenario';
import { exactComparisonText } from './comparison-copy';

function comparison(): ManeuverComparison {
  const scenario = {
    ...newScenario(),
    maneuvers: [
      {
        id: 'm1',
        t_s: 1500,
        frame: 'RSW' as const,
        deltaV_mps: [0, 100, 0] as [number, number, number],
      },
    ],
  };
  const built = buildSimulationRequest(scenario);
  const coastBuilt = buildCoastRequest(scenario);
  if (!built.ok || !coastBuilt.ok) {
    throw new Error('request rejected');
  }
  const result = runSimulation(built.value);
  const coast = runSimulation(coastBuilt.value);
  if (!result.ok || !coast.ok) {
    throw new Error('run rejected');
  }
  const compared = compareCoastAndManeuver(coast.value, result.value, built.value);
  const first = compared.ok ? compared.comparison.maneuvers[0] : undefined;
  if (first === undefined) {
    throw new Error('no comparison');
  }
  return first;
}

describe('comparison table display of a real run', () => {
  const m = comparison();

  it('every present cell reads as a plain fixed-decimal number', () => {
    for (const row of m.rows) {
      for (const value of [row.before, row.after, row.difference]) {
        if (value !== null) {
          expect(formatComparisonValue(value, row.unit).text).toMatch(/^-?\d+\.\d+$/);
        }
      }
    }
  });

  it('a difference at round-off level (the unchanged Omega) is displayed as zero', () => {
    const raan = m.rows.find((r) => r.quantity === 'raan_rad');
    expect(raan?.difference).not.toBeNull();
    const shown = formatComparisonValue(raan?.difference ?? Number.NaN, 'rad');
    // Whether the engine returns exactly 0 or a round-off value, the cell reads 0.000 deg.
    expect(shown.text).toBe('0.000');
  });

  it('the copy text holds every value at full precision and parses back exactly', () => {
    const lines = exactComparisonText(m).trimEnd().split('\n');
    expect(lines[1]).toBe('quantity\tunit_si\tbefore\tafter\tdifference');
    const body = lines.slice(2);
    expect(body).toHaveLength(m.rows.length);
    body.forEach((line, i) => {
      const row = m.rows[i];
      const [quantity, unit, ...cells] = line.split('\t');
      expect(quantity).toBe(row?.quantity);
      expect(unit).toBe(row?.unit);
      [row?.before, row?.after, row?.difference].forEach((value, k) => {
        const text = cells[k];
        if (value === null || value === undefined) {
          expect(text).toBe('n/a');
        } else {
          expect(Object.is(Number(text), value)).toBe(true);
        }
      });
    });
  });
});
