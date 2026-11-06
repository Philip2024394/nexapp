// src/lib/nex-native/vault/__tests__/export-service.test.ts
//
// Phase 4 Batch 4.2 · Vault W5 · unit tests for the export-manifest
// service module. Covers:
//   · happy path: builds a manifest shape when files exist
//   · rate limit: throws NexVaultExportRateLimitError when a row exists
//     for today
//   · graceful fallback: when the rate-limit table doesn't exist
//     (PostgREST 42P01), the service proceeds without the limit

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Mock the Supabase admin client.
//
// `nexSupabaseAdmin.from(table)` must return a chainable query builder.
// `nexSupabaseAdmin.storage.from(bucket).createSignedUrls(paths, ttl)`
// must return `{ data, error }`.
//
// The per-test controls are exposed as `supabaseMockState` so each test
// can script the exact rows / errors it needs.
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown };

interface SupabaseMockState {
  // `from(table)` → .select(…).eq(…).{gte,lt,limit,order}(…) terminator
  // returns `fromResults[table]`. Each key may be either a single result
  // (used for all calls) or an array shifted per call.
  fromResults: Record<string, QueryResult | QueryResult[]>;
  insertResult: QueryResult;
  createSignedUrlsResult: QueryResult;
  // Captured calls for assertions.
  inserts: Array<{ table: string; payload: unknown }>;
}

const supabaseMockState: SupabaseMockState = {
  fromResults: {},
  insertResult: { data: null, error: null },
  createSignedUrlsResult: { data: [], error: null },
  inserts: [],
};

function resolveFromResult(table: string): QueryResult {
  const raw = supabaseMockState.fromResults[table];
  if (!raw) return { data: [], error: null };
  if (Array.isArray(raw)) {
    const next = raw.shift();
    return next ?? { data: [], error: null };
  }
  return raw;
}

