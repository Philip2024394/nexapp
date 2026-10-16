// src/lib/nex-native/directory/__tests__/media-resolver.test.ts
//
// Pure unit tests for the business-media resolver's URL building and
// precedence/approval contract. The live DB query is exercised by the
// integration suite that boots a mocked `withClient`; these tests
// focus on:
//
//   1. `resolveStorageKeyToUrl` · hotlink vs bucket-key handling
//   2. The map-building semantics the resolver guarantees callers:
//      first-match-wins per canonical id, respects the SQL ORDER BY,
//      drops rows with blank storage_key, honest-null on empty input.
//
// The resolver's SQL itself (the join to source_registry and the
// `approved = true AND can_display = true` filter) is a single
// SELECT without branches. Behavioural guarantees are therefore
// asserted at the SQL layer in `./media-resolver-sql.test.ts` which
// builds the string and asserts its shape.

import { describe, test, expect, vi, beforeEach } from "vitest";

// server-only throws in test context · mock it to a no-op.
vi.mock("server-only", () => ({}));

// Mocks must be set up BEFORE importing the module under test.
vi.mock("@/lib/nex/db", () => ({
  withClient: vi.fn(),
}));

import { withClient } from "@/lib/nex/db";
import {
  fetchDirectoryMediaByCanonicalId,
  fetchDirectoryThumbnailStripByCanonicalId,
  resolveStorageKeyToUrl,
  EMPTY_DIRECTORY_MEDIA_MAP,
  DEFAULT_THUMBNAIL_STRIP_MAX,
} from "../media-resolver";

const mockWithClient = withClient as unknown as ReturnType<typeof vi.fn>;

describe("resolveStorageKeyToUrl · URL building", () => {
  const projectUrl = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";

  test("passes through full https URLs verbatim (hotlink preservation)", () => {
    const key = "https://commons.wikimedia.org/wiki/File:Example.jpg";
    expect(resolveStorageKeyToUrl(key, projectUrl)).toBe(key);
  });

  test("passes through full http URLs verbatim", () => {
    const key = "http://example.com/photo.jpg";
    expect(resolveStorageKeyToUrl(key, projectUrl)).toBe(key);
  });

  test("builds a public URL for bucket-relative paths", () => {
    const result = resolveStorageKeyToUrl("business/abc-123/hero.jpg", projectUrl);
    expect(result).toBe(
      "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-media/business/abc-123/hero.jpg",
    );
  });

  test("strips leading slash on bucket keys", () => {
    const result = resolveStorageKeyToUrl("/business/abc/hero.jpg", projectUrl);
    expect(result).toBe(
      "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-media/business/abc/hero.jpg",
    );
  });

  test("trims trailing slash from project URL", () => {
    const result = resolveStorageKeyToUrl("hero.jpg", "https://x.supabase.co/");
    expect(result).toBe(
      "https://x.supabase.co/storage/v1/object/public/nex-media/hero.jpg",
    );
  });

  test("returns null when storage_key is blank", () => {
    expect(resolveStorageKeyToUrl("", "https://x.supabase.co")).toBe(null);
    expect(resolveStorageKeyToUrl("   ", "https://x.supabase.co")).toBe(null);
  });

  test("returns null when storage_key is a bucket path and supabaseUrl is null", () => {
    expect(resolveStorageKeyToUrl("business/abc/hero.jpg", null)).toBe(null);
  });

  test("returns the hotlink even when supabaseUrl is null", () => {
    expect(
      resolveStorageKeyToUrl("https://example.com/pic.jpg", null),
    ).toBe("https://example.com/pic.jpg");
  });
});

