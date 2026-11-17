import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-044 e2e: the pre-release fix package.
 *
 * - D-6: closing or reloading the tab with unsaved changes asks for confirmation (beforeunload);
 *   a clean scenario leaves without one.
 * - D-7: the three columns are named groups; the interactive 3D canvas has a role that signals
 *   interaction and keeps its text alternative.
 * - ML-FR-009 AC2: each plot has axis titles with units, a legend and the maneuver marker.
 *
 * D-2 and D-3 are in sample-warning.spec.ts.
 */

function fireBeforeUnload(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

test.describe('D-6 beforeunload guard', () => {
  test('a synthetic beforeunload is prevented only while there are unsaved changes', async ({
    page,
  }) => {
    await page.goto('/');
    expect(await fireBeforeUnload(page)).toBe(false);
    await page.getByTestId('input-name').fill('edited');
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'true');
    expect(await fireBeforeUnload(page)).toBe(true);
    // Display-only edits count as unsaved changes too (they are in the file); saving clears it.
    const download = page.waitForEvent('download');
    await page.getByTestId('save-button').click();
    await download;
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'false');
    expect(await fireBeforeUnload(page)).toBe(false);
  });

  test('closing the tab with unsaved changes raises the browser dialog; staying keeps the page', async ({
    page,
  }) => {
    await page.goto('/');
    // A real click first: Chromium shows the beforeunload dialog only after user interaction.
    await page.getByTestId('input-name').click();
    await page.getByTestId('input-name').fill('unsaved work');
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'true');

    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      void dialog.dismiss();
    });
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    // Dismissing the dialog means "stay on the page".
    expect(page.isClosed()).toBe(false);
    await expect(page.getByTestId('input-name')).toHaveValue('unsaved work');
  });

  test('closing the tab without unsaved changes shows no dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-name').click();
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'false');
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      void dialog.dismiss();
    });
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => page.isClosed()).toBe(true);
    expect(dialogs).toEqual([]);
  });
});

test.describe('D-7 landmarks and roles', () => {
  test('the three columns are named groups', async ({ page }) => {
    await page.goto('/');
    for (const name of [
      'Scenario editor',
      'Simulation view and analysis',
      'Results and assumptions',
    ]) {
      await expect(page.getByRole('group', { name, exact: true })).toBeVisible();
    }
  });

  test('the interactive 3D canvas has role application and keeps its text alternative', async ({
    page,
  }) => {
    await page.goto('/');
    const canvas = page.getByRole('application', { name: /Orbit view/ });
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('tabindex', '0');
    // The name still says what the view shows and how to operate it.
    await expect(canvas).toHaveAttribute('aria-label', /inertial GCRF axes, \+Z up/);
    await expect(canvas).toHaveAttribute('aria-label', /Arrow keys orbit/);
    await expect(page.getByRole('img', { name: /Orbit view/ })).toHaveCount(0);
    await canvas.focus();
    await expect(canvas).toBeFocused();
  });
});

/** Marker colour of the plots (PLOT_COLORS.marker in src/plots/plot-style.ts), RGB. */
const MARKER_RGB = [255, 180, 84] as const;

test('ML-FR-009 AC2: every plot has axis titles with units, a legend and the maneuver marker', async ({
  page,
}) => {
  await page.goto('/?sceneHook=1');
  await page.getByTestId('add-maneuver').click();
  await page.getByTestId('input-m0-time').fill('3000');
  await page.getByTestId('input-m0-dv-s').fill('100');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');

  // Axis titles: x in seconds, y in the display unit of the quantity (km, km/s, deg). uPlot draws
  // them on its canvas, so they are read back from uPlot's own axes through the plot hook.
  const expectedY: Record<string, string> = {
    altitude_m: 'Altitude (km)',
    speed_mps: 'Speed (km/s)',
    trueAnomaly_rad: 'True anomaly (deg)',
  };
  const hook = await page.evaluate(
    () =>
      (
        window as unknown as {
          __missionLabPlots?: {
            get: () => { quantity: string; maneuverTimes_s: number[]; axisLabels: string[] }[];
          };
        }
      ).__missionLabPlots?.get() ?? [],
  );
  expect(hook.map((e) => e.quantity).sort()).toEqual(Object.keys(expectedY).sort());
  for (const entry of hook) {
    expect(entry.axisLabels).toEqual(['Time since epoch (s)', expectedY[entry.quantity]]);
    expect(entry.maneuverTimes_s).toEqual([3000]);
    await expect(page.getByTestId(`plot-figure-${entry.quantity}`)).toBeVisible();
  }

  // Legend: coast, maneuvered, maneuver marker and playback cursor are all explained.
  const legend = page.getByTestId('plot-legend');
  await expect(legend).toContainText('Coast run (dashed grey)');
  await expect(legend).toContainText('Maneuvered run (solid teal)');
  await expect(legend).toContainText('Maneuver time (amber vertical line)');

  // Marker: the canvas has marker-coloured pixels forming a vertical line (the draw hook's
  // output), not just a legend entry and a time in the data.
  for (const quantity of Object.keys(expectedY)) {
    const tallestColumn = await page
      .getByTestId(`plot-${quantity}`)
      .locator('canvas')
      .evaluate((canvas, rgb) => {
        const c = canvas as HTMLCanvasElement;
        const ctx = c.getContext('2d');
        if (ctx === null) {
          return -1;
        }
        const { width, height } = c;
        const data = ctx.getImageData(0, 0, width, height).data;
        let best = 0;
        for (let x = 0; x < width; x += 1) {
          let count = 0;
          for (let y = 0; y < height; y += 1) {
            const i = (y * width + x) * 4;
            if (
              Math.abs((data[i] ?? 0) - rgb[0]) <= 4 &&
              Math.abs((data[i + 1] ?? 0) - rgb[1]) <= 4 &&
              Math.abs((data[i + 2] ?? 0) - rgb[2]) <= 4
            ) {
              count += 1;
            }
          }
          best = Math.max(best, count);
        }
        return best;
      }, MARKER_RGB);
    // A vertical line across the plot area: at least 60 marker-coloured pixels in one column.
    expect(tallestColumn).toBeGreaterThan(60);
  }
});
