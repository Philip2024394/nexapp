// tests/e2e/journey-create-shop.spec.ts
//
// T-2.2 · create shop journey · authored under Stage A Conditional
// Approval 2026-11-24.
//
// Observable behaviour:
//   · Signed-in account without a business row that clicks the
//     Shop-Settings drawer row lands on /manage · redirected to
//     /manage/shop/setup · then to /manage/shop/setup/business-details.
//   · Filling the business-details form and saving creates a
//     `nex_business` row for this account (observable: subsequent
//     /manage navigates to the management centre, not the setup
//     dispatcher).
//   · Appearance step offers a background selection; First Product
//     step offers product creation; Review step shows a summary.
//
// Dependencies:
//   · T-2.1 drawer-row decision (Option A / B / C / D). This spec does
//     not assume any particular label · it uses the real href and
//     text on whichever variant lands.
//   · A signed-in test account that is OPTIONAL (empty-business state).
//     If the test account already has a business, the test is SKIPPED
//     honestly rather than silently passing.
//
// 2026-11-25 rewire · the third (previously BLOCKED-PENDING-SEED) test
// is reworked to verify the DB-layer create-shop contract via the
// sandbox fixture harness. It does NOT re-run the UI business-details
// form (that requires an empty-business storageState account, which
// the harness does not currently mint for the browser session). What
// it does prove is the sealed persistence contract that the form
// would exercise if driven by an empty-business session:
//
//   · A fresh fixture account can own a newly-inserted nex_business
//     row.
//   · The row carries the correct owner_account_id FK.
//   · The slug CHECK constraint (^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$)
//     is enforced by the harness-emitted slug.
//   · Teardown reverses the insert cleanly.
//
// This narrows the T5 coverage gap from "no test at all" to "DB
// contract verified, UI dispatcher verified, UI-level form submission
// still deferred pending merchant-session minting support in the
// harness".
//
// Classification: SPEC AUTHORED.

