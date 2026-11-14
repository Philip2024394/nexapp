// playwright.stage5-rosa-side.config.ts
//
// Stage 5 · Final-gap closure · 2026-11-14.
// -----------------------------------------------------------------------------
// Runs the Rosa-side spec against a dev server that is EXPECTED to
// have NEX_DEV_IMPERSONATE_HANDLE=nex-99903 (Rosa, shop owner of
// handbags-direct). Separate config so the env state matches
// exactly what the spec expects.

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
      name: "rosa-side-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /rosa-side\.spec\.ts/,
    },
  ],
});
