// src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts
//
// Deterministic regression for the R4 chat-race bounded fix (2026-11-17).
//
// FAILING ORDERING we must recreate:
//
//   1. Buyer opens chat · DeviceKeyHub upserts buyer's device · cache miss
//      → cachedListDeviceKeys(peer) fetches ONCE → peer has 0 devices
//      (seller hasn't opened yet) → result cached for 60 s
//   2. Seller opens chat · DeviceKeyHub upserts seller's device · the
//      BUYER'S local cache is NOT invalidated (each tab's cache is
//      independent)
//   3. Buyer sends message · OLD BEHAVIOUR: cached hit → peer devices
//      still [] → no_peer_devices → downgrade / fail
//                NEW BEHAVIOUR: forceRefresh bypasses cache → fresh read
//                picks up seller's device → fan-out includes it ✓
//
// The fix lives in encrypted-send.ts at the send-time fetch call. This
// test exercises the device-key-cache directly to prove forceRefresh
// routes around a stale entry while still writing the fresh result
// back for subsequent reads.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We mock listAccountDeviceKeysAction so each test can control the
// "server" responses and timing precisely.
const actionMock = vi.fn();

vi.mock("@/app/nex-native/_actions", () => ({
  listAccountDeviceKeysAction: (accountId: string) => actionMock(accountId),
}));

// Import AFTER the mock so the cache module picks up the mocked action.
import {
  cachedListDeviceKeys,
  clearDeviceKeyCache,
} from "../device-key-cache";

beforeEach(() => {
  clearDeviceKeyCache();
  actionMock.mockReset();
});

afterEach(() => {
  clearDeviceKeyCache();
});

