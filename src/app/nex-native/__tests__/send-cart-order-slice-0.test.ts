// src/app/nex-native/__tests__/send-cart-order-slice-0.test.ts
//
// NEX Slice 0 · sendCartOrderAction server-side validation hardening.
// Owner-authorised 2026-10-18.
// -------------------------------------------------------------------
// REGRESSION ANCHORS for the owner-approved security changes:
//
//   1 · peer account must exist (nex_account lookup) · service-throw
//       is fail-closed · never trusts a dangling peer id
//   2 · shop must exist (nex_business lookup) · fail-closed on error
//   3 · shop.owner_account_id MUST equal peerAccountId · hard reject
//       on mismatch (prevents aiming a cart at a shop owned by a
//       different account)
//   4 · per-item ownership verified · product.business_id === shopId
//       and menu_item.business_id === shopId · mismatch REJECTS THE
//       ENTIRE CART (never a silent per-line drop)
//   5 · prices come from authoritative server records · client's
//       price_pence is NEVER read for either product or menu_item
//   6 · DB service exceptions reject the entire cart · never
//       fall-open to client-supplied prices
//   7 · One invalid line among many rejects the whole submission ·
//       never a partial send
//   8 · Rejection messages are generic + neutral · no identifier leak
//
// Also documents (does NOT fix) the existing idempotency behaviour:
//   · Double-tap on Send currently sends 2 cart_order messages ·
//     flagged for a future hardening slice · the test here is a
//     documentation anchor so a later fix is deliberate.
//
// Mocks every external service sendCartOrderAction touches so this
// test is pure (zero DB · zero network). The real action module is
// imported dynamically after mocks are installed.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks (visible inside vi.mock factories) ───────────────

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
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
  // Other exports used by _actions.ts in unrelated code paths · stubs:
  effectiveTier: vi.fn(() => "gratis"),
  isThemesTrialActive: vi.fn(() => false),
  hasUsedThemesTrial: vi.fn(() => false),
  themesTrialExpiresAt: vi.fn(() => null),
  startThemesTrial: vi.fn(),
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  getBusinessById: getBusinessByIdMock,
  // Stubs for unrelated exports pulled by _actions.ts module import:
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

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

// Minimal supabase-admin stub for module graph · never actually hit
// in the server-action code paths this test exercises.
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ gte: vi.fn(() => Promise.resolve({ count: 0, error: null })) })),
        })),
      })),
    })),
  },
  nexSupabaseProjectRef: () => "mock",
}));

// `redirect()` throws in production Next · we match on that throw.
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

// ─── Fixtures ──────────────────────────────────────────────────────

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const SHOP_OWNER_ID = "22222222-2222-2222-2222-222222222222";
const WRONG_OWNER_ID = "33333333-3333-3333-3333-333333333333";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WRONG_SHOP_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PRODUCT_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PRODUCT_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const MENU_ITEM_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const MENU_ITEM_B = "ffffffff-ffff-ffff-ffff-ffffffffffff";

