import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * VE-01 (ML-TASK-035): the 13-step release acceptance scenario of ML-SYS-001 section 14 as one
 * end-to-end test, on the built app with the real engine in the worker.
 *
 * This is a FLOW test. It shows that a user can walk the whole scenario and that each step shows
 * an observable outcome. It is not numerical verification: whether the numbers are physically
 * right is the business of the G1 suites and the conformance runs (see
 * docs/verification/ve-01-acceptance.md).
 *
 * All state is polled (expect / expect.poll), never read once. There are no fixed sleeps.
 * The comparison-table values are checked through their presence, structure and the SI value
 * attribute, not through display formatting.
 */

interface WorkerLog {
  requests: { requestId: string; maneuvers: number }[];
  responses: { requestId: string | null }[];
}

interface SceneBits {
  segmentKinds: string[];
  coastKinds: string[];
  /** Hex of the raw bytes of every engine position array, per segment. */
  maneuveredBits: string[];
  coastBits: string[];
  vertexCounts: number[];
  compared: number;
  mismatches: number;
  markerCount: number;
  markerMatchesSegmentEnd: boolean | null;
  stale: boolean;
  resultKind: string;
  firstSample: number[] | null;
  lastSampleOfCoast: number[] | null;
  lastSampleOfRun: number[] | null;
}

/** Records every request posted to the worker and every response message, in the page. */
async function installWorkerLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = { requests: [], responses: [] } as {
      requests: { requestId: string; maneuvers: number }[];
      responses: { requestId: string | null }[];
    };
    (window as unknown as { __workerLog: unknown }).__workerLog = log;
    const seen = new WeakSet<object>();
    const original = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage')
      ?.value as Worker['postMessage'];
    Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: never) {
      const m = message as {
        request?: { requestId?: string; maneuvers?: unknown[] };
      } | null;
      if (m?.request?.requestId !== undefined) {
        log.requests.push({
          requestId: m.request.requestId,
          maneuvers: m.request.maneuvers?.length ?? 0,
        });
      }
      if (!seen.has(this)) {
        seen.add(this);
        this.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as { result?: { requestId?: string } } | null;
          log.responses.push({ requestId: data?.result?.requestId ?? null });
        });
      }
      original.call(this, message, options);
    } as Worker['postMessage'];
  });
}

async function workerLog(page: Page): Promise<WorkerLog> {
  return page.evaluate(() => (window as unknown as { __workerLog: WorkerLog }).__workerLog);
}

async function sceneBits(page: Page): Promise<SceneBits | null> {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __missionLabScene?: {
          get: () => {
            scale: number;
            resultKind: string;
            stale: boolean;
            segments: { kind: string; vertices: Float32Array }[];
            coastSegments: { kind: string; vertices: Float32Array }[];
            maneuverMarkers: { position: Float32Array }[];
            sourcePosition_m: Float64Array[] | null;
            coastSourcePosition_m: Float64Array[] | null;
          };
        };
      }
    ).__missionLabScene;
    if (hook === undefined) {
      return null;
    }
    const s = hook.get();
    const hex = (a: Float64Array): string =>
      Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    let compared = 0;
    let mismatches = 0;
    (s.sourcePosition_m ?? []).forEach((source, n) => {
      const vertices = s.segments[n]?.vertices;
      source.forEach((sample, i) => {
        compared += 1;
        if (!Object.is(vertices?.[i], Math.fround(sample * s.scale))) {
          mismatches += 1;
        }
      });
    });
    const first = s.sourcePosition_m?.[0];
    const lastRunSeg = s.sourcePosition_m?.[s.sourcePosition_m.length - 1];
    const lastCoastSeg = s.coastSourcePosition_m?.[s.coastSourcePosition_m.length - 1];
    const tail = (a: Float64Array | undefined): number[] | null =>
      a === undefined || a.length < 3 ? null : Array.from(a.slice(a.length - 3));
    // The maneuver marker should sit at the end of the pre-maneuver segment (same state).
    const seg0 = s.sourcePosition_m?.[0];
    const marker = s.maneuverMarkers[0];
    let markerMatches: boolean | null = null;
    if (seg0 !== undefined && marker !== undefined && seg0.length >= 3) {
      markerMatches = [0, 1, 2].every((k) =>
        Object.is(marker.position[k], Math.fround((seg0[seg0.length - 3 + k] ?? 0) * s.scale)),
      );
    }
    return {
      segmentKinds: s.segments.map((x) => x.kind),
      coastKinds: s.coastSegments.map((x) => x.kind),
      maneuveredBits: (s.sourcePosition_m ?? []).map(hex),
      coastBits: (s.coastSourcePosition_m ?? []).map(hex),
      vertexCounts: s.segments.map((x) => x.vertices.length),
      compared,
      mismatches,
      markerCount: s.maneuverMarkers.length,
      markerMatchesSegmentEnd: markerMatches,
      stale: s.stale,
      resultKind: s.resultKind,
      firstSample: first === undefined ? null : Array.from(first.slice(0, 3)),
      lastSampleOfCoast: tail(lastCoastSeg),
      lastSampleOfRun: tail(lastRunSeg),
    };
  });
}

