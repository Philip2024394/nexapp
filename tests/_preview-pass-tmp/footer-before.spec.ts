import { test } from "@playwright/test";

const vps = [
  { w: 412, h: 915, label: "pixel7" },
  { w: 360, h: 780, label: "android-std" },
  { w: 320, h: 568, label: "small" },
];

for (const vp of vps) {
  test(`before · ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1800);
    const measure = await page.evaluate(() => {
      const composer = document.querySelector("[data-nex-live-viewer-footer-composer]") as HTMLElement | null;
      const footer = document.querySelector("[data-nex-live-viewer-footer]") as HTMLElement | null;
      const actions = document.querySelector("[data-nex-live-viewer-footer-actions]") as HTMLElement | null;
      const doc = document.scrollingElement as HTMLElement;
      return {
        innerWidth: window.innerWidth,
        docScrollWidth: doc?.scrollWidth,
        composerW: composer?.getBoundingClientRect().width,
        composerLeft: composer?.getBoundingClientRect().left,
        composerRight: composer?.getBoundingClientRect().right,
        actionsW: actions?.getBoundingClientRect().width,
        footerW: footer?.getBoundingClientRect().width,
      };
    });
    console.log(`${vp.label} ${JSON.stringify(measure)}`);
    await page.screenshot({ path: `tests/e2e-screenshots/preview-pass-2026-10-25/before-fit-${vp.label}.png`, fullPage: false, clip: { x: 0, y: vp.h - 180, width: vp.w, height: 180 } });
  });
}
