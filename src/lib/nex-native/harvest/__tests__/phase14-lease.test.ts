// src/lib/nex-native/harvest/__tests__/phase14-lease.test.ts
//
// Phase 1.4 · atomic lease claim regression suite for the backfill
// orchestrator. Covers:
//
//   · migration 203 absent → legacy Phase 1.3 cursor path still works
//   · migration 203 present → claim uses CTE + FOR UPDATE SKIP LOCKED
//   · claim token is per-tick (fresh UUID) and bound as $3
//   · lease expiry is bound as $4 (milliseconds)
//   · result UPDATE carries CAS on email_lease_token
//   · result UPDATE clears the lease columns on success
//   · walker-exception recovery clears the lease (CAS on claim token)
//   · UPDATE-exception recovery clears the lease (CAS on claim token)
//   · claim re-eligibility: lease_token IS NULL OR lease_expires_at < now()

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("server-only", () => ({}));

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(
    fn: (c: { query: typeof queryMock }) => Promise<T>,
  ) => fn({ query: queryMock }),
}));

import {
  runEmailBackfillBatch,
  type FetchCandidate,
  type ValidateCandidate,
} from "../email-backfill-orchestrator";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_EMAIL_BACKFILL_ENABLED;
});
afterEach(() => vi.clearAllMocks());

const okMxValidator: ValidateCandidate = async (email, apex) => {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      status: "INVALID",
      reason: "format_rejected",
      checkedDomain: null,
      mxExchanges: [],
    };
  }
  const emailDomain = email.split("@")[1]!.toLowerCase();
  const apexHost = apex?.toLowerCase() ?? null;
  if (apexHost && (emailDomain === apexHost || emailDomain.endsWith(`.${apexHost}`))) {
    return {
      status: "VALIDATED",
      reason: "validated",
      checkedDomain: emailDomain,
      mxExchanges: ["mail"],
    };
  }
  return {
    status: "FOUND",
    reason: "third_party_source",
    checkedDomain: emailDomain,
    mxExchanges: [],
  };
};
const okFetcher: FetchCandidate = async (ctx) => ({
  email: `hello@${ctx.websiteApex}`,
  sourceUrl: `https://${ctx.websiteApex}`,
});

// ─── Legacy path · mig203 absent ────────────────────────────────────

describe("Phase 1.4 · migration 203 absent · legacy cursor path", () => {
  it("SELECT is the plain Phase 1.3 pattern (no CTE, no FOR UPDATE)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const selectSql = String(queryMock.mock.calls[1]![0]);
    expect(selectSql).not.toContain("FOR UPDATE SKIP LOCKED");
    expect(selectSql).not.toContain("WITH cte AS (");
    expect(selectSql).toContain("qualification_status = 'PENDING'");
  });

  it("result UPDATE has NO lease-token CAS", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-legacy",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    const updateSql = String(queryMock.mock.calls[2]![0]);
    expect(updateSql).not.toContain("email_lease_token");
  });

  it("recovery UPDATE has NO lease-token clear", async () => {
    const throwFetcher: FetchCandidate = async () => {
      throw new Error("walker boom");
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-legacy-2",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: throwFetcher,
      validate: okMxValidator,
    });
    const recoverySql = String(queryMock.mock.calls[2]![0]);
    expect(recoverySql).toContain("email_last_attempted_at = now()");
    expect(recoverySql).not.toContain("email_lease_token = NULL");
  });
});

// ─── mig203 present · CTE claim pattern ─────────────────────────────

