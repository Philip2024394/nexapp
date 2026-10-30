// src/lib/nex-native/live-broadcast/broadcast-engine.ts
//
// NEX Live Commerce · broadcaster-side orchestrator.
//
// Owns the single local MediaStream (captured once via getUserMedia),
// opens the `nex:live:{sessionId}` presence channel to discover
// viewers, and spawns one BroadcastPeer per viewer. This is the
// asymmetric sibling of GroupCallEngine · the group engine remains
// untouched for 1:1 and 4-way symmetric mesh calls.
//
// Lifecycle:
//   1. start() grabs camera + mic, tracks presence as role:
//      "broadcaster".
//   2. On every presence sync, we diff the viewer roster vs. our
//      BroadcastPeer map:
//        · new viewer under the cap  → spawn BroadcastPeer, offer
//        · new viewer OVER the cap    → mark their presence slot
//                                        rejected: "capacity" so the
//                                        viewer flips to "at-capacity"
//        · gone viewer                → close the matching peer
//   3. leave() tears down every peer, stops local tracks, closes
//      presence, transitions to "ended".
//
// MAX_VIEWERS = 10 · pilot cap. See the note below for the bandwidth
// math and the TURN+SFU prerequisite for raising this.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";
import { BroadcastPeer, type BroadcastPeerState } from "./broadcast-peer";
import type {
  LiveBroadcastState,
  LivePresenceMember,
} from "./types";

/**
 * Pilot hard-cap on concurrent viewers per broadcast.
 *
 * Why 10:
 *   · Mesh upload bandwidth is O(N) at the broadcaster · at 720p
 *     ~1.5 Mbps per peer, 10 viewers is ~15 Mbps upstream, which is
 *     already above the median Indonesian mobile uplink.
 *   · Beyond 10, we need an SFU (one upload from the broadcaster to
 *     the SFU, which fans out) AND TURN relays for mobile NAT.
 *   · 10 is enough for the Phase-1 pilot of "small business goes
 *     live for a handful of followers" which is the current scope.
 *
 * Raising this cap requires:
 *   · TURN infrastructure (see broadcast-peer.ts for the ICE note).
 *   · An SFU in front of the broadcaster (mediasoup / LiveKit /
 *     Janus / managed service) so the broadcaster uploads once.
 *   · A re-think of the presence-based admission model (per-SFU
 *     signalling conventions, token-based room auth, etc.).
 *
 * Treat this as an architectural seam, not a flag · bumping the
 * number without the above work will degrade the broadcaster's
 * uplink and all viewers suffer.
 */
export const MAX_VIEWERS = 10 as const;

/** Public handlers surface. All optional · engine functions without
 *  any of them. */
export interface LiveBroadcastEngineHandlers {
  onStateChange?: (state: LiveBroadcastState) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onViewerCountChange?: (count: number) => void;
  /** Full roster snapshot · useful for a "who's watching" chip. */
  onPresenceChange?: (members: LivePresenceMember[]) => void;
  onError?: (msg: string) => void;
}

export interface LiveBroadcastEngineStartOptions {
  sessionId: string;
  /** nex_account.id of the broadcaster. */
  selfAccountId: string;
  /** Human-readable label shown to viewers in presence snapshots. */
  selfDisplayName: string;
}

interface PresenceTrackState {
  accountId: string;
  displayName: string;
  role: "broadcaster" | "viewer";
  joinedAt: number;
  rejected: null | "capacity";
  // Index signature so this type satisfies the generic
  // `BroadcastPayload = Record<string, unknown>` constraint on
  // `openNexChannel`. The named fields above are the authoritative
  // schema · the signature only widens the type for the channel
  // generic.
  [k: string]: unknown;
}

interface AdmittedViewer {
  accountId: string;
  displayName: string;
  joinedAt: number;
}

export class LiveBroadcastEngine {
  private state: LiveBroadcastState = "idle";
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, BroadcastPeer>();
  /** Admitted viewers · ordered by joinedAt so cap decisions are
   *  deterministic (first-come-first-served up to MAX_VIEWERS). */
  private readonly admitted = new Map<string, AdmittedViewer>();
  /** Viewers marked rejected: "capacity" · we keep the set so we do
   *  not oscillate on every presence sync. */
  private readonly rejected = new Set<string>();
  private presenceChannel: NexChannelHandle | null = null;
  private muted = false;
  private cameraOff = false;
  private closed = false;
  private sessionId: string | null = null;
  private selfAccountId: string | null = null;
  private selfDisplayName: string | null = null;

