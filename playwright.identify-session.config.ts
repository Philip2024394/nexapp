// playwright.identify-session.config.ts
//
// One-off sibling config for the session-identification probe.
// Reuses the same storage-state path and viewport as the Gate 2c
// config, but targets _identify-session-account.spec.ts only.
// Delete after the probe prints the handle.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
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
    storageState: "tests/e2e/.auth/state.json",
  },
  projects: [
    {
      name: "identify-session",
      use: { ...devices["Pixel 7"] },
      testMatch: /_identify-session-account\.spec\.ts/,
    },
  ],
});
