import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-023 e2e: the scene renders in a real browser, camera reset works, display options start
 * no run, and the scene-state hook (enabled by ?sceneHook=1) shows exact vertices (VI-02 in the
 * browser; the full engine-driven VI-02 cases are the Vitest tests in src/scene).
 */

interface HookSummary {
  scale: number;
  resultKind: string;
  stale: boolean;
  referenceRadius_m: number;
  earthRadius_scene: number;
  segmentCount: number;
  vertexCounts: number[];
  axesVisible: boolean;
  camera: { position: number[]; target: number[] } | null;
  mismatches: number;
  compared: number;
}

async function hook(page: Page): Promise<HookSummary> {
  return page.evaluate(() => {
    const scene = (
      window as unknown as {
        __missionLabScene: {
          get: () => {
            scale: number;
            resultKind: string;
            stale: boolean;
            referenceRadius_m: number;
            earthRadius_scene: number;
            segments: { vertices: Float32Array }[];
            axesVisible: boolean;
            camera: { position: number[]; target: number[] } | null;
            sourcePosition_m: Float64Array[] | null;
          };
        };
      }
    ).__missionLabScene;
    const state = scene.get();
    let mismatches = 0;
    let compared = 0;
    (state.sourcePosition_m ?? []).forEach((source, n) => {
      const vertices = state.segments[n]?.vertices;
      source.forEach((sample, i) => {
        compared += 1;
        if (!Object.is(vertices?.[i], Math.fround(sample * state.scale))) {
          mismatches += 1;
        }
      });
    });
    return {
      scale: state.scale,
      resultKind: state.resultKind,
      stale: state.stale,
      referenceRadius_m: state.referenceRadius_m,
      earthRadius_scene: state.earthRadius_scene,
      segmentCount: state.segments.length,
      vertexCounts: state.segments.map((s) => s.vertices.length),
      axesVisible: state.axesVisible,
      camera: state.camera,
      mismatches,
      compared,
    };
  });
}

test('the hook is absent without the flag', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-scene')).toBeVisible();
  expect(await page.evaluate(() => '__missionLabScene' in window)).toBe(false);
});

test('Earth only before a run; the trajectory appears after a run; vertices are exact', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
    }
  });
  await page.goto('/?sceneHook=1');
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await expect(page.getByTestId('scene-no-webgl')).toHaveCount(0);
  await expect(page.getByTestId('earth-orientation-label')).toContainText('illustrative');

  const canvas = page.getByTestId('scene-canvas');
  const before = await canvas.screenshot();
  // Everything below waits for the hook to show the state instead of reading it once: on a slow
  // runner the scene can lag the DOM.
  await expect.poll(async () => page.evaluate(() => '__missionLabScene' in window)).toBe(true);
  const empty = await hook(page);
  expect(empty.resultKind).toBe('none');
  expect(empty.segmentCount).toBe(0);
  expect(empty.earthRadius_scene).toBe(empty.referenceRadius_m * empty.scale);

  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('segment-summary-0')).toContainText('101 samples');
  await expect.poll(async () => (await hook(page)).segmentCount).toBe(1);
  const run = await hook(page);
  expect(run.resultKind).toBe('current');
  expect(run.segmentCount).toBe(1);
  expect(run.vertexCounts).toEqual([303]);
  expect(run.compared).toBe(303);
  expect(run.mismatches).toBe(0);

  // The canvas content changed (trajectory drawn). Not proof of correctness, only that the
  // scene is live; the exactness check above is the evidence.
  await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  expect(errors).toEqual([]);
});

test('camera: keyboard orbit and zoom move the camera, Reset restores it', async ({ page }) => {
  await page.goto('/?sceneHook=1');
  const canvas = page.getByTestId('scene-canvas').locator('canvas');
  await expect(canvas).toBeVisible();
  // The camera registers in the hook after the first rendered frame; on a slow runner that can
  // come after the canvas is visible, so wait for it instead of reading it once.
  await expect.poll(async () => (await hook(page)).camera).not.toBeNull();
  const initial = (await hook(page)).camera;
  expect(initial).not.toBeNull();

  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('+');
  await expect.poll(async () => (await hook(page)).camera?.position).not.toEqual(initial?.position);
  const moved = (await hook(page)).camera;

  // Mouse orbit as well (OrbitControls).
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error('canvas has no box');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await hook(page)).camera?.position).not.toEqual(moved?.position);

  await page.getByTestId('camera-reset').click();
  // OrbitControls re-derives the pose through spherical coordinates, so it returns to within
  // rounding (about 1e-14 scene units), not bit for bit. The camera is not an engine sample.
  await expect
    .poll(async () => {
      const camera = (await hook(page)).camera;
      return Math.max(
        ...(camera?.position ?? [Infinity]).map((v, i) =>
          Math.abs(v - (initial?.position[i] ?? 0)),
        ),
      );
    })
    .toBeLessThan(1e-9);
  expect((await hook(page)).camera?.target).toEqual(initial?.target);
});

test('display options start no run (ML-FR-007 AC4)', async ({ page }) => {
  let workers = 0;
  page.on('worker', () => {
    workers += 1;
  });
  await page.goto('/?sceneHook=1');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  expect(workers).toBe(1);

  await page.getByTestId('option-axes').check();
  await expect.poll(async () => (await hook(page)).axesVisible).toBe(true);
  await page.getByTestId('playback-slider').fill('50');
  await expect(page.getByTestId('playback-readout')).toHaveAttribute('data-t-s', '50');
  await page.getByTestId('option-axes').uncheck();
  await page.getByTestId('camera-reset').click();

  // Still current (never stale, never computing), the same single worker, same sample count.
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('sample-count')).toHaveText('101');
  expect(workers).toBe(1);
  await expect.poll(async () => (await hook(page)).axesVisible).toBe(false);
});

test('a maneuvered scenario: two segments, one maneuver marker, VI-02 with 0 mismatches', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
    }
  });
  await page.goto('/?sceneHook=1');
  await page.getByTestId('add-maneuver').click();
  await page.getByTestId('input-m0-time').fill('3000');
  await page.getByTestId('input-m0-dv-s').fill('100');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');

  await expect.poll(async () => (await hook(page)).segmentCount).toBe(2);
  const maneuvered = await hook(page);
  expect(maneuvered.resultKind).toBe('current');
  // Coast up to the maneuver and the maneuvered arc are separate segments, never joined.
  expect(maneuvered.segmentCount).toBe(2);
  expect(maneuvered.compared).toBe(maneuvered.vertexCounts.reduce((sum, n) => sum + n, 0));
  expect(maneuvered.compared).toBeGreaterThan(0);
  expect(maneuvered.mismatches).toBe(0);

  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __missionLabScene: { get: () => { maneuverMarkers: { maneuverId: string }[] } };
            }
          ).__missionLabScene.get().maneuverMarkers.length,
      ),
    )
    .toBe(1);
  expect(errors).toEqual([]);
});

test('a physical edit keeps the old trajectory, marked stale', async ({ page }) => {
  await page.goto('/?sceneHook=1');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await page.getByTestId('input-duration').fill('3000');
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'stale');
  await expect.poll(async () => (await hook(page)).stale).toBe(true);
  const state = await hook(page);
  expect(state.segmentCount).toBe(1);
  expect(state.vertexCounts).toEqual([303]);
  await expect(page.getByTestId('scene-stale-chip')).toBeVisible();
});
