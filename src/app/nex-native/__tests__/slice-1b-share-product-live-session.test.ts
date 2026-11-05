// src/app/nex-native/__tests__/slice-1b-share-product-live-session.test.ts
//
// Phase 1 · Slice 1B · owner-authorised 2026-10-24.
// -------------------------------------------------------------------
// Closes R5 from the Risk Register of
// docs/doctrine/_retired/nex-commerce-live-relationship-plan-2026-10-24.md (retired 2026-11-06):
// `shareProductToContactAction` previously dropped the composer-
// supplied `live_session_id` on write. The viewer-side "Order now"
// CTA on a NEX Live broadcast lost its originating-session context
// the moment it crossed into the chat message store.
//
// This slice:
//   · adds optional `live_session_id` to NexPeerProductSnapshot
//     (TypeScript-only extension · attachment_meta JSONB column
//     accepts the addition without a migration)
//   · reads + UUID-shape-validates the field in
//     shareProductToContactAction
//   · persists the validated id (or null) alongside the frozen
//     product snapshot
//
// IMPORTANT · G2 BLOCKER
// -----------------------------------------------------------------
// This slice does NOT verify that the live session exists OR that
// `peerAccountId` is the actual broadcaster. Those checks require
// the `nex_live_session` table, which does not exist yet (Phase 2
// scope per the saved plan §5.4 / Risk Register R3).
//
// A client-supplied live_session_id is therefore trusted ONLY as a
// historical "the client claims this came from session X" reference.
// Downstream renderers MUST perform a server-side session lookup
// before displaying "LIVE NOW" (G2 renderer requirement, documented
// in the NexPeerProductSnapshot JSDoc).
//
// This test file reflects that boundary honestly: tests cover shape
// validation + persistence + graceful-malformed-drop, NOT session
// existence or broadcaster-ownership (which are G2 work).
//
// Mix of source-shape tests (file-level regex) and behaviour tests
// (full mock harness, same pattern as send-cart-order-slice-0).

import { describe, test, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

// ─── Source-shape fixtures ─────────────────────────────────────────

const ACTIONS = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

const SERVICE = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "lib",
    "nex-native",
    "peer-message-service.ts",
  ),
  "utf8",
);

const UUID_PATTERN =
  /\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i/;

describe("Slice 1B · source-shape · NexPeerProductSnapshot extension", () => {
  it("declares live_session_id as optional nullable string", () => {
    expect(SERVICE).toMatch(/live_session_id\?:\s*string\s*\|\s*null/);
  });

  it("documents the field as a historical reference, NOT a liveness claim", () => {
    expect(SERVICE).toMatch(/HISTORICAL REFERENCE/);
    expect(SERVICE).toMatch(/NOT a\s*\n?\s*\*?\s*liveness claim/);
  });

  it("documents the G2 downstream-renderer requirement", () => {
    expect(SERVICE).toMatch(/nex_live_session table from Phase 2/);
  });
});

describe("Slice 1B · source-shape · shareProductToContactAction", () => {
  const BODY_REGEX =
    /export async function shareProductToContactAction\([\s\S]*?(?=\nexport )/;

  it("isolates the function body for inspection", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body).toBeTruthy();
  });

  it("reads live_session_id from FormData", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body![0]).toMatch(/formData\.get\("live_session_id"\)/);
  });

  it("validates live_session_id against the canonical UUID shape", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body![0]).toMatch(UUID_PATTERN);
  });

  it("falls back to null on shape failure (graceful · never throws)", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body![0]).toMatch(
      /liveSessionId\s*=\s*[\s\S]*?UUID_SHAPE\.test\(liveSessionRaw\)[\s\S]*?:\s*null/,
    );
  });

  it("passes liveSessionId through to the product snapshot", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body![0]).toMatch(/live_session_id:\s*liveSessionId/);
  });

  it("includes the G2-blocker documentation inline", () => {
    const body = ACTIONS.match(BODY_REGEX);
    expect(body![0]).toMatch(/BLOCKED by G2/);
    expect(body![0]).toMatch(/nex_live_session table/);
    expect(body![0]).toMatch(/historical reference/);
  });
});

// ─── Behaviour fixtures · full mock harness ────────────────────────

const {
  resolveSessionMock,
  getProductByIdMock,
  getBusinessByIdMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getBusinessByIdMock: vi.fn(),
  getOrCreatePeerConversationAsSenderMock: vi.fn(),
  sendPeerMessageMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: vi.fn(),
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
  getMenuItemById: vi.fn(),
  listMenuItemsByBusiness: vi.fn(() => []),
  createMenuItem: vi.fn(),
}));

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: vi.fn(),
  getOrCreatePeerConversationAsSender: getOrCreatePeerConversationAsSenderMock,
  findPeerConversation: vi.fn(),
}));

vi.mock("@/lib/nex-native/peer-message-service", () => ({
  sendPeerMessage: sendPeerMessageMock,
}));

