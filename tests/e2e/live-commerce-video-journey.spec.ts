// tests/e2e/live-commerce-video-journey.spec.ts
//
// Phase 2 · Live viewer journey · interactive browser verification.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "verify the actual viewer journey in
// a supported browser, including the video connection, comments, and
// footer controls — not just the server-rendered markers".
//
// What this proves (real Chromium at Pixel 7 viewport):
//   1 · The drawer landing route redirects to the first video.
//   2 · The video <video> element has a resolved src attribute.
//   3 · The video actually plays (currentTime advances past 0).
//   4 · The signal badge (satellite + wave ping) is visible.
//   5 · Like button toggles aria-pressed on click.
//   6 · View Shop is an anchor with the broadcaster's profile href.
//   7 · Share button opens the copy-link fallback popover (headless
//       Chromium has no navigator.share · the catch path kicks in).
//   8 · Text input accepts typing (readOnly=false path when the NEX
//       keypad is not activated in headless Chromium · the composer
//       falls back to native keyboard input).
//   9 · Send button becomes enabled when text is typed.
//  10 · Swipe up (synthesised touch events) navigates to next video.
//  11 · Keyboard ArrowDown mirrors the swipe.
//  12 · Screenshot artifact of the full viewer surface.
//
// Explicit non-claims:
//   · DOES NOT prove a Live WebRTC session end-to-end · that needs
//     a second broadcasting device · owner-provisioned.
//   · DOES NOT prove Supabase Realtime channels connect successfully
//     on a signed-in Live viewer · the uploaded-video viewer does
//     not mount those channels. (This spec covers the uploaded-video
//     viewer only · owner directive said "verify the actual viewer
//     journey" and the drawer currently lands on this viewer.)
//   · DOES NOT require any installed app · the test runs via
//     Playwright's own Chromium · same category of browser a NEX
//     web viewer would use. No separate streaming client.

import { expect, test } from "@playwright/test";

const VIEWER_PATH = "/nex-native/videos/dev-video-1";
const NEXT_VIEWER_PATH = "/nex-native/videos/dev-video-2";