describe("cachedListDeviceKeys · forceRefresh bypasses cache", () => {
  it("stale cache + forceRefresh → fresh read picks up new device", async () => {
    // Step 1: buyer's first fetch · seller has no devices yet.
    actionMock.mockResolvedValueOnce({ ok: true, devices: [] });
    const first = await cachedListDeviceKeys("seller-A");
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.devices).toHaveLength(0);
      expect(first.cached).toBe(false);
    }
    expect(actionMock).toHaveBeenCalledTimes(1);

    // Step 2: without forceRefresh the next call hits cache and still
    // sees [] · this reproduces the R4 race.
    actionMock.mockResolvedValueOnce({
      ok: true,
      devices: [{ device_id: "seller-v5", public_key: "pk", last_seen_at: "t" }],
    });
    const stale = await cachedListDeviceKeys("seller-A");
    expect(stale.ok).toBe(true);
    if (stale.ok) {
      expect(stale.devices).toHaveLength(0);
      expect(stale.cached).toBe(true);
    }
    expect(actionMock).toHaveBeenCalledTimes(1); // cached · NOT called again

    // Step 3: forceRefresh bypasses the cache and triggers a fresh fetch.
    actionMock.mockResolvedValueOnce({
      ok: true,
      devices: [{ device_id: "seller-v5", public_key: "pk", last_seen_at: "t" }],
    });
    const fresh = await cachedListDeviceKeys("seller-A", { forceRefresh: true });
    expect(fresh.ok).toBe(true);
    if (fresh.ok) {
      expect(fresh.devices).toHaveLength(1);
      expect(fresh.devices[0]!.device_id).toBe("seller-v5");
      expect(fresh.cached).toBe(false);
    }
    expect(actionMock).toHaveBeenCalledTimes(2);

    // Step 4: the fresh result was written back · a normal read now
    // sees the new device from cache.
    const next = await cachedListDeviceKeys("seller-A");
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.devices).toHaveLength(1);
      expect(next.cached).toBe(true);
    }
    expect(actionMock).toHaveBeenCalledTimes(2);
  });

  it("forceRefresh still tolerates action errors truthfully", async () => {
    // cache-module fall-through path calls the action twice on failure
    // (once inside the dedup promise, once as the surfacing fallback).
    actionMock.mockResolvedValue({ ok: false, error: "transport_down" });
    const r = await cachedListDeviceKeys("peer-X", { forceRefresh: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("transport_down");
  });

  it("concurrent forceRefresh calls dedupe per-accountId", async () => {
    let resolveIt: (v: unknown) => void = () => {};
    const pending = new Promise((r) => (resolveIt = r));
    actionMock.mockImplementationOnce(() => pending);

    // Fire two simultaneous forceRefresh calls for the same account.
    const a = cachedListDeviceKeys("peer-X", { forceRefresh: true });
    const b = cachedListDeviceKeys("peer-X", { forceRefresh: true });
    expect(actionMock).toHaveBeenCalledTimes(1); // coalesced

    resolveIt({ ok: true, devices: [] });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
  });

  // ─── Matrix 5 · 6 · 8 regression coverage added 2026-11-17 ───
  // Addresses the gaps declared in evidence/product-chat-cart-
  // checkpoint/REPORT.md §7 matrix table. These scenarios complete the
  // "registration-timeline" coverage without changing production code.

  it("matrix 5 · no registered device → ok:true devices:[] (truthful empty, not error)", async () => {
    // "no_peer_devices" is a caller-level condition: the cache must
    // surface an empty device list truthfully so the caller can branch
    // on `devices.length === 0` without the cache masking that as an
    // error. Error channel is reserved for transport/provider failures.
    actionMock.mockResolvedValueOnce({ ok: true, devices: [] });
    const r = await cachedListDeviceKeys("peer-nodev");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.devices).toHaveLength(0);
      expect(r.cached).toBe(false);
    }
    // The empty result is cached (write-back on success). Next call
    // returns the same truthful empty from cache, NOT re-fetches.
    const r2 = await cachedListDeviceKeys("peer-nodev");
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.devices).toHaveLength(0);
      expect(r2.cached).toBe(true);
    }
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("matrix 6 · already-registered happy baseline · first read sees device uncached", async () => {
    // No prior cache entry. First-ever call for this account where the
    // peer already has a registered device → ok:true, device present,
    // cached:false. This is the plain-vanilla success case the R4 fix
    // must not regress.
    actionMock.mockResolvedValueOnce({
      ok: true,
      devices: [
        { device_id: "seller-happy-v1", public_key: "pk", last_seen_at: "t0" },
      ],
    });
    const r = await cachedListDeviceKeys("seller-happy");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.devices).toHaveLength(1);
      expect(r.devices[0]!.device_id).toBe("seller-happy-v1");
      expect(r.cached).toBe(false);
    }
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("matrix 8 · duplicate forceRefresh after success · not idempotent-for-cache (each bypasses), result shape stable", async () => {
    // Sequential (not concurrent) forceRefresh calls each bypass the
    // cache deliberately. Idempotency is of result SHAPE, not of DB
    // calls: shape must stay identical, device identities preserved.
    actionMock.mockResolvedValueOnce({
      ok: true,
      devices: [{ device_id: "d1", public_key: "pk1", last_seen_at: "t" }],
    });
    const r1 = await cachedListDeviceKeys("peer-refresh", { forceRefresh: true });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.devices).toHaveLength(1);
      expect(r1.devices[0]!.device_id).toBe("d1");
      expect(r1.cached).toBe(false);
    }

    actionMock.mockResolvedValueOnce({
      ok: true,
      devices: [{ device_id: "d1", public_key: "pk1", last_seen_at: "t" }],
    });
    const r2 = await cachedListDeviceKeys("peer-refresh", { forceRefresh: true });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      // Shape idempotent · same device id, same count, cached:false
      // both times because every forceRefresh bypasses cache.
      expect(r2.devices).toHaveLength(1);
      expect(r2.devices[0]!.device_id).toBe("d1");
      expect(r2.cached).toBe(false);
    }
    // Two action calls: confirms bypass semantics (NOT dedupe'd across
    // sequential calls · dedupe is only for concurrent inflight).
    expect(actionMock).toHaveBeenCalledTimes(2);
  });
});
