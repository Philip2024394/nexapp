// src/lib/nex-native/live-broadcast/types.ts
//
// NEX Live Commerce broadcast engine · shared types.
//
// This module is the asymmetric 1-to-many counterpart to the symmetric
// 4-way group-call engine (see src/lib/nex-native/calls/). The group
// call stays untouched: it remains the mesh engine for 1:1 and up-to-4
// peer conversations. The broadcast engine is a NEW surface built on
// the same Supabase Realtime + WebRTC primitives but with:
//
//   · ONE broadcaster (captures camera + mic once)
//   · MANY viewers (receive-only, no camera prompt)
//   · HARD cap at MAX_VIEWERS (pilot = 10 · see broadcast-engine.ts
//     for the bandwidth rationale and the TURN+SFU note needed before
//     this can be raised).
//
// Keep this file free of any browser-only ("use client") code · it is
// a pure type surface so viewer-client, broadcast-engine, broadcast-
// peer, and any future server surface can import it without pulling in
// the Supabase/WebRTC runtime.

/**
 * Lifecycle of the broadcaster side (the business owner going live).
 *
 *   idle              · engine constructed, nothing started yet
 *   requesting-media  · getUserMedia() in flight, awaiting the
 *                       browser permission prompt + stream handshake
 *   live              · camera/mic captured, presence tracked,
 *                       viewers may now attach pairwise peers
 *   ended             · leave() has been called, local stream stopped,
 *                       presence closed, all pairwise peers torn down
 *
 * There is no "failed" terminal state at the engine level · a media
 * acquisition failure routes to onError + transitions straight to
 * "ended" so callers only ever have ONE terminal state to clean up.
 */
export type LiveBroadcastState =
  | "idle"
  | "requesting-media"
  | "live"
  | "ended";

/**
 * Lifecycle of a viewer client (a customer watching the stream).
 *
 *   idle          · client constructed, not joined yet
 *   waiting       · presence channel joined, broadcaster not yet
 *                   present on the roster · deadline before we flip
 *                   to "offline" is 10s (see viewer-client.ts)
 *   connecting    · broadcaster offer received, SDP exchange in flight
 *   live          · ontrack has fired at least once, remote stream
 *                   has been handed to the caller
 *   ended         · broadcaster left the presence channel · the stream
 *                   is over, nothing to recover
 *   at-capacity   · this viewer's presence row has been marked
 *                   rejected: "capacity" by the broadcaster (the pilot
 *                   is capped at MAX_VIEWERS = 10) · the UI should
 *                   show a friendly "At capacity" message
 *   offline       · broadcaster never appeared within the join
 *                   deadline · they may not be live yet, or the
 *                   channel is wrong · UI should prompt a retry
 *
 * The viewer state machine is strictly one-way for the pilot: once a
 * client has reached "ended" / "at-capacity" / "offline", the caller
 * must create a new LiveViewerClient to try again. We do not auto-
 * recover from these in Phase 1 · see the TURN deferral note.
 */
export type LiveViewerState =
  | "idle"
  | "waiting"
  | "connecting"
  | "live"
  | "ended"
  | "at-capacity"
  | "offline";

/**
 * One row on the `nex:live:{sessionId}` presence channel. Both the
 * broadcaster and every viewer track one of these.
 *
 *   accountId     · nex_account.id of the participant · identifies
 *                   the row across presence resyncs
 *   displayName   · human-readable label for the UI
 *   role          · "broadcaster" (exactly one) or "viewer" (0..N)
 *   joinedAt      · Date.now() at track time · used by the engine to
 *                   deterministically pick which viewer wins a cap
 *                   race (lowest joinedAt wins)
 *   rejected      · set to "capacity" by the broadcaster for viewers
 *                   above the MAX_VIEWERS cap · null otherwise. The
 *                   viewer watches this field on its own row and
 *                   flips to "at-capacity" when it is set.
 */
export interface LivePresenceMember {
  accountId: string;
  displayName: string;
  role: "broadcaster" | "viewer";
  joinedAt: number;
  rejected: null | "capacity";
}
