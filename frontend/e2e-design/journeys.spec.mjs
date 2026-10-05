// User journeys. EVERY journey in JOURNEYS.md has a test here whose title starts with
// its id, "[Jn]", and ends in at least one screenshot. The static audit enforces that.
// Adapted from guide §17.13 to this app's routes, testids and engine API.
import cfg, { api } from './design.config.mjs';
import { applyView, expect, expectContracts, settle, test } from './design-helpers.mjs';

const theme = () => test.info().project.metadata.theme ?? 'dark';
const DEBUG_GAME = '/?debug#/game';
const DEBUG_RACK = '/?debug#/rack/1';

async function seed(page) {
  await page.goto(DEBUG_GAME);
  await applyView(page, cfg, { theme: theme() });
  await api.ready(page);
  await cfg.setup?.(page);
  // The views poll the engine: wait until the seeded words are not only on
  // the board but matched into the history (the R26 crossing), or the
  // contracts would race the poll and read an empty board.
  await page.waitForFunction(() => document.querySelectorAll('.wword').length > 0);
  await settle(page);
}

const groundVars = (page) =>
  page.locator('.board.oxy-ground').evaluate((el) => ({
    remaining: el.style.getPropertyValue('--remaining'),
    libido: el.style.getPropertyValue('--libido'),
    taTop: el.style.getPropertyValue('--ta-top'),
    taBottom: el.style.getPropertyValue('--ta-bottom'),
    tbTop: el.style.getPropertyValue('--tb-top'),
    tbBottom: el.style.getPropertyValue('--tb-bottom'),
  }));

test('[J1] First view: home at rest', async ({ page }) => {
  await test.step('open the arrival screen', async () => {
    await page.goto('/?debug#/');
    await applyView(page, cfg, { theme: theme() });
    await settle(page);
  });
  await test.step('the resting state holds its contracts', async () => {
    // Home is the salon register: it carries no ranked content, so the
    // identity probes are vacuous here and everything else still holds.
    await expectContracts(page, { ...cfg, rankWearers: [] }, {});
  });
  await test.step('the resting state is captured', async () => {
    await expect(page).toHaveScreenshot('j1-first-view.png');
  });
});

