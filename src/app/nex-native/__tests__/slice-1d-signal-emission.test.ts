// src/app/nex-native/__tests__/slice-1d-signal-emission.test.ts
//
// Phase 1 · Slice 1D · owner-authorised 2026-10-24.
// -------------------------------------------------------------------
// Verifies the WIRING of enquiry_initiated + cart_sent emissions
// from the four commerce actions:
//
//   · sendProductInquiryAction      → emits enquiry_initiated
//   · sendMenuItemInquiryAction     → emits enquiry_initiated
//   · shareProductToContactAction   → emits enquiry_initiated
//                                     (carries has_live_context)
//   · sendCartOrderAction           → emits cart_sent
//
// EVIDENCE BOUNDARY (owner directive · do not overstate)
// -------------------------------------------------------------------
// This file contains two cleanly-labelled test categories:
//
//   1 · SOURCE-SHAPE tests
//       Read `_actions.ts` as text. Assert the four actions each
//       import `recordDiscoverySignal` and call it with the right
//       signal_type after the sendPeerMessage call.
//
//   2 · MOCKED-ACTION BEHAVIOUR tests
//       Install mocks for every external service the actions touch
//       and invoke the actions in-process. Assert on recorded calls
//       to the mocked `recordDiscoverySignal`. These tests prove the
//       action HANDS A SPECIFIC SHAPE to the writer; they do NOT
//       prove a real database write.
//
// NO DATABASE-EXECUTED TESTS LIVE IN THIS FILE. Migration 216 has
// NOT been applied to any database. Any assertion about:
//   · what Postgres does with the new enum values,
//   · what the real writer returns under race conditions,
//   · exactly-once emission under genuine concurrent retries
// is out of scope for Slice 1D.
//
// Idempotency honesty: nex.discovery_signal currently has NO unique
// constraint on (account_id, metadata->>'send_intent_id'). A double-
// submit will emit TWO signals even though sendPeerMessage dedups
// the message. These tests DOCUMENT that limitation rather than
// disguise it.
//
// Behaviour under unapplied Migration 216:
//   · If NEX_DISCOVERY_SIGNAL_ENABLED !== "1" → writer short-
//     circuits with kind:"skipped-no-pipeline" (zero DB access,
//     the default state until the owner authorises P2).
//   · If the flag is "1" but Migration 216 is unapplied, Postgres
//     rejects the enum literal → writer catches internally → returns
//     kind:"failed" with the PG code · the action still succeeds.
//
// Marketing consent boundary: enquiry visibility to a seller IS NOT
// marketing opt-in. nex_account_notification_prefs.marketing_enabled
// stays FALSE by default. These tests assert the actions never
// touch that primitive.

