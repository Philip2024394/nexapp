// src/lib/nex-native/calls/group-call-engine.ts
//
// Mesh orchestrator for group calls. Owns the single local MediaStream,
// a `nex:group:{sessionId}` presence channel for member discovery, and
// a Map<peerAccountId, GroupPeer> that evolves as members join/leave.
//
// Lifecycle:
//   1. `start()` grabs the camera/mic (once), tracks presence as
//      "live" on the group channel.
//   2. On every presence sync, diff the roster vs. our GroupPeer map:
//        · new peer   → create a GroupPeer, call .start()
//        · gone peer  → close that GroupPeer, drop the remote stream
//   3. Each GroupPeer runs on its own pairwise signalling channel so
//      SDP/ICE from different edges never collide.
//
// 4-cap: the DB trigger is authoritative. This engine stops accepting
// new GroupPeers once it already has 3 remote peers · which also
// prevents a race on media-channel bandwidth.

"use client";

import {
  openNexChannel,
  type NexChannelHandle,
} from "../realtime/channel";
import { GroupPeer, type GroupPeerState } from "./group-peer";

export type GroupCallEngineState =
  | "idle"
  | "requesting-media"
  | "connecting"
  | "live"
  | "ended";

export interface GroupRemoteStream {
  accountId: string;
  stream: MediaStream;
}

export interface GroupPresenceMember {
  accountId: string;
  displayName: string;
  presenceState: "ringing" | "live";
  joinedAt: number;
}

export interface GroupCallEngineHandlers {
  onStateChange?: (state: GroupCallEngineState) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStreams?: (streams: GroupRemoteStream[]) => void;
  onPresenceChange?: (members: GroupPresenceMember[]) => void;
  onError?: (msg: string) => void;
}

export interface GroupCallEngineOptions {
  sessionId: string;
  selfAccountId: string;
  selfDisplayName: string;
  mediaType: "audio" | "video";
  handlers: GroupCallEngineHandlers;
}

const MAX_REMOTE_PEERS = 3; // host + 3 = 4 cap

interface PresenceTrackState {
  accountId: string;
  displayName: string;
  presenceState: "ringing" | "live";
  joinedAt: number;
}

export class GroupCallEngine {
  private state: GroupCallEngineState = "idle";
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, GroupPeer>();
  private readonly remoteStreams = new Map<string, MediaStream>();
  private presenceChannel: NexChannelHandle | null = null;
  private muted = false;
  private cameraOff = false;
  private closed = false;
  // §16.48.25 Lane 2 · 2026-11-20 · one-shot latch for confirmRoomJoin.
  // The POST fires at the first connecting→live transition (the engine
  // has observed at least one peer). Dedup via instance flag so a flaky
  // presence stream doesn't re-fire. Fail-soft: errors never leave this
  // module · the server UPDATE is idempotent (eq session,account,left_at
  // IS NULL) so a retry on reconnect is also safe.
  private joinConfirmed = false;

  constructor(private readonly opts: GroupCallEngineOptions) {}

  getState(): GroupCallEngineState { return this.state; }
  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStreams(): GroupRemoteStream[] {
    return Array.from(this.remoteStreams.entries()).map(
      ([accountId, stream]) => ({ accountId, stream }),
    );
  }

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    this.setState("requesting-media");

    try {
      const constraints: MediaStreamConstraints =
        this.opts.mediaType === "video"
          ? { audio: true, video: { facingMode: "user" } }
          : { audio: true, video: false };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.opts.handlers.onLocalStream?.(this.localStream);
    } catch {
      this.opts.handlers.onError?.(
        this.opts.mediaType === "video"
          ? "camera or microphone permission was denied"
          : "microphone permission was denied",
      );
      this.setState("ended");
      return;
    }

    this.presenceChannel = openNexChannel<PresenceTrackState>({
      name: `nex:group:${this.opts.sessionId}`,
      selfId: this.opts.selfAccountId,
      onPresenceChange: (state) => this.handlePresenceChange(state),
      onError: (e) => this.opts.handlers.onError?.(`group presence error: ${e}`),
    });