test('[J2] Tap to place and Play: arrival, latest hues, score', async ({ page }) => {
  await page.goto(DEBUG_RACK);
  await applyView(page, cfg, { theme: theme() });
  await api.ready(page);
  await api.call(page, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
  await api.setRack(page, 1, ['c', 'a', 't', 's', 'x', 'y', 'z']);
  await test.step('tap a tile, then tap a square', async () => {
    // Wait for the seeded rack to reach the screen: clicking tile 0 before
    // the poll paints it would stage a random letter from the old rack.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="rack"] .tile[data-index="0"] .letter')
          ?.textContent.trim() === 'C'
    );
    await page.locator('[data-testid="rack"] .tile[data-index="0"]').click();
    await page.locator('[data-board-row="7"][data-board-col="7"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__oxy.backend.engine.getState().board[7][7].letter))
      .toBe('c');
    await settle(page);
    await expect(page).toHaveScreenshot('j2-staged.png');
  });
  await test.step('Play commits the word and the hues land', async () => {
    await api.place(page, 1, 0, 7, 8);
    await api.place(page, 1, 0, 7, 9);
    await page.getByTestId('play-btn').click();
    await expect
      .poll(() => page.evaluate(() => window.__oxy.backend.engine.getState().player1.score))
      .toBe(10);
    await settle(page);
    await expect.poll(() => page.locator('.pb-cell.wlatest').count()).toBeGreaterThan(0);
    // One word means one rank: the identity probes need four, so they run
    // relaxed here — the latest-hue poll above is this journey's colour proof.
    await expectContracts(page, { ...cfg, rankWearers: [], colorWearers: [] }, {});
    await expect(page).toHaveScreenshot('j2-played.png');
  });
});

test('[J3] Dim the screen from the View panel: bloom drops and the choice persists', async ({
  page,
}) => {
  await seed(page);
  await test.step('open the panel and choose Dim', async () => {
    await page.locator('.view-cluster-summary').click();
    await page.locator('.view-choice[data-key="luma"][data-value="dim"]').click();
    await expect(page.locator('html')).toHaveAttribute(cfg.attrs.luma, 'dim');
    await settle(page);
    await expectContracts(page, cfg, { luma: 'dim' });
    await expect(page).toHaveScreenshot('j3-panel-dim.png');
  });
  await test.step('the choice survives a reload (stored beats the default)', async () => {
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(cfg.attrs.luma, 'dim');
  });
});

test('[J4] Reset restores the defaults', async ({ page }) => {
  await seed(page);
  await page.locator('.view-cluster-summary').click();
  await page.locator('.view-choice[data-key="luma"][data-value="veil"]').click();
  await expect(page.locator('html')).toHaveAttribute(cfg.attrs.luma, 'veil');
  await page.locator('.view-reset').click();
  await expect(page.locator('html')).toHaveAttribute(cfg.attrs.luma, 'standard');
  await settle(page);
  await expectContracts(page, cfg, {});
  await expect(page).toHaveScreenshot('j4-reset.png');
});

test('[J5] Playing a word moves the territory light', async ({ page }) => {
  await seed(page);
  await expectContracts(page, cfg, {});
  const before = await groundVars(page);
  await test.step('a fifth word in a new corner shifts the light', async () => {
    // S at (10,9) extends TOT into TOTS: the last vertical word changes rank,
    // so the bottom-right corner of the light must move with it.
    await api.setRack(page, 1, ['s', 'x', 'y', 'z', 'q', 'j', 'k']);
    await api.place(page, 1, 0, 10, 9);
    await api.playWord(page, 1);
    await expect.poll(() => groundVars(page)).not.toEqual(before);
    await settle(page);
    await expectContracts(page, cfg, {});
    await expect(page).toHaveScreenshot('j5-moved.png');
  });
});

test('[J6] An invalid play is a verdict, not a hue', async ({ page }) => {
  await seed(page);
  await expectContracts(page, cfg, {});
  await test.step('play letters that form no word', async () => {
    await api.call(page, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
    await api.setRack(page, 1, ['z', 'q', 'x', 'j', 'k', 'v', 'w']);
    await api.place(page, 1, 0, 7, 7);
    await api.place(page, 1, 0, 7, 8);
    await api.place(page, 1, 0, 7, 9);
    const result = await api.call(page, '/api/action', { type: 'play-word', playerId: 1 });
    expect(result.success, 'the invalid play is refused').toBe(false);
    await expect(page.locator('.history-table tr.invalid-row')).toHaveCount(1);
  });
  await test.step('the verdict keeps to itself', async () => {
    const hued = await page.locator('.history-table tr.invalid-row .wword').count();
    expect(hued, 'no word hue inside a verdict row').toBe(0);
    await settle(page);
    await expect(page).toHaveScreenshot('j6-verdict.png');
  });
});

test('[J7] The finish: tiers, sparks and an honest note', async ({ page }) => {
  await page.goto(DEBUG_GAME);
  await applyView(page, cfg, { theme: theme() });
  await api.ready(page);
  await api.call(page, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
  await test.step('two clean moves, then both players pass', async () => {
    await api.setRack(page, 1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    await api.place(page, 1, 0, 7, 7);
    await api.place(page, 1, 0, 7, 8);
    await api.place(page, 1, 0, 7, 9);
    await api.playWord(page, 1);
    await api.setRack(page, 2, ['a', 'r', 'x', 'y', 'z', 'q', 'j']);
    await api.place(page, 2, 0, 8, 7);
    await api.place(page, 2, 0, 9, 7);
    await api.playWord(page, 2);
    await api.call(page, '/api/action', { type: 'pass', playerId: 1 });
    await api.call(page, '/api/action', { type: 'pass', playerId: 2 });
    await expect(page.locator('.modal-content.finale')).toBeVisible();
  });
  await test.step('the finale names how it was reached', async () => {
    await expect(page.locator('.finale .title')).toHaveText('Finished');
    await expect(page.locator('.finale-note')).toHaveText('2 moves · 2 helps used');
    await expect(page.locator('.finale .spark')).toHaveCount(3);
    await settle(page);
    await expect(page).toHaveScreenshot('j7-finale.png');
  });
});

test('[J8] Help visibly costs: a pass drains the charge', async ({ page }) => {
  await seed(page);
  await expectContracts(page, cfg, {});
  await test.step('a pass lowers the published libido', async () => {
    const before = await groundVars(page);
    expect(before.libido, 'a clean game keeps its full charge').toBe('1');
    await api.call(page, '/api/action', { type: 'pass', playerId: 1 });
    await expect.poll(() => groundVars(page).then((g) => g.libido)).toBe('0.92');
    await settle(page);
    await expect(page).toHaveScreenshot('j8-drained.png');
  });
});
