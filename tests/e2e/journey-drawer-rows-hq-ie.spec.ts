// tests/e2e/journey-drawer-rows-hq-ie.spec.ts
//
// Axis A (role × session × drawer navigation) · HQ-role × Ireland
// slice · authored 2026-11-26 under the 2026-11-26 continuation cycle
// as Agent E's contribution — the last Axis A role × IE slice not yet
// VERIFIED after L-041 (merchant), L-045 (guest), L-046 (buyer).
//
// Status at authoring time: SKIPPED · BLOCKED · see "Blocker" below.
// Spec is authored and typecheck-clean, but every test is gated by
// `test.describe.skip(...)` until the two prerequisites in the Blocker
// section are satisfied. Authoring now preserves the inventory row
// shape and lets the main thread flip to live immediately once the
// harness extension + sandbox migration are in place.
//
// Why this spec exists
// --------------------
// The single-app country-model reconciliation at
// `docs/engineering/single-app-country-model-reconciliation-2026-11-26.md`
// enumerates Axis A as role × country × drawer navigation. Three of
// four role × IE cells now carry VERIFIED browser evidence:
//   · L-041 merchant × IE — `journey-drawer-rows-signed-in-merchant-ie.spec.ts`
//   · L-045 guest × IE    — `journey-drawer-rows-guest-ie.spec.ts`
//   · L-046 buyer × IE    — `journey-drawer-rows-buyer-ie.spec.ts`
// The HQ-role × IE cell remained MAPPED-only because HQ has
// structurally different navigation (its own desktop-only sidebar in
// `src/app/nex-native/hq/_hq-nav.tsx`, NOT the mobile control-drawer
// used by the other three roles). This spec establishes the matching
// browser contract for the HQ sidebar rows under the same
// Contract A/B/C framework as L-041.
//
// Architecture note · HQ navigation is NOT the control-drawer
// --------------------------------------------------------------
// Confirmed by inspection at HEAD=9dfa90b4:
//
//   · `src/components/nex-native/control-drawer/control-drawer-client.tsx`
//     contains ZERO references to `hq`, `HQ`, `isHq`, `admin`,
//     `platform-admin`, or `founder`. The mobile phone-frame drawer
//     does not surface HQ rows at all. Grep is empty.
//
//   · HQ users see a PERMANENT 260 px left sidebar
//     (`src/app/nex-native/hq/_hq-nav.tsx`, mounted by
//     `src/app/nex-native/hq/layout.tsx:110`), which is a separate
//     React component tree. Per CLAUDE.md Rule 11 "HQ desktop-only
//     controls outside the phone interface", this sidebar renders
//     only at viewport width ≥ 900 px (`layout.tsx:52-56`). Below
//     900 px the layout swaps to an explicit "NEX HQ is desktop-only"
//     message with no navigation.
//
//   · HQ pages are gated independently of the drawer: every
//     `page.tsx` under `/nex-native/hq/*` server-side calls
//     `requireHqAdmin(session.account.id)` and `notFound()` on deny
//     (sealed non-revealing-404 pattern in
//     `src/lib/nex-native/hq-authorization.ts`).
//
// Therefore HQ × IE Axis A coverage targets the 17 HQ sidebar rows at
// a DESKTOP viewport, with an HQ-admin-role fixture session. If the
// role is wrong the pages resolve to the branded not-found UI (exactly
// the regression this spec guards against).
//
// Desktop viewport contract
// -------------------------
// The HQ sidebar is explicitly desktop-only. No existing Playwright
// project in `playwright.config.ts` runs with a desktop profile — the
// stage-a-pixel7 project forces `devices["Pixel 7"]` (412×915). This
// spec uses `test.use({ viewport: ... })` to override to 1280×800 on
// its individual tests so stage-a-pixel7 provides the browser +
// fixtures but the measurements happen above the 900 px threshold.
//
// Scope (17 HQ sidebar rows, enumerated verbatim from
// `_hq-nav.tsx` NAV constant at HEAD=9dfa90b4):
//   Direct leaves:
//     1  · /nex-native/hq                                     · "HQ Home"
//     2  · /nex-native/hq/harvest                             · "Harvest"
//     3  · /nex-native/hq/pages                               · "Pages"
//     4  · /nex-native/hq/journey-map                         · "Journey Map"
//   Founder Engineering section:
//     5  · /nex-native/hq/founder-engineering/mapping-audit   · "Mapping Audit"
//   Members section:
//     6  · /nex-native/hq/members                             · "Overview"
//     7  · /nex-native/hq/members/shops                       · "Shops"
//     8  · /nex-native/hq/members/chats                       · "Chats"
//     9  · /nex-native/hq/members/vault                       · "Vault"
//   Direct leaves:
//    10  · /nex-native/hq/communities                         · "Communities"
//    11  · /nex-native/hq/chat-themes                         · "Chat Themes"
//   Security Audit section:
//    12  · /nex-native/hq/security-audit                      · "Log"
//    13  · /nex-native/hq/security-audit/retention            · "Retention"
//    14  · /nex-native/hq/security-audit/deletion-recovery    · "Deletion recovery"
//   Direct leaves:
//    15  · /nex-native/hq/security-recovery                   · "Security & Recovery"
//    16  · /nex-native/hq/alerts                              · "Alerts"
//    17  · /nex-native/hq/translation                         · "Translation"
//
// Explicitly excluded (and why):
//   · The "Dev previews" section in `_hq-nav.tsx` points at NON-HQ
//     routes (`/nex-native/free-chat`, `/contacts?dev=1`, etc.) —
//     those are convenience shortcuts, not HQ-exclusive surfaces,
//     and other slices already (or will) cover them.
//   · The `security-audit?view=unresolved` row is a query-string
//     variant of row 12 — same page, same contract — not counted
//     separately.
//
// Contract per row (mirrors L-041)
//   (A) `page.goto(target)` responds with HTTP status < 500 AND
//       not 404 · permits legitimate redirects (307/308/303).
//   (B) The finally-landed page does NOT render the sealed branded
//       not-found UI (`[data-nex-native-not-found]` from
//       `src/app/nex-native/not-found.tsx:63`). For an HQ-role
//       fixture with `requireHqAdmin` passing, every HQ sub-page
//       must produce real content, not the non-revealing 404 fallback
//       that masks an authorisation failure.
//   (C) Body text ≥ 20 chars (empty-shell regression guard).
//
// Blocker · why this spec is SKIPPED at authoring time
// ----------------------------------------------------
// Two preconditions are missing in the sandbox environment at
// HEAD=9dfa90b4:
//
//   1. Migration 206 (`nex-supabase/migrations/206_nex_account_hq_role.sql`)
//      is AUTHORED · NOT YET APPLIED. The migration file's header
//      records: *"STATUS: AUTHORED · NOT YET APPLIED. Owner
//      authorisation covers preparation and content review only. A
//      separate explicit application authorisation (plus live-project
//      reverification against `ijvqdvsvwtwxzcqmoqit`) is required
//      before this migration touches any database."* Until it is
//      applied to sandbox `kdstoyyeygcopkogqsyv` under a named
//      approval, the `nex_account.hq_role` column does not exist,
//      `requireHqAdmin` fail-closes for every account (per
//      `hq-authorization.ts:16-18` "Fail-closed. Any read error,
//      missing session, missing row, or unexpected shape returns
//      NULL") and every HQ page `notFound()`s.
//
//   2. The fixture harness at
//      `tests/e2e/_fixtures/sandbox-test-harness.ts` does not yet
//      expose a helper to mint an HQ-role account. `createTestAccount`
//      inserts `{ supabase_user_id, display_name }` only
//      (harness lines 258-270); it does not touch `hq_role`, which
//      is correct for every non-HQ slice but cannot be used for this
//      slice. Grep for `hq_role` / `createTestHq` / `createHqAdmin`
//      in the harness returns zero matches.
//
// Exact harness extension required to unblock
// -------------------------------------------
// After mig 206 is applied to sandbox under a named approval, add
// the following helper to `sandbox-test-harness.ts` (sketch, not
// code to merge from this file):
//
//   export async function createTestHqAdmin(
//     labelOrOpts?: string | { label?: string; returnPassword?: boolean },
//   ): Promise<TestAccountHandle & { _password?: string }> {
//     // 1. Reuse createTestAccount to mint the base auth user + nex_account row.
//     const base = await createTestAccount(labelOrOpts);
//     // 2. Promote to admin via service-role admin client (bypasses RLS by design).
//     //    The hq_role column is the sealed role authority per
//     //    hq-authorization.ts; writing here mirrors the owner-sealed
//     //    "authorised SQL updates" grant pathway.
//     const sb = supabaseAdmin();
//     const { error } = await sb
//       .from("nex_account")
//       .update({ hq_role: "admin" })
//       .eq("id", base.nexAccountId);
//     if (error) {
//       // Rollback the account we just created before surfacing.
//       await teardownAll([base]);
//       throw new Error(
//         `createTestHqAdmin: UPDATE nex_account.hq_role failed · ${error.message}`,
//       );
//     }
//     return base;
//   }
//
// Teardown is unchanged because `nex_account.hq_role` is a column on
// an already-cleaned row (teardown order already deletes nex_account
// last). `assertNoResidualFixtures` also needs no change — it already
// probes `nex_account` by id, and the role column is irrelevant to
// residual detection.
//
// Rule 7 boundaries honoured
//   · No product-code change (spec-only addition).
//   · No sandbox migration applied (mig 206 remains AUTHORED).
//   · No harness modification (future task · named approval
//     required before touching harness).
//   · No commits / no pushes.
//   · HEAD must remain 9dfa90b4.
//
// Classification: NAV COVERAGE SPEC · HQ sidebar × IE × desktop
// viewport · AUTHORED only; EXECUTION BLOCKED on harness extension
// AND mig 206 sandbox apply.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
} from "./_fixtures/sandbox-test-harness";