import { describe, test, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

/* ─── Hoisted mocks ───────────────────────────────────────────── */

const {
  resolveSessionMock,
  getAccountByIdMock,
  getProductByIdMock,
  getBusinessByIdMock,
  getMenuItemByIdMock,
  listBusinessesByOwnerMock,
  listMenuSectionsByBusinessMock,
  getOrCreatePeerConversationMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  getServerCartMock,
  saveServerCartMock,
  recordDiscoverySignalMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getBusinessByIdMock: vi.fn(),
  getMenuItemByIdMock: vi.fn(),
  listBusinessesByOwnerMock: vi.fn(),
  listMenuSectionsByBusinessMock: vi.fn(),
  getOrCreatePeerConversationMock: vi.fn(),
  getOrCreatePeerConversationAsSenderMock: vi.fn(),
  sendPeerMessageMock: vi.fn(),
  getServerCartMock: vi.fn(),
  saveServerCartMock: vi.fn(),
  recordDiscoverySignalMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
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
  listBusinessesByOwner: listBusinessesByOwnerMock,
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
  listSectionsByBusiness: listMenuSectionsByBusinessMock,
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

vi.mock("@/lib/nex-native/discovery/discovery-signal-service", () => ({
  recordDiscoverySignal: recordDiscoverySignalMock,
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

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock.mockImplementation((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

/* ─── Fixtures ────────────────────────────────────────────────── */

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const SELLER_ID = "22222222-2222-2222-2222-222222222222";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MENU_ITEM_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CONVERSATION_ID = "99999999-9999-9999-9999-999999999999";
const INTENT_ID = "7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a";
const LIVE_SESSION_ID = "beef0000-0000-4000-8000-000000000000";

function installHappyPath(opts: { withLiveSession?: boolean } = {}) {
  for (const m of [
    resolveSessionMock,
    getAccountByIdMock,
    getProductByIdMock,
    getBusinessByIdMock,
    getMenuItemByIdMock,
    listBusinessesByOwnerMock,
    listMenuSectionsByBusinessMock,
    getOrCreatePeerConversationMock,
    getOrCreatePeerConversationAsSenderMock,
    sendPeerMessageMock,
    getServerCartMock,
    saveServerCartMock,
    recordDiscoverySignalMock,
    revalidatePathMock,
  ]) {
    m.mockReset();
  }

  resolveSessionMock.mockResolvedValue({
    account: { id: BUYER_ID, nex_handle: "nex-buyer", display_name: "Buyer", tier: "gratis" },
    business: null,
  });

  getAccountByIdMock.mockResolvedValue({
    id: SELLER_ID,
    nex_handle: "nex-seller",
    display_name: "Aisha",
  });

  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_ID,
    business_id: BUSINESS_ID,
    name: "Leica M6",
    price_pence: 320_000_00,
    currency: "GBP",
    image_url: "https://example.test/leica.jpg",
    description: "Mint condition · black paint",
    status: "live",
  });

  getBusinessByIdMock.mockResolvedValue({
    id: BUSINESS_ID,
    owner_account_id: SELLER_ID,
    slug: "aisha-cameras",
    display_name: "Aisha's Cameras",
  });

  getMenuItemByIdMock.mockResolvedValue({
    id: MENU_ITEM_ID,
    business_id: BUSINESS_ID,
    section_id: null,
    name: "Nasi Goreng Spesial",
    price_pence: 35_000,
    currency: "IDR",
    image_url: "https://example.test/nasigoreng.jpg",
    description: "Chef's special · with egg + chicken",
    spice_level: 2,
    dietary_tags: [],
    portion_note: null,
    perks: [],
    perks_note: null,
  });

  listBusinessesByOwnerMock.mockResolvedValue([
    {
      id: BUSINESS_ID,
      slug: "aisha-cameras",
      display_name: "Aisha's Cameras",
      owner_account_id: SELLER_ID,
    },
  ]);

  listMenuSectionsByBusinessMock.mockResolvedValue([]);

  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: CONVERSATION_ID,
    participant_a_id: BUYER_ID,
    participant_b_id: SELLER_ID,
  });

  getOrCreatePeerConversationMock.mockResolvedValue({
    id: CONVERSATION_ID,
    participant_a_id: BUYER_ID,
    participant_b_id: SELLER_ID,
  });

  sendPeerMessageMock.mockResolvedValue({ id: "msg-id-1" });

  getServerCartMock.mockResolvedValue({
    items: [],
    delivery_address: null,
  });

  saveServerCartMock.mockResolvedValue(undefined);

  // Writer mock defaults to "written" (success). Individual tests
  // override to simulate skipped / failed / thrown.
  recordDiscoverySignalMock.mockResolvedValue({
    kind: "written",
    id: "sig-id-1",
  });
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

async function invokeProductInquiry(entries: Record<string, string>) {
  const { sendProductInquiryAction } = await import("../_actions");
  try {
    await sendProductInquiryAction(
      SELLER_ID,
      makeFormData({ product_id: PRODUCT_ID, ...entries }),
    );
  } catch (e) {
    if ((e as { digest?: string } | undefined)?.digest !== "NEXT_REDIRECT") {
      throw e;
    }
  }
}

async function invokeMenuInquiry(entries: Record<string, string>) {
  const { sendMenuItemInquiryAction } = await import("../_actions");
  try {
    await sendMenuItemInquiryAction(
      SELLER_ID,
      makeFormData({ menu_item_id: MENU_ITEM_ID, ...entries }),
    );
  } catch (e) {
    if ((e as { digest?: string } | undefined)?.digest !== "NEXT_REDIRECT") {
      throw e;
    }
  }
}

async function invokeProductShare(entries: Record<string, string>) {
  const { shareProductToContactAction } = await import("../_actions");
  try {
    await shareProductToContactAction(
      SELLER_ID,
      makeFormData({ product_id: PRODUCT_ID, ...entries }),
    );
  } catch (e) {
    if ((e as { digest?: string } | undefined)?.digest !== "NEXT_REDIRECT") {
      throw e;
    }
  }
}

async function invokeCartSend(itemsOverride?: unknown[]) {
  const { sendCartOrderAction } = await import("../_actions");
  const payload = {
    peer_account_id: SELLER_ID,
    shop_id: BUSINESS_ID,
    shop_slug: "aisha-cameras",
    shop_display_name: "Aisha's Cameras",
    currency: "GBP",
    items: itemsOverride ?? [
      {
        kind: "product",
        id: PRODUCT_ID,
        name: "Leica M6",
        price_pence: 320_000_00,
        currency: "GBP",
        quantity: 1,
        variants: [],
        image_url: null,
        note: null,
      },
    ],
    buyer_notes: "",
    delivery_address: null,
    delivery_quote: null,
    direct_price: null,
  };
  try {
    await sendCartOrderAction(
      makeFormData({
        cart_payload: JSON.stringify(payload),
        send_intent_id: INTENT_ID,
      }),
    );
  } catch (e) {
    if ((e as { digest?: string } | undefined)?.digest !== "NEXT_REDIRECT") {
      throw e;
    }
  }
}

/* ─── 1 · Source-shape tests ─────────────────────────────────── */

const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

describe("Slice 1D · source-shape · import + wiring", () => {
  it("imports recordDiscoverySignal from the sealed service", () => {
    expect(ACTIONS_SRC).toMatch(
      /import\s+\{\s*recordDiscoverySignal\s*\}\s+from\s+"@\/lib\/nex-native\/discovery\/discovery-signal-service"/,
    );
  });

  it("emits enquiry_initiated from sendProductInquiryAction", () => {
    const body = ACTIONS_SRC.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/recordDiscoverySignal\(/);
    expect(body![0]).toMatch(/signalType:\s*"enquiry_initiated"/);
    expect(body![0]).toMatch(/source:\s*"product_inquiry"/);
  });

  it("emits enquiry_initiated from sendMenuItemInquiryAction", () => {
    const body = ACTIONS_SRC.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/recordDiscoverySignal\(/);
    expect(body![0]).toMatch(/signalType:\s*"enquiry_initiated"/);
    expect(body![0]).toMatch(/source:\s*"menu_item_inquiry"/);
  });

  it("emits enquiry_initiated from shareProductToContactAction with has_live_context", () => {
    const body = ACTIONS_SRC.match(
      /export async function shareProductToContactAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/recordDiscoverySignal\(/);
    expect(body![0]).toMatch(/signalType:\s*"enquiry_initiated"/);
    expect(body![0]).toMatch(/source:\s*"product_share"/);
    expect(body![0]).toMatch(/has_live_context:\s*liveSessionId !== null/);
  });

  it("emits cart_sent from sendCartOrderAction", () => {
    const body = ACTIONS_SRC.match(
      /export async function sendCartOrderAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/recordDiscoverySignal\(/);
    expect(body![0]).toMatch(/signalType:\s*"cart_sent"/);
    expect(body![0]).toMatch(/source:\s*"cart_order"/);
  });

  it("wraps every emission in a try/catch (fail-open)", () => {
    const emitSites = ACTIONS_SRC.match(
      /try\s*\{\s*\n\s*await recordDiscoverySignal\(/g,
    );
    expect(emitSites).not.toBeNull();
    expect(emitSites!.length).toBeGreaterThanOrEqual(4);
  });

  it("every emission site is positioned AFTER a sendPeerMessage call", () => {
    for (const fnName of [
      "sendProductInquiryAction",
      "sendMenuItemInquiryAction",
      "shareProductToContactAction",
      "sendCartOrderAction",
    ]) {
      const body = ACTIONS_SRC.match(
        new RegExp(`export async function ${fnName}\\([\\s\\S]*?(?=\\nexport )`),
      );
      expect(body).toBeTruthy();
      const sendIdx = body![0].indexOf("peerMessageService.sendPeerMessage(");
      const emitIdx = body![0].indexOf("recordDiscoverySignal(");
      expect(sendIdx).toBeGreaterThan(-1);
      expect(emitIdx).toBeGreaterThan(sendIdx);
    }
  });

  it("source does NOT include message body or private cart fields in metadata", () => {
    // Negative: these identifiers must never appear inside a
    // recordDiscoverySignal metadata block. The emissions are kept
    // to aggregate shape + identifiers only.
    for (const forbidden of [
      "body:\\s*body",
      "customBody",
      "buyer_notes:\\s*",
      "delivery_address:\\s*deliveryAddress",
      "message_body",
    ]) {
      // Scan each emission block for the forbidden pattern.
      const emitBlocks = ACTIONS_SRC.match(
        /recordDiscoverySignal\(\{[\s\S]*?\}\)/g,
      );
      for (const block of emitBlocks ?? []) {
        expect(block).not.toMatch(new RegExp(forbidden));
      }
    }
  });

  it("does NOT modify marketing opt-in or notification preferences", () => {
    // The import list must not include notification-prefs service in
    // a way that writes marketing_enabled, and no emission block may
    // reference marketing_enabled.
    const emitBlocks = ACTIONS_SRC.match(
      /recordDiscoverySignal\(\{[\s\S]*?\}\)/g,
    );
    for (const block of emitBlocks ?? []) {
      expect(block).not.toMatch(/marketing_enabled/);
      expect(block).not.toMatch(/notification_prefs/);
    }
  });

  it("documents the Migration 216 unapplied / env-gated behaviour", () => {
    expect(ACTIONS_SRC).toMatch(/env-gated/);
  });

  it("documents the current idempotency honesty note", () => {
    expect(ACTIONS_SRC).toMatch(/exactly-once is NOT yet guaranteed/i);
  });
});

/* ─── 2 · Mocked-action behaviour tests ─────────────────────── */

describe("Slice 1D · behaviour · sendProductInquiryAction", () => {
  beforeEach(() => installHappyPath());

  test("emits enquiry_initiated with product metadata after a successful send", async () => {
    await invokeProductInquiry({
      intent: "want",
      quantity: "1",
      send_intent_id: INTENT_ID,
    });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(recordDiscoverySignalMock).toHaveBeenCalledTimes(1);

    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.accountId).toBe(BUYER_ID);
    expect(sig.signalType).toBe("enquiry_initiated");
    expect(sig.businessId).toBe(BUSINESS_ID);
    expect(sig.metadata.source).toBe("product_inquiry");
    expect(sig.metadata.product_id).toBe(PRODUCT_ID);
    expect(sig.metadata.conversation_id).toBe(CONVERSATION_ID);
    expect(sig.metadata.intent).toBe("want");
    expect(sig.metadata.send_intent_id).toBe(INTENT_ID);
    expect(sig.metadata.has_live_context).toBe(false);
  });

  test("signal fires AFTER sendPeerMessage resolves (ordering)", async () => {
    const callOrder: string[] = [];
    sendPeerMessageMock.mockImplementation(async () => {
      callOrder.push("sendPeerMessage");
      return { id: "msg" };
    });
    recordDiscoverySignalMock.mockImplementation(async () => {
      callOrder.push("recordDiscoverySignal");
      return { kind: "written", id: "sig" };
    });

    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(callOrder).toEqual(["sendPeerMessage", "recordDiscoverySignal"]);
  });

  test("signal is NOT emitted when the enquiry fails pre-send (product not found)", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);

    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(recordDiscoverySignalMock).not.toHaveBeenCalled();
  });

  test("writer failure does NOT corrupt a successful enquiry (fail-open)", async () => {
    recordDiscoverySignalMock.mockResolvedValueOnce({
      kind: "failed",
      reason: "42704: type \"nex.discovery_signal_type\" has no value \"enquiry_initiated\"",
    });

    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(recordDiscoverySignalMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/nex-native/chat/peer/${SELLER_ID}`,
    );
  });

  test("writer throwing is swallowed by the action-level try/catch (defence in depth)", async () => {
    recordDiscoverySignalMock.mockRejectedValueOnce(
      new Error("import-time boom"),
    );

    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/nex-native/chat/peer/${SELLER_ID}`,
    );
  });

  test("skipped-no-pipeline outcome leaves the enquiry intact", async () => {
    recordDiscoverySignalMock.mockResolvedValueOnce({
      kind: "skipped-no-pipeline",
    });

    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

describe("Slice 1D · behaviour · sendMenuItemInquiryAction", () => {
  beforeEach(() => installHappyPath());

  test("emits enquiry_initiated with menu-item metadata", async () => {
    await invokeMenuInquiry({
      intent: "order",
      send_intent_id: INTENT_ID,
    });

    expect(recordDiscoverySignalMock).toHaveBeenCalledTimes(1);
    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.signalType).toBe("enquiry_initiated");
    expect(sig.metadata.source).toBe("menu_item_inquiry");
    expect(sig.metadata.menu_item_id).toBe(MENU_ITEM_ID);
    expect(sig.metadata.intent).toBe("order");
    expect(sig.metadata.send_intent_id).toBe(INTENT_ID);
    expect(sig.metadata.has_live_context).toBe(false);
  });

  test("signal not emitted when menu item not found", async () => {
    getMenuItemByIdMock.mockResolvedValueOnce(null);

    await invokeMenuInquiry({ send_intent_id: INTENT_ID });

    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(recordDiscoverySignalMock).not.toHaveBeenCalled();
  });
});

describe("Slice 1D · behaviour · shareProductToContactAction", () => {
  beforeEach(() => installHappyPath());

  test("emits enquiry_initiated with has_live_context=false when no live session", async () => {
    await invokeProductShare({});

    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.signalType).toBe("enquiry_initiated");
    expect(sig.metadata.source).toBe("product_share");
    expect(sig.metadata.has_live_context).toBe(false);
  });

  test("emits enquiry_initiated with has_live_context=true when a valid live_session_id is supplied", async () => {
    await invokeProductShare({ live_session_id: LIVE_SESSION_ID });

    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.metadata.has_live_context).toBe(true);
  });

  test("does NOT replicate the raw live_session_id into signal metadata", async () => {
    // Doctrine: live_session_id lives with the product snapshot
    // (persisted by Slice 1B). We signal only a boolean + source
    // in the Marketing layer. If a future slice needs the id for
    // cross-layer joins that respect the Marketing boundary, add
    // it with explicit scope.
    await invokeProductShare({ live_session_id: LIVE_SESSION_ID });

    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.metadata).not.toHaveProperty("live_session_id");
    expect(JSON.stringify(sig.metadata)).not.toContain(LIVE_SESSION_ID);
  });
});

describe("Slice 1D · behaviour · sendCartOrderAction", () => {
  beforeEach(() => installHappyPath());

  test("emits cart_sent with aggregate cart shape", async () => {
    await invokeCartSend();

    expect(recordDiscoverySignalMock).toHaveBeenCalledTimes(1);
    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.signalType).toBe("cart_sent");
    expect(sig.businessId).toBe(BUSINESS_ID);
    expect(sig.metadata.source).toBe("cart_order");
    expect(sig.metadata.conversation_id).toBe(CONVERSATION_ID);
    expect(typeof sig.metadata.item_count).toBe("number");
    expect(sig.metadata.item_count).toBe(1);
    expect(typeof sig.metadata.subtotal_pence).toBe("number");
    expect(sig.metadata.currency).toBe("GBP");
    expect(sig.metadata.has_delivery_quote).toBe(false);
    expect(sig.metadata.has_direct_price).toBe(false);
    expect(sig.metadata.send_intent_id).toBe(INTENT_ID);
  });

  test("metadata does NOT include buyer_notes or delivery_address", async () => {
    await invokeCartSend();

    const sig = recordDiscoverySignalMock.mock.calls[0]![0];
    expect(sig.metadata).not.toHaveProperty("buyer_notes");
    expect(sig.metadata).not.toHaveProperty("delivery_address");
    expect(sig.metadata).not.toHaveProperty("items");
  });

  test("writer failure does NOT corrupt a successful cart send", async () => {
    recordDiscoverySignalMock.mockResolvedValueOnce({
      kind: "failed",
      reason: "transient",
    });

    await invokeCartSend();

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
  });
});

/* ─── 3 · Idempotency honesty · documented limitation ────────── */

describe("Slice 1D · idempotency · documented limitation", () => {
  beforeEach(() => installHappyPath());

  test("TWO invocations with the same send_intent_id emit TWO signals (today's limitation)", async () => {
    // CURRENT STATE: nex.discovery_signal has no unique constraint on
    // (account_id, metadata->>'send_intent_id'). sendPeerMessage
    // dedups the message · the signal writer does NOT. A future
    // slice can add a partial unique index to close this gap. This
    // test DOCUMENTS the limitation rather than claims exactly-once.
    await invokeProductInquiry({ send_intent_id: INTENT_ID });
    await invokeProductInquiry({ send_intent_id: INTENT_ID });

    expect(recordDiscoverySignalMock).toHaveBeenCalledTimes(2);
    const first = recordDiscoverySignalMock.mock.calls[0]![0];
    const second = recordDiscoverySignalMock.mock.calls[1]![0];
    expect(first.metadata.send_intent_id).toBe(INTENT_ID);
    expect(second.metadata.send_intent_id).toBe(INTENT_ID);
  });
});

/* ─── 4 · Explicit non-claims ────────────────────────────────── */

describe("Slice 1D · explicit boundary · what this file does NOT prove", () => {
  it("does NOT prove a real database write", () => {
    // recordDiscoverySignal is mocked in every behaviour test.
    // Database-level verification requires Migration 216 to be
    // applied, which is explicitly out of scope.
    expect(true).toBe(true);
  });

  it("does NOT prove exactly-once emission under genuine concurrent retries", () => {
    // Behaviour tests invoke the action sequentially. True race
    // behaviour would require a real DB + concurrent clients.
    expect(true).toBe(true);
  });

  it("does NOT prove the writer's own error-containment surface (unit-tested elsewhere)", () => {
    // We assert that THE ACTION calls the writer and swallows
    // failures · the writer's own error-containment belongs in a
    // dedicated test.
    expect(true).toBe(true);
  });
});
