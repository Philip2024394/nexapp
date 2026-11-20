// src/lib/nex-native/calls/__tests__/roster-authorization.test.ts
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 1 · 2026-11-20
//
// Unit tests for the shared roster-authorization guard. No live DB —
// the admin handle is a focused stub that mirrors the fluent shape the
// guard actually uses. These tests verify the DECISION, not the Supabase
// client wire format.
//
// Coverage per owner directive 2026-11-20:
//   · creator sees roster before joining (host branch)
//   · invitee allowed (active participant branch)
//   · unrelated signed-in caller denied
//   · session-swap denied (member of session X cannot read session Y)
//   · missing session denied
//   · null callerAccountId (unauthenticated) denied

import { describe, expect, it } from "vitest";
import {
  assertCanViewSession,
  type RosterAdminLike,
} from "../roster-authorization";

const SESSION_X = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_Y = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const HOST_A = "11111111-1111-1111-1111-111111111111";
const INVITEE_B = "22222222-2222-2222-2222-222222222222";
const UNRELATED_C = "33333333-3333-3333-3333-333333333333";

// ── Stub builder · faithful to the chained shape in roster-authorization.ts
interface Scenario {
  /** session_id → host_account_id, or null if session missing. */
  sessions: Record<string, string | null>;
  /** session_id → set of active (non-left) participant account_ids. */
  participants: Record<string, string[]>;
  /** Force a DB error on a given table. */
  errorOn?: "nex_group_call_session" | "nex_group_call_participant";
}

function makeAdmin(sc: Scenario): RosterAdminLike {
  return {
    from(table: string) {
      if (sc.errorOn === table) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: "forced" },
              }),
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: "forced" },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "nex_group_call_session") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => {
                const host = sc.sessions[val];
                if (host === undefined || host === null) {
                  return { data: null, error: null };
                }
                return {
                  data: { host_account_id: host },
                  error: null,
                };
              },
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "nex_group_call_participant") {
        return {
          select: (_cols: string) => ({
            eq: (_c1: string, sessVal: string) => ({
              maybeSingle: async () => ({ data: null, error: null }),
              eq: (_c2: string, accountVal: string) => ({
                is: (_c3: string, _null: null) => ({
                  maybeSingle: async () => {
                    const members = sc.participants[sessVal] ?? [];
                    if (members.includes(accountVal)) {
                      return {
                        data: { id: "part-row-id" },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

describe("assertCanViewSession", () => {
  it("allows the session host even with no participant row (W1 case)", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [] }, // no participant rows at all
    });
    const res = await assertCanViewSession({
      callerAccountId: HOST_A,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(true);
  });

  it("allows an active (non-left) participant (invitee branch)", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await assertCanViewSession({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(true);
  });

  it("denies a signed-in user unrelated to the session", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await assertCanViewSession({
      callerAccountId: UNRELATED_C,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_member");
  });

  it("denies a session-swap: member of X cannot read Y", async () => {
    const admin = makeAdmin({
      sessions: {
        [SESSION_X]: HOST_A,
        [SESSION_Y]: UNRELATED_C,
      },
      participants: {
        [SESSION_X]: [INVITEE_B],
        [SESSION_Y]: [UNRELATED_C],
      },
    });
    // B is a member of X; they try to read Y's roster by swapping ids.
    const res = await assertCanViewSession({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_Y,
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_member");
  });

  it("denies when the session does not exist", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: {},
    });
    const res = await assertCanViewSession({
      callerAccountId: HOST_A,
      sessionId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("session_not_found");
  });

  it("denies when callerAccountId is null (unauthenticated)", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await assertCanViewSession({
      callerAccountId: null,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("unauthenticated");
  });

  it("surfaces DB error from the session lookup as reason='error'", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
      errorOn: "nex_group_call_session",
    });
    const res = await assertCanViewSession({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("error");
  });

  it("surfaces DB error from the participant lookup as reason='error'", async () => {
    const admin = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
      errorOn: "nex_group_call_participant",
    });
    const res = await assertCanViewSession({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_X,
      admin,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("error");
  });
});
