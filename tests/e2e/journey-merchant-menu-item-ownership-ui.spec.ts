// tests/e2e/journey-merchant-menu-item-ownership-ui.spec.ts
//
// L-037 · merchant /manage/menu/[itemId] edit-page OWNERSHIP-GATE
// journey · authored 2026-11-26 under Strict Complete-App Delivery
// Directive 2026-11-26 §4 (inspect adjacent Shop journeys · do not
// assume completed merchant journeys prove every Shop feature).
//
// Why this spec exists
// --------------------
// The L-035 pattern-hunt discovered that NEX merchant surfaces use
// THREE DISTINCT ownership-gate patterns · each carrying a different
// UX contract that needs its own browser-observable regression:
//
//   · /manage/orders/[orderId]      → notFound()  (404, don't reveal
//                                     existence) — covered by T-8.
//   · /manage/products/[productId]  → redirect('/manage?e=spec_forbidden
//                                     &m=...')  (explicit error banner)
//                                     — covered by L-035.
//   · /manage/menu/[itemId]          → redirect('/manage/menu')  (SILENT
//                                     — no `?e=` banner) — THIS SPEC.
//
// The silent redirect at `src/app/nex-native/manage/menu/[itemId]/
// page.tsx:74-76` is the odd one out: a non-owner is bounced to the
// list page with no explanation. This may be an intentional "don't
// hint at existence" choice for menu items (dish names can be
// commercially sensitive), OR it may be a UX inconsistency that
// should surface a banner the way products do. Either way, the
// contract is currently SILENT-REDIRECT and a silent regression to
// either `notFound()` (would be fine) or a fully-open page (would be
// a serious ownership breach) must be caught.
//
// What this spec covers (all browser-observable)
// -----------------------------------------------
//   A · Signed-in owner lands on /manage/menu/{itemId} for their own
//       dish · URL stays on the edit page · dish name h1 renders.
//   B · Signed-in non-owner second merchant visiting the SAME URL
//       is server-side redirected to `/nex-native/manage/menu` with
//       NO `?e=` or `?m=` query param · the dish name does NOT
//       render anywhere on the resulting page.
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · Full dish-edit form submission · the 15-field edit surface is
//     sibling-scope (follows the L-034/L-031 pattern of "ownership
//     gate first, full-form driving separately").
//   · Menu-section assignment · uses `_actions.ts` paths.
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · Fixture teardown is a QUALITY GATE (per strict-completion
//     standard §1) · residual rows = no clean PASS. Teardown deletes
//     the nex_menu_item rows before calling teardownAll (otherwise
//     the harness nex_business delete would fail FK).
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount
// of `/manage/menu/[itemId]` + REAL server-side ownership redirect
// against sandbox Supabase via fixture harness.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
} from "./_fixtures/sandbox-test-harness";

/**
 * Inline menu-item seed · the shared harness has no `createTestMenuItem`
 * helper yet (menu items are the first vertical-specific primitive this
 * spec touches). Required columns per mig 066: business_id (FK),
 * name (1..120 chars), price_pence (>=0). status defaults to 'live'.
 * Returns the menu-item id so the spec can delete it in teardown.
 */
async function createMenuItem(
  businessId: string,
  label: string,
): Promise<{ id: string; name: string }> {
  const sb = supabaseAdmin();
  const name = `e2e-fixture-${label}-${Date.now()}`;
  const { data, error } = await sb
    .from("nex_menu_item")
    .insert({
      business_id: businessId,
      name,
      price_pence: 4500, // 45_000 IDR
      currency: "IDR",
    })
    .select("id, name")
    .single();
  if (error || !data) {
    throw new Error(
      `createMenuItem: insert nex_menu_item failed · ${error?.message ?? "no row returned"}`,
    );
  }
  return data as { id: string; name: string };
}

async function deleteMenuItemsForBusiness(businessId: string): Promise<void> {
  const sb = supabaseAdmin();
  await sb.from("nex_menu_item").delete().eq("business_id", businessId);
}

