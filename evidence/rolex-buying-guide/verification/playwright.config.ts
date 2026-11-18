// Minimal Playwright config for the independent verification agent.
// Scoped to evidence/rolex-buying-guide/verification only. Does NOT
// start a server · uses the already-running dev server on :3008.
//
// Why a separate config: the repo root playwright.config.ts has
// testDir "./tests/e2e" with per-project testMatch filters, which
// excludes any spec outside that tree (including this verification
// script). Using --config to point at this file is the cleanest way
// to invoke the spec without touching the root config.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /run\.spec\.ts$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
});
