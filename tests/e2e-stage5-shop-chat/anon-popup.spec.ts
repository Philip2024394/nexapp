// tests/e2e-stage5-shop-chat/anon-popup.spec.ts
//
// Stage 5 · Final-gap closure · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Closes spec item #1 · anon registration popup renders correctly on
// the mobile phone-frame. Requires the dev server to be running with
// NEX_DEV_IMPERSONATE_HANDLE unset (so the viewer resolves as anon).
//
// This spec runs in a dedicated process after the env toggle and is
// kept separate from the signed-in journey spec so a single Playwright
// invocation targets exactly the right server state.

import { expect, test } from "@playwright/test";

const SHOP_SLUG = "handbags-direct";
const PRODUCT_ID = "1a0eb693-4024-4a55-82d8-58ebe35d7b4a";

async function gotoFast(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Stage 5 · anon registration popup (impersonation OFF)", () => {
  test("Shop page renders for anon viewer · product sheet opens in popup mode", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const btn = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await expect(btn).toBeVisible({ timeout: 30_000 });
    // Anon branch: the button opens the Stage-4 popup instead of
    // firing openShopChatAction server action.
    await expect(btn).toHaveAttribute(
      "data-nex-product-sheet-more-details-mode",
      "popup",
    );
  });

  test("Tapping More Details opens the Stage-4 registration popup with both CTAs", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const moreBtn = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await expect(moreBtn).toBeVisible({ timeout: 30_000 });
    await moreBtn.click();

    // Popup appears portalled to document.body. Headline + explainer
    // + both CTAs must be present.
    const popup = page.locator("[data-nex-shop-chat-registration-popup]");
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // Headline interpolates the shop display name
    await expect(popup.getByText(/message handbags direct/i)).toBeVisible();

    // Honest copy: account is customer's own, replies land in customer's own NEX Chat
    await expect(
      popup.getByText(/not an account belonging to the shop/i),
    ).toBeVisible();
    await expect(
      popup.getByText(/your own nex chat/i),
    ).toBeVisible();

    // Primary CTA · Create Free Account · links to /sign-in?mode=signup
    const primary = popup.locator(
      "[data-nex-shop-chat-registration-primary]",
    );
    await expect(primary).toBeVisible();
    const primaryHref = await primary.getAttribute("href");
    expect(primaryHref).toContain("/nex-native/sign-in");
    expect(primaryHref).toContain("mode=signup");
    expect(primaryHref).toContain(
      encodeURIComponent(`/nex-native/${SHOP_SLUG}?open-chat=1&product=${PRODUCT_ID}`),
    );

    // Secondary CTA · Sign In · also carries the Stage-3 next= chain
    const secondary = popup.locator(
      "[data-nex-shop-chat-registration-secondary]",
    );
    await expect(secondary).toBeVisible();
    const secondaryHref = await secondary.getAttribute("href");
    expect(secondaryHref).toContain("/nex-native/sign-in");
    expect(secondaryHref).not.toContain("mode=signup");
    expect(secondaryHref).toContain(
      encodeURIComponent(`/nex-native/${SHOP_SLUG}?open-chat=1&product=${PRODUCT_ID}`),
    );
  });

  test("Popup dismiss closes it · chip returns to its idle state", async ({
    page,
  }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const moreBtn = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await moreBtn.click();
    const popup = page.locator("[data-nex-shop-chat-registration-popup]");
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // Click the "Not now" dismiss
    await popup.locator("[data-nex-shop-chat-registration-dismiss]").click();
    await expect(popup).toBeHidden({ timeout: 5_000 });
    // The product sheet is still on screen · user hasn't navigated away
    await expect(
      page.locator(`[data-nex-product-detail-sheet="${PRODUCT_ID}"]`),
    ).toBeVisible();
  });

  test("Popup Esc key dismiss also works", async ({ page }) => {
    await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
    const moreBtn = page.locator(
      `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
    );
    await moreBtn.click();
    const popup = page.locator("[data-nex-shop-chat-registration-popup]");
    await expect(popup).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden({ timeout: 5_000 });
  });

  test("Sign-in page honours the Stage-3 next= chain end-to-end", async ({
    page,
  }) => {
    const encoded = encodeURIComponent(
      `/nex-native/${SHOP_SLUG}?open-chat=1&product=${PRODUCT_ID}`,
    );
    await gotoFast(
      page,
      `/nex-native/sign-in?mode=signup&next=${encoded}`,
    );
    // Hidden next= input carries the round-trip URL into the submit
    // action · confirms Stage 3 wiring survived through the sign-in
    // page's form.
    const nextInput = page.locator('input[name="next"]');
    await expect(nextInput).toHaveCount(1);
    await expect(nextInput).toHaveValue(
      `/nex-native/${SHOP_SLUG}?open-chat=1&product=${PRODUCT_ID}`,
    );
  });
});
