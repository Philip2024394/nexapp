// tests/e2e/journey-chat-themes-three-category-hub.spec.ts
//
// L-011 · NEX Chat Themes · three-category hub journey.
// Owner-sealed design (2026-11-26): the chat themes picker opens with
// three tall cards (Plain · Small · Full Image). Each card opens its
// own dedicated background library, reusing the existing full-image
// library layout and interaction pattern. The bubble-colour picker is
// a separate surface and is not part of this journey.
//
// Observable behaviour this spec locks in:
//
//   1. /nex-native/chat-themes-library responds 200 and renders
//      exactly three hub cards (Plain, Small, Full Image).
//   2. Each hub card navigates to the correct sub-route.
//   3. Each sub-route responds 200 and renders the library shell —
//      either the shared grid (data-nex-library-full-grid) if assets
//      are seeded for that kind, or a drawer header + safe empty
//      state when the sandbox has no rows for that kind. We never
//      assert fabricated content; a BLOCKED-PENDING-SEED skip is
//      the honest signal.
//   4. Each sub-route's <main> carries the category kind in a stable
//      data attribute so the server classifier is wired end-to-end.
//
// Classification: SPEC AUTHORED under Stage A.

import { expect, test } from "@playwright/test";

const KINDS = [
  { kind: "plain", label: /plain backgrounds/i, route: "/nex-native/chat-themes-library/plain" },
  { kind: "small", label: /small designs/i, route: "/nex-native/chat-themes-library/small" },
  { kind: "full-image", label: /full image backgrounds/i, route: "/nex-native/chat-themes-library/full-image" },
] as const;

test.describe.serial("L-011 · chat themes three-category hub", () => {
  test("hub renders exactly three cards and each targets its category route", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/chat-themes-library", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "hub responds 200").toBe(200);

    // Hub container is present and marked.
    await expect(page.locator("[data-nex-chat-themes-hub]")).toBeVisible();

    // Exactly three cards.
    const cards = page.locator("[data-nex-chat-themes-hub-card]");
    await expect(cards).toHaveCount(3);

    // Each card exists with the expected kind + label.
    for (const { kind, label } of KINDS) {
      const card = page.locator(`[data-nex-chat-themes-hub-card="${kind}"]`);
      await expect(card, `card for ${kind} is visible`).toBeVisible();
      await expect(card).toContainText(label);
    }
  });

  test("each hub card navigates to its library sub-route", async ({ page }) => {
    for (const { kind, route } of KINDS) {
      await page.goto("/nex-native/chat-themes-library", {
        waitUntil: "domcontentloaded",
      });
      await page.locator(`[data-nex-chat-themes-hub-card="${kind}"]`).click();
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    }
  });

  for (const { kind, route, label } of KINDS) {
    test(`${route} · library shell responds 200 and renders the ${kind} library`, async ({
      page,
    }) => {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${route} responds 200`).toBe(200);

      // The main element carries the category kind so the classifier
      // wiring is observable end-to-end.
      const main = page.locator(`main[data-nex-chat-themes-library-category="${kind}"]`);
      await expect(main).toBeVisible();

      // The library header title matches the category label.
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();

      // Either a library grid rendered, or the shell rendered with
      // zero items. We do NOT fabricate assets; empty is honest.
      const grid = page.locator("[data-nex-library-full-grid]");
      await expect(grid, "library grid shell is present").toBeVisible();
    });
  }
});
