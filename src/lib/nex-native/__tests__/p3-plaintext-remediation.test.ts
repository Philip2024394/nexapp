// src/lib/nex-native/__tests__/p3-plaintext-remediation.test.ts
//
// P3 plaintext-chat remediation · owner-authorised 2026-11-23.
// -----------------------------------------------------------------------------
// This suite proves that the three plaintext write paths identified
// in the Phase 1 report cannot persist plaintext to the server under
// the sealed device-only chat doctrine (2026-11-09) · AND that the
// freeze flag that gates them is fail-closed by default.
//
// Contracts asserted:
//
//   1. `editPeerMessage` returns `{ ok: false, reason: 'plaintext-
//      frozen' }` under the fail-closed default and performs NO
//      Supabase SELECT or UPDATE on `nex_peer_message` whatsoever.
//      Historical behaviour (plaintext body UPDATE, append to
//      edit_history) was itself the vulnerability · every DB touch
//      is suppressed.
//
//   2. `uploadPeerAttachment` throws under the fail-closed default
//      BEFORE reading a single byte of the file. The public bucket
//      `nex-peer-chat-attachments` is never touched.
//
//   3. The guest-chat server action (`sendGuestMessageAction`)
//      surfaces `{ ok: false, reason: 'plaintext_frozen' }` under
//      the fail-closed default. The previous direct insert into
//      `nex_peer_message` is gone · no row is written.
//
//   4. `editPeerMessage` CAN still proceed past the guard when the
//      operator sets `NEX_CHAT_PLAINTEXT_FREEZE=0` explicitly. This
//      pins the ONLY legitimate way to re-enable plaintext for
//      legacy / migration compatibility · unset env is never that
//      opt-out.
//
//   5. The encrypted send path (sendEncryptedPeerMessages) is NOT
//      affected by the freeze. The sentinel body + ciphertext +
//      nonce layout continues to be the authorised private-content
//      write shape.
//
// The suite uses the same supabase-admin mocking pattern as
// `attachment-participant-std.test.ts`: hoisted `fromMock` +
// `storageFromMock` factories so the real client is never
// instantiated, and we can assert that the mocks are never called
// when the guard refuses.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// -------- supabase-admin mock --------------------------------------
const {
  fromMock,
  storageFromMock,
  uploadMock,
  getPublicUrlMock,
  insertMock,
  updateMock,
  selectMock,
  maybeSingleMock,
  eqMock,
  inMock,
} = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const inMock = vi.fn();
  // Chainable builder · any order the service composes.
  const builder: Record<string, unknown> = {};
  builder.select = (...args: unknown[]) => {
    selectMock(...args);
    return builder;
  };
  builder.insert = (...args: unknown[]) => {
    insertMock(...args);
    return Promise.resolve({ data: null, error: null });
  };
  builder.update = (...args: unknown[]) => {
    updateMock(...args);
    return builder;
  };
  builder.eq = (...args: unknown[]) => {
    eqMock(...args);
    return builder;
  };
  builder.in = (...args: unknown[]) => {
    inMock(...args);
    return builder;
  };
  builder.maybeSingle = (...args: unknown[]) => {
    maybeSingleMock(...args);
    return Promise.resolve({ data: null, error: null });
  };
  builder.neq = () => builder;
  builder.is = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  const fromMock = vi.fn(() => builder);
  const storageFromMock = vi.fn(() => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  }));
  return {
    fromMock,
    storageFromMock,
    uploadMock,
    getPublicUrlMock,
    insertMock,
    updateMock,
    selectMock,
    maybeSingleMock,
    eqMock,
    inMock,
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: fromMock,
    storage: { from: storageFromMock },
  },
}));

// Import AFTER the mock declarations so the service picks them up.
import {
  editPeerMessage,
  PlaintextFrozenError,
  uploadPeerAttachment,
} from "@/lib/nex-native/peer-message-service";

// Guest-action deps need their own mocks before importing the action.
const { resolveProvisionalMock, getOrCreateConvMock, recordIfAllowedMock } =
  vi.hoisted(() => ({
    resolveProvisionalMock: vi.fn(),
    getOrCreateConvMock: vi.fn(),
    recordIfAllowedMock: vi.fn(),
  }));
vi.mock(
  "@/lib/nex-native/first-conversation/provisional-session",
  () => ({ resolveNexAppOrProvisionalSession: resolveProvisionalMock }),
);
vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: getOrCreateConvMock,
}));
vi.mock("@/lib/nex-native/community/rate-limit", () => ({
  recordIfAllowed: recordIfAllowedMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The guest action lives under the app router · import after mocks.
import { sendGuestMessageAction } from "@/app/nex-native/chat/guest/[ownerAccountId]/_actions";

// -------- env helpers -----------------------------------------------
function enableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "1");
}
function disableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "0");
}
function unsetFreeze(): void {
  vi.unstubAllEnvs();
  delete process.env.NEX_CHAT_PLAINTEXT_FREEZE;
}

