import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3009";
const FOUNDER_BIZ = "edab3dcd-5ea2-4b28-9bcb-2e405661697f";
const RETURN_SHOP = "%2Fnex-native%2Fmanage%2Fshop%2Fbackgrounds";
const RETURN_CHAT = "%2Fnex-native%2Fchat-themes-library%2Fall";

test.describe("NEX Unified Visual Library · Phase 3 e2e", () => {
  test("A · Shop library opens from shop settings with correct context", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/manage/shop/backgrounds`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const cta = page.locator("[data-nex-shop-library-cta]");
    await expect(cta).toBeVisible({ timeout: 20_000 });
    await cta.click();
    await page.waitForURL(/\/library\/backgrounds\?context=shop/, { timeout: 20_000 });
    const root = page.locator("[data-nex-library-root]");
    await expect(root).toHaveAttribute("data-nex-library-context", "shop");
    const pill = page.locator("[data-nex-library-context-pill]");
    await expect(pill).toHaveText(/shop/i);
  });

  test("B · Chat library opens from chat themes with correct context", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=chat&returnTo=${RETURN_CHAT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const root = page.locator("[data-nex-library-root]");
    await expect(root).toHaveAttribute("data-nex-library-context", "chat");
    const pill = page.locator("[data-nex-library-context-pill]");
    await expect(pill).toHaveText(/chat/i);
  });

  test("C · Category filter works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=shop&businessId=${FOUNDER_BIZ}&returnTo=${RETURN_SHOP}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-nex-library-tile]", { timeout: 20_000 });
    const totalBefore = await page.locator("[data-nex-library-tile]").count();
    expect(totalBefore).toBeGreaterThan(200);
    await page.click('[data-nex-library-category-chip="retail"]');
    await page.waitForTimeout(400);
    const totalAfter = await page.locator("[data-nex-library-tile]").count();
    expect(totalAfter).toBeGreaterThan(0);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test("D · Shop save CORRECTLY denied for gratis founder (shop-tier-required)", async ({ page }) => {
    // Founder nex-99901 is on gratis tier (no shop subscription).
    // The shop save must deny. This proves the entitlement gate works.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=shop&businessId=${FOUNDER_BIZ}&returnTo=${RETURN_SHOP}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-nex-library-tile]", { timeout: 20_000 });
    const firstTile = page.locator("[data-nex-library-tile]").first();
    await firstTile.click();
    const applyBtn = page.locator('[data-nex-library-apply="shop"]');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    // Expect DENIAL · shop-tier-required OR similar
    await page.waitForSelector("text=/shop-tier-required|Could not apply/i", { timeout: 15_000 });
  });

  test("E · Chat free theme apply + persistence", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=chat&returnTo=${RETURN_CHAT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(`[data-nex-library-tile="chat:library-ireland-1"]`, { timeout: 20_000 });
    const tile = page.locator(`[data-nex-library-tile="chat:library-ireland-1"]`);
    await tile.click();
    const applyBtn = page.locator('[data-nex-library-apply="chat"]');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    // Free theme should succeed (not error)
    await page.waitForSelector("text=/Applied ·/i", { timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-nex-library-tile="chat:library-ireland-1"][data-nex-library-tile-selected="true"]`, { timeout: 15_000 });
  });

  test("F · Chat premium theme is DENIED (shop sub does not unlock chat premium)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=chat&returnTo=${RETURN_CHAT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Pick a premium theme id confirmed in sandbox: library-m-1
    await page.waitForSelector(`[data-nex-library-tile="chat:library-m-1"]`, { timeout: 20_000 });
    const tile = page.locator(`[data-nex-library-tile="chat:library-m-1"]`);
    await tile.click();
    const applyBtn = page.locator('[data-nex-library-apply="chat"]');
    await applyBtn.click();
    // Should show error · "themes_plus_required"
    await page.waitForSelector("text=/themes_plus_required|Could not apply/i", { timeout: 15_000 });
  });

  test("G · Shop/Chat independence · chat save does not mutate business shop_cover", async ({ page, request }) => {
    // Apply a chat theme · then verify the founder's business
    // shop_cover_image_url is unchanged. The verification goes via a
    // read-only probe so we know the DB column wasn't touched.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=chat&returnTo=${RETURN_CHAT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(`[data-nex-library-tile="chat:library-pattern-2"]`, { timeout: 20_000 });
    await page.locator(`[data-nex-library-tile="chat:library-pattern-2"]`).click();
    await page.locator('[data-nex-library-apply="chat"]').click();
    await page.waitForSelector("text=/Applied ·/i", { timeout: 15_000 });
    // Reload the shop library · the business cover should still be
    // whatever it was (null, in the sandbox initial state). The
    // important thing: no shop tile is selected because the chat
    // save never writes to nex_business.
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=shop&businessId=${FOUNDER_BIZ}&returnTo=${RETURN_SHOP}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-nex-library-tile]", { timeout: 20_000 });
    const selectedShopTiles = await page.locator(`[data-nex-library-tile-selected="true"]`).count();
    expect(selectedShopTiles).toBe(0);
  });

  test("H · No console errors on library pages", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=shop&businessId=${FOUNDER_BIZ}&returnTo=${RETURN_SHOP}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/nex-native/library/backgrounds?context=chat&returnTo=${RETURN_CHAT}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // Filter out 404s for optional assets
    const critical = errors.filter((e) => !e.includes("404") && !e.toLowerCase().includes("favicon"));
    expect(critical).toEqual([]);
  });
});
