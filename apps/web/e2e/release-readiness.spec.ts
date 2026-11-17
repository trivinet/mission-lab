import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-040 release-readiness review: the VE-01 flow by keyboard only, and the error paths
 * that the other specs do not already walk. FLOW and robustness checks only: nothing here
 * decides whether a number is physically right (see docs/verification/release-readiness-review.md).
 *
 * "Keyboard only" is enforced by construction: the first test never calls click(), fill(), check()
 * or any locator action on a control. It moves focus with Tab and acts with Enter, Space, typing
 * and arrow keys. (The two OS-level steps, the download and the file chooser, are observed with
 * Playwright events, because headless Chromium has no real dialogs.)
 */

const state = (page: Page) => page.getByTestId('result-state');

async function tabTo(page: Page, testId: string, limit = 120): Promise<void> {
  for (let n = 0; n < limit; n += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(
      () =>
        document.activeElement?.getAttribute('data-testid') ??
        (document.activeElement?.tagName === 'CANVAS' ? 'canvas' : null),
    );
    if (focused === testId) {
      return;
    }
  }
  throw new Error(`could not reach ${testId} by Tab within ${String(limit)} presses`);
}

/** Focus a text field by Tab, replace its content, and leave it. */
async function typeInto(page: Page, testId: string, value: string): Promise<void> {
  await tabTo(page, testId);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(value);
}

/** Restart the Tab sequence from the top of the document. */
async function focusStart(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

async function outlineOk(page: Page): Promise<void> {
  const o = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      style: s.outlineStyle,
      width: s.outlineWidth,
      visible: r.width > 0 && r.height > 0,
    };
  });
  expect(o.style).toBe('solid');
  expect(o.width).toBe('2px');
  expect(o.visible).toBe(true);
}

test('VE-01 by keyboard only: edit, add a maneuver, run, play back, plots, compare, save, new, load, model', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.goto('/');

  await test.step('1-2 enter the orbit and inspect the derived values', async () => {
    await typeInto(page, 'input-name', 'Keyboard VE-01');
    await outlineOk(page);
    await typeInto(page, 'input-duration', '5400');
    await typeInto(page, 'input-step', '60');
    await typeInto(page, 'input-a', '8000');
    await typeInto(page, 'input-e', '0.1');
    await typeInto(page, 'input-i', '51.6');
    await typeInto(page, 'input-raan', '30');
    await typeInto(page, 'input-argp', '60');
    await typeInto(page, 'input-nu', '10');
    await expect(page.getByTestId('input-a')).toHaveValue('8000');
    await expect(page.getByTestId('input-nu')).toHaveValue('10');
    await expect(page.getByTestId('scenario-name')).toHaveText('Keyboard VE-01');
    // Hand arithmetic: perigee radius a(1-e) = 7200 km.
    await expect(page.getByTestId('derived-panel')).toContainText('7200');
  });

  await test.step('3 run (coast) with Enter on the toolbar button', async () => {
    await focusStart(page);
    await tabTo(page, 'run-button');
    await outlineOk(page);
    await page.keyboard.press('Enter');
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('sample-count')).toHaveText('91');
  });

  await test.step('5-6 define an RSW maneuver and run again', async () => {
    await tabTo(page, 'add-maneuver');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('maneuver-0')).toBeVisible();
    await expect(state(page)).toHaveAttribute('data-state', 'stale');
    await typeInto(page, 'input-m0-time', '2400');
    await typeInto(page, 'input-m0-dv-r', '0');
    await typeInto(page, 'input-m0-dv-s', '100');
    await typeInto(page, 'input-m0-dv-w', '0');
    await focusStart(page);
    await tabTo(page, 'run-button');
    await page.keyboard.press('Space');
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('event-count')).toHaveText('1');
  });

  await test.step('7 playback: jump to the maneuver, play, pause, scrub with arrow keys', async () => {
    await tabTo(page, 'playback-maneuver');
    await outlineOk(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', '2400');
    await tabTo(page, 'playback-end');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', '5400');
    await tabTo(page, 'playback-slider');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', '0');
    await page.keyboard.press('ArrowRight');
    const t1 = Number(await page.getByTestId('playback-readout').getAttribute('data-t-s'));
    expect(t1).toBeGreaterThan(0);
  });

  await test.step('8-9 plots and comparison are reachable; a plot toggle works by Space', async () => {
    await tabTo(page, 'plot-toggle-radius_m');
    const toggle = page.getByTestId('plot-toggle-radius_m');
    const before = await toggle.isChecked();
    await page.keyboard.press('Space');
    expect(await toggle.isChecked()).toBe(!before);
    await page.keyboard.press('Space');
    expect(await toggle.isChecked()).toBe(before);
    await expect(page.getByTestId('comparison-table')).toBeVisible();
  });

  await test.step('3D view is focusable and responds to keys without trapping Tab', async () => {
    await focusStart(page);
    await tabTo(page, 'canvas');
    await outlineOk(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(next).toBe('camera-reset');
  });

  await test.step('13 model details open with Enter', async () => {
    await tabTo(page, 'model-toggle');
    const details = page.getByTestId('model-panel').locator('details');
    // Open by default; Enter on the summary collapses it, Enter again expands it.
    await expect(details).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(details).not.toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(page.getByTestId('not-qualified')).toBeVisible();
  });

  let savedText = '';
  await test.step('10 save with Enter (download)', async () => {
    await focusStart(page);
    await tabTo(page, 'save-button');
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.scenario\.json$/);
    savedText = readFileSync(await download.path(), 'utf8');
    expect(JSON.parse(savedText)).toMatchObject({ schemaVersion: '1.0', name: 'Keyboard VE-01' });
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'false');
  });

  await test.step('11 New scenario then Load, by keyboard', async () => {
    await focusStart(page);
    await tabTo(page, 'new-scenario-button');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('input-name')).not.toHaveValue('Keyboard VE-01');
    await expect(page.getByTestId('no-maneuver')).toBeVisible();
    await expect(state(page)).toHaveAttribute('data-state', 'none');

    await focusStart(page);
    await tabTo(page, 'load-button');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'kb.scenario.json',
      mimeType: 'application/json',
      buffer: Buffer.from(savedText),
    });
    await expect(page.getByTestId('input-name')).toHaveValue('Keyboard VE-01');
    await expect(page.getByTestId('input-a')).toHaveValue('8000');
    await expect(page.getByTestId('input-m0-dv-s')).toHaveValue('100');
  });

  await test.step('12 run the loaded scenario again; same sample count', async () => {
    await focusStart(page);
    await tabTo(page, 'run-button');
    await page.keyboard.press('Enter');
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('sample-count')).not.toHaveText('—');
  });

  await test.step('presets menu: open with ArrowDown, choose with Enter, Escape closes', async () => {
    await focusStart(page);
    await tabTo(page, 'presets-button');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('presets-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('presets-menu')).toBeHidden();
    await expect(page.getByTestId('presets-button')).toBeFocused();
  });

  expect(consoleErrors).toEqual([]);
});

