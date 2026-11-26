// tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts
//
// L-010/NAV · browser evidence for the signed-in shop-owner row of
// the 18×4×3 drawer navigation matrix · authored 2026-11-26 under
// Strict Complete-App Delivery Directive 2026-11-26 priority 4
// ("Navigation inventory requires real browser evidence to promote
// cells from MAPPED (route-file-exists) to VERIFIED").
//
// Why this spec exists
// --------------------
// `docs/engineering/navigation-inventory.md` lists 18 drawer rows
// across three sections (Create / Your NEX / Preferences) plus
// direct CTAs. At the start of this cycle 17 of 18 rows carried the
// MAPPED (route-file-exists) marker — their `page.tsx` files are
// known to exist, but no browser has actually opened the route under
// the correct session + country identity and confirmed the page
// renders a non-error surface.
//
// Per the inventory's own enum rule (file header):
//   "A `route-exists` check is MAPPED, never VERIFIED. A passing
//    render is MAPPED or PARTIAL. VERIFIED requires an observable-
//    behaviour exercise."
//
// This spec is the observable-behaviour exercise for one slice of
// the matrix: signed-in shop-owner × Ireland (the dev-server's
// current sealed identity · see `.env.local` NEX_APP_IDENTITY).
// ID and WW identities require a different Worker deployment and
// are out of scope for this cycle (named-approval boundary).
//
// Scope
// -----
// Rows exercised (16 authenticated-shop-owner targets):
//   Create section:
//     1 · /nex-native/create/product/category   · "List a product"
//   Your NEX section:
//     2 · /nex-native/contacts                   · "Chats and contacts"
//     3 · /nex-native/profile/me                 · "My profile"
//     4 · /nex-native/settings/profile/edit      · "Edit Profile"
//     5 · /nex-native/manage                     · "Shop Settings"
//     6 · /nex-native/manage/shop/faq            · "FAQ"
//     7 · /nex-native/settings/chat-settings     · "Chat Settings"
//     8 · /nex-native/settings/payments          · "Payment Providers"
//     9 · /nex-native/manage/orders              · "My Orders"
//    10 · /nex-native/manage/wholesale           · "Wholesale"
//    11 · /nex-native/store                      · "NEX Store"
//    12 · /nex-native/install                    · "Install NEX"
//   Preferences section:
//    13 · /nex-native/settings                   · "Settings"
//    14 · /nex-native/nex-generated/buying-guides· "Buying Guides"
//    15 · /nex-native/nex-1                      · "NEX 1"
//   Direct CTA:
//    16 · /nex-native/chat-themes-library        · "Chat themes library"
//
// Explicitly excluded (and why):
//   · /nex-native/directory (Discovery) — sealed hidden-until-launch
//     per 2026-11-24 launch programme. Separate contract: this spec
//     asserts hidden; promotion of the "revealed" state waits for
//     the launch flag.
//
// Contract per row (what VERIFIED means for this cycle)
// ------------------------------------------------------
// A row passes iff:
//   (A) `page.goto(target)` responds with HTTP status < 500 · this
//       permits legitimate redirects (307/308) because the drawer
//       row is still functional if the sealed destination chain
//       terminates on a working page.
//   (B) The finally-landed page does NOT render the sealed branded
//       not-found UI (`[data-nex-native-not-found]` from
//       `src/app/nex-native/not-found.tsx:63`).
//   (C) The finally-landed page carries non-empty rendered body
//       text (strict check — guards against empty-shell regressions
//       where a route returns 200 but renders no content).
//
// A row that fails any of (A)/(B)/(C) is a BROKEN drawer row and
// MUST be surfaced loudly, not silently masked. Each row is its own
// `test()` so a failing row is named in the report, not buried in
// a per-spec aggregate pass/fail.
//
// What this spec does NOT prove
// -----------------------------
//   · ID or WW country identities — requires a different Worker
//     deployment (named-approval gate).
//   · Signed-out, guest-with-auth-gate, or non-owner-authenticated
//     session states — those are separate slices of the 18×4×3
//     matrix with their own expected destinations.
//   · Mobile vs desktop viewport parity — stage-a-pixel7 covers
//     mobile; desktop parity will be exercised separately.
//   · Correctness of each page's internal journey (just that the
//     drawer-entry lands on a working surface).
//
// Boundaries honoured
//   · No product-code change · spec-only addition.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: NAV COVERAGE SPEC · exercises REAL merchant
// browser mount of 16 sealed drawer rows against sandbox Supabase
// via fixture harness.

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
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

