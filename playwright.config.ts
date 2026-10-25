// playwright.config.ts
//
// B2 · mobile end-to-end verification harness · 2026-10-14.
//
// This is a MINIMAL Playwright configuration added to prove the real
// NEX mobile experience in a running browser. The brief's B2 asked
// specifically for "mobile end-to-end verification, starting with the
// first-user journey and existing Playwright setup."
//
// What this configuration does:
//   · Targets http://localhost:3008 (the running NEX dev server) as
//     the live under-test instance. The dev server is NOT started by
//     this config · it must already be up (and currently is).
//   · Runs one project: iPhone 12 Pro viewport (390x844) via the
//     bundled Chromium.
//   · Captures a trace on any failure for debugging.
//   · Keeps screenshots on failure only, so the repo doesn't fill
//     with per-run artifacts.
//
// What this configuration does NOT do:
//   · Does NOT start the dev server (webServer intentionally omitted;
//     the server is already running under the owner's dev session).
//   · Does NOT configure a global auth setup. The signed-in first-
//     user journey remains blocked until the owner either provisions
//     a test account OR authorises a test-only auth helper.
//   · Does NOT install any browser (Playwright 1.64.0 and its
//     chromium-1248 build are already present in
//     ~/AppData/Local/ms-playwright/).
//   · Does NOT alter package.json or add a run script. Invoke via:
//
//         ./node_modules/.bin/playwright test
//
// See docs/doctrine/nex-mobile-e2e-first-visit-verification-2026-10-14.md
// for the result report and the explicitly-named auth-journey gap.

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
      // Pixel 7 uses Chromium internally · matches the installed
      // chromium-1248 browser binary. iPhone 12 Pro would require
      // webkit-2370 which is not installed; downloading it is a
      // dependency-install operation that the current task's rules
      // forbid without separate owner authorisation.
      //
      // Phone-sized viewport is the brief's actual requirement
      // (not iOS-specific). Pixel 7 is 412×915 with touch + mobile
      // flags · satisfies the mobile emulation contract.
      name: "mobile-chromium-pixel7",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile-public-surfaces\.spec\.ts/,
    },
    {
      // B2 Phase 2 · signed-in journey · Pixel 7 viewport AND the
      // owner-generated storage state. The state file is produced
      // ONCE via an interactive sign-in command (see Section 3 of
      // docs/doctrine/nex-mobile-e2e-authenticated-first-user-
      // journey-2026-10-14.md). Running this project without the
      // state file will error immediately with "Cannot read file:
      // tests/e2e/.auth/state.json" · which is the expected safety
      // behaviour until the owner provides the state.
      //
      // The state file is gitignored at .gitignore:321 so cookies
      // and session tokens never touch the Git history.
      name: "mobile-chromium-pixel7-authed",
      use: {
        ...devices["Pixel 7"],
        storageState: "tests/e2e/.auth/state.json",
      },
      testMatch: /mobile-authenticated-journey\.spec\.ts/,
    },
    {
      // Phase 2 · G2 · Live Commerce public surfaces (no auth,
      // no applied migrations). Verifies the fail-open contract on
      // the public routes: central feed renders, viewer gates to
      // sign-in for guests, directory landing renders with zero
      // live chips when Migration 219 is unapplied.
      name: "mobile-chromium-pixel7-live-public",
      use: { ...devices["Pixel 7"] },
      testMatch: /live-commerce-public-surfaces\.spec\.ts|live-commerce-viewer-footer\.spec\.ts|live-commerce-visual-verify\.spec\.ts|live-commerce-video-journey\.spec\.ts|live-footer-3-dots-container\.spec\.ts|composer-overflow-diag\.spec\.ts|composer-overflow-regression\.spec\.ts|live-header-ping-and-ai-chip\.spec\.ts|live-footer-products-flow\.spec\.ts|sign-in-composer-overflow\.spec\.ts|_capture-products-flow\.spec\.ts|_capture-dev-roles\.spec\.ts|_capture-counts\.spec\.ts/,
    },
  ],
});
