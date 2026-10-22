// src/lib/nex-native/status-p2p/fetch-from-owner.ts
//
// NEX Status · viewer-side client that fetches an owner's status
// list + blobs over a pairwise WebRTC data channel.
//
// Flow:
//   1. connect() opens pairwise signalling with the owner, builds an
//      RTCPeerConnection with STUN, and asks the owner to open a data
//      channel by broadcasting `status-list-request` on the owner's
//      service channel (nex:status-serve:{ownerAccountId}). The owner
//      responds with an SDP offer; we answer.
//   2. On data channel open · we receive the `status-list-response`
//      JSON frame · fire `onStatusList`.
//   3. fetchStatus(statusId) · broadcasts `status-request` on the
//      service channel · owner streams back `status-chunk` frames
//      (ArrayBuffer) terminated by `status-end` (JSON). We reassemble
//      and fire `onStatusBlob`.
//   4. close() tears down the data channel + RTCPeerConnection +
//      signalling + service channel.
//
// State machine:
//   idle → connecting → listing → ready
//     listing (while waiting for list)
//     fetching (while a blob is in flight)
//   offline (owner never responded within deadline)
//   ended   (fatal / local close)

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";
import {
  openSignallingChannel,
  type SignallingChannel,
} from "../realtime/signalling";
import type { StatusOverlay } from "../status-storage/types";
import {
  decodeChunkFrame,
  type StatusListItem,
} from "./types";
import {
  statusServeChannelName,
  statusServeConversationId,
} from "./serve";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const WAIT_FOR_OWNER_MS = 10_000;

export type StatusFetchState =
  | "idle"
  | "connecting"
  | "listing"
  | "fetching"
  | "ready"
  | "offline"
  | "ended";

export interface StatusFetchClientHandlers {
  onStatusList?: (items: StatusListItem[]) => void;
  onStatusBlob?: (
    statusId: string,
    blob: Blob,
    overlays: StatusOverlay[],
    kind: "image" | "video",
  ) => void;
  onError?: (msg: string) => void;
  onStateChange?: (state: StatusFetchState) => void;
}

export interface StatusFetchClientOptions {
  ownerAccountId: string;
  viewerAccountId: string;
  handlers?: StatusFetchClientHandlers;
}

interface InFlightBlob {
  statusId: string;
  totalChunks: number;
  chunks: Array<ArrayBuffer | null>;
  received: number;
  mimeType: string;
  overlays: StatusOverlay[];
  kind: "image" | "video";
}

export class StatusFetchClient {
  private state: StatusFetchState = "idle";
  private serviceChannel: NexChannelHandle | null = null;
  private signalling: SignallingChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private remoteDescriptionSet = false;
  private queuedIce: RTCIceCandidateInit[] = [];
  private callId: string;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private items: StatusListItem[] = [];
  private inFlight: InFlightBlob | null = null;

  constructor(private readonly opts: StatusFetchClientOptions) {
    this.callId = statusServeConversationId(
      opts.ownerAccountId,
      opts.viewerAccountId,
    );
  }

