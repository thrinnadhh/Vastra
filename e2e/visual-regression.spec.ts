import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { FRONTEND_VISUAL_ENTRY_POINTS } from '@vastra/frontend-test-harness';

interface VisualBaselineFile {
  readonly browser: string;
  readonly hashes: Readonly<Record<string, string>>;
}

const baselineFile = JSON.parse(
  readFileSync(new URL('./visual-baselines.json', import.meta.url), 'utf8'),
) as VisualBaselineFile;

for (const entryPoint of FRONTEND_VISUAL_ENTRY_POINTS) {
  test(`${entryPoint.id} matches the deterministic visual hash`, async ({ page, browserName }) => {
    expect(browserName).toBe(baselineFile.browser);
    await page.setViewportSize(entryPoint.viewport);
    await page.goto(entryPoint.route);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const screenshot = await page.screenshot({ animations: 'disabled', fullPage: true });
    const actualHash = createHash('sha256').update(screenshot).digest('hex');
    const expectedHash = baselineFile.hashes[entryPoint.id];
    if (expectedHash === undefined) {
      throw new Error(`Missing visual baseline hash for ${entryPoint.id}: ${actualHash}`);
    }
    expect(actualHash).toBe(expectedHash);
  });
}
