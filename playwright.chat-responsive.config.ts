// playwright.chat-responsive.config.ts
//
// NEX Chat + Call · multi-viewport responsive verification harness.
// Owner-authorised Phase 5 build 2026-10-19.
// -----------------------------------------------------------------------------
// Mirrors the Phase A3-era `playwright.themes.config.ts` pattern:
//
//   · Targets http://localhost:3008 by default (overridable via
//     PLAYWRIGHT_TEST_BASE_URL for owner sessions on 3009).
//   · Does NOT start the dev server (`webServer` intentionally omitted
//     · the server is expected to be running already).
//   · Runs ONE spec file: `tests/e2e-chat-responsive/chat-public-responsive.spec.ts`
//   · THREE viewports: 390 (phone) / 768 (tablet) / 1280 (desktop)
//
// Scope · UNAUTHENTICATED chat + call surfaces only. The authenticated
// peer-chat / live-call journey remains blocked by the auth-fixture
// gap documented in the sealed B2 config comments.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-chat-responsive",
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
      name: "chat-390",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testMatch: /chat-public-responsive\.spec\.ts/,
    },
    {
      name: "chat-768",
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
      testMatch: /chat-public-responsive\.spec\.ts/,
    },
    {
      name: "chat-1280",
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
      testMatch: /chat-public-responsive\.spec\.ts/,
    },
  ],
});
