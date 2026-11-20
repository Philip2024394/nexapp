// src/lib/nex-native/calls/__tests__/group-call-join-v5-candidate.test.ts
//
// W3 candidate · 2026-11-19
// -------------------------------------------------------------------------
// Specification tests for the `joinGroupCallSessionV5Candidate` wrapper.
//
// Explicit limits of this coverage
// ---------------------------------
// · These are mocked RPC round-trips. They prove the TypeScript mapping
//   from RPC errors / data shapes into the named error classes and the
//   JoinGroupCallSessionV5Result contract.
// · They do NOT prove DB transactional rollback semantics, FOR UPDATE
//   serialisation, trigger firing, or that the function exists in any
//   target DB.
// · Real transactional acceptance tests must later run in sandbox
//   `kdstoyyeygcopkogqsyv` against a deployed function using disposable
//   accounts and must observe actual post-failure DB state.
//
// W3 severity note
// ----------------
// No grep-confirmed live caller for `joinGroupCallSession` exists in
// src/app/ as of 2026-11-19. Severity is THEORETICAL.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  joinGroupCallSessionV5Candidate,
  V5RpcUnavailableError,
  CallerIdentityRequiredError,
  InvalidRoleError,
  InvalidSessionError,
} from "../group-call-join.v5-candidate";

// ── Helpers ───────────────────────────────────────────────────────────────

const SESSION_ID    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARTICIPANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function okRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    out_participant_id:   PARTICIPANT_ID,
    out_was_update:       false,
    out_session_promoted: false,
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

const BASE_INPUT = { sessionId: SESSION_ID } as const;

// ── Test suite ────────────────────────────────────────────────────────────

