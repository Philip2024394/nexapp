// tests/e2e/nex-feed-gate1-acceptance.spec.ts
//
// Owner directive 2026-10-30 · five targeted acceptance checks on the
// music slide after Gate 1 pointer-handler changes. ONLY observes; no
// source modifications anywhere.
//
// Scenarios (owner-stated):
//   A1 · Tap creator avatar · library should open, feed must NOT advance
//   A2 · Tap creator name  · library should open, feed must NOT advance
//   A3 · Horizontal-dominant drag · feed must NOT advance
//   A4 · Deliberate vertical drag · feed advances exactly one entry
//   A5 · Short drag <60px · feed must NOT advance

import { test, expect } from "@playwright/test";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(
  "./tests/e2e-screenshots/nex-feed-gate1-acceptance",
);
const MUSIC_SLUG = "music-5ab54fd6-8cb1-4b74-9c62-50e5afc49026";
const MUSIC_PATH = `/nex-native/nex-feed/${MUSIC_SLUG}`;
// Expected next slide after a successful swipe-up from the music slide.
// Confirmed via DOM `data-nex-music-viewer-swipe-next` in the earlier
// visual verification: `dev-video-21`.
const EXPECTED_NEXT_SLUG = "dev-video-21";

async function openMusicSlide(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(MUSIC_PATH);
  await page.waitForSelector('[data-nex-music-viewer="true"]', { timeout: 15_000 });
  await page.waitForSelector("[data-nex-music-feed-card]", { timeout: 10_000 });
  await page.waitForTimeout(600);
}

async function getCenter(
  page: import("@playwright/test").Page,
): Promise<{ x: number; y: number }> {
  // The viewer's `<main>` fills the `.nex-native-frame`. Target the
  // middle of the frame so pointer events land on the viewer surface,
  // not on an edge decoration.
  const rect = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-nex-music-viewer="true"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (!rect) throw new Error("music viewer <main> not found");
  return { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + rect.h / 2) };
}

async function screenshot(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: false,
  });
}

test.describe("NEX Feed · Gate 1 acceptance verification", () => {
  test("A1 · tap creator AVATAR · feed must NOT advance", async ({ page }, info) => {
    await openMusicSlide(page);
    const beforeUrl = page.url();
    await screenshot(page, `A1-before-${info.project.name}.png`);

    // Avatar + name are inside a single <button aria-label="Open ...'s
    // music library"> at the bottom of the card. The avatar is the
    // first child <span>. We click directly on it so a potential
    // listener on the inner span (if any) is exercised.
    const libraryButton = page.locator(
      '[data-nex-music-feed-card] button[aria-label*="library" i]',
    );
    await expect(libraryButton).toBeVisible({ timeout: 5_000 });
    // Click the first child (avatar circle).
    const avatarSpan = libraryButton.locator("span").first();
    await avatarSpan.click({ timeout: 5_000 }).catch(async () => {
      // Fallback · click the button itself at its left edge where the
      // avatar sits.
      const box = await libraryButton.boundingBox();
      if (!box) throw new Error("library button has no bounding box");
      await page.mouse.click(box.x + 18, box.y + 18);
    });
    await page.waitForTimeout(600);
    await screenshot(page, `A1-after-${info.project.name}.png`);

    const afterUrl = page.url();
    expect(afterUrl, "feed URL must NOT change after avatar tap").toBe(beforeUrl);
  });

  test("A2 · tap creator NAME · feed must NOT advance", async ({ page }, info) => {
    await openMusicSlide(page);
    const beforeUrl = page.url();
    await screenshot(page, `A2-before-${info.project.name}.png`);

    const libraryButton = page.locator(
      '[data-nex-music-feed-card] button[aria-label*="library" i]',
    );
    await expect(libraryButton).toBeVisible({ timeout: 5_000 });
    // The creator name is inside the button, in the second child
    // (the <span style="display:flex;flex-direction:column">). Click
    // at the right edge of the button where the name text lives.
    const box = await libraryButton.boundingBox();
    if (!box) throw new Error("library button has no bounding box");
    // Target x = 60% across the button width · past the avatar circle
    // and firmly on the name text.
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
    await page.waitForTimeout(600);
    await screenshot(page, `A2-after-${info.project.name}.png`);

    const afterUrl = page.url();
    expect(afterUrl, "feed URL must NOT change after name tap").toBe(beforeUrl);
  });

  test("A3 · HORIZONTAL-dominant drag · feed must NOT advance", async ({
    page,
  }, info) => {
    await openMusicSlide(page);
    const beforeUrl = page.url();
    const center = await getCenter(page);
    await screenshot(page, `A3-before-${info.project.name}.png`);

    // 200px horizontal · <40px vertical drift. The horizontal-dominant
    // guard in handlePointerUp (|dx| > |dy|) MUST reject this.
    await page.mouse.move(center.x - 100, center.y + 10);
    await page.mouse.down();
    await page.mouse.move(center.x + 100, center.y + 20, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await screenshot(page, `A3-after-${info.project.name}.png`);

    expect(
      page.url(),
      "horizontal-dominant drag must NOT advance the feed",
    ).toBe(beforeUrl);
  });

  test("A4 · VERTICAL drag · feed advances exactly ONE entry", async ({
    page,
  }, info) => {
    await openMusicSlide(page);
    const beforeUrl = page.url();
    const center = await getCenter(page);
    await screenshot(page, `A4-before-${info.project.name}.png`);

    // Deliberate upward drag · 200px vertical, <20px horizontal drift.
    await page.mouse.move(center.x + 5, center.y + 110);
    await page.mouse.down();
    await page.mouse.move(center.x - 5, center.y - 90, { steps: 15 });
    await page.mouse.up();
    // Allow the full route transition to settle.
    await page.waitForTimeout(2_000);
    await screenshot(page, `A4-after-${info.project.name}.png`);

    const afterUrl = page.url();
    expect(afterUrl, "vertical drag must advance to a new feed entry").not.toBe(
      beforeUrl,
    );
    expect(
      afterUrl,
      `vertical drag must advance to the next sibling (expected .../${EXPECTED_NEXT_SLUG})`,
    ).toContain(EXPECTED_NEXT_SLUG);
  });

  test("A5 · SHORT drag <60px · feed must NOT advance", async ({
    page,
  }, info) => {
    await openMusicSlide(page);
    const beforeUrl = page.url();
    const center = await getCenter(page);
    await screenshot(page, `A5-before-${info.project.name}.png`);

    // 40px vertical drag · intentionally under the 60px threshold.
    await page.mouse.move(center.x, center.y + 20);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y - 20, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await screenshot(page, `A5-after-${info.project.name}.png`);

    expect(
      page.url(),
      "short drag under 60px must NOT advance the feed",
    ).toBe(beforeUrl);
  });
});
