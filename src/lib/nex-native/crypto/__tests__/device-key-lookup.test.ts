// src/lib/nex-native/crypto/__tests__/device-key-lookup.test.ts
//
// Tests the sealed server-side active-device-key lookup helper.
// -----------------------------------------------------------------
// 5 cases:
//   1. retired_at column PRESENT · the filter applies and only
//      retired_at IS NULL rows are returned.
//   2. retired_at column ABSENT · the fallback returns the full key
//      list (minus any revoked_at flagged rows).
//   3. empty list · no rows returned → empty devices array + ok.
//   4. cache seeded on first call · the shared cache holds the
//      returned device public keys for later hits.
//   5. cache miss after invalidate · the next call re-hits the DB
//      and returns fresh data.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock builder · the PostgREST chain is select().eq().is().order()
// terminated by an await (thenable). We model that with a single chainable
// object whose terminal `then` resolves the current pending response.
// ---------------------------------------------------------------------------

type Pending = { data: unknown[] | null; error: null | { message: string } };

const { fromMock, queue } = vi.hoisted(() => {
  const queue: Pending[] = [];
  const makeBuilder = (): Record<string, unknown> => {
    const current: Pending = queue.shift() ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.is = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    // Support .limit(n) for the probe; terminal when awaited.
    builder.limit = vi.fn().mockResolvedValue(current);
    // Thenable so `await builder` resolves with the pending response.
    builder.then = (onFulfilled: (v: Pending) => unknown) =>
      Promise.resolve(current).then(onFulfilled);
    return builder;
  };
  const fromMock = vi.fn().mockImplementation(() => makeBuilder());
  return { fromMock, queue };
});

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
}));

import {
  _resetDeviceKeyLookupProbeForTests,
  _sharedDeviceKeyCacheForTests,
  lookupActiveDeviceKeys,
} from "../device-key-lookup";

function enqueue(resp: Pending): void {
  queue.push(resp);
}

describe("device-key-lookup", () => {
  beforeEach(() => {
    queue.length = 0;
    fromMock.mockClear();
    _resetDeviceKeyLookupProbeForTests();
    _sharedDeviceKeyCacheForTests().clear();
  });

  it("case 1 · retired_at column present · returns active devices only", async () => {
    // Probe succeeds (column exists) · then the main query returns two rows.
    enqueue({ data: [], error: null }); // probe
    enqueue({
      data: [
        { device_id: "dev-a", public_key: "pka", last_seen_at: "t1" },
        { device_id: "dev-b", public_key: "pkb", last_seen_at: "t2" },
      ],
      error: null,
    });
    const res = await lookupActiveDeviceKeys("acc-1");
    expect(res.ok).toBe(true);
    expect(res.status).toBe("ok");
    expect(res.devices.length).toBe(2);
    expect(res.devices.map((d) => d.device_id).sort()).toEqual([
      "dev-a",
      "dev-b",
    ]);
  });

  it("case 2 · retired_at column absent · fallback returns full list minus revoked_at rows", async () => {
    // Probe fails with a column-missing error · follow-up query runs
    // without the retired_at filter.
    enqueue({
      data: null,
      error: { message: "column nex_account_device_key.retired_at does not exist" },
    });
    enqueue({
      data: [
        { device_id: "dev-a", public_key: "pka", last_seen_at: "t1" },
        {
          device_id: "dev-b",
          public_key: "pkb",
          last_seen_at: "t2",
          revoked_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const res = await lookupActiveDeviceKeys("acc-2");
    expect(res.ok).toBe(true);
    expect(res.status).toBe("retired_column_absent");
    expect(res.devices.length).toBe(1);
    expect(res.devices[0]!.device_id).toBe("dev-a");
  });

  it("case 3 · empty list · ok with zero devices", async () => {
    enqueue({ data: [], error: null }); // probe
    enqueue({ data: [], error: null }); // main query
    const res = await lookupActiveDeviceKeys("acc-3");
    expect(res.ok).toBe(true);
    expect(res.devices.length).toBe(0);
  });

  it("case 4 · cache seeded on first call", async () => {
    enqueue({ data: [], error: null }); // probe
    enqueue({
      data: [{ device_id: "dev-x", public_key: "pkx", last_seen_at: "t1" }],
      error: null,
    });
    const res = await lookupActiveDeviceKeys("acc-4");
    expect(res.ok).toBe(true);
    const cache = _sharedDeviceKeyCacheForTests();
    expect(cache.get("acc-4", "dev-x")).toBe("pkx");
  });

  it("case 5 · cache miss after invalidate re-hits DB", async () => {
    // First call seeds the cache.
    enqueue({ data: [], error: null }); // probe
    enqueue({
      data: [{ device_id: "dev-y", public_key: "pky-old", last_seen_at: "t1" }],
      error: null,
    });
    await lookupActiveDeviceKeys("acc-5");
    const cache = _sharedDeviceKeyCacheForTests();
    expect(cache.get("acc-5", "dev-y")).toBe("pky-old");

    // Invalidate + refresh · probe is cached in RETIRED_COLUMN_PRESENT
    // module state so only ONE more DB call occurs.
    cache.invalidate("acc-5");
    enqueue({
      data: [{ device_id: "dev-y", public_key: "pky-new", last_seen_at: "t2" }],
      error: null,
    });
    const refreshed = await lookupActiveDeviceKeys("acc-5");
    expect(refreshed.devices[0]!.public_key).toBe("pky-new");
    expect(cache.get("acc-5", "dev-y")).toBe("pky-new");
  });
});
