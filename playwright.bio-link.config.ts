// playwright.bio-link.config.ts
//
// Sibling Playwright config for the Gate 2 mobile acceptance spec.
// The existing playwright.config.ts has strict project-level
// testMatch filters that only run two sealed specs. Rather than
// edit that file (and change existing test behaviour) this sibling
// config narrowly targets the bio-link spec only.
//
// Reuses the already-cached chromium-1248 browser via `devices["Pixel 7"]`.
// Viewport is overridden per test to the owner's requested
// 360×800 and 390×844 sizes.

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
  },
  projects: [
    {
      name: "bio-link-mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /bio-link-mobile\.spec\.ts/,
    },
  ],
});
