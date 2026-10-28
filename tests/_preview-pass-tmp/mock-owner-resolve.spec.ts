import { test, expect } from "@playwright/test";

test("MessagePanel resolves a REAL mock broadcaster from the recorded viewer", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(300);
  await page.locator("[data-nex-live-footer-extra-message='true']").click();
  // Wait for the resolver to finish · the name text flips from
  // "Broadcaster unavailable" to the real display name once the
  // server action resolves.
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-nex-live-message-name]");
      return el ? el.textContent !== "Broadcaster unavailable" : false;
    },
    undefined,
    { timeout: 6000 },
  );
  const name = await page.locator("[data-nex-live-message-name]").textContent();
  const handle = await page.locator("[data-nex-live-message-handle]").textContent();
  const country = await page.locator("[data-nex-live-message-country]").textContent();
  const barMargin = await page.locator("[data-nex-live-footer-video-progress]").evaluate((el) => (el as HTMLElement).style.margin);
  console.log(`panel · name=${name} handle=${handle} country=${country} bar-margin=${barMargin}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/message-panel-mock-resolved.png", fullPage: false });
  expect(name).toMatch(/Sari|Rizky|Budi|Maya|Dika/);
  expect(handle).toMatch(/^nex-9990[1-5]$/);
  expect(country).toMatch(/ID/);
  expect(barMargin).toContain("30px");
});