vi.mock("@/lib/nex-native/cart-service", () => ({
  getServerCart: vi.fn(),
  saveServerCart: vi.fn(),
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
  redirect: redirectMock.mockImplementation((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

// ─── Behaviour fixtures ────────────────────────────────────────────

const SHARER_ID = "11111111-1111-1111-1111-111111111111";
const PEER_ID = "22222222-2222-2222-2222-222222222222";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LIVE_SESSION_ID = "7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a";
const CONVERSATION_ID = "99999999-9999-9999-9999-999999999999";

function installHappyPath() {
  resolveSessionMock.mockReset();
  getProductByIdMock.mockReset();
  getBusinessByIdMock.mockReset();
  getOrCreatePeerConversationAsSenderMock.mockReset();
  sendPeerMessageMock.mockReset();
  revalidatePathMock.mockReset();

  resolveSessionMock.mockResolvedValue({
    account: { id: SHARER_ID },
    business: null,
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
    owner_account_id: PEER_ID,
    slug: "aisha-cameras",
    display_name: "Aisha's Cameras",
  });

  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: CONVERSATION_ID,
    participant_a_id: SHARER_ID,
    participant_b_id: PEER_ID,
  });

  sendPeerMessageMock.mockResolvedValue({ id: "msg-id" });
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

async function runShare(formEntries: Record<string, string>): Promise<void> {
  const { shareProductToContactAction } = await import("../_actions");
  const fd = makeFormData({
    product_id: PRODUCT_ID,
    ...formEntries,
  });
  try {
    await shareProductToContactAction(PEER_ID, fd);
  } catch (e) {
    // `redirect()` throws a NEXT_REDIRECT marker · expected after
    // a successful send.
    const digest = (e as { digest?: string } | undefined)?.digest;
    if (digest !== "NEXT_REDIRECT") throw e;
  }
}

describe("Slice 1B · behaviour · live_session_id persistence", () => {
  beforeEach(() => {
    installHappyPath();
  });

  test("valid UUID is persisted into the product snapshot", async () => {
    await runShare({ live_session_id: LIVE_SESSION_ID });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_type).toBe("product");
    expect(call.attachment_meta.product.live_session_id).toBe(
      LIVE_SESSION_ID,
    );
  });

  test("missing field (ordinary non-Live share) persists live_session_id as null", async () => {
    await runShare({});

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_type).toBe("product");
    expect(call.attachment_meta.product.live_session_id).toBeNull();
  });

  test("malformed UUID is dropped silently (snapshot carries null, no throw)", async () => {
    await runShare({ live_session_id: "not-a-uuid" });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_meta.product.live_session_id).toBeNull();
  });

  test("empty-string live_session_id is dropped silently", async () => {
    await runShare({ live_session_id: "   " });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_meta.product.live_session_id).toBeNull();
  });

  test("whitespace-padded UUID is accepted after trim", async () => {
    await runShare({ live_session_id: `  ${LIVE_SESSION_ID}  ` });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_meta.product.live_session_id).toBe(
      LIVE_SESSION_ID,
    );
  });

  test("ordinary product-share side-effects remain unchanged (body + snapshot + revalidate)", async () => {
    await runShare({ live_session_id: LIVE_SESSION_ID });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.conversation_id).toBe(CONVERSATION_ID);
    expect(call.sender_account_id).toBe(SHARER_ID);
    expect(call.body).toContain("Aisha's Cameras");
    expect(call.attachment_meta.product.product_id).toBe(PRODUCT_ID);
    expect(call.attachment_meta.product.name).toBe("Leica M6");

    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/nex-native/chat/peer/${PEER_ID}`,
    );
  });

  test("UPPERCASE UUID is accepted (shape regex is /i)", async () => {
    const upper = LIVE_SESSION_ID.toUpperCase();
    await runShare({ live_session_id: upper });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_meta.product.live_session_id).toBe(upper);
  });

  test("almost-UUID (one short) is rejected", async () => {
    const almost = LIVE_SESSION_ID.slice(0, -1);
    await runShare({ live_session_id: almost });

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0];
    expect(call.attachment_meta.product.live_session_id).toBeNull();
  });
});

describe("Slice 1B · G2 boundary · behaviour", () => {
  beforeEach(() => {
    installHappyPath();
  });

  test("no DB existence check is performed on the supplied live_session_id (G2 blocker · nex_live_session table absent)", async () => {
    await runShare({ live_session_id: LIVE_SESSION_ID });

    // Only the mocked services that this slice IS authorised to touch
    // should have been called. There is NO call into any live-session
    // service · the table does not exist yet. If a future Phase 2
    // slice adds such a lookup, that lookup must be added to this
    // assertion so the boundary stays explicit.
    expect(getProductByIdMock).toHaveBeenCalledTimes(1);
    expect(getBusinessByIdMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
  });

  test("broadcaster ownership of the supplied live_session_id is NOT verified (G2 blocker)", async () => {
    // A client could send live_session_id for a session that
    // belongs to a different broadcaster. Slice 1B accepts the
    // UUID as a HISTORICAL REFERENCE only. The persisted value
    // reflects what the client claimed · it is not proof of
    // broadcaster ownership. Downstream renderers must perform
    // this check once the nex_live_session table exists (Phase 2).
    const differentBroadcasterSession = "beef0000-0000-4000-8000-000000000000";
    await runShare({ live_session_id: differentBroadcasterSession });

    const call = sendPeerMessageMock.mock.calls[0]![0];
    // Field persists as supplied · no server-side rejection.
    expect(call.attachment_meta.product.live_session_id).toBe(
      differentBroadcasterSession,
    );
  });
});
