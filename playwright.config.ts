import { defineConfig, devices } from '@playwright/test';

// E2E config for Worldpulse. The suite exists to catch bugs that only a real
// browser can surface — the language switcher regression (FR/IT unclickable)
// was a CSS/stacking issue jsdom cannot see, and it reproduced in Firefox but
// not Chromium.
//
// Engine split, and why it isn't symmetric:
//  - Desktop specs run on Firefox only. The desktop view mounts the full 60fps
//    postprocessed WebGL ring, and headless Chromium has no GPU (least of all in
//    CI), so it renders that scene through SwiftShader software GL. The render
//    loop then pegs the main thread indefinitely: the boot beat's setTimeout
//    slips to ~25s, and even once the panel is up Playwright's "element is
//    stable" actionability check never settles, so clicks time out. Firefox's
//    software WebGL throttles enough to stay interactive (~13s to first paint of
//    the controls), and it is where the bug actually surfaced — so nothing is
//    lost by dropping Chromium here. Chromium is still exercised on mobile.
//  - Mobile specs run on Pixel-5 Chromium. Phones trip the `(pointer: coarse)`
//    query and mount the 2D-canvas deck instead — no WebGL, no starvation.
const PORT = 5173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The desktop scene is CPU-bound; several WebGL contexts booting at once on a
  // dev box slow every one of them past the action budget. Two workers keeps
  // local runs honest, CI stays serial for maximum determinism.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Diagnostics only kick in on a retry: continuously recording video of the
    // 60fps WebGL scene starves the main thread and makes Playwright's
    // actionability checks flaky, so the first attempt runs clean.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // The overlay controls only mount once the WebGL ring has booted behind the
    // ~2.4s loader, and that boot is heavily CPU-throttled headless (~13s on
    // Firefox, more under parallel load). The first interaction of each test
    // therefore has to wait out the whole boot — hence the generous budget.
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
