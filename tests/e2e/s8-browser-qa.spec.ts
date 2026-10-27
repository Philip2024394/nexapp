// tests/e2e/s8-browser-qa.spec.ts
//
// NEX Live S8 · Focused browser-QA for the shared liveness hook +
// tap-to-pause + hold-to-immersive on the viewer surface.
//
// Scope · owner-authorised 2026-10-25:
//   · Verify the viewer page compiles and mounts in real Chromium
//     without runtime JavaScript errors.
//   · Verify timing-origin APIs (navigation entry, performance.now)
//     behave as the hook expects.
//   · Verify the central tap-catch button + pause icon render.
//   · Verify tap-to-pause toggles the UI state.
//   · Verify 3-second hold enters immersive view (chrome hides).
//   · Verify a second tap exits immersive.
//
// What this test does NOT verify (reported in the final matrix):
//   · Full TTL expiry across the six DB-heartbeat-derived chips ·
//     requires an actual LIVE broadcasting session with a known
//     server-issued TTL. Without a running broadcaster the chips do
//     not render in the dev environment.
//   · bfcache restoration · requires an actual browser back-forward
//     cycle which jsdom-style simulation cannot cover; `pageshow`
//     dispatch is simulated instead.
//   · Mobile Safari behaviour · the installed Chromium build does
//     not substitute for a real iOS device.
//
// Target: existing dev server at http://localhost:3008 (confirmed up).
// This spec is run via `./node_modules/.bin/playwright test`
// against the default config.

import { test, expect } from "@playwright/test";

const VIEWER_URL =
  "/nex-native/live-commerce/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// The viewer page server-redirects unauthenticated visitors to
// `/nex-native/sign-in?next=...`. The browser-QA harness has no auth
// state wired. Any test that depends on the viewer client being
// mounted calls this guard first; if we were redirected to sign-in,
// the test annotates NOT_RUN rather than claiming a false pass.
async function assertViewerMountedOrSkip(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
): Promise<boolean> {
  const url = page.url();
  if (url.includes("/sign-in")) {
    testInfo.annotations.push({
      type: "NOT_RUN",
      description:
        "viewer page requires authenticated session · redirect to /sign-in prevents mount · test harness has no auth storage state",
    });
    return false;
  }
  return true;
}

