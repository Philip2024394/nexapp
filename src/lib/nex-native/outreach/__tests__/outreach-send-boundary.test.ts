// src/lib/nex-native/outreach/__tests__/outreach-send-boundary.test.ts
//
// Phase 1.4.1 · regression suite for the sanctioned send-boundary
// suppression interface `markSuppressedAtSendBoundary`.
//
// Scope (owner directive):
//   · dormant env gate
//   · migration 203 absent → fail-safe
//   · defence-in-depth · caller cannot flip a non-suppressed row
//   · stale lease (lease_lost · CAS failed)
//   · successful transition · writes the suppression table too
//   · idempotent re-call · suppression table ON CONFLICT DO NOTHING
//   · reason is resolved from the suppression table when disagree

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(
    fn: (c: { query: typeof queryMock }) => Promise<T>,
  ) => fn({ query: queryMock }),
}));

import { markSuppressedAtSendBoundary } from "../outreach-queue";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_OUTREACH_ENABLED;
});
afterEach(() => vi.clearAllMocks());

// ─── Dormancy + migration fail-safes ────────────────────────────────

describe("markSuppressedAtSendBoundary · dormant by default", () => {
  it("env off → skipped=disabled · zero DB touches", async () => {
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q1",
      worker_id: "w1",
      email: "x@y.co",
      reason: "hard_bounce",
    });
    expect(r.skipped_reason).toBe("disabled");
    expect(r.affected).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("markSuppressedAtSendBoundary · migration 203 absent", () => {
  it("isSuppressed probe reports migration absent → function propagates", async () => {
    // First query is the migration-check inside isSuppressed.
    queryMock.mockResolvedValueOnce({ rows: [{ present: false }] });
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q1",
      worker_id: "w1",
      email: "x@y.co",
      reason: "hard_bounce",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("migration_203_absent");
    expect(r.affected).toBe(0);
    // Only the suppression-table-probe ran · no queue UPDATE.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Defence-in-depth · caller claims suppression but table disagrees

describe("markSuppressedAtSendBoundary · defence-in-depth", () => {
  it("caller claims suppressed but table says no · function records then re-checks · still no → not_suppressed", async () => {
    // 1 · isSuppressed migration-check
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 2 · isSuppressed SELECT · no row
      .mockResolvedValueOnce({ rows: [] })
      // 3 · recordHardBounce · migration-check inside outreach-suppression
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 4 · recordHardBounce · INSERT with ON CONFLICT DO NOTHING ·
      //     if the write actually lands, rows contains the id. We
      //     simulate that the write SUCCEEDED (fresh insert).
      .mockResolvedValueOnce({ rows: [{ suppression_id: "s1" }] })
      // 5 · isSuppressed migration-check (second round)
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 6 · isSuppressed SELECT (second round) · simulate the row
      //     STILL isn't visible (race · txn isolation · test seam).
      //     Function should decline the state change.
      .mockResolvedValueOnce({ rows: [] });
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q1",
      worker_id: "w1",
      email: "mystery@acme.co",
      reason: "hard_bounce",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("not_suppressed");
    expect(r.affected).toBe(0);
    // No queue UPDATE was attempted.
    expect(queryMock).toHaveBeenCalledTimes(6);
    const allSql = queryMock.mock.calls.map((c) => String(c[0]));
    expect(allSql.some((sql) => sql.includes("UPDATE nex.business_outreach_queue"))).toBe(false);
  });

  it("caller claims suppressed, table disagrees, but second check SUCCEEDS → flips through", async () => {
    // Models the real race: suppression webhook landed just as the
    // send-worker checked; function records (idempotent) and then
    // the second isSuppressed sees the row.
    queryMock
      // 1-2 · initial isSuppressed · not found
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] })
      // 3-4 · recordHardBounce
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ suppression_id: "s1" }] })
      // 5-6 · second isSuppressed · now suppressed
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "hard_bounce" }] })
      // 7 · queue migration-check
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 8 · UPDATE queue → status='suppressed'
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      // 9-10 · post-UPDATE recordHardBounce (idempotent second call)
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 10 · INSERT · ON CONFLICT DO NOTHING · zero rows returned
      .mockResolvedValueOnce({ rows: [] });
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q1",
      worker_id: "w1",
      email: "mystery@acme.co",
      reason: "hard_bounce",
      bypassEnvGateForTests: true,
    });
    expect(r.affected).toBe(1);
    expect(r.recorded_suppression?.reason).toBe("hard_bounce");
    expect(r.recorded_suppression?.inserted).toBe(false); // second call
  });
});