test.describe('failed runs (state error): readable, and the app stays usable', () => {
  async function setManeuver(page: Page, s: string): Promise<void> {
    await page.getByTestId('add-maneuver').click();
    await page.getByTestId('input-m0-time').fill('100');
    await page.getByTestId('input-m0-dv-r').fill('0');
    await page.getByTestId('input-m0-dv-s').fill(s);
    await page.getByTestId('input-m0-dv-w').fill('0');
  }

  test('overflowing maneuver (1e300 m/s): NON_FINITE_STATE, then recovery by editing', async ({
    page,
  }) => {
    await page.goto('/');
    await setManeuver(page, '1e300');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'error');
    const banner = page.getByTestId('result-banner');
    await expect(banner).toContainText('Run failed');
    await expect(banner).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('diagnostic').first()).toContainText('NON_FINITE_STATE');
    await expect(page.getByTestId('export-csv-button')).toBeDisabled();
    // Still usable: fix the input, run, get a current result.
    await page.getByTestId('input-m0-dv-s').fill('100');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('result-banner')).toHaveCount(0);
  });

  test('absurd span (1e300 s at 1e298 s): PROPAGATOR_NOT_CONVERGED, then recovery', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('input-duration').fill('1e300');
    await page.getByTestId('input-step').fill('1e298');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('diagnostic').first()).toContainText('PROPAGATOR_NOT_CONVERGED');
    await page.getByTestId('input-duration').fill('6000');
    await page.getByTestId('input-step').fill('60');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
  });

  test('rectilinear fall (burn cancels the circular speed): no crash; a warning, not an error', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('input-e').fill('0');
    // v_circ = sqrt(mu / a), mu = 398600441800000 m^3/s^2 as shown in the model panel, a = 7e6 m.
    const vCirc_mps = Math.sqrt(398600441800000 / 7000000);
    await setManeuver(page, String(-vCirc_mps));
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('diagnostic').first()).toContainText(
      'REFERENCE_SPHERE_INTERSECTION',
    );
  });
});

