// tests/e2e/nex-feed-visual-verify.spec.ts
//
// Owner directive 2026-10-30 · "prepare a visual browser test that
// captures: Desktop Feed inside the phone frame · Mobile Feed filling
// the screen · Music cover/title/creator/controls · Video content and
// controls · Actual vertical swipe from video to music and music to
// video."
//
// This spec does NOT modify any source code · it only observes.
// It captures:
//   1 · Feed-landing redirect (desktop + mobile)
//   2 · Video slide screenshot + DOM measurements (both viewports)
//   3 · Music slide screenshot + DOM measurements (both viewports)
//   4 · Vertical swipe from video → music → video (observed via
//       URL change after a mouse wheel / touchscreen swipe)
//
// Screenshots land in tests/e2e-screenshots/nex-feed-visual-verify/
// Measurement JSON lands next to screenshots.
//
// Target viewport names (the Playwright project name is passed in
// `test.info().project.name`) · gates behaviour below.

import { test, expect } from "@playwright/test";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(
  "./tests/e2e-screenshots/nex-feed-visual-verify",
);

// Hendra's current active music slot slug (set via the preview Live
// button in a prior dev session). Verified at the time of writing via
// `.dev-music-data/active-slots.json`.
const MUSIC_SLUG = "music-5ab54fd6-8cb1-4b74-9c62-50e5afc49026";
const VIDEO_SLUG = "dev-video-1";
const FEED_LANDING = "/nex-native/nex-feed";

interface SlideMeasurements {
  readonly url: string;
  readonly viewport: { width: number; height: number };
  readonly projectName: string;
  readonly mainExists: boolean;
  readonly mainRect: { x: number; y: number; width: number; height: number } | null;
  readonly frameRect: { x: number; y: number; width: number; height: number } | null;
  readonly siblingCount: string | null;
  readonly swipeNext: string | null;
  readonly swipePrev: string | null;
  readonly index: string | null;
  readonly coverRect?: { x: number; y: number; width: number; height: number } | null;
  readonly titleVisible?: boolean;
  readonly titleText?: string;
  readonly audioElementExists?: boolean;
  readonly audioSrc?: string | null;
  readonly videoElementExists?: boolean;
  readonly videoSrc?: string | null;
  readonly videoPaused?: boolean;
  readonly videoReadyState?: number;
}

async function measureVideoSlide(
  page: import("@playwright/test").Page,
  projectName: string,
): Promise<SlideMeasurements> {
  return page.evaluate((pn) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const main = document.querySelector<HTMLElement>('[data-nex-video-viewer="true"]');
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    const videoEl = document.querySelector<HTMLVideoElement>(
      '[data-nex-video-viewer-element="true"]',
    );
    const toRect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    return {
      url: window.location.pathname,
      viewport,
      projectName: pn,
      mainExists: !!main,
      mainRect: toRect(main),
      frameRect: toRect(frame),
      siblingCount: main?.getAttribute("data-nex-video-viewer-sibling-count") ?? null,
      swipeNext: main?.getAttribute("data-nex-video-viewer-swipe-next") ?? null,
      swipePrev: main?.getAttribute("data-nex-video-viewer-swipe-prev") ?? null,
      index: main?.getAttribute("data-nex-video-viewer-index") ?? null,
      videoElementExists: !!videoEl,
      videoSrc: videoEl?.currentSrc ?? videoEl?.getAttribute("src") ?? null,
      videoPaused: videoEl?.paused ?? null,
      videoReadyState: videoEl?.readyState ?? null,
    };
  }, projectName);
}

async function measureMusicSlide(
  page: import("@playwright/test").Page,
  projectName: string,
): Promise<SlideMeasurements> {
  return page.evaluate((pn) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const main = document.querySelector<HTMLElement>('[data-nex-music-viewer="true"]');
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    const card = document.querySelector<HTMLElement>("[data-nex-music-feed-card]");
    const cover = card?.querySelector<HTMLImageElement>('img[aria-hidden="true"]:not([src=""])');
    // Title heuristic · the big 20px/900 title line is inside the footer
    const titleCandidate = card
      ? Array.from(card.querySelectorAll<HTMLElement>("div")).find(
          (d) => d.style.fontSize === "20px" && d.style.fontWeight === "800",
        )
      : null;
    const audio = document.querySelector<HTMLAudioElement>('[data-nex-feed-audio]');
    const toRect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    return {
      url: window.location.pathname,
      viewport,
      projectName: pn,
      mainExists: !!main,
      mainRect: toRect(main),
      frameRect: toRect(frame),
      siblingCount: main?.getAttribute("data-nex-music-viewer-sibling-count") ?? null,
      swipeNext: main?.getAttribute("data-nex-music-viewer-swipe-next") ?? null,
      swipePrev: main?.getAttribute("data-nex-music-viewer-swipe-prev") ?? null,
      index: main?.getAttribute("data-nex-music-viewer-index") ?? null,
      coverRect: cover ? toRect(cover) : null,
      titleVisible: titleCandidate ? titleCandidate.offsetHeight > 0 : false,
      titleText: titleCandidate?.textContent ?? "",
      audioElementExists: !!audio,
      audioSrc: audio?.currentSrc ?? audio?.getAttribute("src") ?? null,
    };
  }, projectName);
}

