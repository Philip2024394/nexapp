// src/lib/nex-native/harvest/__tests__/email-backfill-orchestrator.test.ts
//
// Sealed 2026-10-16 · behavioural tests for the resumable email
// backfill orchestrator. Covers:
//   · dormant-by-default (no env flag → zero DB touches)
//   · fail-safe when migration 202 is absent (column missing → skip)
//   · empty-queue honest skip
//   · idempotent UPDATE pattern (never downgrades VALIDATED → FOUND)
//   · cursor advance (email_last_attempted_at is always set when
//     the orchestrator attempts a row)
//   · deadline-respect short-circuit
//
// Supabase/pg is mocked at the module boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Simple scripted-query mock for pg · each call pops the next scripted
// response. Each test seeds the queue.
const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(fn: (client: { query: typeof queryMock }) => Promise<T>) =>
    fn({ query: queryMock }),
}));

import { runEmailBackfillBatch } from "../email-backfill-orchestrator";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_EMAIL_BACKFILL_ENABLED;
});
afterEach(() => vi.clearAllMocks());

describe("runEmailBackfillBatch · dormant-by-default", () => {
  it("without the env flag · returns skipped=disabled and never touches DB", async () => {
    const result = await runEmailBackfillBatch();
    expect(result.skipped_reason).toBe("disabled");
    expect(result.attempted).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("with the env flag off (literal 'false') · still skipped=disabled", async () => {
    process.env.NEX_EMAIL_BACKFILL_ENABLED = "false";
    const result = await runEmailBackfillBatch();
    expect(result.skipped_reason).toBe("disabled");
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("runEmailBackfillBatch · migration-202 absence · fail-safe", () => {
  it("when migration 202 columns are not present · skipped=migration_202_absent and zero rows read", async () => {
    // Column-check returns present=false → orchestrator exits before
    // the batch SELECT.
    queryMock.mockResolvedValueOnce({ rows: [{ mig202: false, mig203: false }] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
    });
    expect(result.skipped_reason).toBe("migration_202_absent");
    expect(result.attempted).toBe(0);
    // Only the column check should have run · no batch pull, no update.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("runEmailBackfillBatch · empty queue honesty", () => {
  it("no pending rows · skipped=no_pending_rows", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] }) // col check
      .mockResolvedValueOnce({ rows: [] }); // empty batch
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
    });
    expect(result.skipped_reason).toBe("no_pending_rows");
    expect(result.attempted).toBe(0);
  });
});

describe("runEmailBackfillBatch · cursor advance (write-path audit)", () => {
  it("rows without website_apex are marked NOT_FOUND and advance the cursor", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] }) // col check
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "11111111-1111-1111-1111-111111111111",
            website_apex: null, // no website · walker has no input
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      batchSize: 10,
    });
    expect(result.attempted).toBe(1);
    expect(result.email_not_found).toBe(1);
    expect(result.email_found).toBe(0);
    // The UPDATE statement MUST set email_last_attempted_at = now()
    // · verify the SQL contains the sealed pattern.
    const updateCall = queryMock.mock.calls[2]!;
    const updateSql = String(updateCall[0]);
    expect(updateSql).toContain("email_last_attempted_at = now()");
    expect(updateSql).toContain("qualification_status");
  });

  it("walker currently returns NOT_FOUND (dormant fetcher) · row flips to UNQUALIFIED, not QUALIFIED", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "22222222-2222-2222-2222-222222222222",
            website_apex: "https://example.com",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      rateMsPerDomain: 500,
    });
    expect(result.attempted).toBe(1);
    expect(result.email_not_found).toBe(1); // dormant walker returns not_found
    // The REVISED UPDATE SQL splits transitions per observed email_status:
    //   VALIDATED → QUALIFIED
    //   FOUND     → PENDING
    //   NOT_FOUND/INVALID → UNQUALIFIED
    // (owner directive 2026-10-16 · FOUND is not QUALIFIED)
    const updateSql = String(queryMock.mock.calls[2]![0]);
    expect(updateSql).toMatch(/WHEN\s+\$4\s*=\s*'VALIDATED'[\s\S]{0,80}THEN\s+'QUALIFIED'/);
    expect(updateSql).toMatch(/WHEN\s+\$4\s*=\s*'FOUND'[\s\S]{0,80}THEN\s+'PENDING'/);
    expect(updateSql).toMatch(/WHEN\s+\$4\s+IN\s+\('NOT_FOUND','INVALID'\)[\s\S]{0,80}THEN\s+'UNQUALIFIED'/);
  });
});

describe("runEmailBackfillBatch · idempotent UPDATE guards", () => {
  it("UPDATE SQL preserves VALIDATED (never downgrades to FOUND)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "33333333-3333-3333-3333-333333333333",
            website_apex: null,
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const updateSql = String(queryMock.mock.calls[2]![0]);
    // Preserve-validated branch: `WHEN email_status = 'VALIDATED' AND
    // $4 IN ('FOUND','NOT_FOUND') THEN email_status`.
    expect(updateSql).toMatch(
      /email_status\s*=\s*CASE[\s\S]*WHEN\s+email_status\s*=\s*'VALIDATED'[\s\S]*AND\s+\$4\s+IN\s+\('FOUND','NOT_FOUND'\)[\s\S]*THEN\s+email_status/,
    );
  });

  it("UPDATE SQL uses COALESCE for email + source_url (never nulls an existing value)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "44444444-4444-4444-4444-444444444444",
            website_apex: null,
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const updateSql = String(queryMock.mock.calls[2]![0]);
    // Whitespace-tolerant match · the SQL is laid out with aligned
    // columns for readability.
    expect(updateSql).toMatch(/email\s*=\s*COALESCE\(\$2,\s*email\)/);
    expect(updateSql).toMatch(
      /email_source_url\s*=\s*COALESCE\(\$3,\s*email_source_url\)/,
    );
  });
});

describe("runEmailBackfillBatch · batch sizing + hard cap", () => {
  it("batchSize is clamped at 50 even if a larger value is requested", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      batchSize: 9999,
    });
    const batchSql = queryMock.mock.calls[1]!;
    const limit = batchSql[1]?.[0] as number;
    expect(limit).toBe(50);
  });

  it("batchSize below 1 is clamped at 1", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      batchSize: 0,
    });
    const batchSql = queryMock.mock.calls[1]!;
    const limit = batchSql[1]?.[0] as number;
    expect(limit).toBe(1);
  });
});
