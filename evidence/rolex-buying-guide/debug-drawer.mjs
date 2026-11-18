// Live diagnostic for the drawer trigger on /nex-generated/buying-guides/rolex.
import { chromium } from "playwright";

const BASE = "http://localhost:3008";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

page.on("console", (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
  waitUntil: "networkidle",
});

// Probe DOM shape.
const probe = await page.evaluate(() => {
  const trig = document.querySelector('[data-nex-control-drawer-trigger="true"]');
  const frame = trig?.closest(".nex-native-frame");
  return {
    triggerFound: Boolean(trig),
    triggerTag: trig?.tagName,
    triggerAriaExpanded: trig?.getAttribute("aria-expanded"),
    frameFound: Boolean(frame),
    frameClasses: frame?.className ?? null,
    framePosition: frame
      ? getComputedStyle(frame).position
      : null,
    nexNativeFrameGlobal: Boolean(document.querySelector(".nex-native-frame")),
  };
});
console.log("PROBE BEFORE CLICK:", JSON.stringify(probe, null, 2));

// Click the trigger.
await page.locator('[data-nex-control-drawer-trigger="true"]').first().click();
await page.waitForTimeout(500);

// Probe again after click.
const after = await page.evaluate(() => {
  const trig = document.querySelector('[data-nex-control-drawer-trigger="true"]');
  const backdrop = document.querySelector('[data-nex-control-drawer-backdrop], [data-control-drawer-backdrop], [role="dialog"]');
  const panels = Array.from(document.querySelectorAll('aside, [role="dialog"], [data-nex-control-drawer-panel]'));
  return {
    triggerAriaExpandedAfter: trig?.getAttribute("aria-expanded"),
    backdropFound: Boolean(backdrop),
    panelsFound: panels.length,
    panelClasses: panels.map((p) => p.getAttribute("class")),
    panelRoles: panels.map((p) => p.getAttribute("role")),
    htmlHasDialog: document.body.innerHTML.includes('role="dialog"'),
  };
});
console.log("PROBE AFTER CLICK:", JSON.stringify(after, null, 2));

await page.screenshot({ path: "evidence/rolex-buying-guide/debug-after-click.png" });
await browser.close();
