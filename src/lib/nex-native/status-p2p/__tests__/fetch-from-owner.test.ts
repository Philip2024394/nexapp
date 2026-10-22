// src/lib/nex-native/status-p2p/__tests__/fetch-from-owner.test.ts
//
// NEX Status P2P · viewer-side state machine + chunk reassembly tests.
//
// Scope · we do NOT exercise the real signalling / RTCPeerConnection.
// Both `openNexChannel` and `openSignallingChannel` are mocked.
//
// We DO exercise:
//   · state transitions idle → connecting → listing → ready
//   · state transition into "fetching" and back to "ready" after a
//     blob is reassembled
//   · the chunk framing + reassembly path via
//     `__handleIncomingForTest`
//   · ignore unknown-chunk, out-of-range chunk, and duplicate chunk
//     frames
//   · fetchStatus against an unknown statusId fires onError.
//
// We do NOT exercise:
//   · WAIT_FOR_OWNER_MS fallthrough (would require fake timers around
//     a 10s window and the mock signalling · defer to integration).
//   · Real STUN/ICE flows.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

vi.mock("server-only", () => ({}));

// ─── Mocks ───────────────────────────────────────────────────────

interface MockBroadcastRecord {
  event: string;
  payload: Record<string, unknown>;
}

interface MockServiceChannel {
  __name: string;
  __broadcasts: MockBroadcastRecord[];
  broadcast: ReturnType<typeof vi.fn>;
  trackPresence: ReturnType<typeof vi.fn>;
  getPresenceState: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const openedChannels: MockServiceChannel[] = [];

vi.mock("../../realtime/channel", () => ({
  openNexChannel: vi.fn((opts: { name: string }) => {
    const broadcasts: MockBroadcastRecord[] = [];
    const handle: MockServiceChannel = {
      __name: opts.name,
      __broadcasts: broadcasts,
      broadcast: vi.fn(async (event: string, payload: Record<string, unknown>) => {
        broadcasts.push({ event, payload });
      }),
      trackPresence: vi.fn(async () => {}),
      getPresenceState: vi.fn(() => ({})),
      close: vi.fn(async () => {}),
    };
    openedChannels.push(handle);
    return handle;
  }),
}));

const signallingInstances: Array<{ close: ReturnType<typeof vi.fn> }> = [];
vi.mock("../../realtime/signalling", () => ({
  openSignallingChannel: vi.fn(() => {
    const inst = {
      sendRing: vi.fn(async () => {}),
      sendOffer: vi.fn(async () => {}),
      sendAnswer: vi.fn(async () => {}),
      sendIce: vi.fn(async () => {}),
      sendBye: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    signallingInstances.push(inst);
    return inst;
  }),
}));

async function loadModule() {
  return await import("../fetch-from-owner");
}

async function loadTypes() {
  return await import("../types");
}

// ─── Helpers ────────────────────────────────────────────────────

function makeListFrame(items: Array<{
  statusId: string;
  kind: "image" | "video";
  overlays?: unknown[];
  postedAtMs?: number;
  expiresAtMs?: number;
  mediaMimeType?: string;
  mediaSizeBytes?: number;
}>): string {
  return JSON.stringify({
    type: "status-list-response",
    items: items.map((i) => ({
      statusId: i.statusId,
      kind: i.kind,
      overlays: i.overlays ?? [],
      postedAtMs: i.postedAtMs ?? 0,
      expiresAtMs: i.expiresAtMs ?? Date.now() + 3_600_000,
      mediaMimeType: i.mediaMimeType ?? (i.kind === "image" ? "image/jpeg" : "video/webm"),
      mediaSizeBytes: i.mediaSizeBytes ?? 123,
    })),
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe("StatusFetchClient · state transitions + request dispatch", () => {
  beforeEach(() => {
    openedChannels.length = 0;
    signallingInstances.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts in 'idle'", async () => {
    const { StatusFetchClient } = await loadModule();
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
    });
    expect(client.getState()).toBe("idle");
  });

  it("connect() opens service channel + signalling, broadcasts status-list-request, state → listing", async () => {
    const { StatusFetchClient } = await loadModule();
    const log: string[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStateChange: (s) => log.push(s),
      },
    });
    await client.connect();

    // Service channel opened with the owner's status-serve name.
    expect(openedChannels).toHaveLength(1);
    expect(openedChannels[0].__name).toBe("nex:status-serve:owner");
    // Signalling pair opened.
    expect(signallingInstances).toHaveLength(1);
    // The list request fired on the service channel.
    expect(openedChannels[0].__broadcasts).toHaveLength(1);
    expect(openedChannels[0].__broadcasts[0].event).toBe("status-list-request");
    // State progression.
    expect(log[0]).toBe("connecting");
    expect(log[1]).toBe("listing");
    expect(client.getState()).toBe("listing");
  });

  it("list-response frame transitions state → ready and fires onStatusList", async () => {
    const { StatusFetchClient } = await loadModule();
    const seenList: unknown[] = [];
    const log: string[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStateChange: (s) => log.push(s),
        onStatusList: (items) => seenList.push(items),
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    expect(seenList).toHaveLength(1);
    expect(log.at(-1)).toBe("ready");
    expect(client.getState()).toBe("ready");
  });

  it("fetchStatus(unknownId) fires onError and does NOT flip to fetching", async () => {
    const { StatusFetchClient } = await loadModule();
    const errors: string[] = [];
    const states: string[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStateChange: (s) => states.push(s),
        onError: (m) => errors.push(m),
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    await client.fetchStatus("unknown");
    expect(errors.some((e) => /unknown statusId/i.test(e))).toBe(true);
    expect(states.includes("fetching")).toBe(false);
  });

  it("fetchStatus(validId) broadcasts status-request and flips to 'fetching'", async () => {
    const { StatusFetchClient } = await loadModule();
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    await client.fetchStatus("s1");
    // 2 broadcasts: status-list-request + status-request.
    const svc = openedChannels[0];
    const requestEvents = svc.__broadcasts.filter((b) => b.event === "status-request");
    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0].payload.statusId).toBe("s1");
    expect(client.getState()).toBe("fetching");
  });
});

describe("StatusFetchClient · chunk reassembly", () => {
  beforeEach(() => {
    openedChannels.length = 0;
    signallingInstances.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reassembles chunks in order and fires onStatusBlob with correct bytes", async () => {
    const { StatusFetchClient } = await loadModule();
    const { encodeChunkFrame } = await loadTypes();

    const payload = new TextEncoder().encode("hello status world").buffer;
    const chunkSize = 5;
    const totalChunks = Math.ceil(payload.byteLength / chunkSize);

    const received: Array<{ id: string; size: number; mime: string }> = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStatusBlob: (statusId, blob) => {
          received.push({ id: statusId, size: blob.size, mime: blob.type });
        },
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image", mediaMimeType: "image/png", mediaSizeBytes: payload.byteLength }]),
    );
    await client.fetchStatus("s1");

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(payload.byteLength, start + chunkSize);
      const slice = payload.slice(start, end);
      const frame = encodeChunkFrame(
        { type: "status-chunk", statusId: "s1", index: i, totalChunks },
        slice,
      );
      client.__handleIncomingForTest(frame);
    }
    // Belt-and-braces: owner usually sends status-end but reassembly
    // also finalises when received === totalChunks.
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe("s1");
    expect(received[0].size).toBe(payload.byteLength);
    expect(received[0].mime).toBe("image/png");
    expect(client.getState()).toBe("ready");
  });

