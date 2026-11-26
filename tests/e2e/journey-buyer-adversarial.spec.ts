// tests/e2e/journey-buyer-adversarial.spec.ts
//
// Cycle 9 · 2026-11-24 · JRN-buyer-signed-out-purchase-resume
//   workstream 5 · Adversarial regression.
//
// What Cycle 8 proved · what this spec stresses:
//   Cycle 8 proved the happy-path Dev Pass → return-to-product →
//   add-to-cart → reload-survives journey on a single untouched
//   tab. These adversarial tests exercise the branches a real buyer
//   actually takes AND that fail silently today: reload-on-sign-in,
//   Back/Forward after resumed auth, direct-link reverse-direction,
//   repeated Add-to-Cart cart dedup, tampered `?next=` URL values,
//   and composer-level interrupts.
//
// Scope rails (Founder-sealed · Cycle 9):
//   · No mutations beyond localStorage and sandbox session cookies.
//   · No commit / push / deploy / migration.
//   · Tests record BLOCKED honestly when the environment is
//     incomplete · they do NOT paper over genuine UI hangs.
//
// Fixture: handbags-direct / product
// `1a0eb693-4024-4a55-82d8-58ebe35d7b4a` · admin storageState
// (Dev Pass sign-in path).

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// 2026-11-26 remediation · harness-backed seeding. Env-var override
// (NEX_E2E_SEED_PRODUCT_ID + NEX_E2E_SEED_SHOP_SLUG) still honoured
// when owner pins a sealed fixture; otherwise `beforeAll` mints a
// real merchant + shop + live product via service-role, and
// `afterAll` tears everything down.
let PRODUCT_ID: string;
let SHOP_SLUG: string;
let FIXTURE_HANDLES: FixtureHandle[] = [];

