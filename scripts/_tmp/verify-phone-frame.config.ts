// scripts/_tmp/verify-phone-frame.config.ts
// Desktop-viewport playwright config for the phone-frame isolation test.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /verify-(phone-frame-stays-still|ready-before-slide)\.spec\.ts/,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3009",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
