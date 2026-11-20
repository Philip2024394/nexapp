// src/lib/nex-native/calls/__tests__/invite-service.v5-candidate.w1-return-shape.test.ts
//
// AGENT WRAP · Gate A · v5-W1 five-column return-shape compatibility
// Generated 2026-11-19 · OFFLINE · no DB · no network
//
// Purpose
// -------
// Proves the existing `inviteToCallV5Candidate` wrapper correctly parses
// the W1 five-column return shape emitted by the applied v4 combined RPC
// `nex_invite_to_call_tx` (see migration 357). Specifically this file
// covers the `out_skipped TEXT` fifth column + the typed error-mapping
// contract for the four SQLSTATEs the wrapper must map:
//
//   · 22023 · attachment_url_required (POSIX ERE guard)
//   · 42501 · caller_identity_required (auth.uid NULL / no nex_account)
//   · P0001 · participant_cap_exceeded (mig-133 cap trigger, race-safe
//              now via FOR UPDATE in v4)
//
// Companion to `invite-service-v5-wrapper-shape.test.ts` which focuses
// on skipped-discriminator semantics. This file focuses on:
//
//   1. the RPC name actually invoked,
//   2. the parameter object actually forwarded,
//   3. field-name (not ordinal) resilience of the parser,
//   4. error-object `{ code, message }` → typed error-code mapping,
//   5. missing-column loud failure (no silent success).
//
// Evidence tier: UNIT (vitest + mocked supabase-js RPC client).
//
// Test IDs: WRAP-W1-01 through WRAP-W1-07.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inviteToCallV5Candidate } from "../invite-service.v5-candidate";

// ── Fixtures ───────────────────────────────────────────────────────────

const SELF_ID         = "11111111-1111-4111-8111-111111111111";
const INVITEE_ID      = "22222222-2222-4222-8222-222222222222";
const SESSION_ID      = "33333333-3333-4333-8333-333333333333";
const PARTICIPANT_ID  = "44444444-4444-4444-8444-444444444444";
const CONVERSATION_ID = "55555555-5555-4555-8555-555555555555";
const MESSAGE_ID      = "66666666-6666-4666-8666-666666666666";

const BASE_INPUT = {
  selfAccountId:    SELF_ID,
  inviteeAccountId: INVITEE_ID,
  mediaType:        "audio" as const,
  hostCountry:      "ireland",
  attachmentMeta:   { session_id: SESSION_ID, media_type: "audio" },
  inviteBody:       "Audio call invite · tap Accept to join",
  attachmentUrl:    `/nex-native/call/preview?session=${SESSION_ID}&accept=1`,
};

function fiveColHappyRow(): Record<string, unknown> {
  return {
    out_session_id:      SESSION_ID,
    out_participant_id:  PARTICIPANT_ID,
    out_conversation_id: CONVERSATION_ID,
    out_message_id:      MESSAGE_ID,
    out_skipped:         null,
  };
}

function fiveColDedupRow(): Record<string, unknown> {
  // Matches v4 SQL lines 239-244 (unique_violation EXCEPTION branch).
  return {
    out_session_id:      SESSION_ID,
    out_participant_id:  PARTICIPANT_ID,
    out_conversation_id: null,
    out_message_id:      null,
    out_skipped:         "already_invited",
  };
}

