// tests/e2e-stage5-shop-chat/shop-chat-journey.spec.ts
//
// Stage 5 · 2026-11-14 · owner-authorised build-only browser tests.
// -----------------------------------------------------------------------------
// Drives the Stages 1-4 Shop Chat customer journey against the running
// dev server at :3008 with dev-impersonation locked to `nex-99901`
// (set in `.env.local`). Fixtures come from the sealed sandbox
// (`kdstoyyeygcopkogqsyv`):
//
//   · Shop under test: handbags-direct (owned by Rosa · 99903)
//   · Product under test: 1a0eb693-… · Classic hand-stitched leather tote
//   · Foreign product (negative isolation test):
//     ebc88a97-… · belongs to irish-pride-shop, NOT handbags-direct
//
// Two Playwright-specific constraints shape the assertions below:
//
//   A. Next 16 dev server compiles routes on first hit · the default
//      `load` wait exceeds Playwright's 30s navigation timeout on
//      cold routes. We use `waitUntil: 'domcontentloaded'` plus
//      explicit element waits · same browser behaviour, honest
//      timing.
//
//   B. Each Playwright test gets a fresh BrowserContext (its own
//      localStorage / IndexedDB). The device key generated for Step
//      4's send does NOT persist into Step 5's browser · so Step 5
//      sees the muted "Product shared · open on this device to
//      view" placeholder, not the decrypted product name. That is
//      the SEALED device-only E2E contract working correctly · a
//      fresh browser SHOULD not decrypt old sent messages.
//
//      To verify the full sender-sees-own-bubble decryption path we
//      would need shared storage state across tests (new fixture
//      work · out of scope for this Stage 5 build). This spec asserts
//      on the muted placeholder (= row landed in nex_message) and
//      on the network POST shape (= Stage 2 contract fires), not
//      on the decrypted plaintext bubble.

import { expect, test } from "@playwright/test";

const SHOP_SLUG = "handbags-direct";
const PRODUCT_ID = "1a0eb693-4024-4a55-82d8-58ebe35d7b4a";
const FOREIGN_PRODUCT_ID = "ebc88a97-0323-4820-9cfd-27dd8c2bd4ff";
// Conversation id for 99901 ↔ handbags-direct · created by the
// pre-stage HTTP smoke · stable across runs because
// getOrCreateBusinessConversation is idempotent.
const CONVERSATION_ID = "b1bc59d2-ba8c-41f3-869e-6f08bdf01a27";

/** Navigate with Playwright-friendly wait semantics. Avoids the Next
 *  16 dev-mode compilation timeout on the default `load` wait. */