function installHappyPath() {
  // Reset FIRST · wipes any mockResolvedValueOnce / mockRejectedValueOnce
  // queued by prior tests · prevents one-shot leakage between tests.
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

  resolveSessionMock.mockResolvedValue({
    account: { id: BUYER_ID, nex_handle: "nex-10001", display_name: "Buyer", tier: "gratis" },
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
    // 2026-11-18 · R5 · G3-Server authoritative-distance guard now
    // requires seller origin coords to be configured. Tests that don't
    // send a delivery estimate don't engage G3-Server; tests that DO
    // send an estimate must either supply matching buyer coords, drop
    // fare/km so the guard short-circuits, or expect the refuse path.
    location_lat: -6.2088,
    location_lng: 106.8456,
  });
  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_A,
    business_id: SHOP_ID,
    price_pence: 2500,
    currency: "IDR",
    name: "Mock Product",
    image_url: null,
  });
  getMenuItemByIdMock.mockResolvedValue({
    id: MENU_ITEM_A,
    business_id: SHOP_ID,
    price_pence: 1500,
    currency: "IDR",
    name: "Mock Menu Item",
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
}

interface CartLine {
  kind?: "product" | "menu_item" | "service";
  id?: string;
  name?: string;
  price_pence?: number;
  quantity?: number;
  variants?: unknown;
  perks?: unknown;
  perks_note?: unknown;
}

function makeFormData(
  overrides: {
    peer_account_id?: string;
    shop_id?: string;
    shop_display_name?: string;
    items?: CartLine[];
    delivery_address?: Record<string, unknown> | null;
    delivery_quote?: unknown;
    direct_price?: unknown;
    buyer_notes?: unknown;
  } = {},
): FormData {
  const payload: Record<string, unknown> = {
    peer_account_id: overrides.peer_account_id ?? SHOP_OWNER_ID,
    shop_id: overrides.shop_id ?? SHOP_ID,
    shop_display_name: overrides.shop_display_name ?? "Mock Shop",
    currency: "IDR",
    items: overrides.items ?? [
      { kind: "product", id: PRODUCT_A, name: "Mock Product", price_pence: 2500, quantity: 1 },
    ],
    delivery_address: overrides.delivery_address ?? null,
  };
  if (overrides.delivery_quote !== undefined) {
    payload.delivery_quote = overrides.delivery_quote;
  }
  if (overrides.direct_price !== undefined) {
    payload.direct_price = overrides.direct_price;
  }
  if (overrides.buyer_notes !== undefined) {
    payload.buyer_notes = overrides.buyer_notes;
  }
  const fd = new FormData();
  fd.set("cart_payload", JSON.stringify(payload));
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

function expectShopError(err: Error): void {
  expect(err.message).toContain("REDIRECT:/nex-native/cart?send_error=");
  expect(decodeURIComponent(err.message)).toContain("This shop could not be verified");
}

function expectItemError(err: Error): void {
  expect(err.message).toContain("REDIRECT:/nex-native/cart?send_error=");
  expect(decodeURIComponent(err.message)).toContain("Some items could not be verified");
}

function expectSuccess(err: Error): void {
  // Success path redirects to the chat preview with ?cart_sent=1
  expect(err.message).toContain("REDIRECT:/nex-native/chat/peer/");
  expect(err.message).toContain("cart_sent=1");
}

// ─── Reset mocks between tests ──────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── T0.1 · peerAccountId does not exist → entire cart rejected ─────

describe("sendCartOrderAction · peer account verification", () => {
  test("T0.1 · unknown peerAccountId → neutral shop-verify rejection · no message sent", async () => {
    installHappyPath();
    getAccountByIdMock.mockResolvedValueOnce(null);

    const err = await runSendCart(makeFormData({ peer_account_id: WRONG_OWNER_ID }));

    expectShopError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.1b · accountService throws → fail-closed · no message sent", async () => {
    installHappyPath();
    getAccountByIdMock.mockRejectedValueOnce(new Error("transient DB outage"));

    const err = await runSendCart(makeFormData());

    expectShopError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.2-T0.3 · shop existence + ownership mismatch ────────────────

describe("sendCartOrderAction · shop verification", () => {
  test("T0.2 · unknown shopId → neutral rejection · no message sent", async () => {
    installHappyPath();
    getBusinessByIdMock.mockResolvedValueOnce(null);

    const err = await runSendCart(makeFormData({ shop_id: WRONG_SHOP_ID }));

    expectShopError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.2b · businessService throws → fail-closed · no message sent", async () => {
    installHappyPath();
    getBusinessByIdMock.mockRejectedValueOnce(new Error("transient DB outage"));

    const err = await runSendCart(makeFormData());

    expectShopError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.3 · shop owner_account_id !== peerAccountId → neutral rejection · no message sent", async () => {
    installHappyPath();
    getBusinessByIdMock.mockResolvedValueOnce({
      id: SHOP_ID,
      owner_account_id: WRONG_OWNER_ID,
      display_name: "Mock Shop",
    });

    const err = await runSendCart(makeFormData());

    expectShopError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.4-T0.7 · product line validation ────────────────────────────

describe("sendCartOrderAction · product line validation", () => {
  test("T0.4 · valid product · matching business_id · server price used · message sent", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "product", id: PRODUCT_A, name: "P", price_pence: 1, quantity: 1 }],
      }),
    );

    expectSuccess(err);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    // Server price (2500) used · client's 1 ignored.
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { subtotal_pence: number } };
    };
    expect(callArg.attachment_meta.cart.subtotal_pence).toBe(2500);
  });

  test("T0.5 · product business_id !== shopId → entire cart rejected", async () => {
    installHappyPath();
    getProductByIdMock.mockResolvedValueOnce({
      id: PRODUCT_A,
      business_id: WRONG_SHOP_ID,
      price_pence: 2500,
      currency: "IDR",
    });

    const err = await runSendCart(makeFormData());

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.6 · product missing (null) → entire cart rejected", async () => {
    installHappyPath();
    getProductByIdMock.mockResolvedValueOnce(null);

    const err = await runSendCart(makeFormData());

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.7 · productService throws → fail-closed · entire cart rejected", async () => {
    installHappyPath();
    getProductByIdMock.mockRejectedValueOnce(new Error("transient DB outage"));

    const err = await runSendCart(makeFormData());

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.8-T0.11 · menu_item line validation ─────────────────────────

describe("sendCartOrderAction · menu_item line validation", () => {
  test("T0.8 · valid menu_item · matching business_id · server price used · message sent", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "menu_item", id: MENU_ITEM_A, name: "M", price_pence: 1, quantity: 1 }],
      }),
    );

    expectSuccess(err);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { subtotal_pence: number } };
    };
    // Server price (1500) used · client's 1 ignored (NEW behaviour · menu
    // items used to trust client price pre-Slice-0).
    expect(callArg.attachment_meta.cart.subtotal_pence).toBe(1500);
  });

  test("T0.9 · menu_item business_id !== shopId → entire cart rejected", async () => {
    installHappyPath();
    getMenuItemByIdMock.mockResolvedValueOnce({
      id: MENU_ITEM_A,
      business_id: WRONG_SHOP_ID,
      price_pence: 1500,
      currency: "IDR",
    });

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "menu_item", id: MENU_ITEM_A, name: "M", price_pence: 1, quantity: 1 }],
      }),
    );

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.10 · menu_item missing (null) → entire cart rejected", async () => {
    installHappyPath();
    getMenuItemByIdMock.mockResolvedValueOnce(null);

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "menu_item", id: MENU_ITEM_A, name: "M", price_pence: 1, quantity: 1 }],
      }),
    );

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("T0.11 · menuService throws → fail-closed · entire cart rejected", async () => {
    installHappyPath();
    getMenuItemByIdMock.mockRejectedValueOnce(new Error("transient DB outage"));

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "menu_item", id: MENU_ITEM_A, name: "M", price_pence: 1, quantity: 1 }],
      }),
    );

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.12 · mixed cart · ONE invalid line rejects ALL ───────────────

