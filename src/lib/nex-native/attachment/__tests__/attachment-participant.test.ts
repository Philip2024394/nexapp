// src/lib/nex-native/attachment/__tests__/attachment-participant.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const STATE = vi.hoisted(() => ({
  messageRow: null as null | {
    conversation_id: string;
    attachment_meta: unknown;
  },
  conversationRow: null as null | {
    participant_a_id: string;
    participant_b_id: string;
  },
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      if (table === "nex_peer_message") {
        return {
          select: () => ({
            filter: () => ({
              limit: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: STATE.messageRow,
                    error: STATE.messageRow ? null : null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "nex_peer_conversation") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: STATE.conversationRow,
                  error: STATE.conversationRow ? null : null,
                }),
            }),
          }),
        };
      }
      throw new Error("unexpected table: " + table);
    },
  },
}));

import {
  isValidCiphertextPath,
  verifyParticipantForCiphertext,
} from "../attachment-participant";

const SENDER = "11111111-1111-1111-1111-111111111111";
const RECIPIENT = "22222222-2222-2222-2222-222222222222";
const OUTSIDER = "33333333-3333-3333-3333-333333333333";
const CONV = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VALID_PATH = `enc/${SENDER}/1730000000-abc123.bin`;

describe("isValidCiphertextPath", () => {
  it("accepts the sealed upload-route shape", () => {
    expect(isValidCiphertextPath(VALID_PATH)).toBe(true);
  });
  it("rejects random user input", () => {
    expect(isValidCiphertextPath("../etc/passwd")).toBe(false);
    expect(isValidCiphertextPath("enc//1730000000-abc123.bin")).toBe(false);
    expect(isValidCiphertextPath("enc/not-uuid/1730000000-abc123.bin")).toBe(false);
    expect(isValidCiphertextPath("enc/" + SENDER + "/short")).toBe(false);
    expect(isValidCiphertextPath("")).toBe(false);
  });
  it("rejects path traversal / scheme injection", () => {
    expect(isValidCiphertextPath("https://evil.example.com/foo")).toBe(false);
    expect(isValidCiphertextPath("enc/" + SENDER + "/1730000000-abc123.bin/../x")).toBe(false);
  });
});

describe("verifyParticipantForCiphertext", () => {
  beforeEach(() => {
    STATE.messageRow = null;
    STATE.conversationRow = null;
  });

  it("returns not-found for malformed path", async () => {
    const r = await verifyParticipantForCiphertext(SENDER, "bogus");
    expect(r).toBe("not-found");
  });

  it("returns not-found when no message references the path", async () => {
    STATE.messageRow = null;
    const r = await verifyParticipantForCiphertext(SENDER, VALID_PATH);
    expect(r).toBe("not-found");
  });

  it("returns not-found when the owning conversation is missing", async () => {
    STATE.messageRow = { conversation_id: CONV, attachment_meta: {} };
    STATE.conversationRow = null;
    const r = await verifyParticipantForCiphertext(SENDER, VALID_PATH);
    expect(r).toBe("not-found");
  });

  it("returns participant when caller is participant_a", async () => {
    STATE.messageRow = { conversation_id: CONV, attachment_meta: {} };
    STATE.conversationRow = {
      participant_a_id: SENDER,
      participant_b_id: RECIPIENT,
    };
    const r = await verifyParticipantForCiphertext(SENDER, VALID_PATH);
    expect(r).toBe("participant");
  });

  it("returns participant when caller is participant_b", async () => {
    STATE.messageRow = { conversation_id: CONV, attachment_meta: {} };
    STATE.conversationRow = {
      participant_a_id: SENDER,
      participant_b_id: RECIPIENT,
    };
    const r = await verifyParticipantForCiphertext(RECIPIENT, VALID_PATH);
    expect(r).toBe("participant");
  });

  it("returns not-participant when caller is unrelated", async () => {
    STATE.messageRow = { conversation_id: CONV, attachment_meta: {} };
    STATE.conversationRow = {
      participant_a_id: SENDER,
      participant_b_id: RECIPIENT,
    };
    const r = await verifyParticipantForCiphertext(OUTSIDER, VALID_PATH);
    expect(r).toBe("not-participant");
  });
});
