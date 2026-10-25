// tests/e2e/live-header-ping-and-ai-chip.spec.ts
//
// Owner directive 2026-10-25:
//   · "the ping in header only ping lines change to white color ·
//     tower is red remain"
//   · "remove () from ai"
//
// Verifies:
//   1. Ping-wave rings (3 concentric circles) have WHITE border.
//   2. Tower + ball-dot keep NEX dark red (#B30000 / rgb(179,0,0)).
//   3. AI chip text is "AI" (no parentheses).

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 412, height: 915 } });

test("Live viewer header · white ping lines · red tower · AI chip without parens", async ({
  page,
}) => {
  await page.goto("/nex-native/videos/dev-video-3", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);

  const probe = await page.evaluate(() => {
    const waves = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nex-live-signal-wave]"),
    );
    const dot = document.querySelector<SVGCircleElement>(
      "[data-nex-live-signal-top-dot]",
    );
    const svgLines = Array.from(
      document.querySelectorAll<SVGLineElement>(
        "[data-nex-live-signal-pole] line",
      ),
    );
    const chip = document.querySelector<HTMLElement>(
      "[data-nex-video-viewer-ai-chip]",
    );
    const waveBorders = waves.map((w) => getComputedStyle(w).borderTopColor);
    const dotFill = dot ? dot.getAttribute("fill") : null;
    const lineStrokes = svgLines.map((l) => l.getAttribute("stroke"));
    return {
      waveCount: waves.length,
      waveBorders,
      dotFill,
      lineStrokes,
      chipText: chip ? chip.textContent : null,
    };
  });

  // 3 concentric ping rings.
  expect(probe.waveCount).toBe(3);
  // All 3 are WHITE.
  for (const c of probe.waveBorders) {
    expect(c).toBe("rgb(255, 255, 255)");
  }
  // Tower lines + ball-dot are red.
  expect(probe.dotFill).toBe("#B30000");
  for (const s of probe.lineStrokes) {
    expect(s).toBe("#B30000");
  }
  // AI chip text has no parens.
  expect(probe.chipText).toBe("AI");

  console.log(
    `waves=${probe.waveCount} borders=${probe.waveBorders.join(",")} ` +
      `dot=${probe.dotFill} lines=${probe.lineStrokes.join(",")} chip="${probe.chipText}"`,
  );

  await page.screenshot({
    path: "tests/e2e-screenshots/header-ping-ai/header-after-tweaks.png",
    clip: { x: 0, y: 0, width: 412, height: 110 },
  });
});
