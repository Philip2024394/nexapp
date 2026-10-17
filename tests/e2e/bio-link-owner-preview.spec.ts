// tests/e2e/bio-link-owner-preview.spec.ts
//
// Gate 2c · Owner-preview mobile tests for /nex-native/bio/{nex_handle}.
// -------------------------------------------------------------------
// Prerequisite: tests/e2e/.auth/state.json must exist · captured via
// the sealed `playwright codegen` command documented in
// docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md
// §3. The owner performs that one-time sign-in; this spec consumes
// the resulting cookies via the sibling config's `storageState`.
//
// Scope boundary (Gate 2c authorisation):
//   · READ-ONLY against live production Supabase · zero DB writes.
//   · Only the dedicated Dev Admin account is used.
//   · No profile / theme / discoverability / business edits.
//   · No migration apply · no deployment · no commit / push.
//   · Playwright never prints or forwards the storage-state file.
//     The browser context handles it inside the subprocess.
//
// Scenarios A1-A7 from Gate 2b report:
//   A1 · signed-in dev-admin visits own bio-link at 360×800 → renders
//   A2 · signed-in dev-admin visits own bio-link at 390×844 → renders
//   A3 · owner-preview includes business card with ?commerce=1
//   A4 · owner-preview omits business card without commerce flag
//        (confirmed .env.local does NOT set NEX_COMMERCE_ENABLED)
//   A5 · ?commerce=1 dev bypass renders business card
//   A6 · "Preview only" badge appears when is_discoverable=false
//        (dev-admin has no nex_account_profile row · effectively
//        is_discoverable=false)
//   A7 · signed-in dev-admin visits a DIFFERENT (non-discoverable)
//        handle → 404 · owner-of-X cannot preview Y's profile
//
// What this spec will NOT do:
//   · Will not navigate deep-links (chat/peer, chat/guest, /u/, /{slug})
//     to prevent any session-side side-effects at destinations.
//   · Will not click the chat CTA.
//   · Will not fill in any form.
//   · Will not take a screenshot of the entire page (only reports
//     on explicit test-ID selectors to avoid persisting profile
//     content to disk).

import { test, expect, type Page } from "@playwright/test";

// Env-driven · pick the handle the saved Playwright session actually
// signed in as. Default is Dev Admin, but any owner's handle works.
// NEX_BIO_EXPECTED_BIZ_COUNT and NEX_BIO_EXPECTED_FIRST_SLUG let the
// business-card assertions in A3/A5 adapt to whichever account signed
// in; omit them to skip those exact-count checks.
const OWNER_HANDLE = process.env.NEX_BIO_OWNER_HANDLE ?? "nex-10375";
const EXPECTED_BIZ_COUNT = process.env.NEX_BIO_EXPECTED_BIZ_COUNT
  ? Number(process.env.NEX_BIO_EXPECTED_BIZ_COUNT)
  : 1;
const EXPECTED_FIRST_SLUG =
  process.env.NEX_BIO_EXPECTED_FIRST_SLUG ?? "dev-admin-trades";
const NON_DISCOVERABLE_OTHER = process.env.NEX_BIO_404_HANDLE ?? "nex-91280";

const VIEWPORT_360 = { width: 360, height: 800 };
const VIEWPORT_390 = { width: 390, height: 844 };

async function assertSignedIn(page: Page): Promise<void> {
  // Signed-in sanity · if the session cookie is missing/expired, the
  // dev-admin's own-handle bio-link would 404 for a non-owner. We
  // want to fail with a clear message in that case, not pretend the
  // tests were run.
  const resp = await page.goto(`/nex-native/home`, { waitUntil: "domcontentloaded" });
  expect(
    resp?.status(),
    `Signed-in sanity failed · expected /home to render for dev-admin; got ${resp?.status()}. ` +
      `Likely cause: tests/e2e/.auth/state.json missing or expired. ` +
      `Re-run the capture command from docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md §3.`,
  ).toBe(200);
}

