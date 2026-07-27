import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { chromium } from '@playwright/test';

import { FRONTEND_VISUAL_ENTRY_POINTS } from './manifest';
import { startFixtureServer } from './server';

import { type SupportedVisualPlatform, VISUAL_BASELINES } from '../../../e2e/visual-baselines';

if (process.platform !== 'darwin' && process.platform !== 'linux') {
  throw new Error(
    `Visual baselines are not configured for platform "${process.platform}". ` +
      'Add the platform to SupportedVisualPlatform before updating baselines.',
  );
}

const platform = process.platform satisfies SupportedVisualPlatform;
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

  const hashesByPlatform = {
    ...VISUAL_BASELINES.hashesByPlatform,
    [platform]: hashes,
  };
  const platformEntries = Object.entries(hashesByPlatform)
    .map(([platformName, platformHashes]) => {
      const hashEntries = Object.entries(platformHashes)
        .map(([id, hash]) => `      '${id}':\n        '${hash}',`)
        .join('\n');
      return `    ${platformName}: {\n${hashEntries}\n    },`;
    })
    .join('\n');
  const baselineSource = `export type SupportedVisualPlatform = 'darwin' | 'linux';\n\ntype VisualHashes = Readonly<Record<string, string>>;\n\ninterface VisualBaselines {\n  readonly browser: 'chromium';\n  readonly hashesByPlatform: Readonly<Record<SupportedVisualPlatform, VisualHashes>>;\n}\n\nexport const VISUAL_BASELINES: VisualBaselines = {\n  browser: 'chromium',\n  hashesByPlatform: {\n${platformEntries}\n  },\n};\n`;
  const baselinePath = new URL('../../../e2e/visual-baselines.ts', import.meta.url);
  await writeFile(baselinePath, baselineSource, 'utf8');
} finally {
  await browser.close();
  await server.close();
}
