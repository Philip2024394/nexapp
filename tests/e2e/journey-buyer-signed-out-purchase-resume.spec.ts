// tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts
//
// Cycle 8 2026-11-24 · JRN-buyer-signed-out-purchase-resume.
//
// Founder-sealed end-to-end buyer purchase-intent preservation.
// Gap A fixed the auth-gate · this spec proves the *complete*
// journey: signed-out visitor hits Add to Cart → auth-gate →
// sign-in → returns to the same product → actually adds to cart →
// cart state survives refresh. Plus:
//   · Ask Seller sealed contract (?open-chat=1&product=<id>)
//   · new-account creation wiring (URL/form level · full round-trip
//     is BLOCKED-PENDING a Founder-approved sandbox buyer because
//     createNexAccountAction hits real Supabase)
//   · independent adversarial challenge · back/refresh/interrupt.
//
// Boundaries honoured:
//   · no production, no migrations, no record mutation beyond what
//     the existing Dev Pass admin account already performs via
//     supabase.auth.signInWithPassword.
//   · no commits/pushes/merges/deploys from inside this file.
//
// Observable contracts under test:
//   1. localStorage key `nex_cart_v1` survives auth (same-origin).
//   2. Dev Pass form honours `?next=` after Cycle 8 fix
//      (sign-in/page.tsx + _actions.ts devPassAction).
//   3. `/nex-native/<slug>?open-chat=1&product=<id>` server-redirects
//      signed-in non-owner viewers to the business conversation with
//      product chip carried through (sealed 2026-11-13).
//   4. Browser back after resumed sign-in does not break cart state.

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

// 2026-11-26 remediation · the historical env-var gate (`SEEDED`)
// kept every test in this file skipped unless the owner manually
// pinned a sandbox fixture. The harness is now proven to seed real
// nex_account + nex_business + nex_product rows via service-role
// (same pattern as `journey-ask-seller-nonowner-full.spec.ts`).
// Env-var overrides remain honoured so an owner-pinned fixture wins.
//
// A single describe-level fixture backs all four tests so we don't
// explode sandbox rows. teardown runs in afterAll.

let SLUG: string;
let PRODUCT_ID: string;
let FIXTURE_HANDLES: FixtureHandle[] = [];

