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
      // Sandbox authentication setup · built 2026-11-24. Produces
      // tests/e2e/.auth/state.json by driving the sealed owner-
      // sanctioned Dev Pass sign-in flow (src/app/nex-native/sign-in/
      // page.tsx:666 + _actions.ts:877) against the local dev server.
      // Projects that need an authenticated storage state declare
      // `dependencies: ["auth-setup"]` so Playwright runs this first.
      // Uses the Pixel 7 device profile for consistency with the
      // authenticated projects below · the sign-in flow itself is
      // viewport-agnostic.
      name: "auth-setup",
      use: { ...devices["Pixel 7"] },
      testMatch: /auth\.setup\.ts$/,
    },
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
      // NEX-022 / NEX-023 · install promotion + location-permission
      // timing · owner-sealed 2026-11-24. Three projects run the same
      // spec under different device profiles so we observe platform
      // behaviour honestly. WebKit is NOT installed, so "iPhone"
      // coverage here means Chromium with the iPhone 14 Pro viewport +
      // iOS-ish user agent · NOT real Safari. That limitation is
      // reported in the spec itself so no one mistakes the run for
      // production Safari verification.
      name: "nex-pwa-install-and-location-pixel7",
      use: { ...devices["Pixel 7"] },
      testMatch: /nex-pwa-install-and-location\.spec\.ts/,
    },
    {
      name: "nex-pwa-install-and-location-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /nex-pwa-install-and-location\.spec\.ts/,
    },
    {
      name: "nex-pwa-install-and-location-iphone-emulated",
      use: { ...devices["iPhone 14 Pro"], defaultBrowserType: "chromium" },
      testMatch: /nex-pwa-install-and-location\.spec\.ts/,
    },
    {
      // NEX-024 · D3a one-time gate for /welcome/account-active ·
      // owner-sealed 2026-11-24. Pixel 7 viewport. storageState is
      // deliberately NOT set at project level · the spec opens its
      // own browser.newContext() per test, loading the auth state
      // only for authenticated scenarios. The unauth scenario runs
      // with a fresh clean context so it cannot inherit cookies.
      name: "nex-welcome-account-active-one-time-gate",
      use: { ...devices["Pixel 7"] },
      testMatch: /welcome-account-active-one-time-gate\.spec\.ts/,
    },
    {
      // Stage A Conditional Approval · 2026-11-24 · the 16 approved
      // task families (T-1.1, T-1.2 [5 sub-specs], T-2.2, T-2.5,
      // T-3.1 [2 sub-specs], T-3.3, T-4.1, T-4.3, T-4.4, T-4.5,
      // T-4.6 [2 sub-specs], T-5.1, T-5.2, T-5.3, T-5.5). Pixel 7
      // viewport across the board · each spec sets its own
      // `test.use({ storageState })` where auth is required, so no
      // project-level storageState is set here (the signed-out
      // specs rely on that absence). Authoring vs execution is a
      // separate owner permission · `npx playwright test` is NOT
      // to be run under this project until the owner authorises
      // execution.
      name: "stage-a-pixel7",
      use: { ...devices["Pixel 7"] },
      // 2026-11-24 · the auth-setup project refreshes
      // tests/e2e/.auth/state.json against sandbox before any
      // authenticated Stage A spec runs. Specs that need auth
      // continue to declare their own `test.use({ storageState })`
      // · this dependency only guarantees the state file is
      // present and sandbox-scoped.
      dependencies: ["auth-setup"],
      testMatch:
        /journey-returning-signed-out-D-to-signin\.spec\.ts|journey-directory-browse-and-filter\.spec\.ts|journey-signed-out-browse-buy-auth-gate\.spec\.ts|full-viewport-chrome\.spec\.ts|pwa-install-cadence\.spec\.ts|location-permission-explanation-card\.spec\.ts|nav-dead-link-crawl\.spec\.ts|journey-first-user-A-to-contacts\.spec\.ts|journey-chat-send-e2e\.spec\.ts|journey-chat-attachment-encrypted-image\.spec\.ts|journey-chat-attachment-encrypted-document\.spec\.ts|journey-chat-attachment-fail-safe-503\.spec\.ts|journey-chat-attachment-non-participant-404\.spec\.ts|journey-chat-attachment-legacy-public-envelope-resolve\.spec\.ts|journey-create-shop\.spec\.ts|journey-buyer-checkout\.spec\.ts|journey-chat-theme-apply-free\.spec\.ts|journey-chat-theme-first-free-apply\.spec\.ts|journey-chat-theme-region-unsupported-waitlist\.spec\.ts|journey-mid-shop-setup-interrupt-resume\.spec\.ts|journey-mid-checkout-session-expired\.spec\.ts|journey-buyer-signed-out-purchase-resume\.spec\.ts|journey-buyer-ordinary-signin\.spec\.ts|journey-ask-seller-nonowner-full\.spec\.ts|journey-buyer-signup-wiring\.spec\.ts|journey-buyer-adversarial\.spec\.ts|diagnostic-ask-seller-send-handler\.spec\.ts/,
    },
    {
      // Stage A Cycle 4 · 2026-11-24 · wire `pwa-install-cadence.spec
      // .ts` into an iPhone-emulated project so the sealed NEX-022
      // platform-aware install UI is exercised against an iOS UA.
      // WebKit is not installed; `defaultBrowserType: "chromium"`
      // keeps the run on the installed chromium-1248 binary with the
      // iPhone 14 Pro viewport + user agent. Owner directive 2026-11-
      // 24 Cycle 4 §4 explicitly flagged this as emulation, not real
      // Safari verification · we DO NOT claim real-device Safari
      // installation verification from this run.
      name: "pwa-install-cadence-iphone-emulated",
      use: { ...devices["iPhone 14 Pro"], defaultBrowserType: "chromium" },
      testMatch: /pwa-install-cadence\.spec\.ts/,
    },
    {
      // Stage A Cycle 4 · 2026-11-24 · wire `pwa-install-cadence.spec
      // .ts` into a desktop Chromium project to exercise the
      // `desktop` state branch of `_install-client.tsx`. The four
      // forbidden-window must-not-render checks are preserved.
      name: "pwa-install-cadence-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /pwa-install-cadence\.spec\.ts/,
    },
    {
      // Phase 2 · G2 · Live Commerce public surfaces (no auth,
      // no applied migrations). Verifies the fail-open contract on
      // the public routes: central feed renders, viewer gates to
      // sign-in for guests, directory landing renders with zero
      // live chips when Migration 219 is unapplied.
      name: "mobile-chromium-pixel7-live-public",
      use: { ...devices["Pixel 7"] },
      testMatch: /live-commerce-public-surfaces\.spec\.ts|live-commerce-viewer-footer\.spec\.ts|live-commerce-visual-verify\.spec\.ts|live-commerce-video-journey\.spec\.ts|live-footer-3-dots-container\.spec\.ts|composer-overflow-diag\.spec\.ts|composer-overflow-regression\.spec\.ts|live-header-ping-and-ai-chip\.spec\.ts|live-footer-products-flow\.spec\.ts|sign-in-composer-overflow\.spec\.ts|live-library-tiles\.spec\.ts|create-page-visual\.spec\.ts|_capture-products-flow\.spec\.ts|_capture-dev-roles\.spec\.ts|_capture-counts\.spec\.ts|_capture-feed-prefs\.spec\.ts|_capture-overlay-pref\.spec\.ts|_capture-heart-right\.spec\.ts|_capture-comments-behind\.spec\.ts|_capture-live-persona-bayu\.spec\.ts|_capture-live-persona-hendra\.spec\.ts/,
    },
  ],
});
