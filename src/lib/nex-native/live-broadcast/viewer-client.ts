// src/lib/nex-native/live-broadcast/viewer-client.ts
//
// NEX Live Commerce · viewer-side client.
//
// Receive-only counterpart to LiveBroadcastEngine. The viewer never
// calls getUserMedia · it joins the `nex:live:{sessionId}` presence
// channel as role: "viewer", opens the pairwise signalling channel
// `live:{sessionId}:{viewerAccountId}`, awaits the broadcaster's SDP
// offer, and answers.
//
// State transitions it drives:
//   · waiting      · presence joined, no broadcaster yet
//   · connecting   · offer received, SDP exchange in flight
//   · live         · ontrack fired, remote stream handed to caller
//   · ended        · broadcaster left the presence roster
//   · at-capacity  · broadcaster signalled a BYE with reason =
//                    declined, OR our own presence row carries the
//                    `rejected: "capacity"` field (set by the
//                    broadcaster-side engine)
//   · offline      · broadcaster never appeared within WAIT_FOR_
//                    BROADCASTER_MS (10 s)
//
// There is NO auto-reconnect for the pilot · once we hit a terminal
// state the caller must construct a new LiveViewerClient to retry.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";
import {
  openSignallingChannel,
  type IceSignal,
  type SdpOfferSignal,
  type SignallingChannel,
} from "../realtime/signalling";
import { broadcastConversationId } from "./broadcast-peer";
import type { LivePresenceMember, LiveViewerState } from "./types";

// Same ICE server set as the broadcaster. See broadcast-peer.ts for
// the Phase 2 TURN note · the viewer side is subject to the exact
// same NAT constraints and will need TURN before this ships to
// Indonesian carrier audiences.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/** Deadline before we conclude the broadcaster is not live. */
const WAIT_FOR_BROADCASTER_MS = 10_000;

export interface LiveViewerClientHandlers {
  onStateChange?: (state: LiveViewerState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  /** Full presence roster snapshot · useful for a "N watching" chip
   *  rendered on the viewer side too. */
  onPresenceChange?: (members: LivePresenceMember[]) => void;
  onError?: (msg: string) => void;
}

export interface LiveViewerClientJoinOptions {
  sessionId: string;
  viewerAccountId: string;
  viewerDisplayName: string;
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
  // schema.
  [k: string]: unknown;
}

export class LiveViewerClient {
  private state: LiveViewerState = "idle";
  private presenceChannel: NexChannelHandle | null = null;
  private signalling: SignallingChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private remoteDescriptionSet = false;
  private queuedIce: RTCIceCandidateInit[] = [];
  private broadcasterSeen = false;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private sessionId: string | null = null;
  private viewerAccountId: string | null = null;
  private callId: string | null = null;

  constructor(private readonly handlers: LiveViewerClientHandlers = {}) {}

  getState(): LiveViewerState {
    return this.state;
  }

  async join(opts: LiveViewerClientJoinOptions): Promise<void> {
    if (this.state !== "idle") return;

    this.sessionId = opts.sessionId;
    this.viewerAccountId = opts.viewerAccountId;
    this.callId = `live:${opts.sessionId}:${opts.viewerAccountId}`;

    this.setState("waiting");

    // 1. Open presence FIRST so the broadcaster sees us before we
    //    start listening for an offer. Order matters · if we opened
    //    signalling first, the broadcaster could race ahead and send
    //    an offer before our presence row appeared, which would be
    //    harmless but noisy.
    this.presenceChannel = openNexChannel<PresenceTrackState>({
      name: `nex:live:${opts.sessionId}`,
      selfId: opts.viewerAccountId,
      onPresenceChange: (raw) => this.handlePresenceChange(raw),
      onError: (e) => this.handlers.onError?.(`live presence error: ${e}`),
    });

    const track: PresenceTrackState = {
      accountId: opts.viewerAccountId,
      displayName: opts.viewerDisplayName,
      role: "viewer",
      joinedAt: Date.now(),
      rejected: null,
    };
    await this.presenceChannel.trackPresence(
      track as unknown as Record<string, unknown>,
    );

    // 2. Open pairwise signalling channel · the broadcaster will
    //    send us an offer on this topic as soon as it admits us.
    this.signalling = openSignallingChannel({
      conversationId: broadcastConversationId(
        opts.sessionId,
        opts.viewerAccountId,
      ),
      selfAccountId: opts.viewerAccountId,
      handlers: {
        onOffer: (s) => this.handleOffer(s),
        onIce: (s) => void this.handleIce(s),
        onBye: (s) => this.handleBye(s.reason),
        onError: (e) => this.handlers.onError?.(e),
      },
    });

    // 3. Arm the "broadcaster never appeared" deadline. Cleared
    //    inside handlePresenceChange when we see a broadcaster row.
    this.waitTimer = setTimeout(() => {
      if (this.closed) return;
      if (!this.broadcasterSeen && this.state === "waiting") {
        this.setState("offline");
        void this.teardown();
      }
    }, WAIT_FOR_BROADCASTER_MS);
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.teardown();
    if (this.state !== "ended" && this.state !== "at-capacity") {
      this.setState("ended");
    }
  }

