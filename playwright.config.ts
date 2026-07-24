import { defineConfig, devices } from '@playwright/test';

const fixtureOrigin = 'http://127.0.0.1:4178';
const adminOrigin = 'http://127.0.0.1:4179';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [['line'], ['html', { open: 'never' }]],
  outputDir: 'test-results/playwright',
  use: {
    colorScheme: 'light',
    locale: 'en-IN',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @vastra/frontend-test-harness serve',
      url: `${fixtureOrigin}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        'pnpm --filter @vastra/admin-dashboard exec next build && pnpm --filter @vastra/admin-dashboard exec next start -H 127.0.0.1 -p 4179',
      url: adminOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'admin',
      testMatch: /admin-shell\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminOrigin,
        viewport: { width: 1440, height: 1024 },
      },
    },
    {
      name: 'mobile',
      testMatch: /(mobile-shell|customer-access-navigation)\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: fixtureOrigin,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'cod-mobile',
      testMatch: /customer-cod-checkout\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: fixtureOrigin,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'cod-desktop',
      testMatch: /customer-cod-checkout\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: fixtureOrigin,
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'visual',
      testMatch: /visual-regression\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: fixtureOrigin },
    },
  ],
});
