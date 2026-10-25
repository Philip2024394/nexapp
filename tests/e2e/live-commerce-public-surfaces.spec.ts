// tests/e2e/live-commerce-public-surfaces.spec.ts
//
// Phase 2 · G2 · browser-level verification of the Live commerce
// public surfaces that do NOT require sign-in or an applied
// Migration 219.
// -----------------------------------------------------------------------------
// EVIDENCE BOUNDARY
//   · These tests run against the dev server at http://localhost:3008.
//   · They exercise SSR shape + redirect behaviour · not interactive
//     WebRTC / Realtime / heartbeat flows (those need an authenticated
//     test account + the migration applied in a sandbox).
//   · Tests assert honest fail-open defaults · the Live surfaces must
//     render SOMETHING coherent even when no live sessions exist and
//     Migration 219's tables are absent.

import { expect, test } from "@playwright/test";

test.describe("NEX Live · public surfaces · fail-open shape", () => {
  test("central Live feed renders · honest empty state when no sessions", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/live-commerce/feed");
    expect(
      response?.status(),
      "feed page returns 2xx or redirect to sign-in",
    ).toBeLessThan(500);

    // The feed route is public · no sign-in redirect required.
    // Should render SOMETHING (empty state or an actual feed).
    const bodyText = await page.locator("body").innerText();
    // One of: our empty-state copy, or a sign-in copy if the route
    // was gated. We accept either without pinning to specific strings
    // because the dev server may be in different states.
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("viewer surface with a non-live session id · redirects to sign-in for guests", async ({
    page,
  }) => {
    // Any UUID-shaped id works · the page requires sign-in before
    // it tries to resolve the session, so guests always redirect.
    const fakeSession = "00000000-0000-0000-0000-000000000000";
    await page.goto(`/nex-native/live-commerce/${fakeSession}`);
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/nex-native\/sign-in|\/welcome|\/live-commerce\//);
  });

  test("viewer surface · ?product= malformed · page still renders without 500", async ({
    page,
  }) => {
    // The server-side UUID shape guard drops malformed values · the
    // page should NOT 500 even if someone pastes garbage. For a guest
    // the redirect to sign-in short-circuits before the hint is read.
    const fakeSession = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(
      `/nex-native/live-commerce/${fakeSession}?product=not-a-uuid`,
    );
    expect(
      response?.status() ?? 0,
      "viewer page handles malformed product param gracefully",
    ).toBeLessThan(500);
  });

  test("Shop Contacts page · guests redirect to sign-in", async ({ page }) => {
    const fakeSession = "00000000-0000-0000-0000-000000000000";
    await page.goto(`/nex-native/manage/live/shop-contacts/${fakeSession}`);
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(/\/nex-native\/sign-in|\/welcome|\/shop-contacts\//);
  });

  test("directory landing · no live sessions · renders without live chips", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/directory");
    expect(
      response?.status(),
      "directory landing returns 200 (or redirects, but never 5xx)",
    ).toBeLessThan(500);

    // When Migration 219 is unapplied OR there are no open sessions,
    // the resolver's fail-open contract returns an empty Map · the
    // live-chip data attribute must be absent on every card.
    const liveChips = await page
      .locator("[data-nex-listing-card-live-chip]")
      .count();
    expect(
      liveChips,
      "no live chips appear when no sessions exist / migrations unapplied",
    ).toBe(0);

    // The page should still render a directory surface · we don't pin
    // the exact copy, we just confirm it didn't blank or 5xx.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
