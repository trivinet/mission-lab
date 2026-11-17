import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-024 e2e (ML-FR-008 AC1, AC2): play, pause, scrub, jumps and rate change in a real
 * browser; the read-out, the scene hook's marker source time and the playback state agree; no
 * run is started by playback (worker message count unchanged). Everything is polled, never read
 * once, so a slow runner cannot flake it.
 */

interface Marker {
  t_s: number;
  segmentIndex: number;
  sampleIndex: number | null;
  interpolated: boolean;
  position: number[];
}

async function markerOf(page: Page): Promise<Marker | null> {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __missionLabScene?: { get: () => { spacecraftMarker: Marker | null } };
      }
    ).__missionLabScene;
    const marker = hook?.get().spacecraftMarker ?? null;
    return marker === null
      ? null
      : {
          t_s: marker.t_s,
          segmentIndex: marker.segmentIndex,
          sampleIndex: marker.sampleIndex,
          interpolated: marker.interpolated,
          position: Array.from(marker.position),
        };
  });
}

const readout = (page: Page) => page.getByTestId('playback-readout');
const timeline = (page: Page) => page.getByTestId('timeline');

async function readoutT(page: Page): Promise<number> {
  return Number((await readout(page).getAttribute('data-t-s')) ?? Number.NaN);
}

async function postCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __posts: number }).__posts);
}

/** Opens the app with the scene hook, counts main-to-worker messages, runs the scenario. */
async function openAndRun(page: Page, maneuver = false): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __posts: number }).__posts = 0;
    const original = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage')
      ?.value as Worker['postMessage'];
    Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: never) {
      (window as unknown as { __posts: number }).__posts += 1;
      original.call(this, message, options);
    } as Worker['postMessage'];
  });
  await page.goto('/?sceneHook=1');
  if (maneuver) {
    await page.getByTestId('add-maneuver').click();
    await page.getByTestId('input-m0-time').fill('3000');
    await page.getByTestId('input-m0-dv-s').fill('100');
  }
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  // The counter really counts: the run itself posted at least one message.
  expect(await postCount(page)).toBeGreaterThan(0);
}

test('before a run the timeline is disabled and says so', async ({ page }) => {
  await page.goto('/?sceneHook=1');
  await expect(timeline(page)).toBeVisible();
  await expect(page.getByTestId('playback-toggle')).toBeDisabled();
  await expect(readout(page)).toHaveText('no result');
});

test('play advances time, pause stops it, scrub sets it, rate changes the advance', async ({
  page,
}) => {
  await openAndRun(page);
  const baseline = await postCount(page);
  await expect(readout(page)).toHaveAttribute('data-t-s', '0');

  await page.getByTestId('playback-rate').selectOption('1000');
  await page.getByTestId('playback-toggle').click();
  await expect(timeline(page)).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => readoutT(page)).toBeGreaterThan(0);

  await page.getByTestId('playback-toggle').click();
  await expect(timeline(page)).toHaveAttribute('data-playing', 'false');
  const paused = await readoutT(page);
  // Paused: the time stays put over a while (the frame loop is cancelled).
  await page.waitForTimeout(400);
  expect(await readoutT(page)).toBe(paused);

  await page.getByTestId('playback-slider').fill('1234');
  await expect(readout(page)).toHaveAttribute('data-t-s', '1234');
  await expect.poll(async () => (await markerOf(page))?.t_s).toBe(1234);

  // Rate: the same wall-clock play advances far more at 1000 s/s than at 1 s/s.
  async function advanceFromStart(rate: string): Promise<number> {
    await page.getByTestId('playback-start').click();
    await expect(readout(page)).toHaveAttribute('data-t-s', '0');
    await page.getByTestId('playback-rate').selectOption(rate);
    await page.getByTestId('playback-toggle').click();
    await expect(timeline(page)).toHaveAttribute('data-playing', 'true');
    await page.waitForTimeout(600);
    await page.getByTestId('playback-toggle').click();
    await expect(timeline(page)).toHaveAttribute('data-playing', 'false');
    return readoutT(page);
  }
  const slow = await advanceFromStart('1');
  const fast = await advanceFromStart('1000');
  // At 1 s/s the frame step is capped at 0.25 s per frame, so a few seconds at most.
  expect(slow).toBeLessThan(10);
  expect(fast).toBeGreaterThan(slow);
  expect(fast).toBeGreaterThan(20);

  expect(await postCount(page)).toBe(baseline);
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
});

