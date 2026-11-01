// playwright.nex-feed-perf-baseline.config.ts
//
// NEX Media Engine · P0-1 · perf baseline harness config.
// Owner-authorised 2026-11-01.
//
// Requires the dev server to be running on http://localhost:3008
// (started separately via `npm run dev`).
//
// Honesty note:
//   This runs in a desktop Chromium instance on this host machine.
//   Numbers are BROWSER-SIMULATED, not real-device. Clearly labelled
//   as such in the report.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /nex-feed-perf-baseline\.spec\.ts$/,
  timeout: 180_000, // 3 min per scenario · covers Ireland's 36 MB potential image load + full lifecycle
  fullyParallel: false, // serial · we want clean back-to-back baselines
  reporter: [["list"]],
  use: {
    baseURL: process.env.NEX_DEV_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "chromium-mobile-sim",
      use: {
        // SIMULATED mobile viewport · NOT equivalent to a real
        // Android device. Clearly labelled in the harness output.
        ...devices["Pixel 7"],
      },
    },
  ],
});
