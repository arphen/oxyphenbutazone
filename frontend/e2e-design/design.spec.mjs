// Design contracts: the measurable half of the guide, checked in every project
// (viewport x theme) and across the mini/micro view tiers, each with a screenshot.
// Adapted from guide §17.13: the seeded desktop board stands in for the lanes.
import cfg from './design.config.mjs';
import {
  applyView,
  expect,
  expectContracts,
  expectFocusRing,
  settle,
  test,
} from './design-helpers.mjs';

const theme = () => test.info().project.metadata.theme ?? 'dark';

test.describe('design contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(cfg.page);
    await applyView(page, cfg, { theme: theme() });
    await cfg.setup?.(page);
    // The views poll the engine: wait until the seeded words are matched
    // into the history (the R26 crossing), or the contracts race the poll.
    await page.waitForFunction(() => document.querySelectorAll('.wword').length > 0);
  });

  for (const luma of cfg.lumas) {
    for (const vibrance of cfg.vibrances) {
      test(`[D1] view matrix: ${luma} / ${vibrance}`, async ({ page }) => {
        await applyView(page, cfg, { theme: theme(), luma, vibrance });
        await settle(page);
        await expectContracts(page, cfg, { luma });
        await expect(page).toHaveScreenshot(`view-${luma}-${vibrance}.png`);
      });
    }
  }

  test('[D2] keyboard focus is visible', async ({ page }) => {
    await settle(page);
    await expectFocusRing(page);
  });

  // Runs only in the reduced-motion project (see playwright.config.mjs).
  test('[D3] reduced motion removes motion and keeps light @reduced', async ({ page }) => {
    const emulated = await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    expect(emulated, 'prefers-reduced-motion must be emulated, or this test proves nothing').toBe(
      true
    );
    await page.goto('/?debug#/rack/1');
    await applyView(page, cfg, { theme: 'dark', luma: 'standard', vibrance: 'vivid' });
    await cfg.setup?.(page);
    // Select a rack tile: the accent ring is state, not motion, so it stays.
    await page.locator('[data-testid="rack"] .tile[data-index="0"]').click();
    await settle(page);
    // The phone page wears ranks on one surface only; the reduced-motion
    // contract is what this test proves, not the two-surface crossing.
    await expectContracts(
      page,
      { ...cfg, rankWearers: ['.pb-cell'] },
      { luma: 'standard', reduced: true }
    );
    const shadow = await page
      .locator('[data-testid="rack"] .tile.selected')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow, 'the selection keeps its ring when motion is off').not.toBe('none');
    await expect(page).toHaveScreenshot('reduced-motion-selected.png');
  });
});
