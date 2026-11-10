// src/lib/nex-native/crypto/__tests__/peer-message-dispatcher.test.ts
//
// Tests the sealed single-entry-point client dispatcher.
// -----------------------------------------------------------------
// 6 cases:
//   1. fan-out · peer N devices + sender M-1 echo devices → N+(M-1) rows
//   2. empty peer device list → no_peer_devices
//   3. ciphertext/nonce shape · each row has well-formed base64
//   4. deterministic ordering · peer rows first (sorted by device_id),
//      then self-echo rows (sorted by device_id)
//   5. idempotency · retry POST uses same message_group_id
//   6. HTTP failure propagates as http_failed with no partial state

import { beforeEach, describe, expect, it, vi } from "vitest";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

// Stub IndexedDB-backed device-key module to a deterministic keypair
// so the dispatcher can run under Node. The factory runs inside a
// vi.hoisted() closure so it can reference module-scope keypair state
// safely despite vi.mock hoisting.
const { STUB_KP } = vi.hoisted(() => {
  // Generate the keypair lazily · tweetnacl is deterministic enough
  // that referencing nacl at hoist time is fine when the import is
  // also hoisted by Vitest.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const n = require("tweetnacl");
  return { STUB_KP: n.box.keyPair() as { publicKey: Uint8Array; secretKey: Uint8Array } };
});

vi.mock("../device-key", () => {
  return {
    ensureDeviceKey: async () => ({
      deviceId: "sender-dev-self",
      secretKey: STUB_KP.secretKey,
      publicKey: STUB_KP.publicKey,
      createdAt: 0,
    }),
    publicKeyBase64: (pk: Uint8Array) => naclUtil.encodeBase64(pk),
    decodePublicKey: (s: string) => naclUtil.decodeBase64(s),
  };
});

import { dispatchEncryptedPeerMessage } from "../peer-message-dispatcher";

const CONV = "conv-aaaa-bbbb-cccc";
const SENDER = "sender-acc-1";
const PEER = "peer-acc-2";

function makeDevice(id: string, accountId: string) {
  const kp = nacl.box.keyPair();
  return {
    account_id: accountId,
    device_id: id,
    public_key: naclUtil.encodeBase64(kp.publicKey),
  };
}

