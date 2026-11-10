// src/app/nex-native/__tests__/place-order-no-qr-precondition.test.ts
//
// P5 pre-activation review · owner-authorised 2026-11-10 ·
// Direct unit test for the no-active-QR precondition in
// placeOrderAction (src/app/nex-native/_actions.ts · line ~6900).
//
// Proves:
//   1. A QR-manual order with no active seller QR is rejected ·
//      redirect = seller_payment_qr_missing · no order row created.
//   2. createOrder is NEVER called when the precondition fails.
//   3. Supabase / lookup failure (getActiveQrAsset throws) ALSO
//      prevents order creation · fail-safe redirect same as above.
//   4. When an active QR exists, createOrder IS called · the
//      precondition does not interfere with the happy path.
//   5. Other payment methods · today placeOrderAction only emits
//      qr_manual orders (the only buyer checkout surface);
//      documented in this test · future surfaces must extend the
//      precondition when they ship.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  resolveSessionMock,
  getProductByIdMock,
  getBusinessByIdMock,
  findLatestCustomerConversationMock,
  createConversationMock,
  addParticipantMock,
  postMessageMock,
  getActiveQrAssetMock,
  createOrderMock,
  setPaymentMethodMock,
  transitionOrderStateMock,
  notifySellerNewOrderMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getBusinessByIdMock: vi.fn(),
  findLatestCustomerConversationMock: vi.fn(),
  createConversationMock: vi.fn(),
  addParticipantMock: vi.fn(),
  postMessageMock: vi.fn(),
  getActiveQrAssetMock: vi.fn(),
  createOrderMock: vi.fn(),
  setPaymentMethodMock: vi.fn(),
  transitionOrderStateMock: vi.fn(),
  notifySellerNewOrderMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: getProductByIdMock,
  listProductsByBusiness: vi.fn(() => []),
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  getBusinessById: getBusinessByIdMock,
  getBusinessBySlug: vi.fn(),
  listBusinessesByOwner: vi.fn(() => []),
  createBusiness: vi.fn(),
  updateBusinessLogo: vi.fn(),
  updateBusinessProfile: vi.fn(),
  updateBusinessVenueGallery: vi.fn(),
  updateBusinessHours: vi.fn(),
  updateBusinessCityAndHours: vi.fn(),
  updateBusinessPaymentMethods: vi.fn(),
  updateCoverLayoutId: vi.fn(),
}));

vi.mock("@/lib/nex-native/conversation-service", () => ({
  findLatestCustomerConversation: findLatestCustomerConversationMock,
  createConversation: createConversationMock,
  addParticipant: addParticipantMock,
  postMessage: postMessageMock,
}));

vi.mock("@/lib/nex-native/merchant-qr/qr-asset-service", () => ({
  getActiveQrAsset: getActiveQrAssetMock,
  hasReachedUploadLimit: vi.fn(),
  findDuplicateAsset: vi.fn(),
  insertPendingPreview: vi.fn(),
  getAssetById: vi.fn(),
  activateQrAsset: vi.fn(),
  retireActiveQrAsset: vi.fn(),
  pathForAsset: vi.fn(),
  MERCHANT_QR_BUCKET: "nex-merchant-qr",
  UPLOAD_RATE_LIMIT: 3,
  UPLOAD_RATE_WINDOW_HOURS: 24,
}));

vi.mock("@/lib/nex-native/order-service", () => ({
  createOrder: createOrderMock,
  setPaymentMethod: setPaymentMethodMock,
  transitionOrderState: transitionOrderStateMock,
  recordOrderEvent: vi.fn(),
  listOrderEvents: vi.fn(),
  getOrderById: vi.fn(),
  searchOrders: vi.fn(),
  listOrdersByBusiness: vi.fn(),
  listOrdersByCustomer: vi.fn(),
  updateMerchantNote: vi.fn(),
  updateOrderTracking: vi.fn(),
}));

