import { test, expect } from "@playwright/test";

const vps = [
  { w: 412, h: 915, label: "pixel7" },
  { w: 360, h: 780, label: "android-std" },
  { w: 320, h: 568, label: "small" },
];

for (const vp of vps) {
  test(`after · ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1800);
    const info = await page.evaluate(() => {
      const composer = document.querySelector("[data-nex-live-viewer-footer-composer]") as HTMLElement | null;
      const inlineLike = document.querySelector("[data-nex-live-footer-like-inline='true']") as HTMLElement | null;
      const actionsLike = document.querySelector("[data-nex-live-viewer-footer-actions] [data-nex-live-footer-like]") as HTMLElement | null;
      return {
        viewportW: window.innerWidth,
        composerW: composer?.getBoundingClientRect().width,
        composerLeft: composer?.getBoundingClientRect().left,
        composerRight: composer?.getBoundingClientRect().right,
        inlineLikeFound: !!inlineLike,
        actionsLikeFound: !!actionsLike,
      };
    });
    console.log(`${vp.label} ` + JSON.stringify(info));
    await page.screenshot({ path: `tests/e2e-screenshots/preview-pass-2026-10-25/after-fit-${vp.label}.png`, fullPage: false, clip: { x: 0, y: vp.h - 180, width: vp.w, height: 180 } });
    expect(info.inlineLikeFound).toBe(true);
    expect(info.actionsLikeFound).toBe(false);
    expect(info.composerW).toBeLessThan(info.viewportW!);
    expect(info.composerLeft).toBeGreaterThanOrEqual(6);
  });
}
