// src/lib/nex-native/calls/__tests__/invite-service-v5-wrapper-shape.test.ts
//
// AGENT WRAP · Gate A · v5-W1 wrapper 5-col shape verification
// Generated 2026-11-19
//
// Purpose
// -------
// Verifies that the v5-candidate wrapper (`invite-service.v5-candidate.ts`)
// correctly parses the 5-column return shape of the v4 combined RPC
// (`nex_invite_to_call_tx`) including the `out_skipped` discriminator
// column — covering the happy path, dedup path, and shape-edge paths.
//
// §16.46 handback listed 4 columns; §16.47.2 flagged this as a precision
// gap. These tests confirm the wrapper's actual 5-col behaviour against
// the SQL RETURNS TABLE definition at v4 lines 113-119.
//
// Evidence tier: UNIT (mocked RPC). No DB, no network.
//
// Test IDs: WRAP-SHAPE-01 through WRAP-SHAPE-06.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inviteToCallV5Candidate } from "../invite-service.v5-candidate";

// ── Fixtures ───────────────────────────────────────────────────────────

const SELF_ID      = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INVITEE_ID   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARTICIPANT_ID  = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONVERSATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MESSAGE_ID   = "ffffffff-ffff-4fff-8fff-ffffffffffff";

/** Canonical 5-col happy-path row as the SQL RETURN QUERY emits it. */
function fullRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    out_session_id:      SESSION_ID,
    out_participant_id:  PARTICIPANT_ID,
    out_conversation_id: CONVERSATION_ID,
    out_message_id:      MESSAGE_ID,
    out_skipped:         null,
    ...overrides,
  };
}

function makeAdmin(
  response:
    | { data: unknown; error: null }
    | { data: null; error: { message: string; code?: string } },
) {
  return { rpc: vi.fn().mockResolvedValue(response) };
}

const BASE_INPUT = {
  selfAccountId:    SELF_ID,
  inviteeAccountId: INVITEE_ID,
  mediaType:        "video" as const,
  hostCountry:      "ireland",
  attachmentMeta:   { session_id: SESSION_ID, media_type: "video" },
  inviteBody:       "Video call invite · tap Accept to join",
  attachmentUrl:    `/nex-native/call/preview?session=${SESSION_ID}&accept=1`,
};

// ── Shape tests ────────────────────────────────────────────────────────