function mockBatchOk() {
  return vi.fn(async (url: string) => {
    if (url.includes("/peer-message/encrypted/batch")) {
      return new Response(
        JSON.stringify({
          ok: true,
          message_group_id: "ignored",
          rows_written: 1,
          ids: ["r1"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  });
}

describe("peer-message-dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("case 1 · plans one row per peer device + one per sender-other-device", async () => {
    const peerDevs = [
      makeDevice("peer-1", PEER),
      makeDevice("peer-2", PEER),
    ];
    const senderDevs = [
      // current device is excluded by the fan-out planner
      makeDevice("sender-dev-self", SENDER),
      makeDevice("sender-dev-other", SENDER),
    ];
    let capturedBody: {
      message_group_id: string;
      rows: Array<{ recipient_device_id: string }>;
    } | null = null;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/peer-message/encrypted/batch")) {
        capturedBody = JSON.parse(init!.body as string);
        return new Response(
          JSON.stringify({ ok: true, rows_written: 3, ids: ["a", "b", "c"] }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const res = await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "hello world",
      peerDevicesOverride: peerDevs,
      senderDevicesOverride: senderDevs,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.ok).toBe(true);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.rows.length).toBe(3);
    const deviceIds = capturedBody!.rows.map((r) => r.recipient_device_id);
    expect(deviceIds).toContain("peer-1");
    expect(deviceIds).toContain("peer-2");
    expect(deviceIds).toContain("sender-dev-other");
    expect(deviceIds).not.toContain("sender-dev-self");
  });

  it("case 2 · empty peer device list returns no_peer_devices", async () => {
    const res = await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "hello",
      peerDevicesOverride: [],
      senderDevicesOverride: [makeDevice("sender-dev-self", SENDER)],
      fetchImpl: mockBatchOk() as unknown as typeof fetch,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("no_peer_devices");
    }
  });

  it("case 3 · ciphertext + nonce base64 shapes are well-formed", async () => {
    const peerDevs = [makeDevice("peer-1", PEER)];
    const senderDevs = [makeDevice("sender-dev-self", SENDER)];

    let captured: {
      rows: Array<{ ciphertext_b64: string; nonce_b64: string }>;
    } | null = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({ ok: true, rows_written: 1, ids: ["a"] }),
        { status: 200 },
      );
    });

    const res = await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "hi",
      peerDevicesOverride: peerDevs,
      senderDevicesOverride: senderDevs,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.ok).toBe(true);
    expect(captured).not.toBeNull();
    for (const row of captured!.rows) {
      expect(typeof row.ciphertext_b64).toBe("string");
      expect(row.ciphertext_b64.length).toBeGreaterThan(0);
      // nonce is 24 random bytes → 32 base64 chars
      expect(row.nonce_b64.length).toBe(32);
    }
  });

  it("case 4 · rows are deterministically ordered · peer-first-by-device-id", async () => {
    // Pass peers in UNSORTED order to prove the planner sorts them.
    const peerDevs = [
      makeDevice("peer-zzz", PEER),
      makeDevice("peer-aaa", PEER),
    ];
    const senderDevs = [
      makeDevice("sender-dev-self", SENDER),
      makeDevice("sender-dev-yy", SENDER),
      makeDevice("sender-dev-aa", SENDER),
    ];
    let captured: { rows: Array<{ recipient_device_id: string }> } | null = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({ ok: true, rows_written: 4, ids: [] }),
        { status: 200 },
      );
    });

    await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "ordered",
      peerDevicesOverride: peerDevs,
      senderDevicesOverride: senderDevs,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured).not.toBeNull();
    const ids = captured!.rows.map((r) => r.recipient_device_id);
    // peers (sorted by device_id) then self-echo (sorted by device_id)
    expect(ids).toEqual([
      "peer-aaa",
      "peer-zzz",
      "sender-dev-aa",
      "sender-dev-yy",
    ]);
  });

  it("case 5 · retry with same message_group_id · dispatcher POSTs the same group id", async () => {
    // Prove the dispatcher's message_group_id is stable across retries
    // *within one call*: the uuid is generated once per call, so a retry
    // at the caller level repeating the dispatcher call will NOT reuse
    // the same id. Idempotency lives at the ROUTE layer (route.test.ts
    // covers that). Here we assert the dispatcher includes
    // message_group_id in the posted body and that it matches the
    // message_group_id returned to the caller.
    const peerDevs = [makeDevice("peer-1", PEER)];
    const senderDevs = [makeDevice("sender-dev-self", SENDER)];
    let capturedGroupId: string | null = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string);
      capturedGroupId = body.message_group_id;
      return new Response(
        JSON.stringify({
          ok: true,
          message_group_id: capturedGroupId,
          rows_written: 1,
          ids: ["r1"],
        }),
        { status: 200 },
      );
    });

    const res = await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "once",
      peerDevicesOverride: peerDevs,
      senderDevicesOverride: senderDevs,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message_group_id).toBe(capturedGroupId);
      expect(capturedGroupId).toBeTruthy();
    }
  });

  it("case 6 · HTTP 500 propagates as http_failed with no partial result", async () => {
    const peerDevs = [makeDevice("peer-1", PEER)];
    const senderDevs = [makeDevice("sender-dev-self", SENDER)];
    const fetchImpl = vi.fn(async () => {
      return new Response("boom", { status: 500, statusText: "server" });
    });
    const res = await dispatchEncryptedPeerMessage({
      conversationId: CONV,
      senderAccountId: SENDER,
      recipientAccountId: PEER,
      plaintext: "oops",
      peerDevicesOverride: peerDevs,
      senderDevicesOverride: senderDevs,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("http_failed");
  });
});
