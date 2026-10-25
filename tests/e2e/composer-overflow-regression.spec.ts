// tests/e2e/composer-overflow-regression.spec.ts
//
// REGRESSION GATE · 2026-10-25.
//
// Owner directive · "the text-field container must stay inside the
// viewport at every mobile width · the fix must be measured, not
// promised." This spec FAILS if the Live viewer composer textarea
// extends past the right edge of the viewport at any of the 5
// required widths.
//
// Root cause of the historical bug (fixed 2026-10-25):
//   NexTextarea rendered a native <textarea> whose default
//   `box-sizing: content-box` meant `width: 100%` + padding + border
//   produced OUTER width = parent + padding + border. On narrow
//   mobile widths this overflowed the viewport by ~37 px.
// Fix:
//   NexTextarea + NexInput now set `boxSizing: "border-box"` as the
//   default inline style (caller can override via their own `style`).

import { test, expect } from "@playwright/test";

const WIDTHS = [320, 360, 375, 390, 412] as const;

const SURFACES: ReadonlyArray<{ readonly name: string; readonly url: string }> = [
  { name: "live-viewer-dev-video-3", url: "/nex-native/videos/dev-video-3" },
  { name: "live-viewer-dev-video-1", url: "/nex-native/videos/dev-video-1" },
];

for (const surface of SURFACES) {
  test.describe(`Composer overflow · ${surface.name}`, () => {
    for (const width of WIDTHS) {
      test(`${width}px · textarea stays inside the viewport right edge`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 915 });
        await page.goto(surface.url, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(200);

        const probe = await page.evaluate(() => {
          const iw = window.innerWidth;
          const ta = document.querySelector<HTMLElement>(
            "[data-nex-live-footer-text-input]",
          );
          const comp = document.querySelector<HTMLElement>(
            "[data-nex-live-viewer-footer-composer]",
          );
          const row = document.querySelector<HTMLElement>(
            "[data-nex-live-viewer-footer-composer-row]",
          );
          const footer = document.querySelector<HTMLElement>(
            "[data-nex-live-viewer-footer]",
          );
          if (!ta || !comp || !row || !footer) {
            return { iw, found: false as const };
          }
          return {
            iw,
            found: true as const,
            ta: ta.getBoundingClientRect(),
            comp: comp.getBoundingClientRect(),
            row: row.getBoundingClientRect(),
            footer: footer.getBoundingClientRect(),
          };
        });

        expect(probe.found).toBe(true);
        if (!probe.found) return;

        console.log(
          `${surface.name}@${width} · iw=${probe.iw} · ` +
            `footer.right=${Math.round(probe.footer.right)} · ` +
            `row.right=${Math.round(probe.row.right)} · ` +
            `composer.right=${Math.round(probe.comp.right)} · ` +
            `textarea.right=${Math.round(probe.ta.right)}`,
        );

        // Hard assertions · 1-pixel slack for sub-pixel rounding.
        expect(probe.ta.right).toBeLessThanOrEqual(probe.iw + 1);
        expect(probe.ta.right).toBeLessThanOrEqual(probe.comp.right + 1);
        expect(probe.comp.right).toBeLessThanOrEqual(probe.row.right + 1);
        expect(probe.row.right).toBeLessThanOrEqual(probe.footer.right + 1);
      });
    }
  });
}
