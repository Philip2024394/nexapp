// scripts/diagnose-guest-chat-header.mjs
//
// One-off diagnostic · opens the Hammerexproducts cover, sends a first
// message to mint the provisional cookie, waits for the guest-chat
// redirect, then captures the computed layout of the
// [data-nex-chat-identity-header] element so we can prove whether the
// stacking the owner reports is a real DOM/CSS problem or a stale
// browser cache. Delete after use.

import { chromium } from "@playwright/test";

const BASE = "http://localhost:3008";
const SHOP = "/nex-native/hammerexproducts?commerce=1";

(async () => {
  const browser = await chromium.launch();
  // Mobile-ish viewport first · the stacking symptom tends to be
  // mobile-first. We'll also probe desktop.
  const viewports = [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "desktop-1280", width: 1280, height: 900 },
  ];
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    console.log(`\n═══ ${vp.name} (${vp.width}x${vp.height}) ═══`);

    try {
      await page.goto(BASE + SHOP, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-nex-cover-composer]", { timeout: 20000 });

      // Fill the composer input + submit · CoverComposer uses <input> +
      // type="submit".
      const probe = `diagnostic ${Date.now()}`;
      await page.locator("[data-nex-cover-composer] input").first().fill(probe);
      await page.locator('[data-nex-cover-composer] button[type="submit"]').click();

      // Wait for the guest-chat destination.
      await page.waitForURL(/\/chat\/guest\//, { timeout: 20000 });
      await page.waitForSelector("[data-nex-chat-identity-header]", { timeout: 10000 });

      const diag = await page.evaluate((viewportName) => {
        function describe(sel) {
          const el = document.querySelector(sel);
          if (!el) return { found: false };
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const style = {
            display: cs.display,
            flexDirection: cs.flexDirection,
            alignItems: cs.alignItems,
            position: cs.position,
            width: cs.width,
            minHeight: cs.minHeight,
            borderRadius: cs.borderRadius,
          };
          return {
            found: true,
            rect: {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            },
            style,
          };
        }
        const header = describe("[data-nex-chat-identity-header]");
        const pill = describe("[data-nex-chat-composer-pill] > div:nth-child(1), [data-nex-chat-composer-pill] > div[style*='min-height']");
        const pillRoot = describe("[data-nex-chat-composer-pill]");
        const messageList = describe("[data-nex-guest-message-list]");
        const headerKids = (() => {
          const h = document.querySelector("[data-nex-chat-identity-header]");
          if (!h) return [];
          return Array.from(h.children).map((c) => {
            const r = c.getBoundingClientRect();
            return {
              tag: c.tagName,
              rect: {
                x: Math.round(r.x),
                y: Math.round(r.y),
                w: Math.round(r.width),
                h: Math.round(r.height),
              },
            };
          });
        })();
        const textarea = document.querySelector("[data-nex-chat-composer-pill] textarea");
        const textareaFont = textarea
          ? {
              fontSize: getComputedStyle(textarea).fontSize,
              lineHeight: getComputedStyle(textarea).lineHeight,
            }
          : null;
        const vh = window.innerHeight;
        return {
          viewport: viewportName,
          url: location.pathname,
          windowH: vh,
          header,
          headerKids,
          nameText: (document.querySelector("[data-nex-chat-identity-name]") || {}).textContent,
          subtitleText: (document.querySelector("[data-nex-chat-identity-subtitle]") || {}).textContent,
          pillRoot,
          pill,
          textareaFont,
          messageList,
          verdict: (() => {
            const errs = [];
            if (!header.found) errs.push("identity header missing");
            else {
              if (header.style.display !== "flex")
                errs.push(`header display=${header.style.display}`);
              if (header.style.flexDirection !== "row")
                errs.push(`header flex-direction=${header.style.flexDirection}`);
              if (headerKids.length >= 2) {
                const [avatar, name] = headerKids;
                if (name.rect.x <= avatar.rect.x)
                  errs.push("name column is not to the right of avatar");
                if (Math.abs(name.rect.y - avatar.rect.y) > 20)
                  errs.push("name column y != avatar y (vertical stack)");
              }
            }
            if (!pillRoot.found)
              errs.push("composer pill marker missing");
            if (pillRoot.found && pillRoot.rect.y + pillRoot.rect.h > vh + 40)
              errs.push("composer below viewport bottom (off-screen)");
            if (textarea && textareaFont && textareaFont.fontSize !== "16px")
              errs.push(`textarea fontSize=${textareaFont.fontSize} (expected 16px)`);
            return errs.length === 0 ? "PASS · master layout holds" : "FAIL · " + errs.join("; ");
          })(),
        };
      }, vp.name);
      console.log(JSON.stringify(diag, null, 2));
      await page
        .locator("[data-nex-chat-identity-header]")
        .screenshot({ path: `scripts/diagnose-guest-chat-header-${vp.name}.png` });
      await page.screenshot({
        path: `scripts/diagnose-guest-chat-full-${vp.name}.png`,
        fullPage: false,
      });
    } catch (e) {
      console.log(`FAIL ${vp.name}: ${e.message}`);
    }
    if (errors.length) {
      console.log("--- page errors ---");
      for (const e of errors) console.log("  " + e);
    }
    await context.close();
  }
  await browser.close();
})();
