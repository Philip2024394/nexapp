// src/app/api/nex-native/chat/encrypted/__tests__/dispatch-wiring.test.ts
//
// P1.T01 2026-11-13 · sibling of peer-message/encrypted/__tests__/
// dispatch-wiring.test.ts. The business-scoped shop chat uses the
// same dispatch pattern (fan-out to every non-sender participant,
// generic preview, fail-closed service, defence-in-depth participant
// check). This test proves the WIRING of the business-chat route
// against the same sealed guarantees · the service-level test in
// src/lib/nex-native/__tests__/notification-dispatch-service.test.ts
// still covers the dispatch service itself.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  sendEncryptedBusinessMessagesMock,
  listParticipantsMock,
  emitMessageArrivalMock,
  dispatchPushNotificationMock,
  getAccountByIdMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  sendEncryptedBusinessMessagesMock: vi.fn(),
  listParticipantsMock: vi.fn(),
  emitMessageArrivalMock: vi.fn(),
  dispatchPushNotificationMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
}));

// P1.T01 · the route imports its resolver from app/dev-impersonation
// (owner directive 2026-11-13 URGENT). Mock both so the test is
// deterministic regardless of NEX_DEV_IMPERSONATE_HANDLE.
vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/business-message-service", () => ({
  sendEncryptedBusinessMessages: sendEncryptedBusinessMessagesMock,
}));
vi.mock("@/lib/nex-native/conversation-service", () => ({
  listParticipants: listParticipantsMock,
}));
vi.mock("@/lib/nex-native/realtime/message-arrival", () => ({
  emitMessageArrival: emitMessageArrivalMock,
}));
vi.mock("@/lib/nex-native/notification-dispatch-service", () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));
vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
}));

import { POST } from "../route";

const SELF = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";
const THIRD = "44444444-4444-4444-4444-444444444444";
const CONV = "33333333-3333-3333-3333-333333333333";
const GROUP = "gggggggg-gggg-gggg-gggg-gggggggggggg";
const CIPHER_B64 = "AQIDBA==";
const NONCE_B64 = "BAUGBw==";
const CANARY_PLAINTEXT = "BIZ_CONVERSATION_LEAK_CANARY_7C3E";

function fakeSession(id = SELF, displayName = "Self") {
  return {
    supabaseUserId: "sb-user-id",
    email: "self@nex.test",
    account: {
      id,
      display_name: displayName,
      supabase_user_id: "sb-user-id",
    },
  };
}

function fakeParticipants(accountIds: string[] = [SELF, PEER]) {
  return accountIds.map((account_id, i) => ({
    conversation_id: CONV,
    account_id,
    side: i === 0 ? ("customer" as const) : ("business" as const),
    last_read_at: null,
  }));
}

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/nex-native/chat/encrypted", {
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
    attachment_type: opts?.attachment_type ?? null,
    attachment_meta: null,
    ...(opts?.attempt_leak
      ? { body: CANARY_PLAINTEXT, _plaintext: CANARY_PLAINTEXT }
      : {}),
  };
  return {
    message_group_id: GROUP,
    rows: [row, { ...row, recipient_device_id: "rdev2" }],
  };
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  sendEncryptedBusinessMessagesMock.mockReset();
  listParticipantsMock.mockReset();
  emitMessageArrivalMock.mockReset();
  dispatchPushNotificationMock.mockReset();
  getAccountByIdMock.mockReset();
  resolveSessionMock.mockResolvedValue(fakeSession());
  sendEncryptedBusinessMessagesMock.mockResolvedValue(["mid-1", "mid-2"]);
  listParticipantsMock.mockResolvedValue(fakeParticipants());
  emitMessageArrivalMock.mockResolvedValue(undefined);
  // getAccountById is called for BOTH the sender (to resolve display
  // name) AND each recipient (to resolve locale). Return a default
  // record that works for either · tests that need per-recipient
  // control override via mockImplementation.
  getAccountByIdMock.mockImplementation(async (id: string) => {
    if (id === SELF) return { id: SELF, display_name: "Self", locale: "en" };
    if (id === PEER) return { id: PEER, display_name: "Peer", locale: "en" };
    if (id === THIRD) return { id: THIRD, display_name: "Third", locale: "en" };
    return null;
  });
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
  // Dispatch fans inside a fire-and-forget IIFE · flush several
  // microtask + macrotask rounds so (list → per-recipient account
  // fetch → dispatch) settles before assertions.
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setImmediate(r));
  }
  return res as unknown as Response;
}

describe("business chat encrypted send · dispatch wiring · success path", () => {
  it("fires EXACTLY ONE push per logical message, addressed to the PEER and NOT the sender", async () => {
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(sendEncryptedBusinessMessagesMock).toHaveBeenCalledTimes(1);
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    const [recipient, category, payload] =
      dispatchPushNotificationMock.mock.calls[0];
    expect(recipient).toBe(PEER);
    expect(recipient).not.toBe(SELF);
    expect(category).toBe("message");
    expect(payload.kind).toBe("conversation");
    expect(payload.conversationId).toBe(CONV);
    expect(payload.title).toBe("Self");
    expect(payload.body).toBe("Sent you a message");
    expect(payload.data.conversationId).toBe(CONV);
    expect(payload.data.messageGroupId).toBe(GROUP);
    expect(payload.data.senderAccountId).toBe(SELF);
    expect(payload.data.type).toBe("business_message");
  });

  it("uses attachment-type-specific generic body for image/video/audio/product", async () => {
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

    dispatchPushNotificationMock.mockClear();
    await postAndFlush(twoDeviceBody({ attachment_type: "product" }));
    expect(dispatchPushNotificationMock.mock.calls[0][2].body).toBe(
      "Sent you a message",
    );
  });

  it("fans one push PER non-sender participant when there are three in the conversation", async () => {
    listParticipantsMock.mockResolvedValue(fakeParticipants([SELF, PEER, THIRD]));
    await postAndFlush(twoDeviceBody());
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(2);
    const recipients = dispatchPushNotificationMock.mock.calls.map((c) => c[0]);
    expect(recipients).toContain(PEER);
    expect(recipients).toContain(THIRD);
    expect(recipients).not.toContain(SELF);
  });
});

describe("business chat encrypted send · dispatch wiring · safety guarantees", () => {
  it("SUPPRESSES dispatch entirely when the sender is NOT a participant", async () => {
    // Session is SELF · but the participants list doesn't include SELF.
    // The route must abort the fan-out · dispatch count = 0.
    listParticipantsMock.mockResolvedValue(fakeParticipants([PEER, THIRD]));
    const res = await postAndFlush(twoDeviceBody());
    expect(res.status).toBe(200);
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it("does not fire a push when listParticipants returns an empty array", async () => {
    listParticipantsMock.mockResolvedValue([]);
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

describe("business chat encrypted send · dispatch skip reasons (service-level)", () => {
  it("records a dispatch call to the PEER even when the service returns skipped=disabled", async () => {
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
    const [recipient] = dispatchPushNotificationMock.mock.calls[0];
    expect(recipient).toBe(PEER);
  });

  it("records a dispatch call to the PEER even when the recipient has no subscriptions", async () => {
    dispatchPushNotificationMock.mockResolvedValue({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "no_subscriptions",
    });
    await postAndFlush(twoDeviceBody());
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    const [recipient] = dispatchPushNotificationMock.mock.calls[0];
    expect(recipient).toBe(PEER);
  });
});
