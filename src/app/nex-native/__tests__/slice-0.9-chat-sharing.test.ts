// src/app/nex-native/__tests__/slice-0.9-chat-sharing.test.ts
//
// NEX Slice 0.9 · sender-aware privacy enforcement for chat +
// sharing server actions.
// Owner-authorised 2026-10-18.
// -------------------------------------------------------------------
// Enforces the recipient-eligibility rule for three UI-initiated
// message surfaces. A recipient's `who_can_message = 'contacts'`
// preference is honoured when no prior conversation exists · existing
// conversations retain the sealed NEX gate-bypass policy.
//
// Target actions · `src/app/nex-native/_actions.ts`
//   · sendPeerMessageAction(peerAccountId, formData)       (line 610)
//   · sendPeerStickerAction(peerAccountId, formData)       (line 866)
//   · shareProductToContactAction(peerAccountId, formData) (line 2905)
//
// 4 scenarios × 3 actions = 12 tests.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  resolveSessionMock,
  getAccountByIdMock,
  getProductByIdMock,
  getBusinessByIdMock,
  getThemeStickerBySlugMock,
  markBusinessOwnerActiveMock,
  getOrCreatePeerConversationMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  revalidatePathMock,
  emitMessageArrivalMock,
  dispatchPushNotificationMock,
  resolveAccountLocaleMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getBusinessByIdMock: vi.fn(),
  getThemeStickerBySlugMock: vi.fn(),
  markBusinessOwnerActiveMock: vi.fn(),
  getOrCreatePeerConversationMock: vi.fn(),
  getOrCreatePeerConversationAsSenderMock: vi.fn(),
  sendPeerMessageMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  emitMessageArrivalMock: vi.fn(),
  dispatchPushNotificationMock: vi.fn(),
  resolveAccountLocaleMock: vi.fn(() => "en"),
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
  getMenuItemById: vi.fn(),
  listMenuItemsByBusiness: vi.fn(() => []),
  listSectionsByBusiness: vi.fn(() => []),
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

vi.mock("@/lib/nex-native/theme-sticker-service", () => ({
  getThemeStickerBySlug: getThemeStickerBySlugMock,
}));

vi.mock("@/lib/nex-native/seller-responsiveness-service", () => ({
  markBusinessOwnerActive: markBusinessOwnerActiveMock,
}));

vi.mock("@/lib/nex-native/realtime/message-arrival", () => ({
  emitMessageArrival: emitMessageArrivalMock,
}));

vi.mock("@/lib/nex-native/notification-dispatch-service", () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));