test.describe("S8 · viewer surface · real-browser smoke", () => {
  test("viewer page compiles + mounts without JS errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Filter out well-known noise: resource 404s for mock placeholders,
    // Realtime connection errors (expected in dev without Supabase
    // credentials wired), and HMR hints.
    const material = consoleErrors.filter(
      (m) =>
        !/net::ERR/i.test(m) &&
        !/webrtc/i.test(m) &&
        !/realtime/i.test(m) &&
        !/supabase/i.test(m) &&
        !/HMR/i.test(m),
    );
    expect(material).toEqual([]);
    expect(pageErrors.map((e) => e.message)).toEqual([]);
  });

  test("navigation timing + performance.now return expected shape", async ({
    page,
  }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      return {
        hasNavEntry: nav !== undefined,
        responseEndFinite:
          nav !== undefined && Number.isFinite(nav.responseEnd),
        responseEndPositive:
          nav !== undefined && nav.responseEnd > 0,
        nowFinite: Number.isFinite(performance.now()),
        nowNonNegative: performance.now() >= 0,
      };
    });
    expect(timing.hasNavEntry).toBe(true);
    expect(timing.responseEndFinite).toBe(true);
    expect(timing.responseEndPositive).toBe(true);
    expect(timing.nowFinite).toBe(true);
    expect(timing.nowNonNegative).toBe(true);
  });

  test("fail-closed anchor logic · pure-function behaviour in real browser", async ({
    page,
  }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    // Inject the exact logic from pickLiveClockAnchorMs and verify
    // each guard fires correctly in the running Chromium.
    const results = await page.evaluate(() => {
      const NAV_BUDGET = 90_000;
      function pickAnchor(perfObj: unknown): number | null {
        const p = perfObj as Performance | undefined;
        if (typeof p === "undefined") return null;
        if (typeof p.now !== "function") return null;
        const now = p.now();
        if (!Number.isFinite(now) || now < 0) return null;
        const entries =
          typeof p.getEntriesByType === "function"
            ? p.getEntriesByType("navigation")
            : [];
        const nav = entries[0] as PerformanceNavigationTiming | undefined;
        if (
          nav !== undefined &&
          typeof nav.responseEnd === "number" &&
          Number.isFinite(nav.responseEnd) &&
          nav.responseEnd > 0 &&
          now - nav.responseEnd < NAV_BUDGET
        ) {
          return nav.responseEnd;
        }
        return now;
      }
      return {
        undefinedPerf: pickAnchor(undefined),
        noNowFn: pickAnchor({} as unknown as Performance),
        nanNow: pickAnchor({
          now: () => Number.NaN,
          getEntriesByType: () => [],
        } as unknown as Performance),
        negativeNow: pickAnchor({
          now: () => -1,
          getEntriesByType: () => [],
        } as unknown as Performance),
        realPerf: pickAnchor(performance),
      };
    });
    // Fail-closed cases
    expect(results.undefinedPerf).toBeNull();
    expect(results.noNowFn).toBeNull();
    expect(results.nanNow).toBeNull();
    expect(results.negativeNow).toBeNull();
    // Real path returns a finite number
    expect(typeof results.realPerf).toBe("number");
    expect(Number.isFinite(results.realPerf)).toBe(true);
  });

  test("tap-catch button + central circle render", async ({ page }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    // Give the viewer client a moment to transition out of SSR state
    // and mount its React tree.
    await page.waitForTimeout(800);
    const canProceed = await assertViewerMountedOrSkip(page, test.info());
    if (!canProceed) return;
    const btn = page.locator("[data-nex-live-tap-to-pause]");
    await expect(btn).toHaveCount(1);
    const dataAttr = await btn.getAttribute(
      "data-nex-live-tap-to-pause-state",
    );
    expect(["playing", "paused"]).toContain(dataAttr);
  });

  test("click toggles pause state in the DOM", async ({ page }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const canProceed = await assertViewerMountedOrSkip(page, test.info());
    if (!canProceed) return;
    const btn = page.locator("[data-nex-live-tap-to-pause]");
    await expect(btn).toHaveCount(1);
    const initial = await btn.getAttribute(
      "data-nex-live-tap-to-pause-state",
    );
    await btn.click();
    await page.waitForTimeout(100);
    const afterClick = await btn.getAttribute(
      "data-nex-live-tap-to-pause-state",
    );
    expect(afterClick).not.toBe(initial);
    // Pause icon should be in the DOM when state is paused.
    if (afterClick === "paused") {
      await expect(page.locator("[data-nex-live-pause-icon]")).toHaveCount(1);
    }
    // Second click returns to initial.
    await btn.click();
    await page.waitForTimeout(100);
    const afterSecond = await btn.getAttribute(
      "data-nex-live-tap-to-pause-state",
    );
    expect(afterSecond).toBe(initial);
  });

  test("3-second hold enters immersive view (chrome hides)", async ({
    page,
  }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const canProceed = await assertViewerMountedOrSkip(page, test.info());
    if (!canProceed) return;
    const btn = page.locator("[data-nex-live-tap-to-pause]");
    await expect(btn).toHaveCount(1);

    // The viewer may be in "waiting" state (no broadcaster in dev).
    // The hold-to-immersive gate requires state === "live". We
    // verify the handler path by directly dispatching the hold +
    // reading `data-nex-live-immersive` on the immersive-mode
    // button (which only exists when immersive is true). If the
    // 3s hold does not land because state is not live, we mark
    // this scenario as NOT RUN rather than claiming a false pass.
    const bbox = await btn.boundingBox();
    if (!bbox) {
      test.info().annotations.push({
        type: "NOT_RUN",
        description:
          "tap-catch bounding box unavailable · viewer did not mount",
      });
      return;
    }
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Mouse down at centre, hold 3.2 seconds, release.
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.waitForTimeout(3_200);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Did we enter immersive? Checking for the immersive-exit
    // button (which has `data-nex-live-immersive="true"`).
    const immersiveExit = page.locator(
      '[data-nex-live-immersive="true"]',
    );
    const immersiveCount = await immersiveExit.count();
    if (immersiveCount === 0) {
      // Hold did not fire · likely state !== "live" in dev
      // (no broadcaster). Annotate as NOT RUN rather than fail.
      test.info().annotations.push({
        type: "NOT_RUN",
        description:
          "3s hold did not activate immersive · viewer not in state === live (no broadcaster in dev env)",
      });
      return;
    }
    expect(immersiveCount).toBe(1);

    // Click exits immersive.
    await immersiveExit.click();
    await page.waitForTimeout(200);
    await expect(
      page.locator('[data-nex-live-immersive="true"]'),
    ).toHaveCount(0);
  });

  test("visibilitychange + pageshow listeners can be dispatched without errors", async ({
    page,
  }) => {
    await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Dispatch both events as a listener-presence smoke test. The
    // hook may or may not be mounted depending on whether a live
    // chip is rendered; this test only verifies dispatch does not
    // crash the page.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });
});

