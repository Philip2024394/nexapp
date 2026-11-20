// src/lib/nex-native/calls/__tests__/invite-service-transactional-candidate.test.ts
//
// Lane G-B · 2026-11-19 (§16.33) · UNAPPLIED transactional candidate.
//
// Anchors the TypeScript wrapper's error-code mapping for the
// unapplied `nex_invite_to_call_tx` RPC. This is a SPECIFICATION of
// how the wrapper should translate the RPC's error / data shapes
// into the InviteToCallTxResult contract.
//
// Explicit limits of this coverage
// --------------------------------
// · These are mocked RPC round-trips · they prove the TypeScript
//   mapping. They do NOT prove the database's transactional rollback
//   semantics, concurrency safety, or that the function exists in
//   any target DB.
// · The real transactional acceptance tests (listed in ledger
//   §16.33.6) must later run in the sandbox against a deployed
//   function, using disposable accounts, and must observe the ACTUAL
//   post-failure DB state (no orphan session row when the message
//   INSERT raises).

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inviteToCallTransactionalCandidate } from "../invite-service.transactional-candidate";

function okRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    out_session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    out_participant_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    out_conversation_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    out_message_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    out_skipped: null,
    ...overrides,
  };
}

function makeAdmin(
  response:
    | { data: unknown; error: null }
    | { data: null; error: { message: string; code?: string } },
) {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  };
}

const BASE_INPUT = {
  selfSupabaseUserId: "11111111-1111-1111-1111-111111111111",
  inviteeAccountId: "22222222-2222-2222-2222-222222222222",
  mediaType: "video" as const,
  hostCountry: "ireland",
  attachmentMeta: { session_id: "x", accept_href: "/x" },
  inviteBody: "📞 Video call invite · tap Accept to join",
};

describe("Lane G-B · inviteToCallTransactionalCandidate · error mapping specification (§16.33)", () => {
  it("GB-OK-1 · success · returns all four ids", async () => {
    const admin = makeAdmin({ data: [okRow()], error: null });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(r.participantId).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(r.conversationId).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(r.messageId).toBe("dddddddd-dddd-dddd-dddd-dddddddddddd");
    expect(r.skipped).toBeUndefined();
  });

  it("GB-DUP-1 · unique_violation on participant · wrapped as skipped='already_invited' with session+participant ids", async () => {
    const admin = makeAdmin({
      data: [
        okRow({
          out_conversation_id: null,
          out_message_id: null,
          out_skipped: "already_invited",
        }),
      ],
      error: null,
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("already_invited");
    expect(r.sessionId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(r.participantId).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(r.messageId).toBeUndefined();
  });

  it("GB-CALLER-MISMATCH · RPC raises caller_identity_mismatch · wrapper maps to error='caller_identity_mismatch'", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_identity_mismatch · auth.uid != p_self_supabase_user_id" },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("caller_identity_mismatch");
  });

  it("GB-CALLER-404 · RPC raises caller_account_not_found · wrapper maps to error='caller_account_not_found'", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_account_not_found" },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("caller_account_not_found");
  });

  it("GB-SELF · RPC raises self_invite_denied · wrapper maps to error='self_invite_denied'", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "self_invite_denied" },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("self_invite_denied");
  });

  it("GB-MEDIA · RPC raises invalid_media_type · wrapper maps to error='invalid_media_type'", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "invalid_media_type" },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("invalid_media_type");
  });

  it("GB-SESSION-OWNERSHIP · RPC raises session_not_owned · wrapper maps to error='session_not_owned'", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "session_not_owned" },
    });
    const r = await inviteToCallTransactionalCandidate(admin, {
      ...BASE_INPUT,
      existingSessionId: "99999999-9999-9999-9999-999999999999",
    });
    expect(r.error).toBe("session_not_owned");
  });

  it("GB-CHECK-306 · pre-mig306 CHECK violation on nex_peer_message · wrapper maps to skipped='attachment_type_not_available'", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message:
          'new row for relation "nex_peer_message" violates check constraint "nex_peer_message_attachment_type_check"',
      },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("attachment_type_not_available");
  });

  it("GB-RPC-MISSING · function not yet applied · wrapper maps to error='rpc_unavailable' so caller can fall back to legacy direct-write path", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: 'function nex_invite_to_call_tx(...) does not exist',
        code: "42883",
      },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("rpc_unavailable");
  });

  it("GB-4CAP · 4-participant cap trigger raises · wrapper maps to generic error='message_insert_failed' (specification · exact bucket may change under real DB behavior)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message:
          "nex_group_call_participant: session ... already has 4 participants",
      },
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    // Specification only · real behaviour to be re-anchored after
    // sandbox integration test observes the actual error class.
    expect(r.error).toBe("message_insert_failed");
  });

  it("GB-SHAPE · RPC returns empty rowset · wrapper maps to error='rpc_shape_error' instead of pretending success", async () => {
    const admin = makeAdmin({ data: [], error: null });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  it("GB-SHAPE-PARTIAL · RPC returns row missing conversation_id · wrapper maps to error='rpc_shape_error' instead of pretending success", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_conversation_id: null })],
      error: null,
    });
    const r = await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  it("GB-PASSTHROUGH · RPC is called with the exact parameter contract (named params, no smuggled fields)", async () => {
    const admin = makeAdmin({ data: [okRow()], error: null });
    await inviteToCallTransactionalCandidate(admin, BASE_INPUT);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("nex_invite_to_call_tx", {
      p_self_supabase_user_id: BASE_INPUT.selfSupabaseUserId,
      p_invitee_account_id: BASE_INPUT.inviteeAccountId,
      p_media_type: BASE_INPUT.mediaType,
      p_host_country: BASE_INPUT.hostCountry,
      p_attachment_meta: BASE_INPUT.attachmentMeta,
      p_invite_body: BASE_INPUT.inviteBody,
      p_existing_session_id: null,
    });
  });
});
