// src/app/nex-native/__tests__/slice-0.8-commerce-inquiries.test.ts
//
// NEX Slice 0.8 · sender-aware privacy enforcement for product and
// menu-item inquiry server actions.
// Owner-authorised 2026-10-18.
// -------------------------------------------------------------------
// Enforces the same recipient-eligibility rule that Slice 0.75 added
// to the cart-order flow · a shop owner's `who_can_message =
// 'contacts'` preference is honoured when the buyer has NO prior
// conversation. Existing conversations retain the sealed NEX
// policy (gate bypass · buyers who have chatted before keep access).
//
// Target actions · `src/app/nex-native/_actions.ts`
//   · sendProductInquiryAction(peerAccountId, formData)   (line 1719)
//   · sendMenuItemInquiryAction(peerAccountId, formData)  (line 1810)
//
// 4 scenarios × 2 actions = 8 tests + 2 happy-path regression tests.
// Pure mocked · zero DB · zero network.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  resolveSessionMock,
  getProductByIdMock,
  getMenuItemByIdMock,
  listBusinessesByOwnerMock,
  listSectionsByBusinessMock,
  getOrCreatePeerConversationMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getMenuItemByIdMock: vi.fn(),
  listBusinessesByOwnerMock: vi.fn(),
  listSectionsByBusinessMock: vi.fn(),
  getOrCreatePeerConversationMock: vi.fn(),
  getOrCreatePeerConversationAsSenderMock: vi.fn(),
  sendPeerMessageMock: vi.fn(),
  revalidatePathMock: vi.fn(),
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
  getBusinessById: vi.fn(),
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
  listSectionsByBusiness: listSectionsByBusinessMock,
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
  getServerCart: vi.fn(() => ({ items: [], delivery_address: null })),
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
const MENU_ITEM_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function installHappyPath() {
  resolveSessionMock.mockReset();
  getProductByIdMock.mockReset();
  getMenuItemByIdMock.mockReset();
  listBusinessesByOwnerMock.mockReset();
  listSectionsByBusinessMock.mockReset();
  getOrCreatePeerConversationMock.mockReset();
  getOrCreatePeerConversationAsSenderMock.mockReset();
  sendPeerMessageMock.mockReset();

  resolveSessionMock.mockResolvedValue({
    account: {
      id: BUYER_ID,
      nex_handle: "nex-10001",
      display_name: "Buyer",
      tier: "gratis",
    },
  });
  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_A,
    business_id: SHOP_ID,
    price_pence: 2500,
    currency: "IDR",
    name: "Mock Product",
    image_url: null,
    description: "A thing.",
  });
  getMenuItemByIdMock.mockResolvedValue({
    id: MENU_ITEM_A,
    business_id: SHOP_ID,
    price_pence: 1500,
    currency: "IDR",
    name: "Mock Dish",
    image_url: null,
    description: "A tasty bite.",
    section_id: null,
    spice_level: null,
    dietary_tags: [],
    portion_note: null,
    perks: [],
    perks_note: null,
  });
  listBusinessesByOwnerMock.mockResolvedValue([
    {
      id: SHOP_ID,
      owner_account_id: SHOP_OWNER_ID,
      slug: "mock-shop",
      display_name: "Mock Shop",
    },
  ]);
  listSectionsByBusinessMock.mockResolvedValue([]);
  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: "conv-id",
    participant_a_id: BUYER_ID < SHOP_OWNER_ID ? BUYER_ID : SHOP_OWNER_ID,
    participant_b_id: BUYER_ID < SHOP_OWNER_ID ? SHOP_OWNER_ID : BUYER_ID,
  });
  sendPeerMessageMock.mockResolvedValue({ id: "msg-id" });
}

function makeProductFormData(
  overrides: {
    product_id?: string;
    intent?: string;
    quantity?: string;
    body?: string;
  } = {},
): FormData {
  const fd = new FormData();
  fd.set("product_id", overrides.product_id ?? PRODUCT_A);
  fd.set("intent", overrides.intent ?? "ask");
  fd.set("quantity", overrides.quantity ?? "1");
  if (overrides.body !== undefined) fd.set("body", overrides.body);
  return fd;
}

function makeMenuItemFormData(
  overrides: {
    menu_item_id?: string;
    intent?: string;
    body?: string;
  } = {},
): FormData {
  const fd = new FormData();
  fd.set("menu_item_id", overrides.menu_item_id ?? MENU_ITEM_A);
  fd.set("intent", overrides.intent ?? "ask");
  if (overrides.body !== undefined) fd.set("body", overrides.body);
  return fd;
}

