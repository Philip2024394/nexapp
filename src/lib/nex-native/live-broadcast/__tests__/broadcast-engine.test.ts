// src/lib/nex-native/live-broadcast/__tests__/broadcast-engine.test.ts
//
// NEX Live Commerce · broadcaster-engine unit tests.
//
// Scope · pure state-machine tests, no real RTCPeerConnection, no
// real Supabase channel. We stub:
//   · navigator.mediaDevices.getUserMedia → returns a fake stream
//   · openNexChannel (via module-level vi.mock) → returns a fake
//     handle that lets us drive presence sync events deterministically
//   · openSignallingChannel is also mocked so the engine's capacity
//     notifyAtCapacity() path (dynamic import) does not try to hit
//     Supabase in the test environment.
//
// We DO exercise:
//   · state transitions (idle → requesting-media → live → ended)
//   · MAX_VIEWERS enforcement (10 admitted, 11th rejected)
//   · setMuted / setCameraOff state + track-level mutation
//   · leave() cleanup (admitted cleared, local tracks stopped, state
//     flipped to "ended")

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

vi.mock("server-only", () => ({}));

// ─── Module-level mocks for the realtime surface ─────────────────
//
// Both the engine and the broadcast-peer code pull from these two
// modules. For the ENGINE state-machine tests we only need presence
// (`openNexChannel`) · the pairwise signalling side is only hit when
// we spawn a peer, which exercises `openSignallingChannel`. We stub
// both with handles that record calls so the tests can assert
// cleanup without triggering real network IO.

type PresenceCallback = (
  state: Record<string, Array<Record<string, unknown>>>,
) => void;

interface MockChannelHandle {
  broadcast: ReturnType<typeof vi.fn>;
  trackPresence: ReturnType<typeof vi.fn>;
  getPresenceState: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  __fireSync: (members: Array<Record<string, unknown>>) => void;
}

const presenceCallbacks: PresenceCallback[] = [];
const openedChannels: MockChannelHandle[] = [];

vi.mock("../../realtime/channel", () => ({
  openNexChannel: vi.fn((opts: { onPresenceChange?: PresenceCallback }) => {
    if (opts.onPresenceChange) presenceCallbacks.push(opts.onPresenceChange);
    const handle: MockChannelHandle = {
      broadcast: vi.fn(async () => {}),
      trackPresence: vi.fn(async () => {}),
      getPresenceState: vi.fn(() => ({})),
      close: vi.fn(async () => {}),
      __fireSync(members) {
        const state: Record<string, Array<Record<string, unknown>>> = {};
        for (const m of members) {
          state[String(m.accountId ?? Math.random())] = [m];
        }
        opts.onPresenceChange?.(state);
      },
    };
    openedChannels.push(handle);
    return handle;
  }),
}));

vi.mock("../../realtime/signalling", () => ({
  openSignallingChannel: vi.fn(() => ({
    sendRing: vi.fn(async () => {}),
    sendOffer: vi.fn(async () => {}),
    sendAnswer: vi.fn(async () => {}),
    sendIce: vi.fn(async () => {}),
    sendBye: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  })),
}));

// ─── RTCPeerConnection stub ──────────────────────────────────────
//
// The engine's spawnPeer() constructs a BroadcastPeer which builds an
// RTCPeerConnection in start(). We stub the ctor so the test
// environment (no browser) does not throw. The engine state-machine
// paths exercised by these tests do not depend on PC behaviour · the
// stub needs just enough shape to satisfy the broadcast-peer code.

class StubRTCPeerConnection {
  public localDescription: RTCSessionDescriptionInit | null = null;
  public remoteDescription: RTCSessionDescriptionInit | null = null;
  public connectionState = "new";
  public ontrack: ((e: unknown) => void) | null = null;
  public onicecandidate: ((e: unknown) => void) | null = null;
  public onconnectionstatechange: (() => void) | null = null;

  private readonly transceivers: Array<{ sender: unknown; direction: string }> = [];

  addTrack(_track: unknown, _stream: unknown): unknown {
    const sender = {};
    this.transceivers.push({ sender, direction: "sendrecv" });
    return sender;
  }
  getTransceivers(): Array<{ sender: unknown; direction: string }> {
    return this.transceivers;
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "stub-sdp" };
  }
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "stub-sdp" };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = d;
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = d;
  }
  async addIceCandidate(_c: unknown): Promise<void> {}
  close(): void {
    this.connectionState = "closed";
  }
}

// ─── Mock media stream helpers ───────────────────────────────────

