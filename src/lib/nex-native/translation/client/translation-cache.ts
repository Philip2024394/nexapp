// src/lib/nex-native/translation/client/translation-cache.ts
//
// Bounded in-memory translation cache for the pilot.
// Owner-authorised 2026-11-17 · local verification only.
//
// Design constraints (per directive):
//   · Cache key = (accountId, conversationId, messageId, contentVersion, targetLang).
//     Switching target language does NOT reuse a cached translation
//     for a different target, so the UI toggle is correct.
//   · Toggling between translation/original NEVER causes a new fetch.
//     The original is held immutable at the call-site; this cache only
//     stores the translation side.
//   · Cleared on logout / account switch (`clearAll`).
//   · One account NEVER sees another's cached content — keys include
//     the viewer account id.
//   · Bounded size with LRU eviction so long sessions don't leak.
//   · Duplicate in-flight requests coalesce to a single provider call.
//
// This is a MODULE-LEVEL singleton · it is explicitly process-local.
// Multiple tabs each have their own instance (no shared-worker in this
// pilot). That is acceptable for the founder-only envelope.

export interface TranslationCacheKey {
  readonly accountId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly contentVersion: string;
  readonly targetLang: string;
}

export interface TranslationCacheValue {
  readonly translation: string;
  readonly detectedSourceLanguage: string | null;
  readonly fetchedAt: number;
}

const MAX_ENTRIES = 256;

function keyString(k: TranslationCacheKey): string {
  return [
    k.accountId,
    k.conversationId,
    k.messageId,
    k.contentVersion,
    k.targetLang,
  ].join("|");
}

// Map preserves insertion order · we treat it as an LRU by deleting
// and re-inserting on access.
const store = new Map<string, TranslationCacheValue>();
const inflight = new Map<string, Promise<TranslationCacheValue | null>>();

export function get(
  k: TranslationCacheKey,
): TranslationCacheValue | undefined {
  const sk = keyString(k);
  const hit = store.get(sk);
  if (!hit) return undefined;
  // LRU touch.
  store.delete(sk);
  store.set(sk, hit);
  return hit;
}

export function set(
  k: TranslationCacheKey,
  v: TranslationCacheValue,
): void {
  const sk = keyString(k);
  store.delete(sk);
  store.set(sk, v);
  while (store.size > MAX_ENTRIES) {
    // Oldest insertion = first key.
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

export function clearAll(): void {
  store.clear();
  inflight.clear();
}

/** Clears cache entries for every account OTHER THAN the one passed.
 *  Used on account switch so the new viewer never sees the previous
 *  user's cached translations. */
export function clearForOtherAccounts(keepAccountId: string): void {
  for (const sk of Array.from(store.keys())) {
    if (!sk.startsWith(`${keepAccountId}|`)) store.delete(sk);
  }
  for (const sk of Array.from(inflight.keys())) {
    if (!sk.startsWith(`${keepAccountId}|`)) inflight.delete(sk);
  }
}

/** Dedup wrapper · identical in-flight keys share a single promise. */
export async function dedup<T extends TranslationCacheValue | null>(
  k: TranslationCacheKey,
  fn: () => Promise<T>,
): Promise<T> {
  const sk = keyString(k);
  const existing = inflight.get(sk);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inflight.delete(sk);
  });
  inflight.set(sk, p as Promise<TranslationCacheValue | null>);
  return p;
}

export function _debugSize(): number {
  return store.size;
}

/** Returns the unique set of accountId prefixes currently held in the
 *  cache (store + inflight). Used by the logout cleanup path so accounts
 *  that have cached translations but never saved a preference key are
 *  still covered by the `account_logged_out` broadcast.
 *
 *  Safe · never throws · returns an empty array if the cache is empty.
 *  Order is not guaranteed and must not be relied on by callers. */
export function listKnownAccountIds(): string[] {
  const ids = new Set<string>();
  for (const sk of store.keys()) {
    const sep = sk.indexOf("|");
    if (sep <= 0) continue;
    ids.add(sk.slice(0, sep));
  }
  for (const sk of inflight.keys()) {
    const sep = sk.indexOf("|");
    if (sep <= 0) continue;
    ids.add(sk.slice(0, sep));
  }
  return Array.from(ids);
}
