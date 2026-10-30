// src/lib/nex-native/live-broadcast/broadcast-peer.ts
//
// NEX Live Commerce · pairwise WebRTC edge from the broadcaster to ONE
// viewer. This is the broadcast counterpart to group-peer.ts · the two
// surfaces are intentionally parallel so engineers who know the mesh
// code can read this quickly, but there are three important
// differences:
//
//   1. ROLE IS ASYMMETRIC · `sendonly`
//      The broadcaster adds local tracks and does NOT ask the viewer
//      for anything back. We set each sender's direction to "sendonly"
//      and do NOT pass offerToReceiveAudio / offerToReceiveVideo. The
//      viewer never calls getUserMedia · see viewer-client.ts.
//
//   2. INITIATION IS DETERMINISTIC
//      The broadcaster always offers. There is no account-id sort
//      (the group-peer mesh needs the sort because both sides are
//      symmetric peers). Here the engine spawns a BroadcastPeer per
//      viewer and the peer begins by sending an offer immediately.
//
//   3. SIGNALLING CONVERSATION ID IS PAIRWISE, NOT SORTED
//      `live:{sessionId}:{viewerAccountId}` · the broadcaster is
//      implicit (one per session) and never needs to appear in the
//      channel name. This also means the viewer can derive the
//      channel name from (sessionId, its own accountId) without
//      knowing the broadcaster's accountId.
//
// On any `onconnectionstatechange === "failed"` we fire onError + tear
// down. There is NO auto-restart in this pilot · the broadcaster UI
// will see the viewer leave the presence roster and the next presence
// change tick will clean up the engine's peer map. Phase 2 (with
// TURN) can add an ICE restart ladder.

"use client";

import {
  openSignallingChannel,
  type IceSignal,
  type SdpAnswerSignal,
  type SignallingChannel,
} from "../realtime/signalling";

export type BroadcastPeerState =
  | "idle"
  | "connecting"
  | "connected"
  | "failed"
  | "closed";

export interface BroadcastPeerHandlers {
  onStateChange?: (state: BroadcastPeerState) => void;
  onError?: (msg: string) => void;
}

// Google + Cloudflare STUN only · identical set to group-peer.ts.
// -----------------------------------------------------------------
// HONEST FLAG · Phase 2 TURN requirement:
// Indonesian carrier-grade NAT (CGNAT) and symmetric mobile NAT will
// prevent a non-trivial fraction of viewers from completing ICE on
// STUN alone. For the mesh group call that's acceptable because the
// cap is 4 and most sessions are among friends on home Wi-Fi. For
// Live Commerce with 10+ viewers from mixed carriers, we WILL need
// TURN relays (coturn or a managed service) and eventually an SFU to
// avoid the broadcaster uploading the stream 10x. This is explicitly
// deferred to Phase 2 · do NOT ship this engine to open-ended public
// audiences without the TURN+SFU work.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Pairwise signalling conversation id for a broadcaster <> viewer
 * edge. Not sorted · the broadcaster is always the sending side so
 * `live:{sessionId}:{viewerAccountId}` is unambiguous for both sides.
 */
export function broadcastConversationId(
  sessionId: string,
  viewerAccountId: string,
): string {
  return `live:${sessionId}:${viewerAccountId}`;
}

export interface BroadcastPeerOptions {
  sessionId: string;
  /** nex_account.id of the broadcaster (the business owner). */
  broadcasterAccountId: string;
  /** nex_account.id of the single viewer this edge targets. */
  viewerAccountId: string;
  /** Local MediaStream owned by the LiveBroadcastEngine. Shared across
   *  every pairwise edge so getUserMedia is only called once. Tracks
   *  are added to this edge's RTCPeerConnection with
   *  `direction: "sendonly"`. */
  localStream: MediaStream;
  handlers: BroadcastPeerHandlers;
}

export class BroadcastPeer {
  private readonly signalling: SignallingChannel;
  private readonly callId: string;
  private pc: RTCPeerConnection | null = null;

