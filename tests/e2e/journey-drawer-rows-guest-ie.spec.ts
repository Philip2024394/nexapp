// tests/e2e/journey-drawer-rows-guest-ie.spec.ts
//
// L-010/NAV · browser evidence for the unauthenticated-GUEST row of
// the 18×4×3 drawer navigation matrix · authored 2026-11-26 as the
// sibling slice to tests/e2e/journey-drawer-rows-signed-in-merchant-
// ie.spec.ts. Together they begin the promotion of drawer cells from
// MAPPED (route-file-exists) to VERIFIED (observable-behaviour
// exercised under a specific session × country identity).
//
// Why this spec exists
// --------------------
// `docs/engineering/navigation-inventory.md` enumerates 18 drawer
// rows across three sections (Create / Your NEX / Preferences) plus
// direct CTAs. Rule 8 taxonomy from `CLAUDE.md` is strict:
//   · MAPPED  — route file exists on disk.
//   · VERIFIED — observable-behaviour exercise passed in a real
//     browser against the live dev server under a stated identity.
//
// The merchant × IE slice has already been authored and proves the
// authenticated-shop-owner surface. This spec covers the GUEST ×
// Ireland slice — i.e. what happens when an unauthenticated visitor
// opens each drawer row. The two slices are independent cells of
// the same matrix; neither substitutes for the other.
//
// Expected guest behaviour per row (derived from source inspection,
// not guess)
// ---------------------------------------------------------------
// The current nexapp uses two patterns for guest handling:
//   A · Server-component `redirect("/nex-native/sign-in?next=…")`
//       when `resolveSessionWithDevOverride()` returns null. The
//       browser lands on the sign-in form — a working surface.
//   B · Public-render pages that tolerate a null session and render
//       their public content (empty-state or marketing copy).
//
// The sealed 2026-11-21 `NexAuthGate` page-level banner standard is
// a third option reserved for specific feature pages; none of the
// 16 drawer rows below currently use it, so this spec classifies
// each row as PUBLIC-RENDER or REDIRECT-TO-SIGNIN based on the
// actual source. The enum `expectedGuestBehaviour` is carried on
// each row so future readers can see intent; the three contracts
// below apply uniformly regardless of which pattern a row uses.
//
// Scope
// -----
// Rows exercised (13 targets — matches the merchant slice after
// cycle-4 2026-11-27 founder scope-simplification seal):
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
//    10 · /nex-native/install                    · "Install NEX"
//   Preferences section:
//    11 · /nex-native/settings                   · "Settings"
//    12 · /nex-native/nex-1                      · "NEX 1"
//   Direct CTA:
//    13 · /nex-native/chat-themes-library        · "Chat themes library"
//
// Explicitly excluded (and why):
//   · /nex-native/directory (Discovery) — sealed hidden-until-launch
//     per 2026-11-24 launch programme. Separate contract.
//   · /nex-native/manage/wholesale (Wholesale),
//     /nex-native/store (NEX Store),
//     /nex-generated/buying-guides (Buying Guides) — removed from
//     the drawer in cycle-4 2026-11-27 via
//     SCOPE_SIMPLIFICATION_HIDDEN_KEYS in
//     `control-drawer-client.tsx`. Backing routes remain reachable
//     via direct URL but are no longer drawer surfaces, so they
//     fall outside this spec's scope. Restore here only if the
//     founder re-exposes the drawer rows.
//
// Contract per row (what VERIFIED means for this cycle)
// ------------------------------------------------------
// A row passes iff:
//   (A) `page.goto(target)` responds with HTTP status < 500 · this
//       permits 3xx redirects (307/308/303) because a sign-in
//       bounce is the SEALED behaviour for an owner-gated row
//       under a guest session — it is not a defect.
//   (B) The finally-landed page does NOT render the sealed branded
//       not-found UI (`[data-nex-native-not-found]` from
//       `src/app/nex-native/not-found.tsx`).
//   (C) The finally-landed page carries non-empty rendered body
//       text (> 20 chars) — guards against empty-shell regressions
//       where a route returns 200 but renders no content.
//
// A failing row is a BROKEN drawer surface for the guest state and
// is reported row-by-row, never silently masked.
//
// What this spec does NOT prove
// -----------------------------
//   · ID or WW country identities (different Worker deployments).
//   · The quality of the sign-in form itself beyond "it rendered".
//   · The authenticated non-owner (buyer) slice of the matrix.
//   · Mobile-vs-desktop parity (stage-a-pixel7 = mobile).
//   · Correctness of each page's internal journey.
//
// Boundaries honoured
//   · No product-code change · spec-only addition.
//   · No fixtures seeded — guest slice uses a clean storageState,
//     so there is nothing to teardown. No residual-row risk.
//   · Rule 8 taxonomy strict: this spec promotes the GUEST × IE
//     slice to VERIFIED only if every per-row `test()` passes.
//
// Classification: NAV COVERAGE SPEC · exercises REAL guest browser
// mount of 16 sealed drawer rows against the live dev server on
// :3008 under the sealed IE identity.

import { expect, test, type Page } from "@playwright/test";

type DrawerRow = Readonly<{
  label: string;
  target: string;
  section: "create" | "your-nex" | "preferences" | "cta";
  expectedGuestBehaviour:
    | "PUBLIC-RENDER"
    | "REDIRECT-TO-SIGNIN"
    | "AUTH-GATE";
}>;

