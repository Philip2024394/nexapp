// playwright.p6-isolation.config.ts
//
// P6 · two-context isolation config · 2026-11-14.
// Uses :3010 dev server which is started WITHOUT the sealed
// dev-impersonation env var so real email/password sign-in works.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-p6-isolation",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "two-context-isolation-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /two-context-isolation\.spec\.ts/,
    },
    {
      // 2026-11-14 · browser verification of the two newly-built Vault
      // surfaces (Contacts + Settings). Same mobile viewport.
      name: "vault-surfaces-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-surfaces\.spec\.ts/,
    },
    {
      // 2026-11-14 · bounded acceptance pass · drives the sealed
      // setup wizard then asserts EXACT final paths + per-branch
      // behavior for Contacts + Settings under a configured Vault.
      name: "vault-acceptance-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-acceptance\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-14 · bounded chat-behavior pass · sends a real
      // message via the sealed /chat/peer surface post-unlock, then
      // observes the Lock Now gate at /vault/home/chats/[id].
      name: "vault-chat-behavior-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-chat-behavior\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-14 pass 2 · UI-driven text + photo + document send
      // via the sealed composer (keypad user-pref set to "os" to
      // bypass the virtual keypad). Then observes exactly what the
      // sealed standard chat does post-Lock-Now (reported honestly).
      name: "vault-chat-ui-behavior-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-chat-ui-behavior\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-15 · Part C bounded audit · 6-tile landing grid +
      // honest password-and-recovery panel.
      name: "vault-landing-tiles-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-landing-tiles\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-15 · Phase 5 (vault escrow/lockout) · drives 3 wrong
      // PIN attempts and asserts the lockout screen landing. Pairs with
      // migrations 346/347 + Phase 3 UI.
      name: "vault-lockout-threshold-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-lockout-threshold\.spec\.ts/,
      timeout: 180_000,
    },
    {
      // 2026-11-15 · Phase 5 · issue reset email → harvest token via
      // the dev-only harness → consume at /vault/reset → assert
      // success + 3 fresh attempts restored.
      name: "vault-reset-flow-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-reset-flow\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-15 · Checkpoint 2 · sealed one-URL signup flow.
      // Drives /sign-in?mode=signup on disposable e2e-signup-* emails
      // · hard refuses Hammerex / Rosa touches.
      name: "sign-up-flow-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /sign-up-flow\.spec\.ts/,
      timeout: 180_000,
    },
    {
      // 2026-11-15 · Checkpoint 3 · seller onboarding + shop + products.
      // Real-UI browser proof of the wizard, customization, product CRUD,
      // and public storefront preview. Uses Rosa (nex-99903) for sign-in.
      // Preserves Rosa's Vault state. Creates/removes synthetic products.
      name: "seller-onboarding-flow-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /seller-onboarding-flow\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-15 · Checkpoint 4 · customer → seller → order handoff.
      // Real-UI two-context Playwright. Customer = Hammerex (nex-99901),
      // Seller = Rosa (nex-99903). Sign-in only. No Vault state changes.
      name: "customer-to-seller-order-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /customer-to-seller-order\.spec\.ts/,
      timeout: 360_000,
    },
    {
      // 2026-11-15 · D3 · dashboard product creation through the real
      // category picker + /create/product/form end-to-end. Uses a
      // disposable seller · preserves Hammerex/Rosa.
      name: "product-create-form-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /product-create-form\.spec\.ts/,
      timeout: 360_000,
    },
    {
      // 2026-11-15 · D2 · order visibility for image-less products +
      // cross-account denial. Two isolated contexts; disposable
      // seller + buyer.
      name: "order-visibility-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /order-visibility\.spec\.ts/,
      timeout: 360_000,
    },
    {
      // 2026-11-15 · CRUCIAL · session persistence across close / reopen.
      // Verifies app session persists AND Vault stays separately locked
      // after context close + reopen. Uses Hammerex (sign-in only; Vault
      // state is preserved).
      name: "session-persistence-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /session-persistence\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-15 · Phase 5 · cross-account defence · a reset token
      // for account A posted from a session signed in as account B must
      // return `token_account_mismatch` and leave A's token still live.
      name: "vault-cross-account-reset-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /vault-cross-account-reset\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-15 · #13 Stripe TEST activation E2E · authored, execution
      // gated on STRIPE_WEBHOOK_SECRET (set via `stripe listen`). Each
      // test skip-reports the exact missing operator prerequisite.
      name: "stripe-subscription-activation-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /stripe-subscription-activation\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-16 · #14 REAL activation · production code path
      // creates nex_order from cart send via createOrder({ id }).
      // Two identical carts → two distinct nex_order rows → Tier 0
      // deterministic match on seller's /manage/orders/<id>. NO
      // fixture INSERT of nex_order · everything via the real UI.
      name: "cart-order-deterministic-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /cart-order-deterministic\.spec\.ts/,
      timeout: 360_000,
    },
    {
      // 2026-11-16 · password-recovery FULL E2E · /sign-in/forgot →
      // admin-generated recovery token → /auth/confirm (recovery
      // override) → /sign-in/new-password form → updateUser →
      // /contacts. Functional proof: old password rejected, new
      // password accepted. Fresh disposable email (phillipofarrell
      // +e2e-recovery-<stamp>@gmail.com) · admin-deleted in afterAll.
      name: "password-recovery-flow-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /password-recovery-flow\.spec\.ts/,
      timeout: 300_000,
    },
    {
      // 2026-11-15 · agreed-journey missing-UI smokes · subscription
      // return/cancel · signup confirmation callback · /create/product
      // landing · any other 404 fall-through in the agreed flows.
      // Base URL respects PLAYWRIGHT_TEST_BASE_URL · falls back to
      // the standard nexapp dev port 3008 (same convention as the
      // product-linked-inquiry project · the :3010 no-impersonation
      // driver isn't required here because we drive real sign-in).
      name: "missing-ui-journeys-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /missing-ui-journeys\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-15 · CP3 · Stripe TEST-mode subscription handoff · signed
      // seller POST to /billing/checkout/shop returns a `cs_test_` URL +
      // DB still reflects pre-pay state. Does NOT drive Stripe's hosted
      // page (operator-side webhook infra required).
      name: "stripe-subscription-handoff-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /stripe-subscription-handoff\.spec\.ts/,
      timeout: 180_000,
    },
    {
      // 2026-11-15 · CP2 · product-linked inquiry · a customer opens a
      // product inquiry from a shop surface · the chosen product pins
      // to the top of the peer conversation for BOTH participants and
      // survives reload. A second product inquiry on the same shop
      // stays distinguishable from the first. Ordinary peer chats
      // (no product context) render NO pinned card. Uses TWO
      // disposable seeded products on a disposable seller plus a
      // disposable buyer · hard refuses Hammerex / Rosa.
      // Base URL respects PLAYWRIGHT_TEST_BASE_URL · falls back to
      // the standard nexapp dev port 3008 (not :3010 · that port is
      // reserved for the sealed two-context-isolation driver which
      // runs without dev-impersonation).
      name: "product-linked-inquiry-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /product-linked-inquiry\.spec\.ts/,
      timeout: 360_000,
    },
    {
      // 2026-11-21 · Lane B · /nexcorner prelaunch landing + launch-interest
      // signup. Requires mig 352 applied to sandbox (nex_prelaunch_signup)
      // + NEX_PRELAUNCH_MODE=true in the dev process.
      name: "nexcorner-prelaunch-flow-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /nexcorner-prelaunch-flow\.spec\.ts/,
      timeout: 120_000,
    },
    {
      // 2026-11-21 · Lane I · /settings/security/delete-account real-UI
      // end-to-end. Seeds a disposable e2e-delete-* auth user + matching
      // nex_account row, drives the destructive workflow through the
      // real browser, asserts DB soft-delete + auth user removal +
      // re-sign-in refusal. Hard-refuses touching Hammerex/Rosa/CK5.
      name: "account-deletion-flow-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /account-deletion-flow\.spec\.ts/,
      timeout: 180_000,
    },
    {
      // 2026-11-21 · Lane F · delivery-quote per-ring verification
      // browser e2e. Seeds nex_business.location_lat/lng + a per-ring
      // product with spec.__delivery.local.radii. Signs in CK5 buyer,
      // patches the hidden cart_payload to inject delivery_quote +
      // buyer lat/lng, asserts server acceptance / refusal paths.
      // Hard-refuses prod ref; cleans up business coords + product on
      // teardown.
      name: "delivery-quote-flow-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /delivery-quote-flow\.spec\.ts/,
      timeout: 240_000,
    },
    {
      // 2026-11-21 · Lane G · nex_invite_to_call_tx RPC integration
      // against the applied mig-357 (SECURITY DEFINER wrapper with
      // POSIX regex guard on p_attachment_url + FOR UPDATE session-row
      // lock for GB-4CAP). Not a browser spec; uses Playwright as the
      // runner and invokes the RPC via supabase-js + verifies rows
      // via direct pg. Fixtures ADMIN-PROVISIONED and cleaned up.
      // Hard-refuses prod ref + protected identities.
      name: "call-invite-rpc-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL:
          process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
      },
      testMatch: /call-invite-rpc\.spec\.ts/,
      timeout: 240_000,
    },
  ],
});
