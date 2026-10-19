// tests/e2e-themes/theme-previews.spec.ts
//
// NEX Theme Production · Phase A3.1 · screenshot + DOM contrast harness.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19.
//
// Changes vs. the Phase A3 spec (fully superseded):
//   · Explicitly SKIP the intro overlay before taking screenshots so
//     Pink Dream 768 no longer captures the teddy-bear intro video.
//     Clicks `[data-nex-standard-intro-skip]` when present; also
//     waits for the overlay to disappear before proceeding.
//   · Adds a REAL DOM-level contrast measurement: extracts the
//     computed background + text colour of actual rendered bubbles
//     via getComputedStyle, then computes WCAG contrast against the
//     actual rendered pixels. Writes `<slug>/<viewport>.dom-contrast.json`.
//   · Adds a Joker-bespoke test that visits the new dev-only
//     /nex-native/dev/joker-bespoke-preview route (not the sealed
//     live /nex-native/themes/joker route which returns 404 without
//     DB registration).
//   · The pre-A3.1 Joker live-route block is DELETED · its 404 result
//     was not a useful signal.

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const GENERATED_ROOT = path.resolve(__dirname, "..", "..", "scripts", "nex-themes", "generated");
const SCREENSHOT_ROOT = path.resolve(__dirname, "..", "e2e-screenshots-themes");

function discoverSlugs(): string[] {
  if (!fs.existsSync(GENERATED_ROOT)) return [];
  return fs
    .readdirSync(GENERATED_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(GENERATED_ROOT, d.name, `${d.name}.package.json`)))
    .map((d) => d.name);
}

const SLUGS = discoverSlugs();

async function skipIntroIfPresent(page: import("@playwright/test").Page) {
  // A3.2 correction · the pre-correction version checked
  // locator.count() immediately after mount which could be ZERO if the
  // intro overlay hadn't rendered yet. That silently skipped the click,
  // and the 768 viewport consistently captured the intro video instead
  // of the chat UI. The fix: wait for the overlay to BE attached (short
  // bounded wait), then click skip, then wait for it to detach. If the
  // overlay genuinely never mounts for a theme without an intro, the
  // short wait expires and we proceed · still correct behaviour.
  try {
    const introAttached = await page
      .waitForSelector("[data-nex-standard-intro-overlay]", {
        state: "attached",
        timeout: 3000,
      })
      .then(() => true)
      .catch(() => false);
    if (introAttached) {
      // Click skip · the skip button may render slightly after the
      // overlay itself · give it a moment.
      await page
        .locator("[data-nex-standard-intro-skip]")
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page
        .waitForSelector("[data-nex-standard-intro-overlay]", {
          state: "detached",
          timeout: 8000,
        })
        .catch(() => undefined);
    }
  } catch {
    // best-effort · propagate nothing · the bubble-wait after this
    // call is the HARD assertion that catches "chat never rendered"
  }
}

