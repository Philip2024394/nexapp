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
      testMatch: /mobile-public-surfaces\.spec\.ts|regression-sign-in-public-branches\.spec\.ts/,
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
        /journey-returning-signed-out-D-to-signin\.spec\.ts|journey-directory-browse-and-filter\.spec\.ts|journey-signed-out-browse-buy-auth-gate\.spec\.ts|full-viewport-chrome\.spec\.ts|pwa-install-cadence\.spec\.ts|location-permission-explanation-card\.spec\.ts|nav-dead-link-crawl\.spec\.ts|journey-first-user-A-to-contacts\.spec\.ts|journey-chat-send-e2e\.spec\.ts|journey-chat-attachment-encrypted-image\.spec\.ts|journey-chat-attachment-encrypted-document\.spec\.ts|journey-chat-attachment-fail-safe-503\.spec\.ts|journey-chat-attachment-non-participant-404\.spec\.ts|journey-chat-attachment-legacy-public-envelope-resolve\.spec\.ts|journey-create-shop\.spec\.ts|journey-buyer-checkout\.spec\.ts|journey-chat-theme-apply-free\.spec\.ts|journey-chat-theme-first-free-apply\.spec\.ts|journey-chat-theme-region-unsupported-waitlist\.spec\.ts|journey-mid-shop-setup-interrupt-resume\.spec\.ts|journey-mid-checkout-session-expired\.spec\.ts|journey-buyer-signed-out-purchase-resume\.spec\.ts|journey-buyer-ordinary-signin\.spec\.ts|journey-ask-seller-nonowner-full\.spec\.ts|journey-buyer-signup-wiring\.spec\.ts|journey-buyer-adversarial\.spec\.ts|diagnostic-ask-seller-send-handler\.spec\.ts|smoke-why-nex\.spec\.ts|smoke-switch-calculator\.spec\.ts|security-account-isolation\.spec\.ts|why-nex-editorial-verification\.spec\.ts|full-viewport-extended-coverage\.spec\.ts|journey-post-signup-apply-theme\.spec\.ts|journey-full-guest-signup-pick-theme\.spec\.ts|journey-pending-wall-race-conditions\.spec\.ts|journey-selected-theme-cookie-signup\.spec\.ts|journey-pending-wall-security-regressions\.spec\.ts|journey-vault-standalone-access\.spec\.ts|journey-theme-viewer-organic-signup\.spec\.ts|journey-visitor-claim-signup\.spec\.ts|journey-unauth-checkout-signup-return\.spec\.ts|journey-welcome-intent-pick-theme\.spec\.ts|journey-kind-select-signup\.spec\.ts|journey-guest-chat-signup-cta\.spec\.ts|fixture-harness-smoke\.spec\.ts|journey-merchant-order-t8\.spec\.ts|journey-merchant-order-t8-ui-loop\.spec\.ts|journey-payment-status-t10\.spec\.ts|journey-stripe-webhook-t10\.spec\.ts|journey-paypal-webhook-t10\.spec\.ts|journey-manage-shopless-redirect\.spec\.ts|journey-chat-themes-three-category-hub\.spec\.ts|regression-l013-canonical-connectivity\.spec\.ts|journey-product-publish-to-storefront\.spec\.ts|journey-merchant-onboarding-full-ui\.spec\.ts|journey-merchant-edit-product-archive-ui\.spec\.ts|regression-identity-chrome-contract\.spec\.ts|journey-merchant-orders-centre-ui\.spec\.ts|regression-spec-payload-helper\.spec\.ts|journey-merchant-product-spec-editor-ownership-ui\.spec\.ts|journey-merchant-menu-item-ownership-ui\.spec\.ts|journey-merchant-accommodation-room-ownership-ui\.spec\.ts|journey-merchant-product-edit-ownership-ui\.spec\.ts|journey-merchant-product-interest-ownership-ui\.spec\.ts|regression-l036-order-detail-hydration\.spec\.ts|journey-drawer-rows-signed-in-merchant-ie\.spec\.ts|journey-drawer-rows-buyer-ie\.spec\.ts|journey-drawer-rows-guest-ie\.spec\.ts|journey-drawer-rows-hq-ie\.spec\.ts|regression-l042-orders-list-hydration\.spec\.ts|journey-country-selection-business-details\.spec\.ts|journey-chat-fresh-buyer-ask-seller-2026-11-26\.spec\.ts|journey-single-app-07-role-country-currency\.spec\.ts|journey-single-app-02-ip-pickup\.spec\.ts|journey-single-app-06-checkout-region\.spec\.ts|regression-l043-chat-portrait-bloom-hydration\.spec\.ts|journey-free-chat-first-visit-three-category-cards\.spec\.ts|journey-free-chat-cookie-signup\.spec\.ts|journey-plain-themes-library\.spec\.ts/,
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
    // L-027 2026-11-26 · "mobile-chromium-pixel7-live-public" project
    // REMOVED. All 21 specs it matched target the Live Commerce
    // surface that was deleted by owner-sealed scope reduction in
    // commit 2619f8ca on 2026-11-06 ("Phase 1c Batch 4 · Delete Live
    // Commerce surface · 89 files"). The specs' target routes
    // (`/nex-native/live-commerce/feed`, `/nex-native/live-commerce/
    // [sessionId]`, `/nex-native/videos/dev-video-*`) now 404, and
    // their data-attribute selectors (`data-nex-live-footer-*`,
    // `data-nex-live-viewer-*`) only exist on orphan components that
    // nothing under `src/app/*` imports. Running these specs produced
    // 55 false-positive regression failures per the L-012 regression
    // envelope. `create-page-visual.spec.ts` is also stale — the
    // `/nex-native/create` landing page has no page.tsx; the drawer
    // links go direct to `/nex-native/create/product/category`.
    //
    // This is NOT a test-weakening: no assertion is loosened. The
    // config is being brought in line with the already-sealed scope
    // decision. Spec files remain on disk pending a separate owner-
    // approved deletion commit (same disposition as L-024 followup).
    // If Live Commerce is ever resurrected, the original project
    // block is in git history at `playwright.config.ts@HEAD~1`.
  ],
});