// ─── Happy path · caller's suppression matches the table ────────────

describe("markSuppressedAtSendBoundary · happy path", () => {
  it("table already has the row · function flips queue + idempotent re-record", async () => {
    queryMock
      // 1-2 · initial isSuppressed · found
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "opt_out" }] })
      // 3 · queue migration-check
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 4 · UPDATE queue
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      // 5-6 · recordSuppressionBoundary · opt_out helper
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q2",
      worker_id: "w2",
      email: "someone@acme.co",
      reason: "opt_out",
      bypassEnvGateForTests: true,
    });
    expect(r.affected).toBe(1);
    expect(r.recorded_suppression?.reason).toBe("opt_out");
    expect(r.recorded_suppression?.inserted).toBe(false);
    // The UPDATE SQL carried the CAS on lease_owner AND status='running'.
    const updateSql = String(queryMock.mock.calls[3]![0]);
    expect(updateSql).toContain("UPDATE nex.business_outreach_queue");
    expect(updateSql).toContain("status = 'suppressed'");
    expect(updateSql).toContain("WHERE queue_id = $1");
    expect(updateSql).toContain("AND lease_owner = $2");
    expect(updateSql).toContain("AND status = 'running'");
  });

  it("resolved reason comes from the SUPPRESSION TABLE, not the caller · when they disagree", async () => {
    // The caller observed 'hard_bounce' but the table says 'opt_out'
    // (e.g. user clicked unsubscribe between the ESP bounce webhook
    // firing and our worker processing). Table wins · recipient
    // intent trumps provider failure classification.
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "opt_out" }] })
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      // recordSuppressionBoundary · routed to recordOptOut because
      // resolvedReason === 'opt_out' from the table.
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await markSuppressedAtSendBoundary({
      queue_id: "q3",
      worker_id: "w3",
      email: "a@b.co",
      reason: "hard_bounce",
      bypassEnvGateForTests: true,
    });
    expect(r.recorded_suppression?.reason).toBe("opt_out");
    // UPDATE's bind $3 is the RESOLVED reason, not the caller's claim.
    const updateCall = queryMock.mock.calls[3]!;
    expect(updateCall[1]![2]).toBe("opt_out");
  });
});

// ─── Stale-lease path · CAS failed ─────────────────────────────────

describe("markSuppressedAtSendBoundary · stale lease", () => {
  it("CAS fails (rowCount 0) · skipped=lease_lost · NO suppression write happens", async () => {
    queryMock
      // 1-2 · isSuppressed · found
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "complaint" }] })
      // 3 · queue migration-check
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      // 4 · UPDATE returned rowCount 0 · stale worker
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await markSuppressedAtSendBoundary({
      queue_id: "stale",
      worker_id: "ghost",
      email: "x@y.co",
      reason: "complaint",
      bypassEnvGateForTests: true,
    });
    expect(r.skipped_reason).toBe("lease_lost");
    expect(r.affected).toBe(0);
    expect(r.recorded_suppression).toBeUndefined();
    // Exactly 4 queries ran · no post-UPDATE recordSuppression.
    expect(queryMock).toHaveBeenCalledTimes(4);
  });
});

// ─── Interface safety · never sends email ──────────────────────────

describe("markSuppressedAtSendBoundary · zero network I/O", () => {
  it("function body contains no fetch / http / smtp references · structural anchor", async () => {
    // Behavioural proof is impossible from inside unit tests · this
    // anchor is a cheap-to-break grep on the module source. If a
    // future refactor adds any outbound call, this fails.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "outreach-queue.ts"),
      "utf8",
    );
    const banned = ["fetch(", "http.", "https.", "nodemailer", "SMTP"];
    for (const token of banned) {
      // Grep for literal · case-sensitive. The current implementation
      // of outreach-queue.ts contains none of these.
      expect(src).not.toContain(token);
    }
  });
});
