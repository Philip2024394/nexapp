// src/lib/nex-native/webrtc/__tests__/peer-connection.test.ts
//
// Phase 2 Sprint 3 (DRAFT) · structural tests for the WebRTC wrappers.
//
// Full WebRTC round-trip testing requires a browser · covered by Phase E
// journey J-1 integration test. Here we test the SURFACE of the wrapper
// and the DEFAULTS it applies, so we can refactor the wrapper with
// confidence that the shape doesn't drift.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Minimal RTCPeerConnection + RTCDataChannel mocks. Real browser APIs
// are intentionally not polyfilled · we assert on construction args and
// event-wiring, not on actual WebRTC negotiation.

class FakeRTCPeerConnection {
  static lastConstructionConfig: RTCConfiguration | undefined;
  readonly eventListeners = new Map<string, Array<(ev: unknown) => void>>();
  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  constructor(config: RTCConfiguration) {
    FakeRTCPeerConnection.lastConstructionConfig = config;
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    const list = this.eventListeners.get(type) ?? [];
    list.push(listener);
    this.eventListeners.set(type, list);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    const list = this.eventListeners.get(type) ?? [];
    this.eventListeners.set(type, list.filter((l) => l !== listener));
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "v=0\r\n(fake offer)" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "v=0\r\n(fake answer)" };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = desc;
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit): Promise<void> {
    // no-op
  }

  createDataChannel(label: string, init?: RTCDataChannelInit): RTCDataChannel {
    return { label, ...(init ?? {}) } as unknown as RTCDataChannel;
  }

  close(): void {
    this.connectionState = "closed";
  }
}

beforeEach(() => {
  (globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection =
    FakeRTCPeerConnection;
  FakeRTCPeerConnection.lastConstructionConfig = undefined;
});

afterEach(() => {
  delete (globalThis as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection;
});

// Import AFTER globalThis is set so the wrapper picks up our fake.
const { NexPeerConnection, signallingPairFrom } = await import("../peer-connection");

const CONFIG = {
  localDeviceId: "11111111-1111-4111-8111-111111111111",
  remoteDeviceId: "22222222-2222-4222-8222-222222222222",
  iceServers: [{ urls: "stun:stun.example.com:3478" }],
};

describe("NexPeerConnection · construction", () => {
  it("passes iceServers through to RTCPeerConnection", () => {
    new NexPeerConnection(CONFIG);
    expect(FakeRTCPeerConnection.lastConstructionConfig?.iceServers).toEqual(
      CONFIG.iceServers,
    );
  });

  it("defaults iceTransportPolicy to 'all'", () => {
    new NexPeerConnection(CONFIG);
    expect(FakeRTCPeerConnection.lastConstructionConfig?.iceTransportPolicy).toBe("all");
  });

  it("applies bundlePolicy=max-bundle and rtcpMuxPolicy=require", () => {
    new NexPeerConnection(CONFIG);
    const c = FakeRTCPeerConnection.lastConstructionConfig;
    expect(c?.bundlePolicy).toBe("max-bundle");
    expect(c?.rtcpMuxPolicy).toBe("require");
  });

  it("accepts iceTransportPolicy=relay override (forces TURN)", () => {
    new NexPeerConnection({ ...CONFIG, iceTransportPolicy: "relay" });
    expect(FakeRTCPeerConnection.lastConstructionConfig?.iceTransportPolicy).toBe("relay");
  });
});

describe("NexPeerConnection · negotiation surface", () => {
  it("createOffer sets local description + reports it via onLocalDescription", async () => {
    const onLocalDescription = vi.fn();
    const pc = new NexPeerConnection(CONFIG, { onLocalDescription });
    const offer = await pc.createOffer();
    expect(offer.type).toBe("offer");
    expect(onLocalDescription).toHaveBeenCalledWith(offer);
    expect(pc.getState()).toBe("connecting");
  });

  it("acceptOffer accepts remote and creates answer", async () => {
    const pc = new NexPeerConnection(CONFIG);
    const answer = await pc.acceptOffer({ type: "offer", sdp: "v=0\r\n(remote)" });
    expect(answer.type).toBe("answer");
    expect(pc.getState()).toBe("connecting");
  });

  it("acceptAnswer sets remote description", async () => {
    const pc = new NexPeerConnection(CONFIG);
    await expect(pc.acceptAnswer({ type: "answer", sdp: "v=0\r\n(remote answer)" })).resolves.toBeUndefined();
  });

  it("addRemoteIceCandidate forwards to RTCPeerConnection", async () => {
    const pc = new NexPeerConnection(CONFIG);
    await expect(pc.addRemoteIceCandidate({ candidate: "a=foo", sdpMid: "0" })).resolves.toBeUndefined();
  });

  it("createOutboundDataChannel defaults ordered=true", () => {
    const pc = new NexPeerConnection(CONFIG);
    const dc = pc.createOutboundDataChannel("nex-chat");
    expect((dc as unknown as { label: string }).label).toBe("nex-chat");
    expect((dc as unknown as { ordered: boolean }).ordered).toBe(true);
  });

  it("close transitions state to closed and refuses further operations", () => {
    const pc = new NexPeerConnection(CONFIG);
    pc.close();
    expect(pc.getState()).toBe("closed");
    expect(() => pc.createOutboundDataChannel("nex")).toThrow(/closed/);
  });
});

describe("signallingPairFrom", () => {
  it("returns local + remote device IDs", () => {
    const pair = signallingPairFrom(CONFIG);
    expect(pair).toEqual({
      localDeviceId: CONFIG.localDeviceId,
      remoteDeviceId: CONFIG.remoteDeviceId,
    });
  });
});
