import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-032 e2e: plots and the coast-vs-maneuver comparison (ML-FR-008 AC2, ML-FR-009,
 * ML-FR-010 AC1, AC2, ML-UX-004).
 *
 * VI-03 (a), plumbing: the values uPlot holds (`u.data`, read through the plot hook) equal the
 * analysis module's output the plot was built from, with Object.is, default and maneuvered,
 * coast run included. This is not a check that the values are physically right (VI-03 (b)).
 * All state is polled, never read once.
 */

interface Source {
  run: 'coast' | 'maneuvered';
  segmentIndex: number;
  t_s: number[];
  values: (number | null)[];
}
interface PlotEntry {
  quantity: string;
  unit: string;
  x: number[];
  series: {
    id: string;
    run: 'coast' | 'maneuvered';
    segmentIndex: number;
    piece: number;
    label: string;
    plotted: (number | null)[];
    style: { stroke: string; dash: number[] | null };
  }[];
  sources: Source[];
  maneuverTimes_s: number[];
  cursor: { t_s: number | null; visible: boolean };
}

async function plots(page: Page): Promise<PlotEntry[]> {
  return page
    .evaluate(
      () =>
        (
          window as unknown as { __missionLabPlots?: { get: () => unknown } }
        ).__missionLabPlots?.get() as PlotEntry[] | undefined,
    )
    .then((entries) => entries ?? []);
}

async function waitForPlots(page: Page, count: number): Promise<PlotEntry[]> {
  await expect.poll(async () => (await plots(page)).length).toBe(count);
  return plots(page);
}

async function openAndRun(page: Page, maneuver: boolean): Promise<void> {
  await page.goto('/?sceneHook=1');
  if (maneuver) {
    await page.getByTestId('add-maneuver').click();
    await page.getByTestId('input-m0-time').fill('3000');
    await page.getByTestId('input-m0-dv-s').fill('100');
  }
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
}

/** Object.is of every plotted value against the module output of its own segment. */
function mismatches(entry: PlotEntry): { compared: number; mismatches: number } {
  let compared = 0;
  let bad = 0;
  for (const source of entry.sources) {
    const own = entry.series.filter(
      (s) => s.run === source.run && s.segmentIndex === source.segmentIndex,
    );
    let plottedCount = 0;
    for (const [k, t] of source.t_s.entries()) {
      const xi = entry.x.findIndex((x) => Object.is(x, t));
      const held = own.map((s) => s.plotted[xi] ?? null).filter((v) => v !== null);
      const expected = source.values[k] ?? null;
      if (expected === null) {
        if (held.length !== 0) {
          bad += 1;
        }
        continue;
      }
      compared += 1;
      plottedCount += 1;
      if (held.length !== 1 || !Object.is(held[0], expected)) {
        bad += 1;
      }
    }
    const total = own.reduce((n, s) => n + s.plotted.filter((v) => v !== null).length, 0);
    if (total !== plottedCount) {
      bad += 1;
    }
  }
  return { compared, mismatches: bad };
}

const toggle = (page: Page, quantity: string) => page.getByTestId(`plot-toggle-${quantity}`);

test('default scenario: three plots, uPlot data equals the module output (VI-03 (a))', async ({
  page,
}) => {
  await openAndRun(page, false);
  const entries = await waitForPlots(page, 3);
  expect(entries.map((e) => e.quantity).sort()).toEqual(
    ['altitude_m', 'speed_mps', 'trueAnomaly_rad'].sort(),
  );
  for (const entry of entries) {
    const { compared, mismatches: bad } = mismatches(entry);
    expect(compared).toBeGreaterThan(100);
    expect(bad).toBe(0);
    // No maneuver: one run, drawn as the coast style, no marker.
    expect(entry.maneuverTimes_s).toEqual([]);
    expect(new Set(entry.series.map((s) => s.run))).toEqual(new Set(['coast']));
  }
  // The angle breaks at its wrap: more than one series for the true anomaly, values unchanged.
  const anomaly = entries.find((e) => e.quantity === 'trueAnomaly_rad');
  expect(anomaly?.series.length).toBeGreaterThan(1);
  // Axis titles carry units.
  await expect(page.getByTestId('plot-figure-altitude_m')).toBeVisible();
  await expect(page.getByTestId('comparison-none')).toBeVisible();
});

