// playwright.product-upload.config.ts
//
// Owner-authorised 2026-10-31 (Product Upload World-Class brief ·
// Technical Point 3 "real interaction testing"). Browser-based
// end-to-end test harness for the product-upload journey.
//
// Convention mirrors the sealed playwright.chat-responsive.config.ts:
//   · Targets http://localhost:3008 by default (overridable via
//     PLAYWRIGHT_TEST_BASE_URL).
//   · Does NOT start the dev server · the server is expected to be
//     running already (owner session).
//   · Runs the single e2e-product-upload spec folder.
//   · One phone viewport (390×844) · the primary NEX portrait target.
//
// The spec is SKIP-SAFE: when the required test-environment env vars
// (TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY / TEST_SELLER_
// ACCOUNT_ID / TEST_BUSINESS_ID) are absent, each test calls test.skip()
// with an explicit message. This means landing the config does NOT
// break existing CI; the tests run only when the dedicated test
// Supabase project has been provisioned and its credentials wired.
//
// Owner selected 2026-10-31: "Playwright + dedicated test Supabase
// project" per the brief. Provisioning the project itself (dashboard
// create + env-var distribution) is the owner's step.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-product-upload",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "product-upload-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
  ],
});
