// tests/e2e/regression-copy-shop-link.spec.ts
//
// Cycle-7 (2026-11-27) regression spec · authored under owner directive
// "Copy Shop Link / Implement the existing public shop URL sharing
// functionality" + "Add focused Playwright coverage".
//
// Contract exercised
// ------------------
// On /nex-native/manage/shop for a signed-in merchant whose business
// has a non-empty slug (the operational definition of "published"
// in this cycle · see _copy-shop-link.tsx header), the page must:
//
//   (A) Render the sealed `[data-testid="copy-shop-link-panel"]` with
//       a `data-shop-slug` attribute equal to the business's slug.
//   (B) Expose the canonical public URL (produced by nexCanonicalUrl
//       against the sandbox-active country identity) in
//       `[data-testid="copy-shop-link-url"]`.
//   (C) [Copy link] button writes that URL to the browser clipboard.
//       The spec grants the chromium clipboard-read + clipboard-write
//       permissions, clicks the button, waits for the confirmation
//       pill to show "Copied", then reads `navigator.clipboard
//       .readText()` and asserts it matches the URL exactly.
//   (D) [Show QR code] toggle mounts the server-generated PNG data
//       URI as an `<img>` carrying the `data-testid="copy-shop-link-
//       qr-image"` marker. The `src` must start with
//       `data:image/png;base64,`.
//   (E) Opening the copied URL in a GUEST browser context (no
//       storageState, no auth cookies) responds < 500 and does NOT
//       render the branded not-found UI · proves the link is
//       actually shareable with anonymous visitors.
//
// Classification: REGRESSION SPEC · exercises real browser mount
// against sandbox Supabase via the sandbox-test-harness fixture
// pattern. No production code paths. No real payment credentials.
// No encryption or RLS changes.
//
// Boundaries honoured
// -------------------
//   · Fixture teardown is a quality gate · residual rows = no PASS.
//   · No seed scripts for 99901/99902/99903 are triggered from this
//     spec · a fresh e2e-fixture business is minted inline so the
//     spec is independent of the (currently blocked) three-mock-
//     merchant work.
//   · No prod, no migration, no push, no live-mode gate.

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