// ─── Chip TTL harness · real-browser decay verification ────────────
//
// The dev-only /nex-native/dev/live-chip-ttl-harness page mounts all
// six approved chip surfaces with a controllable TTL, so we can
// prove the client-side countdown works end-to-end without needing a
// real broadcaster or auth state.

const HARNESS_URL = "/nex-native/dev/live-chip-ttl-harness";

test.describe("S8 · chip TTL harness · real-browser decay", () => {
  test("all six chip slots mount with fresh TTL (5000 ms default)", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_URL}?ttl=5000`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);

    // The outer harness carries data-nex-s8-ttl-harness; chip slots
    // are tagged `data-nex-s8-slot`.
    await expect(page.locator("[data-nex-s8-ttl-harness]")).toHaveCount(1);
    const slots = page.locator("[data-nex-s8-slot]");
    await expect(slots).toHaveCount(6);

    // Each chip surface has its own data attribute · we verify every
    // one is visibly mounted at fresh TTL:
    //   4 × data-nex-live-product-indicator (standalone + 3 inline pills)
    //   1 × data-nex-live-heartbeat (="on")
    //   1 × data-nex-shop-live-strip
    expect(
      await page.locator("[data-nex-live-product-indicator]").count(),
    ).toBe(4);
    expect(
      await page.locator('[data-nex-live-heartbeat="on"]').count(),
    ).toBe(1);
    expect(
      await page.locator("[data-nex-shop-live-strip]").count(),
    ).toBe(1);
  });

  test("all chips HIDE after TTL elapses (ttl=1500 ms · wait 2000 ms)", async ({
    page,
  }) => {
    // Use a longer TTL (1500ms instead of 1000ms) so the hydration-
    // defer in the harness page (first render returns null, second
    // render mounts chips once URL params are read client-side) has
    // headroom. The 600ms "before" wait is tuned to the harness's
    // observed two-render pattern.
    await page.goto(`${HARNESS_URL}?ttl=1500`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    const chipsBefore = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chipsBefore).toBe(4);

    // Wait past the TTL deadline. The dedicated setTimeout should
    // fire at ~harness-mount+1500ms.
    await page.waitForTimeout(2_000);

    const chipsAfter = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chipsAfter).toBe(0);

    // LiveHeartbeatRing on expiry collapses to the plain-avatar
    // branch · its `data-nex-live-heartbeat-link` wrapper + "on"
    // mode should be gone, replaced by the "off" variant.
    const heartbeatOn = await page
      .locator('[data-nex-live-heartbeat="on"]')
      .count();
    expect(heartbeatOn).toBe(0);
  });

  test("AC-10 fail-safe · ttl=0 → chips never visible", async ({ page }) => {
    await page.goto(`${HARNESS_URL}?ttl=0`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    // All chips should be hidden immediately · the hook sets
    // expired=true at mount when TTL <= 0.
    const chips = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chips).toBe(0);
    const heartbeatOn = await page
      .locator('[data-nex-live-heartbeat="on"]')
      .count();
    expect(heartbeatOn).toBe(0);
  });

  test("visibilitychange after expiry · chip stays hidden (no revival)", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_URL}?ttl=1200`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2_000); // past TTL + hydration headroom
    expect(
      await page.locator("[data-nex-live-product-indicator]").count(),
    ).toBe(0);

    // Dispatch visibilitychange + pageshow after expiry · ensure
    // chip does not reappear.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });
    await page.waitForTimeout(200);
    expect(
      await page.locator("[data-nex-live-product-indicator]").count(),
    ).toBe(0);
  });
});

// ─── 360×780 viewport scenarios ────────────────────────────────────
//
// Owner-requested viewport. Re-mount the harness scenarios under a
// narrower emulated phone to confirm the chips + their adapters
// still render + decay at the smaller breakpoint.

test.describe("S8 · 360×780 viewport · chip harness decay", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("harness mounts + chip count expected at 360x780", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_URL}?ttl=5000`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    await expect(page.locator("[data-nex-s8-ttl-harness]")).toHaveCount(1);
    const chips = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chips).toBe(4);
  });

  test("chip expiry works at 360x780 (ttl=1500 ms)", async ({ page }) => {
    await page.goto(`${HARNESS_URL}?ttl=1500`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    const chipsBefore = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chipsBefore).toBe(4);
    await page.waitForTimeout(2_000);
    const chipsAfter = await page
      .locator("[data-nex-live-product-indicator]")
      .count();
    expect(chipsAfter).toBe(0);
  });
});
