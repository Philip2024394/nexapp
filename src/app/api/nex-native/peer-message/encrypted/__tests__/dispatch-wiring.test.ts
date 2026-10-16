// src/app/api/nex-native/peer-message/encrypted/__tests__/dispatch-wiring.test.ts
//
// R8 Stage 3b (encrypted-path extension · 2026-10-16) · the encrypted
// peer-message route must fan a SINGLE generic push to the recipient
// after a successful insert, honouring the sealed dispatch service's
// fail-closed guarantees. This test file proves the WIRING in the route
// (not the dispatch service itself · that is covered by
// src/lib/nex-native/__tests__/notification-dispatch-service.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  sendEncryptedPeerMessagesMock,
  getPeerConversationByIdMock,
  emitMessageArrivalMock,
  dispatchPushNotificationMock,
  getAccountByIdMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  sendEncryptedPeerMessagesMock: vi.fn(),
  getPeerConversationByIdMock: vi.fn(),
  emitMessageArrivalMock: vi.fn(),
  dispatchPushNotificationMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/peer-message-service", () => ({
  sendEncryptedPeerMessages: sendEncryptedPeerMessagesMock,
}));
vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getPeerConversationById: getPeerConversationByIdMock,
}));
vi.mock("@/lib/nex-native/realtime/message-arrival", () => ({
  emitMessageArrival: emitMessageArrivalMock,
}));
vi.mock("@/lib/nex-native/notification-dispatch-service", () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));
// R8 Stage 3b (2026-10-16 follow-up) · the route now resolves the
// recipient's saved locale via accountService.getAccountById and
// localises the push body via the i18n registry. Mock the account
// lookup so the test can control the resolved locale deterministically.
vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
}));

import { POST } from "../route";

const SELF = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";
const CONV = "33333333-3333-3333-3333-333333333333";
const GROUP = "gggggggg-gggg-gggg-gggg-gggggggggggg";
const CIPHER_B64 = "AQIDBA==";
const NONCE_B64 = "BAUGBw==";
const CANARY_PLAINTEXT = "CONVERSATION_LEAK_CANARY_18D4B2F7";

function fakeSession(id = SELF) {
  return {
    supabaseUserId: "sb-user-id",
    email: "self@nex.test",
    account: {
      id,
      display_name: "Self",
      supabase_user_id: "sb-user-id",
    },
  };
}

function fakeConv(a = SELF, b = PEER) {
  return {
    id: CONV,
    participant_a_id: a,
    participant_b_id: b,
    last_message_at: "2026-01-01T00:00:00Z",
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/nex-native/peer-message/encrypted", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function twoDeviceBody(opts?: {
  attachment_type?: string | null;
  attempt_leak?: boolean;
}) {
  const row = {
    conversation_id: CONV,
    ciphertext_b64: CIPHER_B64,
    nonce_b64: NONCE_B64,
    sender_public_key: "sender-pub",
    sender_device_id: "sdev",
    recipient_device_id: "rdev1",
    reply_to_id: null,
    attachment_url: null,
    attachment_type: opts?.attachment_type ?? null,
    attachment_meta: null,
    ...(opts?.attempt_leak
      ? // Attacker tries to smuggle plaintext in an unknown field · the
        // route must not forward it anywhere the dispatch service sees.
        { body: CANARY_PLAINTEXT, _plaintext: CANARY_PLAINTEXT }
      : {}),
  };
  return {
    message_group_id: GROUP,
    rows: [row, { ...row, recipient_device_id: "rdev2" }],
  };
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  sendEncryptedPeerMessagesMock.mockReset();
  getPeerConversationByIdMock.mockReset();
  emitMessageArrivalMock.mockReset();
  dispatchPushNotificationMock.mockReset();
  getAccountByIdMock.mockReset();
  resolveSessionMock.mockResolvedValue(fakeSession());
  sendEncryptedPeerMessagesMock.mockResolvedValue(["mid-1", "mid-2"]);
  getPeerConversationByIdMock.mockResolvedValue(fakeConv());
  emitMessageArrivalMock.mockResolvedValue(undefined);
  // Default recipient has locale='en' so the English assertions
  // ("Sent you a message", etc.) resolve through the real i18n pack.
  // Tests that need to prove locale swapping override this per-case.
  getAccountByIdMock.mockResolvedValue({ id: PEER, locale: "en" });
  dispatchPushNotificationMock.mockResolvedValue({
    attempted: 1,
    delivered: 1,
    failed: 0,
    pruned: 0,
  });
});

afterEach(() => vi.clearAllMocks());

async function postAndFlush(body: unknown): Promise<Response> {
  const res = await POST(makeRequest(body) as never);
  // The dispatch is fire-and-forget inside the route. Flush several
  // microtask + macrotask rounds so the IIFE chain (conv lookup →
  // account lookup → dispatch) settles before assertions run.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setImmediate(r));
  }
  return res as unknown as Response;
}

