// src/lib/nex-native/crypto/device-key-cache.ts
//
// Bridge 84 · Client-side cache for listAccountDeviceKeysAction.
// --------------------------------------------------------------
// Every encrypted send calls the action twice (peer + self device
// lists). Without a cache, a 100K-DAU chat app would hit the DB on
// every keystroke's send · a hot query with poor scaling.
//
// This module wraps listAccountDeviceKeysAction with a module-level
// Map cache. 60-second TTL is long enough that repeat sends in one
// conversation hit the cache, short enough that a peer registering a
// new device is picked up within a minute.
//
// Cache is NEVER persisted · it lives for the lifetime of the tab.
// Reload = fresh fetch. That's fine · new devices don't churn.

"use client";

import { listAccountDeviceKeysAction } from "@/app/nex-native/_actions";

const TTL_MS = 60_000;

interface CachedDevices {
  devices: Array<{
    device_id: string;
    public_key: string;
    last_seen_at: string;
  }>;
  fetchedAt: number;
}

const cache = new Map<string, CachedDevices>();
const inflight = new Map<string, Promise<CachedDevices | null>>();

export type DeviceKeyResult =
  | { ok: true; devices: CachedDevices["devices"]; cached: boolean }
  | { ok: false; error: string };

export interface CachedListOptions {
  /** Bypass the TTL hit for this call. Still writes the fresh
   *  result back into the cache on success so future reads benefit.
   *  Used at send-time (R4 chat-race bounded fix 2026-11-17) so the
   *  peer-device list cannot be up to 60 s stale when the ciphertext
   *  fan-out plan is built. The 60 s TTL for compose-time reads is
   *  preserved; only the final pre-send fetch bypasses. */
  forceRefresh?: boolean;
}

/**
 * Cached wrapper. Returns devices from cache if fresh, otherwise
 * dedupes concurrent fetches so a burst of parallel encrypted sends
 * doesn't multiply DB reads.
 */
export async function cachedListDeviceKeys(
  accountId: string,
  options: CachedListOptions = {},
): Promise<DeviceKeyResult> {
  const now = Date.now();
  const hit = cache.get(accountId);
  if (!options.forceRefresh && hit && now - hit.fetchedAt < TTL_MS) {
    return { ok: true, devices: hit.devices, cached: true };
  }

  // Coalesce concurrent misses · every caller awaits the same promise.
  let pending = inflight.get(accountId);
  if (!pending) {
    pending = (async () => {
      const res = await listAccountDeviceKeysAction(accountId);
      if (!res.ok) return null;
      const record: CachedDevices = {
        devices: res.devices,
        fetchedAt: Date.now(),
      };
      cache.set(accountId, record);
      return record;
    })();
    inflight.set(accountId, pending);
    // Clear the inflight slot when done (success or error) so the
    // next real miss can start a fresh fetch.
    void pending.finally(() => {
      inflight.delete(accountId);
    });
  }

  const settled = await pending;
  if (!settled) {
    // Fall back to a direct call to surface the error message.
    const res = await listAccountDeviceKeysAction(accountId);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, devices: res.devices, cached: false };
  }
  return { ok: true, devices: settled.devices, cached: false };
}

/** Invalidate a single account's cache · used when we know a device
 *  key row was just written (e.g. after DeviceKeyHub upserts). */
export function invalidateDeviceKeyCache(accountId: string): void {
  cache.delete(accountId);
}

/** Wipe everything · sign-out or reset. */
export function clearDeviceKeyCache(): void {
  cache.clear();
  inflight.clear();
}