test('maneuver: coast and maneuvered in the scene and the plots, VI-03 (a) with the coast', async ({
  page,
}) => {
  await openAndRun(page, true);
  const entries = await waitForPlots(page, 3);
  for (const entry of entries) {
    const { compared, mismatches: bad } = mismatches(entry);
    expect(compared).toBeGreaterThan(200);
    expect(bad).toBe(0);
    expect(entry.maneuverTimes_s).toEqual([3000]);
    const coast = entry.series.filter((s) => s.run === 'coast');
    const maneuvered = entry.series.filter((s) => s.run === 'maneuvered');
    expect(coast.length).toBeGreaterThan(0);
    expect(new Set(maneuvered.map((s) => s.segmentIndex))).toEqual(new Set([0, 1]));
    // Distinct styles: coast dashed grey, maneuvered solid teal.
    expect(coast[0]?.style.dash).not.toBeNull();
    expect(maneuvered[0]?.style.dash).toBeNull();
    expect(coast[0]?.style.stroke).not.toBe(maneuvered[0]?.style.stroke);
    expect(coast[0]?.label).toBe('Coast run');
    expect(maneuvered[0]?.label).toContain('Maneuvered run');
  }
  await expect(page.getByTestId('plot-legend')).toContainText('Coast run (dashed grey)');
  await expect(page.getByTestId('plot-legend')).toContainText('Maneuvered run (solid teal)');
  await expect(page.getByTestId('plot-legend')).toContainText('Maneuver time');

  // The scene shows both trajectories, from the engine arrays, with distinct kinds.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const hook = (
          window as unknown as {
            __missionLabScene?: {
              get: () => {
                segments: { kind: string }[];
                coastSegments: { kind: string }[];
              };
            };
          }
        ).__missionLabScene;
        const state = hook?.get();
        return state === undefined
          ? null
          : {
              run: state.segments.map((s) => s.kind),
              coast: state.coastSegments.map((s) => s.kind),
            };
      }),
    )
    .toEqual({ run: ['maneuvered', 'maneuvered'], coast: ['coast'] });
  await expect(page.getByTestId('scene-summary')).toContainText('Coast run (dashed grey)');
  await expect(page.getByTestId('coast-run-summary')).toBeVisible();
});

test('comparison table: every row, units, the applied delta-v and absent values with reasons', async ({
  page,
}) => {
  await openAndRun(page, true);
  const quantities = [
    'semiMajorAxis_m',
    'eccentricity',
    'inclination_rad',
    'raan_rad',
    'argPeriapsis_rad',
    'periapsisRadius_m',
    'apoapsisRadius_m',
    'period_s',
    'specificEnergy_m2ps2',
  ];
  for (const quantity of quantities) {
    const row = page.getByTestId(`comparison-row-${quantity}`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('cmp-before')).toBeVisible();
    await expect(row.getByTestId('cmp-after')).toBeVisible();
    await expect(row.getByTestId('cmp-difference')).toBeVisible();
    await expect(row.locator('.unit-cell')).not.toHaveText('');
  }
  await expect(page.getByTestId('comparison-row-semiMajorAxis_m').locator('.unit-cell')).toHaveText(
    'km',
  );
  await expect(page.getByTestId('comparison-row-inclination_rad').locator('.unit-cell')).toHaveText(
    'deg',
  );
  // An along-track burn changes a; the difference is a number, not absent.
  await expect(
    page.getByTestId('comparison-row-semiMajorAxis_m').getByTestId('cmp-difference'),
  ).toHaveAttribute('data-value-si', /.+/);
  // Applied delta-v: inertial, RSW and magnitude with units.
  await expect(page.getByTestId('cmp-dv-rsw')).toHaveText('[0, 100, 0] m/s');
  await expect(page.getByTestId('cmp-dv-inertial')).toContainText('m/s');
  await expect(page.getByTestId('cmp-dv-magnitude')).toHaveText('100 m/s');
});

