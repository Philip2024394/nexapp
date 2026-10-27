import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 412, height: 915 } });
test("DIAG · action row dimensions", async ({ page }) => {
  await page.goto("/nex-native/videos/dev-video-3", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-nex-live-viewer-footer-actions]");
    const like = document.querySelector<HTMLElement>("[data-nex-live-footer-like]");
    const live = document.querySelector<HTMLElement>("[data-nex-live-footer-go-live]");
    const shop = document.querySelector<HTMLElement>("[data-nex-live-footer-view-shop]");
    const share = document.querySelector<HTMLElement>("[data-nex-live-footer-share]");
    const dots = document.querySelector<HTMLElement>("[data-nex-live-footer-more]");
    const panel = document.querySelector<HTMLElement>("[data-nex-live-footer-extra-actions]");
    const g = (el: HTMLElement | null) => el ? el.getBoundingClientRect() : null;
    return { row: g(row), like: g(like), live: g(live), shop: g(shop), share: g(share), dots: g(dots), panel: g(panel) };
  });
  console.log("ROW   ", JSON.stringify(r.row));
  console.log("LIKE  ", JSON.stringify(r.like));
  console.log("LIVE  ", JSON.stringify(r.live));
  console.log("SHOP  ", JSON.stringify(r.shop));
  console.log("SHARE ", JSON.stringify(r.share));
  console.log("DOTS  ", JSON.stringify(r.dots));
  console.log("PANEL ", JSON.stringify(r.panel));
});