test.describe("Gate 2c · owner-preview rendering", () => {
  test.beforeEach(async ({ page }) => {
    await assertSignedIn(page);
  });

  test("A1 · dev-admin own bio-link renders at 360×800", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_360);
    const resp = await page.goto(`/nex-native/bio/${OWNER_HANDLE}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);
    await expect(page.locator("[data-nex-bio-root]")).toBeVisible();
    await expect(page.locator("[data-nex-bio-section='profile']")).toBeVisible();
    await expect(
      page.locator("[data-nex-bio-handle-pill]"),
    ).toHaveText(OWNER_HANDLE.toUpperCase());
  });

  test("A2 · dev-admin own bio-link renders at 390×844", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_390);
    const resp = await page.goto(`/nex-native/bio/${OWNER_HANDLE}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);
    await expect(page.locator("[data-nex-bio-root]")).toBeVisible();
    await expect(
      page.locator("[data-nex-bio-handle-pill]"),
    ).toHaveText(OWNER_HANDLE.toUpperCase());
    // "Open full profile" deep-link present (NOT clicked)
    await expect(
      page.locator("[data-nex-bio-action='full-profile']"),
    ).toHaveAttribute("href", `/nex-native/u/${OWNER_HANDLE}`);
  });

  test("A3 · owner-preview includes business card with ?commerce=1", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_390);
    const resp = await page.goto(
      `/nex-native/bio/${OWNER_HANDLE}?commerce=1`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status()).toBe(200);
    const businessesSection = page.locator(
      "[data-nex-bio-section='businesses']",
    );
    await expect(businessesSection).toBeVisible();
    // Owner's business count + first-slug fed in via env so this spec
    // works for any signed-in NEX account the owner captured.
    const cards = page.locator("[data-nex-bio-business-card]");
    await expect(cards).toHaveCount(EXPECTED_BIZ_COUNT);
    await expect(cards.first()).toHaveAttribute(
      "data-nex-bio-business-slug",
      EXPECTED_FIRST_SLUG,
    );
    await expect(cards.first()).toHaveAttribute(
      "href",
      `/nex-native/${EXPECTED_FIRST_SLUG}`,
    );
  });

  test("A4 · owner-preview OMITS business card without commerce flag", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_390);
    const resp = await page.goto(`/nex-native/bio/${OWNER_HANDLE}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);
    // Businesses section must not render when NEX_COMMERCE_ENABLED is
    // unset AND there is no ?commerce=1 bypass. Verified via
    // read-only env probe before Gate 2c authorisation.
    await expect(
      page.locator("[data-nex-bio-section='businesses']"),
    ).toHaveCount(0);
  });

  test("A5 · ?commerce=1 dev bypass renders business card at 360×800", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_360);
    const resp = await page.goto(
      `/nex-native/bio/${OWNER_HANDLE}?commerce=1`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status()).toBe(200);
    await expect(
      page.locator("[data-nex-bio-section='businesses']"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-bio-business-card]"),
    ).toHaveCount(EXPECTED_BIZ_COUNT);
  });

  test("A6 · owner-preview badge appears when is_discoverable=false", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_390);
    const resp = await page.goto(`/nex-native/bio/${OWNER_HANDLE}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);
    // Dev-admin currently has NO nex_account_profile row (verified
    // read-only during Gate 2b) · effectively is_discoverable=false.
    // The bio-link page shows the preview-only badge in that state.
    await expect(
      page.locator("[data-nex-bio-owner-preview]"),
    ).toBeVisible();
  });

  test("A7 · owner cannot preview a different account's non-discoverable profile", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_390);
    // Dev-admin visits a different account's handle. That account is
    // non-discoverable + migration 200 unapplied → R10 private → 404.
    // Confirms: isSelf gate only bypasses the discoverability check
    // for the viewer's OWN profile, not someone else's.
    const resp = await page.goto(
      `/nex-native/bio/${NON_DISCOVERABLE_OTHER}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status()).toBe(404);
  });
});