describe("encrypted send route · dispatch wiring · success path", () => {
  it("fires EXACTLY ONE push per logical message (even with N device rows)", async () => {
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(sendEncryptedPeerMessagesMock).toHaveBeenCalledTimes(1);
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    const [recipient, category, payload] =
      dispatchPushNotificationMock.mock.calls[0];
    expect(recipient).toBe(PEER);
    expect(category).toBe("message");
    expect(payload.kind).toBe("conversation");
    expect(payload.conversationId).toBe(CONV);
    expect(payload.title).toBe("Self");
    expect(payload.body).toBe("Sent you a message");
    expect(payload.data.tag).toBe(`nex-msg-${GROUP}`);
    expect(payload.data.messageGroupId).toBe(GROUP);
    expect(payload.data.senderAccountId).toBe(SELF);
  });

  it("uses attachment-type-specific generic body for image/video/audio", async () => {
    await postAndFlush(twoDeviceBody({ attachment_type: "image" }));
    expect(dispatchPushNotificationMock.mock.calls[0][2].body).toBe(
      "Sent you a photo",
    );

    dispatchPushNotificationMock.mockClear();
    await postAndFlush(twoDeviceBody({ attachment_type: "video" }));
    expect(dispatchPushNotificationMock.mock.calls[0][2].body).toBe(
      "Sent you a video",
    );

    dispatchPushNotificationMock.mockClear();
    await postAndFlush(twoDeviceBody({ attachment_type: "audio" }));
    expect(dispatchPushNotificationMock.mock.calls[0][2].body).toBe(
      "Sent you a voice note",
    );
  });

  it("picks the OTHER participant as recipient when sender === participant_b", async () => {
    // Flip the conversation shape so SELF is participant_b
    getPeerConversationByIdMock.mockResolvedValue(fakeConv(PEER, SELF));
    await postAndFlush(twoDeviceBody());
    const [recipient] = dispatchPushNotificationMock.mock.calls[0];
    expect(recipient).toBe(PEER);
  });

  it("localises the body in the RECIPIENT's saved nex_account.locale · Indonesian user receives Bahasa Indonesia", async () => {
    getAccountByIdMock.mockResolvedValue({ id: PEER, locale: "id" });
    await postAndFlush(twoDeviceBody());
    const [, , payload] = dispatchPushNotificationMock.mock.calls[0];
    expect(payload.body).toBe("Mengirim pesan");
    // Attachment-type variants also localise.
    dispatchPushNotificationMock.mockClear();
    await postAndFlush(twoDeviceBody({ attachment_type: "image" }));
    const [, , p2] = dispatchPushNotificationMock.mock.calls[0];
    expect(p2.body).toBe("Mengirim foto");
  });

  it("falls back to the sealed DEFAULT_LANG when the recipient has no saved locale", async () => {
    getAccountByIdMock.mockResolvedValue({ id: PEER, locale: null });
    await postAndFlush(twoDeviceBody());
    const [, , payload] = dispatchPushNotificationMock.mock.calls[0];
    // DEFAULT_LANG === "id" per the sealed foundation test · fallback
    // path renders the Indonesian preview.
    expect(payload.body).toBe("Mengirim pesan");
  });
});

describe("encrypted send route · dispatch wiring · safety guarantees", () => {
  it("SUPPRESSES self-dispatch when both participants resolve to the sender", async () => {
    getPeerConversationByIdMock.mockResolvedValue(fakeConv(SELF, SELF));
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it("does not fire a push when the conversation lookup returns null", async () => {
    getPeerConversationByIdMock.mockResolvedValue(null);
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it("NEVER forwards an attacker-smuggled plaintext field to the dispatch payload", async () => {
    const body = twoDeviceBody({ attempt_leak: true });
    await postAndFlush(body);
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    const [, , payload] = dispatchPushNotificationMock.mock.calls[0];
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain(CANARY_PLAINTEXT);
    // The sealed sentinel body '(encrypted)' is also not leaked.
    expect(serialised).not.toContain("(encrypted)");
    // The ciphertext base64 bytes are not leaked either.
    expect(serialised).not.toContain(CIPHER_B64);
  });

  it("does NOT flip a successful send into a failure when dispatch throws", async () => {
    dispatchPushNotificationMock.mockRejectedValue(new Error("dispatch broke"));
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("still fires emitMessageArrival (realtime) even if dispatch throws", async () => {
    dispatchPushNotificationMock.mockRejectedValue(new Error("push gone"));
    await postAndFlush(twoDeviceBody());
    expect(emitMessageArrivalMock).toHaveBeenCalledTimes(1);
  });
});

describe("encrypted send route · dispatch skip reasons (service-level)", () => {
  it("records a dispatch call even when the dispatch service returns skipped=disabled (pref OFF)", async () => {
    // The dispatch service's fail-closed behaviour on `message_enabled: false`
    // IS the enforcement · the route still calls it so the service can
    // decide. We assert the route makes the call · the service test file
    // proves the service makes the correct decision.
    dispatchPushNotificationMock.mockResolvedValue({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "disabled",
    });
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("records a dispatch call even when the recipient has no subscriptions", async () => {
    dispatchPushNotificationMock.mockResolvedValue({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "no_subscriptions",
    });
    await postAndFlush(twoDeviceBody());
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("records a dispatch call when the Vault boundary rejects the push", async () => {
    dispatchPushNotificationMock.mockResolvedValue({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "vault_rejected",
    });
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    const [recipient, category, payload] =
      dispatchPushNotificationMock.mock.calls[0];
    // Even in the rejection path, the ROUTE still passed a conversation
    // payload · the service made the suppression decision, not the route.
    expect(recipient).toBe(PEER);
    expect(category).toBe("message");
    expect(payload.kind).toBe("conversation");
  });
});
