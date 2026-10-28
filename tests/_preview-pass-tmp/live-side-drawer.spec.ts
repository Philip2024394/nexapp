import { test, expect } from "@playwright/test";

test("Nex Live side drawer · 3 rows + home icon + Nex Live title", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const trigger = page.locator("[data-nex-live-side-drawer-trigger]");
  expect(await trigger.count()).toBe(1);
  await trigger.click();
  await page.waitForTimeout(400);
  const panel = page.locator("[data-nex-live-side-drawer]");
  const home = page.locator("[data-nex-live-side-drawer-home]");
  const rows = page.locator("[data-nex-live-side-drawer-row]");
  const title = await panel.locator("h2").textContent();
  const rowCount = await rows.count();
  const rowKeys = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-nex-live-side-drawer-row-key")));
  const homeHref = await home.getAttribute("href");
  console.log(`title=${title} rows=${rowCount} keys=${JSON.stringify(rowKeys)} homeHref=${homeHref}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/live-side-drawer-open.png", fullPage: false });
  expect(title).toBe("Nex Live");
  expect(rowCount).toBe(3);
  expect(rowKeys).toEqual(["go-live", "shop", "wallet"]);
  expect(homeHref).toBe("/nex-native/contacts");
});