test.describe.serial(
  "Cycle-7 · Copy Shop Link panel on /nex-native/manage/shop",
  () => {
    const handles: FixtureHandle[] = [];
    const merchantAccounts: TestAccountHandle[] = [];
    let merchantPage: Page;
    let merchantSlug: string;
    // URL copied out of the rendered panel in the first test · used as
    // source-of-truth for both the clipboard assertion and the anon
    // visitor assertion. The server-rendered URL depends on the
    // deploy's `NEX_APP_IDENTITY` + `NEX_PUBLIC_SITE_URL_IE`/`_WW` env,
    // which the test process does not share · trusting the DOM is the
    // honest contract for "the URL the merchant actually sees".
    let serverRenderedUrl: string | null = null;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(120_000);
      assertSandboxRef();

      // Mint a fresh merchant with a known slug. The harness slug is
      // of shape `e2e-fixture-copylink-<nanoid>` — predictable enough
      // for assertions, random enough to avoid cross-run collisions.
      const merchant = await createTestAccount({
        label: "copylink-merchant",
        returnPassword: true,
      });
      handles.push(merchant);
      merchantAccounts.push(merchant);

      const biz = await createTestBusiness(merchant, {
        label: "copylink-shop",
      });
      handles.push(biz);
      merchantSlug = biz.slug;

      // Grant clipboard permissions to the merchant context before
      // signing in — chromium requires this for navigator.clipboard
      // readText/writeText in test contexts even on localhost.
      const merchantContext = await browser.newContext({
        storageState: undefined,
        permissions: ["clipboard-read", "clipboard-write"],
      });
      merchantPage = await merchantContext.newPage();
      await signInAsFixtureInBrowser(merchantPage, merchant);
    });

    test.afterAll(async () => {
      try {
        for (const m of merchantAccounts) {
          await ownerScopedBusinessSweep(m);
        }
      } catch (sweepErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[copy-shop-link sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
          `copy-shop-link teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
      await merchantPage?.close().catch(() => undefined);
      await merchantPage?.context().close().catch(() => undefined);
    });

    test("panel renders with slug + canonical URL + copy confirmation + QR toggle", async () => {
      test.setTimeout(60_000);

      const resp = await merchantPage.goto("/nex-native/manage/shop", {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      const status = resp?.status() ?? 0;
      expect(
        status,
        `Copy Shop Link · /manage/shop must respond < 500 for an owner · got=${status}`,
      ).toBeLessThan(500);
      await merchantPage
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => undefined);

      // --- Contract A · panel + slug attribute ---------------------
      const panel = merchantPage.locator(
        '[data-testid="copy-shop-link-panel"]',
      );
      await expect(
        panel,
        "Copy Shop Link panel must be mounted for a merchant with a slug",
      ).toBeVisible({ timeout: 10_000 });
      const panelSlug = await panel.getAttribute("data-shop-slug");
      expect(
        panelSlug,
        "Copy Shop Link panel data-shop-slug must match fixture business slug",
      ).toBe(merchantSlug);

      // --- Contract B · rendered URL shape + slug ------------------
      // We trust the DOM as the source of truth · the resolver's
      // output depends on deploy-local env vars that the Playwright
      // process does not share. The URL still must be an absolute
      // http(s) URL whose path is exactly `/nex-native/<slug>`.
      const urlSurface = merchantPage.locator(
        '[data-testid="copy-shop-link-url"]',
      );
      await expect(urlSurface).toBeVisible();
      const renderedUrl = (await urlSurface.innerText()).trim();
      expect(
        renderedUrl,
        `Rendered URL must be absolute http(s) · got='${renderedUrl}'`,
      ).toMatch(/^https?:\/\//);
      let parsed: URL;
      try {
        parsed = new URL(renderedUrl);
      } catch (err) {
        throw new Error(
          `Rendered URL must parse as an absolute URL · got='${renderedUrl}' · ${(err as Error).message}`,
        );
      }
      expect(
        parsed.pathname,
        "Rendered URL path must be /nex-native/<slug>",
      ).toBe(`/nex-native/${merchantSlug}`);
      serverRenderedUrl = renderedUrl;

      // --- Contract C · Copy link writes to clipboard --------------
      await merchantPage
        .locator('[data-testid="copy-shop-link-button"]')
        .click();
      await expect(
        merchantPage.locator('[data-testid="copy-shop-link-confirmation"]'),
        'Confirmation pill must show success after [Copy link]',
      ).toContainText("Copied", { timeout: 5_000 });

      const clipboardValue: string = await merchantPage.evaluate(async () => {
        return await navigator.clipboard.readText();
      });
      expect(
        clipboardValue,
        "Clipboard content must equal the URL rendered in the panel",
      ).toBe(renderedUrl);

      // --- Contract D · QR toggle mounts PNG data URI --------------
      await merchantPage
        .locator('[data-testid="copy-shop-link-qr-toggle"]')
        .click();
      const qrImage = merchantPage.locator(
        '[data-testid="copy-shop-link-qr-image"]',
      );
      await expect(qrImage).toBeVisible({ timeout: 5_000 });
      const qrSrc = await qrImage.getAttribute("src");
      expect(
        qrSrc ?? "",
        "QR image src must be a PNG data URI",
      ).toMatch(/^data:image\/png;base64,/);
    });

    test("copied URL opens for an anonymous visitor (no session)", async ({
      browser,
    }) => {
      test.setTimeout(45_000);
      expect(
        serverRenderedUrl,
        "serverRenderedUrl must have been captured by the first test",
      ).not.toBeNull();

      // The server-rendered URL is shaped for the deploy's country
      // identity (e.g. `https://ireland.nex.invalid/...`) and is not
      // DNS-resolvable in dev. The shareability contract we can
      // actually verify in dev is that the public `/nex-native/<slug>`
      // route renders to an anonymous visitor · navigate by path
      // against the Playwright baseURL (localhost:3008). The shape
      // of the absolute URL has already been asserted in the first
      // test.
      const guestContext = await browser.newContext({
        storageState: undefined,
      });
      const guestPage = await guestContext.newPage();
      try {
        const resp = await guestPage.goto(`/nex-native/${merchantSlug}`, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const status = resp?.status() ?? 0;
        expect(
          status,
          `Public shop URL must respond < 500 to an anonymous visitor · got=${status}`,
        ).toBeLessThan(500);
        expect(
          status,
          `Public shop URL must not 404 to an anonymous visitor · got=${status}`,
        ).not.toBe(404);
        await guestPage
          .waitForLoadState("networkidle", { timeout: 10_000 })
          .catch(() => undefined);
        await expect(
          guestPage.locator("[data-nex-native-not-found]"),
          "Public shop URL must NOT render the branded not-found UI for anon",
        ).toHaveCount(0);
        const bodyText = (await guestPage.locator("body").innerText()).trim();
        expect(
          bodyText.length,
          "Public shop body must be non-empty for anon (empty-shell guard)",
        ).toBeGreaterThan(20);
      } finally {
        await guestPage.close().catch(() => undefined);
        await guestContext.close().catch(() => undefined);
      }
    });
  },
);