async function runProductInquiry(fd: FormData): Promise<Error> {
  const { sendProductInquiryAction } = await import("../_actions");
  try {
    await sendProductInquiryAction(SHOP_OWNER_ID, fd);
    throw new Error("sendProductInquiryAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

async function runMenuItemInquiry(fd: FormData): Promise<Error> {
  const { sendMenuItemInquiryAction } = await import("../_actions");
  try {
    await sendMenuItemInquiryAction(SHOP_OWNER_ID, fd);
    throw new Error("sendMenuItemInquiryAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

// ─── Reset mocks between tests ──────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── sendProductInquiryAction (Slice 0.8) ───────────────────────────

describe("sendProductInquiryAction · Slice 0.8 · recipient-eligibility (new conversation)", () => {
  test("T0.8.P.1 · prohibited new conversation · redirect with product_error=contacts_only · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runProductInquiry(makeProductFormData());

    expect(err.message).toContain("REDIRECT:");
    expect(err.message).toContain(`/nex-native/chat/peer/${SHOP_OWNER_ID}`);
    expect(err.message).toContain("product_error=contacts_only");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.8.P.2 · permitted new conversation · message sent exactly once · sender-aware was called", async () => {
    installHappyPath();

    const err = await runProductInquiry(makeProductFormData());

    expect(err.message).toContain(`REDIRECT:/nex-native/chat/peer/${SHOP_OWNER_ID}`);
    expect(err.message).not.toContain("product_error=");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      BUYER_ID,
      SHOP_OWNER_ID,
    );
  });
});

describe("sendProductInquiryAction · Slice 0.8 · recipient-eligibility (existing conversation)", () => {
  test("T0.8.P.3 · existing conversation returned · gate-bypass policy preserved · message sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: BUYER_ID,
      participant_b_id: SHOP_OWNER_ID,
    });

    await runProductInquiry(makeProductFormData());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("sendProductInquiryAction · Slice 0.8 · fail-closed on unexpected service error", () => {
  test("T0.8.P.4 · unexpected error (not recipient_contacts_only) · redirect with product_error=send_failed · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET during conversation insert"),
    );

    const err = await runProductInquiry(makeProductFormData());

    expect(err.message).toContain("product_error=send_failed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    // Internal error text must not leak.
    expect(decodeURIComponent(err.message)).not.toContain("ECONNRESET");
    expect(decodeURIComponent(err.message)).not.toContain("supabase");
  });
});

// ─── sendMenuItemInquiryAction (Slice 0.8) ──────────────────────────

describe("sendMenuItemInquiryAction · Slice 0.8 · recipient-eligibility (new conversation)", () => {
  test("T0.8.M.1 · prohibited new conversation · redirect with menu_error=contacts_only · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runMenuItemInquiry(makeMenuItemFormData());

    expect(err.message).toContain(`/nex-native/chat/peer/${SHOP_OWNER_ID}`);
    expect(err.message).toContain("menu_error=contacts_only");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.8.M.2 · permitted new conversation · message sent · sender-aware was called", async () => {
    installHappyPath();

    const err = await runMenuItemInquiry(makeMenuItemFormData());

    expect(err.message).toContain(`REDIRECT:/nex-native/chat/peer/${SHOP_OWNER_ID}`);
    expect(err.message).not.toContain("menu_error=");
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendMenuItemInquiryAction · Slice 0.8 · recipient-eligibility (existing conversation)", () => {
  test("T0.8.M.3 · existing conversation returned · gate-bypass policy preserved · message sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: BUYER_ID,
      participant_b_id: SHOP_OWNER_ID,
    });

    await runMenuItemInquiry(makeMenuItemFormData());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("sendMenuItemInquiryAction · Slice 0.8 · fail-closed on unexpected service error", () => {
  test("T0.8.M.4 · unexpected error · redirect with menu_error=send_failed · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET during conversation insert"),
    );

    const err = await runMenuItemInquiry(makeMenuItemFormData());

    expect(err.message).toContain("menu_error=send_failed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(decodeURIComponent(err.message)).not.toContain("ECONNRESET");
    expect(decodeURIComponent(err.message)).not.toContain("supabase");
  });
});
