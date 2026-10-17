// tests/e2e/bio-link-mobile.spec.ts
//
// Gate 2 · Mobile acceptance for /nex-native/bio/{nex_handle}.
// -------------------------------------------------------------------
// Scope boundary explicitly honoured:
//   · Read-only against live Supabase. Zero DB writes performed by
//     this spec. No account creation. No is_discoverable toggles.
//     No chosen_handle writes.
//   · Owner-preview scenarios are OUT OF SCOPE in this run because
//     no storageState file exists at tests/e2e/.auth/state.json ·
//     an interactive sign-in by the owner is required to populate it.
//   · Public-rendering of a discoverable account is OUT OF SCOPE in
//     this run because the live Supabase project
//     (ijvqdvsvwtwxzcqmoqit) currently has ZERO rows with
//     nex_account_profile.is_discoverable = true. Verified by
//     read-only query 2026-10-17.
//
// Scenarios actually exercised in this spec:
//   M1 · Malformed handle → 404 at 360×800
//   M2 · Malformed handle → 404 at 390×844
//   M3 · Non-existent handle → 404 at 360×800
//   M4 · Non-existent handle → 404 at 390×844
//   M5 · Non-discoverable existing handle + anon viewer → 404 at 360×800
//   M6 · Non-discoverable existing handle + anon viewer → 404 at 390×844
//
// Scenarios NOT exercised (reported BLOCKED in the acceptance matrix):
//   · Public rendering of a discoverable profile (no discoverable rows)
//   · Owner preview (no storageState)
//   · Avatar / headline / bio / businesses rendering (no discoverable rows)
//   · Chat CTA deep-link follow-through (no auth)
//   · Chosen-name display label (migration 204 unapplied + no writes)
//
// The non-discoverable handle used for M5/M6 is obtained via a
// read-only env check at test setup time (NEX_BIO_404_HANDLE). If
// unset, M5 and M6 are skipped and reported as blocked. The handle
// is a public identity by sealed doctrine (migration 013) and does
// not reveal PII.

import { test, expect } from "@playwright/test";

const VIEWPORT_360 = { width: 360, height: 800 };
const VIEWPORT_390 = { width: 390, height: 844 };

const NON_DISCOVERABLE_HANDLE = process.env.NEX_BIO_404_HANDLE ?? "";

test.describe("Bio-link · malformed handle → 404", () => {
  for (const [name, viewport] of [
    ["360×800", VIEWPORT_360] as const,
    ["390×844", VIEWPORT_390] as const,
  ]) {
    test(`malformed handle "foo" returns 404 at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const resp = await page.goto("/nex-native/bio/foo", {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status()).toBe(404);
    });
  }
});

test.describe("Bio-link · non-existent handle → 404", () => {
  for (const [name, viewport] of [
    ["360×800", VIEWPORT_360] as const,
    ["390×844", VIEWPORT_390] as const,
  ]) {
    test(`non-existent handle "nex-99999999" returns 404 at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const resp = await page.goto("/nex-native/bio/nex-99999999", {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status()).toBe(404);
    });
  }
});

test.describe("Bio-link · non-discoverable handle + anon → 404", () => {
  test.skip(
    !NON_DISCOVERABLE_HANDLE,
    "NEX_BIO_404_HANDLE env not set · scenario BLOCKED",
  );
  for (const [name, viewport] of [
    ["360×800", VIEWPORT_360] as const,
    ["390×844", VIEWPORT_390] as const,
  ]) {
    test(`non-discoverable handle returns 404 to anon viewer at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const resp = await page.goto(
        `/nex-native/bio/${NON_DISCOVERABLE_HANDLE}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(resp?.status()).toBe(404);
    });
  }
});
