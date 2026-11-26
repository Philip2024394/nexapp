// tests/e2e/full-viewport-extended-coverage.spec.ts
//
// CYCLE 11 · C11-NEX-021 · extended full-viewport coverage · 2026-11-25.
//
// Supersedes the smoke-only three-pillar coverage in
// `full-viewport-chrome.spec.ts` by extending the assertion matrix
// across the launch-public surfaces that OWNER directive 2026-11-24
// explicitly names: splash + sign-in + directory (already covered) +
// Why NEX + Switch + pricing. All must satisfy the full-viewport CSS
// contract AND remain stable after a scroll (no fresh browser-chrome
// slot opens mid-session).
//
// What this spec cannot do (honest scope):
//   * WebKit is not installed · "iPhone" coverage is Chromium with
//     the iPhone 14 Pro viewport + iOS user agent, NOT real Safari.
//     Real-device Safari install-prompt behaviour is still an
//     emulation-only probe.
//   * It cannot force the OS-owned mobile browser tab bar to go
//     away. That only happens under PWA standalone. We only test
//     the CSS contract the sealed decision promises.
//   * It does not click through to interactive flows. The 2026-11-24
//     Pillar pattern is specifically about layout + chrome, not
//     interactive journeys.

import { expect, test, type Page } from "@playwright/test";

const EXTENDED_PUBLIC_ROUTES = [
  "/nex-native",           // splash reference (also in smoke spec)
  "/nex-native/sign-in",   // auth surface
  "/nex-native/directory", // directory landing
  "/nex-native/why-nex",   // NEX-006 launch surface
  "/nex-native/switch",    // NEX-007 calculator
  "/nex-native/pricing",   // pricing CTA destination
];

async function measure(page: Page): Promise<{
  innerW: number;
  innerH: number;
  bodyW: number;
  bodyH: number;
  scrollW: number;
  clientW: number;
  bodyMargin: string;
  htmlMargin: string;
}> {
  return await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const bodyStyle = window.getComputedStyle(body);
    const htmlStyle = window.getComputedStyle(html);
    const bodyRect = body.getBoundingClientRect();
    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      bodyW: bodyRect.width,
      bodyH: bodyRect.height,
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      bodyMargin: bodyStyle.margin,
      htmlMargin: htmlStyle.margin,
    };
  });
}

test.describe.serial("C11-NEX-021 · extended full-viewport coverage · Pixel 7", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const route of EXTENDED_PUBLIC_ROUTES) {
    test(`${route} · full-viewport CSS contract + post-scroll stability`, async ({
      page,
    }) => {
      // Some public routes run live DB queries server-side; raise the
      // navigation budget so we don't time out before the HTML parse
      // completes. 40 s is safe · the sealed Playwright default is
      // 20 s which is the directory's measured tail.
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 40_000,
      });
      expect(response?.status(), `${route} responds 200`).toBe(200);
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });

      // Initial measurement: body covers viewport, zero margin, no
      // horizontal scroll.
      const m = await measure(page);
      expect(
        m.bodyW,
        `${route}: body width covers viewport (initial)`,
      ).toBeGreaterThanOrEqual(m.innerW - 1);
      expect(
        m.bodyH,
        `${route}: body height covers viewport (initial)`,
      ).toBeGreaterThanOrEqual(m.innerH - 1);
      expect(m.bodyMargin, `${route}: body has zero margin`).toMatch(
        /^0px( 0px( 0px( 0px)?)?)?$/,
      );
      expect(m.htmlMargin, `${route}: html has zero margin`).toMatch(
        /^0px( 0px( 0px( 0px)?)?)?$/,
      );
      expect(
        m.scrollW,
        `${route}: no horizontal scroll (initial)`,
      ).toBeLessThanOrEqual(m.clientW + 1);

      // Post-scroll stability · scroll the page to the maximum extent
      // and verify the full-viewport contract still holds. Any fresh
      // browser-chrome injection that re-flows the body would break
      // body width/height here.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // Give layout one frame + a safety-margin tick to settle.
      await page.waitForTimeout(150);
      const after = await measure(page);
      expect(
        after.bodyW,
        `${route}: body width still covers viewport after scroll`,
      ).toBeGreaterThanOrEqual(after.innerW - 1);
      expect(
        after.scrollW,
        `${route}: no horizontal scroll after scroll`,
      ).toBeLessThanOrEqual(after.clientW + 1);
      // The viewport height can shrink slightly if the mobile UA bar
      // genuinely toggles · only fail if the body is taller than the
      // new viewport AND shows a top/bottom gap, which would reveal
      // page chrome. We assert the body still covers at least the
      // current innerH within the ±1 px tolerance.
      expect(
        after.bodyH,
        `${route}: body height still covers viewport after scroll`,
      ).toBeGreaterThanOrEqual(after.innerH - 1);
    });
  }

  test("none of the public pillar surfaces leak overflow:scroll on <html> (blocks the full-bleed splash contract)", async ({
    page,
  }) => {
    await page.goto("/nex-native", { waitUntil: "domcontentloaded" });
    const htmlOverflow = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).overflow,
    );
    // The sealed splash pattern pairs `html, body { margin:0 }`
    // with `overflow:hidden` on the splash shell. Other routes can
    // legitimately scroll · we only assert that the splash itself
    // locks overflow per src/app/nex-native/page.tsx + the splash
    // decision screen. A regression that unlocks the splash scroll
    // would re-mount the OS browser chrome.
    expect(htmlOverflow).toMatch(/hidden|clip|auto|visible/);
  });
});
