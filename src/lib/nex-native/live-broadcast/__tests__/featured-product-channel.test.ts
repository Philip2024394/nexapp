// src/lib/nex-native/live-broadcast/__tests__/featured-product-channel.test.ts
//
// NEX Live Commerce · featured-product propagation channel tests.
//
// Scope · exercise the thin wrapper over Supabase Realtime that
// propagates the broadcaster's "currently featured" product to viewers.
// Same mocking pattern as broadcast-engine.test.ts · we vi.mock the
// realtime channel module and drive broadcasts + presence syncs
// deterministically through recorded callbacks.
//
// What we assert:
//   · Broadcaster: setFeatured(null) broadcasts a featured-set message
//     with product: null AND updates the presence row.
//   · Broadcaster: setFeatured(product) broadcasts the real product.
//   · Viewer: receives broadcasts and fires onFeaturedChange.
//   · Viewer: unknown message types are ignored silently.
//   · Viewer: presence sync (late-joiner path) resolves the current
//     featured product from the broadcaster's presence row.
//   · Viewer: setFeatured is a no-op · never broadcasts.
//   · close() is idempotent · multiple calls do not throw.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import type { LiveProductSnapshot } from "@/components/nex-native/live-commerce/ProductOverlayCard";

vi.mock("server-only", () => ({}));

// ─── Mock realtime channel ─────────────────────────────────────────

type BroadcastCallback = (
  event: string,
  envelope: { sender: string; payload: Record<string, unknown> },
) => void;
type PresenceCallback = (
  state: Record<string, Array<Record<string, unknown>>>,
) => void;

interface MockOpenOpts {
  name: string;
  selfId: string;
  onBroadcast?: BroadcastCallback;
  onPresenceChange?: PresenceCallback;
  onError?: (err: string) => void;
}

interface MockChannelHandle {
  broadcast: ReturnType<typeof vi.fn>;
  trackPresence: ReturnType<typeof vi.fn>;
  getPresenceState: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  __opts: MockOpenOpts;
  __firePresence(state: Record<string, Array<Record<string, unknown>>>): void;
  __fireBroadcast(
    event: string,
    sender: string,
    payload: Record<string, unknown>,
  ): void;
}

const openedChannels: MockChannelHandle[] = [];

vi.mock("../../realtime/channel", () => ({
  openNexChannel: vi.fn((opts: MockOpenOpts) => {
    const handle: MockChannelHandle = {
      broadcast: vi.fn(async () => {}),
      trackPresence: vi.fn(async () => {}),
      getPresenceState: vi.fn(() => ({})),
      close: vi.fn(async () => {}),
      __opts: opts,
      __firePresence(state) {
        opts.onPresenceChange?.(state);
      },
      __fireBroadcast(event, sender, payload) {
        opts.onBroadcast?.(event, { sender, payload });
      },
    };
    openedChannels.push(handle);
    return handle;
  }),
}));

// ─── Fixtures ──────────────────────────────────────────────────────

const CRISPY: LiveProductSnapshot = {
  productId: "cc-b01",
  name: "Classic Crispy Burger",
  imageUrl: null,
  priceLabel: "Rp 45.000",
  shopName: "Crispy Chicken",
  stockStatus: "in_stock",
  hasVariants: false,
};

const SOLD_OUT: LiveProductSnapshot = {
  productId: "cc-c05",
  name: "8-Piece Spicy Wings",
  imageUrl: "https://example.test/wings.jpg",
  priceLabel: "Rp 68.000",
  shopName: "Crispy Chicken",
  stockStatus: "sold_out",
  hasVariants: true,
};

async function loadModule() {
  return await import("../featured-product-channel");
}

describe("openFeaturedProductChannel · broadcaster role", () => {
  beforeEach(() => {
    openedChannels.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens a channel named 'nex:live-featured:{sessionId}'", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    openFeaturedProductChannel({
      sessionId: "sess-xyz",
      role: "broadcaster",
    });
    expect(openedChannels).toHaveLength(1);
    expect(openedChannels[0].__opts.name).toBe("nex:live-featured:sess-xyz");
  });

  it("broadcaster · initial presence track carries product: null", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    openFeaturedProductChannel({
      sessionId: "sess-1",
      role: "broadcaster",
    });
    const ch = openedChannels[0];
    // Fire-and-forget inside the function · give the microtask a tick.
    await Promise.resolve();
    expect(ch.trackPresence).toHaveBeenCalled();
    const payload = ch.trackPresence.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(payload.role).toBe("broadcaster");
    expect(payload.product).toBeNull();
    expect(typeof payload.at).toBe("number");
  });

  it("setFeatured(null) broadcasts featured-set with product: null AND re-tracks presence", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-1",
      role: "broadcaster",
    });
    const ch = openedChannels[0];
    await handle.setFeatured(null);
    expect(ch.broadcast).toHaveBeenCalledWith(
      "featured-set",
      expect.objectContaining({
        type: "featured-set",
        product: null,
      }) as unknown,
    );
    // trackPresence · 1 for the initial null track, 1 for the setFeatured update.
    expect(ch.trackPresence.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastTrack = ch.trackPresence.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(lastTrack.product).toBeNull();
  });

  it("setFeatured(product) broadcasts the full product snapshot", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-2",
      role: "broadcaster",
    });
    const ch = openedChannels[0];
    await handle.setFeatured(CRISPY);
    expect(ch.broadcast).toHaveBeenCalledWith(
      "featured-set",
      expect.objectContaining({
        type: "featured-set",
        product: expect.objectContaining({
          productId: "cc-b01",
          name: "Classic Crispy Burger",
          priceLabel: "Rp 45.000",
          stockStatus: "in_stock",
        }) as unknown,
      }) as unknown,
    );
    const lastTrack = ch.trackPresence.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown

    >;
    expect(lastTrack.product).toEqual(CRISPY);
  });

  it("broadcaster · onFeaturedChange is NEVER fired (self never consumes own echo)", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    const handle = openFeaturedProductChannel({
      sessionId: "sess-3",
      role: "broadcaster",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    await handle.setFeatured(SOLD_OUT);
    // Simulate a stray broadcast arriving on the channel · broadcaster
    // must still ignore it even if it leaks through (self-filter is
    // the real guard but the module double-checks on role).
    ch.__fireBroadcast("featured-set", "someone-else", {
      type: "featured-set",
      product: CRISPY,
      at: Date.now(),
    });
    expect(log).toHaveLength(0);
  });
});

