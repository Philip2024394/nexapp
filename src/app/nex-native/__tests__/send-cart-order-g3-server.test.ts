// src/app/nex-native/__tests__/send-cart-order-g3-server.test.ts
//
// NEX G3-Server · sendCartOrderAction · authoritative delivery
// distance + fare authentication.
//
// Design doc: evidence/master-flow/delivery-2026-11-18/
//             G3-DESTINATION-COORD-DESIGN.md
//
// Regression anchors (owner directive 2026-11-18):
//
//   1 · When buyer coords are present in delivery_address.lat/lng:
//       a · seller coords on nex_business MUST exist · else refuse
//       b · haversine(seller, buyer) is the AUTHORITATIVE straight-line km
//       c · |authoritative - claimed| > 0.6 km → refuse (distance tampered)
//       d · estimateBikeFare(authoritative).fare_pence must equal
//           claimed fare_pence · else refuse (fare tampered against
//           an honest distance that happens to match)
//
//   2 · When buyer coords are absent for an `estimate` quote:
//       · 2026-11-18 · R5 · owner directive · REFUSE SAFELY.
//         Previously (R4) coords-absent fell back to G4-only
//         (fare-vs-claimed-km), but a tampered short km with a
//         matching tampered fare slipped through. Now the server
//         fails closed with a clear "pin your address" message.
//         Pickup / free-quote paths still pass.
//
//   3 · Malformed buyer coords (nonfinite, out-of-range, partial):
//       · hard reject before any DB work
//
//   4 · Pickup path (no delivery_address at all):
//       · unaffected · G3-Server branch never enters
//
// Scope limits (honest labelling):
//   · This test exercises the STRAIGHT-LINE haversine comparator ·
//     the sealed rate card's 1.25× road correction is applied
//     downstream inside `estimateBikeFare` · not re-asserted here.
//   · Browser-provided coordinates are not independently verified
//     by a trusted geocoder · these tests only prove that IF the
//     buyer sends a lat/lng, it is server-validated and used for
//     authoritative recomputation.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

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
          eq: vi.fn(() => ({ gte: vi.fn(() => Promise.resolve({ count: 0, error: null })) })),
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

// ─── Fixtures ──────────────────────────────────────────────────────

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const SHOP_OWNER_ID = "22222222-2222-2222-2222-222222222222";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";

// Seller origin · central Jakarta reference point.
const SELLER_LAT = -6.2088;
const SELLER_LNG = 106.8456;

// Buyer destination · ~3 km south-east of seller.
// Precomputed with haversine · roughly 3.0 km straight-line.
const BUYER_LAT = -6.2358;
const BUYER_LNG = 106.8456;

function installHappyPath(opts: {
  sellerLat?: number | null;
  sellerLng?: number | null;
} = {}) {
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
    location_lat: opts.sellerLat === undefined ? SELLER_LAT : opts.sellerLat,
    location_lng: opts.sellerLng === undefined ? SELLER_LNG : opts.sellerLng,
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
}

function makeFormData(overrides: {
  delivery_address?: Record<string, unknown> | null;
  delivery_quote?: unknown;
} = {}): FormData {
  const payload: Record<string, unknown> = {
    peer_account_id: SHOP_OWNER_ID,
    shop_id: SHOP_ID,
    shop_display_name: "Mock Shop",
    currency: "IDR",
    items: [
      { kind: "product", id: PRODUCT_A, name: "Mock Product", price_pence: 2500, quantity: 1 },
    ],
    delivery_address: overrides.delivery_address ?? null,
  };
  if (overrides.delivery_quote !== undefined) {
    payload.delivery_quote = overrides.delivery_quote;
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

function decodeRedirect(err: Error): string {
  const match = err.message.match(/^REDIRECT:(.*)$/);
  if (!match) return err.message;
  return decodeURIComponent(match[1]);
}

function expectSuccess(err: Error) {
  expect(err.message).toContain("REDIRECT:/nex-native/chat/peer/");
  expect(err.message).toContain("cart_sent=1");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Baseline · known distance ──────────────────────────────────────

// The seller/buyer coords above give an approx straight-line of
// 3.00 km (haversine). We assert the server treats this as the
// authoritative distance and recomputes the rate card against it.

describe("G3-Server · coords present · match path", () => {
  test("coords match claimed km + fare → cart accepted", async () => {
    installHappyPath();
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
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
          distance_km: authKm,
          fare_pence: authFare.fare_pence,
          eta_minutes: authFare.eta_minutes,
        },
      }),
    );

    expectSuccess(err);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
  });
});

