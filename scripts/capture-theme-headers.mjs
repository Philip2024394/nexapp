// scripts/capture-theme-headers.mjs
//
// Phase 3A verification · screenshot each theme page that was swapped
// to the shared ChatIdentityHeader primitive, at mobile 375 and
// desktop 1280. Capture header crop + full viewport so the owner can
// visually confirm the master layout holds and theme-specific
// wallpapers/charms/colours were preserved.

import { chromium } from "@playwright/test";

const BASE = "http://localhost:3008";
const SURFACES = [
  { slug: "cyber-grid", path: "/nex-native/themes/cyber-grid" },
  { slug: "theme-1", path: "/nex-native/themes/theme-1" },
  { slug: "pink-dream", path: "/nex-native/themes/pink-dream" },
];
const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

(async () => {
  const browser = await chromium.launch();
  for (const surface of SURFACES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        await page.goto(BASE + surface.path, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForSelector("[data-nex-chat-identity-header]", {
          timeout: 15000,
        });
        const diag = await page.evaluate(() => {
          const h = document.querySelector("[data-nex-chat-identity-header]");
          if (!h) return null;
          const cs = getComputedStyle(h);
          const r = h.getBoundingClientRect();
          const kids = Array.from(h.children).map((c) => {
            const cr = c.getBoundingClientRect();
            return { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) };
          });
          const name = document.querySelector("[data-nex-chat-identity-name]");
          const nameFont = name ? {
            fontSize: getComputedStyle(name).fontSize,
            fontWeight: getComputedStyle(name).fontWeight,
          } : null;
          return {
            display: cs.display,
            flexDirection: cs.flexDirection,
            rect: { w: Math.round(r.width), h: Math.round(r.height) },
            avatarRect: kids[0] ?? null,
            nameColRect: kids[1] ?? null,
            nameFont,
            nameText: name?.textContent,
          };
        });
        console.log(`${surface.slug} ${vp.name}:`, JSON.stringify(diag));
        await page
          .locator("[data-nex-chat-identity-header]")
          .screenshot({ path: `scripts/phase3a-${surface.slug}-header-${vp.name}.png` });
        await page.screenshot({
          path: `scripts/phase3a-${surface.slug}-full-${vp.name}.png`,
          fullPage: false,
        });
      } catch (e) {
        console.log(`${surface.slug} ${vp.name} FAIL: ${e.message}`);
      }
      if (errors.length) console.log(`  page errors: ${errors.join(" | ")}`);
      await context.close();
    }
  }
  await browser.close();
})();
