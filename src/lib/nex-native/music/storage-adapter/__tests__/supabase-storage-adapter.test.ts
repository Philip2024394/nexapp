// Owner-authorised 2026-11-01 (NEX Media Engine · Option A ·
// signed-URL cache). Focused vitest for the signed-URL cache + the
// invalidation hook. These tests pin the cache's contract so a
// future refactor cannot silently drop verified-remaining enforcement
// or tenant isolation.
//
// Scope:
//   1. cache miss then hit
//   2. identical URL for repeated calls
//   3. expiry safety margin · low-remaining entry treated as miss
//   4. expired / near-expiry URL triggers fresh mint
//   5. owner isolation · one owner can never read another owner's cache
//   6. different references · each gets its own cache slot
//   7. concurrent request deduplication
//   8. LRU capacity + eviction
//   9. explicit deletion invalidation
//  10. invalidation is pure cache-delete (the actions-layer "do not
//      invalidate on failed delete" contract is enforced by _actions.ts
//      · the adapter guarantees invalidate() has no Supabase side-effect)

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock state so vi.mock below can read + reset per-test.
const mockState = vi.hoisted(() => ({
  createSignedUrlCalls: [] as Array<{ objectPath: string; ttl: number }>,
  // When set, the next createSignedUrl call will yield this error.
  nextError: null as string | null,
  // When true, the next call returns `{data: null, error: null}` so
  // we can exercise the "no url returned" branch.
  nextReturnsNoData: false,
  // Set to a function to produce a custom response for a specific
  // call (e.g. a slow mint for the dedupe test).
  nextCustom: null as
    | null
    | ((objectPath: string, ttl: number) => Promise<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: async (objectPath: string, ttl: number) => {
          mockState.createSignedUrlCalls.push({ objectPath, ttl });
          if (mockState.nextCustom) {
            const fn = mockState.nextCustom;
            mockState.nextCustom = null;
            return fn(objectPath, ttl);
          }
          if (mockState.nextError) {
            const msg = mockState.nextError;
            mockState.nextError = null;
            return { data: null, error: { message: msg } };
          }
          if (mockState.nextReturnsNoData) {
            mockState.nextReturnsNoData = false;
            return { data: null, error: null };
          }
          // Default: a deterministic URL that encodes the call index
          // so two calls for the same object produce different URLs
          // (matches the real Supabase token-rotation behaviour).
          const index = mockState.createSignedUrlCalls.length;
          return {
            data: {
              signedUrl: `https://example.supabase.co/storage/v1/object/sign/nex-music-media/${objectPath}?token=call-${index}&ttl=${ttl}`,
            },
            error: null,
          };
        },
      }),
    },
  },
}));

import {
  supabaseMusicStorageAdapter,
  invalidateSignedUrlCache,
  __clearSignedUrlCacheForTests,
  __signedUrlCacheSizeForTests,
} from "../supabase-storage-adapter";

function ref(owner: string, key: string): string {
  return `sb://${owner}/${key}`;
}

beforeEach(() => {
  __clearSignedUrlCacheForTests();
  mockState.createSignedUrlCalls = [];
  mockState.nextError = null;
  mockState.nextReturnsNoData = false;
  mockState.nextCustom = null;
  vi.useRealTimers();
});

