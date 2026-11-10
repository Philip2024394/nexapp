// src/lib/nex-native/crypto/device-key-cache-v2.ts
//
// NEX device-key chat · in-memory cache v2.
// Owner-authorised 2026-11-10 (independent component · does NOT
// depend on any of the six open decisions in
// device-key-chat-decisions-2026-11-10.md).
// -----------------------------------------------------------------
// Thin wrapper over the existing device-key-cache.ts pattern:
//   · explicit TTL per (recipient_account_id, device_id) → public_key
//   · LRU cap to prevent unbounded growth under adversarial load
//   · invalidate(accountId) for immediate purge when a rotation event
//     arrives (e.g. a realtime notice that a device_key row was
//     upserted)
//   · pure in-memory · NOT persisted (I-1 is unaffected · public keys
//     are not sensitive, but the cache holds no secret material).
//
// Server-side helper. Not a client module. The existing
// device-key-cache.ts remains the client/browser wrapper.
//
// Invariants:
//   · No plaintext ever stored here. The cache only carries public
//     keys (opaque base64 strings) + timestamps.
//   · TTL is per entry, not per account. An invalidate() call purges
//     every entry for an account at once (fan-out rotation scenario).
//   · LRU eviction is deterministic by insertion order (JS Map
//     preserves insertion order; on access we re-insert to refresh
//     recency).

export interface DeviceKeyCacheEntry {
  accountId: string;
  deviceId: string;
  publicKey: string;
  insertedAt: number;
  expiresAt: number;
}

export interface DeviceKeyCacheV2Options {
  /** TTL in milliseconds for every entry. Default 60s matches the
   *  existing client cache for consistency. */
  ttlMs?: number;
  /** Maximum entries retained. Oldest-by-use evicted first. */
  maxEntries?: number;
  /** Clock override for deterministic tests. */
  now?: () => number;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 10_000;

function compositeKey(accountId: string, deviceId: string): string {
  return `${accountId}::${deviceId}`;
}

export class DeviceKeyCacheV2 {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  // JS Map preserves insertion order; we exploit that for LRU by
  // deleting + re-inserting on access.
  private readonly entries = new Map<string, DeviceKeyCacheEntry>();

  constructor(opts: DeviceKeyCacheV2Options = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = opts.now ?? Date.now;
  }

  /** Returns the cached public key, or null on miss / expiry. On
   *  hit, refreshes recency (LRU bump). On expiry, deletes the entry
   *  and returns null so the caller can fetch fresh. */
  get(accountId: string, deviceId: string): string | null {
    const key = compositeKey(accountId, deviceId);
    const entry = this.entries.get(key);
    if (!entry) return null;
    const now = this.now();
    if (now >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    // LRU bump: delete + re-insert to move to the newest slot.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.publicKey;
  }

  /** Insert or overwrite the cached public key for this
   *  (accountId, deviceId). Enforces LRU cap by evicting the oldest
   *  entry when at capacity. */
  set(accountId: string, deviceId: string, publicKey: string): void {
    const key = compositeKey(accountId, deviceId);
    const now = this.now();
    const entry: DeviceKeyCacheEntry = {
      accountId,
      deviceId,
      publicKey,
      insertedAt: now,
      expiresAt: now + this.ttlMs,
    };
    // Overwrite path: delete first so the re-insert moves it to the
    // newest slot (LRU recency).
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      // Evict the oldest (first-inserted) entry.
      const firstKey = this.entries.keys().next().value as string | undefined;
      if (firstKey !== undefined) this.entries.delete(firstKey);
    }
    this.entries.set(key, entry);
  }

  /** Purge every entry for one account. Called when a rotation event
   *  arrives and the caller cannot know which specific deviceIds for
   *  that account are affected. */
  invalidate(accountId: string): void {
    for (const key of Array.from(this.entries.keys())) {
      const entry = this.entries.get(key);
      if (entry && entry.accountId === accountId) {
        this.entries.delete(key);
      }
    }
  }

  /** Wipe everything. Test helper + session-reset helper. */
  clear(): void {
    this.entries.clear();
  }

  /** Current count · for test assertions. */
  size(): number {
    return this.entries.size;
  }
}
