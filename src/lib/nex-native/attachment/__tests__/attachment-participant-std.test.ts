// src/lib/nex-native/attachment/__tests__/attachment-participant-std.test.ts
//
// P1.T06 · participant-check path-shape + lookup tests for the new
// `std/` standard-send private path. Owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Confirms:
//   · isValidStandardPrivatePath accepts the sealed shape only.
//   · isValidCiphertextPath remains strict to `enc/` only (regression).
//   · isValidPrivateAttachmentPath accepts both.
//   · Lookup flow prefers envelope.storage_path (encrypted) first,
//     then private_attachment.storage_path (standard-send), then the
//     legacy overlay. The lookup paths are exercised by directly
//     mocking the supabase-admin client.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, filterMock, limitMock, maybeSingleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  filterMock: vi.fn(),
  limitMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
}));

import {
  isValidCiphertextPath,
  isValidStandardPrivatePath,
  isValidPrivateAttachmentPath,
  verifyParticipantForCiphertext,
} from "@/lib/nex-native/attachment/attachment-participant";

describe("path-shape validators", () => {
  const VALID_UUID = "11111111-1111-1111-1111-111111111111";

  it("isValidCiphertextPath accepts enc/ paths only", () => {
    expect(
      isValidCiphertextPath(`enc/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(true);
    expect(
      isValidCiphertextPath(`std/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(false);
    expect(isValidCiphertextPath("random")).toBe(false);
    expect(isValidCiphertextPath("")).toBe(false);
  });

  it("isValidStandardPrivatePath accepts std/ paths only", () => {
    expect(
      isValidStandardPrivatePath(`std/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(true);
    expect(
      isValidStandardPrivatePath(`enc/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(false);
    expect(isValidStandardPrivatePath("")).toBe(false);
  });

  it("isValidPrivateAttachmentPath accepts both enc/ and std/", () => {
    expect(
      isValidPrivateAttachmentPath(`enc/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(true);
    expect(
      isValidPrivateAttachmentPath(`std/${VALID_UUID}/1700000000-abc123.bin`),
    ).toBe(true);
    expect(isValidPrivateAttachmentPath("random/path/here")).toBe(false);
  });

  it("rejects path-traversal or malformed shapes under both prefixes", () => {
    expect(isValidPrivateAttachmentPath("enc/../../etc/passwd")).toBe(false);
    expect(isValidPrivateAttachmentPath("std/..;/nope.pdf")).toBe(false);
    expect(isValidPrivateAttachmentPath("public/anything")).toBe(false);
    // Extension length cap · absurdly long extensions rejected.
    expect(
      isValidPrivateAttachmentPath(
        `std/11111111-1111-1111-1111-111111111111/1700000000-abc123.verylongext`,
      ),
    ).toBe(false);
  });
});

describe("verifyParticipantForCiphertext · std/ path lookup", () => {
  const ACTOR = "actor-account-id";
  const VALID_UUID = "22222222-2222-2222-2222-222222222222";
  const STD_PATH = `std/${VALID_UUID}/1700000000-abc123.pdf`;
  const ENC_PATH = `enc/${VALID_UUID}/1700000000-abc123.pdf`;

  type Builder = {
    select: (c: string) => Builder;
    filter: (a: string, op: string, v: string) => Builder;
    eq: (c: string, v: string) => Builder;
    limit: (n: number) => Builder;
    maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  };

  function makeBuilder(result: { data: unknown; error: unknown } | null): Builder {
    const final: Promise<{ data: unknown; error: unknown }> = Promise.resolve(
      result ?? { data: null, error: null },
    );
    const b: Builder = {
      select: () => b,
      filter: () => b,
      eq: () => b,
      limit: () => b,
      maybeSingle: () => final,
    };
    return b;
  }

  beforeEach(() => {
    fromMock.mockReset();
    filterMock.mockReset();
    limitMock.mockReset();
    maybeSingleMock.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("returns 'not-found' for malformed paths without hitting the DB", async () => {
    const got = await verifyParticipantForCiphertext(ACTOR, "garbage");
    expect(got).toBe("not-found");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 'participant' when the std/ path resolves via private_attachment lookup + caller is a participant", async () => {
    const CONV = "conv-123";
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      if (table === "nex_peer_message" && calls.filter((t) => t === "nex_peer_message").length === 1) {
        // 1st peer_message call · envelope.storage_path lookup · no hit.
        return makeBuilder({ data: null, error: null });
      }
      if (table === "nex_peer_message" && calls.filter((t) => t === "nex_peer_message").length === 2) {
        // 2nd peer_message call · private_attachment.storage_path lookup · HIT.
        return makeBuilder({
          data: { conversation_id: CONV },
          error: null,
        });
      }
      if (table === "nex_peer_conversation") {
        return makeBuilder({
          data: {
            participant_a_id: ACTOR,
            participant_b_id: "other-account",
          },
          error: null,
        });
      }
      return makeBuilder(null);
    });
    const got = await verifyParticipantForCiphertext(ACTOR, STD_PATH);
    expect(got).toBe("participant");
  });

  it("returns 'not-participant' when the std/ path resolves but caller is NOT a participant", async () => {
    const CONV = "conv-xyz";
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      if (table === "nex_peer_message" && calls.filter((t) => t === "nex_peer_message").length === 1) {
        return makeBuilder({ data: null, error: null });
      }
      if (table === "nex_peer_message" && calls.filter((t) => t === "nex_peer_message").length === 2) {
        return makeBuilder({
          data: { conversation_id: CONV },
          error: null,
        });
      }
      if (table === "nex_peer_conversation") {
        return makeBuilder({
          data: {
            participant_a_id: "someone-else",
            participant_b_id: "another-someone",
          },
          error: null,
        });
      }
      return makeBuilder(null);
    });
    const got = await verifyParticipantForCiphertext(ACTOR, STD_PATH);
    expect(got).toBe("not-participant");
  });

  it("returns 'not-found' when no lookup resolves the std/ path", async () => {
    fromMock.mockImplementation((_t: string) => makeBuilder({ data: null, error: null }));
    const got = await verifyParticipantForCiphertext(ACTOR, STD_PATH);
    expect(got).toBe("not-found");
  });

  it("enc/ lookups still work (regression · encrypted envelope path)", async () => {
    const CONV = "conv-enc-ok";
    fromMock.mockImplementation((table: string) => {
      if (table === "nex_peer_message") {
        return makeBuilder({
          data: { conversation_id: CONV },
          error: null,
        });
      }
      if (table === "nex_peer_conversation") {
        return makeBuilder({
          data: {
            participant_a_id: ACTOR,
            participant_b_id: "x",
          },
          error: null,
        });
      }
      return makeBuilder(null);
    });
    const got = await verifyParticipantForCiphertext(ACTOR, ENC_PATH);
    expect(got).toBe("participant");
  });
});
