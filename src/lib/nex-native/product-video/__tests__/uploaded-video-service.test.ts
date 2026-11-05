// src/lib/nex-native/live-broadcast/__tests__/uploaded-video-service.test.ts

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, chainBuilder, setResolver, lastInsertPayload } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const state: {
    resolver: () => Promise<unknown>;
    insertPayload: unknown;
  } = { resolver: async () => ({ data: null, error: null }), insertPayload: null };
  const b: Record<string, AnyFn> = {};
  const bFn = () => b;
  b.select = bFn as AnyFn;
  b.eq = bFn as AnyFn;
  b.not = bFn as AnyFn;
  b.order = bFn as AnyFn;
  b.limit = bFn as AnyFn;
  b.maybeSingle = bFn as AnyFn;
  b.single = bFn as AnyFn;
  b.insert = ((payload: unknown) => {
    state.insertPayload = payload;
    return b;
  }) as AnyFn;
  b.update = ((payload: unknown) => {
    state.insertPayload = payload;
    return b;
  }) as AnyFn;
  b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;
  return {
    fromMock: vi.fn(() => b),
    chainBuilder: b,
    setResolver: (fn: () => Promise<unknown>) => {
      state.resolver = fn;
    },
    lastInsertPayload: () => state.insertPayload,
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BUSINESS = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  fromMock.mockClear();
  setResolver(async () => ({ data: null, error: null }));
});