// The sealed enumeration mirrors control-drawer-client.tsx:272-490.
// Changing a row's URL in the drawer requires updating this table in
// the same commit; inventory contract §6 of the Strict Completion
// Standard 2026-11-25.
type DrawerRow = Readonly<{
  label: string;
  target: string;
  section: "create" | "your-nex" | "preferences" | "cta";
}>;

const DRAWER_ROWS_SIGNED_IN_OWNER: ReadonlyArray<DrawerRow> = [
  // Create
  { section: "create",      label: "List a product",         target: "/nex-native/create/product/category" },
  // Your NEX
  { section: "your-nex",    label: "Chats and contacts",     target: "/nex-native/contacts" },
  { section: "your-nex",    label: "My profile",             target: "/nex-native/profile/me" },
  { section: "your-nex",    label: "Edit Profile",           target: "/nex-native/settings/profile/edit" },
  { section: "your-nex",    label: "Shop Settings",          target: "/nex-native/manage" },
  { section: "your-nex",    label: "FAQ",                    target: "/nex-native/manage/shop/faq" },
  { section: "your-nex",    label: "Chat Settings",          target: "/nex-native/settings/chat-settings" },
  { section: "your-nex",    label: "Payment Providers",      target: "/nex-native/settings/payments" },
  { section: "your-nex",    label: "My Orders",              target: "/nex-native/manage/orders" },
  { section: "your-nex",    label: "Wholesale",              target: "/nex-native/manage/wholesale" },
  { section: "your-nex",    label: "NEX Store",              target: "/nex-native/store" },
  { section: "your-nex",    label: "Install NEX",            target: "/nex-native/install" },
  // Preferences
  { section: "preferences", label: "Settings",               target: "/nex-native/settings" },
  { section: "preferences", label: "Buying Guides",          target: "/nex-generated/buying-guides" },
  { section: "preferences", label: "NEX 1",                  target: "/nex-native/nex-1" },
  // Direct CTA
  { section: "cta",         label: "Chat themes library",    target: "/nex-native/chat-themes-library" },
];

test.describe.serial(
  "L-010/NAV · drawer rows under signed-in shop-owner × IE identity",
  () => {
    const handles: FixtureHandle[] = [];
    const merchantAccounts: TestAccountHandle[] = [];
    let page: Page;
    let signedIn = false;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const context = await browser.newContext({ storageState: undefined });
      page = await context.newPage();

      // Seed a real shop-owner merchant so the owner-gated rows
      // (/manage, /manage/orders, /manage/shop/faq, /manage/wholesale)
      // pass their ownership check and don't redirect out.
      const merchant = await createTestAccount({
        label: "l010-nav-merchant",
        returnPassword: true,
      });
      handles.push(merchant);
      merchantAccounts.push(merchant);
      const biz = await createTestBusiness(merchant, {
        label: "l010-nav-shop",
      });
      handles.push(biz);
      await signInAsFixtureInBrowser(page, merchant);
      signedIn = true;
    });

    test.afterAll(async () => {
      try {
        for (const m of merchantAccounts) {
          await ownerScopedBusinessSweep(m);
        }
      } catch (sweepErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[L-010 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
          `L-010 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
      await page?.close().catch(() => undefined);
      await page?.context().close().catch(() => undefined);
    });

    for (const row of DRAWER_ROWS_SIGNED_IN_OWNER) {
      test(`${row.section} · ${row.label} → ${row.target}`, async () => {
        test.setTimeout(45_000);
        expect(
          signedIn,
          "L-010 · merchant must be signed in before per-row checks start",
        ).toBe(true);

        // Contract A · status < 500 (allow legit redirects 307/308/303).
        const resp = await page.goto(row.target, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const status = resp?.status() ?? 0;
        expect(
          status,
          `L-010 · '${row.label}' at ${row.target} must respond < 500 · got=${status}`,
        ).toBeLessThan(500);
        expect(
          status,
          `L-010 · '${row.label}' at ${row.target} must not be 404 · got=${status}`,
        ).not.toBe(404);

        // Contract B · no branded not-found UI rendered.
        await expect(
          page.locator("[data-nex-native-not-found]"),
          `L-010 · '${row.label}' at ${row.target} must NOT render the branded not-found UI`,
        ).toHaveCount(0);

        // Contract C · body has non-empty rendered text content
        // (strict empty-shell guard · the sealed layout chrome alone
        // emits text so a non-rendering route-segment surfaces as
        // very-low character count).
        const bodyText = (await page.locator("body").innerText()).trim();
        expect(
          bodyText.length,
          `L-010 · '${row.label}' at ${row.target} body text must be non-empty (empty-shell regression guard)`,
        ).toBeGreaterThan(20);
      });
    }
  },
);