describe("supabase signed-URL cache · Option A", () => {
  it("1 · cache miss then hit · Supabase called once", async () => {
    const args = {
      reference: ref("owner-a", "cover-1"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    const first = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const second = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
    expect(first.signedUrl).toBe(second.signedUrl);
  });

  it("2 · identical URL for repeated calls (contract pin)", async () => {
    const args = {
      reference: ref("owner-a", "cover-2"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    const r1 = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const r2 = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const r3 = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(r1.signedUrl).toBe(r2.signedUrl);
    expect(r2.signedUrl).toBe(r3.signedUrl);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
  });

  it("3 · expiry safety margin · entry with < 10 min remaining treated as miss", async () => {
    const args = {
      reference: ref("owner-a", "cover-3"),
      // ttl 500 s < 600 s safety margin · entry is "already too close
      // to expiry" the moment it's stored.
      ownerAccountId: "owner-a",
      expiresInSeconds: 500,
    };
    const first = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const second = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    // Second call should bypass the cache (insufficient remaining)
    // and re-mint. Each mint rotates the fake token.
    expect(mockState.createSignedUrlCalls.length).toBe(2);
    expect(first.signedUrl).not.toBe(second.signedUrl);
  });

  it("4 · expired / near-expiry entry re-mints when queried after time passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const args = {
      reference: ref("owner-a", "cover-4"),
      ownerAccountId: "owner-a",
      // Full 3600 s TTL · expires at 13:00.
      expiresInSeconds: 3600,
    };
    const first = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
    // Advance 50 min · remaining is 10 min · at the safety margin
    // boundary (treated as insufficient · must re-mint).
    vi.setSystemTime(new Date("2026-11-01T12:50:01Z"));
    const second = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(2);
    expect(first.signedUrl).not.toBe(second.signedUrl);
  });

  it("5 · owner isolation · ownership mismatch throws before cache access", async () => {
    // Prime cache for owner-a.
    await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-5"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    // Owner-b trying to use owner-a's reference must throw ·
    // the ownership guard runs BEFORE the cache lookup.
    await expect(
      supabaseMusicStorageAdapter.getSignedReadUrl({
        reference: ref("owner-a", "cover-5"),
        ownerAccountId: "owner-b",
        expiresInSeconds: 3600,
      }),
    ).rejects.toThrow(/reference owner mismatch/);
    // The guard throws before any Supabase call OR cache touch.
    expect(mockState.createSignedUrlCalls.length).toBe(1); // only the prime
  });

  it("6 · different references · each gets its own cache slot", async () => {
    const a = await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-6a"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    const b = await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-6b"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    expect(mockState.createSignedUrlCalls.length).toBe(2);
    expect(a.signedUrl).not.toBe(b.signedUrl);
    // Second read of each · both hit the cache.
    const a2 = await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-6a"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    const b2 = await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-6b"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    expect(a.signedUrl).toBe(a2.signedUrl);
    expect(b.signedUrl).toBe(b2.signedUrl);
    expect(mockState.createSignedUrlCalls.length).toBe(2); // no extra calls
  });

  it("7 · concurrent request deduplication · one Supabase call shared", async () => {
    // Arrange: the mock defers its response so both callers can line
    // up on the inflight promise. Resolved via `resolveMint()` below.
    let resolveMint: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      resolveMint = r;
    });
    mockState.nextCustom = async (objectPath, ttl) => {
      await gate;
      return {
        data: {
          signedUrl: `https://example.supabase.co/storage/v1/object/sign/nex-music-media/${objectPath}?token=dedupe&ttl=${ttl}`,
        },
        error: null,
      };
    };
    const args = {
      reference: ref("owner-a", "cover-7"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    const p1 = supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const p2 = supabaseMusicStorageAdapter.getSignedReadUrl(args);
    const p3 = supabaseMusicStorageAdapter.getSignedReadUrl(args);
    // All three callers are now waiting on the same inflight mint.
    resolveMint!();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
    expect(r1.signedUrl).toBe(r2.signedUrl);
    expect(r2.signedUrl).toBe(r3.signedUrl);
    // Cache now populated · a fourth read also hits.
    const r4 = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
    expect(r4.signedUrl).toBe(r1.signedUrl);
  });

  it("8 · LRU capacity + eviction · oldest entry drops when cap exceeded", async () => {
    // CAP = 1000. Prime 1001 distinct entries.
    for (let i = 0; i < 1001; i++) {
      await supabaseMusicStorageAdapter.getSignedReadUrl({
        reference: ref("owner-a", `cover-${i}`),
        ownerAccountId: "owner-a",
        expiresInSeconds: 3600,
      });
    }
    expect(__signedUrlCacheSizeForTests()).toBe(1000);
    expect(mockState.createSignedUrlCalls.length).toBe(1001);
    // The first-ever key (cover-0) should have been evicted · reading
    // it now MUST re-mint.
    const callsBefore = mockState.createSignedUrlCalls.length;
    await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-0"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    expect(mockState.createSignedUrlCalls.length).toBe(callsBefore + 1);
    // But a recent key (cover-500) should still be cached (we primed
    // it most recently of the ones that survived).
    const beforeRead = mockState.createSignedUrlCalls.length;
    await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-500"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    expect(mockState.createSignedUrlCalls.length).toBe(beforeRead); // cache hit
  });

  it("9 · explicit deletion invalidation · entry drops · next call re-mints", async () => {
    const args = {
      reference: ref("owner-a", "cover-9"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    const first = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(1);
    // Invalidate matching key.
    invalidateSignedUrlCache("owner-a", ref("owner-a", "cover-9"));
    const second = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(2);
    expect(first.signedUrl).not.toBe(second.signedUrl);
  });

  it("9b · invalidation is tenant-scoped · wrong owner is a no-op", async () => {
    const args = {
      reference: ref("owner-a", "cover-9b"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    const first = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    // Invalidate with WRONG owner · must not touch owner-a's entry.
    invalidateSignedUrlCache("owner-b", ref("owner-a", "cover-9b"));
    const second = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(mockState.createSignedUrlCalls.length).toBe(1); // still cached
    expect(first.signedUrl).toBe(second.signedUrl);
  });

  it("9c · invalidation is idempotent and safe on unknown keys", async () => {
    // Called with no cache entry · no throw, no side-effect.
    expect(() =>
      invalidateSignedUrlCache("owner-a", ref("owner-a", "never-cached")),
    ).not.toThrow();
    // Called twice for the same key · no throw, cache stays absent.
    const args = {
      reference: ref("owner-a", "cover-9c"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    };
    await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    invalidateSignedUrlCache("owner-a", args.reference);
    invalidateSignedUrlCache("owner-a", args.reference);
    const after = await supabaseMusicStorageAdapter.getSignedReadUrl(args);
    expect(after.signedUrl).toBeDefined();
    expect(mockState.createSignedUrlCalls.length).toBe(2); // original + remint after invalidate
  });

  it("10 · invalidation has NO Supabase side-effect · pure cache-delete", async () => {
    // The actions-layer contract: do NOT invalidate on failed delete.
    // At the adapter level we pin the dual: `invalidateSignedUrlCache`
    // itself is a pure cache-delete · it does NOT touch Supabase at
    // all · so a mistaken call does not cascade to storage.
    const supabaseCallsBefore = mockState.createSignedUrlCalls.length;
    invalidateSignedUrlCache("owner-a", ref("owner-a", "cover-10"));
    invalidateSignedUrlCache("owner-a", ref("owner-a", "cover-10-also"));
    expect(mockState.createSignedUrlCalls.length).toBe(supabaseCallsBefore);
  });

  // ------------- Bad-input + error-path pins -------------

  it("rejects malformed references before any cache touch", async () => {
    await expect(
      supabaseMusicStorageAdapter.getSignedReadUrl({
        reference: "not-an-sb-reference",
        ownerAccountId: "owner-a",
        expiresInSeconds: 3600,
      }),
    ).rejects.toThrow(/bad reference/);
    expect(mockState.createSignedUrlCalls.length).toBe(0);
    expect(__signedUrlCacheSizeForTests()).toBe(0);
  });

  it("propagates Supabase errors without poisoning the cache", async () => {
    mockState.nextError = "simulated storage failure";
    await expect(
      supabaseMusicStorageAdapter.getSignedReadUrl({
        reference: ref("owner-a", "cover-err"),
        ownerAccountId: "owner-a",
        expiresInSeconds: 3600,
      }),
    ).rejects.toThrow(/simulated storage failure/);
    expect(__signedUrlCacheSizeForTests()).toBe(0);
    // Next successful call for the same key must call Supabase (no poisoned entry).
    const ok = await supabaseMusicStorageAdapter.getSignedReadUrl({
      reference: ref("owner-a", "cover-err"),
      ownerAccountId: "owner-a",
      expiresInSeconds: 3600,
    });
    expect(ok.signedUrl).toContain("token=");
    expect(__signedUrlCacheSizeForTests()).toBe(1);
  });
});
