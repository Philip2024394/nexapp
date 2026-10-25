// src/lib/nex-native/live-broadcast/jail-channel.ts
//
// NEX Live · Jail propagation channel (owner-authorised 2026-10-25).
//
// Scope · a thin wrapper around a dedicated Supabase Realtime BROADCAST
// channel named `nex:live-jail:{sessionId}`. The broadcaster uses this
// channel to publish a 10-minute mute targeted at a SPECIFIC viewer
// account. Every viewer subscribes; only the targeted viewer renders
// the full-screen jail overlay + disables their composer. Other viewers
// ignore the event entirely.
//
// Why a separate channel (not reusing comments / presence):
//   · Jail is a broadcaster-authored moderation signal. Keeping it off
//     the comments channel means it never pollutes the ephemeral
//     comment stream and never races the sealed "no per-event
//     timestamp to broadcaster" rule on comments.
//   · Jail must reach a targeted viewer within <500ms. A dedicated
//     Realtime broadcast is the right primitive · no DB round-trip.
//
// Honest-copy / doctrine:
//   · The payload carries a monotonic `startedAtMs` (server clock on
//     the broadcaster's device) and a `durationMs`. The viewer MUST
//     derive remaining time locally from these two values and MUST
//     NOT invent its own freshness. Server authority rule, same
//     spirit as the NEX Live Plan v4 AC-5 TTL anchor.
//   · There is NO DB write in Phase 1. Jail state is in-flight only.
//     A reload or network drop releases the jail · acceptable for the
//     v1 moderation posture ("timeout for 10 minutes to let the room
//     calm down"), not acceptable for a permanent ban (which is a
//     future, separately-authorised feature).
//   · The broadcaster can issue multiple jails to different viewers
//     in the same session. Each has its own targeted accountId.
//   · The jail is BROADCAST (fan-out to everyone), filtered client-
//     side to the targeted accountId. This is intentional: non-
//     targeted viewers see nothing but the broadcaster has an
//     authoritative record in presence that they can audit later.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";

/** Default jail duration · 10 minutes per owner spec 2026-10-25. */
export const NEX_JAIL_DEFAULT_DURATION_MS = 10 * 60 * 1000;

/** Minimum jail duration · guards against zero/negative payloads. */
export const NEX_JAIL_MIN_DURATION_MS = 1 * 60 * 1000;

/** Maximum jail duration · one session (upper safety bound). */
export const NEX_JAIL_MAX_DURATION_MS = 60 * 60 * 1000;

export type JailChannelRole = "broadcaster" | "viewer";

export interface JailEventPayload {
  /** The viewer account being jailed. Only that viewer renders the
   *  full-screen overlay · everyone else ignores. */
  readonly targetAccountId: string;
  /** Broadcaster-wall-clock moment the jail started (ms epoch). The
   *  viewer uses this + durationMs to compute remaining time. */
  readonly startedAtMs: number;
  /** How long the jail lasts (ms). Default 10 minutes. */
  readonly durationMs: number;
  /** The session this jail belongs to · guards against cross-session
   *  signal leakage if a client holds a stale subscription. */
  readonly sessionId: string;
}

export interface OpenJailChannelOptions {
  readonly sessionId: string;
  readonly role: JailChannelRole;
  /** Fires when any jail event arrives on the channel. Receivers
   *  decide whether it targets THEM (compare to selfAccountId). */
  readonly onJail?: (event: JailEventPayload) => void;
  /** Fires when the broadcaster explicitly releases a jail early
   *  (future · currently never fires in v1 release-at-timeout flow). */
  readonly onRelease?: (targetAccountId: string) => void;
}

export interface JailChannelHandle {
  /** Broadcaster · issue a new jail. Viewer · no-op.
   *  `durationMs` defaults to NEX_JAIL_DEFAULT_DURATION_MS. */
  jail(
    targetAccountId: string,
    opts?: { readonly durationMs?: number },
  ): Promise<void>;
  /** Broadcaster · release an active jail early. Viewer · no-op.
   *  Reserved for future broadcaster "unjail" button; v1 wires the
   *  primitive but no UI invokes it yet. */
  release(targetAccountId: string): Promise<void>;
  /** Tear down. Idempotent. Never throws. */
  close(): Promise<void>;
}

// Internal wire shape. `[k: string]: unknown` keeps the generic
// constraint on openNexChannel happy (same workaround that featured-
// product-channel + broadcast-engine use).

interface JailSetMessage {
  type: "jail-set";
  targetAccountId: string;
  startedAtMs: number;
  durationMs: number;
  sessionId: string;
  [k: string]: unknown;
}

