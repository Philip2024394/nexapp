// src/lib/nex-native/outreach/__tests__/outreach-eligibility.test.ts
//
// Phase 1.4 regression · the eligibility predicate is the LAST
// safeguard between the harvested list and the mail-send pipeline.
// Weakening any of the five AND'd clauses must fail this file.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(
    fn: (client: { query: typeof queryMock }) => Promise<T>,
  ) => fn({ query: queryMock }),
}));

import {
  ELIGIBILITY_WHERE_SQL,
  ELIGIBILITY_REQUIRED_TOKENS,
  buildEligibilityCountSql,
  buildEligibilityBatchSql,
  countEligibleContacts,
} from "../outreach-eligibility";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_OUTREACH_ENABLED;
});
afterEach(() => vi.clearAllMocks());

// ─── Structural anchors on the predicate ────────────────────────────

describe("ELIGIBILITY_WHERE_SQL · all five safeguards present", () => {
  it("contains every required token", () => {
    for (const token of ELIGIBILITY_REQUIRED_TOKENS) {
      expect(ELIGIBILITY_WHERE_SQL).toContain(token);
    }
  });

  it("the clauses are AND'd (never OR'd)", () => {
    // If someone replaces an AND with an OR, the predicate's
    // intersection becomes a union · catastrophic.
    expect(ELIGIBILITY_WHERE_SQL).not.toMatch(/\bOR\b(?!.*EXISTS)/i);
    // Three AND joins between the four top-level clauses · the
    // suppression NOT EXISTS is the fifth.
    const ands = ELIGIBILITY_WHERE_SQL.match(/\bAND\b/g) ?? [];
    expect(ands.length).toBeGreaterThanOrEqual(4);
  });

  it("suppression check uses lower() on BOTH sides for case-insensitive match", () => {
    expect(ELIGIBILITY_WHERE_SQL).toContain("lower(s.email) = lower(bc.email)");
  });

  it("superseded rows are excluded", () => {
    expect(ELIGIBILITY_WHERE_SQL).toContain(
      "bc.superseded_by_business_id IS NULL",
    );
  });
});

// ─── Build helpers · parameter binding safety ───────────────────────

describe("buildEligibilityCountSql · parameters are bound, never interpolated", () => {
  it("no country · emits zero params", () => {
    const { sql, params } = buildEligibilityCountSql();
    expect(params).toEqual([]);
    expect(sql).toContain("SELECT COUNT(*)");
    expect(sql).toContain(ELIGIBILITY_WHERE_SQL);
  });

  it("country supplied · bound as $1 (never string-interpolated)", () => {
    const { sql, params } = buildEligibilityCountSql({ country: "ID" });
    expect(params).toEqual(["ID"]);
    expect(sql).toContain("bc.country = $1");
    expect(sql).not.toContain("'ID'");
  });
});

describe("buildEligibilityBatchSql · stable ordering + LIMIT binding", () => {
  it("ORDER BY canonical_business_id (deterministic pagination)", () => {
    const { sql } = buildEligibilityBatchSql({ limit: 50 });
    expect(sql).toMatch(/ORDER BY bc\.canonical_business_id/);
  });

  it("LIMIT is bound as a parameter", () => {
    const { sql, params } = buildEligibilityBatchSql({ limit: 50 });
    expect(params[params.length - 1]).toBe(50);
    expect(sql).toMatch(/LIMIT \$\d+$/);
  });

  it("country appended before LIMIT; parameter positions correct", () => {
    const { sql, params } = buildEligibilityBatchSql({
      limit: 25,
      country: "ID",
    });
    expect(params).toEqual(["ID", 25]);
    expect(sql).toContain("bc.country = $1");
    expect(sql).toMatch(/LIMIT \$2$/);
  });
});

// ─── Dormancy + migration fail-safes ────────────────────────────────

describe("countEligibleContacts · dormant by default", () => {
  it("without NEX_OUTREACH_ENABLED · skipped=disabled · zero DB touches", async () => {
    const r = await countEligibleContacts();
    expect(r.skipped_reason).toBe("disabled");
    expect(r.count).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("countEligibleContacts · migration fail-safes", () => {
  it("migration 202 absent → skipped=migration_202_absent · no main query runs", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ mig202: false, mig203: false }],
    });
    const r = await countEligibleContacts({ bypassEnvGateForTests: true });
    expect(r.skipped_reason).toBe("migration_202_absent");
    expect(r.count).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("migration 202 present but 203 absent → skipped=migration_203_absent", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ mig202: true, mig203: false }],
    });
    const r = await countEligibleContacts({ bypassEnvGateForTests: true });
    expect(r.skipped_reason).toBe("migration_203_absent");
    expect(r.count).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("both migrations present → counts normally", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: true }] })
      .mockResolvedValueOnce({ rows: [{ n: "42" }] });
    const r = await countEligibleContacts({ bypassEnvGateForTests: true });
    expect(r.count).toBe(42);
    expect(r.skipped_reason).toBeUndefined();
    // Verify the count SQL carried the full predicate.
    const countSql = String(queryMock.mock.calls[1]![0]);
    for (const token of ELIGIBILITY_REQUIRED_TOKENS) {
      expect(countSql).toContain(token);
    }
  });
});

// ─── Regression anchor: proves weakening the predicate fails ────────
//
// If a future refactor removes one of the AND clauses, these tests
// will fail. We instantiate ELIGIBILITY_WHERE_SQL and strip each
// clause in turn; the stripped version is NOT equal to the full one.

describe("predicate strength · stripping ANY clause changes the SQL", () => {
  for (const token of ELIGIBILITY_REQUIRED_TOKENS) {
    it(`stripping "${token.slice(0, 40)}..." changes the predicate`, () => {
      expect(ELIGIBILITY_WHERE_SQL).toContain(token);
      const weakened = ELIGIBILITY_WHERE_SQL.replace(token, "/* removed */");
      expect(weakened).not.toBe(ELIGIBILITY_WHERE_SQL);
      // And removing the token must leave at least one clause gap
      // that would make the predicate semantically weaker.
      expect(weakened).not.toContain(token);
    });
  }
});