  getState(): StatusFetchState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state !== "idle" || this.closed) return;
    this.setState("connecting");

    const handlers = this.opts.handlers ?? {};

    // 1. Open pairwise signalling · owner-side will send us an offer
    //    once it receives our `status-list-request` on the service
    //    channel. We don't send a sdp-offer from this side.
    this.signalling = openSignallingChannel({
      conversationId: this.callId,
      selfAccountId: this.opts.viewerAccountId,
      handlers: {
        onOffer: (s) => void this.handleOffer(s.sdp),
        onIce: (s) => void this.handleIce(s.candidate),
        onBye: () => this.terminate("ended"),
        onError: (e) => handlers.onError?.(`status-fetch signalling error: ${e}`),
      },
    });

    // 2. Open the owner's service channel so we can broadcast the list
    //    request. We ignore any broadcast we receive on it · the owner
    //    responds via pairwise signalling + data channel.
    this.serviceChannel = openNexChannel({
      name: statusServeChannelName(this.opts.ownerAccountId),
      selfId: this.opts.viewerAccountId,
      onError: (e) =>
        handlers.onError?.(`status-fetch service channel error: ${e}`),
    });

    // 3. Arm the "owner never responded" deadline. Cleared when the
    //    data channel opens.
    this.waitTimer = setTimeout(() => {
      if (this.closed) return;
      if (this.state === "connecting" || this.state === "listing") {
        this.terminate("offline");
      }
    }, WAIT_FOR_OWNER_MS);

    // 4. Nudge the owner. The owner's StatusServeHost listens for
    //    `status-list-request` on this channel and opens a pairwise
    //    data channel.
    try {
      await this.serviceChannel.broadcast("status-list-request", {
        type: "status-list-request",
      });
      this.setState("listing");
    } catch (e) {
      handlers.onError?.(
        `status-fetch failed to broadcast list request: ${(e as Error).message}`,
      );
      this.terminate("ended");
    }
  }

  /**
   * Request a specific status blob · owner will stream chunks back on
   * the pairwise data channel. Caller receives the Blob via
   * `onStatusBlob`.
   */
  async fetchStatus(statusId: string): Promise<void> {
    if (this.closed) return;
    if (this.state !== "ready" && this.state !== "listing") {
      this.opts.handlers?.onError?.(
        `status-fetch cannot fetch in state ${this.state}`,
      );
      return;
    }
    const item = this.items.find((i) => i.statusId === statusId);
    if (!item) {
      this.opts.handlers?.onError?.(
        `status-fetch unknown statusId: ${statusId}`,
      );
      return;
    }
    this.inFlight = {
      statusId,
      totalChunks: 0,
      chunks: [],
      received: 0,
      mimeType: item.mediaMimeType,
      overlays: item.overlays,
      kind: item.kind,
    };
    this.setState("fetching");
    if (!this.serviceChannel) return;
    try {
      await this.serviceChannel.broadcast("status-request", {
        type: "status-request",
        statusId,
      });
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-fetch broadcast failed: ${(e as Error).message}`,
      );
      this.inFlight = null;
      this.setState("ready");
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.terminate("ended");
  }

  // ─────────────────────────────── internals ───────────────────────────

  private async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    if (!this.pc) {
      this.pc = this.buildPc();
    }
    try {
      await this.pc.setRemoteDescription(sdp);
      this.remoteDescriptionSet = true;
      while (this.queuedIce.length > 0) {
        const c = this.queuedIce.shift()!;
        try {
          await this.pc.addIceCandidate(c);
        } catch {
          /* stale · ignore */
        }
      }
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (this.signalling) {
        await this.signalling.sendAnswer({ callId: this.callId, sdp: answer });
      }
    } catch (e) {
      this.opts.handlers?.onError?.(
        `status-fetch answer failed: ${(e as Error).message}`,
      );
      this.terminate("ended");
    }
  }

  private async handleIce(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    if (!this.remoteDescriptionSet) {
      this.queuedIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* stale · ignore */
    }
  }

  private buildPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && this.signalling) {
        void this.signalling.sendIce({
          callId: this.callId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") {
        this.terminate("ended");
      }
    };
    pc.ondatachannel = (e) => {
      this.attachDataChannel(e.channel);
    };
    return pc;
  }

  private attachDataChannel(dc: RTCDataChannel): void {
    this.dataChannel = dc;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      if (this.waitTimer !== null) {
        clearTimeout(this.waitTimer);
        this.waitTimer = null;
      }
      // Already in "listing" from the broadcast. Nothing else to do.
    };
    dc.onclose = () => {
      // When the owner's side goes away, we fall into ended.
      if (!this.closed) this.terminate("ended");
    };
    dc.onmessage = (e) => this.handleDataMessage(e.data);
  }

  /**
   * Exposed for tests · drives the chunk/list dispatch directly
   * without exercising the signalling or RTCPeerConnection layer.
   */
  public __handleIncomingForTest(data: unknown): void {
    this.handleDataMessage(data);
  }

  private handleDataMessage(data: unknown): void {
    if (this.closed) return;

    if (typeof data === "string") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const { type } = parsed as { type?: unknown };
      if (type === "status-list-response") {
        const items = (parsed as { items?: unknown }).items;
        if (!Array.isArray(items)) return;
        this.items = items.filter((i): i is StatusListItem => this.isValidListItem(i));
        this.opts.handlers?.onStatusList?.(this.items);
        if (this.state === "listing" || this.state === "connecting") {
          this.setState("ready");
        }
        return;
      }
      if (type === "status-end") {
        this.handleStatusEnd((parsed as { statusId?: unknown }).statusId);
        return;
      }
      return;
    }

    // Binary · a status-chunk frame.
    let buffer: ArrayBuffer | null = null;
    if (data instanceof ArrayBuffer) buffer = data;
    else if (data instanceof Uint8Array) {
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(data);
      buffer = bytes.buffer;
    } else if (
      typeof Blob !== "undefined" &&
      data instanceof Blob
    ) {
      void data.arrayBuffer().then((buf) => this.handleDataMessage(buf));
      return;
    }
    if (!buffer) return;

    const decoded = decodeChunkFrame(buffer);
    if (!decoded) return;
    this.handleChunk(decoded.header.statusId, decoded.header.index, decoded.header.totalChunks, decoded.chunk);
  }

  private handleChunk(
    statusId: string,
    index: number,
    totalChunks: number,
    chunk: ArrayBuffer,
  ): void {
    const inFlight = this.inFlight;
    if (!inFlight || inFlight.statusId !== statusId) return;

    if (inFlight.chunks.length === 0) {
      inFlight.totalChunks = totalChunks;
      inFlight.chunks = new Array(totalChunks).fill(null);
    }
    if (index < 0 || index >= inFlight.totalChunks) return;
    if (inFlight.chunks[index] !== null) return;

    inFlight.chunks[index] = chunk;
    inFlight.received += 1;

    if (inFlight.received === inFlight.totalChunks) {
      // Finalise even if the end frame has not yet arrived · the end
      // frame is a belt-and-braces signal from the owner.
      this.finaliseInFlight();
    }
  }

  private handleStatusEnd(statusId: unknown): void {
    if (typeof statusId !== "string") return;
    const inFlight = this.inFlight;
    if (!inFlight || inFlight.statusId !== statusId) return;
    this.finaliseInFlight();
  }

  private finaliseInFlight(): void {
    const inFlight = this.inFlight;
    if (!inFlight) return;
    if (
      inFlight.received !== inFlight.totalChunks ||
      inFlight.chunks.some((c) => c === null)
    ) {
      this.opts.handlers?.onError?.(
        `status-fetch missing chunks for ${inFlight.statusId}`,
      );
      this.inFlight = null;
      if (this.state === "fetching") this.setState("ready");
      return;
    }
    const parts: BlobPart[] = inFlight.chunks.map((c) => c as ArrayBuffer);
    const blob = new Blob(parts, { type: inFlight.mimeType });
    this.opts.handlers?.onStatusBlob?.(
      inFlight.statusId,
      blob,
      inFlight.overlays,
      inFlight.kind,
    );
    this.inFlight = null;
    if (this.state === "fetching") this.setState("ready");
  }

  private isValidListItem(x: unknown): x is StatusListItem {
    if (!x || typeof x !== "object") return false;
    const r = x as Record<string, unknown>;
    return (
      typeof r.statusId === "string" &&
      (r.kind === "image" || r.kind === "video") &&
      Array.isArray(r.overlays) &&
      typeof r.postedAtMs === "number" &&
      typeof r.expiresAtMs === "number" &&
      typeof r.mediaMimeType === "string" &&
      typeof r.mediaSizeBytes === "number"
    );
  }

  private terminate(final: StatusFetchState): void {
    if (this.closed) return;
    this.closed = true;
    if (this.waitTimer !== null) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    try {
      this.dataChannel?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.dataChannel = null;
    this.pc = null;
    this.remoteDescriptionSet = false;
    this.queuedIce = [];
    this.inFlight = null;

    const sig = this.signalling;
    const svc = this.serviceChannel;
    this.signalling = null;
    this.serviceChannel = null;

    if (sig) {
      void sig.close().catch(() => {
        /* ignore */
      });
    }
    if (svc) {
      void svc.close().catch(() => {
        /* ignore */
      });
    }
    this.setState(final);
  }

  private setState(next: StatusFetchState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.handlers?.onStateChange?.(next);
  }
}
