import { test } from "@playwright/test";

test("poll placeholder every 500ms for 6s", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 12; i += 1) {
    const info = await page.evaluate(() => {
      const ta = document.querySelector("[data-nex-live-footer-text-input]") as HTMLTextAreaElement | null;
      return ta ? { placeholder: ta.placeholder, rotation: ta.getAttribute("data-nex-live-footer-placeholder-rotation") } : null;
    });
    console.log(`T+${i * 0.5}s · ${JSON.stringify(info)}`);
    await page.waitForTimeout(500);
  }
});