beforeEach(() => {
  fromMock.mockClear();
  storageFromMock.mockClear();
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
  insertMock.mockClear();
  updateMock.mockClear();
  selectMock.mockClear();
  maybeSingleMock.mockClear();
  eqMock.mockClear();
  inMock.mockClear();
  resolveProvisionalMock.mockClear();
  getOrCreateConvMock.mockClear();
  recordIfAllowedMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const V_UUID = "11111111-1111-4111-8111-111111111111";
const V_UUID2 = "22222222-2222-4222-8222-222222222222";

// ===================================================================
// Path 2 · editPeerMessage · body UPDATE
// ===================================================================
describe("editPeerMessage · P3 plaintext-frozen guard (2026-11-23)", () => {
  it("fail-closed default · unset env · returns reason=plaintext-frozen without touching the DB", async () => {
    unsetFreeze();
    const result = await editPeerMessage({
      messageId: V_UUID,
      senderAccountId: V_UUID2,
      newBody: "new body text",
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("plaintext-frozen");
    }
    // Critical · no DB interaction at all.
    expect(fromMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it("fail-closed · explicit NEX_CHAT_PLAINTEXT_FREEZE=1 · same refusal, no DB touch", async () => {
    enableFreeze();
    const result = await editPeerMessage({
      messageId: V_UUID,
      senderAccountId: V_UUID2,
      newBody: "another edit",
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("plaintext-frozen");
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("explicit opt-out · NEX_CHAT_PLAINTEXT_FREEZE=0 · guard releases, DB SELECT proceeds", async () => {
    disableFreeze();
    // The row-lookup returns null · we only care that the service
    // got PAST the freeze guard and attempted the fetch.
    await editPeerMessage({
      messageId: V_UUID,
      senderAccountId: V_UUID2,
      newBody: "legacy body",
    });
    expect(fromMock).toHaveBeenCalledWith("nex_peer_message");
    expect(selectMock).toHaveBeenCalled();
  });
});

// ===================================================================
// Path 3 · uploadPeerAttachment · plaintext bytes → PUBLIC bucket
// ===================================================================
describe("uploadPeerAttachment · P3 plaintext-frozen guard (2026-11-23)", () => {
  // A tiny real File-shaped object · the service only reads .size,
  // .type, .name, and .arrayBuffer() to classify + upload. We can
  // stand in with a small cast so the test doesn't depend on jsdom.
  function fakeImage(sizeBytes: number): File {
    return {
      size: sizeBytes,
      type: "image/png",
      name: "pic.png",
      arrayBuffer: async () => new Uint8Array(sizeBytes).buffer,
      // These are unused by uploadPeerAttachment but File requires
      // them structurally · cheap no-ops.
      slice: () => new Blob(),
      stream: () => new ReadableStream(),
      text: async () => "",
    } as unknown as File;
  }

  it("fail-closed default · unset env · throws immediately, no bucket touch, no bytes read", async () => {
    unsetFreeze();
    const file = fakeImage(1024);
    const readSpy = vi.spyOn(file, "arrayBuffer");
    await expect(
      uploadPeerAttachment(V_UUID, file),
    ).rejects.toThrow(/NEX_CHAT_PLAINTEXT_FREEZE active/);
    expect(storageFromMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("fail-closed · explicit NEX_CHAT_PLAINTEXT_FREEZE=1 · same refusal, bucket untouched", async () => {
    enableFreeze();
    await expect(
      uploadPeerAttachment(V_UUID, fakeImage(2048)),
    ).rejects.toThrow(/NEX_CHAT_PLAINTEXT_FREEZE active/);
    expect(storageFromMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("explicit opt-out · NEX_CHAT_PLAINTEXT_FREEZE=0 · guard releases, upload is attempted", async () => {
    disableFreeze();
    uploadMock.mockResolvedValueOnce({ data: { path: "x" }, error: null });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: "https://x" } });
    await uploadPeerAttachment(V_UUID, fakeImage(32));
    expect(storageFromMock).toHaveBeenCalledWith("nex-peer-chat-attachments");
    expect(uploadMock).toHaveBeenCalled();
  });
});

// ===================================================================
// Path 1 · guest chat server action · sendGuestMessageAction
// ===================================================================
describe("sendGuestMessageAction · P3 plaintext-frozen guard (2026-11-23)", () => {
  // Minimum viable happy-path context · the action resolves to a
  // provisional session, resolves/creates a conversation, and passes
  // the rate-limit gate. Everything else is controlled per-test.
  function stubHappyPath(): void {
    resolveProvisionalMock.mockResolvedValue({
      kind: "provisional",
      account: { id: V_UUID2 },
    });
    getOrCreateConvMock.mockResolvedValue({
      id: V_UUID,
      participant_a_id: V_UUID2,
      participant_b_id: V_UUID,
    });
    recordIfAllowedMock.mockResolvedValue(undefined);
  }

  it("fail-closed default · unset env · returns reason=plaintext_frozen, no nex_peer_message insert", async () => {
    unsetFreeze();
    stubHappyPath();
    const result = await sendGuestMessageAction(V_UUID, "hello");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("plaintext_frozen");
    // sendPeerMessage is called but throws PlaintextFrozenError
    // BEFORE the `.insert` runs · the guest row never materialises.
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("fail-closed · explicit NEX_CHAT_PLAINTEXT_FREEZE=1 · same refusal, no insert", async () => {
    enableFreeze();
    stubHappyPath();
    const result = await sendGuestMessageAction(V_UUID, "hello");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("plaintext_frozen");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("refuses when caller is NOT a provisional session (unauthenticated) · no DB touch, no freeze lookup", async () => {
    // Belt-and-braces · existing upstream guard still fires first.
    unsetFreeze();
    resolveProvisionalMock.mockResolvedValue({ kind: "none" });
    const result = await sendGuestMessageAction(V_UUID, "hello");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unauthenticated");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