describe("sendCartOrderAction · mixed cart integrity", () => {
  test("T0.12 · product valid + menu_item from wrong shop → entire cart rejected · zero messages", async () => {
    installHappyPath();
    // The second lookup (menu_item) returns an item belonging to a different shop:
    getMenuItemByIdMock.mockResolvedValueOnce({
      id: MENU_ITEM_A,
      business_id: WRONG_SHOP_ID,
      price_pence: 1500,
      currency: "IDR",
    });

    const err = await runSendCart(
      makeFormData({
        items: [
          { kind: "product", id: PRODUCT_A, name: "P", price_pence: 2500, quantity: 1 },
          { kind: "menu_item", id: MENU_ITEM_A, name: "M", price_pence: 1500, quantity: 1 },
        ],
      }),
    );

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.13 · unknown kind rejected (service · accommodation · etc.) ──

describe("sendCartOrderAction · unknown kinds", () => {
  test("T0.13 · unknown kind (service · pre-Slice-6) → entire cart rejected", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "service", id: PRODUCT_A, name: "S", quantity: 1 }],
      }),
    );

    expectItemError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── T0.14 · neutral copy · no identifier leak ──────────────────────

describe("sendCartOrderAction · neutral error copy", () => {
  test("T0.14 · rejection messages contain neither the peer id nor the shop id", async () => {
    installHappyPath();
    getBusinessByIdMock.mockResolvedValueOnce(null);

    const err = await runSendCart(makeFormData({ shop_id: WRONG_SHOP_ID }));

    expect(err.message).not.toContain(WRONG_SHOP_ID);
    expect(err.message).not.toContain(SHOP_OWNER_ID);
    expect(err.message).not.toContain("not found");
    expect(err.message).not.toContain("does not exist");
  });
});

// ─── T0.15 · client price_pence is NEVER trusted ─────────────────────

describe("sendCartOrderAction · authoritative pricing", () => {
  test("T0.15 · client sends price_pence=1 but server returns 2500 · server value wins", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [{ kind: "product", id: PRODUCT_A, name: "P", price_pence: 1, quantity: 2 }],
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { subtotal_pence: number; items: Array<{ price_pence: number }> } };
    };
    // Server unit price (2500) × client quantity (2) = 5000. Client's
    // 1-pence attempt is discarded.
    expect(callArg.attachment_meta.cart.subtotal_pence).toBe(5000);
    expect(callArg.attachment_meta.cart.items[0]!.price_pence).toBe(2500);
  });
});