interface PlotSnapshot {
  quantity: string;
  runs: string[];
  maneuverTimes_s: number[];
}

async function plotSnapshots(page: Page): Promise<PlotSnapshot[]> {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __missionLabPlots?: {
          get: () => {
            quantity: string;
            series: { run: string }[];
            maneuverTimes_s: number[];
          }[];
        };
      }
    ).__missionLabPlots;
    return (hook?.get() ?? []).map((e) => ({
      quantity: e.quantity,
      runs: [...new Set(e.series.map((x) => x.run))].sort(),
      maneuverTimes_s: e.maneuverTimes_s,
    }));
  });
}

const state = (page: Page) => page.getByTestId('result-state');
const indicator = (page: Page) => page.getByTestId('unsaved-indicator');
const fill = (page: Page, id: string, value: string) => page.getByTestId(`input-${id}`).fill(value);

test('VE-01: the 13-step release acceptance scenario (ML-SYS-001 section 14)', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text());
    }
  });
  await installWorkerLog(page);
  await page.goto('/?sceneHook=1');
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await expect.poll(async () => (await sceneBits(page)) !== null).toBe(true);

  const MANEUVER_T_S = '2400';
  const DURATION_S = '5400';
  const STEP_S = '60';
  const SAMPLES = String(5400 / 60 + 1);
  let firstRunBits: { maneuvered: string[]; coast: string[] } | null = null;
  let firstRunRequestIds: string[] = [];
  let savedText = '';
  let maneuveredSampleCount = '';

  await test.step('1. Create an Earth-centered elliptical orbit', async () => {
    await fill(page, 'name', 'VE-01 acceptance');
    await fill(page, 'duration', DURATION_S);
    await fill(page, 'step', STEP_S);
    await fill(page, 'a', '8000');
    await fill(page, 'e', '0.1');
    await fill(page, 'i', '51.6');
    await fill(page, 'raan', '30');
    await fill(page, 'argp', '60');
    await fill(page, 'nu', '10');
    // What the user sees: the entered elements with their units, the name in the toolbar, and
    // the scenario marked as having unsaved changes.
    await expect(page.getByTestId('input-a')).toHaveValue('8000');
    await expect(page.getByTestId('unit-a')).toHaveText('km');
    await expect(page.getByTestId('input-e')).toHaveValue('0.1');
    await expect(page.getByTestId('input-i')).toHaveValue('51.6');
    await expect(page.getByTestId('scenario-name')).toHaveText('VE-01 acceptance');
    await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');
    await expect(state(page)).toHaveAttribute('data-state', 'none');
    await expect(page.getByTestId('model-none')).toBeVisible();
  });

  await test.step('2. Inspect its orbital elements (derived panel, degeneracy classification)', async () => {
    const panel = page.getByTestId('derived-panel');
    // Hand calculation: r_p = a(1 - e) = 7200 km, r_a = a(1 + e) = 8800 km.
    await expect(panel.getByTestId('derived-perigee-radius')).toContainText('7200 km');
    await expect(panel.getByTestId('derived-apogee-radius')).toContainText('8800 km');
    await expect(panel.getByTestId('derived-period')).toContainText(' s');
    await expect(panel.getByTestId('derived-specific-energy')).toContainText('km²/s²');
    await expect(panel.getByText('computed', { exact: true })).toBeVisible();
    await expect(panel.locator('input')).toHaveCount(0);
    // e = 0.1, i = 51.6 deg: nothing is undefined, so the degeneracy section says so.
    await expect(page.getByTestId('degeneracy')).toHaveAttribute('data-convention', 'NONE');
    await expect(page.getByTestId('degeneracy-undefined')).toHaveText('none');
  });

  await test.step('3. Propagate the orbit for a selected duration', async () => {
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('sample-count')).toHaveText(SAMPLES);
    await expect(page.getByTestId('event-count')).toHaveText('0');
    await expect(page.getByTestId('result-banner')).toHaveCount(0);
    await expect(page.getByTestId('diagnostic')).toHaveCount(0);
    await expect(page.getByTestId('timeline')).toBeVisible();
  });

  await test.step('4. Visualize the unmodified trajectory', async () => {
    await expect.poll(async () => (await sceneBits(page))?.maneuveredBits.length).toBe(1);
    const bits = await sceneBits(page);
    expect(bits?.resultKind).toBe('current');
    expect(bits?.vertexCounts).toEqual([Number(SAMPLES) * 3]);
    // Exactness through the hook: every drawn vertex is the engine sample scaled and rounded.
    expect(bits?.compared).toBe(Number(SAMPLES) * 3);
    expect(bits?.mismatches).toBe(0);
    expect(bits?.markerCount).toBe(0);
    expect(bits?.coastKinds).toEqual([]);
    await expect(page.getByTestId('segment-summary-0')).toContainText(`${SAMPLES} samples`);
    await expect(page.getByTestId('scene-summary')).toBeVisible();
    await expect(page.getByTestId('comparison-none')).toBeVisible();
    await expect(page.getByTestId('coast-run-summary')).toHaveCount(0);
  });

  await test.step('5. Define an impulsive RSW maneuver', async () => {
    await page.getByTestId('add-maneuver').click();
    await page.getByTestId('input-m0-time').fill(MANEUVER_T_S);
    await page.getByTestId('input-m0-dv-r').fill('0');
    await page.getByTestId('input-m0-dv-s').fill('100');
    await page.getByTestId('input-m0-dv-w').fill('0');
    await expect(page.getByTestId('maneuver-0')).toBeVisible();
    await expect(page.getByTestId('input-m0-dv-s')).toHaveValue('100');
    await expect(page.getByTestId('rsw-note')).toContainText('RSW');
    // The edit is physical: the shown trajectory is now the previous one, marked stale.
    await expect(state(page)).toHaveAttribute('data-state', 'stale');
    await expect.poll(async () => (await sceneBits(page))?.stale).toBe(true);
    await expect(page.getByTestId('scene-stale-chip')).toBeVisible();
  });

  await test.step('6. Execute the maneuver', async () => {
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('event-count')).toHaveText('1');
    // The maneuver instant is a sample of both segments, so the maneuvered run has at least as
    // many samples as the coast one.
    maneuveredSampleCount = (await page.getByTestId('sample-count').textContent()) ?? '';
    expect(Number(maneuveredSampleCount)).toBeGreaterThanOrEqual(Number(SAMPLES));
    await expect(page.getByTestId('dv-total-0')).toContainText('100');
    await expect(page.getByTestId('dv-total-0')).toContainText('m/s');
    await expect(page.getByTestId('diagnostic')).toHaveCount(0);
  });

  await test.step('7. Visualize the resulting trajectory and the maneuver location', async () => {
    await expect.poll(async () => (await sceneBits(page))?.maneuveredBits.length).toBe(2);
    await expect.poll(async () => (await sceneBits(page))?.markerCount).toBe(1);
    const bits = await sceneBits(page);
    // Before and after the burn are two segments, never joined.
    expect(bits?.segmentKinds).toEqual(['maneuvered', 'maneuvered']);
    expect(bits?.mismatches).toBe(0);
    expect(bits?.compared).toBeGreaterThan(0);
    // The marker is drawn where the pre-maneuver segment ends.
    expect(bits?.markerMatchesSegmentEnd).toBe(true);
    await expect(page.getByTestId('segment-summary-0')).toBeVisible();
    await expect(page.getByTestId('segment-summary-1')).toBeVisible();
    // Playback can jump to the maneuver and the read-out shows its time.
    await page.getByTestId('playback-maneuver').click();
    await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', MANEUVER_T_S);
  });

  await test.step('8. Inspect changes in orbital parameters (plots and comparison table)', async () => {
    await expect.poll(async () => (await plotSnapshots(page)).length).toBe(3);
    const plots = await plotSnapshots(page);
    expect(plots.map((p) => p.quantity).sort()).toEqual(
      ['altitude_m', 'speed_mps', 'trueAnomaly_rad'].sort(),
    );
    for (const plot of plots) {
      expect(plot.maneuverTimes_s).toEqual([Number(MANEUVER_T_S)]);
    }
    await expect(page.getByTestId('plot-figure-altitude_m')).toBeVisible();
    await expect(page.getByTestId('plot-legend')).toContainText('Maneuver time');

    await expect(page.getByTestId('comparison-maneuver')).toHaveCount(1);
    await expect(page.getByTestId('comparison-table')).toBeVisible();
    for (const quantity of [
      'semiMajorAxis_m',
      'eccentricity',
      'inclination_rad',
      'raan_rad',
      'argPeriapsis_rad',
      'periapsisRadius_m',
      'apoapsisRadius_m',
      'period_s',
      'specificEnergy_m2ps2',
    ]) {
      const row = page.getByTestId(`comparison-row-${quantity}`);
      await expect(row).toBeVisible();
      await expect(row.getByTestId('cmp-before')).toBeVisible();
      await expect(row.getByTestId('cmp-after')).toBeVisible();
      await expect(row.getByTestId('cmp-difference')).toBeVisible();
    }
    // Structure and sign only, not display formatting. A prograde (along-track) burn raises the
    // semi-major axis, the period and the specific energy; the plane (inclination, RAAN) is
    // untouched to rounding only in the engine's own terms, so it is not asserted here.
    for (const quantity of ['semiMajorAxis_m', 'period_s', 'specificEnergy_m2ps2']) {
      const diff = page.getByTestId(`comparison-row-${quantity}`).getByTestId('cmp-difference');
      await expect(diff).toHaveAttribute('data-value-si', /^-?\d/);
      const value = Number((await diff.getAttribute('data-value-si')) ?? 'NaN');
      expect(value, quantity).toBeGreaterThan(0);
    }
    await expect(page.getByTestId('cmp-dv-rsw')).toContainText('100');
    await expect(page.getByTestId('cmp-dv-magnitude')).toContainText('100');
    await expect(page.getByTestId('cmp-dv-inertial')).toContainText('m/s');
  });

  await test.step('9. Compare both simulations (coast and maneuvered together)', async () => {
    await expect.poll(async () => (await sceneBits(page))?.coastBits.length).toBe(1);
    const bits = await sceneBits(page);
    expect(bits?.coastKinds).toEqual(['coast']);
    expect(bits?.segmentKinds).toEqual(['maneuvered', 'maneuvered']);
    // Same initial state: the two runs start at the same position, then diverge.
    const coastFirst = await page.evaluate(() => {
      const hook = (
        window as unknown as {
          __missionLabScene: {
            get: () => { coastSourcePosition_m: Float64Array[] | null };
          };
        }
      ).__missionLabScene;
      const a = hook.get().coastSourcePosition_m?.[0];
      return a === undefined ? null : Array.from(a.slice(0, 3));
    });
    expect(coastFirst).toEqual(bits?.firstSample);
    expect(bits?.lastSampleOfCoast).not.toBeNull();
    expect(bits?.lastSampleOfCoast).not.toEqual(bits?.lastSampleOfRun);

    await expect(page.getByTestId('coast-run-summary')).toBeVisible();
    await expect(page.getByTestId('scene-summary')).toContainText('Coast run (dashed grey)');
    await expect(page.getByTestId('plot-legend')).toContainText('Coast run (dashed grey)');
    await expect(page.getByTestId('plot-legend')).toContainText('Maneuvered run (solid teal)');
    await expect
      .poll(async () => (await plotSnapshots(page)).map((p) => p.runs.join('+')))
      .toEqual(['coast+maneuvered', 'coast+maneuvered', 'coast+maneuvered']);

    // Keep this run for step 12 (two requests: maneuvered and coast).
    const maneuveredBits = bits?.maneuveredBits ?? [];
    const coastBits = bits?.coastBits ?? [];
    firstRunBits = { maneuvered: maneuveredBits, coast: coastBits };
    await expect
      .poll(async () => (await workerLog(page)).responses.length)
      .toBeGreaterThanOrEqual(3);
    const log = await workerLog(page);
    // The last two requests are the maneuvered run and its coast twin.
    firstRunRequestIds = log.requests.slice(-2).map((r) => r.requestId);
    expect(new Set(firstRunRequestIds).size).toBe(2);
    expect(
      log.requests
        .slice(-2)
        .map((r) => r.maneuvers)
        .sort(),
    ).toEqual([0, 1]);
  });

  await test.step('10. Save the scenario to a versioned JSON file', async () => {
    // The scenario has been edited since it was created and never saved.
    await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('save-button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^VE-01.acceptance.scenario.json$/);
    savedText = readFileSync(await download.path(), 'utf8');
    const file = JSON.parse(savedText) as {
      schemaVersion: string;
      name: string;
      maneuvers: { t_s: number; deltaV_mps: number[] }[];
      initialOrbit: { elements: { semiMajorAxis_m: number; eccentricity: number } };
    };
    expect(file.schemaVersion).toBe('1.0');
    expect(file.name).toBe('VE-01 acceptance');
    expect(file.maneuvers).toHaveLength(1);
    expect(file.maneuvers[0]?.t_s).toBe(Number(MANEUVER_T_S));
    expect(file.maneuvers[0]?.deltaV_mps).toEqual([0, 100, 0]);
    expect(file.initialOrbit.elements.semiMajorAxis_m).toBe(8_000_000);
    expect(file.initialOrbit.elements.eccentricity).toBe(0.1);
    await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');
    await expect(indicator(page)).toHaveText('No unsaved changes');
  });

  await test.step('11. Reload the scenario', async () => {
    // Replace the workspace with a different scenario, then load the saved file.
    await page.getByTestId('new-scenario-button').click();
    await expect(page.getByTestId('confirm-dialog')).toBeHidden();
    await expect(page.getByTestId('input-name')).toHaveValue('New scenario');
    await expect(page.getByTestId('maneuver-0')).toHaveCount(0);
    await expect(state(page)).toHaveAttribute('data-state', 'none');

    await page.getByTestId('load-input').setInputFiles({
      name: 'VE-01 acceptance.scenario.json',
      mimeType: 'application/json',
      buffer: Buffer.from(savedText, 'utf8'),
    });
    await expect(page.getByTestId('input-name')).toHaveValue('VE-01 acceptance');
    await expect(page.getByTestId('scenario-name')).toHaveText('VE-01 acceptance');
    await expect(page.getByTestId('input-a')).toHaveValue('8000');
    await expect(page.getByTestId('input-e')).toHaveValue('0.1');
    await expect(page.getByTestId('input-i')).toHaveValue('51.6');
    await expect(page.getByTestId('input-duration')).toHaveValue(DURATION_S);
    await expect(page.getByTestId('input-m0-time')).toHaveValue(MANEUVER_T_S);
    await expect(page.getByTestId('input-m0-dv-s')).toHaveValue('100');
    await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');
    // A loaded scenario has no result yet: nothing is shown as current for it.
    await expect(state(page)).toHaveAttribute('data-state', 'none');
    await expect.poll(async () => (await sceneBits(page))?.maneuveredBits.length).toBe(0);
    // Saving again reproduces the file exactly.
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('save-button').click();
    const again = readFileSync(await (await downloadPromise).path(), 'utf8');
    expect(again).toBe(savedText);
  });

  await test.step('12. Confirm reproducibility of the result', async () => {
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('event-count')).toHaveText('1');
    await expect.poll(async () => (await sceneBits(page))?.coastBits.length).toBe(1);
    await expect.poll(async () => (await sceneBits(page))?.maneuveredBits.length).toBe(2);
    await expect
      .poll(async () => (await workerLog(page)).requests.length)
      .toBeGreaterThanOrEqual(4);
    const bits = await sceneBits(page);
    expect(firstRunBits).not.toBeNull();
    // Bit-identical samples: the raw bytes of every engine position array, both runs.
    expect(bits?.maneuveredBits).toEqual(firstRunBits?.maneuvered);
    expect(bits?.coastBits).toEqual(firstRunBits?.coast);
    expect(bits?.mismatches).toBe(0);
    // Same requestIds (the identity of the request) for the maneuvered and the coast run, and
    // every response echoes the id of a request that was posted.
    const log = await workerLog(page);
    const secondRunRequestIds = log.requests.slice(-2).map((r) => r.requestId);
    expect([...secondRunRequestIds].sort()).toEqual([...firstRunRequestIds].sort());
    for (const id of secondRunRequestIds) {
      expect(log.responses.map((r) => r.requestId)).toContain(id);
    }
    await expect(page.getByTestId('sample-count')).toHaveText(maneuveredSampleCount);
  });

  await test.step('13. Inspect the physical model, reference frame and calculation metadata', async () => {
    const panel = page.getByTestId('model-panel');
    await expect(panel).toHaveAttribute('data-model', 'current');
    for (const id of [
      'dynamics',
      'central-body',
      'mu',
      'radius',
      'constants-source',
      'propagator',
      'maneuver-model',
      'frame',
      'epoch',
      'time-convention',
      'engine-version',
      'duration',
      'output-step',
    ]) {
      const cell = page.getByTestId(`model-${id}`);
      await expect(cell, id).toBeVisible();
      await expect(cell, id).not.toHaveText('');
    }
    await expect(page.getByTestId('model-frame')).toHaveText('GCRF');
    await expect(page.getByTestId('model-duration')).toContainText(DURATION_S);
    await expect(page.getByTestId('model-output-step')).toContainText(STEP_S);
    await expect(page.getByTestId('model-maneuver-model')).not.toHaveText('');
    await expect.poll(async () => page.getByTestId('model-limitation').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('not-qualified')).toContainText(
      'Not qualified for operational use',
    );
    await expect(page.getByTestId('earth-orientation-label')).toContainText('illustrative');
  });

  expect(consoleErrors).toEqual([]);
});
