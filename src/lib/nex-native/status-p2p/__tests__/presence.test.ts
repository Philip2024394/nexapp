// src/lib/nex-native/status-p2p/__tests__/presence.test.ts
//
// NEX Status P2P · presence state-machine tests.
//
// Scope · we do NOT exercise Supabase. The realtime/channel module is
// mocked at the module level (same pattern used by
// live-broadcast/__tests__/broadcast-engine.test.ts) so we can:
//   · observe which channel name was opened
//   · drive onPresenceChange from the test
//   · assert that trackPresence / close were called the expected
//     number of times.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

vi.mock("server-only", () => ({}));

type PresenceCallback = (
  state: Record<string, Array<Record<string, unknown>>>,
) => void;

interface MockChannelHandle {
  broadcast: ReturnType<typeof vi.fn>;
  trackPresence: ReturnType<typeof vi.fn>;
  getPresenceState: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  __fire: (rows: Array<Record<string, unknown>>) => void;
  __name: string;
}

const openedChannels: MockChannelHandle[] = [];

vi.mock("../../realtime/channel", () => ({
  openNexChannel: vi.fn(
    (opts: { name: string; onPresenceChange?: PresenceCallback }) => {
      const handle: MockChannelHandle = {
        __name: opts.name,
        broadcast: vi.fn(async () => {}),
        trackPresence: vi.fn(async () => {}),
        getPresenceState: vi.fn(() => ({})),
        close: vi.fn(async () => {}),
        __fire(rows) {
          const state: Record<string, Array<Record<string, unknown>>> = {};
          for (const r of rows) {
            state[String(r.ownerAccountId ?? Math.random())] = [r];
          }
          opts.onPresenceChange?.(state);
        },
      };
      openedChannels.push(handle);
      return handle;
    },
  ),
}));

async function loadModule() {
  return await import("../presence");
}

describe("StatusOwnerPresence · start / stop / refresh", () => {
  beforeEach(() => {
    openedChannels.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("start() joins the shared status-owners channel and announces self", async () => {
    const { StatusOwnerPresence, STATUS_OWNERS_CHANNEL_NAME } =
      await loadModule();
    const presence = new StatusOwnerPresence({
      ownerAccountId: "owner-a",
      displayName: "Owner A",
    });
    await presence.start();

    expect(openedChannels).toHaveLength(1);
    expect(openedChannels[0].__name).toBe(STATUS_OWNERS_CHANNEL_NAME);
    expect(openedChannels[0].trackPresence).toHaveBeenCalledTimes(1);
    const tracked = openedChannels[0].trackPresence.mock
      .calls[0][0] as Record<string, unknown>;
    expect(tracked.ownerAccountId).toBe("owner-a");
    expect(tracked.displayName).toBe("Owner A");
    expect(tracked.hasActive).toBe(true);
    expect(typeof tracked.lastActiveAt).toBe("number");
    expect(presence.isActive()).toBe(true);
  });

  it("start() with announceSelf:false opens the channel but does NOT track", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const presence = new StatusOwnerPresence({ ownerAccountId: "observer" });
    await presence.start({ announceSelf: false });
    expect(openedChannels).toHaveLength(1);
    expect(openedChannels[0].trackPresence).not.toHaveBeenCalled();
  });

  it("start() is idempotent · second call is a no-op", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const presence = new StatusOwnerPresence({ ownerAccountId: "owner-a" });
    await presence.start();
    await presence.start();
    expect(openedChannels).toHaveLength(1);
  });

  it("stop() closes the channel and is idempotent", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const presence = new StatusOwnerPresence({ ownerAccountId: "owner-a" });
    await presence.start();
    const handle = openedChannels[0];
    await presence.stop();
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(presence.isActive()).toBe(false);
    await presence.stop();
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("refreshActivity() re-tracks presence with a newer lastActiveAt", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const presence = new StatusOwnerPresence({ ownerAccountId: "owner-a" });
    await presence.start();
    const handle = openedChannels[0];
    const firstTs = (handle.trackPresence.mock.calls[0][0] as Record<string, unknown>).lastActiveAt as number;
    // Ensure Date.now() advances by at least 1ms.
    await new Promise((r) => setTimeout(r, 2));
    await presence.refreshActivity();
    expect(handle.trackPresence).toHaveBeenCalledTimes(2);
    const secondTs = (handle.trackPresence.mock.calls[1][0] as Record<string, unknown>).lastActiveAt as number;
    expect(secondTs).toBeGreaterThanOrEqual(firstTs);
  });

  it("refreshActivity() before start() or after stop() is a no-op", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const presence = new StatusOwnerPresence({ ownerAccountId: "owner-a" });
    // Before start.
    await presence.refreshActivity();
    expect(openedChannels).toHaveLength(0);
    await presence.start();
    const handle = openedChannels[0];
    await presence.stop();
    await presence.refreshActivity();
    // Only the start()'s initial trackPresence call.
    expect(handle.trackPresence).toHaveBeenCalledTimes(1);
  });

  it("fires onPresenceChange with a sorted snapshot (newest activity first)", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const log: Array<Array<{ ownerAccountId: string; lastActiveAt: number }>> =
      [];
    const presence = new StatusOwnerPresence({
      ownerAccountId: "observer",
      handlers: {
        onPresenceChange: (owners) =>
          log.push(
            owners.map((o) => ({
              ownerAccountId: o.ownerAccountId,
              lastActiveAt: o.lastActiveAt,
            })),
          ),
      },
    });
    await presence.start({ announceSelf: false });

    openedChannels[0].__fire([
      {
        ownerAccountId: "owner-older",
        displayName: "Older",
        hasActive: true,
        lastActiveAt: 100,
      },
      {
        ownerAccountId: "owner-newer",
        displayName: "Newer",
        hasActive: true,
        lastActiveAt: 500,
      },
    ]);
    expect(log).toHaveLength(1);
    expect(log[0][0].ownerAccountId).toBe("owner-newer");
    expect(log[0][1].ownerAccountId).toBe("owner-older");
  });

  it("ignores malformed presence rows", async () => {
    const { StatusOwnerPresence } = await loadModule();
    const log: Array<Array<{ ownerAccountId: string }>> = [];
    const presence = new StatusOwnerPresence({
      ownerAccountId: "observer",
      handlers: {
        onPresenceChange: (owners) =>
          log.push(owners.map((o) => ({ ownerAccountId: o.ownerAccountId }))),
      },
    });
    await presence.start({ announceSelf: false });

    openedChannels[0].__fire([
      { displayName: "no-id" }, // missing ownerAccountId
      {
        ownerAccountId: "owner-good",
        displayName: "Good",
        hasActive: true,
        lastActiveAt: 1,
      },
    ]);
    expect(log).toHaveLength(1);
    expect(log[0].map((o) => o.ownerAccountId)).toEqual(["owner-good"]);
  });
});