// ─── T0.16 · legitimate product-only path regression · unchanged ─────

describe("sendCartOrderAction · legitimate product-only path", () => {
  test("T0.16 · happy-path product cart · message sent exactly once · correct conversation", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [
          { kind: "product", id: PRODUCT_A, name: "Mock Product", price_pence: 2500, quantity: 3 },
        ],
      }),
    );

    expectSuccess(err);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    // Slice 0.75 · now routed through the sender-aware variant.
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      BUYER_ID,
      SHOP_OWNER_ID,
    );
    // Legacy symmetric creator is no longer the direct call site.
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });
});

// ─── Slice 0.75 · recipient-eligibility enforcement ─────────────────
//
// Owner-authorised 2026-10-18 · sendCartOrderAction must route through
// peerConversationService.getOrCreatePeerConversationAsSender so a
// contacts-only recipient is protected from unsolicited cart orders
// from NEW senders · existing conversations keep documented NEX
// policy (gate bypass) · service errors fail closed · buyer-facing
// copy is neutral and does NOT instruct the buyer to "add as contact"
// (one-sided action that cannot guarantee unblock).

function expectContactsOnlyError(err: Error): void {
  expect(err.message).toContain("REDIRECT:/nex-native/cart?send_error=");
  const decoded = decodeURIComponent(err.message);
  expect(decoded).toContain("isn't accepting cart orders from new senders");
  expect(decoded).toContain("reach the shop another way");
  // Must NOT instruct the buyer to add the shop as a contact · the
  // contacts-only unlock requires the recipient's own friend-accept
  // which the buyer cannot force. (See audit comment on
  // chat-preferences-service.areContacts.)
  expect(decoded).not.toMatch(/add.*contact/i);
}

function expectConversationFailClosedError(err: Error): void {
  expect(err.message).toContain("REDIRECT:/nex-native/cart?send_error=");
  const decoded = decodeURIComponent(err.message);
  expect(decoded).toContain("could not be sent");
}