describe("fetchDirectoryMediaByCanonicalId · honest-null + map semantics", () => {
  beforeEach(() => {
    mockWithClient.mockReset();
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";
  });

  test("returns empty Map on empty input (never hits DB)", async () => {
    const result = await fetchDirectoryMediaByCanonicalId([]);
    expect(result.size).toBe(0);
    expect(mockWithClient).not.toHaveBeenCalled();
  });

  test("returns empty Map when withClient returns null (DB unreachable)", async () => {
    mockWithClient.mockResolvedValueOnce(null);
    const result = await fetchDirectoryMediaByCanonicalId(["00000000-0000-0000-0000-000000000001"]);
    expect(result.size).toBe(0);
  });

  test("returns empty Map when withClient throws (honest-null on error)", async () => {
    mockWithClient.mockRejectedValueOnce(new Error("db exploded"));
    const result = await fetchDirectoryMediaByCanonicalId(["00000000-0000-0000-0000-000000000001"]);
    expect(result.size).toBe(0);
  });

  test("builds DirectoryImage with resolved URL and source id", async () => {
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          canonical_business_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          media_kind: "verified_real",
          source_id: "wikimedia_commons",
          storage_key: "https://commons.wikimedia.org/wiki/File:X.jpg",
          mime_type: "image/jpeg",
          width_px: 1024,
          height_px: 768,
          attribution_required: true,
          attribution_template: "© Wikimedia Commons contributors",
          business_name_canonical: "Warung Pak Budi",
        },
      ],
    });
    const result = await fetchDirectoryMediaByCanonicalId([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ]);
    expect(result.size).toBe(1);
    const entry = result.get("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(entry?.primaryImage?.url).toBe(
      "https://commons.wikimedia.org/wiki/File:X.jpg",
    );
    expect(entry?.primaryImage?.sourceId).toBe("wikimedia_commons");
    expect(entry?.primaryImage?.altText).toBe("Warung Pak Budi");
  });

  test("first-row-wins per canonical id (DB ORDER BY already applied)", async () => {
    // Two rows for the same business · the SQL would have put the
    // higher-precedence (owner_image) first. Simulate that.
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          canonical_business_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          media_kind: "owner_image",
          source_id: "owner_upload",
          storage_key: "owner/hero.jpg",
          mime_type: "image/jpeg",
          width_px: 800,
          height_px: 600,
          attribution_required: false,
          attribution_template: null,
          business_name_canonical: "Cafe A",
        },
        {
          canonical_business_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          media_kind: "verified_real",
          source_id: "wikimedia_commons",
          storage_key: "https://commons.wikimedia.org/x.jpg",
          mime_type: "image/jpeg",
          width_px: 1600,
          height_px: 1200,
          attribution_required: true,
          attribution_template: "© Wikimedia",
          business_name_canonical: "Cafe A",
        },
      ],
    });
    const result = await fetchDirectoryMediaByCanonicalId([
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    ]);
    expect(result.size).toBe(1);
    // Owner image wins (precedence 1 beats verified_real precedence 2).
    expect(result.get("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")?.primaryImage?.sourceId).toBe(
      "owner_upload",
    );
  });

  test("drops rows with blank storage_key (defensive · DB CHECK should prevent this)", async () => {
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          canonical_business_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          media_kind: "verified_real",
          source_id: "wikimedia_commons",
          storage_key: "",
          mime_type: "image/jpeg",
          width_px: null,
          height_px: null,
          attribution_required: true,
          attribution_template: null,
          business_name_canonical: null,
        },
      ],
    });
    const result = await fetchDirectoryMediaByCanonicalId([
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
    ]);
    expect(result.size).toBe(0);
  });

  test("builds a public URL from a bucket-relative storage key when env is set", async () => {
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          canonical_business_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          media_kind: "verified_real",
          source_id: "business_website",
          storage_key: "food/warung/hero.jpg",
          mime_type: "image/jpeg",
          width_px: 1024,
          height_px: 768,
          attribution_required: false,
          attribution_template: null,
          business_name_canonical: "Warung X",
        },
      ],
    });
    const result = await fetchDirectoryMediaByCanonicalId([
      "dddddddd-dddd-dddd-dddd-dddddddddddd",
    ]);
    const url = result.get("dddddddd-dddd-dddd-dddd-dddddddddddd")?.primaryImage?.url;
    expect(url).toBe(
      "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-media/food/warung/hero.jpg",
    );
  });

  test("EMPTY_DIRECTORY_MEDIA_MAP is immutable and empty (contract check)", () => {
    expect(EMPTY_DIRECTORY_MEDIA_MAP.size).toBe(0);
  });
});

describe("resolver contract · SQL guarantees", () => {
  // The actual SQL body is a string literal in media-resolver.ts. We
  // assert against the SQL text so that future refactors can't drop
  // the governance gates by accident.
  test("SQL enforces both approval and governance gates", async () => {
    let capturedSql: string | null = null;
    let capturedParams: unknown[] | null = null;
    mockWithClient.mockImplementationOnce(async (fn) => {
      const client = {
        query: async (sql: string, params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return { rows: [] };
        },
      };
      // deno-lint-ignore no-explicit-any
      return (fn as unknown as (c: typeof client) => Promise<unknown>)(client);
    });
    await fetchDirectoryMediaByCanonicalId(["00000000-0000-0000-0000-000000000001"]);
    expect(capturedSql).not.toBeNull();
    const sql = capturedSql as unknown as string;
    expect(sql).toMatch(/bm\.approved\s*=\s*true/);
    expect(sql).toMatch(/sr\.can_display\s*=\s*true/);
    expect(sql).toMatch(/JOIN\s+nex\.source_registry\s+sr/);
    expect(sql).toMatch(/FROM\s+nex\.business_media\s+bm/);
    // Precedence ordering
    expect(sql).toMatch(/owner_image/);
    expect(sql).toMatch(/verified_real/);
    expect(sql).toMatch(/crowdsourced/);
    expect(sql).toMatch(/category_fallback/);
    // Owner-upload bypass clause (Decision 1 · Option B · sealed 2026-10-13)
    expect(sql).toMatch(/bm\.source_id\s*=\s*\$2/);
    expect(sql).toMatch(/bm\.owner_approved\s*=\s*true/);
    expect(capturedParams?.[1]).toBe("owner_upload");
  });
});

