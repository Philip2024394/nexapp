import { test, expect } from "@playwright/test";

test("MessagePanel · idle state · profile card + input + Send", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/dev/message-panel-fixture", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const panel = page.locator("[data-nex-live-message-panel]");
  expect(await panel.count()).toBe(1);
  const name = await page.locator("[data-nex-live-message-name]").textContent();
  const handle = await page.locator("[data-nex-live-message-handle]").textContent();
  const country = await page.locator("[data-nex-live-message-country]").textContent();
  const sendBtn = await page.locator("[data-nex-live-message-send]").count();
  const input = await page.locator("[data-nex-live-message-input]").count();
  console.log(`name=${name} handle=${handle} country=${country} send=${sendBtn} input=${input}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/message-panel-idle.png", fullPage: false });
  expect(name).toContain("Sari Dewi");
  expect(handle).toContain("nex-00001");
  expect(country).toContain("ID");
  expect(sendBtn).toBe(1);
  expect(input).toBe(1);
});