test('jumps land exactly; play stops itself at exactly the end time', async ({ page }) => {
  await openAndRun(page, true);
  const baseline = await postCount(page);

  await page.getByTestId('playback-end').click();
  await expect(readout(page)).toHaveAttribute('data-t-s', '6000');
  await page.getByTestId('playback-start').click();
  await expect(readout(page)).toHaveAttribute('data-t-s', '0');
  await page.getByTestId('playback-maneuver').click();
  await expect(readout(page)).toHaveAttribute('data-t-s', '3000');
  // At the maneuver time the post-maneuver segment's first engine sample is shown.
  await expect
    .poll(async () => {
      const m = await markerOf(page);
      return m === null ? null : [m.t_s, m.segmentIndex, m.sampleIndex, m.interpolated];
    })
    .toEqual([3000, 1, 0, false]);

  await page.getByTestId('playback-slider').fill('5990');
  await page.getByTestId('playback-rate').selectOption('1000');
  await page.getByTestId('playback-toggle').click();
  await expect(readout(page)).toHaveAttribute('data-t-s', '6000');
  await expect(timeline(page)).toHaveAttribute('data-playing', 'false');
  await expect(page.getByTestId('playback-toggle')).toHaveText('Play');

  expect(await postCount(page)).toBe(baseline);
});

test('read-out, marker source time and scrubbed times agree, including a maneuver time', async ({
  page,
}) => {
  await openAndRun(page, true);
  for (const t of [0, 1234, 2999, 3000, 3001, 4500, 6000]) {
    await page.getByTestId('playback-slider').fill(String(t));
    await expect.poll(() => readoutT(page)).toBe(t);
    await expect.poll(async () => (await markerOf(page))?.t_s).toBe(t);
    await expect(readout(page)).toContainText(String(t));
  }
});

test('the marker is the scene vertex at a sample time and flagged interpolated between', async ({
  page,
}) => {
  await openAndRun(page);
  // Samples are every 60 s: t = 120 s is sample 2, t = 130 s is between samples.
  await page.getByTestId('playback-slider').fill('120');
  await expect.poll(async () => (await markerOf(page))?.sampleIndex).toBe(2);
  expect((await markerOf(page))?.interpolated).toBe(false);
  const same = await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __missionLabScene: {
          get: () => {
            scale: number;
            sourcePosition_m: Float64Array[];
            spacecraftMarker: { sampleIndex: number; position: Float32Array };
          };
        };
      }
    ).__missionLabScene.get();
    const i = scene.spacecraftMarker.sampleIndex;
    return [0, 1, 2].every((k) =>
      Object.is(
        scene.spacecraftMarker.position[k],
        Math.fround((scene.sourcePosition_m[0]?.[3 * i + k] ?? 0) * scene.scale),
      ),
    );
  });
  expect(same).toBe(true);

  await page.getByTestId('playback-slider').fill('130');
  await expect.poll(async () => (await markerOf(page))?.interpolated).toBe(true);
  await expect(page.getByTestId('playback-source')).toContainText('interpolated (display only)');
});

test('every control is keyboard operable with a visible focus ring', async ({ page }) => {
  await openAndRun(page, true);
  const baseline = await postCount(page);

  const start = page.getByTestId('playback-start');
  // After a mouse click the browser shows :focus-visible only once the keyboard is used.
  await page.keyboard.press('Shift');
  await start.focus();
  await expect(start).toBeFocused();
  await expect
    .poll(() => start.evaluate((el) => getComputedStyle(el).outlineStyle))
    .not.toBe('none');

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('playback-toggle')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(timeline(page)).toHaveAttribute('data-playing', 'true');
  await page.keyboard.press('Space');
  await expect(timeline(page)).toHaveAttribute('data-playing', 'false');

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('playback-maneuver')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(readout(page)).toHaveAttribute('data-t-s', '3000');

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('playback-end')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(readout(page)).toHaveAttribute('data-t-s', '6000');

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('playback-rate')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('playback-slider')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(readout(page)).toHaveAttribute('data-t-s', '0');
  await page.keyboard.press('ArrowRight');
  await expect(readout(page)).toHaveAttribute('data-t-s', '1');

  expect(await postCount(page)).toBe(baseline);
});

test('editing an input marks the result stale; playback keeps its time on the old result', async ({
  page,
}) => {
  await openAndRun(page);
  await page.getByTestId('playback-slider').fill('500');
  await expect(readout(page)).toHaveAttribute('data-t-s', '500');
  await page.getByTestId('input-duration').fill('7000');
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'stale');
  await expect(readout(page)).toHaveAttribute('data-t-s', '500');
});
