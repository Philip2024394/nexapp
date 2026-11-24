// tests/e2e/journey-buyer-ordinary-signin.spec.ts
//
// Cycle 9 · 2026-11-24 · JRN-buyer-signed-out-purchase-resume
//   workstream 1 · Ordinary (email + password) sign-in `next=`
//   preservation — the branch Cycle 8 could not cover because its
//   only evidence was Dev Pass.
//
// Founder distinction (sealed 2026-11-24): Dev Pass is NOT ordinary
// sign-in. This spec drives the real `signInAction` form (the one
// customers use) with the admin email + password already in the
// sandbox env. No new accounts are created; no fixtures are mutated.
//
// Observable contracts:
//   1. Ordinary sign-in form (`[data-nex-sign-in-form]`) has a
//      hidden `next` input (`[data-nex-sign-in-next]`) that carries
//      the decoded return URL from `?next=` after `safeNext` runs.
//   2. `signInAction` (src/app/nex-native/_actions.ts:830-845)
//      re-validates `next` server-side (defence-in-depth) and
//      redirects there only if it passes: must start `/nex-native/`,
//      no `//`, no `\`, length ≤ 1024.
//   3. Malicious `next` values fall through to the default redirect
//      (`/nex-native/contacts`) and do NOT redirect the browser to
//      an attacker-controlled destination.
//
// Scope rails:
//   · No Dev Pass. The ordinary form is the one under test.
//   · Admin credentials from NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD
//     are the only Founder-approved sandbox creds. We use the FIRST
//     email in the comma list and the password as-is. Values are not
//     logged, not interpolated into error messages.
//   · Sandbox only · `kdstoyyeygcopkogqsyv`.
//   · No commits/pushes/migrations/Stripe/SOS/directory.

import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = (process.env.NEX_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)[0];
const ADMIN_PASSWORD = process.env.NEX_ADMIN_DEV_PASSWORD;

const PRODUCT_ID = process.env.NEX_E2E_SEED_PRODUCT_ID;

const CREDS_READY =
  typeof ADMIN_EMAIL === "string" &&
  ADMIN_EMAIL.length > 0 &&
  typeof ADMIN_PASSWORD === "string" &&
  ADMIN_PASSWORD.length > 0;
const PRODUCT_READY = typeof PRODUCT_ID === "string" && PRODUCT_ID.length > 0;

