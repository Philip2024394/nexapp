// scripts/_tmp/verify-phase-a-perf.config.ts
//
// Playwright config for the production-mode Phase A perf run. Hits
// a separate port (3010) so it doesn't collide with the dev server
// on 3009.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /verify-(phase-a-(perf|diag|mobile-diag|slide-investigation)|phone-frame-stays-still|c24-(route-matrix|option-b|option-b-validation|asset-swap)|free-chat-flashing-diag|vault-longer|backdrop-swap|live-asset-swap|live-contacts-snapshot|c25-contacts-ui|backdrop-promo-banner|c26-contacts-preview|c26-contacts-long|c27-no-flashing|c27-wait-for-content|c27-final-prototype|c27-polished|c28-contacts|c28-dom-probe|c28-v2-scroll|c28-final|c29-wave-bg|c30-header-sort|c31-sticky-bg|unified-library-e2e)\.spec\.ts/,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3009",
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
