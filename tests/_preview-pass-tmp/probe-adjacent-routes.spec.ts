import { test } from "@playwright/test";

const urls = [
  ["/nex-native/live-commerce/welcome", "06-welcome"],
  ["/nex-native/videos/dev-video-18", "07-video-viewer-18"],
  ["/nex-native/videos/dev-video-21", "08-video-viewer-21"],
  ["/nex-native/live-commerce/enter-broadcast-room", "09-enter-broadcast-room-ready"],
];

for (const [url, slug] of urls) {
  test("probe " + url, async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    const resp = await page.goto("http://localhost:3008" + url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const status = resp?.status() ?? 0;
    console.log(url + " status=" + status);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `tests/e2e-screenshots/preview-pass-2026-10-25/${slug}.png`,
      fullPage: true,
    });
    const title = await page.title();
    const errorChip = await page.locator("text=/Runtime Error|Server Error|500|404/i").count();
    console.log(url + " title=" + title + " errorChips=" + errorChip);
  });
}
