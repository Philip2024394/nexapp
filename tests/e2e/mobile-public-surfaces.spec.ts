// tests/e2e/mobile-public-surfaces.spec.ts
//
// B2 · mobile E2E · phase one · 2026-10-14.
//
// Verifies the parts of the first-user journey that do NOT require an
// authenticated NEX session. Every test runs at the Pixel 7
// viewport (390x844) against the live dev server at
// http://localhost:3008.
//
// Scope of this spec:
//   · the three unauthenticated public funnels: /welcome, /sign-in,
//     /create-account
//   · the three first-visit routes correctly redirect unauth viewers
//     to /welcome (sealed gate · built in the free-chat-theme pass)
//   · no horizontal overflow on any route at 390-px width (mobile
//     tap-target hygiene)
//   · basic HTTP contract (200 for public pages, final URL after
//     redirect for the gated routes)
//
// Out of scope · explicitly auth-gated and not provable here:
//   · signed-in home with the first-visit invitation visible
//   · tapping the invitation and landing on /chat/first-visit
//     authenticated
//   · the three destination cards' authenticated behaviour
//   · sending a first message / peer-chat round trip
//   · theme selection + persistence
//
// Those auth-gated flows require either a provisioned test account
// (Supabase credentials in a test-only env) OR a sealed test-auth
// helper. Both are owner-authorised follow-ups. See the companion
// review report §Section 4.

import { expect, test } from "@playwright/test";

test.describe("NEX mobile · unauthenticated journey · Pixel 7 (412×915)", () => {
  // ─── Guest landing · /nex-native/welcome ─────────────────────

  test("welcome page renders at phone viewport without horizontal overflow", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/welcome");
    expect(response?.status(), "welcome page returns 200").toBe(200);

    // The welcome page is NEX brand-anchor. The NEX wordmark must
    // appear somewhere.
    await expect(page.locator("body")).toContainText(/NEX/i);

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scroll,
      `no horizontal overflow at phone width · scroll=${overflow.scroll} vs client=${overflow.client}`,
    ).toBeLessThanOrEqual(overflow.client);
  });

  test("welcome page offers both 'Create free account' and 'Sign in' affordances", async ({
    page,
  }) => {
    await page.goto("/nex-native/welcome");
    // The sealed welcome copy (per src/app/nex-native/welcome/page.tsx)
    // declares Primary and secondary CTAs. We assert the destinations
    // are reachable from this surface.
    const createAccountLink = page.locator('a[href*="/nex-native/create-account"]').first();
    const signInLink = page.locator('a[href*="/nex-native/sign-in"]').first();
    await expect(createAccountLink).toBeVisible();
    await expect(signInLink).toBeVisible();
  });

  // ─── /sign-in · public entry ─────────────────────────────────

  test("sign-in page loads at phone viewport without horizontal overflow", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/sign-in");
    expect(response?.status(), "sign-in page returns 200").toBe(200);
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
  });

  // ─── /create-account · public entry ───────────────────────────

  test("create-account page loads at phone viewport without horizontal overflow", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/create-account");
    expect(response?.status(), "create-account page returns 200").toBe(200);
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
  });

  // ─── First-visit guard · unauth viewers must redirect to /welcome ───
  // Confirms the sealed `resolveNexAppSessionOrGuest()` branch at the
  // top of each of the three new first-visit pages. Unauth → /welcome.

  test("/nex-native/chat/first-visit redirects unauth viewer to /welcome", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/chat/first-visit", {
      waitUntil: "networkidle",
    });
    expect(response?.status(), "redirect chain ends with 200").toBe(200);
    await expect(page).toHaveURL(/\/nex-native\/welcome\b/);
  });

  test("/nex-native/chat/first-visit/shop redirects unauth viewer to /welcome", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/chat/first-visit/shop", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/nex-native\/welcome\b/);
  });

  test("/nex-native/chat/first-visit/personalize redirects unauth viewer to /welcome", async ({
    page,
  }) => {
    const response = await page.goto(
      "/nex-native/chat/first-visit/personalize",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/nex-native\/welcome\b/);
  });

  // ─── Visual sanity · phone-tile tap targets ─────────────────
  // Confirms the welcome page's primary CTAs are tappable at phone
  // width (≥44 px tap target per Apple HIG) · doesn't dictate exact
  // size, just that nothing is sub-24-px micro-clickable.

  test("welcome primary CTA has a reasonable mobile tap target", async ({
    page,
  }) => {
    await page.goto("/nex-native/welcome");
    const createAccount = page
      .locator('a[href*="/nex-native/create-account"]')
      .first();
    await expect(createAccount).toBeVisible();
    const box = await createAccount.boundingBox();
    expect(box, "create-account CTA has a bounding box").not.toBeNull();
    // 24-px floor · we don't police a specific NEX tap-target spec here,
    // just that the element isn't a sub-24 pixel accidental hitbox.
    expect((box?.height ?? 0), "CTA height ≥ 24 px").toBeGreaterThanOrEqual(24);
    expect((box?.width ?? 0), "CTA width ≥ 24 px").toBeGreaterThanOrEqual(24);
  });
});

// ─── Explicit auth-journey gap · xfail marker ─────────────────────
//
// The brief's primary target was "first-user journey": land on home,
// see the invitation, tap through to /chat/first-visit, pick a theme,
// send a first message. All of that requires an authenticated NEX
// session. This spec file INTENTIONALLY does not attempt to drive the
// signed-in flow because:
//
//   1. No provisioned test account is available to this task · the
//      repo guard forbids reading .env.local for Supabase credentials.
//   2. No test-only auth bypass exists · the sealed `NEX_ALLOW_DEV_
//      ADMIN` flag is explicitly "must remain unset in production"
//      and is not wired to a public sign-in short-circuit.
//
// A follow-up B2 pass can add that journey once one of the following
// is sealed by the owner:
//
//   (a) A dedicated test account in Supabase with its credentials
//       delivered via `tests/e2e/.env.test` (gitignored).
//   (b) A test-only server action that mints a cookie-authenticated
//       session for a seeded test account, gated behind a sealed
//       `NEX_TEST_AUTH_ENABLED` flag and refused in production.
//
// See the companion review report §Section 4 for the full gap table.
