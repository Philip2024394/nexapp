// src/lib/nex-native/location/replay-protection.ts
//
// NEX Location Sharing · Phase 1A · replay + freshness guards.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Memory-only · scoped to the current page/tab lifetime. A set tracks
// seen nonces per sender_device_id so a captured broadcast replayed
// within the same session is rejected. A freshness window on the
// envelope's `broadcast_at` rejects stale broadcasts regardless of
// whether the nonce has been seen.
//
// Documented limitation (owner condition 5): the set resets when the
// user reloads or closes the tab. Within the 30-min freshness window
// after a restart, a captured broadcast could replay ONCE. This is
// acceptable per the authorisation · persistent ledger deferred.

export interface FreshnessCheckInput {
  /** Envelope field · UPDATED on every retry · drives freshness. */
  readonly broadcastAtMs: number;
  readonly nowMs: number;
  /** Default 30 min · tightens the exploitation window after a reload. */
  readonly windowMs?: number;
  /** Future-dated tolerance for mild clock skew · default 5 min. */
  readonly futureTolMs?: number;
}

export type FreshnessResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "stale" | "future" | "invalid" };

export function checkFreshness(input: FreshnessCheckInput): FreshnessResult {
  const { broadcastAtMs, nowMs } = input;
  const windowMs = input.windowMs ?? 30 * 60 * 1000;
  const futureTolMs = input.futureTolMs ?? 5 * 60 * 1000;

  if (!Number.isFinite(broadcastAtMs)) {
    return { ok: false, reason: "invalid" };
  }
  const delta = nowMs - broadcastAtMs;
  if (delta < -futureTolMs) return { ok: false, reason: "future" };
  if (delta > windowMs) return { ok: false, reason: "stale" };
  return { ok: true };
}

export interface ReplayGuard {
  /** Returns true the FIRST time the nonce is seen for this sender · false
   *  on every subsequent call with the same key. */
  seen(senderDeviceId: string, nonceB64: string): boolean;
  /** Current size · for test visibility. */
  size(): number;
  /** Clear · only intended for tests. */
  _reset(): void;
}

/** Create a replay guard with an LRU cap. Keeps memory bounded if a
 *  pathological number of broadcasts arrives. Default 10k entries. */
export function createReplayGuard(maxEntries: number = 10_000): ReplayGuard {
  // Insertion-ordered Map used as LRU · touch on hit, evict oldest on
  // size overflow. Key: `${senderDeviceId}::${nonceB64}`.
  const seen = new Map<string, true>();

  return {
    seen(senderDeviceId, nonceB64) {
      const key = `${senderDeviceId}::${nonceB64}`;
      if (seen.has(key)) {
        // Touch for LRU: delete + re-insert.
        seen.delete(key);
        seen.set(key, true);
        return false;
      }
      seen.set(key, true);
      // Evict oldest when over cap.
      while (seen.size > maxEntries) {
        const first = seen.keys().next().value;
        if (first === undefined) break;
        seen.delete(first);
      }
      return true;
    },
    size() {
      return seen.size;
    },
    _reset() {
      seen.clear();
    },
  };
}
