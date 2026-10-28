// tests/e2e/create-page-visual.spec.ts
//
// Diagnostic · screenshot /nex-native/create at BOTH mobile and desktop
// viewports. Owner reports a black screen on desktop · we need to see
// what the HUD does on wider viewports.

import { test, expect } from "@playwright/test";

test("diagnostic · /create at Pixel 7 mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3008/nex-native/create", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: "tests/e2e/.artifacts/create-mobile.png",
    fullPage: true,
  });
});

test("diagnostic · /create at desktop viewport 1440x900", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3008/nex-native/create", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: "tests/e2e/.artifacts/create-desktop.png",
    fullPage: true,
  });

  const panel = await page.$("[data-nex-create-panel]");
  const createPage = await page.$("[data-nex-create-page]");
  const info = {
    url: page.url(),
    viewport: page.viewportSize(),
    panel_bbox: panel ? await panel.boundingBox() : null,
    main_bbox: createPage ? await createPage.boundingBox() : null,
    cards_count: (await page.$$("[data-nex-create-card]")).length,
    html_bg: await page.evaluate(() => window.getComputedStyle(document.documentElement).background),
    body_bg: await page.evaluate(() => window.getComputedStyle(document.body).background),
    stage_bbox: await page.evaluate(() => {
      const el = document.querySelector(".nex-native-stage");
      if (!el) return null;
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = window.getComputedStyle(el as HTMLElement);
      return {
        bbox: { x: r.x, y: r.y, w: r.width, h: r.height },
        overflow: cs.overflow,
        background: cs.background.slice(0, 150),
        bg_image: cs.backgroundImage.slice(0, 150),
      };
    }),
    frame_bbox: await page.evaluate(() => {
      const el = document.querySelector(".nex-native-frame");
      if (!el) return null;
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = window.getComputedStyle(el as HTMLElement);
      return {
        bbox: { x: r.x, y: r.y, w: r.width, h: r.height },
        overflow: cs.overflow,
      };
    }),
    panel_computed: panel
      ? await panel.evaluate((el) => {
          const cs = window.getComputedStyle(el as HTMLElement);
          const r = el.getBoundingClientRect();
          return {
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            width: cs.width,
            height: cs.height,
            zIndex: cs.zIndex,
            inside_viewport: r.right > 0 && r.left < window.innerWidth,
          };
        })
      : null,
    console_errors: consoleErrors,
    page_errors: pageErrors,
  };
  const fs = require("node:fs");
  fs.writeFileSync(
    "tests/e2e/.artifacts/create-desktop.json",
    JSON.stringify(info, null, 2),
  );
  console.log(JSON.stringify(info, null, 2));
  // Fail if the panel is not inside the viewport · owner's black-screen
  // symptom suggests this.
  expect(info.cards_count).toBe(5);
});
