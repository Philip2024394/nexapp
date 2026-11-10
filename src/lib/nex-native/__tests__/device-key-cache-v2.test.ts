// src/lib/nex-native/__tests__/device-key-cache-v2.test.ts
//
// NEX device-key chat · device-key-cache-v2 unit tests.
// Owner-authorised 2026-11-10.
// -----------------------------------------------------------------
// Covers:
//   1. get · hit returns the cached public key
//   2. get · miss returns null
//   3. invalidate · purges every entry for one account
//   4. TTL · expired entries return null and are deleted
//   5. LRU · oldest entry is evicted when capacity is reached
//   6. concurrent get · multiple reads return the same value

import { describe, expect, it } from "vitest";
import { DeviceKeyCacheV2 } from "../crypto/device-key-cache-v2";

describe("DeviceKeyCacheV2", () => {
  it("returns the cached public key on hit", () => {
    const cache = new DeviceKeyCacheV2();
    cache.set("acct-a", "dev-1", "pub-key-a1");
    expect(cache.get("acct-a", "dev-1")).toBe("pub-key-a1");
  });

  it("returns null on miss", () => {
    const cache = new DeviceKeyCacheV2();
    expect(cache.get("acct-a", "dev-1")).toBeNull();
  });

  it("invalidate purges every entry for an account", () => {
    const cache = new DeviceKeyCacheV2();
    cache.set("acct-a", "dev-1", "pub-a1");
    cache.set("acct-a", "dev-2", "pub-a2");
    cache.set("acct-b", "dev-1", "pub-b1");
    cache.invalidate("acct-a");
    expect(cache.get("acct-a", "dev-1")).toBeNull();
    expect(cache.get("acct-a", "dev-2")).toBeNull();
    // Unrelated account survives.
    expect(cache.get("acct-b", "dev-1")).toBe("pub-b1");
  });

  it("expires entries after TTL and deletes them on read", () => {
    let now = 1_000_000;
    const cache = new DeviceKeyCacheV2({
      ttlMs: 5_000,
      now: () => now,
    });
    cache.set("acct-a", "dev-1", "pub-a1");
    // Still within TTL.
    now = 1_004_999;
    expect(cache.get("acct-a", "dev-1")).toBe("pub-a1");
    // Exactly at expiry · expired.
    now = 1_005_000;
    expect(cache.get("acct-a", "dev-1")).toBeNull();
    // Size should have dropped to zero because expired reads delete.
    expect(cache.size()).toBe(0);
  });

  it("evicts the oldest entry when the LRU cap is reached", () => {
    const cache = new DeviceKeyCacheV2({ maxEntries: 3 });
    cache.set("acct-a", "dev-1", "pub-1");
    cache.set("acct-a", "dev-2", "pub-2");
    cache.set("acct-a", "dev-3", "pub-3");
    // Touch dev-1 so it becomes the most-recent entry (LRU bump).
    expect(cache.get("acct-a", "dev-1")).toBe("pub-1");
    // Insert dev-4 · must evict the now-oldest entry which is dev-2.
    cache.set("acct-a", "dev-4", "pub-4");
    expect(cache.size()).toBe(3);
    expect(cache.get("acct-a", "dev-2")).toBeNull();
    expect(cache.get("acct-a", "dev-1")).toBe("pub-1");
    expect(cache.get("acct-a", "dev-3")).toBe("pub-3");
    expect(cache.get("acct-a", "dev-4")).toBe("pub-4");
  });

  it("concurrent gets return the same value without race divergence", async () => {
    const cache = new DeviceKeyCacheV2();
    cache.set("acct-a", "dev-1", "pub-a1");
    const reads = await Promise.all(
      Array.from({ length: 16 }, () =>
        Promise.resolve(cache.get("acct-a", "dev-1")),
      ),
    );
    for (const r of reads) {
      expect(r).toBe("pub-a1");
    }
    // Size should remain 1 · concurrent reads must not duplicate.
    expect(cache.size()).toBe(1);
  });
});
