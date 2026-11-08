// src/app/api/nex-native/billing/checkout/buyer/__tests__/route.test.ts
//
// Phase 1 · F-3 · Buyer checkout price-trust vulnerability fix · 2026-11-09.
// Verifies the server-side product resolution guarantees that a buyer
// cannot influence Stripe unit_amount via a crafted request body.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted makes these shared mocks available to the vi.mock factories
// despite vitest hoisting vi.mock() calls to the top of the file.
// Vitest's own hoisting handles `vi.fn()` references inside the factory.
const mocks = vi.hoisted(() => ({
  stripeCreate: vi.fn(),
  resolveSession: vi.fn(),
  getBusinessById: vi.fn(),
  getProductById: vi.fn(),
  readLocalConnectStatus: vi.fn(),
}));

// Convenience aliases used throughout the suite.
const mockStripeCreate = mocks.stripeCreate;
const mockResolveSession = mocks.resolveSession;
const mockGetBusinessById = mocks.getBusinessById;
const mockGetProductById = mocks.getProductById;
const mockReadLocalConnectStatus = mocks.readLocalConnectStatus;

// Mock Stripe · the module default export must be a constructor.
vi.mock("stripe", () => {
  class StripeMock {
    public checkout = { sessions: { create: mocks.stripeCreate } };
    constructor(_key: string, _opts?: unknown) {}
  }
  return { default: StripeMock };
});

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: (...args: unknown[]) => mocks.resolveSession(...args),
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  getBusinessById: (id: string) => mocks.getBusinessById(id),
}));

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: (id: string) => mocks.getProductById(id),
}));

vi.mock("@/lib/nex-native/billing/stripe-connect-service", () => ({
  readLocalConnectStatus: (id: string) => mocks.readLocalConnectStatus(id),
}));

// Mutable env for Stripe key
const ORIGINAL_ENV = process.env;

const BUYER_SESSION = {
  account: { id: "11111111-aaaa-4aaa-aaaa-111111111111" },
};
const BUSINESS_ID = "22222222-bbbb-4bbb-bbbb-222222222222";
const OTHER_BUSINESS_ID = "33333333-cccc-4ccc-cccc-333333333333";
const PRODUCT_A_ID = "44444444-dddd-4ddd-dddd-444444444444";
const PRODUCT_B_ID = "55555555-eeee-4eee-eeee-555555555555";

function buildReq(body: unknown): import("next/server").NextRequest {
  const url = "http://localhost:3008/api/nex-native/billing/checkout/buyer";
  const req = new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // originFromRequest reads these first before falling back to nextUrl,
      // which is undefined on a plain Request.
      "x-forwarded-proto": "http",
      "x-forwarded-host": "localhost:3008",
      host: "localhost:3008",
    },
    body: JSON.stringify(body),
  });
  return req as unknown as import("next/server").NextRequest;
}

