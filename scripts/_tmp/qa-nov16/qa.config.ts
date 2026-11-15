// QA · minimal Playwright config · targets :3008 · uses Chromium
// mobile Pixel 7 viewport. Only runs QA scripts under scripts/_tmp/qa-nov16.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "qa-nov16-mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /qa-checkpoint-.*\.spec\.ts/,
      timeout: 360_000,
    },
  ],
});
