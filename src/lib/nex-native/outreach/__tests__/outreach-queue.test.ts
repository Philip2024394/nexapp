// src/lib/nex-native/outreach/__tests__/outreach-queue.test.ts
//
// Phase 1.4 · outreach-queue tests. Covers:
//   · dormant by default (env + migration fail-safes)
//   · enqueue uses the sealed eligibility SQL (no bespoke WHERE)
//   · enqueue respects unique active-row constraint (idempotent)
//   · claim uses CTE + FOR UPDATE SKIP LOCKED + lease TTL
//   · mid-flight suppression flips to 'suppressed' without a send
//   · markSent / markFailed CAS on lease_owner (stale worker ignored)
//   · markFailed moves to dead_letter at attempts >= max_attempts

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
  enqueueEligibleContacts,
  claimForSend,
  markSent,
  markFailed,
  newWorkerId,
} from "../outreach-queue";
import { ELIGIBILITY_REQUIRED_TOKENS } from "../outreach-eligibility";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_OUTREACH_ENABLED;
});
afterEach(() => vi.clearAllMocks());

// ─── Dormancy + migration fail-safes ────────────────────────────────

describe("outreach-queue · dormant by default", () => {
  it("enqueue · env off → skipped=disabled · zero DB touches", async () => {
    const r = await enqueueEligibleContacts({ template_id: "intro-v1" });
    expect(r.skipped_reason).toBe("disabled");
    expect(r.inserted).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("claim · env off → skipped=disabled", async () => {
    const r = await claimForSend({ worker_id: "w1" });
    expect(r.skipped_reason).toBe("disabled");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("markSent · env off → skipped=disabled", async () => {
    const r = await markSent({ queue_id: "q", worker_id: "w" });
    expect(r.skipped_reason).toBe("disabled");
  });

  it("markFailed · env off → skipped=disabled", async () => {
    const r = await markFailed({
      queue_id: "q",
      worker_id: "w",
      error: "boom",
    });
    expect(r.skipped_reason).toBe("disabled");
  });
});

describe("outreach-queue · migration fail-safes", () => {
  it("enqueue · migration 202 absent", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ mig202: false, mig203: false }],
    });
    const r = await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("migration_202_absent");
  });

  it("enqueue · migration 203 absent", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ mig202: true, mig203: false }],
    });
    const r = await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("migration_203_absent");
  });

  it("claim · migration 203 absent", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ present: false }] });
    const r = await claimForSend({
      worker_id: "w1",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("migration_203_absent");
  });
});

// ─── Enqueue uses sealed eligibility SQL (no drift) ─────────────────

describe("enqueueEligibleContacts · uses sealed predicate", () => {
  it("the batch SELECT contains every one of the five safeguards", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] }); // no eligible rows
    await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    const batchSql = String(queryMock.mock.calls[1]![0]);
    for (const token of ELIGIBILITY_REQUIRED_TOKENS) {
      expect(batchSql).toContain(token);
    }
  });

  it("no eligible rows · skipped=no_eligible_rows", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("no_eligible_rows");
    expect(r.inserted).toBe(0);
  });

  it("one eligible row + successful insert → inserted=1", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "aaaa",
            email: "a@acme.co",
            country: "ID",
          },
        ],
      })
      // INSERT returned a row (uniqueness ok · new queue entry)
      .mockResolvedValueOnce({ rows: [{ queue_id: "q1" }] });
    const r = await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    expect(r.inserted).toBe(1);
    expect(r.skipped_eligible).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("eligible row BUT active-row-exists · skipped_eligible counted", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({
        rows: [
          { canonical_business_id: "bbbb", email: "b@acme.co", country: "ID" },
        ],
      })
      // ON CONFLICT DO NOTHING · zero rows returned.
      .mockResolvedValueOnce({ rows: [] });
    const r = await enqueueEligibleContacts({
      template_id: "intro-v1",
      bypassEnvGateForTests: true,
    });
    expect(r.inserted).toBe(0);
    expect(r.skipped_eligible).toBe(1);
  });
});

// ─── Atomic claim · CTE + FOR UPDATE SKIP LOCKED + lease ────────────

describe("claimForSend · atomic lease", () => {
  it("the claim SQL uses CTE + FOR UPDATE SKIP LOCKED + lease TTL", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // claim UPDATE
      .mockResolvedValueOnce({ rows: [] });
    await claimForSend({ worker_id: "w1", bypassEnvGateForTests: true });
    const claimSql = String(queryMock.mock.calls[1]![0]);
    expect(claimSql).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimSql).toContain("WITH cte AS (");
    expect(claimSql).toContain("lease_owner = $1");
    expect(claimSql).toContain("lease_expires_at = now()");
    // Reclaim-expired-lease clause.
    expect(claimSql).toMatch(/status = 'running'[\s\S]+?lease_expires_at < now\(\)/);
  });

  it("no claimable rows · skipped=no_claimable_rows", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await claimForSend({
      worker_id: "w1",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("no_claimable_rows");
    expect(r.claim).toBeUndefined();
  });

  it("happy path · returns claim with lease details", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            queue_id: "qid-1",
            canonical_business_id: "bc-1",
            email: "ok@acme.co",
            template_id: "intro-v1",
            payload: {},
            lease_owner: "w1",
            lease_expires_at: "2026-10-16T15:00:00Z",
          },
        ],
      })
      // Mid-flight suppression check · migration present + no row = not suppressed
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await claimForSend({
      worker_id: "w1",
      bypassEnvGateForTests: true,
    });
    expect(r.claim).toBeDefined();
    expect(r.claim!.queue_id).toBe("qid-1");
    expect(r.claim!.email).toBe("ok@acme.co");
    expect(r.suppressed_at_claim).toBeUndefined();
  });
});