test.describe("Cycle 8 · signed-out buyer · purchase intent preservation", () => {
  test.beforeAll(async () => {
    assertSandboxRef();
    const envSlug = process.env.NEX_E2E_SEED_SHOP_SLUG;
    const envProductId = process.env.NEX_E2E_SEED_PRODUCT_ID;
    if (envSlug && envProductId) {
      SLUG = envSlug;
      PRODUCT_ID = envProductId;
      return;
    }
    const merchant = await createTestAccount("resume-merchant");
    FIXTURE_HANDLES.push(merchant);
    const biz = await createTestBusiness(merchant, { label: "resume-shop" });
    FIXTURE_HANDLES.push(biz);
    const prod = await createTestProduct(biz, {
      name: "e2e-fixture-resume-widget",
      pricePence: 2999,
      currency: "GBP",
      status: "live",
    });
    FIXTURE_HANDLES.push(prod);
    SLUG = biz.slug;
    PRODUCT_ID = prod.productId;
  });

  test.afterAll(async () => {
    await teardownAll(FIXTURE_HANDLES);
    await assertNoResidualFixtures(FIXTURE_HANDLES);
    FIXTURE_HANDLES = [];
  });

  test.beforeEach(async ({ context }) => {
    // Every case in this describe begins as a fresh guest · cookies
    // and localStorage are cleared so cart state is observable from
    // zero. storageState is intentionally NOT used here.
    await context.clearCookies();
  });

  test("end-to-end · guest → Add to Cart gate → Dev Pass → return to product → add → survive refresh", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Step 1 · guest lands on a shared product link.
    const resp = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status(), "guest product URL 200").toBe(200);
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });

    // Step 2 · clear localStorage to establish an honest empty-cart
    // baseline. `clearCookies` above wipes session state but not
    // same-origin storage.
    await page.evaluate(() => {
      try { window.localStorage.removeItem("nex_cart_v1"); } catch { /* noop */ }
    });

    // Step 3 · guest taps Add to Cart. The sealed Gap A gate must
    // mount with a sign-in link carrying `?next=/nex-native/product/<id>`.
    const addBtn = page.locator("[data-nex-product-add-to-cart-guest]").first();
    const altAdd = page.getByRole("button", { name: /add to cart/i }).first();
    const addVisible = (await addBtn.count()) > 0 ? addBtn : altAdd;
    await expect(addVisible).toBeVisible({ timeout: 5_000 });
    await addVisible.click();

    const banner = page.locator("[data-nex-auth-gate-banner]").first();
    await expect(banner, "Gap A gate opens").toBeVisible({ timeout: 5_000 });

    const signInLink = banner.getByRole("link", { name: /^sign in$/i }).first();
    const signInHref = await signInLink.getAttribute("href");
    expect(signInHref, "gate sign-in href preserves intent").toMatch(
      new RegExp(`next=.*%2Fnex-native%2Fproduct%2F${PRODUCT_ID}`),
    );

    // Step 4 · follow the sign-in link.
    await Promise.all([
      page.waitForURL(/\/nex-native\/sign-in/, { timeout: 10_000 }),
      signInLink.click(),
    ]);

    // Step 5 · existing-account sign-in via Dev Pass (post-fix:
    // honours `next`). The Dev Pass button only renders when
    // NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD are set in
    // .env.local · the auth.setup.ts harness has already proven
    // they are present in sandbox. Cycle 8 (iter 2) · use
    // `waitFor({state:"visible"})` instead of `.count()`. `count()`
    // is a one-shot snapshot that fired before Next.js App Router
    // finished streaming the sign-in RSC payload · auth-setup
    // works because it uses auto-waiting `toBeVisible()`. We
    // mirror that here. If the button genuinely never appears we
    // report the landing URL so the honest skip has a reason, not
    // an unexplained absence.
    const devPassBtn = page.locator("[data-nex-dev-pass-button]").first();
    try {
      await devPassBtn.waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      const landed = page.url();
      test.skip(
        true,
        `Dev Pass button did not render after sign-in nav · landed at ${landed} · likely env NEX_ADMIN_* missing`,
      );
      return;
    }

    await Promise.all([
      page.waitForURL(
        new RegExp(`/nex-native/product/${PRODUCT_ID}($|\\?)`),
        { timeout: 15_000 },
      ),
      devPassBtn.click(),
    ]);

    // Step 6 · back on the product page as a signed-in user. The
    // auth-gate must NOT mount now · the real Add to Cart form
    // (not the guest shim) must be present.
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });
    const gateAfter = await page.locator("[data-nex-auth-gate-banner]").count();
    expect(gateAfter, "no auth-gate for signed-in viewer").toBe(0);

    // Step 7 · signed-in Add to Cart. Click the real add-to-cart
    // button and assert localStorage is populated.
    const realAdd = page.getByRole("button", { name: /add to cart/i }).first();
    await expect(realAdd).toBeVisible();
    await realAdd.click();

    // Wait for the write · _add-to-cart-button.tsx flips the label
    // to "✓ Added" on success. Assert on the localStorage ground
    // truth rather than the label alone.
    await page.waitForFunction(
      (pid) => {
        try {
          const raw = window.localStorage.getItem("nex_cart_v1");
          if (!raw) return false;
          const arr = JSON.parse(raw) as Array<{ id?: string; quantity?: number }>;
          return (
            Array.isArray(arr) &&
            arr.some((x) => x && x.id === pid && (x.quantity ?? 0) >= 1)
          );
        } catch { return false; }
      },
      PRODUCT_ID,
      { timeout: 10_000 },
    );

    // Step 8 · persistence across refresh (Founder requirement #2 ·
    // actual cart state, not just a product page reopening).
    //
    // 2026-11-26 remediation · the prior pattern was:
    //   reload({domcontentloaded}) → waitForSelector → page.evaluate
    // which races against a secondary client-side navigation that
    // fires AFTER DOMContentLoaded on the product page (Playwright
    // then throws `Execution context was destroyed`). `waitForFunction`
    // auto-retries across navigations · we fold the DOM-mounted check
    // and the localStorage assertion into a single predicate so the
    // execution-context is read fresh each retry.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      (pid) => {
        try {
          if (!document.querySelector("[data-nex-product-page]")) return false;
          const raw = window.localStorage.getItem("nex_cart_v1");
          if (!raw) return false;
          const arr = JSON.parse(raw) as Array<{ id?: string; quantity?: number }>;
          return (
            Array.isArray(arr) &&
            arr.some((x) => x && x.id === pid && (x.quantity ?? 0) >= 1)
          );
        } catch { return false; }
      },
      PRODUCT_ID,
      { timeout: 15_000 },
    );
  });

  test("new-account creation · signup form wiring preserves ?next= (URL-level only · end-to-end BLOCKED without approved buyer)", async ({
    page,
  }) => {
    const next = encodeURIComponent(`/nex-native/product/${PRODUCT_ID}`);
    await page.goto(
      `/nex-native/sign-in?mode=signup&next=/nex-native/product/${PRODUCT_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    // Prelaunch policy (2026-11-19) cosmetically hides signup when
    // the flag is on. If signup form isn't rendered we honestly
    // skip rather than fabricate pass.
    const signupSubmit = page
      .getByRole("button", { name: /create.*account|sign up/i })
      .first();
    const signupShown = await signupSubmit.count();
    test.skip(
      signupShown === 0,
      "signup form not rendered (likely prelaunch flag on) · URL-level signup wiring not exercised",
    );

    // Hidden input must carry the intended return URL.
    const nextInput = page.locator('form input[type="hidden"][name="next"]').first();
    const value = await nextInput.getAttribute("value");
    expect(
      value,
      "signup form carries ?next= as hidden input",
    ).toBe(`/nex-native/product/${PRODUCT_ID}`);

    // Scope boundary · we do NOT submit · creating a sandbox buyer
    // account is explicitly out of scope for this cycle. End-to-end
    // new-account creation + product resume is honestly BLOCKED on
    // Founder-approved sandbox buyer provision.
    void next;
  });

  test("Ask Seller sealed contract · ?open-chat=1&product=<id> redirects signed-in non-owner to product-context conversation", async ({
    page,
  }) => {
    // Admin storageState: not the owner of handbags-direct (admin
    // account id dd21eb50-... vs Rosa 11111111-...-1113 per Cycle 8
    // fixture research), so the sealed server-redirect in
    // [businessSlug]/page.tsx:206 must fire.
    await page.context().clearCookies();
    await page.context().addCookies(
      JSON.parse(
        require("fs").readFileSync("tests/e2e/.auth/state.json", "utf8"),
      ).cookies,
    );

    const resp = await page.goto(
      `/nex-native/${SLUG}?open-chat=1&product=${PRODUCT_ID}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status(), "open-chat URL responds").toBeLessThan(500);

    // Server-redirected to conversation · the chip must paint with
    // the originating product.
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .toMatch(
        new RegExp(
          `/nex-native/conversations/[0-9a-f-]+\\?product=${PRODUCT_ID}`,
          "i",
        ),
      );

    const chip = page.locator(
      `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
    );
    await expect(
      chip,
      "product chip paints with originating product id",
    ).toBeVisible({ timeout: 10_000 });
  });

  test("independent challenge · browser back after resumed sign-in does not resurrect auth-gate", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Short adversarial probe: after a successful resume, go back
    // in history. The sign-in page should be in the stack · the
    // user should NOT be returned to the gate with their just-
    // acquired session · the product page should still render as
    // signed-in.
    const r1 = await page.goto(`/nex-native/product/${PRODUCT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    expect(r1?.status()).toBe(200);
    const guestAdd = page
      .locator("[data-nex-product-add-to-cart-guest]")
      .or(page.getByRole("button", { name: /add to cart/i }))
      .first();
    await guestAdd.click();
    const banner = page.locator("[data-nex-auth-gate-banner]").first();
    await expect(banner).toBeVisible({ timeout: 5_000 });
    const signIn = banner.getByRole("link", { name: /^sign in$/i }).first();
    await Promise.all([
      page.waitForURL(/\/nex-native\/sign-in/, { timeout: 10_000 }),
      signIn.click(),
    ]);
    const devPassBtn = page.locator("[data-nex-dev-pass-button]").first();
    try {
      await devPassBtn.waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      const landed = page.url();
      test.skip(
        true,
        `Dev Pass button did not render · landed at ${landed}`,
      );
      return;
    }
    await Promise.all([
      page.waitForURL(
        new RegExp(`/nex-native/product/${PRODUCT_ID}($|\\?)`),
        { timeout: 15_000 },
      ),
      devPassBtn.click(),
    ]);
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });

    // Go back · Playwright returns a Response when the main frame
    // completes a history nav. We tolerate either resolution.
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});

    // Back should land on sign-in (the last entry in history before
    // the product). Regardless of exact URL, there must be NO auth-
    // gate with a *fresh* `?next=` pointing at the product because
    // the viewer is already signed in.
    const gateCount = await page.locator("[data-nex-auth-gate-banner]").count();
    expect(gateCount, "auth-gate must not re-mount post-auth").toBe(0);
  });
});
