// src/lib/nex-native/webrtc/data-channel.ts
//
// Phase 2 Sprint 3 (DRAFT · not applied) · RTCDataChannel wrapper.
//
// Sends and receives OPAQUE BYTES over an already-established data channel.
// Payloads are ciphertext produced by the crypto layer (Sprint 4). This
// module does not know about plaintext message content. I-1 holds at this
// layer by contract: callers only pass ciphertext.
//
// Chunking is the responsibility of attachment-encoder (Sprint 6) · this
// module operates on single payloads.

"use client";

export interface DataChannelEvents {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (payload: Uint8Array) => void;
  onBufferLow?: () => void;
}

export interface SendOptions {
  /** Max ms to wait for `bufferedAmount` to fall before throwing. Defaults 30s. */
  bufferWaitTimeoutMs?: number;
}

/** Threshold at which we stop pushing + wait for buffer to drain. */
const BACKPRESSURE_THRESHOLD = 1_000_000; // 1 MB

/**
 * NEX data channel · thin wrapper that converts Node-y Uint8Array callers
 * into the browser-native ArrayBuffer transport and enforces backpressure.
 */
export class NexDataChannel {
  private readonly channel: RTCDataChannel;
  private readonly events: DataChannelEvents;
  private closed = false;

  constructor(channel: RTCDataChannel, events: DataChannelEvents = {}) {
    this.channel = channel;
    this.events = events;

    // Prefer ArrayBuffer over Blob for deterministic Uint8Array decoding.
    this.channel.binaryType = "arraybuffer";
    // Backpressure signal · low-water-mark is quarter the threshold.
    this.channel.bufferedAmountLowThreshold = BACKPRESSURE_THRESHOLD / 4;

    this.channel.addEventListener("open", () => events.onOpen?.());
    this.channel.addEventListener("close", () => {
      this.closed = true;
      events.onClose?.();
    });
    this.channel.addEventListener("error", (event) => {
      const err = event instanceof Error
        ? event
        : new Error(`DataChannel error · ${(event as RTCErrorEvent)?.error?.message ?? "unknown"}`);
      events.onError?.(err);
    });
    this.channel.addEventListener("message", (event) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) {
        events.onMessage?.(new Uint8Array(data));
      } else if (typeof data === "string") {
        events.onMessage?.(new TextEncoder().encode(data));
      }
    });
    this.channel.addEventListener("bufferedamountlow", () =>
      events.onBufferLow?.(),
    );
  }

  /** Send ciphertext bytes. Enforces backpressure · may wait. */
  async send(payload: Uint8Array, options: SendOptions = {}): Promise<void> {
    this.ensureOpen();
    await this.waitForBuffer(options.bufferWaitTimeoutMs ?? 30_000);
    // Browsers accept ArrayBuffer | ArrayBufferView | string | Blob.
    this.channel.send(payload);
  }

  getBufferedAmount(): number {
    return this.channel.bufferedAmount;
  }

  isOpen(): boolean {
    return !this.closed && this.channel.readyState === "open";
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.channel.close();
    } catch {
      // Swallow.
    }
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error("NexDataChannel · closed");
    if (this.channel.readyState !== "open") {
      throw new Error(`NexDataChannel · readyState is ${this.channel.readyState}`);
    }
  }

  private async waitForBuffer(timeoutMs: number): Promise<void> {
    if (this.channel.bufferedAmount < BACKPRESSURE_THRESHOLD) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.channel.removeEventListener("bufferedamountlow", onLow);
        reject(new Error("NexDataChannel · backpressure timeout"));
      }, timeoutMs);
      const onLow = () => {
        clearTimeout(timer);
        this.channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      this.channel.addEventListener("bufferedamountlow", onLow);
    });
  }
}