// ─── Mid-flight suppression · belt + braces ─────────────────────────

describe("claimForSend · mid-flight suppression flips to 'suppressed'", () => {
  it("email suppressed between enqueue + claim · flips without sending", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] }) // migration check
      .mockResolvedValueOnce({
        rows: [
          {
            queue_id: "qid-2",
            canonical_business_id: "bc-2",
            email: "bounced@acme.co",
            template_id: "intro-v1",
            payload: {},
            lease_owner: "w1",
            lease_expires_at: "2026-10-16T15:00:00Z",
          },
        ],
      })
      // isSuppressed call · migration present + match
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "hard_bounce" }] })
      // UPDATE to status='suppressed'
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const r = await claimForSend({
      worker_id: "w1",
      bypassEnvGateForTests: true,
    });
    expect(r.claim).toBeUndefined();
    expect(r.suppressed_at_claim).toEqual({
      queue_id: "qid-2",
      email: "bounced@acme.co",
      reason: "hard_bounce",
    });
    // Final UPDATE SQL flips to suppressed (not sent).
    const finalSql = String(queryMock.mock.calls.at(-1)![0]);
    expect(finalSql).toContain("status = 'suppressed'");
    expect(finalSql).toContain("suppression_reason = $2");
    expect(finalSql).not.toContain("sent");
  });
});

// ─── markSent / markFailed · CAS on lease_owner ────────────────────

describe("markSent · CAS on lease_owner", () => {
  it("stale worker · lease_lost (zero rows affected)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // UPDATE returned rowCount 0 · stale lease.
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await markSent({
      queue_id: "q",
      worker_id: "stale-worker",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("lease_lost");
    expect(r.affected).toBe(0);
  });

  it("fresh worker · 1 row affected", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const r = await markSent({
      queue_id: "q",
      worker_id: "live-worker",
      bypassEnvGateForTests: true,
    });
    expect(r.affected).toBe(1);
    expect(r.skipped_reason).toBeUndefined();
    const sql = String(queryMock.mock.calls[1]![0]);
    expect(sql).toContain("WHERE queue_id = $1");
    expect(sql).toContain("AND lease_owner = $2");
    expect(sql).toContain("AND status = 'running'");
  });
});

describe("markFailed · dead-letter path", () => {
  it("non-permanent failure · attempts<max → 'failed', else 'dead_letter' via CASE", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await markFailed({
      queue_id: "q",
      worker_id: "w",
      error: "transient",
      bypassEnvGateForTests: true,
    });
    const sql = String(queryMock.mock.calls[1]![0]);
    expect(sql).toContain("WHEN attempts >= max_attempts THEN 'dead_letter'");
    expect(sql).toContain("ELSE 'failed'");
  });

  it("permanent=true forces dead_letter", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await markFailed({
      queue_id: "q",
      worker_id: "w",
      error: "boom",
      permanent: true,
      bypassEnvGateForTests: true,
    });
    const bind = queryMock.mock.calls[1]![1]! as unknown[];
    expect(bind[2]).toBe(true);
  });

  it("stale worker · lease_lost", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await markFailed({
      queue_id: "q",
      worker_id: "stale",
      error: "boom",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("lease_lost");
  });
});

// ─── worker id helper ───────────────────────────────────────────────

describe("newWorkerId", () => {
  it("is unique across calls (uuid v4 suffix)", () => {
    const a = newWorkerId();
    const b = newWorkerId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^nex-worker:/);
  });
});

// ─── Doctrine anchor: migration 203 SQL structural check ────────────

describe("migration 203 · doctrine SQL anchors", () => {
  const MIG203 = fs.readFileSync(
    path.join(
      __dirname,
      "../../../../..",
      "nex-supabase/migrations/203_nex_outreach_queue_and_lease.sql",
    ),
    "utf8",
  );

  it("adds email_lease_token + email_lease_expires_at columns", () => {
    expect(MIG203).toMatch(/ADD COLUMN IF NOT EXISTS email_lease_token uuid/);
    expect(MIG203).toMatch(
      /ADD COLUMN IF NOT EXISTS email_lease_expires_at timestamptz/,
    );
  });

  it("creates business_outreach_suppression with reason CHECK", () => {
    expect(MIG203).toContain("CREATE TABLE IF NOT EXISTS nex.business_outreach_suppression");
    expect(MIG203).toContain(
      "CHECK (reason IN ('hard_bounce', 'opt_out', 'admin_block', 'complaint'))",
    );
  });

  it("creates business_outreach_queue with status + email CHECK + unique active-row", () => {
    expect(MIG203).toContain("CREATE TABLE IF NOT EXISTS nex.business_outreach_queue");
    expect(MIG203).toContain(
      "CHECK (status IN ('pending','running','sent','failed','suppressed','dead_letter'))",
    );
    expect(MIG203).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_boq_active_per_business_template[\s\S]+?WHERE status IN \('pending','running'\)/,
    );
  });

  it("adds the claimable partial index on business_canonical", () => {
    expect(MIG203).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_bc_email_lease_claimable[\s\S]+?WHERE[\s\S]+?qualification_status[\s\S]+?email_lease_token IS NULL/,
    );
  });
});