function makeQueryBuilder(table: string): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lt = chain;
  builder.order = chain;
  builder.limit = () => Promise.resolve(resolveFromResult(table));
  // Thenable so `await builder` resolves too (used by `.order(...)` terminal).
  builder.then = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) => {
    try {
      resolve(resolveFromResult(table));
    } catch (e) {
      reject(e);
    }
  };
  builder.insert = (payload: unknown) => {
    supabaseMockState.inserts.push({ table, payload });
    return Promise.resolve(supabaseMockState.insertResult);
  };
  return builder;
}

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (table: string) => makeQueryBuilder(table),
    storage: {
      from: (_bucket: string) => ({
        createSignedUrls: (paths: string[], _ttl: number) => {
          const res = supabaseMockState.createSignedUrlsResult;
          // If no signed-url data is set, synthesize one-per-path.
          if (res.data === null || res.data === undefined || (Array.isArray(res.data) && res.data.length === 0)) {
            const synth = paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}`, error: null }));
            return Promise.resolve({ data: synth, error: res.error });
          }
          return Promise.resolve(res);
        },
      }),
    },
  },
}));

// Fresh import AFTER mocks are set up.
import {
  buildExportManifest,
  checkVaultExportRateLimit,
  NexVaultExportRateLimitError,
  VAULT_EXPORT_SIGNED_URL_TTL_SECONDS,
} from "../export-service";

const ACCOUNT = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  supabaseMockState.fromResults = {};
  supabaseMockState.insertResult = { data: null, error: null };
  supabaseMockState.createSignedUrlsResult = { data: [], error: null };
  supabaseMockState.inserts = [];
});

describe("buildExportManifest · happy path", () => {
  it("returns a manifest shape with one entry per Vault file", async () => {
    supabaseMockState.fromResults = {
      // Rate-limit check → no rows for today.
      nex_vault_export_log: { data: [], error: null },
      // File listing → two Vault files for this account.
      nex_vault_file: {
        data: [
          {
            id: "f1",
            account_id: ACCOUNT,
            category: "documents",
            folder_path: null,
            display_name: "resume.pdf",
            mime_type: "application/pdf",
            byte_size: 12345,
            bucket_path: `${ACCOUNT}/f1`,
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "f2",
            account_id: ACCOUNT,
            category: "photos",
            folder_path: "holidays/2026",
            display_name: "beach.jpg",
            mime_type: "image/jpeg",
            byte_size: 987654,
            bucket_path: `${ACCOUNT}/f2`,
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        error: null,
      },
    };

    const now = new Date("2026-11-06T12:00:00Z");
    const result = await buildExportManifest(ACCOUNT, now);

    expect(result.account_id).toBe(ACCOUNT);
    expect(result.generated_at).toBe(now.toISOString());
    expect(result.manifest).toHaveLength(2);

    expect(result.manifest[0]).toMatchObject({
      path: "documents/resume.pdf",
      size: 12345,
    });
    expect(result.manifest[0].signedUrl).toContain(`${ACCOUNT}/f1`);
    expect(result.manifest[1]).toMatchObject({
      path: "photos/holidays/2026/beach.jpg",
      size: 987654,
    });

    // Expiry = now + 24h
    const expectedExpiry = new Date(now.getTime() + VAULT_EXPORT_SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    expect(result.manifest[0].expiresAt).toBe(expectedExpiry);

    // Export logged.
    expect(supabaseMockState.inserts).toHaveLength(1);
    expect(supabaseMockState.inserts[0].table).toBe("nex_vault_export_log");
  });

  it("returns an empty manifest when the account has no Vault files", async () => {
    supabaseMockState.fromResults = {
      nex_vault_export_log: { data: [], error: null },
      nex_vault_file: { data: [], error: null },
    };
    const result = await buildExportManifest(ACCOUNT, new Date("2026-11-06T12:00:00Z"));
    expect(result.manifest).toEqual([]);
    // Still logged (one export per 24h even if zero files).
    expect(supabaseMockState.inserts).toHaveLength(1);
  });
});

describe("buildExportManifest · rate limit", () => {
  it("throws NexVaultExportRateLimitError when a row exists for today", async () => {
    supabaseMockState.fromResults = {
      nex_vault_export_log: {
        data: [{ id: "already-exported-today" }],
        error: null,
      },
    };

    const now = new Date("2026-11-06T12:00:00Z");
    await expect(buildExportManifest(ACCOUNT, now)).rejects.toBeInstanceOf(
      NexVaultExportRateLimitError,
    );

    // Should NOT have inserted a log row.
    expect(supabaseMockState.inserts).toHaveLength(0);
  });

  it("retryAfter on the error is the next UTC midnight", async () => {
    supabaseMockState.fromResults = {
      nex_vault_export_log: {
        data: [{ id: "x" }],
        error: null,
      },
    };
    const now = new Date("2026-11-06T12:00:00Z");
    try {
      await buildExportManifest(ACCOUNT, now);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(NexVaultExportRateLimitError);
      const err = e as NexVaultExportRateLimitError;
      expect(err.retryAfter).toBe("2026-11-07T00:00:00.000Z");
      expect(err.code).toBe("vault_export_rate_limited");
    }
  });
});

describe("buildExportManifest · graceful fallback when the rate-limit table is missing", () => {
  it("proceeds (skips limit) when nex_vault_export_log returns 42P01", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    supabaseMockState.fromResults = {
      // Rate-limit check fails with PostgREST 42P01 (relation missing).
      nex_vault_export_log: {
        data: null,
        error: {
          code: "42P01",
          message: 'relation "nex_vault_export_log" does not exist',
        },
      },
      nex_vault_file: {
        data: [
          {
            id: "f1",
            account_id: ACCOUNT,
            category: "documents",
            folder_path: null,
            display_name: "one.pdf",
            mime_type: "application/pdf",
            byte_size: 1,
            bucket_path: `${ACCOUNT}/f1`,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
    };
    // Also tell the insert path the table is missing (same shape).
    supabaseMockState.insertResult = {
      data: null,
      error: {
        code: "42P01",
        message: 'relation "nex_vault_export_log" does not exist',
      },
    };

    const result = await buildExportManifest(ACCOUNT, new Date("2026-11-06T12:00:00Z"));
    expect(result.manifest).toHaveLength(1);
    // Two warnings · one from the check, one from the insert.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("recognises PostgREST 'Could not find the table' phrasing as missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await checkVaultExportRateLimit(ACCOUNT);
    expect(res).toBe("ok"); // No fromResult set → default empty data → "ok"

    supabaseMockState.fromResults = {
      nex_vault_export_log: {
        data: null,
        error: {
          code: "",
          message: "Could not find the table 'public.nex_vault_export_log' in the schema cache",
        },
      },
    };
    const res2 = await checkVaultExportRateLimit(ACCOUNT);
    expect(res2).toBe("table_missing");
    warnSpy.mockRestore();
  });
});
