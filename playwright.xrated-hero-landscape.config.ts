// playwright.xrated-hero-landscape.config.ts
//
// Standalone config for the Template 15 (product_hero_landscape)
// verification spec. Keeps the main playwright.config.ts projects/
// testMatch untouched so the one-off browser evidence run doesn't
// affect ongoing CI.
//
// Requires dev server already running on :3008.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /xrated-hero-landscape\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
});