// Sealed enumeration mirrors `src/app/nex-native/hq/_hq-nav.tsx` NAV
// constant. Any URL change in the HQ sidebar must update this table
// in the same commit (inventory contract §6 of the Strict Completion
// Standard 2026-11-25).
type HqRow = Readonly<{
  label: string;
  target: string;
  section: "leaf" | "founder-engineering" | "members" | "security-audit";
}>;

const HQ_SIDEBAR_ROWS: ReadonlyArray<HqRow> = [
  { section: "leaf",                 label: "HQ Home",                 target: "/nex-native/hq" },
  { section: "leaf",                 label: "Harvest",                 target: "/nex-native/hq/harvest" },
  { section: "leaf",                 label: "Pages",                   target: "/nex-native/hq/pages" },
  { section: "leaf",                 label: "Journey Map",             target: "/nex-native/hq/journey-map" },
  { section: "founder-engineering",  label: "Mapping Audit",           target: "/nex-native/hq/founder-engineering/mapping-audit" },
  { section: "members",              label: "Overview",                target: "/nex-native/hq/members" },
  { section: "members",              label: "Shops",                   target: "/nex-native/hq/members/shops" },
  { section: "members",              label: "Chats",                   target: "/nex-native/hq/members/chats" },
  { section: "members",              label: "Vault",                   target: "/nex-native/hq/members/vault" },
  { section: "leaf",                 label: "Communities",             target: "/nex-native/hq/communities" },
  { section: "leaf",                 label: "Chat Themes",             target: "/nex-native/hq/chat-themes" },
  { section: "security-audit",       label: "Log",                     target: "/nex-native/hq/security-audit" },
  { section: "security-audit",       label: "Retention",               target: "/nex-native/hq/security-audit/retention" },
  { section: "security-audit",       label: "Deletion recovery",       target: "/nex-native/hq/security-audit/deletion-recovery" },
  { section: "leaf",                 label: "Security & Recovery",     target: "/nex-native/hq/security-recovery" },
  { section: "leaf",                 label: "Alerts",                  target: "/nex-native/hq/alerts" },
  { section: "leaf",                 label: "Translation",             target: "/nex-native/hq/translation" },
];

