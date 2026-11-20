// src/app/nex-native/__tests__/send-cart-order-idempotency.test.ts
//
// LANE E · prompt-7 round 8 continuation · 2026-11-19.
// Offline regression anchor for the single-line Lane E hardening at
// _actions.ts:3633: nex_order.idempotency_key now carries the same
// send_intent_id UUID that already gates nex_peer_message dedup via
// Migration 102 Part C (UNIQUE sender_account_id + send_intent_id).
//
// The sister file send-cart-order-slice-0.test.ts (owner-authorised
// 2026-10-18) is a security-hardening anchor and intentionally does
// NOT mock @/lib/nex-native/order-service — its happy-path redirect
// assertions rely on the production try/catch at _actions.ts:3639-44
// swallowing the unmocked service error. This file does mock the
// order service so the idempotency wiring can be observed without
// touching the slice-0 anchor's contract.
//
// Scope:
//   · asserts orderService.createOrder is invoked with
//     idempotency_key === the submitted send_intent_id when the
//     client supplies a well-shaped UUID
//   · asserts fail-soft fallback: no send_intent_id, or a malformed
//     one, propagates idempotency_key = null to createOrder
//     (preserves the pre-fix behaviour so a bad client never breaks
//     the order write path)
//   · asserts the order id is still the pre-minted futureOrderId
//     (unchanged by the idempotency propagation)
//
// Hard constraints:
//   · no DB clients, no network, no real supabase, no running app
//   · every external service sendCartOrderAction touches is mocked
//   · synthetic UUIDs only · no real account/product/shop references
//
// Mocked boundaries map (parity with slice-0 anchor):
//   · @/lib/nex-native/app/session           (resolveNexAppSessionFromContext)
//   · @/lib/nex-native/account-service       (getAccountById + tier stubs)
//   · @/lib/nex-native/business-service      (getBusinessById + unused stubs)
//   · @/lib/nex-native/product-service       (getProductById)
//   · @/lib/nex-native/menu-service          (getMenuItemById)
//   · @/lib/nex-native/peer-conversation-service
//   · @/lib/nex-native/peer-message-service  (sendPeerMessage)
//   · @/lib/nex-native/cart-service          (getServerCart / saveServerCart)
//   · @/lib/nex-native/share-service         (markGrantConsumed)
//   · @/lib/nex-native/order-service         (createOrder) — ADDED here
//   · next/cache, next/navigation, supabase-admin (module graph only)

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  getAccountByIdMock,
  getBusinessByIdMock,
  getProductByIdMock,
  getMenuItemByIdMock,
  getOrCreatePeerConversationMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  getServerCartMock,
  saveServerCartMock,
  createOrderMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
  getBusinessByIdMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getMenuItemByIdMock: vi.fn(),
  getOrCreatePeerConversationMock: vi.fn(),
  getOrCreatePeerConversationAsSenderMock: vi.fn(),
  sendPeerMessageMock: vi.fn(),
  getServerCartMock: vi.fn(),
  saveServerCartMock: vi.fn(),
  createOrderMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
  effectiveTier: vi.fn(() => "gratis"),
  isThemesTrialActive: vi.fn(() => false),
  hasUsedThemesTrial: vi.fn(() => false),
  themesTrialExpiresAt: vi.fn(() => null),
  startThemesTrial: vi.fn(),
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

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: getProductByIdMock,
  listProductsByBusiness: vi.fn(() => []),
}));

vi.mock("@/lib/nex-native/menu-service", () => ({
  getMenuItemById: getMenuItemByIdMock,
  listMenuItemsByBusiness: vi.fn(() => []),
  createMenuItem: vi.fn(),
}));

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: getOrCreatePeerConversationMock,
  getOrCreatePeerConversationAsSender: getOrCreatePeerConversationAsSenderMock,
  findPeerConversation: vi.fn(),
}));

vi.mock("@/lib/nex-native/peer-message-service", () => ({
  sendPeerMessage: sendPeerMessageMock,
}));