vi.mock("@/lib/nex-native/manage-orders/order-notification-service", () => ({
  notifySellerNewOrder: notifySellerNewOrderMock,
  notifyBuyerPaymentConfirmed: vi.fn(),
  notifyBuyerOrderCancelled: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

// Fixtures

const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const PRODUCT_ID = "22222222-2222-2222-2222-222222222222";
const BUSINESS_ID = "33333333-3333-3333-3333-333333333333";
const BUSINESS_OWNER = "44444444-4444-4444-4444-444444444444";
const BUSINESS_SLUG = "test-shop";
const CONVERSATION_ID = "55555555-5555-5555-5555-555555555555";

function installHappyBoundaries() {
  resolveSessionMock.mockResolvedValue({
    account: { id: SESSION_ID, nex_handle: "nex-10001", display_name: "Buyer", tier: "gratis" },
  });
  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_ID,
    business_id: BUSINESS_ID,
    status: "live",
    name: "Test Product",
    price_pence: 1999,
    currency: "EUR",
  });
  getBusinessByIdMock.mockResolvedValue({
    id: BUSINESS_ID,
    owner_account_id: BUSINESS_OWNER,
    slug: BUSINESS_SLUG,
    display_name: "Test Shop",
  });
  findLatestCustomerConversationMock.mockResolvedValue({
    id: CONVERSATION_ID,
    business_id: BUSINESS_ID,
  });
  postMessageMock.mockResolvedValue(undefined);
  createOrderMock.mockResolvedValue({
    id: "order-created",
    business_id: BUSINESS_ID,
    customer_account_id: SESSION_ID,
    state: "created",
    price_pence: 1999,
    currency: "EUR",
    source_conversation_id: CONVERSATION_ID,
  });
  setPaymentMethodMock.mockResolvedValue(undefined);
  transitionOrderStateMock.mockResolvedValue(undefined);
  notifySellerNewOrderMock.mockResolvedValue({ attempted: 0, delivered: 0, failed: 0 });
}

function buildFormData(): FormData {
  const f = new FormData();
  f.set("product_id", PRODUCT_ID);
  f.set("customer_note", "");
  return f;
}

async function runAndCaptureRedirect(
  action: (fd: FormData) => Promise<never>,
): Promise<string> {
  try {
    await action(buildFormData());
  } catch (e) {
    const err = e as Error & { digest?: string };
    if (err.digest === "NEXT_REDIRECT" && err.message.startsWith("REDIRECT:")) {
      return err.message.slice("REDIRECT:".length);
    }
    throw e;
  }
  throw new Error("expected a redirect, got a normal return");
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("placeOrderAction · P5 no-active-QR precondition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installHappyBoundaries();
  });
  afterEach(() => vi.resetModules());

  test("1 · no active QR · rejects with seller_payment_qr_missing redirect", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(url).toContain(`/nex-native/${BUSINESS_SLUG}`);
    expect(url).toContain("e=seller_payment_qr_missing");
    // URLSearchParams encodes spaces as "+" · match the actual
    // encoding, not the percent-encoding variant.
    expect(url).toContain("seller+has+not+configured");
  });

  test("2 · createOrder is NEVER called when precondition fails", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { placeOrderAction } = await import("../_actions");
    await runAndCaptureRedirect(placeOrderAction);
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(setPaymentMethodMock).not.toHaveBeenCalled();
    expect(transitionOrderStateMock).not.toHaveBeenCalled();
    expect(notifySellerNewOrderMock).not.toHaveBeenCalled();
  });

  test("3a · getActiveQrAsset throws (pre-mig-319 OR DB outage) · same redirect · no createOrder", async () => {
    getActiveQrAssetMock.mockRejectedValueOnce(
      new Error("relation \"nex_merchant_qr_asset\" does not exist"),
    );
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(url).toContain("e=seller_payment_qr_missing");
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  test("3b · getActiveQrAsset throws generic network error · same fail-safe redirect", async () => {
    getActiveQrAssetMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(url).toContain("e=seller_payment_qr_missing");
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  test("4 · active QR present · createOrder IS called · precondition does not block happy path", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce({
      id: "asset-1",
      business_id: BUSINESS_ID,
      status: "active",
      storage_path: "qr/biz/hash.png",
      storage_bucket: "nex-merchant-qr",
      mime_type: "image/png",
      byte_size: 500,
      sha256_hex: "a".repeat(64),
      width_px: 400,
      height_px: 400,
      uploaded_by: BUSINESS_OWNER,
      qr_decoded: true,
      qr_payload_hint: null,
      activated_at: new Date().toISOString(),
      retired_at: null,
      retired_by: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
    });
    const { placeOrderAction } = await import("../_actions");
    // The action ends in a successful redirect to the order detail page.
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    const callArg = createOrderMock.mock.calls[0][0];
    expect(callArg.customer_account_id).toBe(SESSION_ID);
    expect(callArg.product_id).toBe(PRODUCT_ID);
    expect(callArg.source_conversation_id).toBe(CONVERSATION_ID);
    // Final redirect is the order detail page (happy path) · not the
    // precondition failure URL.
    expect(url).toContain("/nex-native/orders/order-created");
    expect(url).not.toContain("seller_payment_qr_missing");
    // P5 payment-method tagging + state transition fire on happy path.
    expect(setPaymentMethodMock).toHaveBeenCalledWith("order-created", "qr_manual");
    expect(transitionOrderStateMock).toHaveBeenCalled();
    expect(notifySellerNewOrderMock).toHaveBeenCalledTimes(1);
  });

  test("5 · documented · today placeOrderAction only emits qr_manual orders", async () => {
    // placeOrderAction currently hardcodes setPaymentMethod("qr_manual")
    // for every buyer checkout · P2 Stripe Checkout + P6 PayPal + P7
    // QRIS are gated on credentials and do NOT flow through this
    // action yet. The precondition being QR-only is therefore NOT
    // breaking any other payment method: there are no other payment
    // methods on this code path today. When they ship, the
    // precondition must be broadened to "seller has at least one
    // configured payment method".
    //
    // Assertion: when the happy path runs, the ONLY payment method
    // tag written is "qr_manual" · verified by setPaymentMethodMock.
    getActiveQrAssetMock.mockResolvedValueOnce({
      id: "asset-1",
      business_id: BUSINESS_ID,
      status: "active",
      storage_path: "qr/biz/hash.png",
    });
    const { placeOrderAction } = await import("../_actions");
    await runAndCaptureRedirect(placeOrderAction);
    expect(setPaymentMethodMock).toHaveBeenCalledTimes(1);
    const [, method] = setPaymentMethodMock.mock.calls[0];
    expect(method).toBe("qr_manual");
  });
});