async function invokePost(body: unknown) {
  // Import inside each call so the vi.mock() hoisting applies fresh state.
  const mod = await import("../route");
  const req = buildReq(body);
  const res = await mod.POST(req);
  const json = await res.json();
  return { status: res.status, json };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, STRIPE_SECRET_KEY: "sk_test_fake_key" };
  mockResolveSession.mockResolvedValue(BUYER_SESSION);
  mockGetBusinessById.mockResolvedValue({
    id: BUSINESS_ID,
    slug: "test-shop",
    display_name: "Test Shop",
  });
  mockReadLocalConnectStatus.mockResolvedValue({
    accountId: "acct_test_connected",
    chargesEnabled: true,
    payoutsEnabled: true,
  });
  mockStripeCreate.mockResolvedValue({
    id: "cs_test_fake",
    url: "https://checkout.stripe.com/test/session",
  });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("Phase 1 F-3 · buyer checkout price-trust fix", () => {
  describe("request shape validation", () => {
    it("rejects legacy shape with amountMinor + currency (no productId)", async () => {
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [
          { name: "Attack", amountMinor: 1, currency: "eur", quantity: 1 },
        ],
      });
      expect(status).toBe(400);
      expect(json.code).toBe("bad_request");
      expect(mockGetProductById).not.toHaveBeenCalled();
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it("rejects malformed productId", async () => {
      const { status } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: "not-a-uuid", quantity: 1 }],
      });
      expect(status).toBe(400);
      expect(mockGetProductById).not.toHaveBeenCalled();
    });

    it("rejects malformed businessId", async () => {
      const { status } = await invokePost({
        businessId: "not-a-uuid",
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(400);
    });

    it("rejects zero-quantity line item", async () => {
      const { status } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 0 }],
      });
      expect(status).toBe(400);
    });

    it("rejects duplicate productId in cart", async () => {
      const { status } = await invokePost({
        businessId: BUSINESS_ID,
        items: [
          { productId: PRODUCT_A_ID, quantity: 1 },
          { productId: PRODUCT_A_ID, quantity: 2 },
        ],
      });
      expect(status).toBe(400);
    });

    it("rejects empty items array", async () => {
      const { status } = await invokePost({
        businessId: BUSINESS_ID,
        items: [],
      });
      expect(status).toBe(400);
    });
  });

  describe("server-side product resolution", () => {
    it("fetches product by productId and uses server price_pence (not client)", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Real Product",
        price_pence: 10000, // €100.00
        currency: "EUR",
        status: "live",
        stock_status: null,
      });

      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });

      expect(status).toBe(200);
      expect(json.ok).toBe(true);
      expect(mockGetProductById).toHaveBeenCalledWith(PRODUCT_A_ID);
      // Critical assertion: Stripe received the server-resolved amount,
      // not any client-supplied amount.
      const stripeArgs = mockStripeCreate.mock.calls[0][0];
      expect(stripeArgs.line_items[0].price_data.unit_amount).toBe(10000);
      expect(stripeArgs.line_items[0].price_data.currency).toBe("eur");
      expect(stripeArgs.line_items[0].price_data.product_data.name).toBe(
        "Real Product",
      );
    });

    it("returns 404 when productId does not resolve", async () => {
      mockGetProductById.mockResolvedValue(null);
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(404);
      expect(json.code).toBe("product_not_found");
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it("rejects product owned by different business (cross-business injection)", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: OTHER_BUSINESS_ID, // different from body.businessId
        name: "Not Yours",
        price_pence: 1,
        currency: "EUR",
        status: "live",
        stock_status: null,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(400);
      expect(json.code).toBe("product_business_mismatch");
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it("rejects draft product (not purchaseable)", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Draft",
        price_pence: 10000,
        currency: "EUR",
        status: "draft",
        stock_status: null,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(409);
      expect(json.code).toBe("product_not_purchaseable");
    });

    it("rejects archived product", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Old",
        price_pence: 10000,
        currency: "EUR",
        status: "archived",
        stock_status: null,
      });
      const { status } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(409);
    });

    it("rejects sold-out product", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Gone",
        price_pence: 10000,
        currency: "EUR",
        status: "live",
        stock_status: "sold_out",
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(409);
      expect(json.code).toBe("product_sold_out");
    });

    it("rejects product with unsupported currency", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Yen Item",
        price_pence: 10000,
        currency: "JPY", // not in ALLOWED_CURRENCIES
        status: "live",
        stock_status: null,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(422);
      expect(json.code).toBe("unsupported_currency");
    });

    it("rejects product with out-of-range price", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID,
        business_id: BUSINESS_ID,
        name: "Too Much",
        price_pence: 100_000_001, // > MAX_UNIT_AMOUNT_MINOR
        currency: "EUR",
        status: "live",
        stock_status: null,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(422);
      expect(json.code).toBe("product_price_out_of_range");
    });

    it("rejects mixed-currency cart", async () => {
      mockGetProductById.mockImplementation((id: string) => {
        if (id === PRODUCT_A_ID) {
          return Promise.resolve({
            id: PRODUCT_A_ID, business_id: BUSINESS_ID, name: "A",
            price_pence: 1000, currency: "EUR", status: "live", stock_status: null,
          });
        }
        if (id === PRODUCT_B_ID) {
          return Promise.resolve({
            id: PRODUCT_B_ID, business_id: BUSINESS_ID, name: "B",
            price_pence: 2000, currency: "GBP", status: "live", stock_status: null,
          });
        }
        return Promise.resolve(null);
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [
          { productId: PRODUCT_A_ID, quantity: 1 },
          { productId: PRODUCT_B_ID, quantity: 1 },
        ],
      });
      expect(status).toBe(422);
      expect(json.code).toBe("mixed_currency_cart");
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });
  });

  describe("Stripe metadata", () => {
    it("includes nex_item_product_ids in payment_intent metadata for webhook reconstruction", async () => {
      mockGetProductById.mockImplementation((id: string) => {
        return Promise.resolve({
          id, business_id: BUSINESS_ID, name: "Item " + id,
          price_pence: 5000, currency: "EUR", status: "live", stock_status: null,
        });
      });
      await invokePost({
        businessId: BUSINESS_ID,
        items: [
          { productId: PRODUCT_A_ID, quantity: 1 },
          { productId: PRODUCT_B_ID, quantity: 2 },
        ],
      });
      const args = mockStripeCreate.mock.calls[0][0];
      expect(args.payment_intent_data.metadata.nex_item_product_ids).toBe(
        `${PRODUCT_A_ID},${PRODUCT_B_ID}`,
      );
      expect(args.metadata.nex_item_product_ids).toBe(
        `${PRODUCT_A_ID},${PRODUCT_B_ID}`,
      );
    });

    it("sets 0% application fee by routing via destination charge only", async () => {
      mockGetProductById.mockResolvedValue({
        id: PRODUCT_A_ID, business_id: BUSINESS_ID, name: "P",
        price_pence: 10000, currency: "EUR", status: "live", stock_status: null,
      });
      await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      const args = mockStripeCreate.mock.calls[0][0];
      expect(args.payment_intent_data.transfer_data.destination).toBe(
        "acct_test_connected",
      );
      expect(args.payment_intent_data.application_fee_amount).toBeUndefined();
    });
  });

  describe("seller readiness gates", () => {
    it("rejects when seller has not connected Stripe", async () => {
      mockReadLocalConnectStatus.mockResolvedValue({
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(422);
      expect(json.code).toBe("seller_not_ready");
      expect(json.reason).toBe("seller_has_not_connected_stripe");
      expect(mockGetProductById).not.toHaveBeenCalled();
    });

    it("rejects when seller Connect account charges not enabled", async () => {
      mockReadLocalConnectStatus.mockResolvedValue({
        accountId: "acct_test",
        chargesEnabled: false,
        payoutsEnabled: false,
      });
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(422);
      expect(json.reason).toBe("seller_charges_not_enabled");
    });
  });

  describe("auth gate", () => {
    it("rejects unauthenticated caller", async () => {
      mockResolveSession.mockResolvedValue(null);
      const { status, json } = await invokePost({
        businessId: BUSINESS_ID,
        items: [{ productId: PRODUCT_A_ID, quantity: 1 }],
      });
      expect(status).toBe(401);
      expect(json.code).toBe("unauthenticated");
    });
  });

  describe("GET method", () => {
    it("returns 405 method_not_allowed", async () => {
      const mod = await import("../route");
      const res = await mod.GET();
      expect(res.status).toBe(405);
      const json = await res.json();
      expect(json.code).toBe("method_not_allowed");
    });
  });
});
