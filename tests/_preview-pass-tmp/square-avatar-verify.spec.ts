import { test, expect } from "@playwright/test";

test("recorded video · square avatar · NAME state", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => document.querySelector("[data-nex-live-footer-text-input]")?.getAttribute("data-nex-live-footer-placeholder-rotation") === "name", undefined, { timeout: 3000 });
  const avatar = page.locator("[data-nex-live-footer-author]").first();
  const shape = await avatar.evaluate((el) => {
    const s = (el as HTMLElement).style;
    const cs = window.getComputedStyle(el);
    return { w: s.width, h: s.height, br: s.borderRadius, computedBr: cs.borderRadius };
  });
  console.log("avatar " + JSON.stringify(shape));
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-SQUARE-name.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });
  await page.waitForFunction(() => document.querySelector("[data-nex-live-footer-text-input]")?.getAttribute("data-nex-live-footer-placeholder-rotation") === "prompt", undefined, { timeout: 3000 });
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-SQUARE-prompt.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });
  expect(shape.w).toBe("26px");
  expect(shape.h).toBe("26px");
  expect(shape.br).toBe("5px");
});
