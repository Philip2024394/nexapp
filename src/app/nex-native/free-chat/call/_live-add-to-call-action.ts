"use server";

// src/app/nex-native/free-chat/call/_live-add-to-call-action.ts
//
// Dev-impersonation-aware wrapper around the sealed group-call service.
// Owner-authorised 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// The sealed inviteToGroupCallAction at
// src/app/nex-native/chat/peer/[accountId]/_add-to-call-action.ts uses
// resolveNexAppSessionFromContext() only · it does NOT honour the dev
// NEX_DEV_IMPERSONATE_HANDLE flag. Owner testing the Ireland caller
// surface through dev-impersonation therefore saw the sealed action
// return `{ok: false, reason: "unauthenticated"}`.
//
// This file introduces a PARALLEL server action that:
//   · resolves the session via resolveSessionWithDevOverride (dev wins)
//   · falls back to resolveNexAppSessionFromContext for real signed-in users
//   · delegates to the sealed createGroupCallSession service directly
//   · sends the two chat invites via sendPeerMessage (same shape)
//   · returns the SAME result shape as the sealed action
//
// The sealed action remains untouched · all existing callers (peer-chat
// Add-to-call modal) continue to use it. Only this Ireland surface
// routes through the dev-aware wrapper.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { createGroupCallSession } from "@/lib/nex-native/calls/group-call-service";
import { getOrCreatePeerConversation } from "@/lib/nex-native/peer-conversation-service";
import { sendPeerMessage } from "@/lib/nex-native/peer-message-service";
import { getAccountById } from "@/lib/nex-native/account-service";

export interface LiveInviteToGroupCallArgs {
  readonly currentPeerAccountId: string;
  readonly inviteeAccountId: string;
  readonly mediaType: "audio" | "video";
}

export interface LiveInviteToGroupCallResult {
  readonly ok: true;
  readonly sessionId: string;
  readonly joinUrl: string;
  readonly inviteeDisplayName: string;
}

export async function liveInviteToGroupCallAction(
  args: LiveInviteToGroupCallArgs,
): Promise<LiveInviteToGroupCallResult | { ok: false; reason: string }> {
  try {
    // Dev-impersonation wins · falls back to the regular resolver so
    // real signed-in users also work.
    const devSession = await resolveSessionWithDevOverride();
    const session = devSession ?? (await resolveNexAppSessionFromContext());
    if (!session) return { ok: false, reason: "unauthenticated" };

    if (
      args.inviteeAccountId === session.account.id ||
      args.inviteeAccountId === args.currentPeerAccountId
    ) {
      return { ok: false, reason: "pick a different contact" };
    }

    const [self, currentPeer, invitee] = await Promise.all([
      getAccountById(session.account.id).catch(() => null),
      getAccountById(args.currentPeerAccountId).catch(() => null),
      getAccountById(args.inviteeAccountId).catch(() => null),
    ]);
    if (!invitee) return { ok: false, reason: "contact not found" };

    const { session: groupSession } = await createGroupCallSession({
      hostAccountId: session.account.id,
      mediaType: args.mediaType,
      inviteeAccountIds: [args.currentPeerAccountId, args.inviteeAccountId],
    });

    // Compose the join URL. In production this will be the public
    // origin · in dev we just emit the path (callee's client resolves
    // the origin on tap).
    const joinUrl = `/nex-native/call/g/${groupSession.id}`;
    const inviterName = self?.display_name ?? "A NEX friend";
    const mediaLabel = args.mediaType === "video" ? "video" : "voice";

    // Send chat invites. Soft-fail on message errors · the session
    // exists either way and both parties can still join by URL.
    await Promise.all([
      (async () => {
        try {
          const conv = await getOrCreatePeerConversation(
            session.account.id,
            args.currentPeerAccountId,
          );
          await sendPeerMessage({
            conversation_id: conv.id,
            sender_account_id: session.account.id,
            body: `${inviterName} started a group ${mediaLabel} call · tap to join: ${joinUrl}`,
          });
        } catch { /* soft-fail */ }
      })(),
      (async () => {
        try {
          const conv = await getOrCreatePeerConversation(
            session.account.id,
            args.inviteeAccountId,
          );
          await sendPeerMessage({
            conversation_id: conv.id,
            sender_account_id: session.account.id,
            body: `${inviterName} is calling · tap to join the group ${mediaLabel} call: ${joinUrl}`,
          });
        } catch { /* soft-fail */ }
      })(),
    ]);

    return {
      ok: true,
      sessionId: groupSession.id,
      joinUrl,
      inviteeDisplayName: invitee.display_name ?? "NEX friend",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}