// Mirrors the SURFACED drawer rows in control-drawer-client.tsx
// (after SCOPE_SIMPLIFICATION_HIDDEN_KEYS filter applied in cycle-4
// 2026-11-27). Same enumeration the merchant slice uses.
// `expectedGuestBehaviour` is derived from grep of
// `resolveSessionWithDevOverride` + `redirect(` in each row's
// page.tsx on 2026-11-26 at HEAD 9dfa90b4:
//
//   REDIRECT-TO-SIGNIN rows (session guard → /sign-in?next=…):
//     /nex-native/create/product/category
//     /nex-native/contacts
//     /nex-native/profile/me
//     /nex-native/settings/profile/edit
//     /nex-native/manage
//     /nex-native/manage/shop/faq
//     /nex-native/settings/chat-settings
//     /nex-native/manage/orders
//     /nex-native/settings
//
//   PUBLIC-RENDER rows (no session guard; render for anyone):
//     /nex-native/settings/payments   (tolerates null session)
//     /nex-native/install
//     /nex-native/nex-1
//     /nex-native/chat-themes-library
//
//   AUTH-GATE rows (sealed NexAuthGate banner):
//     [none currently in the 13-row drawer set — reserved]
const DRAWER_ROWS_GUEST: ReadonlyArray<DrawerRow> = [
  // Create
  {
    section: "create",
    label: "List a product",
    target: "/nex-native/create/product/category",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  // Your NEX
  {
    section: "your-nex",
    label: "Chats and contacts",
    target: "/nex-native/contacts",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "My profile",
    target: "/nex-native/profile/me",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "Edit Profile",
    target: "/nex-native/settings/profile/edit",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "Shop Settings",
    target: "/nex-native/manage",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "FAQ",
    target: "/nex-native/manage/shop/faq",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "Chat Settings",
    target: "/nex-native/settings/chat-settings",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  {
    section: "your-nex",
    label: "Payment Providers",
    target: "/nex-native/settings/payments",
    expectedGuestBehaviour: "PUBLIC-RENDER",
  },
  {
    section: "your-nex",
    label: "My Orders",
    target: "/nex-native/manage/orders",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  // Wholesale + NEX Store suppressed from drawer 2026-11-27 (cycle-4)
  // via SCOPE_SIMPLIFICATION_HIDDEN_KEYS — see exclusion notes in header.
  {
    section: "your-nex",
    label: "Install NEX",
    target: "/nex-native/install",
    expectedGuestBehaviour: "PUBLIC-RENDER",
  },
  // Preferences
  {
    section: "preferences",
    label: "Settings",
    target: "/nex-native/settings",
    expectedGuestBehaviour: "REDIRECT-TO-SIGNIN",
  },
  // Buying Guides suppressed from drawer 2026-11-27 (cycle-4) via
  // SCOPE_SIMPLIFICATION_HIDDEN_KEYS — see exclusion notes in header.
  {
    section: "preferences",
    label: "NEX 1",
    target: "/nex-native/nex-1",
    expectedGuestBehaviour: "PUBLIC-RENDER",
  },
  // Direct CTA
  {
    section: "cta",
    label: "Chat themes library",
    target: "/nex-native/chat-themes-library",
    expectedGuestBehaviour: "PUBLIC-RENDER",
  },
];

test.describe.serial(
  "L-010/NAV · drawer rows under unauthenticated GUEST × IE identity",
  () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(60_000);
      // storageState: undefined = fully unauthenticated context.
      // No fixtures seeded — guest slice has zero residual risk.
      const context = await browser.newContext({ storageState: undefined });
      page = await context.newPage();
    });

    test.afterAll(async () => {
      await page?.close().catch(() => undefined);
      await page?.context().close().catch(() => undefined);
    });

    for (const row of DRAWER_ROWS_GUEST) {
      test(`${row.section} · ${row.label} → ${row.target} [${row.expectedGuestBehaviour}]`, async () => {
        test.setTimeout(45_000);

        // Contract A · status < 500. 3xx is explicitly permitted
        // because REDIRECT-TO-SIGNIN rows are expected to bounce
        // the guest to /sign-in — the destination is still a
        // working surface. 404 is still a failure.
        const resp = await page.goto(row.target, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const status = resp?.status() ?? 0;
        expect(
          status,
          `L-010 · '${row.label}' at ${row.target} must respond < 500 under guest · got=${status}`,
        ).toBeLessThan(500);
        expect(
          status,
          `L-010 · '${row.label}' at ${row.target} must not be 404 under guest · got=${status}`,
        ).not.toBe(404);

        // Contract B · no branded not-found UI.
        await expect(
          page.locator("[data-nex-native-not-found]"),
          `L-010 · '${row.label}' at ${row.target} must NOT render branded not-found UI under guest`,
        ).toHaveCount(0);

        // 2026-11-26 · timing fix mirrored from merchant slice
        // lines 260-262. Next.js 16 server-component `redirect()`
        // issues a NEXT_REDIRECT marker over the RSC stream; the
        // client router then performs the hop. Under
        // `waitUntil: "domcontentloaded"` the sampled DOM is the
        // empty streaming fallback BEFORE navigation. Wait for
        // networkidle (10s cap) so any `redirect()` chain settles
        // and the final page body is in the DOM. Guest slice
        // needs this even more than merchant slice because every
        // REDIRECT-TO-SIGNIN row traverses exactly this chain.
        await page
          .waitForLoadState("networkidle", { timeout: 10_000 })
          .catch(() => undefined);

        // Contract C · body text > 20 chars (empty-shell guard).
        const bodyText = (await page.locator("body").innerText()).trim();
        expect(
          bodyText.length,
          `L-010 · '${row.label}' at ${row.target} body text must be non-empty under guest (empty-shell regression guard)`,
        ).toBeGreaterThan(20);
      });
    }
  },
);
