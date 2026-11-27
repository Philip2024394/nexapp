// tests/e2e/regression-mock-merchants-shop-urls.spec.ts
//
// Cycle-8 (2026-11-27) regression spec.
//
// Owner directive 2026-11-27:
//   "continue to fix the remaining blockers and confirm each shop link
//    for 99901 - 99902 - 99903 fully flow accounts"
//
// Scope
// -----
// Three mock-persona merchant accounts already exist in sandbox
// (kdstoyyeygcopkogqsyv) with deterministic UUIDs:
//
//   nex-99901 → 11111111-1111-4111-8111-111111111111 (Hammerex Products)
//   nex-99902 → 11111111-1111-4111-8111-111111111112 (Aoife Byrne)
//   nex-99903 → 11111111-1111-4111-8111-111111111113 (Rosa)
//
// They own businesses whose CURRENT sandbox slugs are:
//
//   nex-99901 → "Irish Pride Shop" / slug=irish-pride-shop
//   nex-99902 → "X-Rated Tool Belts" / slug=x-rated-tool-belts   (seeded 2026-11-27)
//   nex-99903 → "Handbags direct" / slug=handbags-direct
//
// NOTE · the shop display names here are what is in sandbox today.
// The owner's reference set in the cycle-7 brief ("Hammerex Products /
// X-Rated Tool Belts / Rosa") matches 99902 only · the 99901 and 99903
// shops carry pre-existing display_name values from earlier sandbox
// seeding. This spec asserts the SHOP LINK FLOW (route resolves, anon
// can view, not-found UI does NOT show up in the final DOM). Renaming
// the two legacy sandbox shops requires owner direction and is flagged
// in the cycle-8 Rule-9 report.
//
// What this proves
// ---------------
// For each of the three shops · in a GUEST browser context with no
// session cookies · navigating to `/nex-native/<slug>`:
//
//   (A) HTTP status < 500
//   (B) [data-nex-native-not-found] marker is absent in the final DOM
//       (after Next.js streaming swaps complete)
//   (C) body text contains >20 characters (empty-shell guard)
//   (D) a shop-chrome marker is present (chat FAB or shop burger menu)
//
// Classification: REGRESSION SPEC · read-only against sandbox. No
// seeding is performed inside the spec itself · the seed step is
// a separate scripts/_tmp/cycle8-seed-...mjs executed out-of-band.

import { expect, test } from "@playwright/test";

const SHOPS = [
  { handle: "nex-99901", slug: "irish-pride-shop", expectedDisplayName: "Irish Pride Shop" },
  { handle: "nex-99902", slug: "x-rated-tool-belts", expectedDisplayName: "X-Rated Tool Belts" },
  { handle: "nex-99903", slug: "handbags-direct", expectedDisplayName: "Handbags direct" },
] as const;

test.describe.serial(
  "Cycle-8 · shop-link flow for 99901 / 99902 / 99903 (anon visitor)",
  () => {
    for (const shop of SHOPS) {
      test(`${shop.handle} · GET /nex-native/${shop.slug} renders a shop (not the not-found UI)`, async ({
        browser,
      }) => {
        test.setTimeout(45_000);
        const guestContext = await browser.newContext({
          storageState: undefined,
        });
        const guestPage = await guestContext.newPage();
        try {
          const resp = await guestPage.goto(`/nex-native/${shop.slug}`, {
            waitUntil: "domcontentloaded",
            timeout: 20_000,
          });
          const status = resp?.status() ?? 0;
          expect(
            status,
            `${shop.handle} · /nex-native/${shop.slug} must respond < 500 to anon · got=${status}`,
          ).toBeLessThan(500);

          // Let Next.js streaming complete so the not-found shell swap
          // settles before we inspect the DOM.
          await guestPage
            .waitForLoadState("networkidle", { timeout: 15_000 })
            .catch(() => undefined);

          // (B) · not-found marker must be absent in final DOM
          await expect(
            guestPage.locator("[data-nex-native-not-found]"),
            `${shop.handle} · ${shop.slug} must NOT render the branded not-found UI`,
          ).toHaveCount(0);

          // (C) · body non-empty (empty-shell guard)
          const bodyText = (await guestPage.locator("body").innerText()).trim();
          expect(
            bodyText.length,
            `${shop.handle} · body text must be non-empty · got length=${bodyText.length}`,
          ).toBeGreaterThan(20);

          // (D) · shop chrome marker present · chat FAB OR burger menu
          const chatFab = guestPage.locator('[data-nex-shop-chat-fab="true"]');
          const burger = guestPage.locator('[data-nex-shop-burger="true"]');
          const shopChromeCount =
            (await chatFab.count()) + (await burger.count());
          expect(
            shopChromeCount,
            `${shop.handle} · at least one shop-chrome marker (chat FAB or burger) must be present`,
          ).toBeGreaterThan(0);
        } finally {
          await guestPage.close().catch(() => undefined);
          await guestContext.close().catch(() => undefined);
        }
      });
    }
  },
);