describe("sendCartOrderAction · Slice 0.75 · recipient-eligibility (new conversation)", () => {
  test("T0.75.1 · prohibited new conversation (recipient_contacts_only) · no message sent · neutral copy", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runSendCart(makeFormData());

    expectContactsOnlyError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    // Legacy symmetric creator must NOT be used as a fall-back · the
    // whole point of the gate is that we refuse to insert the
    // conversation when the recipient has blocked it.
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.75.2 · permitted new conversation (gate allows) · message sent exactly once", async () => {
    installHappyPath();
    // Default happy-path mock returns a conversation · gate passed.

    const err = await runSendCart(makeFormData());

    expectSuccess(err);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      BUYER_ID,
      SHOP_OWNER_ID,
    );
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendCartOrderAction · Slice 0.75 · recipient-eligibility (existing conversation policy)", () => {
  test("T0.75.3 · existing conversation returned by sender-aware service · gate bypass policy preserved · message sent", async () => {
    installHappyPath();
    // The sender-aware service documents: existing conversations
    // bypass the who_can_message gate. We model that documented
    // behaviour by having the mock return a conversation row even
    // though a cold-start would have been rejected · from the action's
    // viewpoint it's an identical success path, which is correct.
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: BUYER_ID < SHOP_OWNER_ID ? BUYER_ID : SHOP_OWNER_ID,
      participant_b_id: BUYER_ID < SHOP_OWNER_ID ? SHOP_OWNER_ID : BUYER_ID,
    });

    const err = await runSendCart(makeFormData());

    expectSuccess(err);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    // The existing conversation id (NOT a freshly-minted one) is used.
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("sendCartOrderAction · Slice 0.75 · neutral error copy", () => {
  test("T0.75.4 · recipient_contacts_only rejection does NOT leak internal reason tokens or identifiers", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runSendCart(makeFormData());

    const decoded = decodeURIComponent(err.message);
    // Internal reason token must never appear in the buyer-visible url.
    expect(decoded).not.toContain("recipient_contacts_only");
    // Internal service path must never appear.
    expect(decoded).not.toContain("peer-conversation-service");
    // Account identifiers must never appear.
    expect(decoded).not.toContain(SHOP_OWNER_ID);
    expect(decoded).not.toContain(BUYER_ID);
  });
});

describe("sendCartOrderAction · Slice 0.75 · unexpected service error fail-closed", () => {
  test("T0.75.5 · unexpected service error (not recipient_contacts_only) · fail closed · no message sent · generic copy", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET during conversation insert"),
    );

    const err = await runSendCart(makeFormData());

    expectConversationFailClosedError(err);
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    // The internal error text must not leak.
    expect(decodeURIComponent(err.message)).not.toContain("ECONNRESET");
    expect(decodeURIComponent(err.message)).not.toContain("supabase");
  });
});

// ─── Slice 0.6 · additional security coverage ───────────────────────
//
// Owner-authorised 2026-10-18 · prove each client-controlled field
// is either server-validated or server-overridden. Covers the paths
// the owner called out: delivery_quote, perks, variants, direct_price.
// Also covers buyer_notes slicing (low-risk but trivially testable).
//
// First-pass finding: the server appears to independently sanitise or
// override every attack path we tested. No out-of-scope production
// change was required for Slice 0.6 · the existing hardening already
// handles these. If any assertion below starts failing, that is the
// signal to open a dedicated hardening slice before shipping.

