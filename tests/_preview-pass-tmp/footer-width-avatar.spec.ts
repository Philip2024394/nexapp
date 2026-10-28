import { test, expect } from "@playwright/test";

const viewports = [
  { w: 412, h: 915, label: "pixel7" },
  { w: 360, h: 780, label: "android-std" },
];

for (const vp of viewports) {
  test(`composer edge-to-edge + enlarged avatar · ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const measure = await page.evaluate(() => {
      const composer = document.querySelector("[data-nex-live-viewer-footer-composer]") as HTMLElement | null;
      const avatar = document.querySelector("[data-nex-live-footer-author]") as HTMLElement | null;
      const footer = document.querySelector("[data-nex-live-viewer-footer]") as HTMLElement | null;
      return composer && footer
        ? {
            composerWidth: composer.getBoundingClientRect().width,
            footerWidth: footer.getBoundingClientRect().width,
            viewportWidth: window.innerWidth,
            avatarW: avatar ? parseInt((avatar as HTMLElement).style.width, 10) : -1,
            avatarH: avatar ? parseInt((avatar as HTMLElement).style.height, 10) : -1,
            avatarBr: avatar ? (avatar as HTMLElement).style.borderRadius : "n/a",
          }
        : null;
    });
    console.log(`${vp.label} ` + JSON.stringify(measure));

    await page.screenshot({ path: `tests/e2e-screenshots/preview-pass-2026-10-25/footer-wide-${vp.label}.png`, fullPage: false, clip: { x: 0, y: vp.h - 180, width: vp.w, height: 180 } });

    if (!measure) throw new Error("composer not found");
    expect(measure.composerWidth).toBe(measure.viewportWidth);
    expect(measure.avatarW).toBe(30);
    expect(measure.avatarH).toBe(30);
    expect(measure.avatarBr).toBe("6px");
  });
}