vi.mock("@/lib/nex/i18n/server", () => ({
  resolveAccountLocale: resolveAccountLocaleMock,
  t: vi.fn((key: string) => key),
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

const SENDER_ID = "11111111-1111-1111-1111-111111111111";
const RECIPIENT_ID = "22222222-2222-2222-2222-222222222222";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STICKER_SLUG = "joker-wave";

function installHappyPath() {
  resolveSessionMock.mockReset();
  getAccountByIdMock.mockReset();
  getProductByIdMock.mockReset();
  getBusinessByIdMock.mockReset();
  getThemeStickerBySlugMock.mockReset();
  markBusinessOwnerActiveMock.mockReset();
  getOrCreatePeerConversationMock.mockReset();
  getOrCreatePeerConversationAsSenderMock.mockReset();
  sendPeerMessageMock.mockReset();
  emitMessageArrivalMock.mockReset();
  dispatchPushNotificationMock.mockReset();

  resolveSessionMock.mockResolvedValue({
    account: {
      id: SENDER_ID,
      nex_handle: "nex-10001",
      display_name: "Sender",
      tier: "gratis",
    },
  });
  getAccountByIdMock.mockResolvedValue({
    id: RECIPIENT_ID,
    nex_handle: "nex-20001",
    display_name: "Recipient",
    chat_theme: "default",
    locale: "en",
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
  getBusinessByIdMock.mockResolvedValue({
    id: SHOP_ID,
    owner_account_id: RECIPIENT_ID,
    slug: "mock-shop",
    display_name: "Mock Shop",
  });
  getThemeStickerBySlugMock.mockResolvedValue({
    theme_id: "default",
    slug: STICKER_SLUG,
    label: "Joker wave",
    image_url: "https://example.test/sticker.png",
    sticker_type: "static",
    aspect_ratio: 1,
  });
  markBusinessOwnerActiveMock.mockResolvedValue(undefined);
  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: "conv-id",
    participant_a_id: SENDER_ID < RECIPIENT_ID ? SENDER_ID : RECIPIENT_ID,
    participant_b_id: SENDER_ID < RECIPIENT_ID ? RECIPIENT_ID : SENDER_ID,
  });
  sendPeerMessageMock.mockResolvedValue({
    id: "msg-id",
    conversation_id: "conv-id",
    sent_at: new Date().toISOString(),
  });
}

function peerMessageFd(
  overrides: {
    body?: string;
    reply_to_id?: string;
    attachment_url?: string;
    attachment_type?: string;
  } = {},
): FormData {
  const fd = new FormData();
  // Owner-authorised 2026-11-17 R3 · Slice 0.9 recipient-eligibility
  // tests now exercise sendPeerMessageAction through an attachment-only
  // form. Plaintext body sends to non-NEX1 peers are refused at the
  // server boundary by the device-only E2E gate (see _actions.ts
  // sendPeerMessageAction body/NEX1 check and the R3 regressions
  // added after this suite). Attachment-only sends still exercise the
  // same contacts_only/send_failed branches without tripping the gate.
  fd.set("body", overrides.body ?? "");
  fd.set(
    "attachment_url",
    overrides.attachment_url ?? "https://example.test/image.jpg",
  );
  fd.set("attachment_type", overrides.attachment_type ?? "image");
  if (overrides.reply_to_id) fd.set("reply_to_id", overrides.reply_to_id);
  return fd;
}

function stickerFd(overrides: { theme_sticker_slug?: string } = {}): FormData {
  const fd = new FormData();
  fd.set("theme_sticker_slug", overrides.theme_sticker_slug ?? STICKER_SLUG);
  return fd;
}

function shareFd(overrides: { product_id?: string; body?: string; back?: string } = {}): FormData {
  const fd = new FormData();
  fd.set("product_id", overrides.product_id ?? PRODUCT_A);
  if (overrides.body !== undefined) fd.set("body", overrides.body);
  fd.set("back", overrides.back ?? "/nex-native/mock-shop");
  return fd;
}

async function runPeerMessage(fd: FormData): Promise<Error> {
  const { sendPeerMessageAction } = await import("../_actions");
  try {
    await sendPeerMessageAction(RECIPIENT_ID, fd);
    throw new Error("sendPeerMessageAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

async function runSticker(fd: FormData): Promise<Error> {
  const { sendPeerStickerAction } = await import("../_actions");
  try {
    await sendPeerStickerAction(RECIPIENT_ID, fd);
    throw new Error("sendPeerStickerAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

async function runShare(fd: FormData): Promise<Error> {
  const { shareProductToContactAction } = await import("../_actions");
  try {
    await shareProductToContactAction(RECIPIENT_ID, fd);
    throw new Error("shareProductToContactAction did not redirect");
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

// ─── sendPeerMessageAction (Slice 0.9) ──────────────────────────────

describe("sendPeerMessageAction · Slice 0.9 · recipient-eligibility (new conversation)", () => {
  test("T0.9.PM.1 · prohibited new conversation · redirect with message_error=contacts_only · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runPeerMessage(peerMessageFd());

    expect(err.message).toContain(`/nex-native/chat/peer/${RECIPIENT_ID}`);
    expect(err.message).toContain("message_error=contacts_only");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.9.PM.2 · permitted new conversation · message sent exactly once · sender-aware was called", async () => {
    installHappyPath();

    await runPeerMessage(peerMessageFd());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      SENDER_ID,
      RECIPIENT_ID,
    );
  });
});

describe("sendPeerMessageAction · Slice 0.9 · recipient-eligibility (existing conversation)", () => {
  test("T0.9.PM.3 · existing conversation returned · gate-bypass policy preserved · message sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: SENDER_ID,
      participant_b_id: RECIPIENT_ID,
    });

    await runPeerMessage(peerMessageFd());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("sendPeerMessageAction · Slice 0.9 · fail-closed on unexpected service error", () => {
  test("T0.9.PM.4 · unexpected error · redirect with message_error=send_failed · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET"),
    );

    const err = await runPeerMessage(peerMessageFd());

    expect(err.message).toContain("message_error=send_failed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(err.message).not.toContain("ECONNRESET");
  });
});

// ─── sendPeerStickerAction (Slice 0.9) ──────────────────────────────

describe("sendPeerStickerAction · Slice 0.9 · recipient-eligibility (new conversation)", () => {
  test("T0.9.ST.1 · prohibited new conversation · redirect with sticker_error=contacts_only · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runSticker(stickerFd());

    expect(err.message).toContain(`/nex-native/chat/peer/${RECIPIENT_ID}`);
    expect(err.message).toContain("sticker_error=contacts_only");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.9.ST.2 · permitted new conversation · sticker sent · sender-aware was called", async () => {
    installHappyPath();

    await runSticker(stickerFd());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      SENDER_ID,
      RECIPIENT_ID,
    );
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      attachment_type: string;
    };
    expect(callArg.attachment_type).toBe("sticker");
  });
});

describe("sendPeerStickerAction · Slice 0.9 · recipient-eligibility (existing conversation)", () => {
  test("T0.9.ST.3 · existing conversation · sticker sent via existing conversation id", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: SENDER_ID,
      participant_b_id: RECIPIENT_ID,
    });

    await runSticker(stickerFd());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("sendPeerStickerAction · Slice 0.9 · fail-closed on unexpected service error", () => {
  test("T0.9.ST.4 · unexpected error · redirect with sticker_error=send_failed · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET"),
    );

    const err = await runSticker(stickerFd());

    expect(err.message).toContain("sticker_error=send_failed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(err.message).not.toContain("ECONNRESET");
  });
});

// ─── shareProductToContactAction (Slice 0.9) ────────────────────────

describe("shareProductToContactAction · Slice 0.9 · recipient-eligibility (new conversation)", () => {
  test("T0.9.SH.1 · prohibited new conversation · redirect to safeBack with share_error=contacts_only · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error(
        "peer-conversation-service.getOrCreatePeerConversationAsSender: recipient_contacts_only",
      ),
    );

    const err = await runShare(shareFd({ back: "/nex-native/mock-shop" }));

    expect(err.message).toContain("REDIRECT:/nex-native/mock-shop");
    expect(err.message).toContain("share_error=contacts_only");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T0.9.SH.2 · permitted new conversation · share sent · sender-aware was called", async () => {
    installHappyPath();

    const err = await runShare(shareFd());

    expect(err.message).toContain(`REDIRECT:/nex-native/chat/peer/${RECIPIENT_ID}`);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledWith(
      SENDER_ID,
      RECIPIENT_ID,
    );
  });
});

describe("shareProductToContactAction · Slice 0.9 · recipient-eligibility (existing conversation)", () => {
  test("T0.9.SH.3 · existing conversation · share sent via existing conversation id", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "existing-conv-id",
      participant_a_id: SENDER_ID,
      participant_b_id: RECIPIENT_ID,
    });

    await runShare(shareFd());

    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      conversation_id: string;
    };
    expect(callArg.conversation_id).toBe("existing-conv-id");
  });
});

describe("shareProductToContactAction · Slice 0.9 · fail-closed on unexpected service error", () => {
  test("T0.9.SH.4 · unexpected error · redirect to safeBack with share_error=send_failed · zero messages sent", async () => {
    installHappyPath();
    getOrCreatePeerConversationAsSenderMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET"),
    );

    const err = await runShare(shareFd({ back: "/nex-native/mock-shop" }));

    expect(err.message).toContain("REDIRECT:/nex-native/mock-shop");
    expect(err.message).toContain("share_error=send_failed");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(err.message).not.toContain("ECONNRESET");
  });
});
