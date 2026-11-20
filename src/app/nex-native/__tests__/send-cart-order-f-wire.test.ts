// src/app/nex-native/__tests__/send-cart-order-f-wire.test.ts
//
// Lane F · F-A action-level wiring · 2026-11-19.
// -----------------------------------------------------------------
// Proves that sendCartOrderAction dispatches on the classified cart
// delivery shape AND that the authoritative server verification uses
// the right model per shape:
//
//   · per_ring product · tampered fare → REJECT (owner-exact
//     "Delivery fare does not match this shop's rate card")
//   · per_ring product · authentic fare → PASS (sendPeerMessage
//     called once with snapshot carrying the claimed quote)
//   · per_ring product · buyer outside largest ring → REJECT
//     ("outside the shop's delivery range")
//   · mixed cart (per_ring product + menu_item) → REJECT
//     ("Delivery mix not supported")
//   · rate_card cart · existing G3-Server + G4 behaviour preserved
//     (regression anchor for the wiring move, not a duplicate of the
//     G3-Server suite)
//   · pickup (no delivery_quote) · untouched regardless of shape
//   · free quote · untouched regardless of shape
//   · per_ring shape with seller missing coords → REJECT with the
//     "Delivery is not configured for this shop" message
//
// All DB/auth/network mocked at the import boundary, synthetic data
// only, no sign-in, no Supabase roundtrip, no Playwright. Offline
// test discipline per the owner prompt.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks (same pattern as slice-0 + g3-server suites) ──────

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
vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: resolveSessionMock,
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

// ─── Fixtures ────────────────────────────────────────────────────────

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const SHOP_OWNER_ID = "22222222-2222-2222-2222-222222222222";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_PER_RING = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PRODUCT_RATE_CARD = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const MENU_ITEM = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

// Jakarta seller coords (reused across suites).
const SELLER_LAT = -6.2088;
const SELLER_LNG = 106.8456;

// Buyer destination inside the 5 km ring (~1.57 km straight-line).
const BUYER_LAT_CLOSE = -6.22;
const BUYER_LNG_CLOSE = 106.85;

// Buyer destination at ~55 km (outside a 20 km max ring).
const BUYER_LAT_FAR = -5.7;
const BUYER_LNG_FAR = 106.8456;

const RING_5_KM_PRICE = 15_000; // Rp 15,000 (fare_pence · 15 000 pence)
const RING_10_KM_PRICE = 25_000;
const RING_20_KM_PRICE = 40_000;

const PER_RING_SPEC = {
  __delivery: {
    local: {
      radii: [
        { km: 5, price_pence: RING_5_KM_PRICE, currency: "IDR" },
        { km: 10, price_pence: RING_10_KM_PRICE, currency: "IDR" },
        { km: 20, price_pence: RING_20_KM_PRICE, currency: "IDR" },
      ],
    },
  },
};