describe("Phase 1.4 · migration 203 present · atomic claim", () => {
  it("the SELECT uses CTE + FOR UPDATE SKIP LOCKED + lease expiry bind", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      batchSize: 7,
    });
    const call = queryMock.mock.calls[1]!;
    const sql = String(call[0]);
    expect(sql).toContain("WITH cte AS (");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("email_lease_token      = $3::uuid");
    expect(sql).toContain("email_lease_expires_at = now() + ($4::integer || ' milliseconds')::interval");
    // The eligibility clause also admits expired-lease recovery.
    expect(sql).toContain("email_lease_token IS NULL");
    expect(sql).toContain("email_lease_expires_at < now()");
    // Binds: $1 = limit (clamped 7), $2 = cooldown days (7), $3 = uuid, $4 = ms
    const binds = call[1]! as unknown[];
    expect(binds[0]).toBe(7);
    expect(binds[1]).toBe(7);
    expect(typeof binds[2]).toBe("string"); // uuid
    expect(binds[3]).toBe(5 * 60 * 1000);
  });

  it("per-tick claim token is a fresh UUID (two ticks → two tokens)", async () => {
    // Tick 1
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const t1 = queryMock.mock.calls[1]![1]![2] as string;

    queryMock.mockReset();
    // Tick 2
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const t2 = queryMock.mock.calls[1]![1]![2] as string;

    expect(t1).not.toBe(t2);
    expect(t1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("result UPDATE carries CAS on email_lease_token and clears the lease", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-lease-1",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    const updateCall = queryMock.mock.calls[2]!;
    const sql = String(updateCall[0]);
    // CAS clause.
    expect(sql).toContain("AND email_lease_token = $5::uuid");
    // Lease cleared on success.
    expect(sql).toContain("email_lease_token       = NULL");
    expect(sql).toContain("email_lease_expires_at  = NULL");
    // Binds: $1 bcid, $2 email, $3 sourceUrl, $4 status, $5 claim token (uuid)
    const binds = updateCall[1]! as unknown[];
    expect(binds[0]).toBe("bc-lease-1");
    expect(binds[1]).toBe("hello@acme.co");
    expect(binds[3]).toBe("VALIDATED");
    expect(typeof binds[4]).toBe("string");
  });

  it("walker-exception recovery clears lease with CAS on claim token", async () => {
    const throwFetcher: FetchCandidate = async () => {
      throw new Error("walker boom");
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-lease-2",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: throwFetcher,
      validate: okMxValidator,
    });
    const sql = String(queryMock.mock.calls[2]![0]);
    expect(sql).toContain("email_lease_token = NULL");
    expect(sql).toContain("email_lease_expires_at = NULL");
    expect(sql).toContain("AND email_lease_token = $2::uuid");
    // Does NOT touch status / qualification_status.
    expect(sql).not.toContain("email_status =");
    expect(sql).not.toContain("qualification_status =");
  });

  it("UPDATE-exception recovery clears lease with CAS on claim token", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-lease-3",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      // Main UPDATE throws.
      .mockRejectedValueOnce(new Error("deadlock"))
      // Recovery UPDATE succeeds.
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const r = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    expect(r.errors).toBe(1);
    const recoverySql = String(queryMock.mock.calls[3]![0]);
    expect(recoverySql).toContain("email_lease_token = NULL");
    expect(recoverySql).toContain("AND email_lease_token = $2::uuid");
  });

  it("stale-worker drop · if the lease was already cleared, the main UPDATE's CAS no-ops · rowCount 0", async () => {
    // Simulate: another tick re-claimed this row (expired lease). Our
    // walker's result UPDATE affects zero rows because the CAS fails.
    // The orchestrator does NOT consider this a crash · the error
    // counter stays at 0 (no exception thrown). The row keeps the
    // fresh walker's lease untouched.
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-lease-4",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      // Main UPDATE returns rowCount 0 · CAS failed (fresh walker owns lease).
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    // We DO count the walker observation (email_found) even if the
    // CAS fails · that's a reasonable choice because the walker's
    // work completed; it just didn't land. HQ dashboard will see the
    // mismatch (attempted > DB-visible changes) if this ever becomes
    // common.
    expect(r.errors).toBe(0);
    expect(r.attempted).toBe(1);
    // Only three queries ran · no recovery UPDATE because the main
    // one didn't throw.
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
});

// ─── Phase 1.4.1 · lease-expiry CAS correctness ─────────────────────
//
// Three regression threads cover the finding that `email_lease_token`
// alone was insufficient when the lease expired without a concurrent
// reclaim. All three CAS clauses in the orchestrator now AND on
// `email_lease_expires_at > now()`.

describe("Phase 1.4.1 · lease-expiry CAS · structural anchors", () => {
  const ORCH = fs.readFileSync(
    path.join(__dirname, "../email-backfill-orchestrator.ts"),
    "utf8",
  );

  it("result UPDATE CAS requires BOTH token match AND unexpired lease", () => {
    expect(ORCH).toMatch(
      /WHERE canonical_business_id = \$1\s*\n\s*AND email_lease_token = \$5::uuid\s*\n\s*AND email_lease_expires_at > now\(\)/,
    );
  });

  it("walker-exception recovery CAS requires BOTH token AND unexpired lease", () => {
    // Pattern anchored on the walker-recovery UPDATE (token bound as $2).
    expect(ORCH).toMatch(
      /SET email_last_attempted_at = now\(\),\s*\n\s*email_lease_token = NULL,\s*\n\s*email_lease_expires_at = NULL\s*\n\s*WHERE canonical_business_id = \$1\s*\n\s*AND email_lease_token = \$2::uuid\s*\n\s*AND email_lease_expires_at > now\(\)/,
    );
  });

  it("UPDATE-exception recovery CAS requires BOTH token AND unexpired lease", () => {
    // There are TWO recovery UPDATEs in the orchestrator with the
    // same shape · counting occurrences of the strict CAS triplet.
    const strictCasOccurrences =
      ORCH.match(/AND email_lease_expires_at > now\(\)/g) ?? [];
    // Exactly three occurrences: result UPDATE + walker-recovery +
    // UPDATE-recovery. If a future refactor drops the clause from any
    // site, the count falls below 3 and this anchor fires.
    expect(strictCasOccurrences.length).toBe(3);
  });
});

