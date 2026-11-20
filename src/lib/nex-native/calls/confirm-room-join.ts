// src/lib/nex-native/calls/confirm-room-join.ts
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 2 · 2026-11-20
//
// Sole trusted writer of nex_group_call_participant.joined_at.
//
// Why a separate module?
// ----------------------
// Across the codebase, "joined_at" historically was written in two
// unrelated places that are NOT trustworthy signals of "in the room":
//
//   · group-call-service.createGroupCallSession (W2) — wrote joined_at
//     for the host at session creation time, before any WebRTC
//     negotiation existed. Removed in Lane 2.
//   · preview/page.tsx::acceptInviteOnLoad — wrote joined_at when the
//     URL-triggered Accept landed, before the engine ever mounted.
//     Removed in Lane 2.
//
// This module is the replacement: the ONLY path that writes joined_at.
// It is callable only after the group-peer `RTCPeerConnection.
// connectionState === "connected"` transition (see group-peer.ts:224-236).
// Preview load / accept / engine mount / enable() explicitly do NOT
// count as "connected" (owner directive 2026-11-20).
//
// Trust boundary
// --------------
// The client calls this with `{ sessionId }`. Caller identity comes
// from the authenticated server session on the request · the client
// never supplies an account id. The shared roster-authorization guard
// ensures the caller is a legitimate member (host or active participant)
// before any write · a signed-in user swapping in another session UUID
// is denied.
//
// A client could still be malicious and call this without a real
// RTCPeerConnection transition. That case is accepted · the honest
// improvement vs the prior behaviour is removing the two fake writes
// from paths that NEVER corresponded to a connection event. A
// `connected` event at least requires the client to have successfully
// completed ICE with another participant.
//
// Testability
// -----------
// The core function is pure w.r.t. injected dependencies: a resolved
// caller account id, a session id, and an admin handle. The thin
// server-only wrapper lives in the Route Handler.

import type { RosterAdminLike } from "./roster-authorization";
import { assertCanViewSession } from "./roster-authorization";

export type ConfirmRoomJoinResult =
  | { ok: true; updatedRowCount: number }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "session_not_found"
        | "not_member"
        | "error";
    };

// Minimal admin-client surface for the UPDATE. Separate from
// RosterAdminLike so tests can provide a focused stub.
export interface ConfirmRoomJoinAdminLike extends RosterAdminLike {
  from(table: string): {
    // Re-declared from RosterAdminLike so the UPDATE path is also typed.
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
        eq(col: string, val: string): {
          is(col: string, val: null): {
            maybeSingle(): Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    update(patch: Record<string, unknown>): {
      eq(col: string, val: string): {
        eq(col: string, val: string): {
          is(col: string, val: null): {
            select(cols: string): Promise<{
              data: Array<Record<string, unknown>> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
}

export interface ConfirmRoomJoinInput {
  callerAccountId: string | null;
  sessionId: string;
  admin: ConfirmRoomJoinAdminLike;
  /** Injectable clock for deterministic testing. */
  now?: () => Date;
}

export async function confirmRoomJoin(
  input: ConfirmRoomJoinInput,
): Promise<ConfirmRoomJoinResult> {
  const gate = await assertCanViewSession({
    callerAccountId: input.callerAccountId,
    sessionId: input.sessionId,
    admin: input.admin,
  });
  if (!gate.ok) {
    return { ok: false, reason: gate.reason };
  }

  const nowIso = (input.now ? input.now() : new Date()).toISOString();

  try {
    const res = await input.admin
      .from("nex_group_call_participant")
      .update({ joined_at: nowIso })
      .eq("session_id", input.sessionId)
      .eq("account_id", input.callerAccountId as string)
      .is("left_at", null)
      .select("id");
    if (res.error) {
      return { ok: false, reason: "error" };
    }
    return { ok: true, updatedRowCount: res.data?.length ?? 0 };
  } catch {
    return { ok: false, reason: "error" };
  }
}
