// scripts/verify/drawer-dom-probe.mjs
//
// Diagnostic probe for the Control Drawer containment + stacking
// defects reported in the 2026-10-16 verification. Collects the
// actual rendered dimensions, computed styles, offsetParent chain
// and pointer-events state so the fix is targeted, not guessed.
//
// Not a test. Outputs raw JSON for inspection.

import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3008";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function probe(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/nex-native/directory/landing`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("[data-nex-control-drawer-trigger]").click();
  await page.waitForSelector("[data-nex-control-drawer]", { timeout: 5_000 });
  // Wait for slide-in to settle before snapshotting
  await page.waitForTimeout(400);

  const probe = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);

    function describe(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const chain = [];
      let p = el.offsetParent;
      let depth = 0;
      while (p && depth < 6) {
        chain.push({
          tag: p.tagName,
          cls: p.className,
          position: getComputedStyle(p).position,
          overflow: getComputedStyle(p).overflow,
          height: getComputedStyle(p).height,
          offsetHeight: p.offsetHeight,
        });
        p = p.offsetParent;
        depth++;
      }
      return {
        tag: el.tagName,
        cls: el.className,
        position: cs.position,
        top: cs.top,
        right: cs.right,
        bottom: cs.bottom,
        left: cs.left,
        width: cs.width,
        height: cs.height,
        maxHeight: cs.maxHeight,
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
        display: cs.display,
        transform: cs.transform,
        isolation: cs.isolation,
        willChange: cs.willChange,
        containingBlock: {
          offsetParentTag: el.offsetParent?.tagName ?? null,
          offsetParentCls: el.offsetParent?.className ?? null,
          offsetHeight: el.offsetHeight,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        rect: {
          x: rect.x, y: rect.y, w: rect.width, h: rect.height,
          right: rect.right, bottom: rect.bottom,
        },
        offsetParentChain: chain,
      };
    }

    // Check what element is topmost at the backdrop's centre coord.
    const bd = q("[data-nex-control-drawer-backdrop]");
    let topmostAtBackdropCentre = null;
    if (bd) {
      const r = bd.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const el = document.elementFromPoint(cx, cy);
      topmostAtBackdropCentre = el
        ? { tag: el.tagName, cls: el.className, dataset: { ...el.dataset } }
        : null;
    }

    // Topmost at a point ~20px inside the backdrop's top-left corner
    let topmostAtBackdropCorner = null;
    if (bd) {
      const r = bd.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + 20, r.y + 20);
      topmostAtBackdropCorner = el
        ? { tag: el.tagName, cls: el.className, dataset: { ...el.dataset } }
        : null;
    }

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dvh: window.visualViewport?.height ?? null,
      },
      stage: describe(q(".nex-native-stage")),
      frame: describe(q(".nex-native-frame")),
      backdrop: describe(q("[data-nex-control-drawer-backdrop]")),
      drawer: describe(q("[data-nex-control-drawer]")),
      topmostAtBackdropCentre,
      topmostAtBackdropCorner,
    };
  });

  console.log(`\n== ${vp.name} (${vp.width}x${vp.height}) ==`);
  console.log(JSON.stringify(probe, null, 2));

  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) await probe(browser, vp);
  } finally {
    await browser.close();
  }
})();