describe("sendCartOrderAction · Slice 0.6 · delivery_quote tampering", () => {
  test("T0.6.1 · negative + non-numeric fare_pence/distance_km/eta_minutes dropped by server · snapshot carries no tampered numerics", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_quote: {
          kind: "estimate",
          fare_pence: -999999, // negative · must drop
          distance_km: "not-a-number", // non-numeric · must drop
          eta_minutes: -5, // negative · must drop
          currency: "USD", // attempt to flip currency
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            kind: string;
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
            currency?: string;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote;
    expect(dq).not.toBeNull();
    expect(dq!.kind).toBe("estimate");
    // Negative + non-numeric values are dropped (field never set).
    expect(dq).not.toHaveProperty("fare_pence");
    expect(dq).not.toHaveProperty("distance_km");
    expect(dq).not.toHaveProperty("eta_minutes");
    // Currency is forced to IDR server-side regardless of client claim.
    expect(dq!.currency).toBe("IDR");
  });

  test("T0.6.1b · Fix A · raw `null` numeric fields are REJECTED (not coerced to 0) · typed-check runs before any Number() coercion", async () => {
    // Previously (pre-Fix A, 2026-10-18): JSON.stringify converts NaN
    // to null · the server's `Number(null) === 0` passed the `>= 0`
    // guard, so clients could force `0` onto the snapshot's numeric
    // fields. Owner-approved Fix A: validate `typeof === "number" &&
    // Number.isFinite(x) && x > 0` BEFORE any coercion · null now
    // short-circuits at the typeof check.
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_quote: {
          kind: "estimate",
          fare_pence: null,
          distance_km: null,
          eta_minutes: null,
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            kind: string;
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote!;
    expect(dq.kind).toBe("estimate");
    // Null fields are DROPPED · never set on the snapshot.
    expect(dq).not.toHaveProperty("fare_pence");
    expect(dq).not.toHaveProperty("distance_km");
    expect(dq).not.toHaveProperty("eta_minutes");
  });

  test("T0.6.1c · Fix A · string-valued numeric fields REJECTED (no Number() coercion)", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_quote: {
          kind: "estimate",
          fare_pence: "100",
          distance_km: "5",
          eta_minutes: "15",
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote!;
    expect(dq).not.toHaveProperty("fare_pence");
    expect(dq).not.toHaveProperty("distance_km");
    expect(dq).not.toHaveProperty("eta_minutes");
  });

  test("T0.6.1d · Fix A · zero fare rejected for kind='estimate' (nonsensical) · zero is only meaningful for 'free'", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_quote: {
          kind: "estimate",
          fare_pence: 0,
          distance_km: 5,
          eta_minutes: 15,
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            kind: string;
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote!;
    // Zero fare under 'estimate' is dropped · distance + eta pass.
    expect(dq.kind).toBe("estimate");
    expect(dq).not.toHaveProperty("fare_pence");
    expect(dq.distance_km).toBe(5);
    expect(dq.eta_minutes).toBe(15);
  });

  test("T0.6.1e · Fix A · legitimate positive estimate values propagate unchanged · uses authoritative coords+fare under R5 (2026-11-18)", async () => {
    installHappyPath();

    // 2026-11-18 · R5 G3-Server · an `estimate` quote now requires
    // buyer coords (matching the authoritative straight-line from
    // the seller's configured origin). The happy path installs
    // seller coords at -6.2088,106.8456 (central Jakarta). We send a
    // matching buyer pin and compute the authoritative km + fare
    // from the sealed rate card, then verify that these legitimate
    // positive values flow through unchanged.
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    const SELLER_LAT = -6.2088;
    const SELLER_LNG = 106.8456;
    const BUYER_LAT = -6.2358;
    const BUYER_LNG = 106.8456;
    const authKm = haversineKm(SELLER_LAT, SELLER_LNG, BUYER_LAT, BUYER_LNG);
    const authFare = estimateBikeFare(authKm);

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: BUYER_LAT,
          lng: BUYER_LNG,
        },
        delivery_quote: {
          kind: "estimate",
          fare_pence: authFare.fare_pence,
          distance_km: authKm,
          eta_minutes: authFare.eta_minutes,
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            kind: string;
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
            currency?: string;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote!;
    expect(dq.kind).toBe("estimate");
    expect(dq.fare_pence).toBe(authFare.fare_pence);
    expect(dq.distance_km).toBeCloseTo(authKm, 5);
    expect(dq.eta_minutes).toBe(authFare.eta_minutes);
    expect(dq.currency).toBe("IDR");
  });

  test("T0.6.2 · unknown kind token coerced to 'unknown' · no fare/distance/eta fields propagated", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_quote: {
          kind: "its_free_promise", // not in the whitelist
          fare_pence: 100000,
          distance_km: 10,
          eta_minutes: 15,
          free_reason: "haha",
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: {
            kind: string;
            fare_pence?: number;
            distance_km?: number;
            eta_minutes?: number;
            free_reason?: string | null;
          } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote;
    expect(dq!.kind).toBe("unknown");
    expect(dq).not.toHaveProperty("fare_pence");
    expect(dq).not.toHaveProperty("distance_km");
    expect(dq).not.toHaveProperty("eta_minutes");
    expect(dq).not.toHaveProperty("free_reason");
  });

  test("T0.6.3 · long free_reason string sliced to 200 characters (DoS/noise guard)", async () => {
    installHappyPath();
    const longReason = "A".repeat(5000);

    const err = await runSendCart(
      makeFormData({
        delivery_quote: { kind: "free", free_reason: longReason },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          delivery_quote: { kind: string; free_reason?: string | null } | null;
        };
      };
    };
    const dq = callArg.attachment_meta.cart.delivery_quote!;
    expect(dq.kind).toBe("free");
    expect(dq.free_reason!.length).toBeLessThanOrEqual(200);
  });
});

describe("sendCartOrderAction · Slice 0.6 · perks whitelist", () => {
  test("T0.6.4 · unknown perk tokens dropped · only whitelist survives · final list sliced to 6", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_A,
            name: "P",
            price_pence: 1,
            quantity: 1,
            perks: [
              "bogo", // allowed
              "free_drink", // allowed
              "admin_discount", // disallowed · fabrication
              "staff_only", // disallowed · fabrication
              "free_pizza", // disallowed · fabrication
              "FREE_RICE", // allowed via lowercase coercion
              "free_fries", // allowed
              "free_delivery", // allowed
              "other", // allowed
              "yet_another", // disallowed · overflow guard
            ],
          },
        ],
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { items: Array<{ perks: string[] }> } };
    };
    const perks = callArg.attachment_meta.cart.items[0]!.perks;
    // Fabrications must NOT be present.
    expect(perks).not.toContain("admin_discount");
    expect(perks).not.toContain("staff_only");
    expect(perks).not.toContain("free_pizza");
    expect(perks).not.toContain("yet_another");
    // Only known tokens remain · cap of 6 holds.
    expect(perks.length).toBeLessThanOrEqual(6);
    for (const p of perks) {
      expect(["bogo", "free_drink", "free_rice", "free_fries", "free_delivery", "other"]).toContain(p);
    }
  });
});