describe("WRAP-SHAPE · v5-candidate wrapper 5-col RPC return shape", () => {

  // ── WRAP-SHAPE-01 · happy path ─────────────────────────────────────
  //
  // SQL RETURN QUERY at v4 lines 298-303:
  //   RETURN QUERY SELECT v_session_id, v_participant_id,
  //                       v_conversation_id, v_message_id, NULL::TEXT;
  //
  // Wrapper reads out_skipped (line 266): null !== "already_invited"
  // → falls through to happy-path check (line 277) → all 4 IDs present
  // → returns {ok:true, sessionId, participantId, conversationId, messageId}.
  // `skipped` MUST be absent.

  it("WRAP-SHAPE-01 · happy-path row: 5-col with out_skipped=null → ok:true + all 4 IDs + no skipped", async () => {
    const admin = makeAdmin({ data: [fullRow()], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-SHAPE-02 · dedup path ─────────────────────────────────────
  //
  // SQL RETURN QUERY at v4 lines 239-244 (unique_violation EXCEPTION block):
  //   RETURN QUERY SELECT v_session_id, v_participant_id,
  //                       NULL::UUID, NULL::UUID, 'already_invited'::TEXT;
  //
  // Wrapper reads out_skipped (line 266): "already_invited" === "already_invited"
  // → returns {ok:true, skipped:"already_invited", sessionId, participantId}.
  // conversationId and messageId MUST be absent (wrapper does not propagate
  // NULL UUIDs for them on the dedup branch).

  it("WRAP-SHAPE-02 · dedup row: out_skipped='already_invited' → ok:true + skipped + session/participant only", async () => {
    const admin = makeAdmin({
      data: [fullRow({
        out_conversation_id: null,
        out_message_id:      null,
        out_skipped:         "already_invited",
      })],
      error: null,
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("already_invited");
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    // conversationId and messageId not forwarded on the dedup branch
    expect(r.conversationId).toBeUndefined();
    expect(r.messageId).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-SHAPE-03 · hypothetical 4-col return (§16.46 abridgement) ──
  //
  // The §16.46 handback described a 4-column return omitting out_skipped.
  // This case tests what happens when the row has no out_skipped key at
  // all (undefined, not null).
  //
  // Wrapper reads row.out_skipped (line 266): undefined === "already_invited"
  // is false → falls through to happy-path check (line 277) → all 4 IDs
  // present → returns {ok:true, all 4 IDs}.
  // This is graceful: a missing out_skipped is treated as a non-dedup row,
  // so the wrapper degrades safely to happy-path interpretation.
  //
  // DOCUMENT: This is NOT a failure, but means a 4-col RPC that genuinely
  // returned the dedup path (NULL conv/message, intending to signal dedup)
  // would be SILENTLY MISREAD as a shape error (NULL IDs → rpc_shape_error).
  // However, the actual v4 SQL always returns 5 columns, so this edge only
  // applies to the §16.46 documentation gap — not to a live scenario.

  it("WRAP-SHAPE-03 · 4-col row (out_skipped absent/undefined) + all 4 IDs → graceful happy-path fallback: ok:true", async () => {
    // Build a row WITHOUT the out_skipped key (simulates §16.46 description)
    const fourColRow = {
      out_session_id:      SESSION_ID,
      out_participant_id:  PARTICIPANT_ID,
      out_conversation_id: CONVERSATION_ID,
      out_message_id:      MESSAGE_ID,
      // out_skipped deliberately absent
    };
    const admin = makeAdmin({ data: [fourColRow], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    // Graceful fallback: undefined is not "already_invited", all 4 IDs present
    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    // No dedup signal emitted
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-SHAPE-04 · empty string out_skipped ───────────────────────
  //
  // out_skipped = '' is not "already_invited" → wrapper treats as non-dedup
  // → happy-path check → all 4 IDs present → ok:true.
  // Empty string does NOT trigger the dedup branch.

  it("WRAP-SHAPE-04 · out_skipped='' (empty string) → treated as non-dedup → ok:true + all 4 IDs", async () => {
    const admin = makeAdmin({
      data: [fullRow({ out_skipped: "" })],
      error: null,
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    // Empty string is NOT treated as a skipped signal
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-SHAPE-05 · unknown out_skipped value ──────────────────────
  //
  // out_skipped = 'something_else' is not "already_invited" → wrapper
  // falls through to happy-path check → all 4 IDs present → ok:true.
  //
  // DOCUMENT: The wrapper has no exhaustive match on out_skipped values.
  // An unknown non-null skipped value with all 4 IDs present will be
  // returned as a happy-path ok:true with the skipped signal lost.
  // This is a known limitation of the current wrapper (not a blocker for
  // Gate A because the SQL only emits null or 'already_invited').

  it("WRAP-SHAPE-05 · out_skipped='something_else' (unknown value) + all 4 IDs → passes through as happy-path ok:true (skipped signal lost)", async () => {
    const admin = makeAdmin({
      data: [fullRow({ out_skipped: "something_else" })],
      error: null,
    });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    // Unknown skipped value is not matched; wrapper continues to happy-path
    expect(r.ok).toBe(true);
    expect(r.sessionId).toBe(SESSION_ID);
    expect(r.participantId).toBe(PARTICIPANT_ID);
    expect(r.conversationId).toBe(CONVERSATION_ID);
    expect(r.messageId).toBe(MESSAGE_ID);
    // The unknown skipped value is NOT forwarded
    expect(r.skipped).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  // ── WRAP-SHAPE-06 · empty rowset ───────────────────────────────────
  //
  // Wrapper line 259: `!Array.isArray(data) || data.length === 0`
  // → returns {ok:false, error:"rpc_shape_error"}.

  it("WRAP-SHAPE-06 · empty rowset [] → ok:false + error:rpc_shape_error", async () => {
    const admin = makeAdmin({ data: [], error: null });
    const r = await inviteToCallV5Candidate(admin, BASE_INPUT);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

});