test('comparison table: values that are not defined show n/a with the reason', async ({ page }) => {
  await page.goto('/?sceneHook=1');
  await page.getByTestId('add-maneuver').click();
  await page.getByTestId('input-m0-time').fill('3000');
  // An along-track burn this large leaves a closed orbit: no apoapsis, no period after it.
  await page.getByTestId('input-m0-dv-s').fill('4000');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  const apoapsis = page.getByTestId('comparison-row-apoapsisRadius_m');
  await expect(apoapsis.getByTestId('cmp-after')).toHaveAttribute(
    'data-absent',
    'NOT_CLOSED_ORBIT',
  );
  await expect(apoapsis.getByTestId('cmp-after')).toContainText('n/a');
  await expect(apoapsis.getByTestId('cmp-after')).toContainText('open');
  await expect(apoapsis.getByTestId('cmp-difference')).toHaveAttribute(
    'data-absent',
    'OPERAND_UNAVAILABLE',
  );
  await expect(apoapsis.getByTestId('cmp-before')).toHaveAttribute('data-value-si', /.+/);
});

test('the plot cursor follows the playback time', async ({ page }) => {
  await openAndRun(page, true);
  await waitForPlots(page, 3);
  const cursors = page.getByTestId('plot-cursor');
  await expect.poll(async () => cursors.count()).toBe(3);

  const slider = page.getByTestId('playback-slider');
  await slider.focus();
  await page.keyboard.press('End');
  const end = Number(await slider.inputValue());
  expect(end).toBeGreaterThan(0);
  await expect
    .poll(async () => (await plots(page)).map((e) => e.cursor.t_s))
    .toEqual([end, end, end]);
  for (const cursor of await cursors.all()) {
    await expect(cursor).toHaveAttribute('data-t-s', String(end));
  }

  await page.keyboard.press('Home');
  await expect.poll(async () => (await plots(page)).map((e) => e.cursor.t_s)).toEqual([0, 0, 0]);

  // The cursor-time text alternative reads the same time as the playback read-out.
  await page.getByTestId('playback-maneuver').click();
  await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', '3000');
  const text = page.getByTestId('plot-readout-altitude_m');
  await expect(text).toContainText('At t = 3000 s');
  await expect(text).toContainText('coast run');
  await expect(text).toContainText('maneuvered run');
  await expect(text).toContainText('km');
  await expect
    .poll(async () => (await plots(page)).map((e) => e.cursor.t_s))
    .toEqual([3000, 3000, 3000]);

  // Playing moves the cursor away from 0.
  await page.getByTestId('playback-start').click();
  await page.getByTestId('playback-toggle').click();
  await expect.poll(async () => ((await plots(page))[0]?.cursor.t_s ?? 0) > 0).toBe(true);
});

test('plots are keyboard operable and never start a simulation', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __posts: number }).__posts = 0;
    const original = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage')
      ?.value as Worker['postMessage'];
    Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: never) {
      (window as unknown as { __posts: number }).__posts += 1;
      original.call(this, message, options);
    } as Worker['postMessage'];
  });
  await openAndRun(page, true);
  await waitForPlots(page, 3);
  const posts = () => page.evaluate(() => (window as unknown as { __posts: number }).__posts);
  // One maneuvered request and one coast request.
  expect(await posts()).toBe(2);

  await toggle(page, 'radius_m').focus();
  await expect(toggle(page, 'radius_m')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle(page, 'radius_m')).toBeChecked();
  const withRadius = await waitForPlots(page, 4);
  expect(withRadius.map((e) => e.quantity)).toContain('radius_m');

  await toggle(page, 'altitude_m').focus();
  await page.keyboard.press('Space');
  await expect(toggle(page, 'altitude_m')).not.toBeChecked();
  const afterOff = await waitForPlots(page, 3);
  expect(afterOff.map((e) => e.quantity)).not.toContain('altitude_m');
  expect(await posts()).toBe(2);
});

test('an edit makes the plots stale and a new run replaces them', async ({ page }) => {
  await openAndRun(page, true);
  await waitForPlots(page, 3);
  await page.getByTestId('input-m0-dv-s').fill('120');
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'stale');
  await expect(page.getByTestId('plots-stale-note')).toBeVisible();
  await expect(page.getByTestId('plots-panel')).toHaveAttribute('data-stale', 'true');
  await expect(page.getByTestId('comparison-panel')).toContainText('Stale');
  // The stale pair still shows its old delta-v.
  await expect(page.getByTestId('cmp-dv-rsw')).toHaveText('[0, 100, 0] m/s');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('cmp-dv-rsw')).toHaveText('[0, 120, 0] m/s');
  await expect(page.getByTestId('plots-panel')).toHaveAttribute('data-stale', 'false');
});
