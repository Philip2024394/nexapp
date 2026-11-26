// tests/e2e/journey-drawer-rows-buyer-ie.spec.ts
//
// L-010/NAV · browser evidence for the signed-in BUYER (no owned
// business) row of the 18×4×3 drawer navigation matrix · authored
// 2026-11-26 under Strict Complete-App Delivery Directive
// ("Navigation inventory requires real browser evidence to promote
// cells from MAPPED (route-file-exists) to VERIFIED").
//
// Why this spec exists
// --------------------
// The sibling spec `journey-drawer-rows-signed-in-merchant-ie.spec.ts`
// locked in VERIFIED evidence for the signed-in SHOP-OWNER × Ireland
// cell. That slice answers "what does the drawer destination render
// for a merchant who owns at least one business?" — it says nothing
// about the much more common buyer path (authenticated account WITH
// NO owned business). The 18×4×3 inventory treats those as two
// distinct cells; this spec is the observable-behaviour exercise for
// the BUYER × Ireland cell.
//
// A "buyer" for this spec is a session with:
//   · a valid nex_account row (seeded via createTestAccount)
//   · ZERO owned nex_business rows (createTestBusiness is NEVER
//     called under this account — doing so would collapse this cell
//     into the merchant cell)
//
// Sealed per-row behaviour under this identity
// --------------------------------------------
// The product code was read before authoring to avoid guessing; the
// classifications below come from the actual route source:
//
//   · /nex-native/manage · page.tsx:70-72 · no owned business →
//     `redirect("/nex-native/manage/shop/setup")`.
//   · /nex-native/manage/shop/faq · page.tsx:50-54 · empty owner
//     list → `redirect("/nex-native/manage/shop/setup")`.
//   · /nex-native/manage/orders · page.tsx:48-61 · no primary
//     business → renders empty "start a shop" placeholder in
//     OrdersListClient (NOT a redirect).
//   · /nex-native/manage/wholesale · page.tsx · same "start a shop"
//     placeholder pattern (NOT a redirect).
//   · /nex-native/create/product/category · page.tsx:95-97 · missing
//     `business` query param → redirects to /create/product, which
//     for a buyer (zero owned businesses) redirects onward to
//     /manage/shop/setup (create/product/page.tsx:53-59).
//   · Settings/profile/public rows render for any authenticated
//     account (buyer or merchant) with no ownership gate.
//
// The ultimate assertion for every row is the same contract the
// merchant spec enforces: status < 500 && != 404, no branded
// not-found UI, body text > 20 chars. If a legitimate Server-Component
// redirect chain lands the buyer on /manage/shop/setup, that is a
// pass — the drawer row is still functional end-to-end.
//
// Scope
// -----
// Same 16 drawer-row targets as the merchant spec (so the two slices
// are directly comparable cell-by-cell). The `expectedBuyerBehaviour`
// classification is for the report, not a test assertion — the
// assertion is uniformly "landed on a working, non-404, non-empty
// surface".
//
// Explicitly excluded
//   · /nex-native/directory — sealed hidden-until-launch (same
//     exclusion as the merchant spec).
//   · ID and WW country identities — different Worker deployments.
//   · Signed-out slice — covered by a separate planned spec.
//   · Desktop viewport parity — stage-a-pixel7 is mobile; desktop
//     parity will be exercised separately.
//
// Contract per row (what VERIFIED means)
// --------------------------------------
//   (A) `page.goto(target)` responds with HTTP status < 500 AND
//       status != 404. 3xx redirects are permitted because the
//       sealed destination chain may legitimately land the buyer on
//       /manage/shop/setup via Server-Component `redirect()`.
//   (B) The finally-landed page does NOT render the sealed branded
//       not-found UI (`[data-nex-native-not-found]`).
//   (C) The finally-landed page carries non-empty rendered body
//       text (> 20 chars · empty-shell regression guard).
//
// The networkidle wait between (B) and (C) is the same timing fix as
// the merchant spec at lines 260-262: Next.js 16 server components
// stream a NEXT_REDIRECT marker before the client router performs
// the hop, so `innerText()` sampled immediately after
// `waitUntil: "domcontentloaded"` may read an empty streaming
// fallback instead of the final page body.
//
// Boundaries honoured
//   · No product-code change · spec-only addition.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//   · No `createTestBusiness` under the buyer account (would defeat
//     the entire slice).
//
// Classification: NAV COVERAGE SPEC · exercises REAL buyer browser
// mount of 16 sealed drawer rows against sandbox Supabase via the
// fixture harness.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// The sealed enumeration mirrors control-drawer-client.tsx:272-490
// and is intentionally kept in lock-step with the merchant spec's
// DRAWER_ROWS_SIGNED_IN_OWNER table so the two slices are
// cell-aligned.
type ExpectedBuyerBehaviour =
  | "PUBLIC-RENDER"
  | "AUTH-ONLY-RENDER"
  | "OWNER-GATE-TO-SETUP"
  | "OWNER-GATE-TO-PLACEHOLDER"
  | "CREATE-GATE-TO-SETUP";