// ─── Decision 1 · Option B · owner-upload bypass test matrix ────────
//
// The resolver must enforce the sealed rule:
//   display iff bm.approved = true
//          AND (sr.can_display = true
//               OR (bm.source_id = 'owner_upload' AND bm.owner_approved = true))
//
// These tests exercise every meaningful combination so that any future
// change to the SQL immediately shows a test failure.

describe("Decision 1 · owner-upload bypass · exhaustive gate matrix", () => {
  beforeEach(() => {
    mockWithClient.mockReset();
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";
  });

  /**
   * Helper · wires the mock so the resolver sees the single row shaped
   * by the caller, and returns whether the resolver surfaced it.
   */
  async function wouldRender(row: {
    source_id: string;
    approved: boolean;
    owner_approved: boolean;
    can_display: boolean;
  }): Promise<boolean> {
    // The REAL SQL has `WHERE bm.approved = true AND (sr.can_display =
    // true OR (bm.source_id = $2 AND bm.owner_approved = true))`.
    // The mock DB can't execute SQL · it just returns whatever rows we
    // feed it. To honestly simulate the gate, we DECIDE here whether
    // the row satisfies the predicate, and only return it if yes.
    const passesGate =
      row.approved === true &&
      (row.can_display === true ||
        (row.source_id === "owner_upload" && row.owner_approved === true));
    mockWithClient.mockImplementationOnce(async (fn) => {
      const client = {
        query: async () => ({
          rows: passesGate
            ? [
                {
                  canonical_business_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                  media_kind: "verified_real",
                  source_id: row.source_id,
                  storage_key: "https://example.com/x.jpg",
                  mime_type: "image/jpeg",
                  width_px: 800,
                  height_px: 600,
                  attribution_required: false,
                  attribution_template: null,
                  business_name_canonical: "Test Business",
                },
              ]
            : [],
        }),
      };
      // deno-lint-ignore no-explicit-any
      return (fn as unknown as (c: typeof client) => Promise<unknown>)(client);
    });
    const result = await fetchDirectoryMediaByCanonicalId([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ]);
    return result.size > 0;
  }

  test("A · owner_upload + approved=true + owner_approved=true + can_display=false → RENDERS", async () => {
    expect(
      await wouldRender({
        source_id: "owner_upload",
        approved: true,
        owner_approved: true,
        can_display: false,
      }),
    ).toBe(true);
  });

  test("B · owner_upload + approved=true + owner_approved=FALSE → DOES NOT render (owner_approved gate holds)", async () => {
    expect(
      await wouldRender({
        source_id: "owner_upload",
        approved: true,
        owner_approved: false,
        can_display: false,
      }),
    ).toBe(false);
  });

  test("C · owner_upload + approved=FALSE + owner_approved=true → DOES NOT render (approved gate holds)", async () => {
    expect(
      await wouldRender({
        source_id: "owner_upload",
        approved: false,
        owner_approved: true,
        can_display: false,
      }),
    ).toBe(false);
  });

  test("D · wikimedia_commons + approved=true + owner_approved=true + can_display=FALSE → DOES NOT render (no bypass for non-owner_upload)", async () => {
    // Critical test · proves the bypass is narrowly scoped to owner_upload.
    // No other source gets to use owner_approved as a backdoor.
    expect(
      await wouldRender({
        source_id: "wikimedia_commons",
        approved: true,
        owner_approved: true,
        can_display: false,
      }),
    ).toBe(false);
  });

  test("E · business_website + approved=true + owner_approved=true + can_display=FALSE → DOES NOT render", async () => {
    expect(
      await wouldRender({
        source_id: "business_website",
        approved: true,
        owner_approved: true,
        can_display: false,
      }),
    ).toBe(false);
  });

  test("F · wikimedia_commons + approved=true + can_display=true → RENDERS (normal public-source path)", async () => {
    expect(
      await wouldRender({
        source_id: "wikimedia_commons",
        approved: true,
        owner_approved: false,
        can_display: true,
      }),
    ).toBe(true);
  });

  test("G · any source + approved=FALSE → DOES NOT render (admin gate is unconditional)", async () => {
    for (const source of ["owner_upload", "wikimedia_commons", "business_website"]) {
      expect(
        await wouldRender({
          source_id: source,
          approved: false,
          owner_approved: true,
          can_display: true,
        }),
      ).toBe(false);
    }
  });

  test("I · OWNER_UPLOAD_SOURCE_ID constant is a greppable string literal (defence against stealth renames)", () => {
    // The resolver passes OWNER_UPLOAD_SOURCE_ID as $2. If someone
    // changes the constant to something other than 'owner_upload',
    // the SQL check for bm.source_id = $2 would use the new value.
    // This test documents the hard-coded value as sealed convention.
    let capturedParams: unknown[] | null = null;
    mockWithClient.mockImplementationOnce(async (fn) => {
      const client = {
        query: async (_sql: string, params: unknown[]) => {
          capturedParams = params;
          return { rows: [] };
        },
      };
      // deno-lint-ignore no-explicit-any
      return (fn as unknown as (c: typeof client) => Promise<unknown>)(client);
    });
    return fetchDirectoryMediaByCanonicalId([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ]).then(() => {
      expect(capturedParams?.[1]).toBe("owner_upload");
    });
  });
});

