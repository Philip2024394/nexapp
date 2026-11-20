// src/lib/nex-native/calls/__tests__/group-call-service-v5-candidate.test.ts
//
// W2 candidate · mocked RPC round-trips · 2026-11-19
// ============================================================================
// Lane: Package G · W2 · session-creation RPC candidate
//
// What these tests prove
// ----------------------
// · The TypeScript wrapper's error-code mapping is correct for each
//   SQLSTATE / message class the RPC can produce.
// · The wrapper correctly maps the RPC's out_participants JSONB array
//   to GroupCallParticipantRow objects.
// · The wrapper correctly computes rejectedCount when the caller supplies
//   more than 3 invitees.
// · The RPC is called with exactly the 4 declared parameters and no extras.
//
// What these tests do NOT prove
// ------------------------------
// · DB transactional rollback semantics (no live DB in this suite).
// · That the function exists in any target DB.
// · Concurrency / isolation guarantees.
// · The mig-133 trigger's actual behaviour.
// Real integration tests must run in sandbox against the deployed function
// and observe post-failure DB state.
// ============================================================================

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createGroupCallSessionV5Candidate,
  V5RpcUnavailableError,
  V5CallerIdentityRequiredError,
  V5ParticipantCapExceededError,
} from "../group-call-service.v5-candidate";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const HOST_ID    = "11111111-1111-1111-1111-111111111111";
const GUEST_1    = "22222222-2222-2222-2222-222222222222";
const GUEST_2    = "33333333-3333-3333-3333-333333333333";
const GUEST_3    = "44444444-4444-4444-4444-444444444444";
const GUEST_4    = "55555555-5555-5555-5555-555555555555";
const GUEST_5    = "66666666-6666-6666-6666-666666666666";

function makeParticipantJson(
  id: string,
  accountId: string,
  role: "host" | "guest",
  joinedAt: string | null = null,
) {
  return {
    id,
    session_id:  SESSION_ID,
    account_id:  accountId,
    role,
    invited_at:  "2026-11-19T10:00:00.000Z",
    joined_at:   joinedAt,
  };
}