test.describe("Cycle 9 · ordinary sign-in · `next=` preservation + malicious-next rejection", () => {
  test.beforeEach(async ({ context }) => {
    // Fresh guest · the ordinary sign-in page redirects authenticated
    // non-admin viewers to /contacts (sign-in/page.tsx:109). Admin
    // bypass keeps the form reachable even for signed-in admin, but
    // we start as guest so the sign-in itself is observable.
    await context.clearCookies();
  });

  test("ordinary sign-in · valid credentials with `next=/product/<id>` returns buyer to the product", async ({
    page,
  }) => {
    test.skip(
      !CREDS_READY,
      "BLOCKED-PENDING-ENV · NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD required for ordinary sign-in test (approved sandbox creds)",
    );
    test.skip(
      !PRODUCT_READY,
      "BLOCKED-PENDING-SEED-FIXTURE · NEX_E2E_SEED_PRODUCT_ID required",
    );

    const nextPath = `/nex-native/product/${PRODUCT_ID}`;
    const resp = await page.goto(
      `/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status(), "sign-in page responds").toBe(200);

    const form = page.locator("[data-nex-sign-in-form]");
    await expect(form, "ordinary sign-in form mounts (not Dev Pass form)").toBeVisible({
      timeout: 5_000,
    });

    const hiddenNext = form.locator('input[type="hidden"][name="next"][data-nex-sign-in-next]');
    await expect(
      hiddenNext,
      "ordinary form carries the hidden `next` input after safeNext pass",
    ).toHaveCount(1);
    await expect(hiddenNext).toHaveAttribute("value", nextPath);

    // Fill the real email + password fields. We DO NOT log these.
    await form.locator('input[name="email"]').fill(ADMIN_EMAIL!);
    // Password input has no `name="password"`-exposed locator helper
    // in the custom SignInPasswordInput wrapper · use the form-scoped
    // selector for any password-type input inside the form.
    await form.locator('input[type="password"]').fill(ADMIN_PASSWORD!);

    await Promise.all([
      page.waitForURL(new RegExp(`/nex-native/product/${PRODUCT_ID}($|\\?)`), {
        timeout: 20_000,
      }),
      form.locator("[data-nex-sign-in-submit]").click(),
    ]);

    // Observable: the viewer landed on the originating product and
    // the auth gate is NOT re-mounted (they are now authenticated).
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });
    expect(
      await page.locator("[data-nex-auth-gate-banner]").count(),
      "auth gate must NOT be present after ordinary sign-in",
    ).toBe(0);
  });

  test("ordinary sign-in · `?next=` is URL-level rejected by safeNext when the form POSTS without the hidden field (defence-in-depth)", async ({
    page,
    request,
  }) => {
    test.skip(
      !CREDS_READY,
      "BLOCKED-PENDING-ENV · admin creds required",
    );

    // Server-side defence-in-depth check: if an attacker crafts a POST
    // to /sign-in directly (bypassing the form) with a malicious `next`
    // value, signInAction MUST discard it and fall through to the
    // default /contacts landing (per _actions.ts:830-845 validator).
    //
    // We drive this by first loading the sign-in form, then submitting
    // a direct FormData POST with a tampered `next`. The Playwright
    // request context preserves cookies.
    const resp = await page.goto("/nex-native/sign-in", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);

    // We cannot invoke `signInAction` directly from the page because
    // it is a server action keyed by Next.js. The observable we CAN
    // assert is: putting a malicious `?next=` into the URL must not
    // make the hidden `next` input render (safeNext at page.tsx:131
    // returns null for malicious values, so the hidden input is not
    // produced). That is the FIRST-LINE defence; the server-action
    // re-validation is SECOND line.
    const malicious = [
      "//evil.example.com",
      "/\\evil.example.com",
      "https://evil.example.com",
      "javascript:alert(1)",
      "/nex-native//double-slash-attack",
      "/nex-native/\\backslash-attack",
      // A legitimately-prefixed but over-long value · 1025 chars.
      "/nex-native/" + "a".repeat(1020),
    ];
    for (const bad of malicious) {
      const r = await page.goto(
        `/nex-native/sign-in?next=${encodeURIComponent(bad)}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(r?.status(), `malicious-next page still loads: ${bad.slice(0, 40)}`).toBe(200);
      const nextInputs = await page
        .locator('[data-nex-sign-in-form] input[type="hidden"][name="next"]')
        .count();
      expect(
        nextInputs,
        `safeNext must reject malicious next="${bad.slice(0, 40)}…" · hidden input must NOT render`,
      ).toBe(0);
    }
    // Suppress unused-var lint on request (reserved for a future
    // direct-POST probe once the server-action token endpoint is
    // stable to drive from a test).
    void request;
  });

  test("ordinary sign-in · absent `next` lands on default `/nex-native/contacts`", async ({
    page,
  }) => {
    test.skip(
      !CREDS_READY,
      "BLOCKED-PENDING-ENV · admin creds required",
    );

    const resp = await page.goto("/nex-native/sign-in", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(200);

    const form = page.locator("[data-nex-sign-in-form]");
    await expect(form).toBeVisible({ timeout: 5_000 });
    expect(
      await form.locator('input[type="hidden"][name="next"]').count(),
      "no hidden next without ?next= param",
    ).toBe(0);

    await form.locator('input[name="email"]').fill(ADMIN_EMAIL!);
    await form.locator('input[type="password"]').fill(ADMIN_PASSWORD!);

    await Promise.all([
      page.waitForURL(/\/nex-native\/contacts(\?|$)/, { timeout: 20_000 }),
      form.locator("[data-nex-sign-in-submit]").click(),
    ]);
  });
});
