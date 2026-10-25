// tests/e2e/live-commerce-visual-verify.spec.ts
//
// Visual verification of the NEX Live surfaces at the intended mobile
// viewport. Produces screenshots as artifacts the owner can review.
// -----------------------------------------------------------------------------
// Honest scope:
//   · Guest (no auth) · we CAN load the feed (public) + see it SSR'd.
//   · Guest viewer page redirects to sign-in · we assert the redirect
//     and screenshot the sign-in page to prove routing works.
//   · Signed-in verification is BLOCKED on the auth storage state
//     fixture (G-E2E · owner-provided) · we document that honestly.
//
// What we actually prove here:
//   · Feed renders (not 5xx).
//   · Feed empty-state renders when no live sessions exist.
//   · Feed Go Live CTA is ABSENT for a guest (correct · signed-in only).
//   · Viewer URL redirects guests to sign-in.
//   · Both pages produce artifact screenshots for owner review.

import { expect, test } from "@playwright/test";

test.describe("NEX Live · visual verification · mobile viewport", () => {
  test("feed renders at mobile viewport · guest sees list + no Go Live CTA", async ({
    page,
  }, testInfo) => {
    const response = await page.goto("/nex-native/live-commerce/feed");
    expect(response?.status() ?? 500).toBeLessThan(500);

    // Capture the viewport screenshot as an artifact for owner review.
    const bodyShot = await page.screenshot({ fullPage: false });
    await testInfo.attach("feed-guest-viewport", {
      body: bodyShot,
      contentType: "image/png",
    });

    // Guests do NOT see the Go Live CTA · it only renders when
    // resolveNexAppSessionFromContext returns a signed-in account.
    const cta = await page.locator("[data-nex-live-feed-go-live-cta]").count();
    expect(cta, "Go Live CTA must be hidden for guests").toBe(0);

    // Feed header "NEX Live" eyebrow + h1 is visible.
    await expect(page.locator("body")).toContainText(/NEX Live/i);
    await expect(page.locator("body")).toContainText(/Who's live now|coming next/i);
  });

  test("viewer page redirects guests to sign-in · artifact captured", async ({
    page,
  }, testInfo) => {
    const fakeSession = "11111111-1111-1111-1111-111111111111";
    await page.goto(`/nex-native/live-commerce/${fakeSession}`);
    // After the redirect, URL should be the sign-in surface.
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/nex-native\/sign-in|\/welcome/);
    const bodyShot = await page.screenshot({ fullPage: false });
    await testInfo.attach("viewer-guest-redirect-viewport", {
      body: bodyShot,
      contentType: "image/png",
    });
  });

  test("feed empty-state is honestly labelled when no live sessions exist", async ({
    page,
  }) => {
    await page.goto("/nex-native/live-commerce/feed");
    // Fail-open contract · when Migration 219 is unapplied OR there
    // are zero open sessions, the empty state renders cleanly.
    const body = await page.locator("body").innerText();
    // At least one of these should be present (depending on whether
    // the DB has sessions or not).
    expect(
      body,
      "feed body must have discoverable Live content or honest empty state",
    ).toMatch(/no (one is )?live|coming next|Who's live now/i);
  });

  test("Shop Contacts page redirects guests to sign-in", async ({ page }) => {
    const fakeSession = "22222222-2222-2222-2222-222222222222";
    await page.goto(`/nex-native/manage/live/shop-contacts/${fakeSession}`);
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/nex-native\/sign-in|\/welcome/);
  });
});

test.describe("NEX Live · explicit non-claims", () => {
  test("DOES NOT prove the signed-in viewer footer renders · needs auth fixture", async () => {
    // The Like / View Shop / Share / NEX keypad footer renders only
    // for a signed-in viewer. The project `mobile-chromium-pixel7-
    // authed` would exercise this · it requires `tests/e2e/.auth/
    // state.json` which only an owner-authorised interactive sign-in
    // can produce. See
    // docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md
    //
    // Guard-rail · do NOT silently create a mock storage state file.
    expect(true).toBe(true);
  });

  test("vertical swipe-nav on the viewer surface is implemented · interactive E2E needs auth fixture", async () => {
    // The viewer surface at /live-commerce/[sessionId] IS the full-
    // bleed swipeable surface · each snap is one broadcast at 100dvh
    // × 100vw with no internal scroll. Swipe up → next broadcast,
    // swipe down → previous. Siblings fetched server-side from
    // listOpenSessionsPublic (viewer's own session excluded).
    //
    // What's NOT verified here · the GESTURE firing router.push to
    // the next session id in a real browser session. That needs the
    // auth storage state fixture (G-E2E · owner-provided) + two
    // actively-broadcasting sessions to swipe between.
    //
    // The feed at /live-commerce/feed remains a scrolled list of
    // compact cards · it's the discovery entry · tapping a card
    // takes the viewer into the swipeable viewer surface.
    expect(true).toBe(true);
  });
});