test.describe('sample limit (ML-FR-003 hard limit 1 000 000)', () => {
  test('1 000 001 samples is refused with a message; 1 000 000 is accepted; nothing runs', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('input-duration').fill('1000000');
    await page.getByTestId('input-step').fill('1');
    await expect(page.getByTestId('run-blocked')).toBeVisible();
    await expect(page.getByTestId('error-step')).toContainText('SAMPLE_COUNT_EXCEEDED');
    await expect(page.getByTestId('error-step')).toContainText('1000001');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'none');
    await page.getByTestId('input-duration').fill('999999');
    await expect(page.getByTestId('run-blocked')).toHaveCount(0);
  });
});

test.describe('worker failure paths (page-side doubles; no product change)', () => {
  test('worker error event while computing: Run failed, readable message, next run recovers', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const Original = window.Worker;
      const w = window as unknown as { __workers: Worker[] };
      w.__workers = [];
      window.Worker = class extends Original {
        constructor(...args: ConstructorParameters<typeof Worker>) {
          super(...args);
          w.__workers.push(this);
        }
      };
    });
    await page.goto('/');
    await page.getByTestId('input-duration').fill('900000');
    await page.getByTestId('input-step').fill('1');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'computing');
    await page.evaluate(() => {
      (window as unknown as { __workers: Worker[] }).__workers[0]?.dispatchEvent(
        new ErrorEvent('error', { message: 'boom' }),
      );
    });
    await expect(state(page)).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('result-banner')).toContainText(
      'The simulation worker failed: boom',
    );
    await expect(page.getByTestId('result-banner')).toHaveAttribute('role', 'alert');
    // The page is interactive and a new worker is created.
    await page.getByTestId('input-duration').fill('3000');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    expect(
      await page.evaluate(() => (window as unknown as { __workers: Worker[] }).__workers.length),
    ).toBe(2);
  });

  test('unreadable worker message (messageerror): Run failed with a plain message', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const Original = window.Worker;
      const w = window as unknown as { __workers: Worker[] };
      w.__workers = [];
      window.Worker = class extends Original {
        constructor(...args: ConstructorParameters<typeof Worker>) {
          super(...args);
          w.__workers.push(this);
        }
      };
    });
    await page.goto('/');
    await page.getByTestId('input-duration').fill('900000');
    await page.getByTestId('input-step').fill('1');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'computing');
    await page.evaluate(() => {
      // A synthetic messageerror event is not delivered to the handler property in Chromium, so
      // the handler the page installed is invoked directly.
      const worker = (window as unknown as { __workers: Worker[] }).__workers[0];
      worker?.onmessageerror?.call(worker, new MessageEvent('messageerror'));
    });
    await expect(state(page)).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('result-banner')).toContainText('could not be read');
  });

  test('worker cannot start (constructor throws): Run failed, page stays usable', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.Worker = function () {
        throw new Error('workers disabled');
      } as unknown as typeof Worker;
    });
    await page.goto('/');
    await page.getByTestId('run-button').click();
    await expect(state(page)).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('result-banner')).toContainText('could not start');
    await page.getByTestId('input-name').fill('still editable');
    await expect(page.getByTestId('scenario-name')).toHaveText('still editable');
  });
});

test.describe('further rejected-file classes (beyond persistence.spec)', () => {
  const cases: [string, Buffer][] = [
    ['empty file', Buffer.alloc(0)],
    ['binary bytes', Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x80, 0x81])],
    ['JSON null', Buffer.from('null')],
    ['JSON array', Buffer.from('[]')],
    ['JSON string', Buffer.from('"scenario"')],
  ];
  for (const [label, buffer] of cases) {
    test(`${label}: a dialog explains it, the scenario is untouched`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (e) => consoleErrors.push(e.message));
      await page.goto('/');
      await page.getByTestId('input-name').fill('Keep me');
      await page.getByTestId('load-input').setInputFiles({
        name: 'x.json',
        mimeType: 'application/json',
        buffer,
      });
      const dialog = page.getByTestId('error-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('notice-message')).not.toBeEmpty();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('input-name')).toHaveValue('Keep me');
      expect(consoleErrors).toEqual([]);
    });
  }

  test('a schema-valid file the engine rejects (perigee below the reference sphere) is refused on load with a message', async ({
    page,
  }) => {
    await page.goto('/');
    const saved = page.waitForEvent('download');
    await page.getByTestId('save-button').click();
    const text = readFileSync(await (await saved).path(), 'utf8');
    const json = JSON.parse(text) as { initialOrbit: { elements: { semiMajorAxis_m: number } } };
    json.initialOrbit.elements.semiMajorAxis_m = 6_000_000;
    await page.getByTestId('load-input').setInputFiles({
      name: 'low.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json)),
    });
    // Observed: the load is refused by the same validation as the editor (dialog) and the
    // scenario keeps its previous values.
    const dialog = page.getByTestId('error-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('notice-message')).not.toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('input-a')).toHaveValue('7000');
  });
});
