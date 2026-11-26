// tests/e2e/journey-merchant-accommodation-room-ownership-ui.spec.ts
//
// L-038 · merchant /manage/accommodation/[roomId] edit-page OWNERSHIP-GATE
// journey · authored 2026-11-26 under Strict Complete-App Delivery
// Directive 2026-11-26 §4 (inspect adjacent Shop journeys · do not
// assume completed merchant journeys prove every Shop feature).
//
// Why this spec exists
// --------------------
// The L-035 / L-037 pattern-hunt catalogued three distinct ownership
// patterns on /manage/* detail pages. Completing the audit of the
// merchant-facing vertical editors surfaces a FOURTH, distinct
// ownership pattern at `src/app/nex-native/manage/accommodation/
// [roomId]/page.tsx:37-55`:
//
//   const owned = await businessService.listBusinessesByOwner(
//     session.account.id,
//   );
//   if (owned.length === 0) notFound();     // ← pre-check A
//   const business = owned[0]!;
//   const room = await accommodationService.getRoomById(roomId);
//   if (!room) notFound();                   // ← pre-check B
//   if (room.business_id !== business.id) {
//     notFound();                            // ← fail-closed
//   }
//
// This differs from all three previously-pinned patterns:
//   · /manage/orders/[orderId]      → notFound() on a single owner
//                                     equality check (T-8).
//   · /manage/products/[productId]  → redirect('/manage?e=spec_forbidden
//                                     &m=...')  (explicit banner) (L-035).
//   · /manage/menu/[itemId]         → redirect('/manage/menu') SILENTLY
//                                     (no `?e=` banner) (L-037).
//   · /manage/accommodation/[roomId] → notFound() with TWO pre-checks:
//                                      (A) merchant has ANY owned
//                                      business, and (B) room belongs
//                                      to merchant's first business.
//                                      THIS SPEC.
//
// The two-pre-check pattern is defence-in-depth: a shop-less account
// is 404'd before the service even looks up the room, so an attacker
// cannot probe room existence from an account with no shop. This is
// a stricter posture than orders (which returns the same 404 only
// once the row is known not to belong) and must be preserved.
//
// What this spec covers (all browser-observable)
// -----------------------------------------------
//   A · Signed-in owner (merchant with a business owning the room)
//       lands on /manage/accommodation/{roomId} · URL stays on the
//       edit page · room name h1 renders.
//   B · Signed-in second merchant with THEIR OWN DIFFERENT business
//       visiting the first merchant's room URL sees the sealed NEX
//       not-found UI (`[data-nex-native-not-found]`) · the owner's
//       room name does NOT render.
//   C · Signed-in merchant with ZERO owned businesses visiting ANY
//       room URL sees the NEX not-found UI · defence-in-depth: the
//       pre-check at page.tsx:46 fires BEFORE the service lookup,
//       so even a probe for an existing room must still 404.
//
// Why NOT a `resp.status() === 404` assertion
// -------------------------------------------
// Next.js 16 server components with `export const dynamic =
// "force-dynamic"` stream the response via RSC. When `notFound()`
// throws mid-stream, the HTTP envelope can already be committed with
// status 200 while the body carries the segment's `not-found.tsx`.
// Playwright's `response.status()` observes the HTTP envelope and
// may report 200 even though the user sees the 404 UI. The REAL
// browser-observable contract is the DOM content — so this spec
// pins the sealed `data-nex-native-not-found` root and the absence
// of the owner's room name, which cannot be satisfied by a leak.
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · Full 15-field room-edit form submission · the updateRoomAction
//     at ../_actions.ts has its own sealed assertOwner path, deferred
//     to a separate journey spec.
//   · Image upload / amenity picker / price/night / availability
//     toggles · these are sub-form drivers scoped out of the
//     ownership gate.
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · Fixture teardown is a QUALITY GATE (per strict-completion
//     standard §1) · residual rows = no clean PASS. Teardown deletes
//     the nex_accommodation_unit rows explicitly before calling
//     teardownAll · mig 213 declares ON DELETE CASCADE from business,
//     so the business delete would cascade, but explicit sweep is
//     belt-and-braces protection against partial failures.
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount
// of `/manage/accommodation/[roomId]` + REAL server-side ownership
// `notFound()` gate against sandbox Supabase via fixture harness.

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
 * Inline accommodation-unit seed · the shared harness has no
 * `createTestAccommodationRoom` helper yet (accommodation units are
 * a vertical-specific primitive this spec is the first to touch).
 * Required columns per mig 213: business_id (FK), name (1..120 chars).
 * capacity defaults 2 (1..50), bedrooms/bathrooms default 1 (0..20),
 * currency defaults IDR, status defaults 'draft'. Returns the room
 * id so the spec can delete it in teardown.
 */
async function createRoom(
  businessId: string,
  label: string,
): Promise<{ id: string; name: string }> {
  const sb = supabaseAdmin();
  const name = `e2e-fixture-${label}-${Date.now()}`;
  const { data, error } = await sb
    .from("nex_accommodation_unit")
    .insert({
      business_id: businessId,
      name,
    })
    .select("id, name")
    .single();
  if (error || !data) {
    throw new Error(
      `createRoom: insert nex_accommodation_unit failed · ${error?.message ?? "no row returned"}`,
    );
  }
  return data as { id: string; name: string };
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
  // Accommodation units FIRST (FK to business), then menu/products
  // (defence in depth · they may have been created by sibling specs
  // that share account labels), then business row.
  await sb
    .from("nex_accommodation_unit")
    .delete()
    .in("business_id", ownedBizIds);
  await sb.from("nex_menu_item").delete().in("business_id", ownedBizIds);
  await sb.from("nex_product").delete().in("business_id", ownedBizIds);
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

test.describe.serial(
  "L-038 · merchant accommodation-room edit · notFound ownership gate with two pre-checks",
  () => {
    test("owner lands on room edit; non-owner gets 404; shop-less merchant gets 404", async ({
      browser,
    }) => {
      test.setTimeout(240_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];
      const merchantAccounts: TestAccountHandle[] = [];

      const context = await browser.newContext({ storageState: undefined });
      const page: Page = await context.newPage();

      try {
        // ─────────────────────────────────────────────────────────
        // 1 · Seed owner + business + room.
        // ─────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l038-acc-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const biz = await createTestBusiness(merchant, {
          label: "l038-acc-shop",
        });
        handles.push(biz);
        const room = await createRoom(biz.businessId, "room");

        const editUrl = `/nex-native/manage/accommodation/${room.id}`;

        // ─────────────────────────────────────────────────────────
        // 2 · Owner sign-in + positive-path mount.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);
        const resp = await page.goto(editUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `Contract A · accommodation-edit page responds for owner · url=${editUrl} · got=${resp?.status()}`,
        ).toBeLessThan(400);

        // Contract A · URL stays on the edit page (no silent bounce).
        await expect
          .poll(() => new URL(page.url()).pathname, {
            message:
              "Contract A · owner must remain on /manage/accommodation/[roomId]",
            timeout: 10_000,
          })
          .toMatch(
            new RegExp(`^/nex-native/manage/accommodation/${room.id}$`),
          );

        // Contract A · room name renders somewhere on the page (the
        // page uses `{room.name}` in the h1 at page.tsx:98-107 and
        // also on the form name input at page.tsx:170 as a stable
        // `defaultValue={room.name}` · either anchor is acceptable).
        await expect(
          page.getByText(room.name, { exact: false }).first(),
          "Contract A · owner must see the room name in the edit form/heading",
        ).toBeVisible({ timeout: 15_000 });

        // ─────────────────────────────────────────────────────────
        // 3 · Non-owner 404 gate (Contract B) · second merchant with
        //     their OWN DIFFERENT business visits first merchant's
        //     room URL. Expected: notFound() → HTTP 404.
        // ─────────────────────────────────────────────────────────
        const merchant2 = await createTestAccount({
          label: "l038-acc-merchant2",
          returnPassword: true,
        });
        handles.push(merchant2);
        merchantAccounts.push(merchant2);
        const biz2 = await createTestBusiness(merchant2, {
          label: "l038-acc-shop2",
        });
        handles.push(biz2);

        const context2 = await browser.newContext({ storageState: undefined });
        const page2: Page = await context2.newPage();
        try {
          await signInAsFixtureInBrowser(page2, merchant2);
          await page2.goto(editUrl, {
            waitUntil: "domcontentloaded",
          });

          // Contract B · the sealed NEX not-found UI must render
          // (anchor on the stable `data-nex-native-not-found` root
          // set by src/app/nex-native/not-found.tsx:63). This is the
          // only robust browser-observable signal under Next 16 RSC
          // streaming (see header note on why HTTP status isn't used).
          await expect(
            page2.locator("[data-nex-native-not-found]"),
            "Contract B · non-owner must see the NEX not-found UI",
          ).toBeVisible({ timeout: 15_000 });

          // Contract B · defence in depth · owner's room name must
          // NOT appear anywhere on the 404 page body (guards against
          // a regression where Next renders the owner's room shell
          // before triggering notFound).
          await expect(
            page2.getByText(room.name, { exact: false }),
            "Contract B · non-owner must NOT see owner's room name in the 404 body",
          ).toHaveCount(0);
        } finally {
          await page2.close().catch(() => undefined);
          await context2.close().catch(() => undefined);
        }

        // ─────────────────────────────────────────────────────────
        // 4 · Shop-less merchant 404 gate (Contract C) · third
        //     merchant with ZERO owned businesses visits same room
        //     URL. Expected: notFound() triggered by the FIRST
        //     pre-check at page.tsx:46 (owned.length === 0), BEFORE
        //     the service even looks up the room.
        // ─────────────────────────────────────────────────────────
        const merchant3 = await createTestAccount({
          label: "l038-acc-merchant3-shopless",
          returnPassword: true,
        });
        handles.push(merchant3);
        merchantAccounts.push(merchant3);
        // Deliberately NO createTestBusiness for merchant3 ·
        // this is the shop-less contract under test.

        const context3 = await browser.newContext({ storageState: undefined });
        const page3: Page = await context3.newPage();
        try {
          await signInAsFixtureInBrowser(page3, merchant3);
          await page3.goto(editUrl, {
            waitUntil: "domcontentloaded",
          });

          // Contract C · the sealed NEX not-found UI must render ·
          // same anchor as Contract B. The crucial difference: this
          // path is served by the `owned.length === 0` pre-check at
          // page.tsx:46 — the room lookup NEVER runs. A regression
          // that removed the pre-check would still pass Contract B
          // (because the room-owner equality would still fire) but
          // would newly expose EXISTENCE of the room to a shop-less
          // probe, which is what Contract C pins against.
          await expect(
            page3.locator("[data-nex-native-not-found]"),
            "Contract C · shop-less merchant must see the NEX not-found UI",
          ).toBeVisible({ timeout: 15_000 });

          // Contract C · defence in depth · owner's room name must
          // NOT leak onto the 404 page body.
          await expect(
            page3.getByText(room.name, { exact: false }),
            "Contract C · shop-less merchant must NOT see owner's room name",
          ).toHaveCount(0);
        } finally {
          await page3.close().catch(() => undefined);
          await context3.close().catch(() => undefined);
        }
      } finally {
        try {
          for (const m of merchantAccounts) {
            await ownerScopedBusinessSweep(m);
          }
        } catch (sweepErr) {
          // eslint-disable-next-line no-console
          console.warn(
            `[L-038 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
            `L-038 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
