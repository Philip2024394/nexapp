import { test, expect } from "@playwright/test";

test.describe("CAPTURE · dev role URLs", () => {
  // Desktop viewport · want to prove the mobile phone-frame is applied.
  test.use({ viewport: { width: 1280, height: 820 } });

  test("desktop shows mobile-sized frame · banner under Broadcasted · roles differ", async ({
    page,
  }) => {
    const dir = "tests/e2e-screenshots/dev-roles";

    // SELLER.
    await page.goto("/nex-native/dev/live-seller", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    await expect(
      page.locator('[data-nex-video-viewer-dev-banner-role="seller"]'),
    ).toBeVisible();
    // Phone frame is applied.
    const sellerFrame = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        "[data-nex-dev-live-frame]",
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    });
    expect(sellerFrame).not.toBeNull();
    expect(sellerFrame?.width).toBe(390);
    // Banner now sits INSIDE the header (not fixed to viewport corner).
    const bannerGeom = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(
        "[data-nex-video-viewer-dev-banner]",
      );
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const style = getComputedStyle(b);
      return { position: style.position, top: Math.round(r.top), left: Math.round(r.left) };
    });
    expect(bannerGeom?.position).not.toBe("fixed");
    console.log(`SELLER banner ${JSON.stringify(bannerGeom)} · frame ${JSON.stringify(sellerFrame)}`);
    await page.screenshot({
      path: `${dir}/01-seller-desktop-frame.png`,
      fullPage: false,
    });

    // VIEWER.
    await page.goto("/nex-native/dev/live-viewer", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    await expect(
      page.locator('[data-nex-video-viewer-dev-banner-role="viewer"]'),
    ).toBeVisible();
    await page.screenshot({
      path: `${dir}/02-viewer-desktop-frame.png`,
      fullPage: false,
    });
  });
});
