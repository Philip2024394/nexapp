// src/app/api/nex-native/peer-message/encrypted/batch/__tests__/route.test.ts
//
// Route-level integration tests for the sealed N-row batch endpoint.
// -----------------------------------------------------------------
// 4 cases:
//   1. valid batch · writes N rows (delegated to sealed service)
//   2. mismatched sender_account_id in one row → 400 + no writes
//   3. participant mismatch → 403 + no writes
//   4. replay with the same message_group_id → returns existing ids
//      without new insert.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  sendEncryptedPeerMessagesMock,
  getPeerConversationByIdMock,
  findExistingMock,
  lookupActiveDeviceKeysMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  sendEncryptedPeerMessagesMock: vi.fn(),
  getPeerConversationByIdMock: vi.fn(),
  findExistingMock: vi.fn(),
  lookupActiveDeviceKeysMock: vi.fn(),
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

vi.mock("@/lib/nex-native/crypto/device-key-lookup", () => ({
  lookupActiveDeviceKeys: lookupActiveDeviceKeysMock,
}));

// Mock the supabase-admin so the idempotency probe uses our mock.
vi.mock("@/lib/nex-native/supabase-admin", () => {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnValue(undefined),
    eq: vi.fn().mockReturnValue(undefined),
  };
  const mk = () => {
    const q: Record<string, unknown> = {} as Record<string, unknown>;
    q.select = vi.fn().mockReturnValue(q);
    q.eq = vi.fn().mockImplementation(async () => findExistingMock());
    return q;
  };
  return {
    nexSupabaseAdmin: {
      from: vi.fn().mockImplementation(() => mk()),
    },
  };
});

import { POST } from "../route";

const SELF = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";
const CONV = "33333333-3333-3333-3333-333333333333";
const GROUP = "gggggggg-gggg-gggg-gggg-gggggggggggg";
const SENDER_DEV = "sender-dev-1";
const PEER_DEV_1 = "peer-dev-1";
const PEER_DEV_2 = "peer-dev-2";
const SENDER_DEV_OTHER = "sender-dev-other";

function session(id = SELF) {
  return {
    supabaseUserId: "sb-user",
    email: "s@nex.test",
    account: { id, display_name: "Self", supabase_user_id: "sb-user" },
  };
}

function conv(a = SELF, b = PEER) {
  return {
    id: CONV,
    participant_a_id: a,
    participant_b_id: b,
    created_at: "2026-01-01T00:00:00Z",
    last_message_at: "2026-01-01T00:00:00Z",
  };
}

function okRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    conversation_id: CONV,
    sender_account_id: SELF,
    ciphertext_b64: "AQIDBA==",
    nonce_b64: "BAUGBw==",
    sender_public_key: "sender-pub",
    sender_device_id: SENDER_DEV,
    recipient_account_id: PEER,
    recipient_device_id: PEER_DEV_1,
    reply_to_id: null,
    attachment_url: null,
    attachment_type: null,
    attachment_meta: null,
    ...overrides,
  };
}

function req(body: unknown): Request {
  return new Request(
    "http://test/api/nex-native/peer-message/encrypted/batch",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  sendEncryptedPeerMessagesMock.mockReset();
  getPeerConversationByIdMock.mockReset();
  findExistingMock.mockReset();
  lookupActiveDeviceKeysMock.mockReset();

  resolveSessionMock.mockResolvedValue(session());
  getPeerConversationByIdMock.mockResolvedValue(conv());
  sendEncryptedPeerMessagesMock.mockResolvedValue([
    "row-1",
    "row-2",
    "row-3",
  ]);
  // Default · no existing rows for this group_id
  findExistingMock.mockResolvedValue({ data: [], error: null });

  // Default · return ONE peer device + SELF device per side.
  lookupActiveDeviceKeysMock.mockImplementation(async (accountId: string) => {
    if (accountId === PEER) {
      return {
        ok: true,
        status: "ok",
        devices: [
          { device_id: PEER_DEV_1, public_key: "pk1", last_seen_at: "t1" },
          { device_id: PEER_DEV_2, public_key: "pk2", last_seen_at: "t2" },
        ],
        ttl_ms: 60000,
      };
    }
    if (accountId === SELF) {
      return {
        ok: true,
        status: "ok",
        devices: [
          { device_id: SENDER_DEV, public_key: "spk1", last_seen_at: "t1" },
          {
            device_id: SENDER_DEV_OTHER,
            public_key: "spk2",
            last_seen_at: "t2",
          },
        ],
        ttl_ms: 60000,
      };
    }
    return {
      ok: true,
      status: "ok",
      devices: [],
      ttl_ms: 60000,
    };
  });
});

afterEach(() => vi.clearAllMocks());

describe("encrypted batch route", () => {
  it("case 1 · valid batch · writes N rows atomically", async () => {
    const body = {
      message_group_id: GROUP,
      rows: [
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: PEER_DEV_1,
        }),
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: PEER_DEV_2,
        }),
        okRow({
          recipient_account_id: SELF,
          recipient_device_id: SENDER_DEV_OTHER,
        }),
      ],
    };
    const res = await POST(req(body) as never);
    const json = await (res as unknown as Response).json();
    expect((res as unknown as Response).status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.rows_written).toBe(3);
    // Sealed service called exactly once · atomic batch insert.
    expect(sendEncryptedPeerMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("case 2 · mismatched sender_account_id in one row · 400 + no writes", async () => {
    const body = {
      message_group_id: GROUP,
      rows: [
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: PEER_DEV_1,
        }),
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: PEER_DEV_2,
          sender_account_id: "attacker-id",
        }),
      ],
    };
    const res = await POST(req(body) as never);
    expect((res as unknown as Response).status).toBe(400);
    const json = await (res as unknown as Response).json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("sender_mismatch");
    // No insert attempted.
    expect(sendEncryptedPeerMessagesMock).not.toHaveBeenCalled();
  });

  it("case 3 · participant mismatch · 403 + no writes", async () => {
    // Recipient_device_id does not belong to any participant.
    const body = {
      message_group_id: GROUP,
      rows: [
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: "stranger-dev",
        }),
      ],
    };
    const res = await POST(req(body) as never);
    expect((res as unknown as Response).status).toBe(403);
    const json = await (res as unknown as Response).json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("participant_mismatch");
    expect(sendEncryptedPeerMessagesMock).not.toHaveBeenCalled();
  });

  it("case 4 · replay with same message_group_id · returns existing ids · no new insert", async () => {
    findExistingMock.mockResolvedValue({
      data: [
        {
          id: "existing-row-1",
          recipient_device_id: PEER_DEV_1,
          sender_device_id: SENDER_DEV,
          conversation_id: CONV,
        },
        {
          id: "existing-row-2",
          recipient_device_id: PEER_DEV_2,
          sender_device_id: SENDER_DEV,
          conversation_id: CONV,
        },
      ],
      error: null,
    });
    const body = {
      message_group_id: GROUP,
      rows: [
        okRow({
          recipient_account_id: PEER,
          recipient_device_id: PEER_DEV_1,
        }),
      ],
    };
    const res = await POST(req(body) as never);
    const json = await (res as unknown as Response).json();
    expect((res as unknown as Response).status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.replayed).toBe(true);
    expect(json.ids).toEqual(["existing-row-1", "existing-row-2"]);
    expect(json.rows_written).toBe(0);
    expect(sendEncryptedPeerMessagesMock).not.toHaveBeenCalled();
  });
});
