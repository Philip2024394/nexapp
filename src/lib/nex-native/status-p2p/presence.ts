// src/lib/nex-native/status-p2p/presence.ts
//
// NEX Status · owner-side presence announcement.
//
// Owners with at least one active (non-expired) status open the
// `nex:status-owners` presence channel so viewers can discover them.
//
// Design:
//   · One global presence channel for ALL status owners · the roster
//     is bounded by the pilot scale and we filter viewer-side by
//     `hasActive: true`. If the roster grows beyond this surface's
//     comfort, Phase 2 can split per-geography or add RLS.
//   · We DO NOT publish any media bytes here · only an opaque
//     "I have at least one active status" marker + lastActiveAt.
//   · Owner MUST call `refreshActivity()` after every saveStatus so
//     the lastActiveAt timestamp advances and the viewer-side roster
//     surfaces newly posted statuses without a presence rejoin.
//
// Honest limits:
//   · Status only viewable when owner is online · acceptable per
//     owner directive 2026-10-22.
//   · STUN only · no TURN · same pilot limit as live-broadcast.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";

export interface StatusOwnerPresenceRow {
  ownerAccountId: string;
  /** Display name for the owner · populated by callers that have it;
   *  present as an empty string when the caller is not able to resolve
   *  a label. The viewer-side feed falls back to the account id. */
  displayName?: string;
  /** Set when the owner has at least one active (non-expired) status
   *  on this device at the moment presence is tracked. */
  hasActive: boolean;
  /** ms-epoch of the most recent saveStatus call. Advanced on
   *  `refreshActivity()`. */
  lastActiveAt: number;
  /** Index signature so this type satisfies the generic
   *  `BroadcastPayload = Record<string, unknown>` constraint on
   *  `openNexChannel`. The named fields above are the authoritative
   *  schema. */
  [k: string]: unknown;
}

export interface StatusOwnerPresenceSnapshot {
  ownerAccountId: string;
  displayName: string;
  hasActive: boolean;
  lastActiveAt: number;
}

export interface StatusOwnerPresenceHandlers {
  onPresenceChange?: (owners: StatusOwnerPresenceSnapshot[]) => void;
  onError?: (msg: string) => void;
  onSubscribed?: () => void;
}

export interface StatusOwnerPresenceOptions {
  ownerAccountId: string;
  /** Optional label the owner surfaces to the roster. Defaults to the
   *  empty string when absent · viewers can still render the row. */
  displayName?: string;
  handlers?: StatusOwnerPresenceHandlers;
}

export const STATUS_OWNERS_CHANNEL_NAME = "nex:status-owners";

/**
 * Owner-side (and viewer-side) presence client for the
 * `nex:status-owners` roster.
 *
 * Usage:
 *   const presence = new StatusOwnerPresence({ ownerAccountId });
 *   await presence.start();
 *   // ...later after saveStatus...
 *   await presence.refreshActivity();
 *   // ...on unmount...
 *   await presence.stop();
 *
 * The class is also used by viewer-side surfaces to subscribe to the
 * roster without announcing themselves · pass `announceSelf: false` to
 * `start()` for pure-observer mode.
 */
export class StatusOwnerPresence {
  private channel: NexChannelHandle | null = null;
  private started = false;
  private closed = false;
  private lastActiveAt = 0;
  private hasActive = true;

  constructor(private readonly opts: StatusOwnerPresenceOptions) {}

  /**
   * Join the `nex:status-owners` channel and announce self (unless
   * `announceSelf: false`).
   *
   * Idempotent · a second start() while already started is a no-op.
   */
  async start(options?: { announceSelf?: boolean; hasActive?: boolean }): Promise<void> {
    if (this.started || this.closed) return;
    this.started = true;
    this.hasActive = options?.hasActive ?? true;

    const handlers = this.opts.handlers ?? {};
    this.channel = openNexChannel<StatusOwnerPresenceRow>({
      name: STATUS_OWNERS_CHANNEL_NAME,
      selfId: this.opts.ownerAccountId,
      onPresenceChange: (raw) => this.handlePresenceChange(raw),
      onError: (e) => handlers.onError?.(`status-owners presence error: ${e}`),
      onSubscribed: handlers.onSubscribed,
    });

    if (options?.announceSelf !== false) {
      this.lastActiveAt = Date.now();
      const row: StatusOwnerPresenceRow = {
        ownerAccountId: this.opts.ownerAccountId,
        displayName: this.opts.displayName ?? "",
        hasActive: this.hasActive,
        lastActiveAt: this.lastActiveAt,
      };
      await this.channel.trackPresence(row as unknown as Record<string, unknown>);
    }
  }

  /**
   * Leave the presence roster and close the channel. Idempotent.
   */
  async stop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.started = false;
    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        /* ignore · closing anyway */
      }
      this.channel = null;
    }
  }

  /**
   * Re-track self with an updated lastActiveAt so the viewer-side feed
   * observes that this owner has newly-posted content.
   *
   * Safe to call after a saveStatus completes. No-op before start() or
   * after stop().
   */
  async refreshActivity(options?: { hasActive?: boolean }): Promise<void> {
    if (!this.started || this.closed || !this.channel) return;
    if (options?.hasActive !== undefined) this.hasActive = options.hasActive;
    this.lastActiveAt = Date.now();
    const row: StatusOwnerPresenceRow = {
      ownerAccountId: this.opts.ownerAccountId,
      displayName: this.opts.displayName ?? "",
      hasActive: this.hasActive,
      lastActiveAt: this.lastActiveAt,
    };
    try {
      await this.channel.trackPresence(row as unknown as Record<string, unknown>);
    } catch {
      /* best-effort · the next presence sync will retry */
    }
  }

  /** Returns true if start() has run and stop() has not. */
  isActive(): boolean {
    return this.started && !this.closed;
  }

  private handlePresenceChange(
    raw: Record<string, Array<Record<string, unknown>>>,
  ): void {
    const handlers = this.opts.handlers ?? {};
    if (!handlers.onPresenceChange) return;

    const owners: StatusOwnerPresenceSnapshot[] = [];
    for (const [, metas] of Object.entries(raw)) {
      const meta = (metas?.[0] ?? {}) as unknown as StatusOwnerPresenceRow;
      if (!meta || typeof meta.ownerAccountId !== "string") continue;
      owners.push({
        ownerAccountId: meta.ownerAccountId,
        displayName:
          typeof meta.displayName === "string" ? meta.displayName : "",
        hasActive: meta.hasActive === true,
        lastActiveAt:
          typeof meta.lastActiveAt === "number" ? meta.lastActiveAt : 0,
      });
    }

    // Deterministic order · newest activity first so the UI stays stable.
    owners.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    handlers.onPresenceChange(owners);
  }
}
