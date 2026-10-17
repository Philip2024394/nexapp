// playwright.bio-link-auth.config.ts
//
// Sibling Playwright config for Gate 2c owner-preview tests.
// Uses the sealed storageState path · tests/e2e/.auth/state.json ·
// captured once by the owner via the sealed `playwright codegen`
// command. The state file is gitignored (.gitignore:324).
//
// This config exists so Gate 2c can run WITHOUT editing the sealed
// playwright.config.ts (which has strict testMatch regexes bound to
// the two existing projects).

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
    // Session cookies loaded here · spec never reads them.
    storageState: "tests/e2e/.auth/state.json",
  },
  projects: [
    {
      name: "bio-link-owner-preview",
      use: { ...devices["Pixel 7"] },
      testMatch: /bio-link-owner-preview\.spec\.ts/,
    },
  ],
});
