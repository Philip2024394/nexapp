// playwright.themes.config.ts
//
// NEX Theme Production · Phase A3 · theme-preview screenshot harness.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19. Isolated from production rendering.
//
// What this configuration does:
//   · Targets http://localhost:3008 (the running NEX dev server).
//   · Runs ONE spec: tests/e2e-themes/theme-previews.spec.ts
//   · Three viewport projects: 390 (phone), 768 (tablet), 1280 (desktop)
//   · Screenshots are saved to tests/e2e-screenshots-themes/<slug>/<viewport>.png
//   · Does NOT start the dev server · it must be running separately.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-themes",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    // Honour PLAYWRIGHT_TEST_BASE_URL when the dev server is on a
    // non-standard port (e.g. the owner's session on 3009). Defaults
    // to the canonical 3008 declared in CLAUDE.md.
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "theme-preview-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /theme-previews\.spec\.ts/,
    },
    {
      name: "theme-preview-768",
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
      testMatch: /theme-previews\.spec\.ts/,
    },
    {
      name: "theme-preview-1280",
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
      testMatch: /theme-previews\.spec\.ts/,
    },
  ],
});
