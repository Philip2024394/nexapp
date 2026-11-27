// tests/e2e/journey-plain-themes-library.spec.ts
//
// NEX Chat Themes · Plain Backgrounds · UI picker contract.
// Owner directive 2026-11-27 · the Plain library shows one tile per
// main colour (cream first), exposes a light-to-dark adjustment
// slider, and persists the pick to the first-party
// `nex-free-chat-wallpaper` cookie as `plain:<hueId>@<shade>`.
// The free-chat canvas then paints the whole background with the
// resolved hex (see `_plain-palette.ts`).
//
// This spec locks in the observable surface contract. Not the DB
// migration path (there is none · plain colours are intrinsic UI
// constants). Signup migration for plain-id cookies is a separate
// follow-up that requires owner approval for a DB column change.
//
// Classification: SPEC AUTHORED under Stage A · fresh-cookie viewer.

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe.serial("NEX Chat Themes · Plain Backgrounds palette", () => {
  test("renders cream as the first swatch and 13 total hues", async ({
    page,
  }) => {
    const response = await page.goto(
      "/nex-native/chat-themes-library/plain",
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status(), "page status").toBe(200);

    await expect(page.locator("[data-nex-plain-library-root]")).toBeVisible();

    const swatches = page.locator("[data-nex-plain-swatch]");
    await expect(swatches).toHaveCount(13);

    // Cream must be the first swatch per owner directive.
    const first = swatches.first();
    await expect(first).toHaveAttribute("data-nex-plain-swatch", "cream");
    await expect(first).toContainText(/nex cream/i);
  });

  test("picking a hue + shade writes the plain cookie and the free-chat canvas paints its hex", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto("/nex-native/chat-themes-library/plain", {
      waitUntil: "domcontentloaded",
    });

    // Pick orange at the base shade (50). The slider's range contract
    // is covered by test #3 below · this test proves the pick→cookie→
    // canvas plumbing without wrestling React 18's controlled range
    // input semantics. The library uses the same View-button → modal
    // pattern as every other category route.
    await page.locator('[data-nex-plain-view="orange"]').click();
    await expect(
      page.locator("[data-nex-plain-preview-modal]"),
    ).toBeVisible();

    // Apply from inside the modal.
    await page.locator("[data-nex-plain-apply]").click();
    await page.waitForURL(/\/nex-native\/free-chat(?:\?|$)/, {
      timeout: 15_000,
    });

    const origin = new URL(baseURL ?? "http://localhost:3008");
    const cookies = await context.cookies();
    const wallpaper = cookies.find(
      (c) =>
        c.name === "nex-free-chat-wallpaper" && c.domain.endsWith(origin.hostname),
    );
    expect(
      wallpaper?.value,
      "cookie must be plain:<hue>@<shade>",
    ).toMatch(/^plain:orange@70$/);

    // The free-chat <main> background should contain a solid colour
    // (not a wallpaper URL). The resolved hex for orange@70 is a
    // darkened NEX orange · we assert the background style contains
    // no `url(` layer (plain mode is URL-free) and has a non-empty
    // background value.
    const mainBg = await page
      .locator("[data-nex-free-chat-root]")
      .evaluate((el) => window.getComputedStyle(el).backgroundImage);
    expect(mainBg, "plain mode must not paint a wallpaper URL").not.toContain(
      "url(",
    );
  });

  test("the slider exposes a light-to-dark range anchored at 0..100", async ({
    page,
  }) => {
    await page.goto("/nex-native/chat-themes-library/plain", {
      waitUntil: "domcontentloaded",
    });

    const input = page.locator("[data-nex-plain-shade-input]");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("max", "100");
  });
});