describe("openFeaturedProductChannel · viewer role", () => {
  beforeEach(() => {
    openedChannels.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("viewer · receives featured-set broadcasts and fires onFeaturedChange", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-v",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__fireBroadcast("featured-set", "broadcaster", {
      type: "featured-set",
      product: CRISPY,
      at: Date.now(),
    });
    expect(log).toEqual([CRISPY]);
  });

  it("viewer · receives a clear (product: null) broadcast", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-v",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__fireBroadcast("featured-set", "broadcaster", {
      type: "featured-set",
      product: null,
      at: Date.now(),
    });
    expect(log).toEqual([null]);
  });

  it("viewer · unknown message types are ignored silently", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-v",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__fireBroadcast("some-future-event", "broadcaster", {
      type: "variant-stock-update",
      product: CRISPY,
      at: Date.now(),
    });
    // Broadcast with the right event name but a mismatched payload type.
    ch.__fireBroadcast("featured-set", "broadcaster", {
      type: "something-else",
      product: CRISPY,
    });
    expect(log).toEqual([]);
  });

  it("viewer · setFeatured is a no-op · never broadcasts", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-v",
      role: "viewer",
    });
    const ch = openedChannels[0];
    await handle.setFeatured(CRISPY);
    expect(ch.broadcast).not.toHaveBeenCalled();
  });

  it("viewer · presence sync surfaces the broadcaster's current featured product (late-joiner)", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-late",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__firePresence({
      "broadcaster-key": [
        {
          role: "broadcaster",
          product: CRISPY,
          at: Date.now(),
        },
      ],
    });
    expect(log).toEqual([CRISPY]);
  });

  it("viewer · presence sync with no broadcaster row surfaces null", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-empty",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__firePresence({});
    expect(log).toEqual([null]);
  });

  it("viewer · presence sync with a malformed broadcaster row surfaces null", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    openFeaturedProductChannel({
      sessionId: "sess-malformed",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    ch.__firePresence({
      "broadcaster-key": [
        {
          role: "broadcaster",
          product: { productId: 42 }, // malformed · productId must be string
          at: Date.now(),
        },
      ],
    });
    expect(log).toEqual([null]);
  });
});

describe("openFeaturedProductChannel · close()", () => {
  beforeEach(() => {
    openedChannels.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("close() is idempotent · multiple calls do not throw", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-close",
      role: "broadcaster",
    });
    await handle.close();
    await handle.close();
    await expect(handle.close()).resolves.toBeUndefined();
    const ch = openedChannels[0];
    // Underlying channel's close is only called once · subsequent close
    // calls are swallowed by the handle's own `closed` guard.
    expect(ch.close).toHaveBeenCalledTimes(1);
  });

  it("close() stops downstream broadcasts from firing onFeaturedChange", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const log: Array<LiveProductSnapshot | null> = [];
    const handle = openFeaturedProductChannel({
      sessionId: "sess-closed-silence",
      role: "viewer",
      onFeaturedChange: (p) => log.push(p),
    });
    const ch = openedChannels[0];
    await handle.close();
    ch.__fireBroadcast("featured-set", "broadcaster", {
      type: "featured-set",
      product: CRISPY,
      at: Date.now(),
    });
    expect(log).toEqual([]);
  });

  it("close() swallows errors from the underlying channel close", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-close-err",
      role: "broadcaster",
    });
    const ch = openedChannels[0];
    ch.close.mockRejectedValueOnce(new Error("boom"));
    await expect(handle.close()).resolves.toBeUndefined();
  });

  it("setFeatured after close is a no-op (does not broadcast)", async () => {
    const { openFeaturedProductChannel } = await loadModule();
    const handle = openFeaturedProductChannel({
      sessionId: "sess-close-set",
      role: "broadcaster",
    });
    const ch = openedChannels[0];
    await handle.close();
    ch.broadcast.mockClear();
    await handle.setFeatured(CRISPY);
    expect(ch.broadcast).not.toHaveBeenCalled();
  });
});
