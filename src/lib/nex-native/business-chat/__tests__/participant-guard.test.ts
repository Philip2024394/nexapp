// src/lib/nex-native/business-chat/__tests__/participant-guard.test.ts
//
// Stage 5 · 2026-11-14 · owner-authorised build-only.
// -----------------------------------------------------------------------------
// Service-level test for the participant guard shared by both the
// Shop Chat read path (`listBusinessMessages`) and the Shop Chat
// write path (`sendEncryptedBusinessMessages`). Both delegate to
// `ensureSenderIsParticipant`, which refuses any accountId not in
// `nex_conversation_participant` for the conversation.
//
// Spec test item #7 · "Unauthorised participants cannot access the
// conversation or product message." The HTTP 404 at
// `/conversations/[id]` is a thin wrapper around this throw (the
// page catches it via notFound()). This test proves the service-
// layer guarantee that the HTTP layer depends on.
//
// Mocking strategy mirrors `business-service-asset-upload-bucket.test`
// — replace `nexSupabaseAdmin` with a fluent-chain mock that returns
// controllable `data`/`error` values. No DB connection required.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { participantSelectMock, messageSelectMock, messageInsertMock } =
  vi.hoisted(() => ({
    participantSelectMock: vi.fn(),
    messageSelectMock: vi.fn(),
    messageInsertMock: vi.fn(),
  }));

// Stub the Supabase admin surface the service uses. Returns a fluent
// chain that terminates at `maybeSingle()` / `order(...)` so we can
// control each table's response independently.
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      if (table === "nex_conversation_participant") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: participantSelectMock,
              }),
            }),
          }),
        };
      }
      if (table === "nex_message") {
        return {
          select: () => ({
            eq: () => ({
              order: messageSelectMock,
            }),
          }),
          insert: (rows: unknown) => ({
            select: () => messageInsertMock(rows),
          }),
        };
      }
      throw new Error(`unexpected table in test · ${table}`);
    },
  },
}));

import {
  listBusinessMessages,
  sendEncryptedBusinessMessages,
  type EncryptedBusinessMessageInsert,
} from "@/lib/nex-native/business-message-service";

