// tests/e2e/journey-buyer-signup-wiring.spec.ts
//
// Cycle 9 · 2026-11-24 · JRN-buyer-signed-out-purchase-resume
//   workstream 3 · Signup wiring inspection · NON-MUTATING.
//
// Scope rails (Founder-sealed Cycle 9 brief):
//   · Inspect. Do NOT submit. Do NOT create a sandbox buyer.
//     The createNexAccountAction writes a real Supabase row and
//     requires Founder-approved sandbox credentials that do not
//     exist yet.
//   · Signup lives inside the single sign-in URL at
//     `/nex-native/sign-in?mode=signup&next=...`.
//   · Prelaunch mode (NEX_PRELAUNCH_MODE=true) hides signup. When
//     signup is hidden we classify BLOCKED-PRELAUNCH · not a defect.
//
// Observable contracts under test:
//   1. The signup form `[data-nex-sign-up-form]` renders when
//      `?mode=signup` is set AND prelaunch mode is off.
//   2. The hidden `next` input `[data-nex-sign-up-next]` carries the
//      product return URL verbatim after `safeNext` acceptance.
//   3. Required form fields are present and wired:
//        · `[data-nex-sign-up-input-name]`
//        · `[data-nex-sign-up-input-email]`
//        · `[data-nex-sign-up-input-password]`
//        · `[data-nex-sign-up-submit]`
//   4. Toggle back to sign-in (no `?mode=signup`) returns to the
//      sign-in form — the hidden `next` must round-trip.
//
// What this test does NOT prove:
//   · Signup submit → account created → email confirmation received
//     → return to product. That path requires a Founder-approved
//     sandbox buyer which does not exist (see decision brief).

import { expect, test } from "@playwright/test";

const PRODUCT_ID = process.env.NEX_E2E_SEED_PRODUCT_ID;
const PRODUCT_READY = typeof PRODUCT_ID === "string" && PRODUCT_ID.length > 0;

test.describe("Cycle 9 · signup form wiring (non-mutating)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("signup form · wiring + next-preservation · NO submit", async ({
    page,
  }) => {
    test.skip(
      !PRODUCT_READY,
      "BLOCKED-PENDING-SEED-FIXTURE · NEX_E2E_SEED_PRODUCT_ID required",
    );

    const nextPath = `/nex-native/product/${PRODUCT_ID}`;
    const resp = await page.goto(
      `/nex-native/sign-in?mode=signup&next=${encodeURIComponent(nextPath)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status(), "sign-in signup page responds").toBe(200);

    // Prelaunch gate: if signup is hidden (allowlist/prelaunch), we
    // record BLOCKED-PRELAUNCH without pretending wiring was proven.
    const form = page.locator("[data-nex-sign-up-form]");
    const formCount = await form.count();
    test.skip(
      formCount === 0,
      "BLOCKED-PRELAUNCH · signup form not rendered · likely " +
        "NEX_PRELAUNCH_MODE=true or allowlist gating is on",
    );

    await expect(form, "signup form visible when ?mode=signup").toBeVisible({
      timeout: 5_000,
    });

    // Hidden next must round-trip verbatim (safeNext accepted it
    // because the value is `/nex-native/product/...`).
    const hiddenNext = form.locator('input[type="hidden"][name="next"][data-nex-sign-up-next]');
    await expect(hiddenNext, "hidden next input present").toHaveCount(1);
    await expect(hiddenNext).toHaveAttribute("value", nextPath);

    // Required inputs wired.
    await expect(
      form.locator("[data-nex-sign-up-input-name]"),
      "full name input",
    ).toBeVisible();
    await expect(
      form.locator("[data-nex-sign-up-input-email]"),
      "email input",
    ).toBeVisible();
    await expect(
      form.locator("[data-nex-sign-up-input-password]"),
      "password input",
    ).toBeVisible();
    await expect(
      form.locator("[data-nex-sign-up-submit]"),
      "submit button",
    ).toBeVisible();

    // Critical scope rail: we do NOT click submit. Document the
    // observed terminal wiring state and stop.
  });

  test("signup mode toggle · ?mode=signup round-trips the `next` to sign-in form when mode is cleared", async ({
    page,
  }) => {
    test.skip(
      !PRODUCT_READY,
      "BLOCKED-PENDING-SEED-FIXTURE · NEX_E2E_SEED_PRODUCT_ID required",
    );

    const nextPath = `/nex-native/product/${PRODUCT_ID}`;

    // 1. Load signup mode and confirm signup wiring OR record
    //    BLOCKED-PRELAUNCH.
    const r1 = await page.goto(
      `/nex-native/sign-in?mode=signup&next=${encodeURIComponent(nextPath)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(r1?.status()).toBe(200);
    const signupForm = page.locator("[data-nex-sign-up-form]");
    const signupCount = await signupForm.count();
    test.skip(signupCount === 0, "BLOCKED-PRELAUNCH · signup hidden");

    // 2. Navigate to the plain sign-in URL with the same next value
    //    and assert the sign-in form (not signup) now owns the next.
    const r2 = await page.goto(
      `/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(r2?.status()).toBe(200);

    const signInForm = page.locator("[data-nex-sign-in-form]");
    await expect(signInForm).toBeVisible({ timeout: 5_000 });

    const siNext = signInForm.locator(
      'input[type="hidden"][name="next"][data-nex-sign-in-next]',
    );
    await expect(siNext).toHaveCount(1);
    await expect(siNext).toHaveAttribute("value", nextPath);

    // Signup form must not be mounted simultaneously.
    expect(
      await page.locator("[data-nex-sign-up-form]").count(),
      "signup form must not mount when ?mode=signup is absent",
    ).toBe(0);
  });
});
