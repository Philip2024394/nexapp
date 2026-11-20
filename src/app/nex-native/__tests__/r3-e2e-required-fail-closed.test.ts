// src/app/nex-native/__tests__/r3-e2e-required-fail-closed.test.ts
//
// R3 fail-closed privacy boundary regressions · owner-authorised
// 2026-11-17 after the retained-row investigation in
// evidence/product-chat-cart-checkpoint/addendum-6/HANDBACK-ADDENDUM-6-R2.md
// showed that sendPeerMessageAction could persist a plaintext body
// into nex_peer_message if the Bridge 76 capture-phase submit listener
// was orphaned, detached, or bypassed.
//
// The fix in src/app/nex-native/_actions.ts sendPeerMessageAction
// refuses any non-empty body for a non-NEX1 peer. Attachment-only
// sends and NEX1 support chat remain permitted; the Slice 0.9
// recipient-eligibility branch still runs for those paths.
//
// These regressions assert the smallest robust fail-closed behaviour.
// They do NOT prove rendered delivery; the rendered-app harness
// at scripts/_tmp/cp-cart-multi-and-chat-r5.mjs exercises the
// end-to-end path and is the authoritative evidence source.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  resolveSessionMock,
  getAccountByIdMock,
  getOrCreatePeerConversationAsSenderMock,
  sendPeerMessageMock,
  revalidatePathMock,
  emitMessageArrivalMock,
  dispatchPushNotificationMock,
  resolveAccountLocaleMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
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

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: vi.fn(),
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

// ─── Fixtures ───────────────────────────────────────────────────────

const SENDER_ID = "11111111-1111-1111-1111-111111111111";
const PEER_ID = "22222222-2222-2222-2222-222222222222"; // non-NEX1 peer
const NEX1_ID = "00000000-0000-0000-0000-000000000001"; // NEX_OFFICIAL_ACCOUNT_ID

function resetMocks() {
  resolveSessionMock.mockReset();
  getAccountByIdMock.mockReset();
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
    id: PEER_ID,
    nex_handle: "nex-20001",
    display_name: "Peer",
    chat_theme: "default",
    locale: "en",
  });
  getOrCreatePeerConversationAsSenderMock.mockResolvedValue({
    id: "conv-id",
    participant_a_id: SENDER_ID,
    participant_b_id: PEER_ID,
  });
  sendPeerMessageMock.mockResolvedValue({
    id: "msg-id",
    conversation_id: "conv-id",
    sent_at: new Date().toISOString(),
  });
}

function bodyFd(body: string): FormData {
  const fd = new FormData();
  fd.set("body", body);
  return fd;
}

function attachmentOnlyFd(): FormData {
  const fd = new FormData();
  fd.set("body", "");
  fd.set("attachment_url", "https://example.test/img.jpg");
  fd.set("attachment_type", "image");
  return fd;
}

async function runSend(peerId: string, fd: FormData): Promise<Error> {
  const { sendPeerMessageAction } = await import("../_actions");
  try {
    await sendPeerMessageAction(peerId, fd);
    throw new Error("sendPeerMessageAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  resetMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── R3.FC.1 · plaintext body to non-NEX1 peer is refused ───────────

describe("R3 · sendPeerMessageAction fail-closed · plaintext body to non-NEX1", () => {
  test("R3.FC.1 · body=\"hello\" to non-NEX1 peer · redirect e2e_required · zero rows written", async () => {
    const err = await runSend(PEER_ID, bodyFd("hello"));
    expect(err.message).toContain(`/nex-native/chat/peer/${PEER_ID}`);
    expect(err.message).toContain("message_error=e2e_required");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationAsSenderMock).not.toHaveBeenCalled();
  });

  test("R3.FC.2 · body=\"matrix probe\" to non-NEX1 peer · refused · covers the retained-row scenario", async () => {
    // The R2 retained row f44464b1 had body_len=181 with no ciphertext.
    // Any non-empty body to a non-NEX1 peer is now refused regardless
    // of the orphaned-listener state on the client.
    const err = await runSend(
      PEER_ID,
      bodyFd(
        "hello seller · this is the sort of message that used to leak plaintext when the capture listener orphaned itself across a form rerender",
      ),
    );
    expect(err.message).toContain("message_error=e2e_required");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });

  test("R3.FC.3 · body with leading/trailing whitespace to non-NEX1 peer · trimmed non-empty · refused", async () => {
    const err = await runSend(PEER_ID, bodyFd("   hi   "));
    expect(err.message).toContain("message_error=e2e_required");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});

// ─── R3.FC.4 · attachment-only to non-NEX1 peer still allowed ───────

describe("R3 · sendPeerMessageAction fail-closed · attachment-only path preserved", () => {
  test("R3.FC.4 · attachment-only (body empty) to non-NEX1 peer · passes e2e gate · reaches sendPeerMessage", async () => {
    await runSend(PEER_ID, attachmentOnlyFd());
    // Gate passed · the rest of the action ran · attachment was sent.
    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      body: string;
      attachment_url: string | null;
      attachment_type: string | null;
    };
    expect(callArg.body).toBe("");
    expect(callArg.attachment_url).toBe("https://example.test/img.jpg");
    expect(callArg.attachment_type).toBe("image");
  });
});

// ─── R3.FC.5 · NEX1 support chat preserved with plaintext body ──────

describe("R3 · sendPeerMessageAction fail-closed · NEX1 support chat preserved", () => {
  test("R3.FC.5 · plaintext body to NEX1 (00000000-...-001) · permitted · sendPeerMessage called", async () => {
    // NEX1 support chat is the officially-sanctioned plaintext path.
    // Bridge 76 E2eComposerIntercept is disabled for NEX1 by design.
    // The server-side gate must preserve this exception.
    getAccountByIdMock.mockResolvedValueOnce({
      id: NEX1_ID,
      nex_handle: "nex-00001",
      display_name: "NEX1",
      chat_theme: "default",
      locale: "en",
    });
    getOrCreatePeerConversationAsSenderMock.mockResolvedValueOnce({
      id: "nex1-conv",
      participant_a_id: NEX1_ID,
      participant_b_id: SENDER_ID,
    });

    await runSend(NEX1_ID, bodyFd("help · can you look at my order"));

    expect(getOrCreatePeerConversationAsSenderMock).toHaveBeenCalledTimes(1);
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const callArg = sendPeerMessageMock.mock.calls[0]![0] as {
      body: string;
      conversation_id: string;
    };
    expect(callArg.body).toBe("help · can you look at my order");
    expect(callArg.conversation_id).toBe("nex1-conv");
  });
});

// ─── R3.FC.6 · empty body + no attachment · bounces (existing behaviour) ───

describe("R3 · sendPeerMessageAction fail-closed · empty body + no attachment preserved", () => {
  test("R3.FC.6 · empty body + no attachment to non-NEX1 · redirect to chat (no error param, no rows)", async () => {
    const err = await runSend(PEER_ID, bodyFd(""));
    // Pre-existing behaviour · bounce back to chat without error.
    // Our new gate must NOT fire on empty body (nothing to leak).
    expect(err.message).toContain(`/nex-native/chat/peer/${PEER_ID}`);
    expect(err.message).not.toContain("message_error=e2e_required");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
  });
});