describe("sendCartOrderAction · Slice 0.6 · variants tampering", () => {
  test("T0.6.5 · variants capped at 6 · non-string coerced via String() · empty strings dropped", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_A,
            name: "P",
            price_pence: 1,
            quantity: 1,
            variants: [
              "size:L",
              "colour:red",
              "flavour:spicy",
              "material:cotton",
              "box:gift",
              "note:fast",
              "overflow:extra1", // 7th · must be dropped by slice(0,6)
              "overflow:extra2",
              "", // empty · must be dropped
              "   ", // whitespace-only · trimmed empty · dropped
              12345, // non-string · coerced via String()
            ],
          },
        ],
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { items: Array<{ variants: string[] }> } };
    };
    const variants = callArg.attachment_meta.cart.items[0]!.variants;
    expect(variants.length).toBeLessThanOrEqual(6);
    expect(variants).not.toContain("");
    expect(variants).not.toContain("   ");
    // Overflow entries must not survive the cap.
    expect(variants).not.toContain("overflow:extra2");
    // All entries are strings.
    for (const v of variants) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe("sendCartOrderAction · Slice 0.6 · client direct_price grant tampering", () => {
  test("T0.6.6 · client-supplied direct_price payload is NEVER reflected in the server-sent snapshot", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        direct_price: {
          tier_pct: 90,
          share_pct: 90,
          applied_pct: 99,
          capped_at_max: false,
          saving_pence: 999999,
          total_after_discount_pence: 1,
        },
      }),
    );

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: {
        cart: {
          subtotal_pence: number;
          direct_price: null | {
            applied_pct: number;
            total_after_discount_pence: number;
          };
        };
      };
    };
    const dp = callArg.attachment_meta.cart.direct_price;
    // The server-computed direct_price (or null when the ladder service
    // yields nothing) must NOT echo the client's forged 99% discount.
    if (dp !== null) {
      expect(dp.applied_pct).not.toBe(99);
      expect(dp.total_after_discount_pence).not.toBe(1);
    } else {
      expect(dp).toBeNull();
    }
    // Subtotal is server-authoritative · reflects server-side price (2500).
    expect(callArg.attachment_meta.cart.subtotal_pence).toBe(2500);
  });
});

describe("sendCartOrderAction · Slice 0.6 · buyer_notes DoS guard", () => {
  test("T0.6.7 · buyer_notes longer than 2000 chars sliced", async () => {
    installHappyPath();
    const giant = "x".repeat(10000);

    const err = await runSendCart(makeFormData({ buyer_notes: giant }));

    expectSuccess(err);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_meta: { cart: { buyer_notes: string | null } };
    };
    const notes = callArg.attachment_meta.cart.buyer_notes;
    expect(notes).not.toBeNull();
    expect(notes!.length).toBeLessThanOrEqual(2000);
  });
});

