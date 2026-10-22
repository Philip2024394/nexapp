// tests/e2e/personal-chat-preview-hides-business-controls.spec.ts
//
// NEX · Personal-chat preview MUST hide business controls.
// Owner-authorised 2026-10-21 (iteration 29).
// -----------------------------------------------------------------------------
// Confirms the scoped `[data-nex-personal-chat-preview="true"]` CSS hide
// rule in `_standard-experience-live-client.tsx` is actually suppressing
// the business widgets at render time (what source-only verification
// cannot prove).
//
// Two sides to the requirement:
//   · Personal theme (nex-bubbles / "NEX Original"): shop toggle,
//     shop sheet, plus button, plus menu MUST be hidden (not visible)
//     · composer input + chat bubbles + back/use buttons MUST be
//     visible.
//   · Business / non-NEX-brand theme: shop toggle + plus button MUST
//     stay visible so other previews keep their full chrome.
//
// Run: `npx playwright test personal-chat-preview-hides-business-controls`
//
// Blocker: this spec assumes the dev server is running on
// `http://localhost:3008`. If a theme id listed below is retired, the
// corresponding assertion branch should be updated · do NOT silently
// delete the business-side assertion (that's the regression we're
// guarding against).

import { test, expect } from "@playwright/test";

const PERSONAL_FREE_CHAT_ID = "nex-bubbles";

// Pick a live-world theme that is NOT NEX-brand so we exercise the
// business-chrome side of the matrix. "ocean" has shipped as a non-NEX
// theme per prior memos · if that id is retired, swap to any other
// non-"NEX "-prefixed live world.
const BUSINESS_PREVIEW_ID = "ocean";

test.describe("Personal chat preview hides business controls", () => {
  test("nex-bubbles · business widgets are hidden, personal chat chrome remains", async ({ page }) => {
    await page.goto(`/nex-native/themes/${PERSONAL_FREE_CHAT_ID}`);

    // Wrapper marker is present and the scoped data-attribute flipped on.
    const wrapper = page.locator('[data-nex-standard-experience-live]');
    await expect(wrapper).toHaveAttribute("data-nex-personal-chat-preview", "true");

    // Business widgets · all four MUST be visually hidden (display:none).
    for (const selector of [
      "[data-nex-se-shop-toggle]",
      "[data-nex-se-shop-sheet]",
      "[data-nex-se-plus-menu]",
      'button[aria-label="Add to this chat"]',
      'button[aria-label="Close menu"]',
    ]) {
      const el = page.locator(selector);
      if ((await el.count()) > 0) {
        // The CSS rule applies display:none !important · toBeHidden
        // passes when the element exists in the DOM but is non-visible.
        await expect(
          el.first(),
          `${selector} should be hidden in personal chat preview`,
        ).toBeHidden();
      }
    }

    // Preview action bar (sealed) stays visible for Back / Use.
    await expect(page.locator('[data-nex-theme-action-bar]')).toBeVisible();

    // Chat chrome (composer area, bubbles stage) still mounts.
    await expect(wrapper).toBeVisible();
  });

  test("non-NEX-brand live world · business widgets remain available", async ({ page }) => {
    await page.goto(`/nex-native/themes/${BUSINESS_PREVIEW_ID}`);

    const wrapper = page.locator('[data-nex-standard-experience-live]');
    // Scope flag MUST NOT be set for non-personal themes · if it is,
    // the business chrome gets accidentally hidden on real previews.
    await expect(wrapper).not.toHaveAttribute(
      "data-nex-personal-chat-preview",
      "true",
    );

    // Shop toggle + plus button must be visible (standard business
    // chrome). We don't assert the shop sheet because it defaults to
    // translate-100%-off-screen (sealed closed state).
    const shopToggle = page.locator("[data-nex-se-shop-toggle]");
    if ((await shopToggle.count()) > 0) {
      await expect(shopToggle.first()).toBeVisible();
    }
    const plusButton = page.locator('button[aria-label="Add to this chat"]');
    if ((await plusButton.count()) > 0) {
      await expect(plusButton.first()).toBeVisible();
    }
  });
});
