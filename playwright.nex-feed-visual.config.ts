// playwright.nex-feed-visual.config.ts
//
// Owner directive 2026-10-30 · "prepare a visual browser test that
// captures: Desktop Feed inside the phone frame · Mobile Feed filling
// the screen · Music cover/title/creator/controls · Video content and
// controls · Actual vertical swipe from video to music and music to
// video."
//
// This config is ADDITIVE · it does NOT modify the existing
// `playwright.config.ts` or any other spec. Run with:
//
//   ./node_modules/.bin/playwright test --config=playwright.nex-feed-visual.config.ts
//
// Expects the NEX dev server to already be running on
// http://localhost:3008 (same convention as the sealed main config).

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./tests/e2e-screenshots/nex-feed-visual-output",
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
      // Desktop · 1440×900 is the common MacBook-class viewport the
      // owner's `.nex-native-frame` clamp is designed around (frame
      // becomes a 360×780 phone centred in the viewport).
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /nex-feed-visual-verify\.spec\.ts/,
    },
    {
      // Mobile · Pixel 7 (412×915) is the sealed mobile emulator used
      // in the main playwright.config.ts. Same chromium build so no
      // extra install needed.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /nex-feed-visual-verify\.spec\.ts/,
    },
  ],
});
