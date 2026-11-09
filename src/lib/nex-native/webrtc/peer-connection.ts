// src/lib/nex-native/webrtc/peer-connection.ts
//
// Phase 2 Sprint 3 (DRAFT · not applied) · WebRTC RTCPeerConnection wrapper.
//
// Sealed-invariant context:
//   · I-1 · This wrapper never touches message content. SDP + ICE
//     candidates + public-key material only. The data channel transports
//     ciphertext · the encryption happens one layer up (Sprint 4).
//   · I-2 · If direct peer-to-peer or TURN-relay establishment fails,
//     delivery FAILS · caller sees honest failure status · no server queue.
//
// TURN provider · D-5 dependency:
//   This file accepts an iceServers array via the config argument. The
//   factory that PRODUCES those iceServers (fetching short-TTL TURN
//   credentials from the sealed provider's API) lives in a sibling file
//   `src/lib/nex-native/turn/credential-issuer.ts` which does NOT yet
//   exist. When D-5 is sealed, that file lands. This module is otherwise
//   TURN-provider-agnostic.
//
// Draft status · code can be reviewed · not wired to any route in this
// commit. Phase D Sprint 3 remains unauthorised for sandbox apply.

"use client";

export interface SignallingPair {
  /** Local device identifier · published to nex_device registry. */
  localDeviceId: string;
  /** Peer device identifier · the recipient's registered device. */
  remoteDeviceId: string;
}

export interface PeerConnectionConfig extends SignallingPair {
  /** TURN/STUN iceServers · Sprint 2 credential issuer supplies these. */
  iceServers: RTCIceServer[];
  /** When true · WebRTC will only consider relay candidates · forces TURN. */
  iceTransportPolicy?: RTCIceTransportPolicy;
  /** Max ms to wait for ICE connection before giving up · defaults 15s. */
  iceGatheringTimeoutMs?: number;
}

export type PeerConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface PeerConnectionEvents {
  onStateChange?: (state: PeerConnectionState) => void;
  onLocalDescription?: (description: RTCSessionDescriptionInit) => void;
  onLocalIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onError?: (error: Error) => void;
}

/**
 * NEX peer connection · thin wrapper around RTCPeerConnection.
 *
 * Responsibilities:
 *   · Create an offer OR accept an offer and create an answer
 *   · Trickle ICE candidates via the signalling-envelope service
 *   · Expose connection-state transitions to the caller
 *   · Close cleanly
 *
 * Non-responsibilities (deliberately):
 *   · Does NOT send signalling envelopes · caller forwards onLocalDescription
 *     and onLocalIceCandidate outputs to the envelope-service
 *   · Does NOT create data channels directly · see data-channel.ts
 *   · Does NOT encrypt payloads · see crypto layer (Sprint 4)
 */
export class NexPeerConnection {
  private readonly pc: RTCPeerConnection;
  private state: PeerConnectionState = "new";
  private readonly events: PeerConnectionEvents;
  private readonly config: PeerConnectionConfig;
  private closed = false;

  constructor(config: PeerConnectionConfig, events: PeerConnectionEvents = {}) {
    this.config = config;
    this.events = events;
    this.pc = new RTCPeerConnection({
      iceServers: config.iceServers,
      iceTransportPolicy: config.iceTransportPolicy ?? "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    this.pc.addEventListener("iceconnectionstatechange", () => {
      this.updateState();
    });
    this.pc.addEventListener("connectionstatechange", () => {
      this.updateState();
    });
    this.pc.addEventListener("icecandidate", (event) => {
      if (event.candidate && this.events.onLocalIceCandidate) {
        // Trickle each candidate up to the caller · caller posts it to the
        // signalling-envelope service.
        this.events.onLocalIceCandidate(event.candidate.toJSON());
      }
    });
    this.pc.addEventListener("datachannel", (event) => {
      this.events.onDataChannel?.(event.channel);
    });
  }

  /** Create an SDP offer. Call this on the INITIATING device. */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.ensureOpen();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.setState("connecting");
    this.events.onLocalDescription?.(offer);
    return offer;
  }

  /** Accept a remote SDP offer AND create an answer. Call on RECEIVER. */
  async acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.ensureOpen();
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.setState("connecting");
    this.events.onLocalDescription?.(answer);
    return answer;
  }

  /** Accept the answer from the receiver. Call on INITIATOR. */
  async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    this.ensureOpen();
    await this.pc.setRemoteDescription(answer);
  }

  /** Add an ICE candidate received from the remote peer. */
  async addRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    this.ensureOpen();
    await this.pc.addIceCandidate(candidate);
  }

  /** Create an outbound data channel. See data-channel.ts for the wrapper. */
  createOutboundDataChannel(
    label: string,
    options?: RTCDataChannelInit,
  ): RTCDataChannel {
    this.ensureOpen();
    return this.pc.createDataChannel(label, {
      ordered: true,
      ...options,
    });
  }

  getState(): PeerConnectionState {
    return this.state;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.pc.close();
    } catch {
      // Swallow · best-effort close.
    }
    this.setState("closed");
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error("NexPeerConnection · closed");
  }

  private updateState(): void {
    const s = this.pc.connectionState;
    if (s === "new") this.setState("new");
    else if (s === "connecting") this.setState("connecting");
    else if (s === "connected") this.setState("connected");
    else if (s === "disconnected") this.setState("disconnected");
    else if (s === "failed") this.setState("failed");
    else if (s === "closed") this.setState("closed");
  }

  private setState(next: PeerConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.events.onStateChange?.(next);
  }
}

/**
 * Return the local + remote device IDs encoded in the connection config.
 * Pure helper used by the signalling envelope service to address envelopes.
 */
export function signallingPairFrom(config: PeerConnectionConfig): SignallingPair {
  return {
    localDeviceId: config.localDeviceId,
    remoteDeviceId: config.remoteDeviceId,
  };
}