describe("Phase 1.4.1 · expired-without-reclaim · stale walker is dropped", () => {
  it("result UPDATE returns rowCount 0 when lease expired · orchestrator does not error", async () => {
    // Simulate: walker claims, hangs past 5min, nothing else claims,
    // wakes up to write · DB-level CAS rejects (rowCount 0) because
    // email_lease_expires_at < now(). Orchestrator treats this
    // identically to a stale-token reject · attempt counted, no crash.
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-expired",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      // Main UPDATE returns rowCount 0 · lease expired, DB rejected.
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    // Walker ran, counter advanced; no exception bubbled; three
    // queries total (migration-check, claim-SELECT, result-UPDATE).
    expect(r.errors).toBe(0);
    expect(r.attempted).toBe(1);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("walker-exception recovery is also expiry-guarded", async () => {
    const throwFetcher: FetchCandidate = async () => {
      throw new Error("walker boom");
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-expired-walker",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      // Recovery UPDATE returns rowCount 0 · the walker's attempt to
      // clear its own lease was rejected because the lease had
      // already expired. The error counter still fires (walker threw).
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: throwFetcher,
      validate: okMxValidator,
    });
    expect(r.errors).toBe(1);
    expect(r.attempted).toBe(1);
    // Recovery UPDATE SQL carried the strict CAS.
    const recoverySql = String(queryMock.mock.calls[2]![0]);
    expect(recoverySql).toContain("AND email_lease_expires_at > now()");
  });
});

describe("Phase 1.4.1 · overlapping-claim · token-mismatch is still rejected", () => {
  it("rowCount 0 from CAS failure never increments the error counter · stale walker is silent", async () => {
    // Covers the case: tick A walking a row, tick B expires it and
    // reclaims (new token), tick A tries to write result. Token
    // AND/OR expiry mismatch · rowCount 0.
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "bc-overlap",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: okFetcher,
      validate: okMxValidator,
    });
    // Error counter stays at 0 (no exception thrown · the CAS silently
    // discards the stale write).
    expect(r.errors).toBe(0);
    // Walker's observation IS counted toward email_found (walker's
    // work completed, even though its write didn't land). HQ dashboard
    // will see attempted > DB-visible-changes if this is frequent.
    expect(r.email_found).toBe(1);
  });

  it("two consecutive ticks generate different claim tokens → tick B's SELECT would exclude tick A's unexpired row", async () => {
    // Behavioural proof via the orchestrator's actual UUID generator.
    // (The CTE's eligibility clause skips rows whose lease is still
    // valid · another test already locks that in; this test is a
    // defensive restatement that per-tick tokens are not pooled or
    // reused.)
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const t1 = queryMock.mock.calls[1]![1]![2] as string;
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true });
    const t2 = queryMock.mock.calls[1]![1]![2] as string;
    expect(t1).not.toBe(t2);
  });
});

// ─── Doctrine anchor: lease TTL constant + migration file text ──────

describe("Phase 1.4 · lease configuration anchors", () => {
  const ORCH = fs.readFileSync(
    path.join(
      __dirname,
      "../email-backfill-orchestrator.ts",
    ),
    "utf8",
  );

  it("WALKER_LEASE_MS is set to 5 minutes", () => {
    expect(ORCH).toMatch(/WALKER_LEASE_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  });

  it("migration 203 presence check uses a single SELECT with two EXISTS probes", () => {
    expect(ORCH).toMatch(
      /SELECT\s*\n\s*EXISTS\([\s\S]+?qualification_status[\s\S]+?\) AS mig202,\s*\n\s*EXISTS\([\s\S]+?email_lease_token[\s\S]+?\) AS mig203/,
    );
  });

  it("claim token is generated once per tick via randomUUID", () => {
    expect(ORCH).toContain(
      "const claimToken = mig203 ? randomUUID() : null;",
    );
  });
});