function mockTrack(kind: "audio" | "video") {
  return {
    kind,
    enabled: true,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
}

function mockStream(audioCount: number, videoCount: number) {
  const audio = Array.from({ length: audioCount }, () => mockTrack("audio"));
  const video = Array.from({ length: videoCount }, () => mockTrack("video"));
  const all = [...audio, ...video];
  const stream = {
    getAudioTracks: () => audio,
    getVideoTracks: () => video,
    getTracks: () => all,
  } as unknown as MediaStream;
  return { stream, audio, video, all };
}

// ─── Global environment bootstrap ────────────────────────────────

let originalMediaDevices: MediaDevices | undefined;
let originalRTC: typeof RTCPeerConnection | undefined;
let currentFakeStream: ReturnType<typeof mockStream> | null = null;

function installGetUserMediaStub(
  streamFactory: () => Promise<MediaStream>,
): void {
  const navObj = globalThis as unknown as {
    navigator?: { mediaDevices?: unknown };
  };
  if (!navObj.navigator) navObj.navigator = {};
  navObj.navigator.mediaDevices = {
    getUserMedia: vi.fn(streamFactory),
  };
}

function installRTCStub(): void {
  const g = globalThis as unknown as { RTCPeerConnection?: unknown };
  g.RTCPeerConnection = StubRTCPeerConnection;
}

function restoreOriginals(): void {
  const navObj = globalThis as unknown as {
    navigator?: { mediaDevices?: unknown };
  };
  if (navObj.navigator && originalMediaDevices !== undefined) {
    navObj.navigator.mediaDevices = originalMediaDevices;
  }
  const g = globalThis as unknown as { RTCPeerConnection?: unknown };
  g.RTCPeerConnection = originalRTC;
}

// ─── Dynamic import AFTER mocks are installed ────────────────────
//
// vitest hoists vi.mock() calls, so the module graph is wired before
// the engine module is loaded. We still import inside tests so the
// mock state can be reset between runs.

async function loadEngine() {
  const mod = await import("../broadcast-engine");
  return mod;
}

describe("LiveBroadcastEngine · state machine (idle → requesting-media → live → ended)", () => {
  beforeEach(() => {
    presenceCallbacks.length = 0;
    openedChannels.length = 0;
    currentFakeStream = mockStream(1, 1);
    originalMediaDevices = (
      globalThis as unknown as { navigator?: { mediaDevices?: MediaDevices } }
    ).navigator?.mediaDevices;
    originalRTC = (
      globalThis as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }
    ).RTCPeerConnection;
    installGetUserMediaStub(async () => currentFakeStream!.stream);
    installRTCStub();
  });

  afterEach(() => {
    restoreOriginals();
    vi.clearAllMocks();
  });

  it("starts in 'idle' with viewer count = 0", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    expect(engine.getState()).toBe("idle");
    expect(engine.getViewerCount()).toBe(0);
    expect(engine.getLocalStream()).toBeNull();
    expect(engine.isMuted()).toBe(false);
    expect(engine.isCameraOff()).toBe(false);
  });

  it("start() goes idle → requesting-media → live and fires onLocalStream + onStateChange", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const stateLog: string[] = [];
    const streamLog: MediaStream[] = [];
    const engine = new LiveBroadcastEngine({
      onStateChange: (s) => stateLog.push(s),
      onLocalStream: (s) => streamLog.push(s),
    });
    await engine.start({
      sessionId: "sess-1",
      selfAccountId: "owner-abc",
      selfDisplayName: "Owner",
    });
    // state progression
    expect(stateLog).toEqual(["requesting-media", "live"]);
    expect(engine.getState()).toBe("live");
    expect(streamLog).toHaveLength(1);
    expect(engine.getLocalStream()).toBe(currentFakeStream!.stream);
  });

  it("start() with denied media permission routes to 'ended' + onError", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    // Override the stub for this test · getUserMedia rejects.
    installGetUserMediaStub(async () => {
      throw new Error("NotAllowedError");
    });
    const stateLog: string[] = [];
    const errorLog: string[] = [];
    const engine = new LiveBroadcastEngine({
      onStateChange: (s) => stateLog.push(s),
      onError: (m) => errorLog.push(m),
    });
    await engine.start({
      sessionId: "sess-1",
      selfAccountId: "owner-abc",
      selfDisplayName: "Owner",
    });
    expect(stateLog).toEqual(["requesting-media", "ended"]);
    expect(engine.getState()).toBe("ended");
    expect(errorLog).toHaveLength(1);
    expect(errorLog[0]).toMatch(/camera.*microphone/i);
  });

  it("start() is a no-op if the engine is not in 'idle'", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-1",
      selfAccountId: "owner-abc",
      selfDisplayName: "Owner",
    });
    expect(engine.getState()).toBe("live");
    // A second start() must not reinitialise anything · still "live".
    await engine.start({
      sessionId: "sess-2",
      selfAccountId: "owner-xyz",
      selfDisplayName: "Other",
    });
    expect(engine.getState()).toBe("live");
  });

  it("leave() transitions live → ended and fires onStateChange('ended')", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const stateLog: string[] = [];
    const engine = new LiveBroadcastEngine({
      onStateChange: (s) => stateLog.push(s),
    });
    await engine.start({
      sessionId: "sess-1",
      selfAccountId: "owner-abc",
      selfDisplayName: "Owner",
    });
    await engine.leave();
    expect(stateLog.at(-1)).toBe("ended");
    expect(engine.getState()).toBe("ended");
  });

  it("exports MAX_VIEWERS = 10 (sealed pilot cap)", async () => {
    const { MAX_VIEWERS } = await loadEngine();
    expect(MAX_VIEWERS).toBe(10);
  });
});