async function extractDomContrast(page: import("@playwright/test").Page) {
  // Measure the ACTUAL rendered colours on bubble DOM elements.
  //
  // A3.1 correction · bubble containers may use `rgba(0,0,0,0)` and
  // delegate the real tint to a descendant div. We walk descendants
  // depth-first for the FIRST element with an opaque background, then
  // measure its real colour. For the text foreground we find the first
  // text node and measure its parent's computed color.
  //
  // When no opaque background exists in the subtree, we walk ancestors
  // (the wallpaper is the ultimate backdrop). Each measurement records
  // where the opaque layer was found so a reviewer can audit.
  return page.evaluate(() => {
    function rgbaParse(s: string): { r: number; g: number; b: number; a: number } | null {
      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);
      if (!m) return null;
      return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] !== undefined ? +m[4]! : 1 };
    }
    function toHex(rgba: { r: number; g: number; b: number }): string {
      const h = (n: number) => n.toString(16).padStart(2, "0");
      return `#${h(rgba.r)}${h(rgba.g)}${h(rgba.b)}`;
    }
    function findOpaqueBackground(root: HTMLElement): { hex: string; where: string } {
      // Depth-first walk · return the first element whose computed
      // background-color has alpha > 0.5 (treat semi-transparent as
      // approximation of the composed colour).
      const stack: HTMLElement[] = [root];
      while (stack.length) {
        const el = stack.pop()!;
        const rgba = rgbaParse(window.getComputedStyle(el).backgroundColor);
        if (rgba && rgba.a > 0.5) {
          return {
            hex: toHex(rgba),
            where: el === root ? "self" : "descendant:" + (el.tagName.toLowerCase()),
          };
        }
        for (let i = el.children.length - 1; i >= 0; i--) {
          stack.push(el.children[i] as HTMLElement);
        }
      }
      // No opaque descendant · walk ancestors.
      let a: HTMLElement | null = root.parentElement;
      while (a) {
        const rgba = rgbaParse(window.getComputedStyle(a).backgroundColor);
        if (rgba && rgba.a > 0.5) {
          return { hex: toHex(rgba), where: "ancestor:" + a.tagName.toLowerCase() };
        }
        a = a.parentElement;
      }
      return { hex: "#000000", where: "fallback" };
    }
    function luma(hex: string): number {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    }
    function contrast(fg: string, bg: string): number {
      const l1 = luma(fg);
      const l2 = luma(bg);
      const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (light + 0.05) / (dark + 0.05);
    }
    function findTextElement(root: HTMLElement): HTMLElement {
      // A3.3 correction · pick the LONGEST text in the subtree, not
      // the first. Short labels (timestamps, read-receipt dots, badge
      // numbers) can inherit a different colour than the message body
      // itself. The longest text in a chat bubble is almost always
      // the message body · the measurement we actually care about.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let best: HTMLElement | null = null;
      let bestLen = 0;
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const txt = (n.textContent ?? "").trim();
        if (txt.length > bestLen && n.parentElement) {
          best = n.parentElement as HTMLElement;
          bestLen = txt.length;
        }
      }
      return best ?? root;
    }
    const results: Array<{
      selector: string;
      role: "bubble-text" | "cta-fill";
      fg: string;
      bg: string;
      bgWhere: string;
      ratio: number;
      threshold: number;
      label: "pass" | "warn" | "fail";
    }> = [];
    // A3.2 · the token gate's two outstanding "accent on background"
    // fails are a THEORETICAL concern · the question is whether the
    // accent ever actually sits on the raw page background in the
    // rendered UI. The composer send button and the composer pill
    // itself are the obvious places to check. Measurements record
    // where the real backdrop was found (`descendant` / `ancestor` /
    // `fallback`) so a reviewer can audit the composition.
    const bubbleSelectors = [
      '[data-nex-se-bubble="peer"]',
      '[data-nex-se-bubble="mine"]',
    ];
    for (const sel of bubbleSelectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const bgLookup = findOpaqueBackground(el);
      const textEl = findTextElement(el);
      const fgRgba = rgbaParse(window.getComputedStyle(textEl).color);
      const fg = fgRgba ? toHex(fgRgba) : "#000000";
      const ratio = Number(contrast(fg, bgLookup.hex).toFixed(2));
      const threshold = 4.5;
      const label: "pass" | "warn" | "fail" =
        ratio >= threshold ? "pass" : ratio >= threshold * 0.9 ? "warn" : "fail";
      results.push({
        selector: sel,
        role: "bubble-text",
        fg,
        bg: bgLookup.hex,
        bgWhere: bgLookup.where,
        ratio,
        threshold,
        label,
      });
    }
    // CTA fill measurement · the send-button pattern that the token
    // gate's `accent on background (CTA fill visible)` row flagged.
    // We check whether the send button's FILL has sufficient contrast
    // against ITS ACTUAL rendered backdrop (which should be the
    // composer surface, NOT the page background).
    const ctaCandidates = [
      '[data-nex-se-composer-send-inline]',
      '[data-nex-se-composer-send]',
    ];
    for (const sel of ctaCandidates) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      // The CTA fill is the element's own background · its backdrop
      // is the first opaque ancestor.
      const own = rgbaParse(window.getComputedStyle(el).backgroundColor);
      const ownHex = own && own.a > 0.5 ? toHex(own) : (findOpaqueBackground(el).hex);
      let a: HTMLElement | null = el.parentElement;
      let backdropHex = "#000000";
      let backdropWhere = "fallback";
      while (a) {
        const rgba = rgbaParse(window.getComputedStyle(a).backgroundColor);
        if (rgba && rgba.a > 0.5) {
          backdropHex = toHex(rgba);
          backdropWhere = "ancestor:" + a.tagName.toLowerCase();
          break;
        }
        a = a.parentElement;
      }
      const ratio = Number(contrast(ownHex, backdropHex).toFixed(2));
      const threshold = 3.0; // CTA fill is a large-shape element
      const label: "pass" | "warn" | "fail" =
        ratio >= threshold ? "pass" : ratio >= threshold * 0.9 ? "warn" : "fail";
      results.push({
        selector: sel,
        role: "cta-fill",
        fg: ownHex,
        bg: backdropHex,
        bgWhere: backdropWhere,
        ratio,
        threshold,
        label,
      });
      break; // measure the first one found
    }
    return results;
  });
}

