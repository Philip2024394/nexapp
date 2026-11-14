// playwright.stage5-shop-chat-journey.config.ts
//
// Stage 5 · 2026-11-14 · owner-authorised browser verification of the
// Stages 1-4 Shop Chat customer journey.
// -----------------------------------------------------------------------------
// Mirrors the sealed `chat-responsive` config pattern · relies on the
// running dev server at :3008 · does NOT start its own. Impersonation
// is set in `.env.local` (`NEX_DEV_IMPERSONATE_HANDLE=nex-99901`),
// so every request appears as signed-in customer 99901. This covers
// Stage 5 spec items #4 (encrypted send round-trip) and #6 (refresh
// preserves history) at the full browser layer.
//
// What this config intentionally does NOT cover:
//   · Spec item #1 (anon popup visuals) — needs the impersonation env
//     TOGGLED OFF, which would require restarting the running dev
//     server. Not performed inside this config · documented in the
//     Stage 5 final report as a remaining gap.
//   · Spec items #2 (real Supabase signup), #3 (first device-key
//     publication), #5 (second-session Rosa side) — still blocked
//     for the same reasons outlined before browser authorisation.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-stage5-shop-chat",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "shop-chat-journey-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /shop-chat-journey\.spec\.ts/,
    },
  ],
});