async function dumpMeasurements(
  measurements: SlideMeasurements,
  filename: string,
): Promise<void> {
  const { promises: fs } = await import("node:fs");
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(SCREENSHOT_DIR, filename),
    JSON.stringify(measurements, null, 2),
  );
}

test.describe("NEX Feed · visual verification", () => {
  test("01 · landing redirect lands on a feed slide", async ({ page }, info) => {
    const resp = await page.goto(FEED_LANDING);
    // 307 → final slide URL
    expect(resp?.status()).toBeLessThan(400);
    // The server redirect should have landed us on a videoId route.
    expect(page.url()).toMatch(/\/nex-native\/nex-feed\/[^?#]+/);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-landing-${info.project.name}.png`),
      fullPage: false,
    });
  });

  test("02 · video slide renders · screenshot + DOM measurements", async ({
    page,
  }, info) => {
    await page.goto(`/nex-native/nex-feed/${VIDEO_SLUG}`);
    // Wait for the <main> and the <video> to attach · gracefully
    // continue even if the video hasn't started playing (autoplay may
    // be blocked in test runners).
    await page.waitForSelector('[data-nex-video-viewer="true"]', { timeout: 15_000 });
    await page.waitForSelector('[data-nex-video-viewer-element="true"]', { timeout: 10_000 });
    // Give the layout a frame to settle.
    await page.waitForTimeout(500);
    const m = await measureVideoSlide(page, info.project.name);
    await dumpMeasurements(m, `02-video-${info.project.name}.json`);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `02-video-${info.project.name}.png`),
      fullPage: false,
    });
    // Hard asserts the layout isn't collapsed to 0.
    expect(m.mainExists).toBe(true);
    expect(m.mainRect?.width ?? 0).toBeGreaterThan(100);
    expect(m.mainRect?.height ?? 0).toBeGreaterThan(100);
  });

  test("03 · music slide renders · screenshot + DOM measurements", async ({
    page,
  }, info) => {
    await page.goto(`/nex-native/nex-feed/${MUSIC_SLUG}`);
    await page.waitForSelector('[data-nex-music-viewer="true"]', { timeout: 15_000 });
    await page.waitForSelector("[data-nex-music-feed-card]", { timeout: 10_000 });
    await page.waitForTimeout(500);
    const m = await measureMusicSlide(page, info.project.name);
    await dumpMeasurements(m, `03-music-${info.project.name}.json`);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `03-music-${info.project.name}.png`),
      fullPage: false,
    });
    // Hard asserts: music viewer wrapper must not be collapsed, and
    // cover must be in-bounds of its parent frame.
    expect(m.mainExists).toBe(true);
    expect(m.mainRect?.width ?? 0).toBeGreaterThan(100);
    expect(m.mainRect?.height ?? 0).toBeGreaterThan(100);
    // Owner-stated requirement: cover visible + centered inside the
    // frame (not clipped off to one side).
    if (m.coverRect && m.frameRect) {
      // Cover must be within the frame's visible bounds (not negative
      // offset outside it).
      const coverRightEdge = m.coverRect.x + m.coverRect.width;
      const coverBottomEdge = m.coverRect.y + m.coverRect.height;
      const frameRightEdge = m.frameRect.x + m.frameRect.width;
      const frameBottomEdge = m.frameRect.y + m.frameRect.height;
      expect(m.coverRect.x).toBeGreaterThanOrEqual(m.frameRect.x);
      expect(coverRightEdge).toBeLessThanOrEqual(frameRightEdge + 2);
      expect(m.coverRect.y).toBeGreaterThanOrEqual(m.frameRect.y);
      expect(coverBottomEdge).toBeLessThanOrEqual(frameBottomEdge + 2);
    }
    // Title must be rendered + non-empty.
    expect(m.titleVisible).toBe(true);
    expect((m.titleText ?? "").length).toBeGreaterThan(0);
  });

  test("04 · swipe video → music via vertical gesture", async ({
    page,
  }, info) => {
    await page.goto(`/nex-native/nex-feed/${VIDEO_SLUG}`);
    await page.waitForSelector('[data-nex-video-viewer="true"]', { timeout: 15_000 });
    await page.waitForTimeout(400);
    const before = page.url();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `04a-swipe-vid-to-mus-before-${info.project.name}.png`),
    });

    // Perform ONE swipe-up gesture; the viewer should navigate to the
    // next sibling. We walk forward until we hit a `music-` slug or
    // reach a safe cap · the music post is at index 20 of 41 in the
    // interleaved pool so we may need multiple swipes to reach it.
    const maxSteps = 25;
    const isMobile = info.project.name === "mobile";
    const viewport = page.viewportSize();
    const centerX = (viewport?.width ?? 400) / 2;
    const topY = Math.round((viewport?.height ?? 800) * 0.75);
    const bottomY = Math.round((viewport?.height ?? 800) * 0.25);

    let hitMusic = false;
    for (let i = 0; i < maxSteps; i++) {
      if (isMobile) {
        // Touchscreen swipe up
        await page.touchscreen.tap(centerX, topY);
        await page.locator('[data-nex-video-viewer="true"], [data-nex-music-viewer="true"]')
          .first()
          .dispatchEvent("pointerdown", { clientX: centerX, clientY: topY });
        await page.locator('[data-nex-video-viewer="true"], [data-nex-music-viewer="true"]')
          .first()
          .dispatchEvent("pointerup", { clientX: centerX, clientY: bottomY });
      } else {
        // Desktop · mouse wheel (bigger delta than the 60px threshold)
        await page.mouse.move(centerX, (topY + bottomY) / 2);
        await page.mouse.wheel(0, 400);
      }
      // Wait for URL change before continuing.
      await page.waitForURL(/\/nex-native\/nex-feed\/[^?#]+/, { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(400);
      if (page.url().includes("/music-")) {
        hitMusic = true;
        break;
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `04b-swipe-vid-to-mus-after-${info.project.name}.png`),
    });
    await dumpMeasurements(
      {
        url: page.url(),
        viewport: viewport ?? { width: 0, height: 0 },
        projectName: info.project.name,
        mainExists: true,
        mainRect: null,
        frameRect: null,
        siblingCount: null,
        swipeNext: null,
        swipePrev: null,
        index: null,
      },
      `04-swipe-outcome-${info.project.name}.json`,
    );
    expect(before).not.toBe(page.url());
    expect(hitMusic).toBe(true);
  });

  test("05 · swipe music → video via vertical gesture", async ({
    page,
  }, info) => {
    await page.goto(`/nex-native/nex-feed/${MUSIC_SLUG}`);
    await page.waitForSelector('[data-nex-music-viewer="true"]', { timeout: 15_000 });
    await page.waitForTimeout(400);
    const before = page.url();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `05a-swipe-mus-to-vid-before-${info.project.name}.png`),
    });

    // One swipe-up to go to the next sibling · which per interleave
    // order is `dev-video-21`.
    const isMobile = info.project.name === "mobile";
    const viewport = page.viewportSize();
    const centerX = (viewport?.width ?? 400) / 2;
    const topY = Math.round((viewport?.height ?? 800) * 0.75);
    const bottomY = Math.round((viewport?.height ?? 800) * 0.25);

    if (isMobile) {
      await page.locator('[data-nex-music-viewer="true"]')
        .dispatchEvent("pointerdown", { clientX: centerX, clientY: topY });
      await page.locator('[data-nex-music-viewer="true"]')
        .dispatchEvent("pointerup", { clientX: centerX, clientY: bottomY });
    } else {
      await page.mouse.move(centerX, (topY + bottomY) / 2);
      await page.mouse.wheel(0, 400);
    }
    await page.waitForURL(/\/nex-native\/nex-feed\/dev-video-/, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `05b-swipe-mus-to-vid-after-${info.project.name}.png`),
    });
    expect(before).not.toBe(page.url());
    expect(page.url()).toMatch(/\/dev-video-/);
  });
});