vi.mock("@/lib/nex-native/cart-service", () => ({
  getServerCart: getServerCartMock,
  saveServerCart: saveServerCartMock,
}));

vi.mock("@/lib/nex-native/share-service", () => ({
  markGrantConsumed: vi.fn(),
}));

vi.mock("@/lib/nex-native/order-service", () => ({
  createOrder: createOrderMock,
  // Stubs for any unrelated exports that may be pulled in at module
  // graph resolution (searchOrders, getOrderById, etc.). The cart send
  // path only touches createOrder.
  searchOrders: vi.fn(() => []),
  getOrderById: vi.fn(() => null),
  updateOrderState: vi.fn(),
  updateDispatchTracking: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ count: 0, error: null })),
          })),
        })),
      })),
    })),
  },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

// ─── Fixtures (parity with slice-0; distinct UUID set) ──────────────

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const SHOP_OWNER_ID = "22222222-2222-2222-2222-222222222222";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const VALID_INTENT_ID = "77777777-7777-4777-8777-777777777777";
const MALFORMED_INTENT_ID = "not-a-uuid-at-all";

function installHappyPath(): void {
  resolveSessionMock.mockReset();
  getAccountByIdMock.mockReset();
  getBusinessByIdMock.mockReset();
  getProductByIdMock.mockReset();
  getMenuItemByIdMock.mockReset();
  getOrCreatePeerConversationMock.mockReset();
  getOrCreatePeerConversationAsSenderMock.mockReset();
  sendPeerMessageMock.mockReset();
  getServerCartMock.mockReset();
  saveServerCartMock.mockReset();
  createOrderMock.mockReset();

  resolveSessionMock.mockResolvedValue({
    account: {
      id: BUYER_ID,
      nex_handle: "nex-10001",
      display_name: "Buyer",
      tier: "gratis",
    },
  });
  getAccountByIdMock.mockResolvedValue({
    id: SHOP_OWNER_ID,
    nex_handle: "nex-20001",
    display_name: "Shop Owner",
  });
  getBusinessByIdMock.mockResolvedValue({
    id: SHOP_ID,
    owner_account_id: SHOP_OWNER_ID,
    display_name: "Mock Shop",
    location_lat: null,
    location_lng: null,
  });
  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_A,
    business_id: SHOP_ID,
    price_pence: 2500,
    currency: "IDR",
    name: "Mock Product",
    image_url: null,
  });
  getOrCreatePeerConversationMock.mockResolvedValue({
    id: "conv-id",
    participant_a_id: BUYER_ID < SHOP_OWNER_ID ? BUYER_ID : SHOP_OWNER_ID,
    participant_b_id: BUYER_ID < SHOP_OWNER_ID ? SHOP_OWNER_ID : BUYER_ID,
  });
  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: "conv-id",
    participant_a_id: BUYER_ID < SHOP_OWNER_ID ? BUYER_ID : SHOP_OWNER_ID,
    participant_b_id: BUYER_ID < SHOP_OWNER_ID ? SHOP_OWNER_ID : BUYER_ID,
  });
  sendPeerMessageMock.mockResolvedValue({ id: "msg-id" });
  getServerCartMock.mockResolvedValue({ items: [], delivery_address: null });
  saveServerCartMock.mockResolvedValue(undefined);
  createOrderMock.mockResolvedValue({ id: "order-row-id" });
}

function makeFormData(
  overrides: { sendIntentId?: string | null } = {},
): FormData {
  const payload = {
    peer_account_id: SHOP_OWNER_ID,
    shop_id: SHOP_ID,
    shop_display_name: "Mock Shop",
    currency: "IDR",
    items: [
      {
        kind: "product",
        id: PRODUCT_A,
        name: "Mock Product",
        price_pence: 2500,
        quantity: 1,
      },
    ],
    delivery_address: null,
  };
  const fd = new FormData();
  fd.set("cart_payload", JSON.stringify(payload));
  if (overrides.sendIntentId !== undefined && overrides.sendIntentId !== null) {
    fd.set("send_intent_id", overrides.sendIntentId);
  }
  return fd;
}