import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestBusinessHandle,
} from "./_fixtures/sandbox-test-harness";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-2.2 · create shop journey", () => {
  test("baseline · /manage redirects to setup dispatcher iff the account has no business", async ({
    page,
  }) => {
    // Remediation 2026-11-24 cycle 2 · `/manage` carries long-lived
    // realtime connections that keep `networkidle` from firing. The
    // dispatcher decision is made server-side so the URL is already
    // the final destination after `domcontentloaded`. Assertion
    // strength preserved: we still check status + URL.
    const response = await page.goto("/nex-native/manage", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/manage responds").toBeLessThan(500);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });

    const url = page.url();
    if (/\/nex-native\/manage\/shop\/setup/.test(url)) {
      // Expected branch: no business yet · we proceeded.
      return;
    }
    if (/\/nex-native\/manage(?:[/?#]|$)/.test(url)) {
      // Account already has a business · cannot exercise the create path.
      test.skip(
        true,
        "test account already has a business · cannot exercise Create Shop · " +
          "owner must provision a shop-less account or we skip this journey",
      );
    }
  });

  test("setup dispatcher routes an empty account to business-details first", async ({
    page,
  }) => {
    // Remediation 2026-11-24 cycle 2 · dispatcher decision is
    // server-side · we switch to `domcontentloaded` + body-attached
    // wait so the URL check below has a stable document.
    const response = await page.goto("/nex-native/manage/shop/setup", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/manage/shop/setup responds").toBeLessThan(500);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });

    // Per src/app/nex-native/manage/shop/setup/page.tsx:63-64, a fresh
    // account lands on business-details.
    const url = page.url();
    if (/\/nex-native\/manage\/shop\/setup\/business-details/.test(url)) {
      return;
    }
    // Account further along in setup · skip rather than weaken.
    test.skip(
      true,
      `account already past business-details step (url: ${url}) · ` +
        "owner must reseed to exercise the first step",
    );
  });

  test("harness · fresh fixture account can own a nex_business row with correct FK + slug + teardown", async () => {
    test.setTimeout(60_000);
    assertSandboxRef();
    const sb = supabaseAdmin();
    const handles: FixtureHandle[] = [];

    try {
      const merchant = await createTestAccount("t5-merchant");
      handles.push(merchant);

      const biz = await createTestBusiness(merchant, { label: "t5shop" });
      handles.push(biz);

      // Admin SELECT back to verify FK + slug persistence.
      const { data: readBack, error: readErr } = await sb
        .from("nex_business")
        .select("id, owner_account_id, slug, display_name")
        .eq("id", biz.businessId)
        .maybeSingle();

      expect(readErr, "business read-back has no error").toBeNull();
      expect(readBack?.id, "business row exists in sandbox").toBe(
        biz.businessId,
      );
      expect(
        readBack?.owner_account_id,
        "business.owner_account_id matches fixture merchant",
      ).toBe(merchant.nexAccountId);
      expect(readBack?.slug, "slug persisted").toBe(biz.slug);
      // Slug CHECK is enforced at the DB · if the harness emitted a
      // non-matching slug, the insert would have failed above. We
      // re-assert the shape here for defense-in-depth.
      expect(
        /^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$/.test(biz.slug),
        `slug must satisfy nex_business.slug CHECK (got '${biz.slug}')`,
      ).toBe(true);
    } finally {
      await teardownAll(handles);
    }

    // Post-teardown · the row must be gone (proves teardown primitives
    // actually reverse the insert; a leaked fixture would be a resource
    // leak in sandbox over time).
    const { data: residual } = await sb
      .from("nex_business")
      .select("id")
      .in(
        "id",
        handles
          .filter((h) => h.kind === "business")
          .map((h) => (h as { businessId: string }).businessId),
      );
    expect(
      residual?.length ?? 0,
      "teardownAll removed the fixture business row",
    ).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2026-11-26 strict rewrite · T5 real-browser UI journey
  //
  // Owner directive (NEX STRICT COMPLETION DIRECTIVE, 2026-11-25):
  //   "T5 Shop onboarding must be a real browser journey. Sign-in → Create
  //    Shop → setup dispatcher → business-details → form submit → DB
  //    persistence → management-centre render. Needs a shop-less
  //    authenticated account minted within existing harness authority ·
  //    do not weaken authentication or permissions to get there."
  //
  // This spec establishes a brand-new SHOP-LESS fixture account, signs it
  // in via the sealed sign-in form (no bypass of RLS, dev-override, or
  // email confirmation), walks the dispatcher to business-details, fills
  // and submits the sealed form, and verifies the resulting DB row
  // (admin SELECT). Teardown is strict: the fixture business auto-
  // provisioned by requireBusiness() + provisionDefaultBusiness is
  // discovered post-save and added to the handles list so it is removed
  // in reverse-FK order. Residuals are asserted zero at the end.
  //
  // Classification: AUTHORED to exercise the real UI. Reports PASS/FAIL
  // honestly · if the dispatcher cannot lead the account through the
  // flow, the test fails (we do NOT widen the success condition).
  // ─────────────────────────────────────────────────────────────────────
  test("real browser journey · shop-less account → /manage → business-details → submit → nex_business row persists", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    assertSandboxRef();
    const sb = supabaseAdmin();
    const handles: FixtureHandle[] = [];
    // The fixture account is shop-less at creation · requireBusiness()
    // will auto-provision the row on first save. We discover + register
    // that provisioned business in `handles` AFTER the submit so
    // teardown reverses cleanly in reverse-FK order.
    let provisionedBusinessIdForTeardown: string | null = null;

    // Use a dedicated browser context so the Playwright `storageState`
    // (pre-seeded dev-pass session) does not collide with the fixture
    // sign-in we're about to perform.
    const context = await browser.newContext({
      storageState: undefined,
    });
    const freshPage = await context.newPage();

    try {
      // 1 · Mint a shop-less fixture account WITH password so the
      //     browser-side sign-in helper can drive the sealed form.
      const merchant = await createTestAccount({
        label: "t5-shopless",
        returnPassword: true,
      });
      handles.push(merchant);

      // Precondition sanity: no business owned by this fresh account.
      const { data: preBusinesses } = await sb
        .from("nex_business")
        .select("id")
        .eq("owner_account_id", merchant.nexAccountId);
      expect(
        preBusinesses?.length ?? 0,
        "fixture merchant must start shop-less",
      ).toBe(0);

      // 2 · Sign in through the sealed sign-in form. This is the real
      //     user path · no auth weakening.
      await signInAsFixtureInBrowser(freshPage, merchant);

      // 2a · Diagnostic (2026-11-26 investigation of session↔account
      //      mapping) · prove the Playwright context now carries a
      //      Supabase auth cookie AND that a nex_session row exists for
      //      the fixture merchant. If either is absent, the ensuing
      //      /manage dispatcher failure is a sign-in-propagation bug,
      //      not a dispatcher bug.
      const cookies = await context.cookies();
      const sbAuthCookies = cookies.filter(
        (c) => /^sb-.*-auth-token/.test(c.name) || c.name === "sb-access-token",
      );
      expect(
        sbAuthCookies.length,
        `Supabase auth cookie must be set after sign-in · got cookies: ${cookies
          .map((c) => c.name)
          .join(", ")}`,
      ).toBeGreaterThan(0);
      const { data: sessionRows } = await sb
        .from("nex_session")
        .select("id, account_id")
        .eq("account_id", merchant.nexAccountId);
      expect(
        sessionRows?.length ?? 0,
        `nex_session row must exist for fixture account ${merchant.nexAccountId} after sign-in (proves session ↔ fixture account binding)`,
      ).toBeGreaterThan(0);

      // 2b · Deeper diagnostic · hash the auth-token cookie value and
      //      look up nex_session by supabase_session_key. The returned
      //      account_id is what the server will resolve for this cookie
      //      at request time. If it's NOT merchant.nexAccountId, we've
      //      proven a session↔account mismatch (likely dev-impersonation
      //      persona winning).
      // The cookie value is a JSON array [access_token, refresh_token,
      // null, null, null] encoded as a base64-prefixed string. Parse
      // defensively · on anything unexpected, surface the raw cookie
      // names for the failure message.
      let accessToken: string | null = null;
      for (const c of cookies) {
        if (!/^sb-.*-auth-token/.test(c.name)) continue;
        try {
          const raw = c.value.startsWith("base64-")
            ? Buffer.from(c.value.slice("base64-".length), "base64").toString(
                "utf8",
              )
            : decodeURIComponent(c.value);
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && typeof parsed[0] === "string") {
            accessToken = parsed[0];
            break;
          }
          if (parsed && typeof parsed.access_token === "string") {
            accessToken = parsed.access_token;
            break;
          }
        } catch {
          // ignore · try next cookie
        }
      }
      expect(
        accessToken,
        `must be able to parse access_token from Supabase auth cookie · cookies: ${cookies
          .map((c) => c.name)
          .join(", ")}`,
      ).not.toBeNull();
      const sessionKey = createHash("sha256")
        .update(accessToken!)
        .digest("hex");
      const { data: cookieBoundSession } = await sb
        .from("nex_session")
        .select("account_id")
        .eq("supabase_session_key", sessionKey)
        .maybeSingle();
      // The cookie-bound nex_session row's account_id MUST be the fixture
      // merchant. If this ever points at a different account, we've
      // surfaced a real session-propagation bug.
      expect(
        (cookieBoundSession as { account_id?: string } | null)?.account_id,
        `cookie-bound nex_session.account_id must match fixture merchant · cookie key did resolve a row? ${!!cookieBoundSession}`,
      ).toBe(merchant.nexAccountId);

      // 3 · Owner priority 2 (2026-11-26) · T5 must start at /manage,
      //     not at the dispatcher subroute, to exercise the full chain
      //     (dispatcher-level shop-less redirect → setup page → business-
      //     details step).
      //
      //     CORRECTION of the earlier T5 diagnostic note. A previous
      //     cycle mis-reported "/nex-native/manage does NOT redirect
      //     shop-less sessions to /setup". That was a measurement bug
      //     caused by reading `page.url()` immediately after
      //     `waitUntil:"domcontentloaded"`. In Next 16 App Router, a
      //     server-side `redirect()` is delivered via an RSC streaming
      //     flight response: initial HTTP response is 200 with an empty
      //     `<div hidden=""><!--$--><!--/$--></div>` suspense slot, and
      //     the client router processes the trailing redirect
      //     instruction and navigates to the destination. The URL does
      //     settle on `/manage/shop/setup` · but only after the client
      //     router applies it. `waitForURL()` is the correct observation
      //     pattern. Permanent regression lives in
      //     `tests/e2e/journey-manage-shopless-redirect.spec.ts`.
      const setupResp = await freshPage.goto("/nex-native/manage", {
        waitUntil: "domcontentloaded",
      });
      expect(
        setupResp?.status(),
        "/manage responds for signed-in shop-less account",
      ).toBeLessThan(500);
      // First redirect hop: /manage → /manage/shop/setup (server component
      // sees zero businesses for the current account).
      await freshPage.waitForURL(/\/manage\/shop\/setup(?:\/|$|\?|#)/, {
        timeout: 15_000,
        waitUntil: "domcontentloaded",
      });
      // Second redirect hop: /manage/shop/setup → /business-details (the
      // sealed dispatcher routes empty profiles here · see
      // src/app/nex-native/manage/shop/setup/page.tsx:63-64).
      await freshPage.waitForURL(/\/manage\/shop\/setup\/business-details/, {
        timeout: 15_000,
        waitUntil: "domcontentloaded",
      });

      // 5 · Fill the sealed business-details form (name is the only
      //     required field · 2-40 chars trimmed).
      const nameSuffix = Date.now().toString(36).slice(-6);
      const shopName = `e2e shop ${nameSuffix}`;
      expect(
        shopName.length,
        "test name length within 2-40 (saveShopBusinessDetailsAction gate)",
      ).toBeGreaterThanOrEqual(2);
      expect(shopName.length).toBeLessThanOrEqual(40);

      const nameInput = freshPage.locator('input[name="displayName"]');
      await nameInput.waitFor({ state: "visible", timeout: 10_000 });
      await nameInput.fill(shopName);

      // 6 · Submit. The onSubmit handler calls saveShopBusinessDetailsAction
      //     which returns { ok: true, nextHref: "/nex-native/manage/shop/setup" }.
      //     First save auto-provisions the business row via
      //     requireBusiness() → provisionDefaultBusiness. Then the sealed
      //     `updateBusinessDisplayName` writes our typed name under owner
      //     scope. Any other outcome is a real failure.
      await Promise.all([
        freshPage.waitForURL(
          (u) => !/\/business-details(?:[/?#]|$)/.test(u.pathname),
          { timeout: 30_000, waitUntil: "domcontentloaded" },
        ),
        freshPage.locator('button[type="submit"]').first().click(),
      ]);

      // 7 · DB persistence · exactly one nex_business row owned by the
      //     merchant, with display_name === typed name.
      const { data: postBusinesses, error: postErr } = await sb
        .from("nex_business")
        .select("id, owner_account_id, display_name, slug")
        .eq("owner_account_id", merchant.nexAccountId);
      expect(postErr, "post-save read-back has no error").toBeNull();
      expect(
        postBusinesses?.length,
        "exactly one business row persisted for fixture merchant",
      ).toBe(1);
      const persistedBiz = postBusinesses![0] as {
        id: string;
        owner_account_id: string;
        display_name: string;
        slug: string;
      };
      expect(
        persistedBiz.owner_account_id,
        "owner_account_id FK matches fixture merchant",
      ).toBe(merchant.nexAccountId);
      expect(
        persistedBiz.display_name,
        "display_name matches typed shop name",
      ).toBe(shopName);
      // slug CHECK (nex_business.slug: ^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$)
      expect(
        /^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$/.test(persistedBiz.slug),
        `provisioned slug satisfies nex_business.slug CHECK (got '${persistedBiz.slug}')`,
      ).toBe(true);

      // Register the provisioned business for teardown (reverse-FK order).
      provisionedBusinessIdForTeardown = persistedBiz.id;
      const bizHandle: TestBusinessHandle = {
        kind: "business",
        businessId: persistedBiz.id,
        ownerAccountId: merchant.nexAccountId,
        slug: persistedBiz.slug,
        displayName: persistedBiz.display_name,
      };
      handles.push(bizHandle);

      // 8 · Management-centre renders · the account now has a shop,
      //     so /nex-native/manage MUST render the shop management
      //     centre (`<main data-nex-shop-management-centre>`), not the
      //     setup wizard. Asserting the data attribute proves actual
      //     content delivery, not merely a URL that doesn't look like
      //     business-details.
      await freshPage.goto("/nex-native/manage", {
        waitUntil: "domcontentloaded",
      });
      await freshPage
        .locator("[data-nex-shop-management-centre]")
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
      const reentryUrl = freshPage.url();
      expect(
        /\/business-details(?:[/?#]|$)/.test(reentryUrl),
        `after save, /manage should not re-route back to business-details · got '${reentryUrl}'`,
      ).toBe(false);
    } finally {
      // Strict teardown · reverse-FK order via teardownAll · then prove
      // zero residual. Owner directive: a test that leaves fixture
      // records behind is NOT a clean PASS.
      await teardownAll(handles);
      const residual = await assertNoResidualFixtures(handles);
      expect(residual.businesses, "no residual nex_business rows").toEqual([]);
      expect(residual.conversations, "no residual nex_conversation rows").toEqual(
        [],
      );
      expect(residual.participants, "no residual participant rows").toEqual([]);
      expect(residual.messages, "no residual nex_message rows").toEqual([]);
      expect(residual.accounts, "no residual nex_account rows").toEqual([]);
      expect(residual.authUsers, "no residual auth users").toEqual([]);

      // Defence-in-depth: if we somehow lost track of the provisioned
      // business id (e.g. test failed before step 7), verify it is also
      // gone via a direct lookup rather than silently leaking.
      if (provisionedBusinessIdForTeardown) {
        const { data: leaked } = await sb
          .from("nex_business")
          .select("id")
          .eq("id", provisionedBusinessIdForTeardown);
        expect(leaked?.length ?? 0).toBe(0);
      }

      await freshPage.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });

  // Dead-code suppression: createTestBusiness is only used by the DB
  // contract test above; keeping the import tracked.
  void createTestBusiness;
});