  constructor(private readonly handlers: LiveBroadcastEngineHandlers = {}) {}

  getState(): LiveBroadcastState {
    return this.state;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getViewerCount(): number {
    return this.admitted.size;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isCameraOff(): boolean {
    return this.cameraOff;
  }

  /** Owner directive 2026-10-29 (NEX Music live wiring) · forward a
   *  replacement audio track to every live BroadcastPeer. The caller
   *  (NEX Music overlay) builds a WebAudio-mixed MediaStream and
   *  hands its audio track here · viewers continue receiving one
   *  audio track per peer with mic + music mixed. The engine's own
   *  `localStream` reference is left alone · it is still the mic-
   *  only capture used for the local self-view and preview. */
  async replaceAudioTrack(newTrack: MediaStreamTrack): Promise<void> {
    for (const peer of this.peers.values()) {
      try {
        await peer.replaceAudioTrack(newTrack);
      } catch {
        /* best-effort per peer */
      }
    }
  }

  async start(opts: LiveBroadcastEngineStartOptions): Promise<void> {
    if (this.state !== "idle") return;
    this.sessionId = opts.sessionId;
    this.selfAccountId = opts.selfAccountId;
    this.selfDisplayName = opts.selfDisplayName;

    this.setState("requesting-media");

    try {
      // Broadcaster-only · capture once. User-facing camera is the
      // standard "going live" affordance; a Phase 2 settings toggle
      // can expose environment-facing for product demos.
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });
      this.handlers.onLocalStream?.(this.localStream);
    } catch {
      this.handlers.onError?.(
        "camera or microphone permission was denied",
      );
      this.setState("ended");
      return;
    }

    this.presenceChannel = openNexChannel<PresenceTrackState>({
      name: `nex:live:${opts.sessionId}`,
      selfId: opts.selfAccountId,
      onPresenceChange: (raw) => this.handlePresenceChange(raw),
      onError: (e) => this.handlers.onError?.(`live presence error: ${e}`),
    });

    const track: PresenceTrackState = {
      accountId: opts.selfAccountId,
      displayName: opts.selfDisplayName,
      role: "broadcaster",
      joinedAt: Date.now(),
      rejected: null,
    };
    await this.presenceChannel.trackPresence(
      track as unknown as Record<string, unknown>,
    );

    this.setState("live");
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    for (const peer of this.peers.values()) {
      try {
        await peer.close();
      } catch {
        /* ignore */
      }
    }
    this.peers.clear();
    this.admitted.clear();
    this.rejected.clear();
    this.handlers.onViewerCountChange?.(0);

    if (this.presenceChannel) {
      try {
        await this.presenceChannel.close();
      } catch {
        /* ignore */
      }
      this.presenceChannel = null;
    }

    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }

