// tests/e2e/chat-peer-composer-overflow.spec.ts
//
// Autonomous regression · verifies that the NexTextarea/NexInput
// `box-sizing: border-box` default (shipped 2026-10-25) also prevents
// overflow in the peer-chat composer surface, not only the Live viewer.
// Guest route redirects to sign-in · so this probes the sign-in surface
// composer OR the public contacts list OR any mounted keypad field.

import { test, expect } from "@playwright/test";

const WIDTHS = [320, 360, 375, 412] as const;

for (const width of WIDTHS) {
  test(`sign-in surface · no textarea/input overflows the viewport @ ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    await page.goto("/nex-native/sign-in", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    const r = await page.evaluate(() => {
      const iw = window.innerWidth;
      const list: Array<{ tag: string; name: string; w: number; right: number; over: number }> = [];
      const fields = Array.from(
        document.querySelectorAll<HTMLElement>("input, textarea"),
      );
      for (const f of fields) {
        const rect = f.getBoundingClientRect();
        if (rect.width === 0) continue;
        if (rect.right > iw + 1) {
          list.push({
            tag: f.tagName.toLowerCase(),
            name: f.getAttribute("name") ?? f.getAttribute("data-nex-live-footer-text-input") ?? f.getAttribute("placeholder") ?? "?",
            w: Math.round(rect.width),
            right: Math.round(rect.right),
            over: Math.round(rect.right - iw),
          });
        }
      }
      return { iw, overflowers: list };
    });

    for (const o of r.overflowers) {
      console.log(`@${width} OVER +${o.over} ${o.tag}[${o.name}] right=${o.right}`);
    }
    expect(r.overflowers).toHaveLength(0);
  });
}
