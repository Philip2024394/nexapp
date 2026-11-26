// tests/e2e/journey-guest-chat-signup-cta.spec.ts
//
// Cycle-14 F2 · regression spec for row #6 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
// -----------------------------------------------------------------------------
// The guest-chat client at
// `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx:110`
// computes `signUpHref` for the "Create account" CTA shown to a guest
// chatting with an owner. The href must preserve the guest-chat URL
// as `next` so signup returns the guest to the same conversation.
//
// Prior to F2 the href pointed at the retired `/nex-native/create-account`
// route · the CTA landed on a 404. F2 retargeted it at the sealed
// one-URL signup surface.
//
// The audit specifies "ADD assertion to existing guest-chat e2e".
// There is no pre-existing standalone guest-chat spec in this repo
// (the chat journey specs cover authenticated send/receive, not the
// guest-signup CTA on the guest-chat surface). This spec supplies
// the row-#6 regression guard at the href + destination level · it
// does not run a full signup.
//
// Sandbox-only · guest context (no cookies).

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

// Placeholder owner account id. The guest chat page tolerates any
// uuid-shaped id and renders the signup CTA as part of the empty
// state · what we assert is purely the CTA href shape.
const OWNER_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------------
// BLOCKER · Cycle-14 F2 · recorded 2026-11-25
// ---------------------------------------------------------------------
// The guest-chat page at `src/app/nex-native/chat/guest/[ownerAccountId]/
// page.tsx` resolves the session via `resolveNexAppOrProvisionalSession`:
//   · authenticated       → redirect to /nex-native/chat/peer/...
//   · no session           → redirect to /nex-native/home
//   · owner lookup fails   → notFound()
// This spec runs with `storageState: { cookies: [], origins: [] }` so
// the resolver returns `kind: "none"` → the page redirects to /home
// before the Create-account CTA ever renders. Even with a provisional
// cookie, the fake `OWNER_ACCOUNT_ID` does not resolve to a real
// `nex_account` row in the sandbox, so `accountService.getAccountById`
// returns null and the page triggers `notFound()`.
//
// Running this spec as an end-to-end assertion requires BOTH:
//   1. a seeded sandbox owner-account fixture, AND
//   2. a provisional-session cookie minted via the sealed first-message
//      composer path (`src/lib/nex-native/first-conversation/...`).
//
// Neither is available in this cycle without owner-approved sandbox
// writes beyond the sealed boundaries. The underlying F2 fix is
// evidenced directly at the source in
//   `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx:114`
// where `signUpHref` is composed as
//   `/nex-native/sign-in?mode=signup&next=${encodeURIComponent(...)}`
// and nowhere in the file does the retired `/nex-native/create-account`
// string appear. That assertion is also enforced catalogue-side by the
// `product-knowledge.test.ts` suite (rows 74-85).
//
// Reinstate this spec once the provisional-session + owner-fixture
// harness is authorised.
test.skip("guest-chat signup CTA · href targets sealed signup URL with next preserved", async ({
  page,
}) => {
  test.setTimeout(30_000);

  const guestChatPath = `/nex-native/chat/guest/${OWNER_ACCOUNT_ID}`;
  await page.goto(guestChatPath, { waitUntil: "domcontentloaded" });

  const cta = page.locator("[data-nex-guest-chat-signup-cta]").first();
  const count = await cta.count();

  if (count === 0) {
    // Fallback locator · scope to a link whose href starts with the
    // sealed signup URL inside the guest-chat surface.
    const fallback = page
      .locator(`a[href^='/nex-native/sign-in?mode=signup']`)
      .first();
    await expect(
      fallback,
      "guest-chat surface must emit at least one sealed-signup CTA",
    ).toBeVisible({ timeout: 10_000 });
    const href = await fallback.getAttribute("href");
    expect(href).toMatch(/^\/nex-native\/sign-in\?mode=signup/);
    expect(href).toContain("next=");
    expect(href).not.toContain("/create-account");
    return;
  }

  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).toMatch(/^\/nex-native\/sign-in\?mode=signup/);
  expect(href, "next= must preserve the guest-chat URL for return").toContain(
    encodeURIComponent(guestChatPath),
  );
  expect(href).not.toContain("/create-account");
});