  private async teardown(): Promise<void> {
    if (this.waitTimer !== null) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.remoteDescriptionSet = false;
    this.queuedIce = [];

    if (this.signalling) {
      try {
        await this.signalling.close();
      } catch {
        /* ignore */
      }
      this.signalling = null;
    }
    if (this.presenceChannel) {
      try {
        await this.presenceChannel.close();
      } catch {
        /* ignore */
      }
      this.presenceChannel = null;
    }
  }

  private handlePresenceChange(
    rawState: Record<string, Array<Record<string, unknown>>>,
  ): void {
    if (this.closed) return;

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

    this.handlers.onPresenceChange?.(
      rows.map((r) => ({
        accountId: r.accountId,
        displayName: r.displayName,
        role: r.role,
        joinedAt: r.joinedAt,
        rejected: r.rejected,
      })),
    );

    // Did our own row get flagged `rejected: "capacity"`? That's the
    // broadcaster telling us we're above the pilot cap. The engine
    // also sends a signalling BYE for reliability · whichever one
    // arrives first wins.
    const myRow = rows.find((r) => r.accountId === this.viewerAccountId);
    if (myRow?.rejected === "capacity" && this.state !== "at-capacity") {
      this.setState("at-capacity");
      void this.teardown();
      return;
    }

    const hasBroadcaster = rows.some((r) => r.role === "broadcaster");

    if (hasBroadcaster) {
      if (!this.broadcasterSeen) {
        this.broadcasterSeen = true;
        if (this.waitTimer !== null) {
          clearTimeout(this.waitTimer);
          this.waitTimer = null;
        }
      }
    } else if (this.broadcasterSeen) {
      // We saw the broadcaster, now they're gone · the stream has
      // ended. This is a terminal state for the pilot.
      if (this.state !== "ended") {
        this.setState("ended");
        void this.teardown();
      }
    }
  }

  private handleOffer(s: SdpOfferSignal): void {
    if (this.closed) return;
    if (s.callId !== this.callId) return;
    if (this.state !== "waiting" && this.state !== "connecting") return;
    void (async () => {
      try {
        if (!this.pc) {
          this.pc = this.buildPc();
        }
        this.setState("connecting");
        await this.pc.setRemoteDescription(s.sdp);
        this.remoteDescriptionSet = true;
        await this.flushQueuedIce();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        if (this.signalling) {
          await this.signalling.sendAnswer({
            callId: this.callId!,
            sdp: answer,
          });
        }
      } catch (e) {
        this.handlers.onError?.(
          `viewer-client offer handling failed: ${(e as Error).message}`,
        );
      }
    })();
  }

  private async handleIce(s: IceSignal): Promise<void> {
    if (!this.pc || s.callId !== this.callId) return;
    if (!this.remoteDescriptionSet) {
      this.queuedIce.push(s.candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(s.candidate);
    } catch {
      /* stale candidate · ignore */
    }
  }

  private handleBye(reason: string): void {
    if (this.closed) return;
    if (reason === "declined") {
      // Broadcaster-side cap signalling · we are over MAX_VIEWERS.
      if (this.state !== "at-capacity") {
        this.setState("at-capacity");
        void this.teardown();
      }
      return;
    }
    if (this.state !== "ended") {
      this.setState("ended");
      void this.teardown();
    }
  }

  private buildPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        this.handlers.onRemoteStream?.(stream);
        if (this.state !== "live") {
          this.setState("live");
        }
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.signalling && this.callId) {
        void this.signalling.sendIce({
          callId: this.callId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed") {
        this.handlers.onError?.("viewer-client connection failed");
        if (this.state !== "ended" && this.state !== "at-capacity") {
          this.setState("ended");
        }
        void this.teardown();
      }
    };
    return pc;
  }

  private async flushQueuedIce(): Promise<void> {
    while (this.queuedIce.length > 0 && this.pc) {
      const c = this.queuedIce.shift()!;
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* stale · ignore */
      }
    }
  }

  private setState(next: LiveViewerState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }
}
