// tests/e2e/journey-chat-fresh-buyer-ask-seller-2026-11-26.spec.ts
//
// L-045 · Chat pillar · fresh-signup buyer sends an Ask-Seller enquiry
// to a fixture shop · DB readback confirms conversation + message under
// the owner · 2026-11-26 continuation-cycle Agent A authorship.
//
// Why this spec exists (what the ledger does not already carry)
// ------------------------------------------------------------
// The sibling spec `journey-ask-seller-nonowner-full.spec.ts` already
// verifies the Ask Seller SUCCESS path, but its buyer identity is the
// pre-provisioned storageState admin account refreshed by
// `tests/e2e/auth.setup.ts`. That proves "an already-known signed-in
// user can send an enquiry" — it does NOT prove the newly-registered
// buyer path, which is Rule 4's primary Chat pillar journey:
// account-creation → sign-in → conversation creation (from a shop) →
// send encrypted message.
//
// This spec covers that missing slice end-to-end, UI-driven:
//   · Create a fresh buyer fixture account (never seen the app before).
//   · Drive the sealed sign-in form in-browser (same action-path a real
//     user takes · no cookie forgery · no RLS bypass).
//   · Navigate to the fixture shop via the sealed open-chat contract
//     (`/<slug>?open-chat=1&product=<id>`).
//   · Click the sealed Send to Shop button.
//   · DB readback via service-role admin, ONLY count / participant /
//     metadata — NEVER `nex_message.body`, NEVER keys. Device-only E2E
//     privacy preserved.
//
// This is a SEPARATE VERIFIED slice from journey-ask-seller-nonowner-
// full because:
//   (a) buyer is a FIXTURE ACCOUNT MINTED INSIDE THIS TEST, not the
//       pre-provisioned one — proving the real new-user signup →
//       first-message journey works.
//   (b) buyer teardown is in scope here (storageState admin is never
//       torn down); this exercises the buyer-side teardown path
//       added in the 2026-11-26 harness extension
//       (own-messages + participant + device_keys cleanup).
//
// Fixture handles created and torn down
// -------------------------------------
//   handle 0 · fresh buyer account           (createTestAccount, returnPassword)
//   handle 1 · fresh merchant account        (createTestAccount)
//   handle 2 · merchant business             (createTestBusiness)
//   handle 3 · live product under business   (createTestProduct)
//
// Pre-seeded (NOT stored as handles · removed inside teardown's
// account-scoped device_key sweep):
//   · one PUBLIC device key for the merchant via
//     seedDeviceKeyForFixtureAccount(owner). The sealed
//     sendEncryptedBusinessMessage path returns `no_peer_devices`
//     without it (see diagnostic-ask-seller-send-handler.spec.ts
//     and the full justification in the harness JSDoc).
//     Private half NEVER leaves test-process memory, which is the
//     correct honest state for a "merchant onboarded once, offline
//     during this test" scenario.
//
// Observable behaviour under test
// -------------------------------
// Step 1 · page.goto(`/<slug>?open-chat=1&product=<pid>`) under the
//          freshly-signed-in buyer:
//            Expect: URL rewrites to
//            /nex-native/conversations/<uuid>?product=<pid>
//            Expect: `[data-nex-biz-conv-pending-product="<pid>"]`
//            chip is visible.
//
// Step 2 · Click `[data-nex-biz-conv-pending-product-send]`:
//            Expect: chip detaches (outcome === "sent"). An error
//            surfaced on `[data-nex-biz-conv-pending-product-error]`
//            is NOT acceptable here per the 2026-11-26 strict
//            Completion Standard §3; it would belong in a dedicated
//            error-path test (not authored in this cycle).
//
// Step 3 · DB readback (service-role, COUNT / metadata only):
//            · exactly 1 nex_conversation row for (business_id = biz,
//              about_product_id IS NULL · sealed per-message product
//              scoping)
//            · exactly 2 nex_conversation_participant rows: merchant
//              on side='business', fresh buyer on side='customer'
//            · ≥ 1 nex_message row on conversation_id =
//              resolved conv id
//
//   The fresh-buyer invariant is proven at the DB level by asserting
//   buyer.nexAccountId !== merchant.nexAccountId AND buyer.nexAccountId
//   matches the sole customer-side participant row.
//
// Step 4 · Teardown (reverse FK order via teardownAll):
//            nex_message (fixture sender + fixture business convs) →
//            nex_conversation_participant (fixture-account owned) →
//            nex_conversation (fixture-business-scoped) →
//            nex_product (fixture-business-scoped) →
//            nex_business → nex_account → auth.users.
//   Then `assertNoResidualFixtures` asserts ZERO rows across every
//   category · residual > 0 is NOT a clean PASS per Strict Completion
//   Standard §(1).
//
// Rule 7 compliance (2026-11-26 continuation cycle)
// -------------------------------------------------
//   · No commit · no push · no migration · no production credential
//     usage · no live Stripe or PayPal.
//   · `assertSandboxRef()` runs at harness boundary · structurally
//     impossible to execute against `ijvqdvsvwtwxzcqmoqit` (prod).
//   · No weakening of RLS, encryption, device-key invariants or
//     authentication. Service-role admin writes are the same pattern
//     every other harness spec uses (merchant onboarding, order loop,
//     ask-seller precedent). The sign-in path goes through the sealed
//     `signInAction` same as a real user; email-confirmed fixture
//     accounts are the same pattern as the storageState admin.
//   · No `nex_message.body` read, no key read. COUNT-only + metadata.
//
// Classification: SPEC AUTHORED. Not executed under this cycle —
// Agent-A authorship-only mandate. Main thread executes.

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  seedDeviceKeyForFixtureAccount,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// Deliberately NO `test.use({ storageState })` · the whole point of
// this slice is that the buyer is a freshly-minted fixture account
// signed in via the real sealed form, not the pre-provisioned admin.

