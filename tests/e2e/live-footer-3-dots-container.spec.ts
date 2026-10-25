// tests/e2e/live-footer-3-dots-container.spec.ts
//
// Owner directive 2026-10-25 · "the 3 dots open up container panel
// same design color style as category buttons . and any tap outside
// that container will close it".
//
// Verifies:
//   1. Tapping the ⋮ opens the extra-actions panel.
//   2. The open panel renders the frosted-cyan Category tile palette
//      (cyan rim + cyan gradient background).
//   3. A pointerdown OUTSIDE the panel + outside the toggle closes it.
//   4. A pointerdown INSIDE the panel does NOT close it.
//
// This test is ONLY to prove the chrome. It does not click any pill
// action (those have their own tests).

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 412, height: 915 } });

test("Live viewer · 3-dot panel adopts Category-tile palette + closes on outside tap", async ({
  page,
}) => {
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-3", {
    waitUntil: "domcontentloaded",
  });

  const toggle = page.locator("[data-nex-live-footer-more]");
  const panel = page.locator("[data-nex-live-footer-extra-actions]");

  await expect(toggle).toBeVisible({ timeout: 5000 });

  // Panel starts closed · opacity 0 · aria-hidden true.
  await expect(panel).toHaveAttribute("data-nex-live-footer-extra-actions-open", "false");
  const closedStyles = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      borderColor: cs.borderColor,
    };
  });
  expect(closedStyles.pointerEvents).toBe("none");

  // Open.
  await toggle.click();
  await expect(panel).toHaveAttribute("data-nex-live-footer-extra-actions-open", "true");

  // Verify the cyan Category-tile palette.
  const openStyles = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundImage: cs.backgroundImage,
      borderTopColor: cs.borderTopColor,
      borderTopWidth: cs.borderTopWidth,
      borderRadius: cs.borderRadius,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
    };
  });
  // The gradient should mention the cyan rgb(0, 175, 255).
  expect(openStyles.backgroundImage).toContain("gradient");
  expect(openStyles.backgroundImage).toContain("175, 255");
  // The rim should be the cyan 2px border.
  expect(openStyles.borderTopWidth).toBe("2px");
  expect(openStyles.borderTopColor).toContain("175");
  console.log(
    `OPEN · bg="${openStyles.backgroundImage.slice(0, 70)}..." · border=${openStyles.borderTopWidth} ${openStyles.borderTopColor} · radius=${openStyles.borderRadius} · backdrop="${openStyles.backdropFilter}"`,
  );

  // Screenshot proof · the open panel.
  await page.screenshot({
    path: "tests/e2e-screenshots/3-dots-panel/open-cyan-container.png",
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });

  // Tapping INSIDE the panel does NOT close.
  await panel.locator("[data-nex-live-footer-extra-share]").hover();
  // We don't click (that would trigger share) · we pointerdown inside
  // and then move away before releasing.
  await page.mouse.move(0, 0); // move pointer OUTSIDE first
  // Fire a synthetic pointerdown INSIDE the panel directly.
  await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const target = el.querySelector("[data-nex-live-footer-extra-share]") as HTMLElement;
    (target ?? el).dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: r.left + 20,
        clientY: r.top + r.height / 2,
      }),
    );
  });
  await page.waitForTimeout(100);
  await expect(panel).toHaveAttribute("data-nex-live-footer-extra-actions-open", "true");

  // Now tap OUTSIDE the panel · the video area at top centre.
  await page.evaluate(() => {
    document.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 200,
      }),
    );
  });
  await page.waitForTimeout(100);
  await expect(panel).toHaveAttribute("data-nex-live-footer-extra-actions-open", "false");

  // Screenshot proof · closed state.
  await page.screenshot({
    path: "tests/e2e-screenshots/3-dots-panel/closed-after-outside-tap.png",
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });
});
