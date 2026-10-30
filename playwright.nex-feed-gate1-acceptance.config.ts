// playwright.nex-feed-gate1-acceptance.config.ts
//
// Owner directive 2026-10-30 · "verify on the running application:
// Music slide: tap creator avatar + tap creator name + horizontal
// drag + deliberate vertical drag + short drag below 60px".
//
// Additive · does NOT edit the existing playwright.config.ts or
// playwright.nex-feed-visual.config.ts. Dev server must already be
// running on http://localhost:3008.
//
// Run with:
//   ./node_modules/.bin/playwright test --config=playwright.nex-feed-gate1-acceptance.config.ts

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./tests/e2e-screenshots/nex-feed-gate1-acceptance-output",
  use: {
    baseURL: "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testMatch: /nex-feed-gate1-acceptance\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /nex-feed-gate1-acceptance\.spec\.ts/,
    },
  ],
});