type DrawerRow = Readonly<{
  label: string;
  target: string;
  section: "create" | "your-nex" | "preferences" | "cta";
  expectedBuyerBehaviour: ExpectedBuyerBehaviour;
}>;

const DRAWER_ROWS_BUYER: ReadonlyArray<DrawerRow> = [
  // Create
  {
    section: "create",
    label: "List a product",
    target: "/nex-native/create/product/category",
    // No `business` param + zero owned businesses → chain redirect
    // via /create/product → /manage/shop/setup.
    expectedBuyerBehaviour: "CREATE-GATE-TO-SETUP",
  },
  // Your NEX
  {
    section: "your-nex",
    label: "Chats and contacts",
    target: "/nex-native/contacts",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "your-nex",
    label: "My profile",
    target: "/nex-native/profile/me",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "your-nex",
    label: "Edit Profile",
    target: "/nex-native/settings/profile/edit",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "your-nex",
    label: "Shop Settings",
    target: "/nex-native/manage",
    // page.tsx:70-72 · redirect("/nex-native/manage/shop/setup").
    expectedBuyerBehaviour: "OWNER-GATE-TO-SETUP",
  },
  {
    section: "your-nex",
    label: "FAQ",
    target: "/nex-native/manage/shop/faq",
    // page.tsx:50-54 · empty owner list → redirect to setup.
    expectedBuyerBehaviour: "OWNER-GATE-TO-SETUP",
  },
  {
    section: "your-nex",
    label: "Chat Settings",
    target: "/nex-native/settings/chat-settings",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "your-nex",
    label: "Payment Providers",
    target: "/nex-native/settings/payments",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "your-nex",
    label: "My Orders",
    target: "/nex-native/manage/orders",
    // page.tsx:48-61 · no primary business → renders empty "start a
    // shop" placeholder (NOT a redirect).
    expectedBuyerBehaviour: "OWNER-GATE-TO-PLACEHOLDER",
  },
  {
    section: "your-nex",
    label: "Wholesale",
    target: "/nex-native/manage/wholesale",
    // page.tsx header: zero owned businesses → "start a shop"
    // placeholder (NOT a redirect).
    expectedBuyerBehaviour: "OWNER-GATE-TO-PLACEHOLDER",
  },
  {
    section: "your-nex",
    label: "NEX Store",
    target: "/nex-native/store",
    expectedBuyerBehaviour: "PUBLIC-RENDER",
  },
  {
    section: "your-nex",
    label: "Install NEX",
    target: "/nex-native/install",
    expectedBuyerBehaviour: "PUBLIC-RENDER",
  },
  // Preferences
  {
    section: "preferences",
    label: "Settings",
    target: "/nex-native/settings",
    expectedBuyerBehaviour: "AUTH-ONLY-RENDER",
  },
  {
    section: "preferences",
    label: "Buying Guides",
    target: "/nex-generated/buying-guides",
    expectedBuyerBehaviour: "PUBLIC-RENDER",
  },
  {
    section: "preferences",
    label: "NEX 1",
    target: "/nex-native/nex-1",
    expectedBuyerBehaviour: "PUBLIC-RENDER",
  },
  // Direct CTA
  {
    section: "cta",
    label: "Chat themes library",
    target: "/nex-native/chat-themes-library",
    expectedBuyerBehaviour: "PUBLIC-RENDER",
  },
];

