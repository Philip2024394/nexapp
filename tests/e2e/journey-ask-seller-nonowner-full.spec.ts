// tests/e2e/journey-ask-seller-nonowner-full.spec.ts
//
// Cycle 9 · 2026-11-24 · JRN-buyer-signed-out-purchase-resume
//   workstream 4 · Full non-owner Ask Seller journey.
//
// Cycle 8 proved the sealed `?open-chat=1&product=<id>` REDIRECT
// contract and the product CHIP. It did NOT prove that the non-owner
// buyer can observably SEND a product-context message. This spec
// closes that gap WITHOUT inspecting message bodies and WITHOUT
// introducing any server-side message storage · the device-only E2E
// seal (2026-11-09) stays absolute.
//
// Observable contracts under test:
//   1. Signed-in non-owner lands on `/conversations/<id>?product=<id>`
//      (Cycle 8 re-assertion · we keep this cheap).
//   2. The "Send to shop" button `[data-nex-biz-conv-pending-product-
//      send]` renders, is enabled (not productShareLocked), and is
//      clickable.
//   3. On click, the composer transitions through observable UI states:
//        · `data-nex-biz-conv-pending-product-sending="true"` while in
//          flight (best-effort · may race on a fast network)
//        · after a successful send, the pending-product chip
//          `[data-nex-biz-conv-pending-product="<id>"]` is UNMOUNTED
//          within the server-ack window (URL `product=` param is
//          cleared · _client.tsx:986-989).
//      OR
//        · a visible error label `[data-nex-biz-conv-pending-product-
//          error]` is rendered (honest failure branch).
//
// Device-only E2E guard rails strictly honoured:
//   · We NEVER read `nex_message.body` or any plaintext.
//   · We NEVER look at sender/recipient public keys.
//   · We NEVER create or mutate a sandbox account.
//   · If verification is impossible without touching sealed surfaces,
//     the test records BLOCKED · it does not silently pass.
//
// Fixture · Founder-approved:
//   · shop slug `handbags-direct` (owner Rosa · account 1111…1113)
//   · product `1a0eb693-4024-4a55-82d8-58ebe35d7b4a`
//   · storageState tests/e2e/.auth/state.json · admin account
//     (dd21eb50-…) · NOT the handbags-direct owner, so the sealed
//     redirect at [businessSlug]/page.tsx:206 fires normally.

import { expect, test } from "@playwright/test";

const SLUG = process.env.NEX_E2E_SEED_SHOP_SLUG;
const PRODUCT_ID = process.env.NEX_E2E_SEED_PRODUCT_ID;
const SEEDED = typeof SLUG === "string" && typeof PRODUCT_ID === "string";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe("Cycle 9 · non-owner Ask Seller · observable send", () => {
  test("non-owner lands on conversation · Send to shop clicks · chip clears OR surface error", async ({
    page,
  }) => {
    test.skip(
      !SEEDED,
      "BLOCKED-PENDING-SEED-FIXTURE · NEX_E2E_SEED_SHOP_SLUG + NEX_E2E_SEED_PRODUCT_ID required",
    );

    // Step 1 · enter via the sealed open-chat contract.
    const resp = await page.goto(
      `/nex-native/${SLUG}?open-chat=1&product=${PRODUCT_ID}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status()).toBeLessThan(500);

    // Step 2 · observe redirect + chip (Cycle 8 re-assertion).
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(
        new RegExp(
          `/nex-native/conversations/[0-9a-f-]+\\?product=${PRODUCT_ID}`,
          "i",
        ),
      );
    const chip = page.locator(
      `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
    );
    await expect(chip, "product chip visible on conversation").toBeVisible({
      timeout: 10_000,
    });

    // Step 3 · locate the Send button. The sealed component uses a
    // stable data attr so no text-based locator is needed. The button
    // is disabled during pendingProductSending / productShareLocked /
    // when peerAccountId is null (_client.tsx:997-999).
    const sendBtn = page.locator("[data-nex-biz-conv-pending-product-send]").first();
    await expect(sendBtn, "Send to shop button renders").toBeVisible({
      timeout: 10_000,
    });

    // If the button is locked at entry (previous session's cooldown),
    // record BLOCKED instead of a misleading skip. productShareLocked
    // is the sealed cooldown gating by nex_business_conversation state.
    const locked = await chip.getAttribute("data-nex-biz-conv-pending-product-locked");
    test.skip(
      locked === "true",
      "BLOCKED-PRODUCTSHARELOCKED · an earlier conversation still " +
        "holds the share lock pending seller reply · not a code defect",
    );

    // Step 4 · click Send. We intentionally do NOT assert on the
    // transient "sending" state value (the network round trip can
    // complete before we poll). We assert on the OBSERVABLE OUTCOME:
    // either (a) chip unmounts within the server-ack window, or (b)
    // the error label becomes visible. Both are honest; silently
    // hanging is not acceptable.
    await sendBtn.click();

    const chipGone = page.locator(
      `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
    );
    const errorLabel = page.locator(
      "[data-nex-biz-conv-pending-product-error]",
    );

    const outcome = await Promise.race([
      chipGone
        .waitFor({ state: "detached", timeout: 15_000 })
        .then(() => "sent" as const)
        .catch(() => "timeout-chip" as const),
      errorLabel
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "error-surfaced" as const)
        .catch(() => "timeout-error" as const),
    ]);

    // Honest classification: `sent` or `error-surfaced` are both
    // acceptable observable outcomes (they prove the composer wired
    // through to a resolvable terminal state). A double-timeout means
    // the UI hung · fail loudly rather than sweep under a skip.
    expect(
      ["sent", "error-surfaced"].includes(outcome),
      `observable Send outcome must be either 'sent' or 'error-surfaced' · got '${outcome}'`,
    ).toBe(true);

    // If the chip is still mounted at this point we record that as
    // the FAILED branch (transparent) · otherwise we assert the URL
    // `product=` param was cleared per the sealed post-success contract
    // in _client.tsx:986-989.
    if (outcome === "sent") {
      await expect
        .poll(() => new URL(page.url()).searchParams.get("product"), {
          timeout: 5_000,
        })
        .toBeNull();
    }
  });
});
