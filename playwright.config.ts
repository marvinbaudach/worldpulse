import { defineConfig, devices } from '@playwright/test';

// E2E config for Worldpulse. The suite exists to catch bugs that only a real
// browser can surface — the language switcher regression (FR/IT unclickable)
// was a CSS/stacking issue jsdom cannot see, and it reproduced in Firefox but
// not Chromium.
//
// Engine split, and why it isn't symmetric:
//  - Desktop specs run on Firefox only: the language-switcher regression this
//    suite exists for (FR/IT unclickable) reproduced in Firefox but not
//    Chromium, so Firefox is where the desktop gallery is guarded.
//  - Mobile specs run on Pixel-5 Chromium. Phones trip the `(pointer: coarse)`
//    query and mount the swipe deck instead of the gallery.
const PORT = 5173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Two workers keeps local runs quick without starving the dev server; CI
  // stays serial for maximum determinism.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Diagnostics only kick in on a retry: continuously recording video can
    // starve the main thread and make Playwright's actionability checks flaky,
    // so the first attempt runs clean.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Generous budget: the first interaction of each test waits out the dev
    // server's cold start and the app's first paint under parallel load.
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'firefox',
      testMatch: /.*\.desktop\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
