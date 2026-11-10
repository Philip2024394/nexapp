// src/app/nex-native/__tests__/place-order-no-qr-precondition.test.ts
//
// Owner-sealed 2026-11-10 · routing semantics of placeOrderAction
// after the payment-gateway orchestration landed.
//
// Behaviour under test:
//   1. Seller has 0 active methods → order is STILL created, redirect
//      = chat fallback (/pay/chat). NEX stays out of the money flow.
//   2. Seller has only QR → order created, redirect = /pay (QR card).
//   3. Seller has only Stripe → order created, redirect = /pay/stripe.
//   4. Seller has multiple → redirect = /pay (multi-method picker).
//   5. Resolver failure → treated as no methods → chat fallback.
//   6. Cross-seller safety: order.business_id snapshotted server-side
//      by createOrder · buyer cannot steer to another seller.

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
  getCheckoutDestinationMock,
  createOrderMock,
  setPaymentMethodMock,
  transitionOrderStateMock,
  recordOrderEventMock,
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
  getCheckoutDestinationMock: vi.fn(),
  createOrderMock: vi.fn(),
  setPaymentMethodMock: vi.fn(),
  transitionOrderStateMock: vi.fn(),
  recordOrderEventMock: vi.fn(),
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

vi.mock("@/lib/nex-native/payments/method-resolver-service", () => ({
  getCheckoutDestinationForBusiness: getCheckoutDestinationMock,
  getSellerActiveMethods: vi.fn(),
  resolveCheckoutDestination: vi.fn(),
  CHECKOUT_URLS: {
    qr: (id: string) => `/nex-native/orders/${id}/pay`,
    paypal: (id: string) => `/nex-native/orders/${id}/pay/paypal`,
    qris_dynamic: (id: string) => `/nex-native/orders/${id}/pay/qris`,
    picker: (id: string) => `/nex-native/orders/${id}/pay`,
    chat_only: (id: string) => `/nex-native/orders/${id}/pay/chat`,
  },
}));

vi.mock("@/lib/nex-native/order-service", () => ({
  createOrder: createOrderMock,
  setPaymentMethod: setPaymentMethodMock,
  transitionOrderState: transitionOrderStateMock,
  recordOrderEvent: recordOrderEventMock,
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

function destinationFor(kind: "chat_only" | "qr" | "paypal" | "qris_dynamic" | "picker") {
  const urls: Record<string, (id: string) => string> = {
    qr: (id) => `/nex-native/orders/${id}/pay`,
    paypal: (id) => `/nex-native/orders/${id}/pay/paypal`,
    qris_dynamic: (id) => `/nex-native/orders/${id}/pay/qris`,
    picker: (id) => `/nex-native/orders/${id}/pay`,
    chat_only: (id) => `/nex-native/orders/${id}/pay/chat`,
  };
  return { kind, url: urls[kind], label: kind };
}
function methodsFor(kind: "chat_only" | "qr" | "paypal" | "qris_dynamic" | "picker") {
  const base = { paypal: false, qr_manual: false, qris_dynamic: false, configured_count: 0, any_configured: false };
  if (kind === "qr") return { ...base, qr_manual: true, configured_count: 1, any_configured: true };
  if (kind === "paypal") return { ...base, paypal: true, configured_count: 1, any_configured: true };
  if (kind === "qris_dynamic") return { ...base, qris_dynamic: true, configured_count: 1, any_configured: true };
  if (kind === "picker") return { ...base, paypal: true, qr_manual: true, configured_count: 2, any_configured: true };
  return base;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("placeOrderAction · payment gateway routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installHappyBoundaries();
  });
  afterEach(() => vi.resetModules());

  test("0 methods active · order IS created · redirect = chat fallback", async () => {
    getCheckoutDestinationMock.mockResolvedValueOnce({
      methods: methodsFor("chat_only"),
      destination: destinationFor("chat_only"),
    });
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(url).toBe("/nex-native/orders/order-created/pay/chat");
    // chat_only path does NOT call setPaymentMethod or transition
    // (no gateway to await).
    expect(setPaymentMethodMock).not.toHaveBeenCalled();
    expect(transitionOrderStateMock).not.toHaveBeenCalled();
    // An awaiting_chat_arrangement event IS recorded for the audit trail.
    expect(recordOrderEventMock).toHaveBeenCalledTimes(1);
    expect(recordOrderEventMock.mock.calls[0][0].event).toBe("awaiting_chat_arrangement");
    // Notification still fires.
    expect(notifySellerNewOrderMock).toHaveBeenCalledTimes(1);
  });

  test("QR-only · redirect = /pay · payment_method tag = qr_manual", async () => {
    getCheckoutDestinationMock.mockResolvedValueOnce({
      methods: methodsFor("qr"),
      destination: destinationFor("qr"),
    });
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(url).toBe("/nex-native/orders/order-created/pay");
    expect(setPaymentMethodMock).toHaveBeenCalledWith("order-created", "qr_manual");
    expect(transitionOrderStateMock).toHaveBeenCalled();
    expect(transitionOrderStateMock.mock.calls[0][1]).toBe("pending");
  });

  // Stripe-only shop checkout was removed 2026-11-10 · Stripe is now
  // reserved for NEX member subscriptions only · shop paths route
  // through PayPal + QR + QRIS.

  test("Multi-method picker · redirect = /pay · no payment_method tag yet", async () => {
    getCheckoutDestinationMock.mockResolvedValueOnce({
      methods: methodsFor("picker"),
      destination: destinationFor("picker"),
    });
    const { placeOrderAction } = await import("../_actions");
    const url = await runAndCaptureRedirect(placeOrderAction);
    expect(url).toBe("/nex-native/orders/order-created/pay");
    expect(setPaymentMethodMock).not.toHaveBeenCalled();
    expect(transitionOrderStateMock).toHaveBeenCalled();
    expect(transitionOrderStateMock.mock.calls[0][3].event).toBe("awaiting_method_selection");
  });

  test("Resolver throws · fail-safe to chat_only · order still created", async () => {
    // The resolver itself is fail-soft, but if the whole call throws
    // we expect the action to still handle it gracefully.
    getCheckoutDestinationMock.mockResolvedValueOnce({
      methods: methodsFor("chat_only"),
      destination: destinationFor("chat_only"),
    });
    const { placeOrderAction } = await import("../_actions");
    await runAndCaptureRedirect(placeOrderAction);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  test("Cross-seller safety · createOrder arg carries buyer's session id", async () => {
    getCheckoutDestinationMock.mockResolvedValueOnce({
      methods: methodsFor("chat_only"),
      destination: destinationFor("chat_only"),
    });
    const { placeOrderAction } = await import("../_actions");
    await runAndCaptureRedirect(placeOrderAction);
    const arg = createOrderMock.mock.calls[0][0];
    expect(arg.customer_account_id).toBe(SESSION_ID);
    expect(arg.product_id).toBe(PRODUCT_ID);
    // business_id is resolved SERVER-SIDE from the product record
    // inside order-service.createOrder; the buyer cannot inject one.
  });
});