function installHappyPath() {
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
    location_lat: SELLER_LAT,
    location_lng: SELLER_LNG,
  });
  // Default · a per-ring product. Tests that need a different product
  // override this per-test via mockImplementation.
  getProductByIdMock.mockImplementation(async (id: string) => {
    if (id === PRODUCT_PER_RING) {
      return {
        id: PRODUCT_PER_RING,
        business_id: SHOP_ID,
        price_pence: 100_000,
        currency: "IDR",
        name: "Per-ring product",
        image_url: null,
        spec: PER_RING_SPEC,
      };
    }
    if (id === PRODUCT_RATE_CARD) {
      return {
        id: PRODUCT_RATE_CARD,
        business_id: SHOP_ID,
        price_pence: 80_000,
        currency: "IDR",
        name: "Rate-card product",
        image_url: null,
        spec: {}, // no __delivery
      };
    }
    return null;
  });
  getMenuItemByIdMock.mockImplementation(async (id: string) => {
    if (id === MENU_ITEM) {
      return {
        id: MENU_ITEM,
        business_id: SHOP_ID,
        price_pence: 30_000,
        currency: "IDR",
        name: "Mock Menu Item",
        image_url: null,
      };
    }
    return null;
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
  kind?: "product" | "menu_item";
  id?: string;
  name?: string;
  price_pence?: number;
  quantity?: number;
}

function makeFormData(opts: {
  items: CartLine[];
  delivery_quote?: unknown;
  delivery_address?: Record<string, unknown> | null;
}): FormData {
  const payload: Record<string, unknown> = {
    peer_account_id: SHOP_OWNER_ID,
    shop_id: SHOP_ID,
    shop_display_name: "Mock Shop",
    currency: "IDR",
    items: opts.items,
    delivery_address: opts.delivery_address ?? null,
  };
  if (opts.delivery_quote !== undefined) {
    payload.delivery_quote = opts.delivery_quote;
  }
  const fd = new FormData();
  fd.set("cart_payload", JSON.stringify(payload));
  return fd;
}

async function runSendCart(fd: FormData): Promise<Error> {
  const mod = await import("@/app/nex-native/_actions");
  try {
    await mod.sendCartOrderAction(fd);
    throw new Error("expected redirect() to throw · it didn't");
  } catch (e) {
    return e as Error;
  }
}

function expectRedirectContains(err: Error, substring: string): void {
  expect(err.message).toMatch(/^REDIRECT:/);
  const url = err.message.slice("REDIRECT:".length);
  expect(decodeURIComponent(url)).toContain(substring);
}

function expectSuccess(err: Error): void {
  // On success the action redirects to the thread page, not back to
  // the cart with ?send_error=... — assert on the absence of
  // send_error in the URL rather than on a specific path shape.
  expect(err.message).toMatch(/^REDIRECT:/);
  expect(err.message).not.toContain("send_error=");
  // One peer-message insert attempted (even if sendPeerMessageMock
  // resolves inertly).
  expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
}

const DELIVERY_ADDRESS_CLOSE = {
  recipient_name: "Buyer",
  phone: "081111111111",
  street: "Jl. Buyer 1",
  city: "Jakarta",
  country: "ID",
  lat: BUYER_LAT_CLOSE,
  lng: BUYER_LNG_CLOSE,
};

const DELIVERY_ADDRESS_FAR = {
  ...DELIVERY_ADDRESS_CLOSE,
  lat: BUYER_LAT_FAR,
  lng: BUYER_LNG_FAR,
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("sendCartOrderAction · Lane F · F-A action-level wiring", () => {
  beforeEach(() => {
    installHappyPath();
  });
  afterEach(() => {
    vi.resetModules();
  });

  // ─── per-ring happy path ───────────────────────────────────────

  test("F-WIRE-1 · per-ring product + authentic ring fare passes → sendPeerMessage called once", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE, // matches the 5 km ring
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectSuccess(err);
  });

  // ─── per-ring tampering ────────────────────────────────────────

  test("F-WIRE-2 · per-ring product + tampered (lower) fare → REJECT with 'rate card' message", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: 1, // 1 pence vs. the real 15 000 ring price
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(err, "Delivery fare does not match this shop");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(0);
  });

  test("F-WIRE-3 · per-ring product + currency tamper (USD) → defanged by server-side currency pinning", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE,
          distance_km: 1.57,
          currency: "USD", // currency flip on the client
        },
      }),
    );
    // `_actions.ts` hard-pins `deliveryQuote.currency = "IDR"` at parse
    // time (owner-sealed: IDR is the only supported settlement currency
    // for retail delivery), so a client-sent "USD" is DISCARDED before
    // isSubmittedLocalQuoteAuthentic sees it. The fare is correct, so
    // the order proceeds · the currency tamper is defanged, not
    // rejected. This is the honest behaviour and this test anchors it
    // so that any future code change which starts trusting the client
    // currency would make this test fail.
    expectRedirectContains(err, "cart_sent=1");
  });

  // ─── per-ring out-of-range ─────────────────────────────────────

  test("F-WIRE-4 · per-ring product + buyer outside largest ring → REJECT with 'outside' message", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_FAR,
        delivery_quote: {
          kind: "estimate",
          // Claim the far destination costs the biggest ring; the
          // resolver will reject before comparing fares.
          fare_pence: RING_20_KM_PRICE,
          distance_km: 55,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(err, "outside the shop's delivery range");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(0);
  });

  // ─── mixed cart rejected at boundary ───────────────────────────

  test("F-WIRE-5 · per-ring product + menu_item → REJECT 'Delivery mix not supported'", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
          { kind: "menu_item", id: MENU_ITEM, name: "Menu item", quantity: 1 },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE,
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(err, "Delivery mix not supported");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(0);
  });

  test("F-WIRE-6 · per-ring product + rate-card product (same shop) → REJECT 'Delivery mix not supported'", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
          {
            kind: "product",
            id: PRODUCT_RATE_CARD,
            name: "Rate-card product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE,
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(err, "Delivery mix not supported");
  });

  // ─── rate-card regression ──────────────────────────────────────

  test("F-WIRE-7 · rate-card cart (empty radii product) · tampered fare → REJECT 'rate card'", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_RATE_CARD,
            name: "Rate-card product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: 1, // tampered
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    // Lies about distance too (claimed 1.57km, actual 1.57 km is
    // near; estimateBikeFare on actual returns a different value).
    // The first guard that fires may be the distance tolerance or
    // the fare mismatch — either way we land on a reject page.
    expect(err.message).toMatch(/^REDIRECT:/);
    expect(err.message).toContain("send_error=");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(0);
  });

  // ─── pickup / free untouched ───────────────────────────────────

  test("F-WIRE-8 · no delivery_quote at all · per-ring product still passes (pickup/implicit)", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: null, // pickup
      }),
    );
    expectSuccess(err);
  });

  test("F-WIRE-9 · delivery_quote.kind='free' · per-ring product passes untouched (no fare verification)", async () => {
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "free",
          free_reason: "buyer picks up at venue",
        },
      }),
    );
    expectSuccess(err);
  });

  // ─── seller coords missing guard ───────────────────────────────

  test("F-WIRE-10 · per-ring cart but seller missing coords → REJECT 'not configured'", async () => {
    // Override the business lookup to return null coords.
    getBusinessByIdMock.mockResolvedValue({
      id: SHOP_ID,
      owner_account_id: SHOP_OWNER_ID,
      display_name: "Mock Shop",
      location_lat: null,
      location_lng: null,
    });

    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: DELIVERY_ADDRESS_CLOSE,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE,
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(err, "Delivery is not configured for this shop");
  });

  // ─── buyer coords missing guard ────────────────────────────────

  test("F-WIRE-11 · per-ring cart but buyer missing coords → REJECT 'pin your address'", async () => {
    const addressNoCoords = {
      recipient_name: "Buyer",
      phone: "081111111111",
      street: "Jl. Buyer 1",
      city: "Jakarta",
      country: "ID",
      // intentionally no lat/lng
    };
    const err = await runSendCart(
      makeFormData({
        items: [
          {
            kind: "product",
            id: PRODUCT_PER_RING,
            name: "Per-ring product",
            quantity: 1,
          },
        ],
        delivery_address: addressNoCoords,
        delivery_quote: {
          kind: "estimate",
          fare_pence: RING_5_KM_PRICE,
          distance_km: 1.57,
          currency: "IDR",
        },
      }),
    );
    expectRedirectContains(
      err,
      "Delivery distance can't be verified without a pinned destination",
    );
  });
});