function makeOkRow(participants: ReturnType<typeof makeParticipantJson>[], rejectedCount = 0) {
  return {
    out_session_id:     SESSION_ID,
    out_participants:   participants,
    out_rejected_count: rejectedCount,
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
  hostAccountId:    HOST_ID,
  mediaType:        "video" as const,
  hostCountry:      "ireland",
  fromCallLinkId:   null,
};

// ── Test suites ───────────────────────────────────────────────────────────────

describe("W2 · createGroupCallSessionV5Candidate · error-mapping specification", () => {

  // ── Happy path ────────────────────────────────────────────────────────────

  it("W2-OK-1 · 3 invitees all insert · returns session + 4 participants + rejectedCount=0", async () => {
    const participants = [
      makeParticipantJson("p0", HOST_ID,  "host", "2026-11-19T10:00:00.000Z"),
      makeParticipantJson("p1", GUEST_1, "guest"),
      makeParticipantJson("p2", GUEST_2, "guest"),
      makeParticipantJson("p3", GUEST_3, "guest"),
    ];
    const admin = makeAdmin({ data: [makeOkRow(participants, 0)], error: null });

    const result = await createGroupCallSessionV5Candidate(admin, {
      ...BASE_INPUT,
      inviteeAccountIds: [GUEST_1, GUEST_2, GUEST_3],
    });

    expect(result.session.id).toBe(SESSION_ID);
    expect(result.session.media_type).toBe("video");
    expect(result.session.state).toBe("ringing");
    expect(result.participants).toHaveLength(4);
    expect(result.participants[0].role).toBe("host");
    expect(result.participants[1].role).toBe("guest");
    expect(result.participants[2].role).toBe("guest");
    expect(result.participants[3].role).toBe("guest");
    expect(result.rejectedCount).toBe(0);
  });

  // ── Oversized invitee list ────────────────────────────────────────────────

  it("W2-CAP-1 · 5 invitees provided · TS slices to 3 · RPC gets 3 · returns host+3 participants + rejectedCount=2", async () => {
    // TS wrapper slices to first 3 before calling RPC; RPC also returns 3 guests.
    const participants = [
      makeParticipantJson("p0", HOST_ID,  "host", "2026-11-19T10:00:00.000Z"),
      makeParticipantJson("p1", GUEST_1, "guest"),
      makeParticipantJson("p2", GUEST_2, "guest"),
      makeParticipantJson("p3", GUEST_3, "guest"),
    ];
    // RPC receives sliced array (3 invitees) so its out_rejected_count = 0.
    // TS-side rejected count = 5 - 3 = 2 and that becomes the final value.
    const admin = makeAdmin({ data: [makeOkRow(participants, 0)], error: null });

    const result = await createGroupCallSessionV5Candidate(admin, {
      ...BASE_INPUT,
      inviteeAccountIds: [GUEST_1, GUEST_2, GUEST_3, GUEST_4, GUEST_5],
    });

    expect(result.participants).toHaveLength(4); // host + 3 guests
    expect(result.rejectedCount).toBe(2);

    // Verify RPC was called with only 3 invitees (TS slice applied)
    const callArgs = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect((callArgs.p_invitee_account_ids as string[]).length).toBe(3);
  });

  // ── Media type validation ─────────────────────────────────────────────────

  it("W2-MEDIA-1 · RPC raises 22023 invalid_media_type · wrapper throws Error with code 22023", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "invalid_media_type · must be audio or video, got: radio", code: "22023" },
    });

    await expect(
      createGroupCallSessionV5Candidate(admin, {
        ...BASE_INPUT,
        mediaType: "audio", // any media type; error comes from mock
      }),
    ).rejects.toThrow(/invalid media type/i);
  });

  // ── Auth identity required ────────────────────────────────────────────────

  it("W2-AUTH-1 · RPC raises 42501 caller_identity_required · wrapper throws V5CallerIdentityRequiredError", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_identity_required · auth.uid() is NULL", code: "42501" },
    });

    const err = await createGroupCallSessionV5Candidate(admin, BASE_INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(V5CallerIdentityRequiredError);
    expect(err.code).toBe("caller_identity_required");
  });

  it("W2-AUTH-2 · RPC raises 42501 caller_account_not_found · wrapper throws V5CallerIdentityRequiredError", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_account_not_found · no nex_account for auth.uid()", code: "42501" },
    });

    const err = await createGroupCallSessionV5Candidate(admin, BASE_INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(V5CallerIdentityRequiredError);
    expect(err.code).toBe("caller_identity_required");
  });

  // ── Unique violation on one guest row ─────────────────────────────────────

  it("W2-DUP-1 · unique_violation on one invitee · that row skipped · others succeed · returns 3 participants", async () => {
    // The RPC handles unique_violation per-row internally (EXCEPTION WHEN unique_violation THEN NULL).
    // The RPC returns only the rows that actually inserted — here 2 guests instead of 3.
    const participants = [
      makeParticipantJson("p0", HOST_ID,  "host", "2026-11-19T10:00:00.000Z"),
      makeParticipantJson("p1", GUEST_1, "guest"),
      makeParticipantJson("p3", GUEST_3, "guest"),
      // GUEST_2 was skipped due to unique_violation
    ];
    const admin = makeAdmin({ data: [makeOkRow(participants, 0)], error: null });

    const result = await createGroupCallSessionV5Candidate(admin, {
      ...BASE_INPUT,
      inviteeAccountIds: [GUEST_1, GUEST_2, GUEST_3],
    });

    expect(result.participants).toHaveLength(3); // host + 2 inserted guests
    expect(result.participants.map((p) => p.account_id)).not.toContain(GUEST_2);
    expect(result.rejectedCount).toBe(0);
  });

  // ── RPC unavailable (function not applied) ────────────────────────────────

  it("W2-RPC-MISSING-1 · 42883 error code · wrapper throws V5RpcUnavailableError", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "function nex_create_group_call_session_tx(text, uuid, text, uuid[]) does not exist",
        code: "42883",
      },
    });

    const err = await createGroupCallSessionV5Candidate(admin, BASE_INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(V5RpcUnavailableError);
    expect(err.code).toBe("rpc_unavailable");
  });

  it("W2-RPC-MISSING-2 · message contains 'does not exist' (no code) · wrapper throws V5RpcUnavailableError", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: "function nex_create_group_call_session_tx does not exist",
      },
    });

    const err = await createGroupCallSessionV5Candidate(admin, BASE_INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(V5RpcUnavailableError);
    expect(err.code).toBe("rpc_unavailable");
  });

  // ── Participant cap trigger ───────────────────────────────────────────────

  it("W2-4CAP-1 · P0001 trigger message · wrapper throws V5ParticipantCapExceededError", async () => {
    const admin = makeAdmin({
      data: null,
      error: {
        message: `nex_group_call_participant: session ${SESSION_ID} already has 4 participants`,
        code: "P0001",
      },
    });

    const err = await createGroupCallSessionV5Candidate(admin, BASE_INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(V5ParticipantCapExceededError);
    expect(err.code).toBe("participant_cap_exceeded");
  });

  // ── Exact RPC parameter contract ─────────────────────────────────────────

  it("W2-PASSTHROUGH-1 · RPC is called with exactly the 4 declared params · no extra fields", async () => {
    const participants = [
      makeParticipantJson("p0", HOST_ID, "host", "2026-11-19T10:00:00.000Z"),
    ];
    const admin = makeAdmin({ data: [makeOkRow(participants, 0)], error: null });

    await createGroupCallSessionV5Candidate(admin, {
      hostAccountId:    HOST_ID,
      mediaType:        "audio",
      hostCountry:      "indonesia",
      fromCallLinkId:   "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      inviteeAccountIds: [GUEST_1, GUEST_2],
    });

    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith(
      "nex_create_group_call_session_tx",
      {
        p_media_type:          "audio",
        p_from_call_link_id:   "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        p_host_country:        "indonesia",
        p_invitee_account_ids: [GUEST_1, GUEST_2],
      },
    );

    // Verify exactly 4 keys — no smuggled fields
    const callArgs = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(callArgs).sort()).toEqual([
      "p_from_call_link_id",
      "p_host_country",
      "p_invitee_account_ids",
      "p_media_type",
    ]);
  });

  it("W2-PASSTHROUGH-2 · hostAccountId is NOT forwarded to RPC params", async () => {
    const participants = [
      makeParticipantJson("p0", HOST_ID, "host", "2026-11-19T10:00:00.000Z"),
    ];
    const admin = makeAdmin({ data: [makeOkRow(participants, 0)], error: null });

    await createGroupCallSessionV5Candidate(admin, BASE_INPUT);

    const callArgs = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("p_host_account_id");
    expect(callArgs).not.toHaveProperty("hostAccountId");
  });

});