interface JailReleaseMessage {
  type: "jail-release";
  targetAccountId: string;
  sessionId: string;
  at: number;
  [k: string]: unknown;
}

function clampDuration(ms: number): number {
  if (!Number.isFinite(ms)) return NEX_JAIL_DEFAULT_DURATION_MS;
  return Math.max(
    NEX_JAIL_MIN_DURATION_MS,
    Math.min(NEX_JAIL_MAX_DURATION_MS, Math.floor(ms)),
  );
}

function normaliseJailPayload(raw: unknown): JailEventPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<JailSetMessage>;
  if (
    typeof r.targetAccountId !== "string" ||
    r.targetAccountId.length === 0 ||
    typeof r.startedAtMs !== "number" ||
    !Number.isFinite(r.startedAtMs) ||
    typeof r.durationMs !== "number" ||
    !Number.isFinite(r.durationMs) ||
    typeof r.sessionId !== "string" ||
    r.sessionId.length === 0
  ) {
    return null;
  }
  return {
    targetAccountId: r.targetAccountId,
    startedAtMs: r.startedAtMs,
    durationMs: clampDuration(r.durationMs),
    sessionId: r.sessionId,
  };
}

/** Open (or attach to) the jail channel for a session. */
export function openJailChannel(
  opts: OpenJailChannelOptions,
): JailChannelHandle {
  const { sessionId, role, onJail, onRelease } = opts;
  const channelName = `nex:live-jail:${sessionId}`;
  const selfId = `${role}:${sessionId}:${Math.random().toString(36).slice(2)}`;

  let closed = false;

  const handle: NexChannelHandle = openNexChannel<
    JailSetMessage | JailReleaseMessage
  >({
    name: channelName,
    selfId,
    onBroadcast: (event, envelope) => {
      if (closed) return;
      if (role === "broadcaster") return; // broadcaster never consumes echo
      const payload = envelope.payload as
        | Partial<JailSetMessage>
        | Partial<JailReleaseMessage>
        | undefined;
      if (!payload) return;

      if (event === "jail-set" && payload.type === "jail-set") {
        const normalised = normaliseJailPayload(payload);
        if (!normalised) return;
        // Cross-session guard · ignore any jail event for a different
        // session (defence in depth against stale subscriptions).
        if (normalised.sessionId !== sessionId) return;
        onJail?.(normalised);
        return;
      }
      if (event === "jail-release" && payload.type === "jail-release") {
        const target = payload.targetAccountId;
        if (typeof target !== "string" || target.length === 0) return;
        if (payload.sessionId !== sessionId) return;
        onRelease?.(target);
        return;
      }
      // Tolerate unknown types silently (future additions).
    },
    onError: () => {
      /* best-effort channel · a Phase 2 toast could surface this */
    },
  });

  return {
    async jail(targetAccountId, options): Promise<void> {
      if (closed) return;
      if (role !== "broadcaster") return; // viewer · no-op
      if (typeof targetAccountId !== "string" || targetAccountId.length === 0) {
        return;
      }
      const durationMs = clampDuration(
        options?.durationMs ?? NEX_JAIL_DEFAULT_DURATION_MS,
      );
      const message: JailSetMessage = {
        type: "jail-set",
        targetAccountId,
        startedAtMs: Date.now(),
        durationMs,
        sessionId,
      };
      try {
        await handle.broadcast(
          "jail-set",
          message as unknown as Record<string, unknown>,
        );
      } catch {
        /* best-effort · a Phase 2 toast could surface this */
      }
    },

    async release(targetAccountId): Promise<void> {
      if (closed) return;
      if (role !== "broadcaster") return;
      if (typeof targetAccountId !== "string" || targetAccountId.length === 0) {
        return;
      }
      const message: JailReleaseMessage = {
        type: "jail-release",
        targetAccountId,
        sessionId,
        at: Date.now(),
      };
      try {
        await handle.broadcast(
          "jail-release",
          message as unknown as Record<string, unknown>,
        );
      } catch {
        /* best-effort */
      }
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      try {
        await handle.close();
      } catch {
        /* idempotent · never throw */
      }
    },
  };
}

/** Pure helper · derive remaining ms from a jail event + current clock.
 *  Returns 0 (not negative) when expired. Monotonic subtraction only;
 *  caller supplies `nowMs` so a shared clock can be injected. */
export function remainingJailMs(
  event: JailEventPayload,
  nowMs: number = Date.now(),
): number {
  const elapsed = nowMs - event.startedAtMs;
  const remaining = event.durationMs - elapsed;
  return remaining > 0 ? remaining : 0;
}