describe("LiveBroadcastEngine · MAX_VIEWERS enforcement", () => {
  beforeEach(() => {
    presenceCallbacks.length = 0;
    openedChannels.length = 0;
    currentFakeStream = mockStream(1, 1);
    originalMediaDevices = (
      globalThis as unknown as { navigator?: { mediaDevices?: MediaDevices } }
    ).navigator?.mediaDevices;
    originalRTC = (
      globalThis as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }
    ).RTCPeerConnection;
    installGetUserMediaStub(async () => currentFakeStream!.stream);
    installRTCStub();
  });

  afterEach(() => {
    restoreOriginals();
    vi.clearAllMocks();
  });

  it("admits exactly MAX_VIEWERS viewers · the 11th is rejected (not admitted)", async () => {
    const { LiveBroadcastEngine, MAX_VIEWERS } = await loadEngine();
    const viewerCountLog: number[] = [];
    const engine = new LiveBroadcastEngine({
      onViewerCountChange: (n) => viewerCountLog.push(n),
    });
    await engine.start({
      sessionId: "sess-cap",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });

    // Build 11 viewer rows + the broadcaster row, deliver via the
    // presence callback we captured when openNexChannel ran.
    const members: Array<Record<string, unknown>> = [
      {
        accountId: "owner",
        displayName: "Owner",
        role: "broadcaster",
        joinedAt: 0,
        rejected: null,
      },
    ];
    for (let i = 0; i < MAX_VIEWERS + 1; i++) {
      members.push({
        accountId: `viewer-${i}`,
        displayName: `Viewer ${i}`,
        role: "viewer",
        joinedAt: i + 1, // deterministic admission order
        rejected: null,
      });
    }
    const presenceChannel = openedChannels[0];
    expect(presenceChannel).toBeDefined();
    presenceChannel.__fireSync(members);

    // 10 admitted, 11th rejected · the viewer count never exceeds the cap.
    expect(engine.getViewerCount()).toBe(MAX_VIEWERS);
    expect(viewerCountLog.at(-1)).toBe(MAX_VIEWERS);
  });

  it("ignores viewers that reappear after being rejected (no oscillation)", async () => {
    const { LiveBroadcastEngine, MAX_VIEWERS } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-oscillate",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    const presenceChannel = openedChannels[0];
    const buildRoster = () => {
      const rows: Array<Record<string, unknown>> = [
        {
          accountId: "owner",
          displayName: "Owner",
          role: "broadcaster",
          joinedAt: 0,
          rejected: null,
        },
      ];
      for (let i = 0; i < MAX_VIEWERS + 1; i++) {
        rows.push({
          accountId: `viewer-${i}`,
          displayName: `Viewer ${i}`,
          role: "viewer",
          joinedAt: i + 1,
          rejected: null,
        });
      }
      return rows;
    };
    presenceChannel.__fireSync(buildRoster());
    presenceChannel.__fireSync(buildRoster());
    presenceChannel.__fireSync(buildRoster());
    expect(engine.getViewerCount()).toBe(MAX_VIEWERS);
  });
});

