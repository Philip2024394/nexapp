// src/lib/nex-native/status-p2p/serve.ts
//
// NEX Status · owner-side service.
//
// Listens on the owner's service channel for viewer requests, opens a
// per-viewer pairwise WebRTC data channel (via existing signalling
// primitive), and streams the status Blob + metadata.
//
// Architecture:
//   · Service channel · `nex:status-serve:{ownerAccountId}` · owner
//     broadcasts here are not used · it is a request-funnel. Viewers
//     broadcast `status-list-request` and `status-request` events;
//     owner responds via pairwise signalling, NOT by broadcasting
//     on the service channel.
//   · Pairwise · `openSignallingChannel` with conversation id
//     `status:{ownerAccountId}:{viewerAccountId}`. Owner is always the
//     offerer here · the viewer is the answerer. This mirrors
//     broadcast-peer.ts (deterministic initiation, asymmetric role).
//   · Data channel · all status payloads flow on an RTCDataChannel
//     opened by the owner.
//
// Honest limits:
//   · STUN only · same ICE set as live-broadcast · Phase 2 TURN note
//     applies here too (Indonesian CGNAT).
//   · Owner must be online · when the owner goes offline the viewer
//     sees presence drop AND any in-flight data channel closes.
//   · No resume · if a chunk is dropped mid-transfer the viewer
//     reports "fetch failed" and tears down.
//   · One concurrent fetch per (owner, viewer) · a second
//     `status-request` while the previous is in flight overwrites the
//     tracking state. Future UI only ever has one request pending.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";
import { openSignallingChannel, type SignallingChannel } from "../realtime/signalling";
import { listMyStatuses, getStatus } from "../status-storage/store";
import type { StoredStatus } from "../status-storage/types";
import {
  encodeChunkFrame,
  STATUS_P2P_CHUNK_BYTES,
  type StatusListItem,
} from "./types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export interface StatusServeHostHandlers {
  onError?: (msg: string) => void;
  onSubscribed?: () => void;
  /** Fires when a viewer connects to this host and asks for the list. */
  onViewerConnected?: (viewerAccountId: string) => void;
  /** Fires when a viewer's pairwise connection tears down. */
  onViewerDisconnected?: (viewerAccountId: string) => void;
}

export interface StatusServeHostOptions {
  ownerAccountId: string;
  handlers?: StatusServeHostHandlers;
}

export function statusServeConversationId(
  ownerAccountId: string,
  viewerAccountId: string,
): string {
  return `status:${ownerAccountId}:${viewerAccountId}`;
}

export function statusServeChannelName(ownerAccountId: string): string {
  return `nex:status-serve:${ownerAccountId}`;
}

/**
 * Internal per-viewer state. We keep one of these per viewer that has
 * opened a conversation with us. The lifetime is bounded by the
 * viewer's presence / signalling channel · tearing down the signalling
 * channel also fires the RTCPeerConnection's close.
 */
interface ViewerSession {
  viewerAccountId: string;
  signalling: SignallingChannel;
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  callId: string;
  remoteDescriptionSet: boolean;
  queuedIce: RTCIceCandidateInit[];
}

export class StatusServeHost {
  private serviceChannel: NexChannelHandle | null = null;
  private readonly sessions = new Map<string, ViewerSession>();
  private started = false;
  private closed = false;

  constructor(private readonly opts: StatusServeHostOptions) {}

  async start(): Promise<void> {
    if (this.started || this.closed) return;
    this.started = true;

    const handlers = this.opts.handlers ?? {};
    this.serviceChannel = openNexChannel({
      name: statusServeChannelName(this.opts.ownerAccountId),
      selfId: this.opts.ownerAccountId,
      onSubscribed: handlers.onSubscribed,
      onError: (e) =>
        handlers.onError?.(`status-serve service channel error: ${e}`),
      onBroadcast: (event, envelope) => {
        void this.handleServiceEvent(event, envelope.sender, envelope.payload);
      },
    });
  }

