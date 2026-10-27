import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · Like heart back on composer right · enlarged · count below", async ({
  page,
}) => {
  const dir = "tests/e2e-screenshots/heart-right";

  await page.goto("/nex-native/dev/live-viewer", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);

  // Heart lives inside the composer-row column, NOT the action row.
  const heart = page.locator("[data-nex-live-footer-like]");
  await expect(heart).toBeVisible();
  const inlineAttr = await heart.getAttribute("data-nex-live-footer-like-inline");
  expect(inlineAttr).toBe("true");
  const rowAttr = await heart.getAttribute("data-nex-live-footer-like-row");
  expect(rowAttr).toBeNull();

  // Measurements.
  const geom = await page.evaluate(() => {
    const h = document.querySelector<HTMLElement>("[data-nex-live-footer-like]");
    const row = document.querySelector<HTMLElement>(
      "[data-nex-live-viewer-footer-composer-row]",
    );
    const comp = document.querySelector<HTMLElement>(
      "[data-nex-live-viewer-footer-composer]",
    );
    const count = document.querySelector<HTMLElement>(
      "[data-nex-live-footer-like-count]",
    );
    const g = (el: HTMLElement | null) =>
      el ? el.getBoundingClientRect() : null;
    return {
      heart: g(h),
      row: g(row),
      composer: g(comp),
      count: g(count),
      countText: count?.textContent,
    };
  });
  console.log(JSON.stringify(geom, null, 2));
  // Heart is 48×48.
  expect(Math.round(geom.heart!.width)).toBe(48);
  expect(Math.round(geom.heart!.height)).toBe(48);
  // Count is below the heart (same horizontal center).
  expect(geom.count!.top).toBeGreaterThan(geom.heart!.bottom - 1);
  // Heart sits to the RIGHT of the composer.
  expect(geom.heart!.left).toBeGreaterThan(geom.composer!.right - 1);
  // Heart's right edge is at or inside the composer row's right edge.
  expect(geom.heart!.right).toBeLessThanOrEqual(geom.row!.right + 1);
  // Count text present (mock = 237).
  expect(geom.countText).toBe("237");

  // No Like tile in the action row (grid-template-columns back to 3-col).
  const likeRow = await page
    .locator('[data-nex-live-footer-like][data-nex-live-footer-like-row="true"]')
    .count();
  expect(likeRow).toBe(0);

  await page.screenshot({
    path: `${dir}/01-heart-right-count-below.png`,
    fullPage: false,
  });
});