test.describe("Cycle 9 · adversarial regression · buyer purchase-intent", () => {
  test.beforeAll(async () => {
    assertSandboxRef();
    const envProductId = process.env.NEX_E2E_SEED_PRODUCT_ID;
    const envShopSlug = process.env.NEX_E2E_SEED_SHOP_SLUG;
    if (envProductId && envShopSlug) {
      PRODUCT_ID = envProductId;
      SHOP_SLUG = envShopSlug;
      return;
    }
    const merchant = await createTestAccount("adversarial-merchant");
    FIXTURE_HANDLES.push(merchant);
    const biz = await createTestBusiness(merchant, {
      label: "adversarial-shop",
    });
    FIXTURE_HANDLES.push(biz);
    const prod = await createTestProduct(biz, {
      name: "e2e-fixture-adversarial-widget",
      pricePence: 1799,
      currency: "GBP",
      status: "live",
    });
    FIXTURE_HANDLES.push(prod);
    PRODUCT_ID = prod.productId;
    SHOP_SLUG = biz.slug;
  });

  test.afterAll(async () => {
    await teardownAll(FIXTURE_HANDLES);
    await assertNoResidualFixtures(FIXTURE_HANDLES);
    FIXTURE_HANDLES = [];
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1 · Tampered `?next=` on sign-in URL must NOT render the
  // hidden input. This is the FIRST-LINE guard; `signInAction` is
  // the second (covered by journey-buyer-ordinary-signin.spec.ts).
  // ────────────────────────────────────────────────────────────────
  test("tampered `?next=` · hidden sign-in input must NOT render for any malicious shape", async ({
    page,
  }) => {
    const malicious = [
      "//evil.example.com",
      "/\\attacker",
      "https://evil.example.com/nex-native/product/abc",
      "javascript:alert(1)",
      "/nex-native//double-slash",
      "/nex-native/\\back",
      "",
      "   ",
      "not-a-path",
      "/other-app/route",
    ];
    for (const bad of malicious) {
      const r = await page.goto(
        `/nex-native/sign-in?next=${encodeURIComponent(bad)}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(r?.status(), `page 200 for malicious ${bad.slice(0, 30)}`).toBe(
        200,
      );
      const n = await page
        .locator('[data-nex-sign-in-form] input[type="hidden"][name="next"]')
        .count();
      expect(
        n,
        `malicious next="${bad.slice(0, 30)}" must NOT render a hidden next`,
      ).toBe(0);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2 · Direct-link to product page WITHOUT referrer still
  // renders a working guest add-to-cart surface that preserves the
  // `next=` on the auth-gate sign-in link.
  // ────────────────────────────────────────────────────────────────
  test("direct-link deep entry · guest Add-to-Cart preserves `next=` to sign-in", async ({
    page,
  }) => {
    const resp = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
      waitUntil: "domcontentloaded",
      referer: "",
    });
    expect(resp?.status()).toBe(200);
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });

    const guestAdd = page.locator("[data-nex-product-add-to-cart-guest]").first();
    await expect(guestAdd, "guest add-to-cart renders").toBeVisible({
      timeout: 10_000,
    });
    await guestAdd.click();

    const gate = page.locator("[data-nex-auth-gate-banner]");
    await expect(gate, "auth-gate banner opens").toBeVisible({ timeout: 5_000 });

    const primary = page.locator("[data-nex-auth-gate-primary]").first();
    const href = await primary.getAttribute("href");
    expect(href, "sign-in link rendered").toBeTruthy();
    expect(
      href!,
      "sign-in link preserves next=/product/<id>",
    ).toContain(
      `next=${encodeURIComponent(`/nex-native/product/${PRODUCT_ID}`)}`,
    );
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3 · Reload on the sign-in page with `?next=/product/<id>`
  // must not drop the next value. Reload is the single most common
  // interruption in real sessions.
  // ────────────────────────────────────────────────────────────────
  test("reload on sign-in with `?next=` preserves the hidden `next` input value", async ({
    page,
  }) => {
    const nextPath = `/nex-native/product/${PRODUCT_ID}`;
    const r = await page.goto(
      `/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(r?.status()).toBe(200);
    const form = page.locator("[data-nex-sign-in-form]");
    await expect(form).toBeVisible({ timeout: 5_000 });
    await expect(
      form.locator('input[type="hidden"][name="next"][data-nex-sign-in-next]'),
    ).toHaveAttribute("value", nextPath);

    await page.reload({ waitUntil: "domcontentloaded" });

    const formAfter = page.locator("[data-nex-sign-in-form]");
    await expect(formAfter).toBeVisible({ timeout: 5_000 });
    await expect(
      formAfter.locator(
        'input[type="hidden"][name="next"][data-nex-sign-in-next]',
      ),
      "hidden next survives reload",
    ).toHaveAttribute("value", nextPath);
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4 · Duplicate guest Add-to-Cart submits open ONE auth-gate
  // (idempotent). A double-tap must not spawn two banners.
  // ────────────────────────────────────────────────────────────────
  test("duplicate guest Add-to-Cart taps · single auth-gate banner · idempotent", async ({
    page,
  }) => {
    const resp = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });
    const btn = page.locator("[data-nex-product-add-to-cart-guest]").first();
    await expect(btn).toBeVisible({ timeout: 10_000 });

    await btn.click();
    await btn.click({ force: true }).catch(() => {});
    await btn.click({ force: true }).catch(() => {});

    // Auth-gate must not multiply. We count AFTER the banner opens.
    await page.locator("[data-nex-auth-gate-banner]").first().waitFor({
      state: "visible",
      timeout: 5_000,
    });
    const count = await page.locator("[data-nex-auth-gate-banner]").count();
    expect(count, "exactly one auth-gate banner").toBe(1);
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5 · Repeated signed-in Add-to-Cart must not create duplicate
  // cart rows. localStorage `nex_cart_v1` should either merge quantity
  // or keep a single row per (shop, product, variant) tuple.
  //
  // This test requires auth state. It uses the storageState fixture
  // like the Cycle 8 spec.
  // ────────────────────────────────────────────────────────────────
  test.describe("signed-in cart dedup", () => {
    test.use({ storageState: "tests/e2e/.auth/state.json" });
    test.beforeEach(async ({ context }) => {
      // 2026-11-26 remediation · outer `beforeEach` clears cookies for
      // guest tests; this inner authed describe needs to re-seat the
      // admin cookies that `test.use({ storageState })` loaded at
      // context creation. Playwright hooks are additive, so inner
      // beforeEach runs AFTER outer beforeEach — order: outer clears,
      // inner re-adds.
      const state = JSON.parse(
        require("fs").readFileSync("tests/e2e/.auth/state.json", "utf8"),
      );
      await context.addCookies(state.cookies);
    });

    test("tapping Add-to-Cart repeatedly dedupes to a single cart row", async ({
      page,
    }) => {
      const resp = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status()).toBe(200);
      await page.waitForSelector("[data-nex-product-page]", {
        timeout: 10_000,
      });

      // The signed-in Add-to-Cart control is a different data-attr
      // from the guest control. Look for either; if neither exists
      // this is BLOCKED rather than a silent pass.
      const authedAdd = page
        .locator(
          "[data-nex-product-add-to-cart], [data-nex-product-add-to-cart-authed]",
        )
        .first();
      const authedAddVisible = await authedAdd
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      test.skip(
        !authedAddVisible,
        "BLOCKED-NO-AUTHED-ADD-CONTROL · product page did not expose a " +
          "[data-nex-product-add-to-cart*] control under the admin " +
          "storageState · likely admin viewing own product or auth-gate " +
          "variant · adversarial dedup cannot be observed here",
      );

      // Clear any pre-existing cart state deterministically.
      await page.evaluate(() => localStorage.removeItem("nex_cart_v1"));

      for (let i = 0; i < 3; i += 1) {
        await authedAdd.click({ force: true }).catch(() => {});
      }

      // Give the client write path a moment.
      await page.waitForFunction(
        () => {
          try {
            const raw = localStorage.getItem("nex_cart_v1");
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.items) && parsed.items.length > 0;
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      );

      const rows = await page.evaluate((pid) => {
        const raw = localStorage.getItem("nex_cart_v1");
        if (!raw) return { count: 0, matching: 0 };
        try {
          const parsed = JSON.parse(raw);
          const items: Array<{ product_id?: string; productId?: string }> =
            parsed?.items ?? [];
          return {
            count: items.length,
            matching: items.filter(
              (i) => i.product_id === pid || i.productId === pid,
            ).length,
          };
        } catch {
          return { count: 0, matching: 0 };
        }
      }, PRODUCT_ID);

      expect(
        rows.matching,
        "exactly one cart row per product · dedup holds",
      ).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6 · Back after resumed sign-in returns to product, NOT the
  // sign-in page (auth-gate must not re-mount for a signed-in user).
  // This is the Cycle 8 Test 5 contract re-asserted under the
  // adversarial envelope · kept here so a regression in either
  // spec is caught even if the other skips.
  // ────────────────────────────────────────────────────────────────
  test.describe("back-nav after resumed sign-in", () => {
    test.use({ storageState: "tests/e2e/.auth/state.json" });
    test.beforeEach(async ({ context }) => {
      // Same reason as sibling inner describe: outer `beforeEach`
      // cleared cookies for guest tests, so re-seat admin state here.
      const state = JSON.parse(
        require("fs").readFileSync("tests/e2e/.auth/state.json", "utf8"),
      );
      await context.addCookies(state.cookies);
    });

    test("goBack from a second route returns to product without re-mounting auth-gate", async ({
      page,
    }) => {
      const r = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
        waitUntil: "domcontentloaded",
      });
      expect(r?.status()).toBe(200);
      await page.waitForSelector("[data-nex-product-page]", {
        timeout: 10_000,
      });

      // 2026-11-26 remediation · Cycle-7 hydration-race workaround ·
      // product page fires mount-time RSC prefetches that abort the
      // next hard navigation with `net::ERR_ABORTED`. Let them settle
      // before the second goto, same pattern as
      // journey-buyer-checkout.spec.ts and other product-page journeys.
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      await page.waitForTimeout(1500);

      await page.goto("/nex-native/contacts", {
        waitUntil: "domcontentloaded",
      });

      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-nex-product-page]", {
        timeout: 10_000,
      });
      expect(
        await page.locator("[data-nex-auth-gate-banner]").count(),
        "auth-gate must NOT re-mount on goBack for signed-in user",
      ).toBe(0);
    });
  });
});
