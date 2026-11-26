// tests/e2e/journey-free-chat-first-visit-three-category-cards.spec.ts
//
// L-011 · Option B · free-chat first-visit three-category cards.
// Owner directive 2026-11-27 (Option B approval): the first-visit
// interface on /nex-native/free-chat renders three vertically stacked
// category cards (Plain Backgrounds · Small Designs · Full Image
// Backgrounds). Each card opens its matching library route with the
// `from=first-visit-free-chat` query param so the library's Apply
// handler can route the pre-account viewer through a cookie-only
// persistence path back to /nex-native/free-chat. Supersedes the
// 2026-11-12 sealed six-pinned-tile FirstVisitThemeGrid.
//
// Observable behaviour this spec locks in:
//
//   1. GET /nex-native/free-chat?show-themes=1 responds 200 and
//      renders exactly three category cards under the first-visit
//      row container.
//   2. Each card points at its matching library sub-route and
//      carries the `from=first-visit-free-chat` query param.
//   3. The deprecated 2×3 six-tile grid (data-nex-free-chat-first-
//      visit-tile) is no longer rendered.
//
// Classification: SPEC AUTHORED under Stage A · fresh-cookie viewer.

import { expect, test } from "@playwright/test";

const CATEGORIES = [
  {
    kind: "plain",
    label: /plain backgrounds/i,
    pathname: "/nex-native/chat-themes-library/plain",
  },
  {
    kind: "small",
    label: /small designs/i,
    pathname: "/nex-native/chat-themes-library/small",
  },
  {
    kind: "full-image",
    label: /full image backgrounds/i,
    pathname: "/nex-native/chat-themes-library/full-image",
  },
] as const;

test.describe.serial(
  "L-011 · Option B · free-chat first-visit three-category cards",
  () => {
    test.beforeEach(async ({ context }) => {
      // Fresh-cookie viewer · ensure no prior `nex-free-chat-wallpaper`
      // is set so the canvas lands in the `picker` stage with themeId
      // null, which is the trigger for FirstVisitCategoryCards.
      await context.clearCookies();
    });

    test("renders exactly three category cards in the first-visit row", async ({
      page,
    }) => {
      const response = await page.goto(
        "/nex-native/free-chat?show-themes=1",
        { waitUntil: "domcontentloaded" },
      );
      expect(response?.status(), "page status").toBe(200);

      const row = page.locator("[data-nex-free-chat-category-cards]");
      await expect(row).toBeVisible();

      const cards = row.locator("[data-nex-free-chat-category-card]");
      await expect(cards).toHaveCount(3);

      for (const { kind, label } of CATEGORIES) {
        const card = row.locator(
          `[data-nex-free-chat-category-card="${kind}"]`,
        );
        await expect(card, `${kind} card renders`).toBeVisible();
        await expect(
          card.locator("text=/Open library/i"),
          `${kind} card chip`,
        ).toBeVisible();
        await expect(card.getByText(label), `${kind} title`).toBeVisible();
      }
    });

    test("each category card targets its library sub-route with the first-visit-free-chat marker", async ({
      page,
    }) => {
      await page.goto("/nex-native/free-chat?show-themes=1", {
        waitUntil: "domcontentloaded",
      });

      for (const { kind, pathname } of CATEGORIES) {
        const card = page.locator(
          `[data-nex-free-chat-category-card="${kind}"]`,
        );
        const href = await card.getAttribute("href");
        expect(href, `${kind} card href is set`).not.toBeNull();
        const url = new URL(href as string, "http://localhost:3008");
        expect(url.pathname, `${kind} card target pathname`).toBe(pathname);
        expect(
          url.searchParams.get("from"),
          `${kind} card carries from=first-visit-free-chat`,
        ).toBe("first-visit-free-chat");
      }
    });

    test("the deprecated six-tile first-visit grid no longer renders", async ({
      page,
    }) => {
      await page.goto("/nex-native/free-chat?show-themes=1", {
        waitUntil: "domcontentloaded",
      });

      const legacyTiles = page.locator(
        "[data-nex-free-chat-first-visit-tile]",
      );
      await expect(legacyTiles).toHaveCount(0);
    });
  },
);
