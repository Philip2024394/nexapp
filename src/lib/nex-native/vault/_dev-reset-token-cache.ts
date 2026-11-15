// src/lib/nex-native/vault/_dev-reset-token-cache.ts
//
// DEV / SANDBOX ONLY. In-process cache of plaintext Vault reset tokens
// keyed by account_id, used exclusively by the Playwright harness at
// `/api/_test/latest-reset-token`. Writes come from the dev-mode email
// sender; reads come from the harness route. Both are gated on NODE_ENV
// !== "production" AND a non-production Supabase project ref.
//
// Why in-process and not a DB column:
//   · The plaintext token is intentionally never persisted at rest
//     (production stores only SHA-256). Adding a plaintext column even
//     in sandbox would create a shape divergence between sandbox and
//     production DB schemas · worse engineering ergonomics.
//   · In-process Map is wiped on every dev-server restart · no stale
//     data · no file-system residue · no gitignore hygiene needed.
//
// Hard limits:
//   · The cache is NEVER read from production code paths. Only the
//     `/api/_test/*` harness reads it, and that route refuses to run
//     in production.
//   · Entries are automatically evicted after 60 minutes (longer than
//     the 30-minute token TTL) so the cache cannot grow unboundedly
//     across a long-running sandbox session.

import "server-only";

interface CacheEntry {
  tokenPlaintext: string;
  url: string;
  expiresAt: string;
  storedAt: number;
}

const CACHE: Map<string, CacheEntry> = new Map();
const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";

/** True when it is safe to read/write the dev cache · never both of
 *  (NODE_ENV=production) AND (NEX_SUPABASE_URL points at prod). */
export function devResetTokenCacheEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const url =
    process.env.NEX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
    "";
  if (!url) return false; // fail closed
  if (url.includes(PROD_REF)) return false;
  return true;
}

export function putDevResetToken(input: {
  accountId: string;
  tokenPlaintext: string;
  url: string;
  expiresAt: string;
}): void {
  if (!devResetTokenCacheEnabled()) return;
  evictStale();
  CACHE.set(input.accountId, {
    tokenPlaintext: input.tokenPlaintext,
    url: input.url,
    expiresAt: input.expiresAt,
    storedAt: Date.now(),
  });
}

export function readDevResetToken(accountId: string): {
  token: string;
  url: string;
  expires_at: string;
} | null {
  if (!devResetTokenCacheEnabled()) return null;
  evictStale();
  const entry = CACHE.get(accountId);
  if (!entry) return null;
  return {
    token: entry.tokenPlaintext,
    url: entry.url,
    expires_at: entry.expiresAt,
  };
}

function evictStale(): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [key, entry] of CACHE) {
    if (entry.storedAt < cutoff) CACHE.delete(key);
  }
}