// ─── IDEMPOTENCY · opt-in design (Track C sealed 2026-10-20) ────────
//
// Track C ships server-side idempotency as an OPT-IN mechanism:
//   · If the client submits NO `send_intent_id`, behaviour is
//     unchanged · two consecutive invocations create two messages.
//     (The fallback preserves the pre-Track-C behaviour so legacy
//     callers that never supplied an intent don't regress.)
//   · If the client supplies a valid UUID `send_intent_id`, the
//     service layer uses it as the Bridge-99 idempotency key
//     (UNIQUE partial index on nex_peer_message · migration 102
//     Part C · already applied). The second insert raises Postgres
//     23505, the service catches it and returns the existing row ·
//     exactly one message exists for one logical submission.
//
// The two tests below pin both halves of the contract.

describe("sendCartOrderAction · idempotency fallback (NO send_intent_id supplied)", () => {
  test("two consecutive invocations with NO idempotency key create TWO messages (fallback behaviour preserved)", async () => {
    installHappyPath();
    const err1 = await runSendCart(makeFormData());
    expectSuccess(err1);

    const callsAfterFirst = sendPeerMessageMock.mock.calls.length;
    expect(callsAfterFirst).toBe(1);

    const err2 = await runSendCart(makeFormData());
    expectSuccess(err2);

    // When the client does NOT supply send_intent_id, the server
    // treats this as "no idempotency requested" and uses the
    // original non-idempotent insert path. Both invocations create
    // a message. This preserves the legacy behaviour for callers
    // who have not yet adopted the opt-in idempotency contract.
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(2);
  });
});

describe("sendCartOrderAction · idempotency ON (send_intent_id supplied + valid UUID)", () => {
  test("sendPeerMessage receives the UUID when the client supplies send_intent_id in FormData", async () => {
    installHappyPath();
    const fd = makeFormData();
    fd.set("send_intent_id", "11111111-2222-3333-4444-555555555555");

    const err = await runSendCart(fd);
    expectSuccess(err);

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const firstCall = sendPeerMessageMock.mock.calls[0]![0];
    expect(firstCall.send_intent_id).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
  });

  test("malformed send_intent_id (not a UUID) is dropped · the service receives undefined (safe fallback)", async () => {
    installHappyPath();
    const fd = makeFormData();
    fd.set("send_intent_id", "<script>alert(1)</script>");

    const err = await runSendCart(fd);
    expectSuccess(err);

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const firstCall = sendPeerMessageMock.mock.calls[0]![0];
    expect(firstCall.send_intent_id).toBeUndefined();
  });

  test("empty send_intent_id is dropped · the service receives undefined", async () => {
    installHappyPath();
    const fd = makeFormData();
    fd.set("send_intent_id", "");

    const err = await runSendCart(fd);
    expectSuccess(err);

    const firstCall = sendPeerMessageMock.mock.calls[0]![0];
    expect(firstCall.send_intent_id).toBeUndefined();
  });

  test("same send_intent_id across two consecutive invocations · service receives the same key twice (idempotency enforcement is the service layer's job)", async () => {
    installHappyPath();
    const sharedUuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    const fd1 = makeFormData();
    fd1.set("send_intent_id", sharedUuid);
    const err1 = await runSendCart(fd1);
    expectSuccess(err1);

    const fd2 = makeFormData();
    fd2.set("send_intent_id", sharedUuid);
    const err2 = await runSendCart(fd2);
    expectSuccess(err2);

    // The ACTION layer passes the same UUID through both times. The
    // de-duplication itself happens at the service layer (which
    // catches 23505 from the UNIQUE partial index on
    // nex_peer_message). This test anchors that the action does
    // NOT drop or regenerate the UUID between calls.
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(2);
    expect(sendPeerMessageMock.mock.calls[0]![0].send_intent_id).toBe(
      sharedUuid,
    );
    expect(sendPeerMessageMock.mock.calls[1]![0].send_intent_id).toBe(
      sharedUuid,
    );
  });
});