function makeAdmin(
  response:
    | { data: unknown; error: null }
    | { data: null; error: { message: string; code?: string } },
) {
  return { rpc: vi.fn().mockResolvedValue(response) };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("WRAP-W1 · v5-candidate wrapper parses v4 five-column return shape", () => {

  // ── WRAP-W1-01 · Happy path · new invite ──────────────────────────
  //
  // RPC returns five populated columns with out_skipped = null.
  // Wrapper MUST:
  //   · invoke RPC name `nex_invite_to_call_tx`,
  //   · forward exactly the seven v4 named parameters,
  //   · parse all four IDs, not treat null out_skipped as an error,
  //   · emit ok:true + no `skipped` + no `error`.

  it("WRAP-W1-01 · happy path · five-col null skipped → ok:true + RPC name + params verified", async () => {
    const admin = makeAdmin({ data: [fiveColHappyRow()], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    // Result shape
    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();

    // RPC invocation surface
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcParams] = admin.rpc.mock.calls[0];
    expect(rpcName).toBe("nex_invite_to_call_tx");
    // Named-param contract · must match the 7-param signature of mig 357
    expect(rpcParams).toEqual({
      p_invitee_account_id:  INVITEE_ID,
      p_media_type:          "audio",
      p_host_country:        "ireland",
      p_attachment_meta:     BASE_INPUT.attachmentMeta,
      p_invite_body:         BASE_INPUT.inviteBody,
      p_attachment_url:      BASE_INPUT.attachmentUrl,
      p_existing_session_id: null,
    });
    // selfSupabaseUserId must NOT be forwarded · identity is auth.uid()
    // server-side in v4.
    expect(rpcParams).not.toHaveProperty("p_self_supabase_user_id");
    expect(rpcParams).not.toHaveProperty("p_self_account_id");
  });

  // ── WRAP-W1-02 · Happy path · already-invited duplicate ───────────
  //
  // Dedup branch: RPC returns session + participant IDs but NULL
  // conversation/message IDs and out_skipped = 'already_invited'.
  // Wrapper MUST recognise the skip state and return ok:true (not a
  // failure), setting `skipped: "already_invited"`.

  it("WRAP-W1-02 · already-invited dedup · out_skipped='already_invited' → ok:true + skipped set", async () => {
    const admin = makeAdmin({ data: [fiveColDedupRow()], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("already_invited");
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    // Dedup branch does not forward conv/message IDs
    expect(r.conversationId).toBeUndefined();
    expect(r.messageId).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-W1-03 · 22023 whitespace/url-guard failure ───────────────
  //
  // Supabase-js carries `{ code: '22023', message: ... }`. v4 raises:
  //   'attachment_url_required · call_invite needs a well-formed
  //    accept_href matching _LANE_G_ACCEPT_HREF_PATTERN'
  // Wrapper must map to the typed error `attachment_url_required`,
  // NOT swallow it and NOT map to self_invite_denied / invalid_media.

  it("WRAP-W1-03 · 22023 attachment_url guard → error:attachment_url_required (not swallowed)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        code: "22023",
        message:
          "attachment_url_required · call_invite needs a well-formed accept_href matching _LANE_G_ACCEPT_HREF_PATTERN",
      },
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("attachment_url_required");
    // Must NOT be silently coerced to another bucket
    expect(r.error).not.toBe("rpc_shape_error");
    expect(r.error).not.toBe("self_invite_denied");
  });

  // ── WRAP-W1-04 · 42501 caller_identity_required ───────────────────
  //
  // v4 lines 136-147 raise `caller_identity_required` or
  // `caller_account_not_found` with ERRCODE 42501. Wrapper maps both
  // onto the same typed code `caller_identity_required`.

  it("WRAP-W1-04 · 42501 auth.uid null → error:caller_identity_required (auth-failure path)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        code: "42501",
        message: "caller_identity_required · auth.uid() is NULL",
      },
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("caller_identity_required");
  });

  it("WRAP-W1-04b · 42501 caller_account_not_found → error:caller_identity_required (merged)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        code: "42501",
        message: "caller_account_not_found · no nex_account for auth.uid()",
      },
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("caller_identity_required");
  });

  // ── WRAP-W1-05 · P0001 participant_cap_exceeded ───────────────────
  //
  // mig-133 BEFORE INSERT cap trigger raises with SQLSTATE P0001
  // (RAISE EXCEPTION without a custom ERRCODE). Wrapper must map to
  // `participant_cap_exceeded`, not to `rpc_shape_error`.

  it("WRAP-W1-05 · P0001 cap trigger → error:participant_cap_exceeded (cap-exceeded path)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        code: "P0001",
        message:
          "nex_group_call_session already has 4 participants · participant cap reached",
      },
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("participant_cap_exceeded");
  });

  // ── WRAP-W1-06 · Empty / unexpected shape → fails LOUDLY ─────────
  //
  // Two sub-cases both must produce a typed error (not silent success):
  //   (a) RPC returns no rows: data = [].
  //   (b) Row missing required columns: out_message_id is missing →
  //       wrapper's happy-path check (`!row.out_message_id`) fires →
  //       rpc_shape_error.
  //
  // These prove the wrapper does NOT return ok:true when the contract
  // is broken.

  it("WRAP-W1-06a · empty rowset → ok:false + error:rpc_shape_error", async () => {
    const admin = makeAdmin({ data: [], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
    // Explicitly: not a silent success
    expect(r.sessionId).toBeUndefined();
    expect(r.messageId).toBeUndefined();
  });

  it("WRAP-W1-06b · row missing out_message_id (and null out_skipped) → ok:false + error:rpc_shape_error", async () => {
    const rowMissingMessage: Record<string, unknown> = {
      out_session_id:      SESSION_ID,
      out_participant_id:  PARTICIPANT_ID,
      out_conversation_id: CONVERSATION_ID,
      // out_message_id deliberately absent
      out_skipped:         null,
    };
    const admin = makeAdmin({ data: [rowMissingMessage], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  it("WRAP-W1-06c · non-array data payload → ok:false + error:rpc_shape_error", async () => {
    // Guard against a legacy single-object return (supabase-js has
    // historically normalised to array; this asserts the wrapper's
    // Array.isArray check also catches an object-shaped regression).
    const admin = makeAdmin({
      data: fiveColHappyRow() as unknown,
      error: null,
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  // ── WRAP-W1-07 · Column-order resilience ──────────────────────────
  //
  // supabase-js returns rows as plain objects keyed by column name, so
  // ordinal column order in the SQL RETURNS TABLE clause must not
  // affect parsing. This test re-arranges the five keys and asserts
  // the wrapper still succeeds identically.

  it("WRAP-W1-07 · reordered row keys (out_skipped first, out_message_id second, …) → ok:true + all IDs parsed by name", async () => {
    const reordered: Record<string, unknown> = {
      out_skipped:         null,
      out_message_id:      MESSAGE_ID,
      out_conversation_id: CONVERSATION_ID,
      out_participant_id:  PARTICIPANT_ID,
      out_session_id:      SESSION_ID,
    };
    const admin = makeAdmin({ data: [reordered], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  it("WRAP-W1-07b · reordered dedup row → ok:true + skipped=already_invited (by-name parsing)", async () => {
    const reorderedDedup: Record<string, unknown> = {
      out_skipped:         "already_invited",
      out_participant_id:  PARTICIPANT_ID,
      out_session_id:      SESSION_ID,
      out_message_id:      null,
      out_conversation_id: null,
    };
    const admin = makeAdmin({ data: [reorderedDedup], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("already_invited");
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBeUndefined();
    expect(r.messageId).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

});