describe("publishUploadedVideo · fail-closed writes", () => {
  test("inserts a row with required fields · rights declaration enforced", async () => {
    setResolver(async () => ({
      data: {
        id: "v1",
        owner_account_id: OWNER,
        business_id: BUSINESS,
        title: "First live",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "owner/first.mp4",
        duration_seconds: 30,
        width: null,
        height: null,
        byte_size: 8141145,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "public",
        created_at: "2026-10-24T00:00:00Z",
        published_at: "2026-10-24T00:00:00Z",
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    const r = await publishUploadedVideo({
      ownerAccountId: OWNER,
      businessId: BUSINESS,
      title: "First live",
      storageObjectPath: "owner/first.mp4",
      byteSize: 8141145,
      durationSeconds: 30,
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      visibility: "public",
    });
    expect(r.rights_declaration).toBe("owner_content");
    expect(r.visibility).toBe("public");
    expect(r.published_at).not.toBeNull();
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.rights_declaration).toBe("owner_content");
    expect(payload.published_at).not.toBeNull();
    expect(payload.storage_bucket).toBe("nex-live-uploaded");
  });

  test("draft visibility · published_at is null", async () => {
    setResolver(async () => ({
      data: {
        id: "v2",
        owner_account_id: OWNER,
        business_id: null,
        title: "Draft",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "owner/draft.mp4",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "draft",
        created_at: "2026-10-24T00:00:00Z",
        published_at: null,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "Draft",
      storageObjectPath: "owner/draft.mp4",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      // visibility defaults to draft
    });
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.visibility).toBe("draft");
    expect(payload.published_at).toBeNull();
  });

  test("title length · empty rejected", async () => {
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await expect(
      publishUploadedVideo({
        ownerAccountId: OWNER,
        title: "   ",
        storageObjectPath: "x",
        rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      }),
    ).rejects.toThrow(/title must be 1\.\.120/);
  });

  test("title length · > 120 rejected", async () => {
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await expect(
      publishUploadedVideo({
        ownerAccountId: OWNER,
        title: "x".repeat(200),
        storageObjectPath: "x",
        rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      }),
    ).rejects.toThrow(/title must be 1\.\.120/);
  });

  test("caption trimmed + 500-char cap", async () => {
    setResolver(async () => ({
      data: {
        id: "v3",
        owner_account_id: OWNER,
        business_id: null,
        title: "x",
        caption: "x".repeat(500),
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "x",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "draft",
        created_at: "x",
        published_at: null,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "x",
      caption: "   " + "x".repeat(800) + "   ",
      storageObjectPath: "x",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
    });
    const payload = lastInsertPayload() as { caption: string };
    expect(payload.caption).toHaveLength(500);
  });

  test("whitespace-only caption → null", async () => {
    setResolver(async () => ({
      data: {
        id: "v4",
        owner_account_id: OWNER,
        business_id: null,
        title: "x",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "x",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "draft",
        created_at: "x",
        published_at: null,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "x",
      caption: "   ",
      storageObjectPath: "x",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
    });
    const payload = lastInsertPayload() as { caption: unknown };
    expect(payload.caption).toBeNull();
  });

  test("fail-closed · throws on PG error", async () => {
    setResolver(async () => ({
      data: null,
      error: { code: "23514", message: "check violation" },
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await expect(
      publishUploadedVideo({
        ownerAccountId: OWNER,
        title: "x",
        storageObjectPath: "x",
        rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      }),
    ).rejects.toThrow(/23514/);
  });
});

describe("listPublishedUploadedVideos · fail-open reads", () => {
  test("returns rows on success", async () => {
    setResolver(async () => ({
      data: [
        {
          id: "v1",
          owner_account_id: OWNER,
          business_id: null,
          title: "First",
          caption: null,
          storage_bucket: "nex-live-uploaded",
          storage_object_path: "a.mp4",
          duration_seconds: 30,
          width: null,
          height: null,
          byte_size: null,
          mime_type: "video/mp4",
          rights_declaration: "owner_content",
          source: "owner_upload",
          visibility: "public",
          created_at: "x",
          published_at: "x",
        },
      ],
      error: null,
    }));
    const { listPublishedUploadedVideos } = await import("../uploaded-video-service");
    const r = await listPublishedUploadedVideos({ limit: 5 });
    expect(r.length).toBe(1);
    expect(r[0]?.visibility).toBe("public");
  });

  test("fail-open · empty [] on error", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const { listPublishedUploadedVideos } = await import("../uploaded-video-service");
    const r = await listPublishedUploadedVideos();
    expect(r).toEqual([]);
  });

  test("clamps limit [1..50]", async () => {
    let capturedLimit: number | undefined;
    (chainBuilder as unknown as { limit: (n: number) => unknown }).limit = vi.fn((n: number) => {
      capturedLimit = n;
      return chainBuilder;
    });
    setResolver(async () => ({ data: [], error: null }));
    const { listPublishedUploadedVideos } = await import("../uploaded-video-service");
    await listPublishedUploadedVideos({ limit: 9999 });
    expect(capturedLimit).toBeLessThanOrEqual(50);
    await listPublishedUploadedVideos({ limit: 0 });
    expect(capturedLimit).toBeGreaterThanOrEqual(1);
  });
});

describe("softRemoveUploadedVideo", () => {
  test("flips visibility to 'removed' AND clears published_at", async () => {
    setResolver(async () => ({ data: null, error: null }));
    const { softRemoveUploadedVideo } = await import("../uploaded-video-service");
    await softRemoveUploadedVideo("vid-1", OWNER);
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.visibility).toBe("removed");
    expect(payload.published_at).toBeNull();
  });

  test("fail-closed · throws on PG error", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const { softRemoveUploadedVideo } = await import("../uploaded-video-service");
    await expect(softRemoveUploadedVideo("vid-1", OWNER)).rejects.toThrow(/boom/);
  });
});

describe("Migration 223 · source-shape invariants", () => {
  test("CHECK constraints are present", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sql = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "..", "nex-supabase", "migrations", "223_nex_uploaded_video.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CHECK \(char_length\(title\) BETWEEN 1 AND 120\)/);
    expect(sql).toMatch(
      /rights_declaration IN \('owner_content', 'licensed', 'public_domain'\)/,
    );
    expect(sql).toMatch(
      /visibility IN \('draft', 'public', 'unlisted', 'removed'\)/,
    );
    expect(sql).toMatch(
      /mime_type IN \('video\/mp4', 'video\/webm', 'video\/quicktime'\)/,
    );
    // Published_at consistency check.
    expect(sql).toMatch(
      /\(visibility = 'public' OR visibility = 'unlisted'\) = \(published_at IS NOT NULL\)/,
    );
    // No DELETE policy for authenticated.
    expect(sql).not.toMatch(/FOR DELETE[\s\S]*?TO authenticated/);
    // Status: unapplied.
    expect(sql).toMatch(/NOT YET APPLIED/);
  });
});

// ─── Owner directive 2026-10-25 · Migration 221 · AI-generated flag ──

describe("publishUploadedVideo · is_ai_generated · Migration 221", () => {
  test("isAiGenerated=true · insert payload carries the flag · row returns it", async () => {
    setResolver(async () => ({
      data: {
        id: "v-ai",
        owner_account_id: OWNER,
        business_id: null,
        title: "AI video",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "owner/ai.mp4",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "public",
        created_at: "2026-10-25T00:00:00Z",
        published_at: "2026-10-25T00:00:00Z",
        country_of_origin: "ID",
        topic_tags: [],
        is_ai_generated: true,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    const r = await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "AI video",
      storageObjectPath: "owner/ai.mp4",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      visibility: "public",
      isAiGenerated: true,
    });
    expect(r.is_ai_generated).toBe(true);
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.is_ai_generated).toBe(true);
  });

  test("isAiGenerated omitted · insert payload defaults to false", async () => {
    setResolver(async () => ({
      data: {
        id: "v-human",
        owner_account_id: OWNER,
        business_id: null,
        title: "Human video",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "owner/h.mp4",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "public",
        created_at: "2026-10-25T00:00:00Z",
        published_at: "2026-10-25T00:00:00Z",
        country_of_origin: "ID",
        topic_tags: [],
        is_ai_generated: false,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "Human video",
      storageObjectPath: "owner/h.mp4",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      visibility: "public",
    });
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.is_ai_generated).toBe(false);
  });

  test("isAiGenerated=truthy-non-boolean · normalises to false (defence)", async () => {
    setResolver(async () => ({
      data: {
        id: "v-defence",
        owner_account_id: OWNER,
        business_id: null,
        title: "Defence",
        caption: null,
        storage_bucket: "nex-live-uploaded",
        storage_object_path: "owner/d.mp4",
        duration_seconds: null,
        width: null,
        height: null,
        byte_size: null,
        mime_type: "video/mp4",
        rights_declaration: "owner_content",
        source: "owner_upload",
        visibility: "draft",
        created_at: "2026-10-25T00:00:00Z",
        published_at: null,
        country_of_origin: "ID",
        topic_tags: [],
        is_ai_generated: false,
      },
      error: null,
    }));
    const { publishUploadedVideo } = await import("../uploaded-video-service");
    await publishUploadedVideo({
      ownerAccountId: OWNER,
      title: "Defence",
      storageObjectPath: "owner/d.mp4",
      rightsDeclaration: "owner_content",
      countryOfOrigin: "ID",
      // Simulate a misbehaving client: cast a non-boolean through
      // the typed interface. The service's `=== true` guard turns
      // every non-exactly-true value into false.
      isAiGenerated: 1 as unknown as boolean,
    });
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload.is_ai_generated).toBe(false);
  });

  test("Migration 221 SQL · schema shape sanity · additive, idempotent, no backfill", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sql = readFileSync(
      path.resolve(
        process.cwd(),
        "nex-supabase/migrations/221_nex_uploaded_video_is_ai_generated.sql",
      ),
      "utf8",
    );
    // Additive column with NOT NULL + DEFAULT false.
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false/,
    );
    // No backfill UPDATE statements (the DEFAULT handles pre-existing rows).
    expect(sql).not.toMatch(/^UPDATE\s+public\.nex_uploaded_video/m);
    // Comment is sealed with the owner's wording.
    expect(sql).toMatch(/COMMENT ON COLUMN public\.nex_uploaded_video\.is_ai_generated/);
    // Migration history insert · idempotent.
    expect(sql).toMatch(/INSERT INTO nex_migration_history/);
    expect(sql).toMatch(/ON CONFLICT \(version\) DO NOTHING/);
    // Explicit NEX NO-CLAIM wording for unlabelled videos.
    expect(sql).toMatch(/no claim about unlabelled videos being human-authored/i);
    // Status: unapplied.
    expect(sql).toMatch(/NOT YET APPLIED/);
  });
});