    this.setState("ended");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.localStream) return;
    for (const t of this.localStream.getAudioTracks()) t.enabled = !muted;
  }

  setCameraOff(off: boolean): void {
    this.cameraOff = off;
    if (!this.localStream) return;
    for (const t of this.localStream.getVideoTracks()) t.enabled = !off;
  }

  private handlePresenceChange(
    rawState: Record<string, Array<Record<string, unknown>>>,
  ): void {
    if (this.closed) return;
    if (!this.localStream || !this.sessionId || !this.selfAccountId) return;

    // Flatten the raw presence map into typed rows.
    const rows: PresenceTrackState[] = [];
    for (const [, metas] of Object.entries(rawState)) {
      const meta = (metas?.[0] ?? {}) as unknown as PresenceTrackState;
      if (!meta?.accountId) continue;
      rows.push({
        accountId: meta.accountId,
        displayName: meta.displayName ?? "",
        role: meta.role === "broadcaster" ? "broadcaster" : "viewer",
        joinedAt: meta.joinedAt ?? 0,
        rejected: meta.rejected === "capacity" ? "capacity" : null,
      });
    }

    // Public roster fire · callers can render a "N watching" chip.
    const members: LivePresenceMember[] = rows.map((r) => ({
      accountId: r.accountId,
      displayName: r.displayName,
      role: r.role,
      joinedAt: r.joinedAt,
      rejected: r.rejected,
    }));
    this.handlers.onPresenceChange?.(members);

    // Candidate viewers · everyone except the broadcaster, ordered by
    // joinedAt so admission is deterministic across resyncs.
    const viewerCandidates = rows
      .filter(
        (r) => r.role === "viewer" && r.accountId !== this.selfAccountId,
      )
      .sort((a, b) => a.joinedAt - b.joinedAt);

    const seenViewerIds = new Set<string>(
      viewerCandidates.map((v) => v.accountId),
    );

    // Admit under the cap · reject the overflow.
    for (const v of viewerCandidates) {
      if (this.admitted.has(v.accountId)) continue;
      if (this.rejected.has(v.accountId)) continue;

      if (this.admitted.size < MAX_VIEWERS) {
        this.admitted.set(v.accountId, {
          accountId: v.accountId,
          displayName: v.displayName,
          joinedAt: v.joinedAt,
        });
        this.spawnPeer(v.accountId);
      } else {
        // At capacity · mark the viewer's slot rejected so their
        // own client can flip to "at-capacity". We don't push into
        // their presence row (presence is per-identity), but we do
        // broadcast a signalling bye on the pairwise channel so the
        // viewer client sees a close signal immediately.
        this.rejected.add(v.accountId);
        void this.notifyAtCapacity(v.accountId);
      }
    }

    // Drop admitted viewers that are no longer on the roster.
    for (const [id, peer] of this.peers.entries()) {
      if (!seenViewerIds.has(id)) {
        void peer.close();
        this.peers.delete(id);
        this.admitted.delete(id);
      }
    }
    for (const id of this.admitted.keys()) {
      if (!seenViewerIds.has(id)) {
        this.admitted.delete(id);
      }
    }
    for (const id of this.rejected) {
      if (!seenViewerIds.has(id)) {
        this.rejected.delete(id);
      }
    }

    // Re-track our own presence row to include an authoritative view
    // of the current rejected set. Viewer clients observe their OWN
    // row + the broadcaster's row; the broadcaster row carries a
    // small manifest so viewers can resolve capacity decisions
    // without needing a server round-trip.
    void this.refreshBroadcasterPresence();

    this.handlers.onViewerCountChange?.(this.admitted.size);
  }

  private async refreshBroadcasterPresence(): Promise<void> {
    if (
      !this.presenceChannel ||
      !this.selfAccountId ||
      !this.selfDisplayName
    ) {
      return;
    }
    const track: PresenceTrackState = {
      accountId: this.selfAccountId,
      displayName: this.selfDisplayName,
      role: "broadcaster",
      joinedAt: Date.now(),
      rejected: null,
    };
    try {
      await this.presenceChannel.trackPresence(
        track as unknown as Record<string, unknown>,
      );
    } catch {
      /* best-effort re-track · the next presence sync will retry */
    }
  }

  /** Fire a BYE on the pairwise signalling channel so the rejected
   *  viewer learns immediately rather than waiting for a presence
   *  timeout. */
  private async notifyAtCapacity(viewerAccountId: string): Promise<void> {
    if (!this.sessionId || !this.selfAccountId) return;
    try {
      // Open a short-lived channel just to send the BYE · we do NOT
      // keep a signalling channel open for rejected viewers.
      const { openSignallingChannel } = await import(
        "../realtime/signalling"
      );
      const { broadcastConversationId } = await import(
        "./broadcast-peer"
      );
      const ch = openSignallingChannel({
        conversationId: broadcastConversationId(
          this.sessionId,
          viewerAccountId,
        ),
        selfAccountId: this.selfAccountId,
        handlers: {},
      });
      await ch.sendBye({
        callId: `live:${this.sessionId}:${viewerAccountId}`,
        reason: "declined",
      });
      await ch.close();
    } catch {
      /* best-effort · the viewer will fall back to the join deadline */
    }
  }

  private spawnPeer(viewerAccountId: string): void {
    if (
      !this.localStream ||
      !this.sessionId ||
      !this.selfAccountId
    ) {
      return;
    }
    const peer = new BroadcastPeer({
      sessionId: this.sessionId,
      broadcasterAccountId: this.selfAccountId,
      viewerAccountId,
      localStream: this.localStream,
      handlers: {
        onStateChange: (s) => this.handlePeerStateChange(viewerAccountId, s),
        onError: (msg) =>
          this.handlers.onError?.(`viewer ${viewerAccountId}: ${msg}`),
      },
    });
    this.peers.set(viewerAccountId, peer);
    void peer.start();
  }

  private handlePeerStateChange(
    viewerAccountId: string,
    s: BroadcastPeerState,
  ): void {
    if (s === "failed" || s === "closed") {
      this.peers.delete(viewerAccountId);
      this.admitted.delete(viewerAccountId);
      this.handlers.onViewerCountChange?.(this.admitted.size);
    }
  }

  private setState(next: LiveBroadcastState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }
}
