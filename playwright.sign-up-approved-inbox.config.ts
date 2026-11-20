// playwright.sign-up-approved-inbox.config.ts
//
// Owner-authorised 2026-11-17 · Option B · end-to-end signup proof
// against the approved inbox `phillipofarrell@gmail.com`.
//
// Target: http://localhost:3008 (NOT :3010). Rationale:
//   · `NEX_DEV_IMPERSONATE_HANDLE` is NOT set in .env.local, so the
//     dev-impersonation gate at src/lib/nex-native/app/dev-impersonation.ts
//     lines 61-97 returns false — :3008 is already a real-signin server.
//   · Even if impersonation were enabled, the 2026-11-15 cookie-wins
//     patch (same file lines 158-163) means Playwright's fresh context
//     with no cookie bypasses impersonation.
//   · The existing :3010 driver was authored when both conditions
//     could potentially fail; neither applies to this environment, so
//     a second dev server is not required.
//
// Sandbox-only. Hard refuses production via the spec's own guard.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-p6-isolation",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "sign-up-approved-inbox-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
      testMatch: /sign-up-approved-inbox\.spec\.ts/,
      timeout: 420_000, // 7 min total · SMTP wait + confirm nav + signin + verify + cleanup
    },
  ],
});