const CONV = "11111111-2222-4333-8444-555555555555";
const PARTICIPANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NON_PARTICIPANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fakeEncryptedRow(
  sender: string,
): EncryptedBusinessMessageInsert {
  return {
    conversation_id: CONV,
    sender_account_id: sender,
    ciphertext: new Uint8Array([1, 2, 3, 4]),
    nonce: new Uint8Array([5, 6, 7, 8]),
    sender_public_key: "pk-base64",
    sender_device_id: "device-1",
    recipient_device_id: "device-2",
    message_group_id: "gggggggg-gggg-4ggg-8ggg-gggggggggggg",
    reply_to_id: null,
    attachment_type: "product",
    attachment_meta: { product_id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp" },
  };
}

beforeEach(() => {
  participantSelectMock.mockReset();
  messageSelectMock.mockReset();
  messageInsertMock.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("participant guard · read path (listBusinessMessages)", () => {
  it("throws when the viewer is NOT a participant of the conversation", async () => {
    participantSelectMock.mockResolvedValue({ data: null, error: null });
    await expect(
      listBusinessMessages(CONV, NON_PARTICIPANT),
    ).rejects.toThrow(/only conversation participants/i);
    // Critically · the message select must NOT be called when the
    // guard fails. If the guard short-circuits correctly, this mock
    // stays untouched.
    expect(messageSelectMock).not.toHaveBeenCalled();
  });

  it("surfaces Supabase errors from the guard lookup verbatim", async () => {
    participantSelectMock.mockResolvedValue({
      data: null,
      error: { message: "transient db error" },
    });
    await expect(
      listBusinessMessages(CONV, NON_PARTICIPANT),
    ).rejects.toThrow(/transient db error/);
    expect(messageSelectMock).not.toHaveBeenCalled();
  });

  it("proceeds to read messages when the viewer IS a participant", async () => {
    participantSelectMock.mockResolvedValue({
      data: { account_id: PARTICIPANT },
      error: null,
    });
    messageSelectMock.mockResolvedValue({
      data: [
        {
          id: "msg-1",
          conversation_id: CONV,
          sender_account_id: PARTICIPANT,
          body: null,
          encrypted: true,
          attachment_type: "product",
          attachment_meta: { product_id: "pid" },
        },
      ],
      error: null,
    });
    const rows = await listBusinessMessages(CONV, PARTICIPANT);
    expect(rows).toHaveLength(1);
    expect(messageSelectMock).toHaveBeenCalledTimes(1);
  });
});

describe("participant guard · write path (sendEncryptedBusinessMessages)", () => {
  it("throws when the sender is NOT a participant of the conversation", async () => {
    participantSelectMock.mockResolvedValue({ data: null, error: null });
    await expect(
      sendEncryptedBusinessMessages([fakeEncryptedRow(NON_PARTICIPANT)]),
    ).rejects.toThrow(/only conversation participants/i);
    // Critically · the insert must NEVER fire when the guard fails.
    // A write slipping past here would be a silent breach of the
    // "unauthorised participant cannot send" invariant.
    expect(messageInsertMock).not.toHaveBeenCalled();
  });

  it("inserts the fan-out rows when the sender IS a participant", async () => {
    participantSelectMock.mockResolvedValue({
      data: { account_id: PARTICIPANT },
      error: null,
    });
    messageInsertMock.mockResolvedValue({
      data: [{ id: "row-1" }],
      error: null,
    });
    const rows = [fakeEncryptedRow(PARTICIPANT)];
    const ids = await sendEncryptedBusinessMessages(rows);
    expect(ids).toEqual(["row-1"]);
    expect(messageInsertMock).toHaveBeenCalledTimes(1);
    // The persisted row must carry the Stage 2 product shape:
    //   attachment_type='product' + attachment_meta.product_id
    // (the chat bubble decoder keys off these fields to render the
    // Stage 2 ProductCardBubble on arrival).
    const inserted = messageInsertMock.mock.calls[0]?.[0] as Array<{
      attachment_type: string;
      attachment_meta: { product_id: string };
      ciphertext: string;
      body: string | null;
    }>;
    expect(inserted[0]?.attachment_type).toBe("product");
    expect(inserted[0]?.attachment_meta).toEqual({
      product_id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    });
    // Body stays null for encrypted rows · ciphertext base64 carries
    // the device-encrypted product envelope (Stage 2 contract).
    expect(inserted[0]?.body).toBeNull();
    expect(typeof inserted[0]?.ciphertext).toBe("string");
  });
});

describe("participant guard · cross-row contract checks", () => {
  it("refuses a mixed-conversation batch (one logical send only)", async () => {
    const other = { ...fakeEncryptedRow(PARTICIPANT), conversation_id: "zz" };
    await expect(
      sendEncryptedBusinessMessages([fakeEncryptedRow(PARTICIPANT), other]),
    ).rejects.toThrow(/share conversation_id/i);
    expect(messageInsertMock).not.toHaveBeenCalled();
  });

  it("refuses a mixed-sender batch (prevents sender-impersonation via fan-out)", async () => {
    const other = { ...fakeEncryptedRow(PARTICIPANT), sender_account_id: NON_PARTICIPANT };
    await expect(
      sendEncryptedBusinessMessages([fakeEncryptedRow(PARTICIPANT), other]),
    ).rejects.toThrow(/share sender_account_id/i);
    expect(messageInsertMock).not.toHaveBeenCalled();
  });

  it("refuses a mixed-group batch (one message_group_id per logical send)", async () => {
    const other = { ...fakeEncryptedRow(PARTICIPANT), message_group_id: "zzz" };
    await expect(
      sendEncryptedBusinessMessages([fakeEncryptedRow(PARTICIPANT), other]),
    ).rejects.toThrow(/share message_group_id/i);
    expect(messageInsertMock).not.toHaveBeenCalled();
  });

  it("returns [] for an empty batch (no-op · never inserts)", async () => {
    const ids = await sendEncryptedBusinessMessages([]);
    expect(ids).toEqual([]);
    expect(messageInsertMock).not.toHaveBeenCalled();
    expect(participantSelectMock).not.toHaveBeenCalled();
  });
});

// Stage 8 · item 9 · 2026-11-14 · owner-ownership re-verify on
// the business-side write path. ensureSenderIsParticipant was
// hardened: when the resolved participant row has side='business',
// the service ALSO verifies the business's owner_account_id matches
// the sender. These three tests prove the new invariant.
describe("participant guard · business-side ownership verify (Stage 8 item 9)", () => {
  const OWNER = PARTICIPANT;
  const WRONG_OWNER = NON_PARTICIPANT;

  it("business-side sender who IS the registered shop owner · write proceeds", async () => {
    participantSelectMock.mockResolvedValue({
      data: {
        account_id: OWNER,
        side: "business",
        nex_conversation: {
          business_id: "biz-111",
          nex_business: { owner_account_id: OWNER },
        },
      },
      error: null,
    });
    messageInsertMock.mockResolvedValue({
      data: [{ id: "row-9a" }],
      error: null,
    });
    const ids = await sendEncryptedBusinessMessages([fakeEncryptedRow(OWNER)]);
    expect(ids).toEqual(["row-9a"]);
    expect(messageInsertMock).toHaveBeenCalledTimes(1);
  });

  it("business-side sender who is NOT the registered shop owner · write refused", async () => {
    // Compromised-session scenario: the participant row says this
    // account is on the business side, but the shop's own owner_
    // account_id points to a different account. The guard must
    // refuse rather than let an impersonated shop reply land.
    participantSelectMock.mockResolvedValue({
      data: {
        account_id: WRONG_OWNER,
        side: "business",
        nex_conversation: {
          business_id: "biz-111",
          nex_business: { owner_account_id: OWNER }, // different!
        },
      },
      error: null,
    });
    await expect(
      sendEncryptedBusinessMessages([fakeEncryptedRow(WRONG_OWNER)]),
    ).rejects.toThrow(/not the registered shop owner/i);
    // Critically, no write happens when ownership verification fails.
    expect(messageInsertMock).not.toHaveBeenCalled();
  });

  it("customer-side sender · ownership check skipped (customers never own the shop)", async () => {
    // Customers are NEVER the shop owner · asserting side='customer'
    // skips the owner match. This confirms the new check only
    // applies to the business write path and doesn't break any
    // customer-side send.
    participantSelectMock.mockResolvedValue({
      data: {
        account_id: PARTICIPANT,
        side: "customer",
        nex_conversation: {
          business_id: "biz-111",
          nex_business: { owner_account_id: "some-other-owner-id" },
        },
      },
      error: null,
    });
    messageInsertMock.mockResolvedValue({
      data: [{ id: "row-9c" }],
      error: null,
    });
    const ids = await sendEncryptedBusinessMessages([fakeEncryptedRow(PARTICIPANT)]);
    expect(ids).toEqual(["row-9c"]);
    expect(messageInsertMock).toHaveBeenCalledTimes(1);
  });
});
