import { test, expect } from "@playwright/test";

test("video viewer · sound-toggle flipped to ON · bars state", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  // Click the toggle to flip from muted → unmuted (headless starts muted
  // due to autoplay policy).
  const toggle = page.locator("[data-nex-video-viewer-sound-toggle]");
  await toggle.click();
  await page.waitForTimeout(400);

  const soundOn = await toggle.getAttribute("data-nex-sound-on");
  const ariaLabel = await toggle.getAttribute("aria-label");
  console.log(`post-click soundOn=${soundOn} label="${ariaLabel}"`);
  expect(soundOn).toBe("true");
  expect(ariaLabel).toBe("Mute sound");

  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/11-sound-icon-ON-bars.png",
    fullPage: false,
    clip: { x: 0, y: 0, width: 412, height: 140 },
  });

  // Flip back → OFF → verify
  await toggle.click();
  await page.waitForTimeout(300);
  const soundOnAfterToggle = await toggle.getAttribute("data-nex-sound-on");
  const ariaLabelAfter = await toggle.getAttribute("aria-label");
  console.log(`post-click-2 soundOn=${soundOnAfterToggle} label="${ariaLabelAfter}"`);
  expect(soundOnAfterToggle).toBe("false");
  expect(ariaLabelAfter).toBe("Unmute sound");

  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/12-sound-icon-OFF-after-retoggle.png",
    fullPage: false,
    clip: { x: 0, y: 0, width: 412, height: 140 },
  });
});
