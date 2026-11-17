/**
 * ML-FR-013 AC1: each preset is a scenario file loaded through the same validation function as a
 * user's file, and runs to a current result. No reference values are claimed: the sanity checks on
 * escape and burn-vs-coast come from the analysis module's own output, not from a number written
 * here.
 */
import {
  buildCoastRequest,
  buildSimulationRequest,
  compareCoastAndManeuver,
  runSimulation,
} from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { parseScenarioBytes, parseScenarioText } from '../persistence/scenario-file';
import { loadPreset, PRESETS } from './presets';

describe('presets', () => {
  it('has at least three, with distinct ids and labels', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.label)).size).toBe(PRESETS.length);
  });

  for (const preset of PRESETS) {
    describe(preset.label, () => {
      it('loads through the user-file validation (parseScenarioBytes) with the same outcome', () => {
        const viaPreset = loadPreset(preset);
        const viaFile = parseScenarioBytes(new TextEncoder().encode(preset.fileText));
        expect(viaPreset).toEqual(viaFile);
        expect(viaPreset.ok).toBe(true);
      });

      it('is subject to the same validation: damaged copies of the file are refused', () => {
        const wrongVersion = preset.fileText.replace(
          '"schemaVersion": "1.0"',
          '"schemaVersion": "9.9"',
        );
        const bad = parseScenarioText(wrongVersion);
        expect(bad.ok).toBe(false);
        expect(bad.ok ? '' : bad.failure.kind).toBe('SCHEMA_VERSION');
        const outOfRange = parseScenarioText(
          preset.fileText.replace(/"eccentricity": [^,]+,/, '"eccentricity": 1.5,'),
        );
        expect(outOfRange.ok).toBe(false);
        expect(parseScenarioText('{').ok).toBe(false);
      });

      it('runs to an ok result with the deterministic maneuver id m1', () => {
        const loaded = loadPreset(preset);
        if (!loaded.ok) {
          throw new Error('preset did not load');
        }
        for (const m of loaded.scenario.maneuvers) {
          expect(m.id).toBe('m1');
        }
        const built = buildSimulationRequest(loaded.scenario);
        expect(built.ok).toBe(true);
        if (!built.ok) {
          return;
        }
        const outcome = runSimulation(built.value);
        expect(outcome.ok && outcome.value.status).toBe('ok');
        if (outcome.ok) {
          expect(outcome.value.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
          expect(outcome.value.events).toHaveLength(loaded.scenario.maneuvers.length);
        }
      });
    });
  }

  it('the presets show distinct behaviour (analysis-module output, not reference values)', () => {
    const comparisons = PRESETS.map((preset) => {
      const loaded = loadPreset(preset);
      if (!loaded.ok || loaded.scenario.maneuvers.length === 0) {
        return null;
      }
      const built = buildSimulationRequest(loaded.scenario);
      const coastBuilt = buildCoastRequest(loaded.scenario);
      if (!built.ok || !coastBuilt.ok) {
        throw new Error('request rejected');
      }
      const run = runSimulation(built.value);
      const coast = runSimulation(coastBuilt.value);
      if (!run.ok || !coast.ok) {
        throw new Error('run rejected');
      }
      const compared = compareCoastAndManeuver(coast.value, run.value, built.value);
      return compared.ok ? compared.comparison.maneuvers[0] : undefined;
    });
    expect(comparisons.filter((c) => c === null)).toHaveLength(1);
    const get = (index: number, quantity: string) =>
      comparisons[index]?.rows.find((r) => r.quantity === quantity);
    // The eccentric preset stays closed (a period after the burn).
    expect(get(1, 'period_s')?.after).not.toBeNull();
    // The escape preset leaves a closed orbit: no period, and eccentricity of one or more.
    expect(get(2, 'period_s')?.after).toBeNull();
    expect(get(2, 'eccentricity')?.after ?? 0).toBeGreaterThan(1);
  });
});
