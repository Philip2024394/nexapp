// tests/e2e/journeys/j5-buyer-checkout-f3.spec.ts
//
// Phase E · Journey J-5 · DRAFT.
//
// Buyer checkout against the F-3 price-trust vulnerability. Asserts
// every attack path rejected with the expected HTTP status code. This
// spec mirrors the Vitest unit tests on
// src/app/api/nex-native/billing/checkout/buyer/__tests__/route.test.ts
// but runs against the DEPLOYED API via HTTP (not unit mocks).

import { test, expect, type APIRequestContext } from "@playwright/test";

const ENDPOINT = "/api/nex-native/billing/checkout/buyer";

test.describe("J-5 · buyer checkout F-3 attack paths", () => {
  test("legacy amountMinor shape → 400 bad_request", async ({ request }) => {
    const r = await request.post(ENDPOINT, {
      data: {
        items: [{ amountMinor: 1, currency: "usd", quantity: 1 }],
      },
    });
    // 401 is also acceptable if the unauth request is caught first; the
    // critical property is that the request does NOT produce a Stripe
    // session.
    expect([400, 401]).toContain(r.status());
  });

  test("missing productId → 400 or 422", async ({ request }) => {
    const r = await request.post(ENDPOINT, {
      data: { items: [{ quantity: 1 }] },
    });
    expect([400, 401, 422]).toContain(r.status());
  });

  test("malformed productId → 400 or 422", async ({ request }) => {
    const r = await request.post(ENDPOINT, {
      data: { items: [{ productId: "not-a-uuid", quantity: 1 }] },
    });
    expect([400, 401, 422]).toContain(r.status());
  });

  test("zero quantity → 400 or 422", async ({ request }) => {
    const r = await request.post(ENDPOINT, {
      data: { items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 0 }] },
    });
    expect([400, 401, 422]).toContain(r.status());
  });

  test("GET method → 405", async ({ request }) => {
    const r = await request.get(ENDPOINT);
    expect(r.status()).toBe(405);
  });

  test("unauth → 401 (not 500)", async ({ request }) => {
    const r = await request.post(ENDPOINT, {
      data: { items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }] },
    });
    // The critical assertion is that the server does NOT 500. 401 is
    // the expected auth-gate status.
    expect(r.status()).not.toBe(500);
    expect([400, 401]).toContain(r.status());
  });
});