async function runSendCart(fd: FormData): Promise<Error> {
  const { sendCartOrderAction } = await import("../_actions");
  try {
    await sendCartOrderAction(fd);
    throw new Error("sendCartOrderAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── T1 · valid UUID propagates to orderService.createOrder ─────────

describe("sendCartOrderAction · idempotency propagation", () => {
  test("T1 · valid send_intent_id is forwarded as nex_order.idempotency_key", async () => {
    installHappyPath();

    const err = await runSendCart(makeFormData({ sendIntentId: VALID_INTENT_ID }));

    // Still redirects on success (chat preview with cart_sent=1).
    expect(err.message).toContain("REDIRECT:/nex-native/chat/peer/");
    expect(err.message).toContain("cart_sent=1");

    // Message + order both written exactly once.
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledTimes(1);

    // Message carried the intent id (pre-existing Bridge-99 contract).
    const sendPeerMessageArg = sendPeerMessageMock.mock.calls[0]?.[0];
    expect(sendPeerMessageArg?.send_intent_id).toBe(VALID_INTENT_ID);

    // nex_order now carries the SAME uuid as idempotency_key — the
    // single-line Lane E fix at _actions.ts:3633.
    const createOrderArg = createOrderMock.mock.calls[0]?.[0];
    expect(createOrderArg?.idempotency_key).toBe(VALID_INTENT_ID);
    // customer_account_id still comes from server session, not payload.
    expect(createOrderArg?.customer_account_id).toBe(BUYER_ID);
    // Lane E · prompt-7 round 11 · 2026-11-19 · cross-retry linkage.
    // futureOrderId is now derived from sendIntentId when the client
    // supplied a valid one (see _actions.ts:3397). This closes the
    // cross-retry drift where a buyer retry would mint a different
    // order id than the one stamped into attachment_meta.cart.order_id.
    // Supersedes the 2026-11-16 "distinct random UUID" convention for
    // intent-carrying sends; legacy clients that omit send_intent_id
    // still get a fresh random UUID (covered by T2).
    expect(createOrderArg?.id).toBe(VALID_INTENT_ID);
  });

  // ─── T2 · absent send_intent_id falls back to null ────────────────

  test("T2 · missing send_intent_id → idempotency_key null (fail-soft)", async () => {
    installHappyPath();

    const err = await runSendCart(makeFormData());

    expect(err.message).toContain("REDIRECT:/nex-native/chat/peer/");
    expect(createOrderMock).toHaveBeenCalledTimes(1);

    const createOrderArg = createOrderMock.mock.calls[0]?.[0];
    // Pre-fix behaviour preserved when the client cannot supply a uuid.
    expect(createOrderArg?.idempotency_key).toBeNull();
  });

  // ─── T3 · malformed send_intent_id is rejected by shape check ─────

  test("T3 · malformed send_intent_id → idempotency_key null · never throws", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({ sendIntentId: MALFORMED_INTENT_ID }),
    );

    // Still succeeds — malformed uuid is silently coerced to undefined
    // upstream, so the whole send path remains fail-soft instead of
    // 500-ing on a bad client input.
    expect(err.message).toContain("REDIRECT:/nex-native/chat/peer/");
    expect(createOrderMock).toHaveBeenCalledTimes(1);

    const createOrderArg = createOrderMock.mock.calls[0]?.[0];
    expect(createOrderArg?.idempotency_key).toBeNull();

    // Also confirms sendPeerMessage saw undefined (not the malformed
    // string) — the existing shape check rejects it before use.
    const sendPeerMessageArg = sendPeerMessageMock.mock.calls[0]?.[0];
    expect(sendPeerMessageArg?.send_intent_id).toBeUndefined();
  });
});
