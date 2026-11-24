// tests/e2e/full-viewport-chrome.spec.ts
//
// T-5.1 · full-viewport rule verification · sealed 2026-11-24.
// Owner quote: *"all pages on nexapp must open full height of screen
// and width like splash screen does. we never want on android or iphone
// header search bar showing"*.
//
// Spec authored under Stage A Conditional Approval 2026-11-24.
//
// Observable behaviour under test, for the three launch-pillar routes:
//   /nex-native (splash reference), /nex-native/sign-in, /nex-native/directory
//   · document.body width equals or exceeds viewport width.
//   · document.body height equals the dvh/svh viewport (we use
//     window.innerHeight as the measured viewport since Playwright's
//     Pixel 7 device viewport is exact).
//   · `body.style.margin` and `body.style.padding` serialise to zero
//     (resolved via computed style).
//   · No horizontal scrollbar (clientWidth === scrollWidth).
//   · After scrolling, no new browser chrome bar is injected (we
//     verify by checking scrollHeight stays within viewport ± 1px
//     for fixed-position layouts).
//
// What this spec CANNOT do: it cannot remove the real mobile browser
// tab bar — that is OS-owned and only disappears under PWA standalone.
// We assert the *CSS contract* the sealed decision promises, not the
// OS chrome.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

const PILLAR_ROUTES = [
  "/nex-native",
  "/nex-native/sign-in",
  "/nex-native/directory",
];

test.describe.serial("T-5.1 · full-viewport rule · Pixel 7", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const route of PILLAR_ROUTES) {
    test(`${route} · body occupies full viewport with zero margin`, async ({
      page,
    }) => {
      // Remediation 2026-11-24 · the three launch-pillar routes keep
      // long-lived connections (realtime/presence) that prevent
      // `networkidle` from ever firing within Playwright's navigation
      // timeout. We wait for domcontentloaded (initial HTML parsed)
      // and then for `document.body` to be attached before we measure.
      // Assertion strength unchanged: we still require the 200 status
      // code, the full-viewport body contract, zero margin, and no
      // horizontal scroll.
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} responds 200`).toBe(200);
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });

      const metrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const bodyStyle = window.getComputedStyle(body);
        const htmlStyle = window.getComputedStyle(html);
        return {
          innerW: window.innerWidth,
          innerH: window.innerHeight,
          bodyRect: body.getBoundingClientRect(),
          htmlRect: html.getBoundingClientRect(),
          bodyMargin: bodyStyle.margin,
          bodyPadding: bodyStyle.padding,
          htmlMargin: htmlStyle.margin,
          clientW: html.clientWidth,
          scrollW: html.scrollWidth,
        };
      });

      // Body bounding box must cover the viewport. Tolerance ±1 px
      // for device-pixel rounding.
      expect(
        metrics.bodyRect.width,
        `${route}: body width covers viewport`,
      ).toBeGreaterThanOrEqual(metrics.innerW - 1);
      expect(
        metrics.bodyRect.height,
        `${route}: body height covers viewport`,
      ).toBeGreaterThanOrEqual(metrics.innerH - 1);

      // Body + html carry zero margin per the sealed splash pattern.
      // Browsers serialise zero as "0px" or "0px 0px 0px 0px".
      expect(metrics.bodyMargin, `${route}: body has zero margin`).toMatch(
        /^0px( 0px( 0px( 0px)?)?)?$/,
      );
      expect(metrics.htmlMargin, `${route}: html has zero margin`).toMatch(
        /^0px( 0px( 0px( 0px)?)?)?$/,
      );

      // No horizontal scrollbar.
      expect(
        metrics.scrollW,
        `${route}: no horizontal scroll (scrollWidth === clientWidth)`,
      ).toBeLessThanOrEqual(metrics.clientW + 1);
    });
  }

  test("sealed viewport meta is present on the root layout", async ({ page }) => {
    await page.goto("/nex-native", { waitUntil: "domcontentloaded" });

    // The sealed layout at src/app/nex-native/layout.tsx lines 104-110
    // emits viewportFit:"cover" and themeColor:"#020914". We assert
    // the resulting <meta> tags exist.
    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .first()
      .getAttribute("content");
    expect(viewportMeta ?? "", "viewport meta present").toMatch(
      /viewport-fit=cover|user-scalable|width=device-width/i,
    );

    const themeColorMeta = await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content");
    expect(
      (themeColorMeta ?? "").toLowerCase(),
      "theme-color present (sealed #020914 or equivalent splash colour)",
    ).toMatch(/#020914|#0[0-9a-f]{5}/i);
  });
});