  /**
   * Idempotent cleanup · closes every per-viewer session and the
   * service channel.
   */
  async stop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.started = false;

    for (const [, s] of this.sessions.entries()) {
      await this.teardownSession(s);
    }
    this.sessions.clear();

    if (this.serviceChannel) {
      try {
        await this.serviceChannel.close();
      } catch {
        /* ignore */
      }
      this.serviceChannel = null;
    }
  }

  private async handleServiceEvent(
    event: string,
    senderId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.closed) return;

    // Minimum shape validation.
    const type =
      (payload && typeof payload === "object" && (payload as { type?: unknown }).type) ||
      event;
    if (typeof type !== "string") return;

    switch (type) {
      case "hello":
      case "status-list-request": {
        await this.ensureSession(senderId);
        await this.sendStatusList(senderId);
        return;
      }
      case "status-request": {
        const statusId = (payload as { statusId?: unknown }).statusId;
        if (typeof statusId !== "string" || statusId.length === 0) return;
        await this.ensureSession(senderId);
        await this.sendStatusBlob(senderId, statusId);
        return;
      }
      default:
        return;
    }
  }

  private async ensureSession(viewerAccountId: string): Promise<ViewerSession> {
    const existing = this.sessions.get(viewerAccountId);
    if (existing) return existing;

    const callId = statusServeConversationId(
      this.opts.ownerAccountId,
      viewerAccountId,
    );
    const session: ViewerSession = {
      viewerAccountId,
      callId,
      pc: null,
      dataChannel: null,
      remoteDescriptionSet: false,
      queuedIce: [],
      signalling: openSignallingChannel({
        conversationId: callId,
        selfAccountId: this.opts.ownerAccountId,
        handlers: {
          onAnswer: (s) => void this.handleAnswer(viewerAccountId, s.sdp),
          onIce: (s) => void this.handleIce(viewerAccountId, s.candidate),
          onBye: () => void this.handleViewerBye(viewerAccountId),
          onError: (e) =>
            this.opts.handlers?.onError?.(
              `status-serve signalling error for ${viewerAccountId}: ${e}`,
            ),
        },
      }),
    };

    // Build the RTCPeerConnection and the data channel immediately.
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    session.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void session.signalling.sendIce({
          callId: session.callId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") {
        void this.teardownSession(session);
      }
    };

    const dc = pc.createDataChannel("nex-status", { ordered: true });
    session.dataChannel = dc;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      this.opts.handlers?.onViewerConnected?.(viewerAccountId);
    };
    dc.onclose = () => {
      this.opts.handlers?.onViewerDisconnected?.(viewerAccountId);
    };

    this.sessions.set(viewerAccountId, session);

    // Create the offer. We do NOT await the ICE gathering · trickle ICE
    // over signalling handles that.
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await session.signalling.sendOffer({ callId: session.callId, sdp: offer });
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve offer failed for ${viewerAccountId}: ${(e as Error).message}`,
      );
      await this.teardownSession(session);
    }

    return session;
  }

  private async handleAnswer(
    viewerAccountId: string,
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    const session = this.sessions.get(viewerAccountId);
    if (!session || !session.pc) return;
    try {
      await session.pc.setRemoteDescription(sdp);
      session.remoteDescriptionSet = true;
      while (session.queuedIce.length > 0) {
        const c = session.queuedIce.shift()!;
        try {
          await session.pc.addIceCandidate(c);
        } catch {
          /* stale · ignore */
        }
      }
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve setRemoteDescription failed: ${(e as Error).message}`,
      );
      await this.teardownSession(session);
    }
  }

  private async handleIce(
    viewerAccountId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const session = this.sessions.get(viewerAccountId);
    if (!session || !session.pc) return;
    if (!session.remoteDescriptionSet) {
      session.queuedIce.push(candidate);
      return;
    }
    try {
      await session.pc.addIceCandidate(candidate);
    } catch {
      /* stale · ignore */
    }
  }

  private async handleViewerBye(viewerAccountId: string): Promise<void> {
    const session = this.sessions.get(viewerAccountId);
    if (!session) return;
    await this.teardownSession(session);
  }

  private async teardownSession(session: ViewerSession): Promise<void> {
    this.sessions.delete(session.viewerAccountId);
    try {
      session.dataChannel?.close();
    } catch {
      /* ignore */
    }
    try {
      session.pc?.close();
    } catch {
      /* ignore */
    }
    try {
      await session.signalling.close();
    } catch {
      /* ignore */
    }
    session.dataChannel = null;
    session.pc = null;
  }

  private async waitForDataChannel(session: ViewerSession): Promise<RTCDataChannel | null> {
    const dc = session.dataChannel;
    if (!dc) return null;
    if (dc.readyState === "open") return dc;
    if (dc.readyState === "closed" || dc.readyState === "closing") return null;
    return await new Promise<RTCDataChannel | null>((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 15_000);
      const onOpen = () => {
        cleanup();
        resolve(dc);
      };
      const onClose = () => {
        cleanup();
        resolve(null);
      };
      const cleanup = () => {
        clearTimeout(timer);
        dc.removeEventListener("open", onOpen);
        dc.removeEventListener("close", onClose);
      };
      dc.addEventListener("open", onOpen);
      dc.addEventListener("close", onClose);
    });
  }

  private async sendStatusList(viewerAccountId: string): Promise<void> {
    const session = this.sessions.get(viewerAccountId);
    if (!session) return;
    const dc = await this.waitForDataChannel(session);
    if (!dc) return;

    let rows: StoredStatus[] = [];
    try {
      rows = await listMyStatuses(this.opts.ownerAccountId);
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve listMyStatuses failed: ${(e as Error).message}`,
      );
      return;
    }

    const items: StatusListItem[] = rows.map((r) => ({
      statusId: r.id,
      kind: r.kind,
      overlays: r.overlays,
      postedAtMs: r.postedAtMs,
      expiresAtMs: r.expiresAtMs,
      mediaMimeType: r.mediaMimeType,
      mediaSizeBytes: r.mediaSizeBytes,
    }));
    try {
      dc.send(JSON.stringify({ type: "status-list-response", items }));
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve send list failed: ${(e as Error).message}`,
      );
    }
  }

  private async sendStatusBlob(viewerAccountId: string, statusId: string): Promise<void> {
    const session = this.sessions.get(viewerAccountId);
    if (!session) return;
    const dc = await this.waitForDataChannel(session);
    if (!dc) return;

    let row: StoredStatus | null = null;
    try {
      row = await getStatus(statusId);
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve getStatus failed: ${(e as Error).message}`,
      );
      return;
    }
    if (!row || row.ownerAccountId !== this.opts.ownerAccountId) return;
    if (row.expiresAtMs < Date.now()) return;

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await row.mediaBlob.arrayBuffer();
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve blob read failed: ${(e as Error).message}`,
      );
      return;
    }

    const totalChunks = Math.max(1, Math.ceil(arrayBuffer.byteLength / STATUS_P2P_CHUNK_BYTES));
    for (let i = 0; i < totalChunks; i++) {
      const start = i * STATUS_P2P_CHUNK_BYTES;
      const end = Math.min(arrayBuffer.byteLength, start + STATUS_P2P_CHUNK_BYTES);
      const chunk = arrayBuffer.slice(start, end);
      const frame = encodeChunkFrame(
        { type: "status-chunk", statusId, index: i, totalChunks },
        chunk,
      );
      try {
        dc.send(frame);
      } catch (e) {
        this.opts.handlers?.onError?.(
          `status-serve chunk send failed at ${i}/${totalChunks}: ${(e as Error).message}`,
        );
        return;
      }
      // Back-pressure · pause briefly if the SCTP buffer is deep so we
      // don't blow memory on large blobs. 1MB soft cap.
      if (dc.bufferedAmount > 1_000_000) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    }

    try {
      dc.send(JSON.stringify({ type: "status-end", statusId }));
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-serve end send failed: ${(e as Error).message}`,
      );
    }
  }
}
