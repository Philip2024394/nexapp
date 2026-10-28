// playwright.s8-browser-qa.config.ts
//
// NEX Live S8 · one-off browser-QA config · owner-authorised 2026-10-25.
//
// Minimal config dedicated to running the S8 browser-QA spec against
// the already-running dev server. Does NOT start the server, does NOT
// install any browser (uses the chromium-1248 build already present).

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /s8-browser-qa\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "s8-chromium-pixel7",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
