// src/lib/nex-native/music/storage-adapter/supabase-storage-adapter.ts
//
// Owner-authorised 2026-10-31 (music-upload-audit · Phase B draft) ·
// production storage adapter against Supabase Storage.
//
// STATUS: DRAFT · NOT ENABLED by default. The factory in `index.ts`
// still returns the FS dev adapter in dev and THROWS in prod. This
// file is wired in only when:
//   1. H2 is sealed (sealed memory 2026-10-30 · "production storage
//      adapter · recommended Supabase Storage behind NEX proxy") AND
//   2. Env `NEX_MUSIC_STORAGE=supabase` is explicitly set AND
//   3. The owner has verified the bucket exists with the correct
//      policies.
//
// Design points (match the MusicMediaStorage contract · types.ts)
// ----------------------------------------------------------------
//   · One bucket `nex-music-media`. Objects live at
//     `{ownerAccountId}/{objectKey}` so RLS policies can gate on path
//     prefix if the bucket is ever opened up.
//   · `reference` is an opaque `sb://{ownerAccountId}/{objectKey}`
//     string. Callers never see Supabase URLs directly; the proxy
//     route `/api/nex-native/music/stream` continues to mint signed
//     reads, matching the fs-dev-adapter contract.
//   · Signed URLs are produced by `supabase.storage.createSignedUrl`
//     with a short TTL (<= 3600s per the type contract). Caller holds
//     ownership · we double-check ownership on every signed-URL
//     request.
//   · All methods use the service_role admin client (`nexSupabaseAdmin`).
//     Never a client-side anon key.
//
// NOT included · still owner decisions (unsealed)
//   · Bucket creation/migration (one-time ops task).
//   · RLS policies on storage.objects for this bucket.
//   · CDN / proxy / cache strategy.
//   · Lifecycle rules (expiry of orphan uploads).
//   · V7 verification against staging before enabling in prod.

import "server-only";
import type {
  MusicMediaStorage,
  PutObjectArgs,
  SignedReadUrlArgs,
  SignedReadUrlResult,
} from "./types";
import { nexSupabaseAdmin } from "../../supabase-admin";

const BUCKET = "nex-music-media";

// ====================================================================
// Owner-authorised 2026-11-01 · Signed-URL cache (Option A).
// --------------------------------------------------------------------
// Problem: `createSignedUrl` is non-idempotent · each call for the
// same storage object produces a different URL (different `exp` + HMAC
// signature). Confirmed empirically 2026-11-01 against Ireland
// localhost: slide N's `nextOwnerCoverUrl` and slide N+1's
// `coverSignedUrl` for the same object had identical object paths but
// different `token=` query strings. Browser HTTP cache keys on the
// full URL · the sibling-cover preload never produced a cache hit.
//
// Fix: an in-memory, bounded, LRU cache keyed by
// `${ownerAccountId}:${reference}`. Both call sites (`mintSigned` for
// the current slide, `mintUpNext` for the next slide) now share a
// single mint per key per container, so slide N's preload URL
// matches slide N+1's img URL on the same container.
//
// Important assumption (worth re-reading before any future change):
// `reference` is treated as a stable identifier for the storage
// object's identity (owner + objectKey · see parseReference below).
// Today there is NO same-reference content replacement path for
// music covers — a new upload creates a new objectKey → new
// reference → new cache key. If a future feature introduces
// in-place content replacement under an existing reference, that
// path MUST call `invalidateSignedUrlCache(ownerAccountId, reference)`
// or the cache will serve a URL that signs the correct access to the
// now-stale bytes.
//
// Cross-container limitation: Vercel scales horizontally. Each
// serverless container owns its own cache. Users whose consecutive
// swipes land on different containers see the pre-fix behaviour for
// that one transition. Within a warm container, URLs are stable.
// A shared cache (Vercel KV / Redis) is a follow-up if measurements
// show instance bouncing dominates — the public API here (one
// `invalidateSignedUrlCache` function) is swap-ready for that
// evolution.
// ====================================================================

const CACHE_SAFETY_MARGIN_MS = 600_000; // 10 min remaining required
const CACHE_MAX_ENTRIES = 1000;

