import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { FRONTEND_VISUAL_ENTRY_POINTS } from '@vastra/frontend-test-harness';

import { VISUAL_BASELINES } from './visual-baselines';

for (const entryPoint of FRONTEND_VISUAL_ENTRY_POINTS) {
  test(`${entryPoint.id} matches the deterministic visual hash`, async ({ page, browserName }) => {
    expect(browserName).toBe(VISUAL_BASELINES.browser);
    await page.setViewportSize(entryPoint.viewport);
    await page.goto(entryPoint.route);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const screenshot = await page.screenshot({ animations: 'disabled', fullPage: true });
    const actualHash = createHash('sha256').update(screenshot).digest('hex');
    const expectedHash = VISUAL_BASELINES.hashes[entryPoint.id];
    expect(actualHash).toBe(expectedHash);
  });
}