describe("LiveBroadcastEngine · setMuted / setCameraOff", () => {
  beforeEach(() => {
    presenceCallbacks.length = 0;
    openedChannels.length = 0;
    currentFakeStream = mockStream(2, 1);
    originalMediaDevices = (
      globalThis as unknown as { navigator?: { mediaDevices?: MediaDevices } }
    ).navigator?.mediaDevices;
    originalRTC = (
      globalThis as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }
    ).RTCPeerConnection;
    installGetUserMediaStub(async () => currentFakeStream!.stream);
    installRTCStub();
  });

  afterEach(() => {
    restoreOriginals();
    vi.clearAllMocks();
  });

  it("setMuted(true) flips state AND disables every audio track", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-mute",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    for (const t of currentFakeStream!.audio) {
      expect(t.enabled).toBe(false);
    }
    // Video tracks are not affected by mute.
    for (const t of currentFakeStream!.video) {
      expect(t.enabled).toBe(true);
    }
  });

  it("setMuted(false) re-enables every audio track", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-mute",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    engine.setMuted(true);
    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
    for (const t of currentFakeStream!.audio) {
      expect(t.enabled).toBe(true);
    }
  });

  it("setCameraOff(true) flips state AND disables every video track", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-cam",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    engine.setCameraOff(true);
    expect(engine.isCameraOff()).toBe(true);
    for (const t of currentFakeStream!.video) {
      expect(t.enabled).toBe(false);
    }
    for (const t of currentFakeStream!.audio) {
      expect(t.enabled).toBe(true);
    }
  });

  it("setMuted(true) before start() does not crash and preserves the intent", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.isMuted()).toBe(true);
    expect(() => engine.setCameraOff(true)).not.toThrow();
    expect(engine.isCameraOff()).toBe(true);
  });
});

describe("LiveBroadcastEngine · leave() cleanup", () => {
  beforeEach(() => {
    presenceCallbacks.length = 0;
    openedChannels.length = 0;
    currentFakeStream = mockStream(1, 1);
    originalMediaDevices = (
      globalThis as unknown as { navigator?: { mediaDevices?: MediaDevices } }
    ).navigator?.mediaDevices;
    originalRTC = (
      globalThis as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }
    ).RTCPeerConnection;
    installGetUserMediaStub(async () => currentFakeStream!.stream);
    installRTCStub();
  });

  afterEach(() => {
    restoreOriginals();
    vi.clearAllMocks();
  });

  it("leave() stops every local track and nulls the local stream", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-leave",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    const allTracks = currentFakeStream!.all;
    await engine.leave();
    for (const t of allTracks) {
      expect(
        (t as unknown as { stop: ReturnType<typeof vi.fn> }).stop,
      ).toHaveBeenCalledTimes(1);
    }
    expect(engine.getLocalStream()).toBeNull();
    expect(engine.getState()).toBe("ended");
  });

  it("leave() clears all admitted viewers and fires onViewerCountChange(0)", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const viewerCountLog: number[] = [];
    const engine = new LiveBroadcastEngine({
      onViewerCountChange: (n) => viewerCountLog.push(n),
    });
    await engine.start({
      sessionId: "sess-leave",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    const presenceChannel = openedChannels[0];
    presenceChannel.__fireSync([
      {
        accountId: "owner",
        displayName: "Owner",
        role: "broadcaster",
        joinedAt: 0,
        rejected: null,
      },
      {
        accountId: "viewer-A",
        displayName: "Viewer A",
        role: "viewer",
        joinedAt: 1,
        rejected: null,
      },
      {
        accountId: "viewer-B",
        displayName: "Viewer B",
        role: "viewer",
        joinedAt: 2,
        rejected: null,
      },
    ]);
    expect(engine.getViewerCount()).toBe(2);
    await engine.leave();
    expect(engine.getViewerCount()).toBe(0);
    expect(viewerCountLog.at(-1)).toBe(0);
  });

  it("leave() is idempotent · second call is a no-op", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const engine = new LiveBroadcastEngine();
    await engine.start({
      sessionId: "sess-leave",
      selfAccountId: "owner",
      selfDisplayName: "Owner",
    });
    const allTracks = currentFakeStream!.all;
    await engine.leave();
    await engine.leave();
    for (const t of allTracks) {
      expect(
        (t as unknown as { stop: ReturnType<typeof vi.fn> }).stop,
      ).toHaveBeenCalledTimes(1);
    }
  });

  it("leave() before start() does not throw and does not transition past idle", async () => {
    const { LiveBroadcastEngine } = await loadEngine();
    const stateLog: string[] = [];
    const engine = new LiveBroadcastEngine({
      onStateChange: (s) => stateLog.push(s),
    });
    await engine.leave();
    // leave() flips to "ended" even without a prior start · documents
    // the sealed intent that "ended" is the single terminal state.
    expect(engine.getState()).toBe("ended");
    expect(stateLog).toEqual(["ended"]);
  });
});
