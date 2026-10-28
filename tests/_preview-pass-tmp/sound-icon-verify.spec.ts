import { test, expect } from "@playwright/test";

const viewports = [
  { w: 412, h: 915, label: "pixel-7" },
  { w: 360, h: 780, label: "android-std" },
];

for (const vp of viewports) {
  test(`video viewer header · sound-toggle present · ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const resp = await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log(`${vp.label} status=${resp?.status() ?? "n/a"}`);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `tests/e2e-screenshots/preview-pass-2026-10-25/10-sound-icon-${vp.label}.png`,
      fullPage: false,
    });
    const toggle = page.locator("[data-nex-video-viewer-sound-toggle]");
    const toggleCount = await toggle.count();
    const soundOnAttr = toggleCount > 0 ? await toggle.first().getAttribute("data-nex-sound-on") : null;
    const ariaLabel = toggleCount > 0 ? await toggle.first().getAttribute("aria-label") : null;
    const search = page.locator("[data-nex-video-viewer-search]");
    const searchCount = await search.count();
    const searchBg = searchCount > 0 ? await search.first().evaluate((el) => (el as HTMLElement).style.background) : "n/a";
    console.log(`${vp.label} toggle=${toggleCount} soundOn=${soundOnAttr} label="${ariaLabel}" search=${searchCount} searchBg="${searchBg}"`);
    expect(toggleCount).toBe(1);
    expect(searchCount).toBe(1);
  });
}