async function ownerScopedBusinessSweep(
  accountHandle: TestAccountHandle,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: ownedBusinesses } = await sb
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountHandle.nexAccountId);
  const ownedBizIds = (ownedBusinesses ?? [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);
  if (ownedBizIds.length === 0) return;
  // Menu items first (FK to business), then business row.
  await sb.from("nex_menu_item").delete().in("business_id", ownedBizIds);
  await sb.from("nex_product").delete().in("business_id", ownedBizIds);
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

test.describe.serial(
  "L-037 · merchant menu-item edit · silent-redirect ownership gate",
  () => {
    test("owner lands on dish edit; non-owner silently redirected to /manage/menu with NO ?e= banner", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];
      const merchantAccounts: TestAccountHandle[] = [];

      const context = await browser.newContext({ storageState: undefined });
      const page: Page = await context.newPage();

      try {
        // ─────────────────────────────────────────────────────────
        // 1 · Seed owner + business + menu item.
        // ─────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l037-menu-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const biz = await createTestBusiness(merchant, {
          label: "l037-menu-shop",
        });
        handles.push(biz);
        const item = await createMenuItem(biz.businessId, "dish");

        const editUrl = `/nex-native/manage/menu/${item.id}`;

        // ─────────────────────────────────────────────────────────
        // 2 · Owner sign-in + positive-path mount.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);
        const resp = await page.goto(editUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `Contract A · menu-edit page responds for owner · url=${editUrl}`,
        ).toBeLessThan(500);

        // Contract A · URL stays on the edit page (no silent bounce).
        await expect
          .poll(() => new URL(page.url()).pathname, {
            message:
              "Contract A · owner must remain on /manage/menu/[itemId] · no silent redirect",
            timeout: 10_000,
          })
          .toMatch(new RegExp(`^/nex-native/manage/menu/${item.id}$`));

        // Contract A · dish name renders somewhere on the page (the
        // page uses a stable `defaultValue={item.name}` on the name
        // input per the edit form — the name text must be present).
        await expect(
          page.getByText(item.name, { exact: false }).first(),
          "Contract A · owner must see the dish name in the edit form",
        ).toBeVisible({ timeout: 15_000 });

        // ─────────────────────────────────────────────────────────
        // 3 · Non-owner silent-redirect gate.
        // ─────────────────────────────────────────────────────────
        const merchant2 = await createTestAccount({
          label: "l037-menu-merchant2",
          returnPassword: true,
        });
        handles.push(merchant2);
        merchantAccounts.push(merchant2);
        const biz2 = await createTestBusiness(merchant2, {
          label: "l037-menu-shop2",
        });
        handles.push(biz2);

        const context2 = await browser.newContext({ storageState: undefined });
        const page2: Page = await context2.newPage();
        try {
          await signInAsFixtureInBrowser(page2, merchant2);
          await page2.goto(editUrl, { waitUntil: "domcontentloaded" });
          // Server-side `redirect("/nex-native/manage/menu")` emits the
          // RSC NEXT_REDIRECT marker + client-router navigation (same
          // Next 16 pattern as L-035).
          await page2.waitForURL(
            (u) =>
              /\/nex-native\/manage\/menu(?:[/?#]|$)/.test(u.pathname) &&
              !/manage\/menu\//.test(u.pathname), // not on the edit sub-route
            { timeout: 15_000 },
          );

          // Contract B · redirect lands on /manage/menu with NO error
          // querystring (the sealed asymmetry with products).
          const landedUrl = new URL(page2.url());
          expect(
            landedUrl.pathname,
            "Contract B · non-owner must land on /nex-native/manage/menu (list)",
          ).toBe("/nex-native/manage/menu");
          expect(
            landedUrl.searchParams.get("e"),
            "Contract B · menu redirect must carry NO ?e= banner (sealed asymmetry with products · if this ever starts carrying `spec_forbidden` it means the pattern has silently harmonised and the UX decision needs revisiting)",
          ).toBeNull();
          expect(
            landedUrl.searchParams.get("m"),
            "Contract B · menu redirect must carry NO ?m= message",
          ).toBeNull();

          // Contract B · the owner's dish name must NOT render on the
          // resulting /manage/menu list page (defence in depth · the
          // list page only shows the viewer's own business's menu).
          await expect(
            page2.getByText(item.name, { exact: false }),
            "Contract B · non-owner must NOT see owner's dish name after redirect",
          ).toHaveCount(0);
        } finally {
          await page2.close().catch(() => undefined);
          await context2.close().catch(() => undefined);
        }

        // Clean the owner's menu items before teardownAll (otherwise
        // nex_business delete would cascade fine via ON DELETE CASCADE
        // from mig 066:51 · belt-and-braces explicit sweep still safer).
        await deleteMenuItemsForBusiness(biz.businessId);
      } finally {
        try {
          for (const m of merchantAccounts) {
            await ownerScopedBusinessSweep(m);
          }
        } catch (sweepErr) {
          // eslint-disable-next-line no-console
          console.warn(
            `[L-037 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
          );
        }

        await teardownAll(handles);
        const residual = await assertNoResidualFixtures(handles).catch(
          () => null,
        );
        if (residual) {
          const total =
            residual.orders.length +
            residual.products.length +
            residual.businesses.length +
            residual.accounts.length;
          expect(
            total,
            `L-037 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
