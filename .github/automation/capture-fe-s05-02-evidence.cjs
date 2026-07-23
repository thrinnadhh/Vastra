const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const origin = 'http://127.0.0.1:4182';
const output = process.env.EVIDENCE_OUTPUT ?? path.resolve('docs/evidence/fe-s05-02-address');
fs.mkdirSync(output, { recursive: true });

const captures = [
  ['loading-mobile', 'loading', 'label', 'Loading delivery addresses'],
  ['empty-mobile', 'empty', 'text', 'No delivery addresses yet'],
  ['success-mobile', 'success', 'text', 'Choose delivery address'],
  ['error-mobile', 'error', 'text', 'Something went wrong'],
  ['offline-mobile', 'offline', 'text', 'You are offline'],
  ['unauthorized-mobile', 'unauthorized', 'text', 'Address access unavailable'],
  ['session-expired-mobile', 'session-expired', 'text', 'Session expired'],
];

function evidenceLocator(page, kind, value) {
  return kind === 'label'
    ? page.getByLabel(value).first()
    : page.getByText(value, { exact: true }).first();
}

async function waitForModalSettled(page) {
  const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
  await modal.waitFor({ state: 'visible' });
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState === 'finished' || animation.playState === 'idle'),
  );
  return modal;
}

async function assertModalFocusContainment(page, modal) {
  await page.getByLabel('Confirm delete address').focus();
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    const focusInsideModal = await modal.evaluate((element) =>
      element.contains(document.activeElement),
    );
    if (!focusInsideModal) {
      throw new Error(`Keyboard focus escaped the delete modal after ${index + 1} Tab presses.`);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    for (const [name, scenario, locatorKind, expected] of captures) {
      console.log(`Capturing ${name}`);
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: 'networkidle' });
      await evidenceLocator(page, locatorKind, expected).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      await page.close();
    }

    {
      console.log('Capturing stale-mobile');
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=stale`, { waitUntil: 'networkidle' });
      await page.getByText('Home', { exact: true }).waitFor({ state: 'visible' });
      await page.getByLabel('Refresh addresses').click();
      await page.getByText('STALE DATA', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'stale-mobile.png'), fullPage: true });
      await page.close();
    }

    {
      console.log('Capturing delete modal mobile states');
      const page = await mobile.newPage();
      await page.goto(`${origin}/?scenario=success`, { waitUntil: 'networkidle' });
      await page.getByText('Home', { exact: true }).waitFor({ state: 'visible' });
      await page.getByLabel('Delete Home').click();
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'visible' });
      const modal = await waitForModalSettled(page);
      await assertModalFocusContainment(page, modal);
      await page.screenshot({ path: path.join(output, 'delete-modal-mobile.png'), fullPage: true });
      await page.keyboard.press('Escape');
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'hidden' });
      await page.screenshot({
        path: path.join(output, 'delete-modal-dismissed-mobile.png'),
        fullPage: true,
      });
      await page.close();
    }
    await mobile.close();

    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      deviceScaleFactor: 1,
    });
    {
      console.log('Capturing desktop address and modal states');
      const page = await desktop.newPage();
      await page.goto(`${origin}/?scenario=success`, { waitUntil: 'networkidle' });
      await page
        .getByText('Choose delivery address', { exact: true })
        .waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, 'success-desktop.png'), fullPage: true });
      await page.getByLabel('Delete Home').click();
      await page.getByText('Delete this address?', { exact: true }).waitFor({ state: 'visible' });
      const modal = await waitForModalSettled(page);
      await assertModalFocusContainment(page, modal);
      await page.screenshot({
        path: path.join(output, 'delete-modal-desktop.png'),
        fullPage: true,
      });
      await page.close();
    }
    await desktop.close();
  } finally {
    await browser.close();
  }
})();