test.describe("Generated theme previews (dev route)", () => {
  if (SLUGS.length === 0) {
    test("no generated themes available", () => {
      test.skip(true, "scripts/nex-themes/generated/ is empty · run `npm run nex:theme:new` first");
    });
    return;
  }

  for (const slug of SLUGS) {
    test(`${slug} · render + screenshot + DOM contrast`, async ({ page }, testInfo) => {
      const url = `/nex-native/dev/theme-preview-generated?slug=${encodeURIComponent(slug)}`;
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(response, `navigation to ${url}`).toBeTruthy();
      expect(response!.ok(), `status for ${url}`).toBeTruthy();

      await page.waitForSelector("[data-nex-theme-preview-stage]", { timeout: 10_000 });
      await skipIntroIfPresent(page);
      // A3.2 correction · bubble wait is now a HARD assertion. If the
      // intro-skip failed and the chat never rendered, we must fail
      // loudly rather than silently screenshot a black intro frame.
      await page.waitForSelector("[data-nex-se-bubble]", { timeout: 10_000 });
      await page.waitForTimeout(300); // tiny settle for motion / fade-in

      const viewportName = testInfo.project.name;
      const outDir = path.join(SCREENSHOT_ROOT, slug);
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${viewportName}.png`);
      await page.screenshot({ path: outPath, fullPage: false });

      const stat = fs.statSync(outPath);
      expect(stat.size, `${outPath} should be > 2kB`).toBeGreaterThan(2048);

      // Phase A3.1 · real DOM contrast measurement.
      const domContrast = await extractDomContrast(page);
      fs.writeFileSync(
        path.join(outDir, `${viewportName}.dom-contrast.json`),
        JSON.stringify({ slug, viewport: viewportName, results: domContrast }, null, 2),
      );
    });
  }
});

test.describe("Joker · bespoke rendering path (dev-only preview)", () => {
  test("joker-bespoke · screenshot via dev preview route", async ({ page }, testInfo) => {
    const url = `/nex-native/dev/joker-bespoke-preview`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    const viewportName = testInfo.project.name;
    const outDir = path.join(SCREENSHOT_ROOT, "joker-bespoke");
    fs.mkdirSync(outDir, { recursive: true });

    const meta: Record<string, unknown> = {
      url,
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
    };

    // Try to wait for the Joker preview stage · if the route 500s or
    // the fixture props fail to render, we still capture the screenshot
    // and document the failure honestly.
    const stageAppeared = await page
      .waitForSelector("[data-nex-joker-preview-stage]", { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    meta.stageAppeared = stageAppeared;

    await page.waitForTimeout(800); // let any bespoke overlays mount

    const outPath = path.join(outDir, `${viewportName}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    const stat = fs.statSync(outPath);
    (meta as Record<string, unknown>).screenshotBytes = stat.size;

    fs.writeFileSync(
      path.join(outDir, `${viewportName}.meta.json`),
      JSON.stringify(meta, null, 2),
    );

    expect(stat.size, `${outPath} should be > 1kB`).toBeGreaterThan(1024);
    // Honest · we assert the dev route itself returned 200. The bespoke
    // renderer's internal behaviour (what the stage looks like) is for
    // human visual review of the screenshot, not an automated assert.
    expect(response!.ok(), "dev preview route must respond 200").toBeTruthy();
  });
});