  /** Owner directive 2026-10-29 (NEX Music live wiring) · swap the
   *  outgoing audio track in-place. Does NOT renegotiate · viewers
   *  see no interruption. Mesh-wide caller is
   *  LiveBroadcastEngine.replaceAudioTrack. */
  async replaceAudioTrack(newTrack: MediaStreamTrack): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (!sender) return;
    try {
      await sender.replaceTrack(newTrack);
    } catch {
      // Preserve existing track · caller surfaces an honest toast.
    }
  }
  private state: BroadcastPeerState = "idle";
  private remoteDescriptionSet = false;
  private queuedIce: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(private readonly opts: BroadcastPeerOptions) {
    // Call-id scopes any late signalling messages so we can ignore
    // stale offers/answers that belong to a previous attempt against
    // the same viewer slot.
    this.callId = `live:${opts.sessionId}:${opts.viewerAccountId}`;

    this.signalling = openSignallingChannel({
      conversationId: broadcastConversationId(
        opts.sessionId,
        opts.viewerAccountId,
      ),
      selfAccountId: opts.broadcasterAccountId,
      handlers: {
        // Broadcaster NEVER consumes an offer · it only sends them.
        onAnswer: (s) => this.handleAnswer(s),
        onIce: (s) => void this.handleIce(s),
        onBye: () => this.teardown("closed"),
        onError: (e) => opts.handlers.onError?.(e),
      },
    });
  }

  getState(): BroadcastPeerState {
    return this.state;
  }

  getViewerAccountId(): string {
    return this.opts.viewerAccountId;
  }

  /** Build the RTCPeerConnection, attach broadcaster-side send-only
   *  tracks, create + send the offer. The viewer side will answer. */
  async start(): Promise<void> {
    if (this.closed) return;
    this.pc = this.buildPc();

    // sendonly · the broadcaster uploads, viewer never uploads back.
    // We addTrack THEN explicitly set the transceiver direction so
    // that even if the browser defaults change, we never silently
    // flip into sendrecv (which would ask the viewer for media).
    for (const t of this.opts.localStream.getTracks()) {
      const sender = this.pc.addTrack(t, this.opts.localStream);
      const transceiver = this.pc
        .getTransceivers()
        .find((tx) => tx.sender === sender);
      if (transceiver) transceiver.direction = "sendonly";
    }

    this.setState("connecting");

    try {
      // Deliberately NOT passing offerToReceive* · broadcast is one-way.
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.signalling.sendOffer({ callId: this.callId, sdp: offer });
    } catch (e) {
      this.opts.handlers.onError?.(
        `broadcast-peer offer failed: ${(e as Error).message}`,
      );
      this.setState("failed");
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const live = this.state === "connecting" || this.state === "connected";
    if (live) {
      try {
        await this.signalling.sendBye({ callId: this.callId, reason: "hangup" });
      } catch {
        /* ignore · closing anyway */
      }
    }
    this.teardown("closed");
    await this.signalling.close();
  }

  private handleAnswer(s: SdpAnswerSignal): void {
    if (this.closed || !this.pc) return;
    if (s.callId !== this.callId) return;
    void (async () => {
      try {
        await this.pc!.setRemoteDescription(s.sdp);
        this.remoteDescriptionSet = true;
        await this.flushQueuedIce();
      } catch (e) {
        this.opts.handlers.onError?.(
          `broadcast-peer answer failed: ${(e as Error).message}`,
        );
        this.setState("failed");
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

  private buildPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // Broadcaster side never consumes a remote stream · ontrack is
    // intentionally omitted. Leaving it unassigned keeps the engine's
    // intent explicit for anyone grepping for ontrack handlers.
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.signalling.sendIce({
          callId: this.callId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected" && this.state !== "connected") {
        this.setState("connected");
      }
      if (s === "failed") {
        // Pilot: no auto-restart. Fire error + tear down · the
        // broadcast engine will drop the peer map entry when the
        // viewer leaves presence anyway.
        this.opts.handlers.onError?.("broadcast-peer connection failed");
        this.setState("failed");
        this.teardown("failed");
      }
      if (s === "closed" && this.state !== "closed") {
        this.setState("closed");
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

  private teardown(final: BroadcastPeerState): void {
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.remoteDescriptionSet = false;
    this.queuedIce = [];
    this.setState(final);
  }

  private setState(next: BroadcastPeerState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.handlers.onStateChange?.(next);
  }
}
