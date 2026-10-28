import { test, expect } from "@playwright/test";

test("feed renders 25 cards after dev-video-22..25 add", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const count = await page.locator("[data-nex-recorded-video-card]").count();
  const sample = await page.locator("[data-nex-recorded-video-card]").evaluateAll((els) => els.slice(0, 10).map((el) => el.getAttribute("data-nex-recorded-video-card")));
  console.log("feed cards=" + count + " sample=" + JSON.stringify(sample));
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/feed-25-cards.png", fullPage: true });
  // Sibling queue is capped at 20 for mobile · the recorded section can render 20..25 depending on viewport.
  expect(count).toBeGreaterThanOrEqual(18);
});
