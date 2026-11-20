// src/lib/nex-native/calls/__tests__/confirm-room-join.test.ts
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 2 · 2026-11-20
//
// Unit tests for the confirmRoomJoin core module. Exercises the gate +
// the UPDATE path with injected stubs. No live DB.

import { describe, expect, it } from "vitest";
import {
  confirmRoomJoin,
  type ConfirmRoomJoinAdminLike,
} from "../confirm-room-join";

const SESSION_X = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const HOST_A = "11111111-1111-1111-1111-111111111111";
const INVITEE_B = "22222222-2222-2222-2222-222222222222";
const UNRELATED_C = "33333333-3333-3333-3333-333333333333";

interface Scenario {
  sessions: Record<string, string | null>;
  participants: Record<string, string[]>;
  /** Participants whose row has left_at set — UPDATE won't match. */
  leftParticipants?: Record<string, string[]>;
  /** Force an UPDATE error. */
  updateError?: boolean;
}

function makeAdmin(sc: Scenario): {
  admin: ConfirmRoomJoinAdminLike;
  updateCalls: Array<{ patch: Record<string, unknown>; sessionId: string; accountId: string }>;
} {
  const updateCalls: Array<{
    patch: Record<string, unknown>;
    sessionId: string;
    accountId: string;
  }> = [];

  const admin: ConfirmRoomJoinAdminLike = {
    from(table: string) {
      // Guard path (select)
      if (table === "nex_group_call_session") {
        return {
          select: (_c: string) => ({
            eq: (_c1: string, val: string) => ({
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
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          update: (_p: Record<string, unknown>) => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  select: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "nex_group_call_participant") {
        return {
          select: (_c: string) => ({
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
          update: (patch: Record<string, unknown>) => ({
            eq: (_c1: string, sessVal: string) => ({
              eq: (_c2: string, accountVal: string) => ({
                is: (_c3: string, _null: null) => ({
                  select: async (_cols: string) => {
                    updateCalls.push({
                      patch,
                      sessionId: sessVal,
                      accountId: accountVal,
                    });
                    if (sc.updateError) {
                      return { data: null, error: { message: "boom" } };
                    }
                    const leftMembers = sc.leftParticipants?.[sessVal] ?? [];
                    if (leftMembers.includes(accountVal)) {
                      return { data: [], error: null };
                    }
                    const members = sc.participants[sessVal] ?? [];
                    if (members.includes(accountVal)) {
                      return {
                        data: [{ id: "part-row-id" }],
                        error: null,
                      };
                    }
                    return { data: [], error: null };
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

  return { admin, updateCalls };
}

const FIXED_NOW = () => new Date("2026-11-20T12:00:00.000Z");

describe("confirmRoomJoin", () => {
  it("writes joined_at when the caller is an active participant", async () => {
    const { admin, updateCalls } = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await confirmRoomJoin({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.updatedRowCount).toBe(1);
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0]!.patch).toEqual({
      joined_at: "2026-11-20T12:00:00.000Z",
    });
    expect(updateCalls[0]!.sessionId).toBe(SESSION_X);
    expect(updateCalls[0]!.accountId).toBe(INVITEE_B);
  });

  it("writes joined_at for the host even without a participant row", async () => {
    // W1 case: host has no participant row (RPC path). The guard's
    // host-branch allows the write; the UPDATE will match 0 rows
    // because there's nothing to update — honest zero.
    const { admin } = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [] },
    });
    const res = await confirmRoomJoin({
      callerAccountId: HOST_A,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.updatedRowCount).toBe(0);
  });

  it("denies unauthenticated callers (null callerAccountId)", async () => {
    const { admin, updateCalls } = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await confirmRoomJoin({
      callerAccountId: null,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("unauthenticated");
    expect(updateCalls.length).toBe(0);
  });

  it("denies a signed-in caller who is not a member", async () => {
    const { admin, updateCalls } = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
    });
    const res = await confirmRoomJoin({
      callerAccountId: UNRELATED_C,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_member");
    expect(updateCalls.length).toBe(0);
  });

  it("denies when the session does not exist", async () => {
    const { admin } = makeAdmin({
      sessions: {},
      participants: {},
    });
    const res = await confirmRoomJoin({
      callerAccountId: HOST_A,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("session_not_found");
  });

  it("surfaces UPDATE errors as reason='error'", async () => {
    const { admin } = makeAdmin({
      sessions: { [SESSION_X]: HOST_A },
      participants: { [SESSION_X]: [INVITEE_B] },
      updateError: true,
    });
    const res = await confirmRoomJoin({
      callerAccountId: INVITEE_B,
      sessionId: SESSION_X,
      admin,
      now: FIXED_NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("error");
  });
});