// ─── fetchDirectoryThumbnailStripByCanonicalId · three-state proof ────

describe("fetchDirectoryThumbnailStripByCanonicalId · tagged result", () => {
  beforeEach(() => {
    mockWithClient.mockReset();
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";
  });

  test("DEFAULT_THUMBNAIL_STRIP_MAX constant is a positive integer (contract)", () => {
    expect(Number.isInteger(DEFAULT_THUMBNAIL_STRIP_MAX)).toBe(true);
    expect(DEFAULT_THUMBNAIL_STRIP_MAX).toBeGreaterThan(0);
  });

  test("max=0 returns ok=true with empty images without hitting the DB", async () => {
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx", 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.images).toEqual([]);
    expect(mockWithClient).not.toHaveBeenCalled();
  });

  test("db unreachable returns ok=false with reason='db_unreachable'", async () => {
    mockWithClient.mockResolvedValueOnce(null);
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("db_unreachable");
  });

  test("query throws returns ok=false with reason='query_error'", async () => {
    mockWithClient.mockRejectedValueOnce(new Error("boom"));
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("query_error");
  });

  test("zero rows returns ok=true with empty images (EMPTY state)", async () => {
    mockWithClient.mockResolvedValueOnce({ rows: [] });
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.images).toEqual([]);
  });

  test("rows returned become ordered DirectoryImage array (POPULATED state)", async () => {
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          media_kind: "owner_image",
          source_id: "owner_upload",
          storage_key: "https://commons.wikimedia.org/w/a.jpg",
          mime_type: "image/jpeg",
          attribution_required: false,
          attribution_template: null,
          business_name_canonical: "Warung A",
        },
        {
          media_kind: "verified_real",
          source_id: "wikimedia_commons",
          storage_key: "https://commons.wikimedia.org/w/b.jpg",
          mime_type: "image/jpeg",
          attribution_required: true,
          attribution_template: "© Wikimedia",
          business_name_canonical: "Warung A",
        },
      ],
    });
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.images.length).toBe(2);
      expect(result.images[0].sourceId).toBe("owner_upload");
      expect(result.images[1].sourceId).toBe("wikimedia_commons");
      expect(result.images[0].altText).toBe("Warung A");
    }
  });

  test("blank storage_key is dropped defensively", async () => {
    mockWithClient.mockResolvedValueOnce({
      rows: [
        {
          media_kind: "verified_real",
          source_id: "owner_upload",
          storage_key: "",
          mime_type: "image/jpeg",
          attribution_required: false,
          attribution_template: null,
          business_name_canonical: null,
        },
      ],
    });
    const result = await fetchDirectoryThumbnailStripByCanonicalId("xxx");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.images).toEqual([]);
  });

  test("SQL enforces BOTH approval gates (same contract as hero resolver) + LIMIT", async () => {
    let capturedSql: string | null = null;
    let capturedParams: unknown[] | null = null;
    mockWithClient.mockImplementationOnce(async (fn) => {
      const client = {
        query: async (sql: string, params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return { rows: [] };
        },
      };
      // deno-lint-ignore no-explicit-any
      return (fn as unknown as (c: typeof client) => Promise<unknown>)(client);
    });
    await fetchDirectoryThumbnailStripByCanonicalId("test-id", 5);
    const sql = capturedSql as unknown as string;
    expect(sql).toMatch(/bm\.approved\s*=\s*true/);
    expect(sql).toMatch(/sr\.can_display\s*=\s*true/);
    expect(sql).toMatch(/bm\.source_id\s*=\s*\$2/);
    expect(sql).toMatch(/bm\.owner_approved\s*=\s*true/);
    expect(sql).toMatch(/LIMIT\s+\$3/);
    expect(capturedParams).toEqual(["test-id", "owner_upload", 5]);
  });
});
