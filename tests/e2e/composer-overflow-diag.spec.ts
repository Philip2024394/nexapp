// tests/e2e/composer-overflow-diag.spec.ts
//
// DIAGNOSTIC · NOT a regression gate · 2026-10-25.
//
// Owner directive · "text-field/composer container runs beyond the
// screen edge in mobile view · root cause required."
//
// This spec walks the viewer footer at the 5 required viewport widths
// (320/360/375/390/412) and reports every element whose bounding box
// extends past window.innerWidth. We also walk a few shallow ancestors
// of each offender to identify which ancestor pins the width.

import { test, expect } from "@playwright/test";

const WIDTHS = [320, 360, 375, 390, 412] as const;

const SURFACES: ReadonlyArray<{ readonly name: string; readonly url: string }> = [
  { name: "live-viewer-dev-video-3", url: "/nex-native/videos/dev-video-3" },
  { name: "live-viewer-dev-video-1", url: "/nex-native/videos/dev-video-1" },
];

type Rect = {
  tag: string;
  dataAttrs: string;
  id: string;
  cls: string;
  left: number;
  right: number;
  width: number;
  overflow: number;
};

for (const surface of SURFACES) {
  test(`DIAG · composer overflow walk · ${surface.name}`, async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 915 });
      await page.goto(surface.url, { waitUntil: "domcontentloaded" });
      // Give layout a tick to settle.
      await page.waitForTimeout(300);

      const result = await page.evaluate(() => {
        const iw = window.innerWidth;
        const html = document.documentElement;
        const bodyScrollWidth = html.scrollWidth;
        const everything = Array.from(document.querySelectorAll<HTMLElement>("*"));
        const offenders: Rect[] = [];
        for (const el of everything) {
          const r = el.getBoundingClientRect();
          if (r.right > iw + 0.5 && r.width > 0 && r.height > 0) {
            const attrs: string[] = [];
            for (const a of el.attributes) {
              if (a.name.startsWith("data-nex") || a.name === "data-testid") {
                attrs.push(`${a.name}="${a.value.slice(0, 40)}"`);
              }
            }
            offenders.push({
              tag: el.tagName.toLowerCase(),
              dataAttrs: attrs.join(" "),
              id: el.id,
              cls: el.className.toString().slice(0, 60),
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
              overflow: Math.round(r.right - iw),
            });
          }
        }
        // Also measure the composer chain + parent to see the geometry.
        const chain: Array<{ sel: string; left: number; right: number; width: number; cs: string }> = [];
        const chainSels = [
          "[data-nex-live-viewer-footer]",
          "[data-nex-live-viewer-footer-composer-row]",
          "[data-nex-live-viewer-footer-composer]",
          "[data-nex-live-footer-text-input]",
        ];
        for (const sel of chainSels) {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          chain.push({
            sel,
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            cs: `boxSizing=${cs.boxSizing} padL=${cs.paddingLeft} padR=${cs.paddingRight} borL=${cs.borderLeftWidth} borR=${cs.borderRightWidth} marginL=${cs.marginLeft} marginR=${cs.marginRight} minW=${cs.minWidth} w=${cs.width} display=${cs.display} flex=${cs.flex}`,
          });
        }
        return { iw, bodyScrollWidth, overflowers: offenders, chain };
      });

      console.log(
        `\n=== ${surface.name} @ ${width}px · innerWidth=${result.iw} · docScrollWidth=${result.bodyScrollWidth}`,
      );
      for (const c of result.chain) {
        console.log(`  CHAIN ${c.sel} left=${c.left} right=${c.right} w=${c.width}`);
        console.log(`         ${c.cs}`);
      }
      if (result.overflowers.length === 0) {
        console.log(`  OK · no element overflows the viewport right edge`);
      } else {
        const top = result.overflowers.slice(0, 25);
        for (const o of top) {
          console.log(
            `  OVERFLOW +${o.overflow}px · <${o.tag}${o.id ? "#" + o.id : ""} ${o.dataAttrs}> left=${o.left} right=${o.right} w=${o.width} cls="${o.cls}"`,
          );
        }
        if (result.overflowers.length > 25) {
          console.log(`  …and ${result.overflowers.length - 25} more`);
        }
      }
    }
  });
}
