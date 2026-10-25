// tests/e2e/live-footer-products-flow.spec.ts
//
// Owner directive 2026-10-25:
//   · "the 3 dots container must start just above the 3 dots and
//      center to the page width with 4 buttons each row"
//   · "the container will also have button if seller has shop
//      and this button will be called products"
//   · "when the seller selects the products button the container
//      will close and center from under hero down will displaying
//      5 products cards"
//   · "when they select a card it will open in the footer area
//      card position" (replaces Like/Market/Share)
//   · "when they select a card it will glowing for 5 seconds"
//   · "to remove the product card in footer the user will hold
//      for 2 seconds and pop up window will ask owner do they
//      want to return card back to shop"

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 412, height: 915 } });

test("Live viewer · broadcaster · 3-dot panel + products flow", async ({
  page,
}) => {
  await page.goto("/nex-native/videos/dev-video-3?preview=broadcaster", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);

  const dots = page.locator("[data-nex-live-footer-more]");
  const panel = page.locator("[data-nex-live-footer-extra-actions]");
  const products = page.locator("[data-nex-live-footer-extra-products]");

  // Open panel.
  await dots.click();
  await expect(panel).toHaveAttribute(
    "data-nex-live-footer-extra-actions-open",
    "true",
  );

  // Panel geometry · opens ABOVE the ⋮ (panel.bottom < dots.top) and
  // horizontally spans the row (centered to page width).
  const geom = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const dotsEl = document.querySelector<HTMLElement>(
      "[data-nex-live-footer-more]",
    );
    const rowEl = document.querySelector<HTMLElement>(
      "[data-nex-live-viewer-footer-actions]",
    );
    const d = dotsEl ? dotsEl.getBoundingClientRect() : null;
    const row = rowEl ? rowEl.getBoundingClientRect() : null;
    return {
      panel: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width },
      dots: d ? { top: d.top, left: d.left, right: d.right } : null,
      row: row ? { top: row.top, bottom: row.bottom } : null,
      innerWidth: window.innerWidth,
    };
  });
  console.log(
    `panel: ${JSON.stringify(geom.panel)} · row: ${JSON.stringify(geom.row)} · dots: ${JSON.stringify(geom.dots)}`,
  );
  // Panel bottom sits ABOVE the actions row top (with the 8px gap).
  const rowTop = geom.row?.top ?? 0;
  expect(geom.panel.bottom).toBeLessThanOrEqual(rowTop + 1);
  // Panel bottom is at least a few px above the row (margin bottom 8).
  expect(rowTop - geom.panel.bottom).toBeGreaterThanOrEqual(4);
  // Panel horizontally centered to the page · left ≈ 8, right ≈ innerWidth - 8.
  expect(geom.panel.left).toBeLessThanOrEqual(10);
  expect(geom.panel.right).toBeGreaterThanOrEqual(geom.innerWidth - 10);

  // Products pill present (broadcaster-only).
  await expect(products).toBeVisible();

  // Tap Products · panel closes · picker opens.
  await products.click();
  await expect(panel).toHaveAttribute(
    "data-nex-live-footer-extra-actions-open",
    "false",
  );
  const picker = page.locator("[data-nex-live-footer-product-picker]");
  await expect(picker).toBeVisible();
  const cards = page.locator("[data-nex-live-footer-product-picker-card]");
  await expect(cards).toHaveCount(5);

  // Pick card 2.
  const card2 = page.locator(
    '[data-nex-live-footer-product-picker-card-id="mock-product-2"]',
  );
  await card2.click();
  await expect(picker).toHaveCount(0);

  // Featured card appears in the footer slot · action row gone.
  const featured = page.locator("[data-nex-live-footer-featured-card]");
  await expect(featured).toBeVisible();
  await expect(featured).toHaveAttribute(
    "data-nex-live-footer-featured-card-product-id",
    "mock-product-2",
  );
  const actionRow = page.locator("[data-nex-live-viewer-footer-actions]");
  await expect(actionRow).toHaveCount(0);

  // Name + price rendered.
  await expect(page.locator("[data-nex-live-footer-featured-name]")).toHaveText(
    /Batik Scarf/,
  );
  await expect(page.locator("[data-nex-live-footer-featured-price]")).toHaveText(
    /Rp 125,000/,
  );

  // Press-hold 2 s · the ring highlight toggles while pressing · after
  // 2 s the remove-confirm sheet opens.
  await featured.evaluate((el) => {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await page.waitForTimeout(2100);
  const confirm = page.locator("[data-nex-live-footer-remove-confirm]");
  await expect(confirm).toBeVisible();

  // Cancel · dialog closes · card remains.
  await page.locator("[data-nex-live-footer-remove-cancel]").click();
  await expect(confirm).toHaveCount(0);
  await expect(featured).toBeVisible();

  // Second long-press · Return · card goes away · action row returns.
  await featured.evaluate((el) => {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await page.waitForTimeout(2100);
  await page.locator("[data-nex-live-footer-remove-confirm-ok]").click();
  await expect(featured).toHaveCount(0);
  await expect(actionRow).toBeVisible();

  await page.screenshot({
    path: "tests/e2e-screenshots/products-flow/final-after-return.png",
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });
});

test("Live viewer · non-broadcaster · no Products pill, no picker", async ({
  page,
}) => {
  await page.goto("/nex-native/videos/dev-video-3", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(300);

  const dots = page.locator("[data-nex-live-footer-more]");
  await dots.click();
  await expect(
    page.locator("[data-nex-live-footer-extra-actions]"),
  ).toHaveAttribute("data-nex-live-footer-extra-actions-open", "true");
  await expect(
    page.locator("[data-nex-live-footer-extra-products]"),
  ).toHaveCount(0);
});
