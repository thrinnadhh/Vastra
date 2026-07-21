import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { chromium } from '@playwright/test';

import { FRONTEND_VISUAL_ENTRY_POINTS } from './manifest';
import { startFixtureServer } from './server';

const server = await startFixtureServer({ port: 0 });
const browser = await chromium.launch();

try {
  const hashes: Record<string, string> = {};
  for (const entryPoint of FRONTEND_VISUAL_ENTRY_POINTS) {
    const page = await browser.newPage({
      colorScheme: 'light',
      locale: 'en-IN',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      viewport: entryPoint.viewport,
    });
    await page.goto(`${server.origin}${entryPoint.route}`);
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({ animations: 'disabled', fullPage: true });
    hashes[entryPoint.id] = createHash('sha256').update(screenshot).digest('hex');
    await page.close();
  }

  const baselineEntries = Object.entries(hashes)
    .map(([id, hash]) => `    '${id}':\n      '${hash}',`)
    .join('\n');
  const baselineSource = `export const VISUAL_BASELINES = {\n  browser: 'chromium',\n  hashes: {\n${baselineEntries}\n  },\n} as const;\n`;
  const baselinePath = new URL('../../../e2e/visual-baselines.ts', import.meta.url);
  await writeFile(baselinePath, baselineSource, 'utf8');
} finally {
  await browser.close();
  await server.close();
}