describe("W3 · joinGroupCallSessionV5Candidate · error mapping specification (2026-11-19)", () => {

  // ── Happy paths ──────────────────────────────────────────────────────

  it("W3-UPDATE-1 · UPDATE path · pre-invited row existed · was_update=true · session_promoted=false (host joins, session already live)", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_was_update: true, out_session_promoted: false })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).not.toBeNull();
    expect(r!.participantId).toBe(PARTICIPANT_ID);
    expect(r!.wasUpdate).toBe(true);
    expect(r!.sessionPromoted).toBe(false);
  });

  it("W3-UPDATE-2 · UPDATE path · first non-host join promotes session · was_update=true · session_promoted=true", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_was_update: true, out_session_promoted: true })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).not.toBeNull();
    expect(r!.wasUpdate).toBe(true);
    expect(r!.sessionPromoted).toBe(true);
  });

  it("W3-INSERT-1 · INSERT path · no pre-invite row · was_update=false · session_promoted=true (cold join promotes)", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_was_update: false, out_session_promoted: true })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).not.toBeNull();
    expect(r!.wasUpdate).toBe(false);
    expect(r!.sessionPromoted).toBe(true);
  });

  it("W3-INSERT-2 · INSERT path · was_update=false · session_promoted=false (session already live)", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_was_update: false, out_session_promoted: false })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).not.toBeNull();
    expect(r!.wasUpdate).toBe(false);
    expect(r!.sessionPromoted).toBe(false);
  });

  // ── 4-cap trigger race ───────────────────────────────────────────────

  it("W3-4CAP-1 · mig-133 BEFORE INSERT trigger fires (P0001) on INSERT path after FOR UPDATE serialisation · wrapper rethrows as generic Error", async () => {
    // After the FOR UPDATE serialises concurrent inserts, only one wins.
    // The loser sees P0001 raised by nex_group_call_participant_cap().
    // The SQL RPC raises this as a plain EXCEPTION (not caught internally).
    // The TS wrapper must rethrow as an Error (not silently swallow it).
    const admin = makeAdmin({
      data: null,
      error: {
        message: "nex_group_call_participant: session aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa already has 4 participants",
        code: "P0001",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow("already has 4 participants");
  });

  // ── unique_violation caught by SQL ───────────────────────────────────

  it("W3-RACE-1 · unique_violation caught INSIDE SQL · surfaces as was_update=true (idempotent join · race closed by FOR UPDATE)", async () => {
    // The SQL internally converts unique_violation into was_update=TRUE +
    // the existing participant_id. The TS layer receives a successful row,
    // not an error.
    const admin = makeAdmin({
      data: [okRow({ out_was_update: true, out_session_promoted: false })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r!.wasUpdate).toBe(true);
    expect(r!.participantId).toBe(PARTICIPANT_ID);
  });

  it("W3-RACE-2 · unique_violation leaks to TS layer (defensive · should not happen after FOR UPDATE) · returns null", async () => {
    // Should not reach the TS layer, but if it does, return null so the
    // caller can fall back to the legacy path.
    const admin = makeAdmin({
      data: null,
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).toBeNull();
  });

  // ── Error paths ──────────────────────────────────────────────────────

  it("W3-ROLE-1 · invalid role (not host/guest) · wrapper throws InvalidRoleError (22023)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "invalid_role · must be host or guest (mig-133 CHECK constraint)",
        code: "22023",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(InvalidRoleError);
  });

  it("W3-AUTH-1 · auth.uid() NULL · wrapper throws CallerIdentityRequiredError (42501)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "caller_identity_required · auth.uid() is NULL",
        code: "42501",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(CallerIdentityRequiredError);
  });

  it("W3-AUTH-2 · caller_account_not_found · wrapper throws CallerIdentityRequiredError (42501)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "caller_account_not_found · no nex_account for auth.uid()",
        code: "42501",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(CallerIdentityRequiredError);
  });

  it("W3-SESSION-1 · session_not_found · wrapper throws InvalidSessionError (42501 with session_not_found in message)", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "session_not_found · no nex_group_call_session with id aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        code: "42501",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(InvalidSessionError);
  });

  it("W3-RPC-MISSING-1 · function not yet applied to DB · 42883 code · wrapper throws V5RpcUnavailableError", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "function nex_join_group_call_session_tx(uuid, text) does not exist",
        code: "42883",
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(V5RpcUnavailableError);
  });

  it("W3-RPC-MISSING-2 · function not yet applied to DB · message-match fallback (no code field) · wrapper throws V5RpcUnavailableError", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "function nex_join_group_call_session_tx does not exist",
        // no code field
      },
    });
    await expect(
      joinGroupCallSessionV5Candidate(admin, BASE_INPUT),
    ).rejects.toThrow(V5RpcUnavailableError);
  });

  // ── Parameter contract ───────────────────────────────────────────────

  it("W3-PARAMS-1 · RPC called with exactly 2 named params (p_session_id, p_role) · no accountId passed", async () => {
    const admin = makeAdmin({
      data: [okRow()],
      error: null,
    });
    await joinGroupCallSessionV5Candidate(admin, {
      sessionId: SESSION_ID,
      role: "guest",
    });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("nex_join_group_call_session_tx", {
      p_session_id: SESSION_ID,
      p_role: "guest",
    });
    // Confirm accountId is NOT present in the call
    const callArgs = admin.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("account_id");
    expect(callArgs).not.toHaveProperty("p_account_id");
    expect(callArgs).not.toHaveProperty("accountId");
  });

  it("W3-PARAMS-2 · default role is guest when not provided", async () => {
    const admin = makeAdmin({
      data: [okRow()],
      error: null,
    });
    // No role provided
    await joinGroupCallSessionV5Candidate(admin, { sessionId: SESSION_ID });
    expect(admin.rpc).toHaveBeenCalledWith("nex_join_group_call_session_tx", {
      p_session_id: SESSION_ID,
      p_role: "guest",
    });
  });

  it("W3-NULL-1 · RPC returns empty rowset · returns null (defensive)", async () => {
    const admin = makeAdmin({ data: [], error: null });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).toBeNull();
  });

  it("W3-NULL-2 · RPC returns row with null out_participant_id · returns null (defensive)", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_participant_id: null })],
      error: null,
    });
    const r = await joinGroupCallSessionV5Candidate(admin, BASE_INPUT);
    expect(r).toBeNull();
  });
});
