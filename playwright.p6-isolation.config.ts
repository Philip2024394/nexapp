// playwright.p6-isolation.config.ts
//
// P6 · two-context isolation config · 2026-11-14.
// Uses :3010 dev server which is started WITHOUT the sealed
// dev-impersonation env var so real email/password sign-in works.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-p6-isolation",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "two-context-isolation-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /two-context-isolation\.spec\.ts/,
    },
  ],
});