    const track: PresenceTrackState = {
      accountId: this.opts.selfAccountId,
      displayName: this.opts.selfDisplayName,
      presenceState: "live",
      joinedAt: Date.now(),
    };
    await this.presenceChannel.trackPresence(
      track as unknown as Record<string, unknown>,
    );
    this.setState("connecting");
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const peer of this.peers.values()) {
      try { await peer.close(); } catch { /* ignore */ }
    }
    this.peers.clear();
    this.remoteStreams.clear();
    this.opts.handlers.onRemoteStreams?.([]);
    if (this.presenceChannel) {
      try { await this.presenceChannel.close(); }
      catch { /* ignore */ }
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

  isMuted(): boolean { return this.muted; }
  isCameraOff(): boolean { return this.cameraOff; }

  /** Owner-authorised Phase 2 wiring 2026-10-19 · additive read-only
   *  accessor. Walks the private peers map and returns one entry per
   *  LIVE RTCPeerConnection so the sealed
   *  `measurement.collectStats()` can read stats per peer. Zero
   *  change to signalling, SDP, media capture, or event flow · pure
   *  read of state already managed by the engine.
   *
   *  Honest invariants:
   *    · GroupPeer.getPeerConnection() returns null for torn-down /
   *      pre-offer peers · those are filtered out here.
   *    · Caller MUST still check pc.connectionState to distinguish
   *      connecting / connected / disconnected / failed / closed
   *      before deriving a quality label from stats. */
  getAllPeerConnections(): ReadonlyArray<{
    readonly peerAccountId: string;
    readonly pc: RTCPeerConnection;
  }> {
    const out: Array<{ peerAccountId: string; pc: RTCPeerConnection }> = [];
    for (const [peerAccountId, peer] of this.peers.entries()) {
      const pc = peer.getPeerConnection();
      if (pc !== null) out.push({ peerAccountId, pc });
    }
    return out;
  }

  private handlePresenceChange(
    rawState: Record<string, Array<Record<string, unknown>>>,
  ): void {
    if (this.closed || !this.localStream) return;

    const members: GroupPresenceMember[] = [];
    const seenAccountIds = new Set<string>();

    for (const [, metas] of Object.entries(rawState)) {
      const meta = (metas?.[0] ?? {}) as unknown as PresenceTrackState;
      if (!meta?.accountId) continue;
      seenAccountIds.add(meta.accountId);
      members.push({
        accountId: meta.accountId,
        displayName: meta.displayName ?? "",
        presenceState: meta.presenceState ?? "live",
        joinedAt: meta.joinedAt ?? 0,
      });
    }

    this.opts.handlers.onPresenceChange?.(members);

    // Add new peers (dial out).
    for (const m of members) {
      if (m.accountId === this.opts.selfAccountId) continue;
      if (this.peers.has(m.accountId)) continue;
      if (this.peers.size >= MAX_REMOTE_PEERS) continue;
      this.spawnPeer(m.accountId);
    }

    // Drop peers that have left the roster.
    for (const [peerId, peer] of this.peers.entries()) {
      if (!seenAccountIds.has(peerId)) {
        void peer.close();
        this.peers.delete(peerId);
        this.remoteStreams.delete(peerId);
      }
    }

    if (this.remoteStreams.size !== members.length - 1) {
      // No-op — the stream count catches up when remote tracks arrive.
    }

    this.flushRemoteStreams();

    if (this.state === "connecting" && this.peers.size > 0) {
      this.setState("live");
      // §16.48.25 Lane 2 · at the first moment the engine has at least
      // one peer entry, mark joined_at server-side. This is the sole
      // trusted writer of nex_group_call_participant.joined_at. We fire
      // once per engine instance; the server guard is independent and
      // will deny callers who are not a member.
      void this.confirmRoomJoinOnce();
    }
  }

  /** One-shot POST to /api/nex-native/calls/confirm-room-join. Fail-soft:
   *  the call is advisory for server-side analytics / UI roster accuracy
   *  and must not degrade the WebRTC path. */
  private async confirmRoomJoinOnce(): Promise<void> {
    if (this.joinConfirmed) return;
    this.joinConfirmed = true;
    try {
      await fetch("/api/nex-native/calls/confirm-room-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.opts.sessionId }),
        // keepalive helps the request survive if the user navigates
        // away immediately after the state flip.
        keepalive: true,
      });
    } catch {
      // Intentional swallow · analytics / roster refinement only.
    }
  }

  private spawnPeer(peerAccountId: string): void {
    if (!this.localStream) return;
    const peer = new GroupPeer({
      sessionId: this.opts.sessionId,
      selfAccountId: this.opts.selfAccountId,
      peerAccountId,
      mediaType: this.opts.mediaType,
      localStream: this.localStream,
      handlers: {
        onStateChange: (s) => this.handlePeerStateChange(peerAccountId, s),
        onRemoteStream: (stream) => {
          this.remoteStreams.set(peerAccountId, stream);
          this.flushRemoteStreams();
        },
        onError: (msg) => this.opts.handlers.onError?.(
          `peer ${peerAccountId}: ${msg}`,
        ),
      },
    });
    this.peers.set(peerAccountId, peer);
    void peer.start();
  }

  private handlePeerStateChange(peerAccountId: string, s: GroupPeerState): void {
    if (s === "failed" || s === "closed") {
      this.remoteStreams.delete(peerAccountId);
      this.flushRemoteStreams();
      this.peers.delete(peerAccountId);
    }
  }

  private flushRemoteStreams(): void {
    this.opts.handlers.onRemoteStreams?.(this.getRemoteStreams());
  }

  private setState(next: GroupCallEngineState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.handlers.onStateChange?.(next);
  }
}
