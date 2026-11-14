// playwright.stage5-anon-popup.config.ts
//
// Stage 5 · Final-gap closure · 2026-11-14.
// -----------------------------------------------------------------------------
// Runs the anon-popup spec against a dev server that is EXPECTED to
// have NEX_DEV_IMPERSONATE_HANDLE unset (so the viewer resolves as
// anon). Kept separate from the signed-in journey config so the two
// paths are never conflated.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-stage5-shop-chat",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "anon-popup-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /anon-popup\.spec\.ts/,
    },
  ],
});