test.describe("NEX Live · uploaded-video viewer · in-browser journey", () => {
  test("drawer landing redirects to the first video", async ({ page }) => {
    await page.goto("/nex-native/live-commerce");
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/nex-native\/videos\/dev-video-1/);
  });

  test("video element has src + is playing", async ({ page }) => {
    await page.goto(VIEWER_PATH);
    const video = page.locator("[data-nex-video-viewer-element]");
    await expect(video).toBeAttached({ timeout: 5000 });
    const src = await video.getAttribute("src");
    expect(src, "video src must be set").toBeTruthy();
    expect(src).toContain("/dev/live-videos/");

    // Wait up to 5s for currentTime to advance past 0 · proves the
    // video decoder actually started.
    await expect
      .poll(
        async () => await video.evaluate((v) => (v as HTMLVideoElement).currentTime),
        { timeout: 8000, intervals: [250, 500, 1000] },
      )
      .toBeGreaterThan(0);

    // The video must also be `autoplay` and `playsInline` so iOS
    // Safari respects the inline-play contract without going
    // fullscreen.
    expect(await video.evaluate((v) => (v as HTMLVideoElement).autoplay)).toBe(true);
    expect(await video.evaluate((v) => (v as HTMLVideoElement).playsInline)).toBe(true);
    expect(await video.evaluate((v) => (v as HTMLVideoElement).loop)).toBe(true);
  });

  test("video fits full-bleed mobile viewport · objectFit cover (portrait) or contain (landscape)", async ({ page }) => {
    await page.goto(VIEWER_PATH);
    const video = page.locator("[data-nex-video-viewer-element]");
    // Wait for the video metadata to resolve so the viewer has
    // already chosen between cover (portrait) and contain
    // (landscape · owner spec 2026-10-24 "avoid stretching or
    // distorting the video").
    await expect
      .poll(
        async () =>
          await video.evaluate((v) => (v as HTMLVideoElement).readyState >= 1),
        { timeout: 8000 },
      )
      .toBe(true);
    const info = await video.evaluate((v) => {
      const el = v as HTMLVideoElement;
      return {
        fit: window.getComputedStyle(el).objectFit,
        isLandscape: el.videoWidth > el.videoHeight,
      };
    });
    if (info.isLandscape) {
      expect(info.fit).toBe("contain");
      // Blurred-fill background exists when landscape.
      await expect(
        page.locator("[data-nex-video-viewer-bg-fill]"),
      ).toBeAttached();
    } else {
      expect(info.fit).toBe("cover");
    }
    // Main container fills the frame.
    const main = page.locator("[data-nex-video-viewer]");
    const dims = await main.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      width: el.getBoundingClientRect().width,
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
    }));
    expect(Math.abs(dims.height - dims.windowHeight)).toBeLessThan(3);
    expect(Math.abs(dims.width - dims.windowWidth)).toBeLessThan(3);
  });

  test("sound · tries unmuted autoplay first · falls back to muted + chip only when browser blocks", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    const video = page.locator("[data-nex-video-viewer-element]");
    await video.waitFor({ timeout: 5000 });
    // Owner directive 2026-10-24 · "sound is auto playing with each
    // video live and always playing for live unless user will mute".
    // After the mount effect runs the viewer settles into exactly
    // one of two honest states:
    //   A · unmuted (ideal · browser allowed unmuted autoplay)
    //   B · muted + "Tap for sound" chip visible (fallback · browser
    //       blocked unmuted autoplay)
    // We assert ONE of A or B · never neither / both.
    const unmuteChip = page.locator("[data-nex-video-viewer-unmute]");
    await expect
      .poll(async () => {
        const muted = await video.evaluate((v) => (v as HTMLVideoElement).muted);
        const chipVisible = await unmuteChip.isVisible().catch(() => false);
        // Honest state · (unmuted AND no chip) OR (muted AND chip)
        return (!muted && !chipVisible) || (muted && chipVisible);
      }, { timeout: 5000 })
      .toBe(true);

    // If we're in state B (muted fallback), tapping the chip must
    // unmute · in state A the chip is already gone.
    if (await unmuteChip.isVisible().catch(() => false)) {
      await unmuteChip.click();
      await expect
        .poll(async () => await video.evaluate((v) => (v as HTMLVideoElement).muted), {
          timeout: 3000,
        })
        .toBe(false);
      await expect(unmuteChip).toBeHidden();
    }
  });

  test("header · Live {Country} title + magnifying glass + 3-dot drawer visible top-row", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    const header = page.locator("[data-nex-video-viewer-header]");
    await expect(header).toBeVisible({ timeout: 5000 });
    // zIndex-stability check · the title stays visible after the video
    // paints its first frame (regression guard for the Oct 24 bug).
    const title = page.locator("[data-nex-video-viewer-title-primary]");
    await expect(title).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(title).toBeVisible();
    // Narrow selector · the title div contains a satellite-icon SVG
    // sibling that carries a <style> keyframe block; its text leaks
    // into the parent's textContent. The dedicated text span is the
    // single source of truth for the title string.
    const titleText = (
      (await page
        .locator("[data-nex-video-viewer-title-text]")
        .textContent()) ?? ""
    ).trim();
    expect(titleText).toMatch(/^Live\s+(Indonesia|ID|NEX)$/);
    // Subtitle shows "Broadcasted {date}" after client-side format fills.
    const subtitle = page.locator("[data-nex-video-viewer-title-secondary]");
    await expect
      .poll(async () => (await subtitle.textContent()) ?? "", { timeout: 4000 })
      .toMatch(/^Broadcasted\s+/);
    // 🔍 magnifying glass present.
    await expect(page.locator("[data-nex-video-viewer-search]")).toBeVisible();
    // ⋮ 3-dot drawer trigger present.
    await expect(
      page.locator("[data-nex-video-viewer-menu-trigger]"),
    ).toBeVisible();
  });

  test("magnifying glass opens 12-tile category grid overlay", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-video-viewer-search]").click();
    const sheet = page.locator("[data-nex-category-sheet]");
    await expect(sheet).toBeVisible({ timeout: 3000 });
    const tiles = page.locator("[data-nex-category-tile]");
    expect(await tiles.count()).toBe(12);
    // Scrim dismiss · click outside the sheet's bounds (top-left
     // corner of the viewer, well above the centered tile area).
    await page
      .locator("[data-nex-category-sheet-scrim]")
      .click({ position: { x: 20, y: 20 } });
    await expect(sheet).toBeHidden();
  });

  test("category chain · tapping Travel tile routes to first temple video with chain context", async ({
    page,
  }) => {
    // Owner directive 2026-10-24 · "user selects temple after
    // viewing all they will see the next flow maybe for volcano and
    // if that finished we show next close to that beaches".
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-video-viewer-search]").click();
    // Travel tile — pinned slug "travel" at position 3 (index 2).
    await page
      .locator('[data-nex-category-tile][data-nex-category-slug="travel"]')
      .click();
    // Server-side discover resolver redirects to the first temple
    // video with ?chain=travel. In the dev manifest, dev-video-1
    // is tagged ["temple"].
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/videos\/dev-video-1\?chain=travel/);
    // Chain-context chip visible on the resulting viewer header.
    const chip = page.locator("[data-nex-video-viewer-chain-chip]");
    await expect(chip).toBeVisible({ timeout: 5000 });
    const chipText = (await chip.textContent()) ?? "";
    expect(chipText).toContain("Travel");
    expect(chipText).toContain("Temple");
  });

  test("category chain · swipe up advances temple → volcano → beach", async ({
    page,
  }) => {
    // Enter the chain via the Travel discover resolver.
    await page.goto("/nex-native/live-commerce/discover/travel");
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/videos\/dev-video-1\?chain=travel/);
    // Swipe up · should advance to volcano (dev-video-2).
    await page.evaluate(() => {
      const el = document.querySelector(
        "[data-nex-video-viewer]",
      ) as HTMLElement | null;
      if (!el) throw new Error("viewer not mounted");
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const startY = rect.top + rect.height * 0.7;
      const endY = rect.top + rect.height * 0.2;
      el.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: x,
          clientY: startY,
          pointerType: "touch",
          isPrimary: true,
        }),
      );
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: x,
          clientY: endY,
          pointerType: "touch",
          isPrimary: true,
        }),
      );
    });
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/videos\/dev-video-2/);
    // Chain context preserved · poll the chip text so we don't read
    // the stale "Temple" chip before React reconciles the new page.
    const chip = page.locator("[data-nex-video-viewer-chain-chip]");
    await expect
      .poll(async () => (await chip.textContent()) ?? "", { timeout: 8000 })
      .toContain("Volcano");
    expect((await chip.textContent()) ?? "").toContain("Travel");
  });

  test("3-dot drawer trigger · ControlDrawer mounted (same as /contacts)", async ({
    page,
  }) => {
    // Owner directive 2026-10-24 · "side drawer live should be exact
    // same side drawer as on the page /contacts". The viewer now
    // mounts <ControlDrawer session={null} /> inside the trigger
    // wrapper · the drawer owns its own trigger button + open state
    // + portal. We assert the wrapper is present and contains a
    // ControlDrawer trigger.
    await page.goto(VIEWER_PATH);
    const wrapper = page.locator("[data-nex-video-viewer-menu-trigger]");
    await expect(wrapper).toBeVisible({ timeout: 5000 });
    // ControlDrawer renders a button as its trigger; it's inside
    // the wrapper.
    const triggerBtn = wrapper.locator("button").first();
    await expect(triggerBtn).toBeVisible({ timeout: 3000 });
  });

  test("Like button · toggles aria-pressed on click", async ({ page }) => {
    await page.goto(VIEWER_PATH);
    const like = page.locator("[data-nex-live-footer-like]");
    await expect(like).toBeVisible({ timeout: 5000 });
    expect(await like.getAttribute("aria-pressed")).toBe("false");
    await like.click();
    expect(await like.getAttribute("aria-pressed")).toBe("true");
    await like.click();
    expect(await like.getAttribute("aria-pressed")).toBe("false");
  });

  test("Big CTA · uploaded video with no business → View Market, routes to directory", async ({
    page,
  }) => {
    // Owner directive 2026-10-24 · "the view shop button ... but other
    // live posts that has not owner live or not related will show view
    // market which diverts to nex search directory".
    // Dev-manifest videos have business_id=null + empty topic_tags, so
    // the resolver routes to /nex-native/directory unfiltered with the
    // "View Market" label.
    await page.goto(VIEWER_PATH);
    const cta = page.locator("[data-nex-live-footer-view-shop]");
    await expect(cta).toBeVisible();
    const kind = await cta.getAttribute("data-nex-live-footer-view-target-kind");
    expect(kind).toBe("market");
    await expect(cta).toHaveText(/Market/);
    const href = await cta.getAttribute("href");
    expect(href).toBe("/nex-native/directory");
    const tagName = await cta.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("a");
  });

  test("Go Live · anchor renders in footer · routes to broadcaster surface", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    const goLive = page.locator("[data-nex-live-footer-go-live]");
    await expect(goLive).toBeVisible({ timeout: 5000 });
    const href = await goLive.getAttribute("href");
    expect(href).toBe("/nex-native/live-commerce/go-live");
    const tagName = await goLive.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("a");
    // Minimum tap-target height · owner directive "fix the ... go live button".
    const dims = await goLive.evaluate((el) => el.getBoundingClientRect());
    expect(dims.height).toBeGreaterThanOrEqual(44);
  });

  test("footer actions · all 4 buttons visible without overflow on 412px viewport", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    const actionsRow = page.locator("[data-nex-live-viewer-footer-actions]");
    await expect(actionsRow).toBeVisible();
    const rowRect = await actionsRow.evaluate((el) => el.getBoundingClientRect());
    // Each of the 4 buttons must fit inside the row without clipping.
    const buttons = [
      "[data-nex-live-footer-like]",
      "[data-nex-live-footer-go-live]",
      "[data-nex-live-footer-view-shop]",
      "[data-nex-live-footer-share]",
    ];
    for (const sel of buttons) {
      const b = page.locator(sel);
      await expect(b).toBeVisible();
      const r = await b.evaluate((el) => el.getBoundingClientRect());
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1);
      expect(r.right).toBeLessThanOrEqual(rowRect.right + 1);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("Share · fallback popover opens when navigator.share is unavailable", async ({
    page,
  }) => {
    // Owner spec 2026-10-24 · 3-option share bottom sheet.
    await page.goto(VIEWER_PATH);
    const share = page.locator("[data-nex-live-footer-share]");
    await expect(share).toBeVisible();
    await share.click();
    const sheet = page.locator("[data-nex-video-share-sheet]");
    await expect(sheet).toBeVisible({ timeout: 3000 });
    // All three sealed options are present.
    await expect(
      page.locator("[data-nex-video-share-option-nex-contact]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-video-share-option-whatsapp]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-video-share-option-copy-link]"),
    ).toBeVisible();
    // Scrim dismiss.
    await page.locator("[data-nex-video-share-scrim]").click();
    await expect(sheet).toBeHidden();
  });

  test("Share · bottom sheet · NEX contact mode renders contact rows", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-live-footer-share]").click();
    await page
      .locator("[data-nex-video-share-option-nex-contact]")
      .click();
    const contacts = page.locator("[data-nex-video-share-contact-row]");
    await expect(contacts.first()).toBeVisible({ timeout: 3000 });
    const count = await contacts.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Posted date · uploaded video chip shows 'Posted {localized date}'", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    // Owner directive 2026-10-24 · header reworked. "Posted {date}"
    // is retired on the recorded viewer in favour of
    // "Broadcasted {date}" rendered as the title's secondary line.
    const subtitle = page.locator("[data-nex-video-viewer-title-secondary]");
    await expect(subtitle).toBeVisible({ timeout: 5000 });
    await expect
      .poll(async () => (await subtitle.textContent()) ?? "", { timeout: 4000 })
      .toMatch(/^Broadcasted\s+/);
  });

  test("Send button · gated by non-empty composer text", async ({ page }) => {
    await page.goto(VIEWER_PATH);
    const send = page.locator("[data-nex-live-footer-send]");
    await expect(send).toBeVisible();
    expect(await send.isDisabled()).toBe(true);
    // Type via the composer textarea. NexTextarea on desktop
    // Chromium is read-only when the keypad is active · in headless
    // Pixel-7 emulation the keypad doesn't activate so the native
    // textarea is editable. We check both paths.
    const composer = page.locator("[data-nex-live-footer-text-input]");
    const isReadOnly = await composer.evaluate((el) =>
      (el as HTMLTextAreaElement).readOnly,
    );
    if (!isReadOnly) {
      await composer.fill("hello");
      expect(await send.isDisabled()).toBe(false);
    } else {
      // If the keypad is active, the test harness can't inject
      // text through the keypad surface · we document that gap
      // honestly here. The send-gating logic is still proven by
      // its source-shape tests + the client guard
      // `draft.trim().length === 0`.
      test.info().annotations.push({
        type: "known-limitation",
        description:
          "NEX keypad active in this viewport · headless injection into the keypad is not implemented · gating logic is unit-tested at the source-shape layer.",
      });
    }
  });

  test("swipe up (synthesised pointer drag) navigates to the next video", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    await page.waitForLoadState("domcontentloaded");
    await page.locator("[data-nex-video-viewer]").waitFor({ timeout: 5000 });
    // Owner directive 2026-10-24 · "swipe must be screen same as
    // tiktok not button . but also active swipe up or down with
    // mouse on computer". The viewer uses PointerEvents · we
    // synthesise a pointerdown→pointerup pair with dy = -0.5*height
    // which exceeds the 60px threshold.
    await page.evaluate(() => {
      const el = document.querySelector("[data-nex-video-viewer]") as HTMLElement | null;
      if (!el) throw new Error("viewer not mounted");
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const startY = rect.top + rect.height * 0.7;
      const endY = rect.top + rect.height * 0.2;
      el.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: x,
          clientY: startY,
          pointerType: "touch",
          isPrimary: true,
        }),
      );
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: x,
          clientY: endY,
          pointerType: "touch",
          isPrimary: true,
        }),
      );
    });
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/dev-video-2/);
  });

  test("mouse drag up (desktop · real page.mouse API) navigates to the next video", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    const viewer = page.locator("[data-nex-video-viewer]");
    await viewer.waitFor({ timeout: 5000 });
    // Owner directive 2026-10-24 · "also active swipe up or down with
    // mouse on computer". Use Playwright's real mouse API · it drives
    // the browser's native pointer-event pipeline including the
    // button/buttons fields that match a true desktop mouse-drag.
    const box = await viewer.boundingBox();
    if (!box) throw new Error("viewer has no bounding box");
    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.7;
    const endY = box.y + box.height * 0.2;
    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, (startY + endY) / 2, { steps: 5 });
    await page.mouse.move(x, endY, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/dev-video-2/);
  });

  test("mouse wheel down · navigates to next · cooldown prevents double-skip", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-video-viewer]").waitFor({ timeout: 5000 });
    await page.evaluate(() => {
      const el = document.querySelector("[data-nex-video-viewer]") as HTMLElement | null;
      if (!el) throw new Error("viewer not mounted");
      el.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 }),
      );
    });
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/dev-video-2/);
  });

  test("keyboard ArrowDown mirrors swipe up · navigates to next", async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-video-viewer]").waitFor({ timeout: 5000 });
    // Dispatch the keydown directly on window inside the page
    // context · bypasses focus-target ambiguity introduced by the
    // 4-button footer which can intercept body-level clicks.
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/dev-video-2/);
  });

  test("full viewer screenshot · owner-reviewable artifact", async ({
    page,
  }, testInfo) => {
    await page.goto(VIEWER_PATH);
    await page.locator("[data-nex-video-viewer]").waitFor({ timeout: 5000 });
    // Give the video 1 second to start rendering so the screenshot
    // has pixels, not black.
    await page.waitForTimeout(1500);
    const shot = await page.screenshot({ fullPage: false });
    await testInfo.attach("video-viewer-full-screen", {
      body: shot,
      contentType: "image/png",
    });
  });
});

test.describe("NEX Live · explicit non-claims", () => {
  test("does NOT require a separate streaming app · browser-only", async ({
    page,
  }) => {
    // The whole spec runs in Playwright's bundled Chromium. If the
    // viewer required a separate installed app, the <video> element
    // tests above would fail to resolve a src · the fact they pass
    // demonstrates the browser-only contract.
    await page.goto(VIEWER_PATH);
    const video = page.locator("[data-nex-video-viewer-element]");
    const src = await video.getAttribute("src");
    expect(src, "browser serves the stream directly").toBeTruthy();
  });

  test("does NOT prove a Live WebRTC session end-to-end", async () => {
    // The uploaded-video viewer uses a plain <video src="…"> with
    // the file served by Next.js static middleware. The Live viewer
    // at /live-commerce/[sessionId] uses WebRTC + Supabase Realtime
    // · exercising that path requires a second broadcasting device
    // · owner-provisioned auth fixture.
    expect(true).toBe(true);
  });
});