async function gotoFast(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Stage 5 · Shop Chat journey (signed-in 99901 · sandbox)", () => {
  test("Step 1 · shop page renders shop identity + products", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}`);
    // Shop name + product fixture both appear on the public shop
    // surface. Explicit `waitFor` (not toContainText timeout) so a
    // slow dev-mode first-paint doesn't flake the assertion.
    await expect(page.getByText("Handbags direct").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Classic hand-stitched leather tote").first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Step 2 · product detail sheet opens with Buy Now + More Details", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const sheet = page.locator(
      `[data-nex-product-detail-sheet="${PRODUCT_ID}"]`,
    );
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator(`[data-nex-product-sheet-buy-now="${PRODUCT_ID}"]`),
    ).toBeVisible();
    const moreDetails = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await expect(moreDetails).toBeVisible();
    await expect(moreDetails).toHaveAttribute(
      "data-nex-product-sheet-more-details-mode",
      "submit",
    );
  });

  test("Step 3 · More Details routes to business chat with product chip pinned", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    await page
      .locator(`[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`)
      .click();
    await page.waitForURL(/\/nex-native\/conversations\//, {
      timeout: 60_000,
      waitUntil: "commit",
    });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
    await expect(
      page.locator(`[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator("[data-nex-biz-conv-pending-product-send]"),
    ).toBeVisible();
    await expect(page.getByText("You selected").first()).toBeVisible();
  });

  test("Step 4 · Send flow · live send OR cooldown lock (both prove Stage 2)", async ({
    page,
  }) => {
    await gotoFast(
      page,
      `/nex-native/conversations/${CONVERSATION_ID}?product=${PRODUCT_ID}`,
    );
    const chip = page.locator(
      `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
    );
    await expect(chip).toBeVisible({ timeout: 30_000 });
    const sendBtn = page.locator("[data-nex-biz-conv-pending-product-send]");
    await expect(sendBtn).toBeVisible();

    // Stage 2 product-share cooldown (task #69): once self sends a
    // product card, the Send button locks until the peer replies.
    // This Playwright run inherits whatever prior state exists in
    // the sandbox conversation · the test accepts BOTH branches as
    // valid Stage 2 behaviour and records which one fired.
    const isLocked =
      (await chip.getAttribute("data-nex-biz-conv-pending-product-locked")) ===
      "true";
    const btnDisabled = await sendBtn.isDisabled();

    if (isLocked || btnDisabled) {
      // Cooldown lock is active · this is DIRECT evidence that a
      // prior Stage 2 send succeeded (the cooldown derives from a
      // self product-share row in nex_message with no subsequent
      // peer reply). We verify the user-visible lock copy and the
      // disabled state · nothing clicked this run.
      await expect(sendBtn).toHaveText(/waiting for shop reply/i);
      test.info().annotations.push({
        type: "info",
        description:
          "Stage 2 cooldown ACTIVE this run · prior product share exists · sealed task #69 behaviour.",
      });
      return;
    }

    // Button is enabled · perform the live Stage 2 send and verify
    // the on-wire contract.
    const postPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/nex-native/chat/encrypted") &&
        resp.request().method() === "POST",
      { timeout: 30_000 },
    );
    await sendBtn.click();
    const resp = await postPromise;
    expect(resp.status()).toBe(200);
    const sentJson = JSON.parse(resp.request().postData() ?? "{}") as {
      message_group_id: string;
      rows: Array<{
        attachment_type: string;
        attachment_meta?: { product_id?: string };
        body?: string | null;
        ciphertext_b64?: string;
      }>;
    };
    expect(sentJson.rows.length).toBeGreaterThan(0);
    for (const row of sentJson.rows) {
      expect(row.attachment_type).toBe("product");
      expect(row.attachment_meta?.product_id).toBe(PRODUCT_ID);
      expect(row.ciphertext_b64).toBeDefined();
      expect(typeof row.ciphertext_b64).toBe("string");
    }
    await expect(chip).toBeHidden({ timeout: 15_000 });
    test.info().annotations.push({
      type: "info",
      description:
        "Stage 2 live send FIRED this run · POST shape matches contract · chip cleared.",
    });
  });

  test("Step 5 · refresh preserves the product-share row in history", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/conversations/${CONVERSATION_ID}`);
    // The sent product-card row persists in nex_message. A fresh
    // browser context (no device key from Step 4) sees it as the
    // sealed muted placeholder · which IS the correct E2E behaviour:
    // the ciphertext is in the DB, but only a device with the right
    // key can decrypt it. We assert on presence of at least one
    // product-share row (muted OR decrypted) · both prove
    // persistence.
    const productShareRow = page.locator(
      '[data-nex-business-conv-row]:has-text("Product shared"), body:has-text("Classic hand-stitched leather tote")',
    );
    await expect(productShareRow.first()).toBeVisible({ timeout: 30_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(productShareRow.first()).toBeVisible({ timeout: 30_000 });
  });

  test("Step 6 · cross-shop product id is silently refused (chip never renders)", async ({
    page,
  }) => {
    await gotoFast(
      page,
      `/nex-native/conversations/${CONVERSATION_ID}?product=${FOREIGN_PRODUCT_ID}`,
    );
    // Wait a beat for client hydration · then assert no chip.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(
      () => undefined,
    );
    const foreignChip = page.locator(
      `[data-nex-biz-conv-pending-product="${FOREIGN_PRODUCT_ID}"]`,
    );
    await expect(foreignChip).toHaveCount(0);
    const anyChip = page.locator("[data-nex-biz-conv-pending-product]");
    await expect(anyChip).toHaveCount(0);
  });

  test("Step 7 · signed-in branch marker verified · anon popup gap recorded", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const btn = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await expect(btn).toBeVisible({ timeout: 30_000 });
    await expect(btn).toHaveAttribute(
      "data-nex-product-sheet-more-details-mode",
      "submit",
    );
    test.info().annotations.push({
      type: "info",
      description:
        "Anon popup (mode='popup') requires impersonation-OFF server session · not covered by this run.",
    });
  });
});
