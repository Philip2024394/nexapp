// src/lib/nex-native/calls/__tests__/group-call-decline-lifecycle.test.ts
//
// Lane G-A · 2026-11-19 (§16.33) · decline-lifecycle fix anchor.
//
// Verifies the small, demonstrated runtime fix added this round:
//   · `maybeEndSessionIfAllParticipantsLeft(sessionId)` is EXPORTED
//     from group-call-service.ts (previously private).
//   · It flips nex_group_call_session.state → 'ended' ONLY when every
//     participant row for that session has left_at IS NOT NULL.
//   · It is a no-op when any participant row still has left_at IS NULL.
//
// OFFLINE ONLY · DB fully mocked. These are isolated-mock assertions ·
// they are a specification for the server behavior, NOT proof of the
// database's actual rollback / concurrency semantics.
//
// Real sandbox acceptance checks (listed in ledger §16.33) still need
// to run after the DB/auth pause lifts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

interface SessionUpdateCall {
  readonly sessionId: string;
  readonly patch: Record<string, unknown>;
  readonly stateFilter: readonly string[];
}

interface MockState {
  activeParticipantCount: number;
  participantSelectError: unknown | null;
  sessionUpdateCalls: SessionUpdateCall[];
}

const MOCKS = vi.hoisted((): { state: MockState } => ({
  state: {
    activeParticipantCount: 0,
    participantSelectError: null,
    sessionUpdateCalls: [],
  },
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (table: string) => {
      if (table === "nex_group_call_participant") {
        return {
          select: () => ({
            eq: () => ({
              is: () =>
                Promise.resolve({
                  data: MOCKS.state.participantSelectError
                    ? null
                    : Array.from(
                        { length: MOCKS.state.activeParticipantCount },
                        (_, i) => ({ id: `p-${i}` }),
                      ),
                  error: MOCKS.state.participantSelectError,
                }),
            }),
          }),
        };
      }
      if (table === "nex_group_call_session") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, sessionId: string) => ({
              in: (_col2: string, stateFilter: readonly string[]) => {
                MOCKS.state.sessionUpdateCalls.push({
                  sessionId,
                  patch,
                  stateFilter,
                });
                return Promise.resolve({ data: null, error: null });
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

const { maybeEndSessionIfAllParticipantsLeft } = await import(
  "../group-call-service"
);

describe("Lane G-A · maybeEndSessionIfAllParticipantsLeft · decline-lifecycle fix (§16.33)", () => {
  beforeEach(() => {
    MOCKS.state.activeParticipantCount = 0;
    MOCKS.state.participantSelectError = null;
    MOCKS.state.sessionUpdateCalls = [];
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GA-END-1 · ends session when 0 participants have left_at IS NULL (1:1 decline · host not a participant row)", async () => {
    MOCKS.state.activeParticipantCount = 0;
    await maybeEndSessionIfAllParticipantsLeft(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(MOCKS.state.sessionUpdateCalls).toHaveLength(1);
    expect(MOCKS.state.sessionUpdateCalls[0]!.sessionId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(MOCKS.state.sessionUpdateCalls[0]!.patch).toMatchObject({
      state: "ended",
    });
    expect(
      typeof MOCKS.state.sessionUpdateCalls[0]!.patch.ended_at,
    ).toBe("string");
    expect(MOCKS.state.sessionUpdateCalls[0]!.stateFilter).toEqual([
      "ringing",
      "live",
    ]);
  });

  it("GA-END-2 · multi-participant NO-OP · 1 remaining active participant leaves session alone", async () => {
    MOCKS.state.activeParticipantCount = 1;
    await maybeEndSessionIfAllParticipantsLeft(
      "22222222-2222-2222-2222-222222222222",
    );
    expect(MOCKS.state.sessionUpdateCalls).toHaveLength(0);
  });

  it("GA-END-3 · multi-participant NO-OP · 3 remaining active participants leaves session alone", async () => {
    MOCKS.state.activeParticipantCount = 3;
    await maybeEndSessionIfAllParticipantsLeft(
      "33333333-3333-3333-3333-333333333333",
    );
    expect(MOCKS.state.sessionUpdateCalls).toHaveLength(0);
  });

  it("GA-END-4 · idempotent · second call with 0 active participants fires the UPDATE again but the state filter ('ringing'|'live') means a second apply against an already-ended session is a no-op at DB level", async () => {
    MOCKS.state.activeParticipantCount = 0;
    await maybeEndSessionIfAllParticipantsLeft(
      "44444444-4444-4444-4444-444444444444",
    );
    await maybeEndSessionIfAllParticipantsLeft(
      "44444444-4444-4444-4444-444444444444",
    );
    expect(MOCKS.state.sessionUpdateCalls).toHaveLength(2);
    // Both carry the same state filter · at DB level the 2nd UPDATE
    // affects 0 rows because state is already 'ended'.
    for (const call of MOCKS.state.sessionUpdateCalls) {
      expect(call.stateFilter).toEqual(["ringing", "live"]);
    }
  });

  it("GA-END-5 · participant SELECT error · fail-soft · NO session UPDATE issued", async () => {
    MOCKS.state.participantSelectError = { message: "transient db error" };
    await maybeEndSessionIfAllParticipantsLeft(
      "55555555-5555-5555-5555-555555555555",
    );
    expect(MOCKS.state.sessionUpdateCalls).toHaveLength(0);
  });
});