interface CacheEntry {
  readonly signedUrl: string;
  readonly expiresAt: Date;
}

// Insertion-order Map used as an LRU. On hit, we delete + reinsert
// so the entry moves to the back. On overflow, Map.keys().next()
// yields the oldest key, which we evict.
const signedUrlCache = new Map<string, CacheEntry>();

// In-flight dedupe: concurrent misses for the same key share one
// Supabase round-trip. The entry is removed in the mint's `finally`
// so a settled promise never pins memory.
const inFlightMints = new Map<string, Promise<SignedReadUrlResult>>();

function cacheKey(ownerAccountId: string, reference: string): string {
  return `${sanitiseKeyPart(ownerAccountId)}:${reference}`;
}

function hasEnoughValidityLeft(entry: CacheEntry): boolean {
  return entry.expiresAt.getTime() - Date.now() >= CACHE_SAFETY_MARGIN_MS;
}

function evictOldestIfOverflow(): void {
  if (signedUrlCache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = signedUrlCache.keys().next().value;
  if (typeof oldest === "string") signedUrlCache.delete(oldest);
}

/** Public cache-invalidation hook. Call from any flow that deletes
 *  or (future) replaces the storage object identified by
 *  (ownerAccountId, reference). Accepts BOTH values so the invalidation
 *  contract matches the cache's tenant key exactly · passing only
 *  `reference` would risk accepting a mismatched owner.
 *
 *  Idempotent · safe to call multiple times with the same inputs.
 *  Safe to call for a non-`sb://` reference (no-op) · the caller does
 *  not need to filter by prefix. */
export function invalidateSignedUrlCache(
  ownerAccountId: string,
  reference: string,
): void {
  signedUrlCache.delete(cacheKey(ownerAccountId, reference));
}

/** Test-only hook. Clears both the cache and in-flight state.
 *  Named with the `__` prefix + `ForTests` suffix so grep for
 *  production use at code review surfaces any accidental call. */
export function __clearSignedUrlCacheForTests(): void {
  signedUrlCache.clear();
  inFlightMints.clear();
}

/** Test-only hook. Returns the current cache size without exposing
 *  entries · lets a test assert eviction / population without
 *  revealing signed URLs or tokens. */
export function __signedUrlCacheSizeForTests(): number {
  return signedUrlCache.size;
}

function sanitiseKeyPart(part: string): string {
  // Match the dev adapter's sanitiser so an owner_account_id or
  // object_key from the DB layer is accepted identically.
  return part.replace(/[^A-Za-z0-9._-]/g, "_");
}

function pathFor(ownerAccountId: string, objectKey: string): string {
  return `${sanitiseKeyPart(ownerAccountId)}/${sanitiseKeyPart(objectKey)}`;
}

function referenceFor(ownerAccountId: string, objectKey: string): string {
  return `sb://${sanitiseKeyPart(ownerAccountId)}/${sanitiseKeyPart(objectKey)}`;
}

function parseReference(
  ref: string,
): { ownerAccountId: string; objectKey: string } | null {
  if (!ref.startsWith("sb://")) return null;
  const rest = ref.slice(5);
  const parts = rest.split("/");
  if (parts.length !== 2) return null;
  const [owner, key] = parts;
  if (!owner || !key) return null;
  return {
    ownerAccountId: sanitiseKeyPart(owner),
    objectKey: sanitiseKeyPart(key),
  };
}

/** Owner-authorised 2026-10-31 · DRAFT · not enabled until H2 seal. */
export const supabaseMusicStorageAdapter: MusicMediaStorage = {
  async putObject(args: PutObjectArgs): Promise<{ reference: string }> {
    const objectPath = pathFor(args.ownerAccountId, args.objectKey);
    const { error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, args.bytes, {
        contentType: args.contentType,
        upsert: false, // owner_account_id/object_key is already unique
        cacheControl: "no-store", // signed URLs enforce freshness
      });
    if (error) {
      throw new Error(
        `supabase-music-storage.putObject(${objectPath}): ${error.message}`,
      );
    }
    return { reference: referenceFor(args.ownerAccountId, args.objectKey) };
  },

  async getSignedReadUrl(
    args: SignedReadUrlArgs,
  ): Promise<SignedReadUrlResult> {
    // Validate + ownership-check BEFORE any cache lookup so a bad
    // reference or owner-mismatch never shortcuts through the cache.
    // These checks are cheap pure-string operations.
    const parsed = parseReference(args.reference);
    if (!parsed) {
      throw new Error(
        `supabase-music-storage.getSignedReadUrl: bad reference ${args.reference}`,
      );
    }
    if (parsed.ownerAccountId !== sanitiseKeyPart(args.ownerAccountId)) {
      throw new Error(
        `supabase-music-storage.getSignedReadUrl: reference owner mismatch`,
      );
    }

    // Owner-authorised 2026-11-01 · signed-URL cache lookup.
    // The key is deliberately (ownerAccountId, reference) · owner
    // mismatch above already short-circuits, so hits always answer
    // the owner that minted the entry.
    const key = cacheKey(args.ownerAccountId, args.reference);
    const hit = signedUrlCache.get(key);
    if (hit && hasEnoughValidityLeft(hit)) {
      // LRU bump: delete + reinsert so the entry becomes "most recently
      // used" in insertion order · guarantees eviction prefers the
      // genuinely coldest key.
      signedUrlCache.delete(key);
      signedUrlCache.set(key, hit);
      return hit;
    }
    // Stale entry: drop it so a fresh mint replaces it below rather
    // than returning insufficient validity to the caller.
    if (hit) signedUrlCache.delete(key);

    // In-flight dedupe: if a concurrent request is already minting
    // the same key, reuse its promise. Rejection is shared too · the
    // caller sees the same error, which is semantically correct for
    // identical inputs.
    const existingInFlight = inFlightMints.get(key);
    if (existingInFlight) return existingInFlight;

    const ttl = Math.min(Math.max(args.expiresInSeconds, 1), 3600);
    const objectPath = `${parsed.ownerAccountId}/${parsed.objectKey}`;
    const minted = (async (): Promise<SignedReadUrlResult> => {
      try {
        const { data, error } = await nexSupabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(objectPath, ttl);
        if (error || !data) {
          throw new Error(
            `supabase-music-storage.createSignedUrl(${objectPath}): ${error?.message ?? "no url returned"}`,
          );
        }
        const result: SignedReadUrlResult = {
          signedUrl: data.signedUrl,
          expiresAt: new Date(Date.now() + ttl * 1000),
        };
        // Store the successful mint. Verified-remaining enforcement
        // happens on NEXT read, so we trust the fresh TTL here.
        signedUrlCache.set(key, result);
        evictOldestIfOverflow();
        return result;
      } finally {
        inFlightMints.delete(key);
      }
    })();
    inFlightMints.set(key, minted);
    return minted;
  },

  async deleteObject(args: { reference: string }): Promise<{
    deleted: boolean;
  }> {
    const parsed = parseReference(args.reference);
    if (!parsed) return { deleted: false };
    const objectPath = `${parsed.ownerAccountId}/${parsed.objectKey}`;
    const { error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .remove([objectPath]);
    if (error) {
      // Storage API returns success for non-existent paths · a real
      // error here (network, auth) is honest-to-report.
      return { deleted: false };
    }
    return { deleted: true };
  },

  async objectExists(args: {
    reference: string;
  }): Promise<{ exists: boolean; byteLength?: number }> {
    const parsed = parseReference(args.reference);
    if (!parsed) return { exists: false };
    // list() under the owner prefix with the exact key as a search is
    // the standard Supabase pattern (there is no direct `stat`).
    const { data, error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .list(parsed.ownerAccountId, { search: parsed.objectKey, limit: 1 });
    if (error || !data || data.length === 0) return { exists: false };
    const match = data.find((o) => o.name === parsed.objectKey);
    if (!match) return { exists: false };
    const size = (match.metadata as { size?: number } | null)?.size;
    return typeof size === "number"
      ? { exists: true, byteLength: size }
      : { exists: true };
  },
};