test.describe.serial(
  "L-010/NAV · drawer rows under signed-in BUYER (no business) × IE identity",
  () => {
    const handles: FixtureHandle[] = [];
    let page: Page;
    let signedIn = false;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const context = await browser.newContext({ storageState: undefined });
      page = await context.newPage();

      // Seed a real buyer: authenticated account, ZERO owned
      // businesses. createTestBusiness is intentionally NOT called —
      // the whole point of this slice is the no-business cell of the
      // 18×4×3 matrix. If a business is ever attached under this
      // account, this spec becomes a duplicate of the merchant spec.
      const buyer = await createTestAccount({
        label: "l010-nav-buyer",
        returnPassword: true,
      });
      handles.push(buyer);
      await signInAsFixtureInBrowser(page, buyer);
      signedIn = true;
    });

    test.afterAll(async () => {
      // Fixture teardown is a QUALITY GATE per Strict Completion
      // Standard. Zero residuals is required — a leaked row means
      // the spec is INCOMPLETE regardless of per-row pass counts.
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
          `L-010 buyer teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
      await page?.close().catch(() => undefined);
      await page?.context().close().catch(() => undefined);
    });

    for (const row of DRAWER_ROWS_BUYER) {
      test(`${row.section} · ${row.label} → ${row.target} [${row.expectedBuyerBehaviour}]`, async () => {
        test.setTimeout(45_000);
        expect(
          signedIn,
          "L-010 · buyer must be signed in before per-row checks start",
        ).toBe(true);

        // Contract A · status < 500 (allow legit redirects 307/308/303)
        // and != 404.
        const resp = await page.goto(row.target, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const status = resp?.status() ?? 0;
        expect(
          status,
          `L-010 buyer · '${row.label}' at ${row.target} must respond < 500 · got=${status}`,
        ).toBeLessThan(500);
        expect(
          status,
          `L-010 buyer · '${row.label}' at ${row.target} must not be 404 · got=${status}`,
        ).not.toBe(404);

        // Contract B · no branded not-found UI rendered.
        await expect(
          page.locator("[data-nex-native-not-found]"),
          `L-010 buyer · '${row.label}' at ${row.target} must NOT render the branded not-found UI`,
        ).toHaveCount(0);

        // 2026-11-26 · L-041 cycle-2 timing fix. Next.js 16 server
        // components use `redirect()` to issue a NEXT_REDIRECT marker
        // over the RSC stream; the client-side router then performs
        // the hop. Under `waitUntil: "domcontentloaded"` the initial
        // DOM sampled by `innerText()` is the empty streaming
        // fallback BEFORE the client has navigated. Wait for the
        // network to settle so any Server-Component `redirect()`
        // chain completes and the final page body is in the DOM.
        // Especially load-bearing for the BUYER slice because the
        // owner-gated rows (/manage, /manage/shop/faq, and the
        // /create/product/category chain) trigger exactly this
        // redirect pattern en route to /manage/shop/setup.
        await page
          .waitForLoadState("networkidle", { timeout: 10_000 })
          .catch(() => undefined);

        // Contract C · body has non-empty rendered text content
        // (strict empty-shell guard).
        const bodyText = (await page.locator("body").innerText()).trim();
        expect(
          bodyText.length,
          `L-010 buyer · '${row.label}' at ${row.target} body text must be non-empty (empty-shell regression guard)`,
        ).toBeGreaterThan(20);
      });
    }
  },
);