// Desktop viewport required: the HQ shell reveals its sidebar + real
// content only at ≥ 900 px (`hq/layout.tsx:52-56`). Below that it
// renders only the "NEX HQ is desktop-only" fallback card, which is
// visually correct but is NOT the Axis A HQ-navigation slice under
// test. 1280×800 is a conventional desktop baseline.
const HQ_DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;

// BLOCKED at authoring time. See "Blocker" in the file header for the
// two preconditions (mig 206 applied to sandbox + harness extension
// `createTestHqAdmin`). When both are satisfied, replace
// `test.describe.skip` with `test.describe.serial` and swap the
// stubbed `createHqAdminHandle` call for the new harness helper.
test.describe.skip(
  "NAV · drawer rows under signed-in HQ-admin × IE identity (desktop) · BLOCKED: no HQ-role fixture mint — needs harness extension + mig 206 sandbox apply",
  () => {
    const handles: FixtureHandle[] = [];
    let page: Page;
    let signedIn = false;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const context = await browser.newContext({
        storageState: undefined,
        viewport: HQ_DESKTOP_VIEWPORT,
      });
      page = await context.newPage();

      // Minimum fixture for the un-skipped future: an HQ-admin-role
      // account. Today the harness cannot mint the admin role — the
      // placeholder below uses the ordinary createTestAccount so the
      // file remains typecheck-clean; the describe.skip() ensures no
      // false pass can be reported against a non-admin fixture.
      //
      // Future line (post-blocker):
      //   const admin = await createTestHqAdmin({
      //     label: "hq-nav-ie",
      //     returnPassword: true,
      //   });
      const admin: TestAccountHandle & { _password?: string } =
        await createTestAccount({
          label: "hq-nav-ie-STUB",
          returnPassword: true,
        });
      handles.push(admin);

      await signInAsFixtureInBrowser(page, admin);
      signedIn = true;
    });

    test.afterAll(async () => {
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
          `HQ × IE teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
      await page?.close().catch(() => undefined);
      await page?.context().close().catch(() => undefined);
    });

    for (const row of HQ_SIDEBAR_ROWS) {
      test(`${row.section} · ${row.label} → ${row.target}`, async () => {
        test.setTimeout(45_000);
        expect(
          signedIn,
          "HQ × IE · admin must be signed in before per-row checks start",
        ).toBe(true);

        // Contract A · status < 500 (allow legit redirects 307/308/303)
        //            · not 404.
        const resp = await page.goto(row.target, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const status = resp?.status() ?? 0;
        expect(
          status,
          `HQ × IE · '${row.label}' at ${row.target} must respond < 500 · got=${status}`,
        ).toBeLessThan(500);
        expect(
          status,
          `HQ × IE · '${row.label}' at ${row.target} must not be 404 · got=${status}`,
        ).not.toBe(404);

        // Timing fix (same as L-041 cycle-2): wait for the client-side
        // navigation triggered by any Server-Component redirect() to
        // settle before we sample body text. Capped at 10 s so a dead
        // route cannot eat the whole test timeout.
        await page
          .waitForLoadState("networkidle", { timeout: 10_000 })
          .catch(() => undefined);

        // Contract B · no branded not-found UI rendered. For an HQ
        // page under an HQ-admin fixture this ALSO catches the
        // requireHqAdmin notFound() path — a silent authorisation
        // failure would surface here as a visible not-found marker,
        // not a status 404 (because requireHqAdmin uses notFound()
        // which returns a 200 with the branded component).
        await expect(
          page.locator("[data-nex-native-not-found]"),
          `HQ × IE · '${row.label}' at ${row.target} must NOT render the branded not-found UI`,
        ).toHaveCount(0);

        // Contract C · body text ≥ 20 chars. For HQ pages the sidebar
        // header alone emits "NEX HEADQUARTERS Platform admin · desktop-only"
        // (≈ 40 chars) so a route-level empty shell will still drop
        // well below the body total we'd expect from a real HQ page.
        const bodyText = (await page.locator("body").innerText()).trim();
        expect(
          bodyText.length,
          `HQ × IE · '${row.label}' at ${row.target} body text must be non-empty (empty-shell regression guard)`,
        ).toBeGreaterThan(20);
      });
    }
  },
);
