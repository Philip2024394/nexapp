"use server";

// src/app/nex-native/calls/_log-call-action.ts
//
// L-044 fix · 2026-11-26. This Server Action was referenced by the
// peer-chat call launcher (`src/app/nex-native/chat/peer/[accountId]/
// _call-launcher.tsx`) at an import path that had no module. The
// launcher was shipping a tsc TS2307 as a pre-existing pillar defect
// — "Cannot find module '@/app/nex-native/calls/_log-call-action'".
//
// The service layer (`src/lib/nex-native/call-log-service.ts`) already
// exposes `logCallEvent(input: LogCallInput)` which inserts one row
// into `nex_call_log`. That service requires `accountId` (the viewer
// whose history the row belongs to) and is `server-only`. The launcher
// is a `"use client"` component and must NOT learn the viewer's
// account id client-side beyond what it already knows — so this
// Server Action is the bridge: it resolves the viewer from the sealed
// session helper, drops that in as `accountId`, and forwards the rest
// of the payload.
//
// Convention mirrors `/nex-native/directory/_log-discovery-signal-
// action.ts`:
//   · Guest session → silent no-op (we do not record pre-signup calls).
//   · Underlying service error → swallowed (soft-fail · UI unaffected).
//   · Return type `void` · never leaks the row id to the client.

import {
  logCallEvent,
  type CallLogDirection,
  type CallLogMediaType,
  type CallLogOutcome,
} from "@/lib/nex-native/call-log-service";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export interface LogCallActionInput {
  readonly peerAccountId: string;
  readonly conversationId: string | null;
  readonly direction: CallLogDirection;
  readonly mediaType: CallLogMediaType;
  readonly outcome: CallLogOutcome;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationSeconds: number | null;
}

/** Record one call-log row for the signed-in viewer. Fire-and-forget
 *  from the client's perspective: guest sessions silently drop the
 *  signal, and underlying service errors are swallowed so a logging
 *  blip never interferes with the call UI. */
export async function logCallAction(input: LogCallActionInput): Promise<void> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (!session) {
    // No viewer → nothing to attribute the row to. Signed-out users
    // cannot place or receive calls in NEX today; this branch exists
    // so a stray client-side call does not throw.
    return;
  }

  try {
    await logCallEvent({
      accountId: session.account.id,
      peerAccountId: input.peerAccountId,
      conversationId: input.conversationId,
      direction: input.direction,
      mediaType: input.mediaType,
      outcome: input.outcome,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationSeconds: input.durationSeconds,
    });
  } catch {
    // Swallow · the launcher already treats this as fire-and-forget.
    // Migration 131 provides the table and RLS; a transient insert
    // failure must not escape into the active-call UI.
  }
}
