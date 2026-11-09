// tests/e2e/journeys/j1-create-account-first-chat.spec.ts
//
// Phase E · Journey J-1 · DRAFT.
//
// NOT runnable against the current app:
//   · Requires Phase D Sprint 5 (receive path) for the final assertion
//   · Requires sandbox fixtures (test accounts · test chat partner)
//   · Not added to playwright.config.ts testMatch · opt-in only
//
// Invocation (post Phase D):
//   npx playwright test tests/e2e/journeys/j1-create-account-first-chat.spec.ts
//
// Journey:
//   1. Visit /nex-native/create-account
//   2. Submit email + password
//   3. Verify profile step (name · country · phone)
//   4. Navigate to /nex-native/free-chat
//   5. Start conversation with test counter-party (seeded fixture)
//   6. Send a message
//   7. Verify message appears in sender's local history
//   8. V-F2-T5 · server DB has NO row in nex_peer_message with body or
//      ciphertext for this message (I-1 compliance assertion via DB API)

import { test, expect } from "@playwright/test";

const SIGNUP_EMAIL_PREFIX = "j1-" + Date.now() + "-";
const SIGNUP_PASSWORD = "Test-" + Math.random().toString(36).slice(2, 10);
const COUNTER_PARTY_HANDLE = "test-counter-party-j1";

test.describe("J-1 · create account + first chat", () => {
  test("happy path: signup → profile → first chat → send + receive", async ({ page }) => {
    await page.goto("/nex-native/create-account", { waitUntil: "networkidle" });

    await page.getByLabel(/email/i).fill(SIGNUP_EMAIL_PREFIX + "a@example.test");
    await page.getByLabel(/password/i).fill(SIGNUP_PASSWORD);
    await page.getByRole("button", { name: /create account|sign up/i }).click();

    // Expect redirect to profile edit
    await expect(page).toHaveURL(/\/nex-native\/settings\/profile\/edit/, { timeout: 15_000 });

    await page.getByLabel(/chat name|display name/i).fill("J1 Test User");
    await page.getByLabel(/country/i).click();
    await page.getByRole("option", { name: /ireland|indonesia|worldwide/i }).first().click();

    await page.getByRole("button", { name: /save|continue/i }).click();

    // Expect landing on /free-chat (post-signup)
    await expect(page).toHaveURL(/\/free-chat/, { timeout: 15_000 });

    // Start conversation with test counter-party
    await page.goto(`/nex-native/chat/${COUNTER_PARTY_HANDLE}`, { waitUntil: "networkidle" });

    const composer = page.getByRole("textbox", { name: /message|type/i });
    await composer.fill("First test message · J1 · timestamp=" + Date.now());
    await page.getByRole("button", { name: /send/i }).click();

    // Expect message visible
    await expect(page.getByText(/First test message · J1/)).toBeVisible();

    // I-1 compliance assertion is enforced at DB level by migration 325
    // (drop body/ciphertext columns · Sprint 13). Pre-Sprint-13 this
    // test SKIPS the DB assertion. Post-Sprint-13 · the DB assertion is
    // a schema check (columns don't exist). See J-1b companion spec.
  });
});
