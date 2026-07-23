const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const origin = 'http://127.0.0.1:4182';
const output = process.env.EVIDENCE_OUTPUT ?? path.resolve('docs/evidence/fe-s05-02-address');
fs.mkdirSync(output, { recursive: true });

const captures = [
  ['loading-mobile', 'loading', 'Loading delivery addresses'],
  ['empty-mobile', 'empty', 'No delivery addresses yet'],
  ['success-mobile', 'success', 'Delivery addresses'],
  ['error-mobile', 'error', 'Delivery addresses could not be refreshed.'],
  ['offline-mobile', 'offline', 'Check your internet connection and try again.'],
  ['unauthorized-mobile', 'unauthorized', 'Address access unavailable'],
  ['session-expired-mobile', 'session-expired', 'Session expired'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    for (const [name, scenario, expected] of captures) {
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: 'networkidle' });
      await page.getByText(expected, { exact: false }).first().waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      await page.close();
    }

    {
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=stale`, { waitUntil: 'networkidle' });
      await page.getByText('Home', { exact: true }).waitFor({ state: 'visible' });
      await page.getByLabel('Refresh addresses').click();
      await page.getByText('STALE DATA', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'stale-mobile.png'), fullPage: true });
      await page.close();
    }

    {
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=success`, { waitUntil: 'networkidle' });
      await page.getByText('Home', { exact: true }).waitFor({ state: 'visible' });
      await page.getByLabel('Delete Home').click();
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'delete-modal-mobile.png'), fullPage: true });
      await page.keyboard.press('Escape');
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(output, 'delete-modal-dismissed-mobile.png'), fullPage: true });
      await page.close();
    }
    await mobile.close();

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
    {
      const page = await desktop.newPage();
      await page.goto(`${origin}/?scenario=success`, { waitUntil: 'networkidle' });
      await page.getByText('Delivery addresses', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'success-desktop.png'), fullPage: true });
      await page.getByLabel('Delete Home').click();
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'delete-modal-desktop.png'), fullPage: true });
      await page.close();
    }
    await desktop.close();
  } finally {
    await browser.close();
  }
})();
