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
  ],
});
