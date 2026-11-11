// scripts/_tmp/verify-phase-a-perf.config.ts
//
// Playwright config for the production-mode Phase A perf run. Hits
// a separate port (3010) so it doesn't collide with the dev server
// on 3009.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /verify-(phase-a-(perf|diag|mobile-diag|slide-investigation)|phone-frame-stays-still|c24-(route-matrix|option-b|option-b-validation|asset-swap)|free-chat-flashing-diag|vault-longer|backdrop-swap|live-asset-swap|live-contacts-snapshot|c25-contacts-ui|backdrop-promo-banner)\.spec\.ts/,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3011",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