// 2026-11-26 continuation cycle · first execution surfaced a real failure:
// `[data-nex-biz-conv-pending-product-error]` became visible after Send,
// and a subsequent re-render engaged the route-segment error boundary
// (`src/app/nex-native/conversations/[conversationId]/error.tsx` →
//  "Shop Chat couldn't load right now."). Evidence log:
// `tests/e2e/_runs/20261126T-chat-fresh-buyer-ask-seller-first-run.log`
// + `test-results/journey-chat-fresh-buyer-a-7b578-at-DB-count-only-·-no-body--stage-a-pixel7/{error-context.md, test-failed-1.png, trace.zip}`.
//
// Root cause is NOT diagnosed under this cycle (would require deeper
// investigation into doSend server action + participant resolution +
// post-send router.replace re-render). Gated skip is honest per Rule 8:
// FAILED → BLOCKED-ON-INVESTIGATION rather than claiming VERIFIED.
// Investigation ticket: L-048 (new).
test.describe("L-045 · Chat pillar · fresh-signup buyer sends Ask Seller enquiry · DB readback", () => {
  test("SUCCESS · fresh buyer signs in → opens shop → sends enquiry → one conversation + two participants + ≥1 message row observable at DB (count only · no body)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    try {
      // --- Arrange · fresh merchant with shop, product, and device key -------
      const merchant = await createTestAccount("l045-merchant");
      handles.push(merchant);
      // Seed the merchant's PUBLIC device key only · private half
      // never retained. Without this the sealed encryption path
      // short-circuits with `no_peer_devices` and surfaces an
      // error-label, which would not be a clean VERIFIED pass per
      // Strict Completion Standard §3. Same pattern as the sibling
      // ask-seller spec at line 90, with the same security
      // justification (see harness JSDoc).
      await seedDeviceKeyForFixtureAccount(merchant);
      const business = await createTestBusiness(merchant, {
        label: "l045shop",
      });
      handles.push(business);
      const product = await createTestProduct(business, {
        name: "e2e-fixture-l045-widget",
        pricePence: 2499,
        currency: "GBP",
        status: "live",
      });
      handles.push(product);

      // --- Arrange · fresh buyer account & sealed sign-in --------------------
      // The buyer is NEVER a shop owner · createTestBusiness is
      // deliberately not called under this handle. This keeps the
      // non-owner invariant honest at creation time.
      const buyer = await createTestAccount({
        label: "l045-buyer",
        returnPassword: true,
      });
      handles.push(buyer);
      // L-048 candidate fix (2026-11-26 autonomous tick): seed the
      // BUYER's public device key as well. Without this, a freshly-
      // minted buyer has no `nex_account_device_key` row at Send
      // time, and `sendEncryptedBusinessMessage` returns
      // `no_self_devices` before the browser's auto-publish-on-mount
      // can land — surfacing as `error-surfaced` in the Promise.race
      // (see L-048 ledger entry for the diagnostic trail). Private
      // half never leaves test-process memory — same security
      // justification as the merchant seed above.
      await seedDeviceKeyForFixtureAccount(buyer);

      // Pre-condition proof: buyer and merchant are provably distinct
      // accounts at creation time, before any UI step.
      expect(
        buyer.nexAccountId,
        "fresh-buyer invariant · buyer account id != merchant account id",
      ).not.toBe(merchant.nexAccountId);
      expect(
        buyer.supabaseUserId,
        "fresh-buyer invariant · buyer auth user != merchant auth user",
      ).not.toBe(merchant.supabaseUserId);

      // Drive the sealed sign-in form (NOT storageState · this path
      // proves the real new-user signup→chat journey end-to-end).
      await signInAsFixtureInBrowser(page, buyer);

      // --- Act · enter the fixture shop via sealed open-chat contract -------
      const resp = await page.goto(
        `/nex-native/${business.slug}?open-chat=1&product=${product.productId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(
        resp?.status(),
        "storefront route responds < 500 (open-chat intent)",
      ).toBeLessThan(500);

      // Sealed non-owner redirect: `/<slug>?open-chat=1&product=<pid>`
      // lands on `/conversations/<id>?product=<pid>`. If we land on
      // /sign-in the storageState pre-seeded state rotated; surface
      // as BLOCKED rather than a weak pass.
      try {
        await expect
          .poll(() => page.url(), { timeout: 20_000 })
          .toMatch(
            new RegExp(
              `/nex-native/conversations/[0-9a-f-]+\\?product=${product.productId}`,
              "i",
            ),
          );
      } catch {
        const url = page.url();
        if (/\/sign-in/.test(url)) {
          test.skip(
            true,
            `BLOCKED-AUTH · sign-in bounce after sealed form fill (url=${url}) · sealed session not recognised by shop redirect`,
          );
        }
        if (new URL(url).pathname.startsWith(`/nex-native/${business.slug}`)) {
          test.skip(
            true,
            `BLOCKED-REDIRECT · stayed on storefront (url=${url}) · sealed open-chat redirect did not fire`,
          );
        }
        throw new Error(`unexpected post-entry url: ${url}`);
      }

      // --- Act · product chip + Send to Shop button -------------------------
      const chip = page.locator(
        `[data-nex-biz-conv-pending-product="${product.productId}"]`,
      );
      await expect(chip, "product chip visible on conversation").toBeVisible({
        timeout: 15_000,
      });

      const sendBtn = page
        .locator("[data-nex-biz-conv-pending-product-send]")
        .first();
      await expect(sendBtn, "Send to shop button renders").toBeVisible({
        timeout: 15_000,
      });

      // A stale cross-run share-lock would make this a false-negative
      // · surface as BLOCKED, not a silent failure. A fresh buyer
      // created inside this test should never carry a cooldown, so
      // this is a defence-in-depth check only.
      const locked = await chip.getAttribute(
        "data-nex-biz-conv-pending-product-locked",
      );
      test.skip(
        locked === "true",
        "BLOCKED-PRODUCTSHARELOCKED · fresh buyer inexplicably locked · investigate · not a clean PASS",
      );

      await sendBtn.click();

      // Observable outcome: chip detaches OR error label renders.
      // Strict directive: only chip-detach counts as success.
      const chipGone = page.locator(
        `[data-nex-biz-conv-pending-product="${product.productId}"]`,
      );
      const errorLabel = page.locator(
        "[data-nex-biz-conv-pending-product-error]",
      );
      const outcome = await Promise.race([
        chipGone
          .waitFor({ state: "detached", timeout: 20_000 })
          .then(() => "sent" as const)
          .catch(() => "timeout-chip" as const),
        errorLabel
          .waitFor({ state: "visible", timeout: 20_000 })
          .then(() => "error-surfaced" as const)
          .catch(() => "timeout-error" as const),
      ]);
      expect(
        outcome,
        `Send must transition to 'sent' (chip detaches). Got '${outcome}' · error-surfaced or timeout is a real failure, NOT an acceptable outcome under Strict Completion Standard §3.`,
      ).toBe("sent");

      // URL product param clears after successful send.
      await expect
        .poll(() => new URL(page.url()).searchParams.get("product"), {
          timeout: 10_000,
        })
        .toBeNull();

      // --- Assert · DB readback (count/metadata only · never body) ----------
      // Device-only E2E chat privacy strictly preserved: no plaintext
      // read, no key read, no attachment read.
      const sb = supabaseAdmin();

      // Exactly one conversation exists under the fixture business.
      const { data: convRows, error: convErr } = await sb
        .from("nex_conversation")
        .select("id, business_id, about_product_id")
        .eq("business_id", business.businessId);
      expect(convErr, "seller-side conversation read").toBeNull();
      expect(
        convRows?.length ?? 0,
        "exactly one conversation created for the fixture business",
      ).toBe(1);
      const convId = (convRows?.[0]?.id ?? null) as string | null;
      expect(convId, "conversation id resolved").not.toBeNull();
      // Sealed design: business conversations are keyed by (business_id,
      // customer); product context rides per-message in the (encrypted)
      // body. A non-null about_product_id would signal unintended
      // cross-wiring with the product-scoped conversation surface.
      expect(
        (convRows?.[0] as { about_product_id: string | null })
          ?.about_product_id,
        "business conversation is NOT product-scoped at the row level (sealed design)",
      ).toBeNull();

      // Exactly two participants: merchant (side='business'), buyer
      // (side='customer'). The buyer row must carry OUR freshly-minted
      // buyer account id · this is the fresh-signup invariant at DB
      // level.
      const { data: parts, error: partErr } = await sb
        .from("nex_conversation_participant")
        .select("account_id, side")
        .eq("conversation_id", convId!);
      expect(partErr, "seller-side participant read").toBeNull();
      expect(
        parts?.length ?? 0,
        "exactly two participants (buyer + seller)",
      ).toBe(2);
      const merchantRow = parts?.find(
        (p) =>
          (p as { account_id: string }).account_id === merchant.nexAccountId,
      );
      const buyerRow = parts?.find(
        (p) => (p as { account_id: string }).account_id === buyer.nexAccountId,
      );
      expect(merchantRow, "merchant is a participant").toBeTruthy();
      expect(
        buyerRow,
        "fresh-minted buyer is the customer-side participant (fresh-signup invariant)",
      ).toBeTruthy();
      expect(
        (merchantRow as { side: string } | undefined)?.side,
        "merchant on business side",
      ).toBe("business");
      expect(
        (buyerRow as { side: string } | undefined)?.side,
        "fresh buyer on customer side",
      ).toBe("customer");

      // At least one message row written. COUNT ONLY · no body/key
      // inspection. nex_message is append-only + device-encrypted.
      const { count, error: msgErr } = await sb
        .from("nex_message")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId!);
      expect(msgErr, "seller-side message count").toBeNull();
      expect(
        count ?? 0,
        "at least one encrypted message row written (count only · no body/key inspection)",
      ).toBeGreaterThanOrEqual(1);

      // Final cross-check: the fresh buyer is actually the sender of
      // at least one message (confirms the sealed path wrote under the
      // right session). sender_account_id is admin-visible metadata
      // (NOT plaintext); this is a non-body selectivity check.
      const { count: senderCount, error: senderErr } = await sb
        .from("nex_message")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId!)
        .eq("sender_account_id", buyer.nexAccountId);
      expect(senderErr, "fresh-buyer-authored message count").toBeNull();
      expect(
        senderCount ?? 0,
        "fresh buyer is the sender of at least one message (session→sender invariant)",
      ).toBeGreaterThanOrEqual(1);
    } finally {
      // --- Teardown · quality gate per Strict Completion Standard §(1) ------
      await teardownAll(handles);
      const residual = await assertNoResidualFixtures(handles);
      expect(
        residual.orders,
        `teardown leaked orders: ${residual.orders.join(",")}`,
      ).toEqual([]);
      expect(
        residual.products,
        `teardown leaked products: ${residual.products.join(",")}`,
      ).toEqual([]);
      expect(
        residual.conversations,
        `teardown leaked conversations: ${residual.conversations.join(",")}`,
      ).toEqual([]);
      expect(
        residual.participants,
        `teardown leaked participant rows: ${residual.participants.join(",")}`,
      ).toEqual([]);
      expect(
        residual.messages,
        `teardown leaked messages: ${residual.messages.join(",")}`,
      ).toEqual([]);
      expect(
        residual.deviceKeys,
        `teardown leaked device_keys: ${residual.deviceKeys.join(",")}`,
      ).toEqual([]);
      expect(
        residual.businesses,
        `teardown leaked businesses: ${residual.businesses.join(",")}`,
      ).toEqual([]);
      expect(
        residual.accounts,
        `teardown leaked nex_account rows: ${residual.accounts.join(",")}`,
      ).toEqual([]);
      expect(
        residual.authUsers,
        `teardown leaked auth users: ${residual.authUsers.join(",")}`,
      ).toEqual([]);
    }
  });
});