  it("ignores chunks for a statusId that is not in flight", async () => {
    const { StatusFetchClient } = await loadModule();
    const { encodeChunkFrame } = await loadTypes();
    const received: unknown[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStatusBlob: (statusId) => received.push(statusId),
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    // No fetchStatus · just ship a chunk · must be silently ignored.
    const frame = encodeChunkFrame(
      { type: "status-chunk", statusId: "s1", index: 0, totalChunks: 1 },
      new TextEncoder().encode("hi").buffer,
    );
    client.__handleIncomingForTest(frame);
    expect(received).toHaveLength(0);
  });

  it("ignores duplicate chunk indices", async () => {
    const { StatusFetchClient } = await loadModule();
    const { encodeChunkFrame } = await loadTypes();
    const sizes: number[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onStatusBlob: (_, blob) => sizes.push(blob.size),
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    await client.fetchStatus("s1");

    const a = new Uint8Array([1, 2]).buffer;
    const b = new Uint8Array([3, 4]).buffer;
    client.__handleIncomingForTest(
      encodeChunkFrame({ type: "status-chunk", statusId: "s1", index: 0, totalChunks: 2 }, a),
    );
    // Duplicate at index 0 · should be ignored.
    client.__handleIncomingForTest(
      encodeChunkFrame({ type: "status-chunk", statusId: "s1", index: 0, totalChunks: 2 }, a),
    );
    client.__handleIncomingForTest(
      encodeChunkFrame({ type: "status-chunk", statusId: "s1", index: 1, totalChunks: 2 }, b),
    );
    expect(sizes).toEqual([4]);
  });

  it("status-end before all chunks arrive fires onError and returns to 'ready'", async () => {
    const { StatusFetchClient } = await loadModule();
    const { encodeChunkFrame } = await loadTypes();
    const errors: string[] = [];
    const states: string[] = [];
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
      handlers: {
        onError: (m) => errors.push(m),
        onStateChange: (s) => states.push(s),
      },
    });
    await client.connect();
    client.__handleIncomingForTest(
      makeListFrame([{ statusId: "s1", kind: "image" }]),
    );
    await client.fetchStatus("s1");

    const a = new Uint8Array([1, 2]).buffer;
    client.__handleIncomingForTest(
      encodeChunkFrame({ type: "status-chunk", statusId: "s1", index: 0, totalChunks: 2 }, a),
    );
    // status-end before chunk 1 arrives.
    client.__handleIncomingForTest(JSON.stringify({ type: "status-end", statusId: "s1" }));
    expect(errors.some((e) => /missing chunks/i.test(e))).toBe(true);
    expect(states.at(-1)).toBe("ready");
  });
});

describe("StatusFetchClient · close() cleanup", () => {
  beforeEach(() => {
    openedChannels.length = 0;
    signallingInstances.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("close() terminates in 'ended' and closes signalling + service channels", async () => {
    const { StatusFetchClient } = await loadModule();
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
    });
    await client.connect();
    await client.close();
    expect(client.getState()).toBe("ended");
    // Flush microtasks so the deferred `void close()` chains resolve
    // before we assert.
    await new Promise((r) => setTimeout(r, 0));
    expect(signallingInstances[0].close).toHaveBeenCalledTimes(1);
    expect(openedChannels[0].close).toHaveBeenCalledTimes(1);
  });

  it("close() is idempotent", async () => {
    const { StatusFetchClient } = await loadModule();
    const client = new StatusFetchClient({
      ownerAccountId: "owner",
      viewerAccountId: "viewer",
    });
    await client.connect();
    await client.close();
    await client.close();
    await new Promise((r) => setTimeout(r, 0));
    expect(signallingInstances[0].close).toHaveBeenCalledTimes(1);
    expect(openedChannels[0].close).toHaveBeenCalledTimes(1);
  });
});