describe("G3-Server · coords present · tampering refused", () => {
  test("claimed km tampered (far below authoritative) → refused with distance-disputed", async () => {
    installHappyPath();
    const { estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    // Claim 0.5 km for a real 3 km trip · fare matches the lie.
    const lieKm = 0.5;
    const lieFare = estimateBikeFare(lieKm);

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
          distance_km: lieKm,
          fare_pence: lieFare.fare_pence,
          eta_minutes: lieFare.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery distance disputed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("fare tampered against honest claimed km → refused with rate-card mismatch", async () => {
    installHappyPath();
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
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
          distance_km: authKm,
          // Tamper fare downward while keeping km honest.
          fare_pence: Math.max(1, authFare.fare_pence - 500000),
          eta_minutes: authFare.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery fare does not match rate card");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("boundary · claimed km within +0.6 km tolerance of authoritative → accepted · fare must match authoritative", async () => {
    installHappyPath();
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    const authKm = haversineKm(SELLER_LAT, SELLER_LNG, BUYER_LAT, BUYER_LNG);
    // Nudge claim by +0.5 km (inside the 0.6 km tolerance).
    const nearKm = authKm + 0.5;
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
          distance_km: nearKm,
          // Fare is from AUTHORITATIVE km, not the nudged claim ·
          // tolerance-pass must still re-authenticate against
          // authoritative.
          fare_pence: authFare.fare_pence,
          eta_minutes: authFare.eta_minutes,
        },
      }),
    );

    expectSuccess(err);
  });

  test("boundary · claimed km just outside -0.6 km tolerance → refused", async () => {
    installHappyPath();
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    const authKm = haversineKm(SELLER_LAT, SELLER_LNG, BUYER_LAT, BUYER_LNG);
    // 0.61 km below authoritative · outside tolerance.
    const outsideKm = authKm - 0.61;
    const outsideFare = estimateBikeFare(outsideKm);

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
          distance_km: outsideKm,
          fare_pence: outsideFare.fare_pence,
          eta_minutes: outsideFare.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery distance disputed");
  });
});

describe("G3-Server · malformed coords refused before DB work", () => {
  test("partial coords (lat only) → refused as incomplete", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: BUYER_LAT,
          // lng omitted
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 3,
          fare_pence: 1500000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain(
      "Delivery destination is incomplete",
    );
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("nonfinite lat (NaN serialised as null) → refused as incomplete", async () => {
    // JSON.stringify converts NaN to null · partial path.
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: null,
          lng: BUYER_LNG,
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 3,
          fare_pence: 1500000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery destination is incomplete");
  });

  test("lat out of range (-91) → refused as invalid", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: -91,
          lng: BUYER_LNG,
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 3,
          fare_pence: 1500000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery destination is invalid");
  });

  test("lng out of range (181) → refused as invalid", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: BUYER_LAT,
          lng: 181,
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 3,
          fare_pence: 1500000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery destination is invalid");
  });

  test("lat as string → refused as invalid (no coercion)", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          lat: "-6.2088",
          lng: BUYER_LNG,
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 3,
          fare_pence: 1500000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain("Delivery destination is invalid");
  });
});

describe("G3-Server · seller coords unconfigured → fail-closed", () => {
  test("business row missing location_lat → refuse delivery (do not fall back to trusting client km)", async () => {
    installHappyPath({ sellerLat: null });
    const { haversineKm, estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
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
          distance_km: authKm,
          fare_pence: authFare.fare_pence,
          eta_minutes: authFare.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain(
      "Delivery is not configured for this shop",
    );
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

describe("G3-Server · coords absent → refuse safely (R5 2026-11-18)", () => {
  test("delivery_address without lat/lng + honest fare for claimed km → REFUSED (no fallback to trusting client km)", async () => {
    installHappyPath();
    const { estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    const claimKm = 4.2;
    const f = estimateBikeFare(claimKm);

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          // No lat/lng.
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: claimKm,
          fare_pence: f.fare_pence,
          eta_minutes: f.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain(
      "Delivery distance can't be verified without a pinned destination",
    );
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("delivery_address without lat/lng + tampered fare → REFUSED with the same pin-your-address message", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: 4.2,
          // Would previously have been caught by G4-only fare-vs-km;
          // we now refuse earlier because the distance itself is
          // unverifiable without coords.
          fare_pence: 1200000,
          eta_minutes: 12,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain(
      "Delivery distance can't be verified without a pinned destination",
    );
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("short tampered km with matching tampered fare (the old G4-only loophole) → REFUSED", async () => {
    installHappyPath();
    const { estimateBikeFare } = await import(
      "@/lib/nex-native/bike-delivery-service"
    );
    // Lie about a 0.5 km trip (bike minimum) while the real
    // address is miles away. Pre-R5 this slipped through because
    // the claimed fare matched estimateBikeFare(0.5).
    const lieKm = 0.5;
    const lieFare = estimateBikeFare(lieKm);

    const err = await runSendCart(
      makeFormData({
        delivery_address: {
          recipient_name: "Buyer",
          phone: "081200000000",
          street: "Jl Test 1",
          city: "Jakarta",
          // Still no lat/lng.
        },
        delivery_quote: {
          kind: "estimate",
          distance_km: lieKm,
          fare_pence: lieFare.fare_pence,
          eta_minutes: lieFare.eta_minutes,
        },
      }),
    );

    expect(decodeRedirect(err)).toContain(
      "Delivery distance can't be verified without a pinned destination",
    );
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

describe("G3-Server · pickup / no delivery_address → unaffected", () => {
  test("delivery_address null + no delivery_quote → cart accepted", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: null,
      }),
    );

    expectSuccess(err);
  });

  test("delivery_address null + free-quote delivery_quote → cart accepted (free branch never enters fare auth)", async () => {
    installHappyPath();

    const err = await runSendCart(
      makeFormData({
        delivery_address: null,
        delivery_quote: {
          kind: "free",
          free_reason: "store collection",
        },
      }),
    );

    expectSuccess(err);
  });
});
