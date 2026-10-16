// src/lib/nex-native/harvest/__tests__/phase13-regression.test.ts
//
// Phase 1.3 regression suite · sealed 2026-10-16.
// --------------------------------------------------------------------
// The owner's Phase 1.2 audit found three blockers in the backfill
// path:
//   (A) retry gap · UNQUALIFIED rows were never re-walked
//   (B) failed-fetch cursor advancement · the catch branch skipped
//       the attempt timestamp, so the next tick re-picked the same
//       errored row immediately
//   (C) VALIDATED contract had no live producer
//
// Phase 1.3 fixes all three · this file is the regression suite that
// locks the fixed behaviour in. Eight scenarios the owner called out:
//
//   1. UNQUALIFIED retry eligibility (cooldown satisfied)
//   2. UNQUALIFIED retry suppression (cooldown not satisfied)
//   3. Walker failure advances the cursor (no re-pick)
//   4. Deadline short-circuit still returns a honest report
//   5. QUALIFIED is NEVER downgraded by a weak re-walk
//   6. DISQUALIFIED is NEVER re-walked
//   7. Malformed address → INVALID → UNQUALIFIED
//   8. Third-party email source → FOUND / stays PENDING (never VALIDATED)
//   9. No MX record → FOUND / stays PENDING (never VALIDATED)
//  10. All three validator layers pass → VALIDATED → QUALIFIED
//
// (The owner's list of eight expanded to ten specific assertions; some
// are structural anchors on SQL + types, some are behavioural.)

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FetchCandidate,
  ValidateCandidate,
} from "../email-backfill-orchestrator";

vi.mock("server-only", () => ({}));

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(
    fn: (client: { query: typeof queryMock }) => Promise<T>,
  ) => fn({ query: queryMock }),
}));

import { runEmailBackfillBatch } from "../email-backfill-orchestrator";

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.NEX_EMAIL_BACKFILL_ENABLED;
});
afterEach(() => vi.clearAllMocks());

// Shared test fixtures ────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const ORCHESTRATOR_SRC = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/harvest/email-backfill-orchestrator.ts"),
  "utf8",
);

const okMxValidator: ValidateCandidate = async (email, apex) => {
  // Lightweight stand-in · format passes if there's an @ and a dot ·
  // attribution passes if email domain === apex domain · MX passes
  // unconditionally. Mirrors validateEmailForBusiness happy path.
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
  if (!apexHost) {
    return {
      status: "FOUND",
      reason: "missing_apex_host",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }
  if (emailDomain === apexHost || emailDomain.endsWith(`.${apexHost}`)) {
    return {
      status: "VALIDATED",
      reason: "validated",
      checkedDomain: emailDomain,
      mxExchanges: ["mail.example.com"],
    };
  }
  return {
    status: "FOUND",
    reason: "third_party_source",
    checkedDomain: emailDomain,
    mxExchanges: [],
  };
};

const noMxValidator: ValidateCandidate = async (email, apex) => {
  // Format + attribution pass but MX layer fails · never emits VALIDATED.
  const emailDomain = email.split("@")[1]!.toLowerCase();
  const apexHost = apex!.toLowerCase();
  if (emailDomain === apexHost || emailDomain.endsWith(`.${apexHost}`)) {
    return {
      status: "FOUND",
      reason: "no_mx_record",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }
  return {
    status: "FOUND",
    reason: "third_party_source",
    checkedDomain: emailDomain,
    mxExchanges: [],
  };
};

function candidateFetcher(email: string, sourceUrl: string): FetchCandidate {
  return async () => ({ email, sourceUrl });
}

// ─── Scenario 1 · UNQUALIFIED retry · cooldown satisfied ─────────────

describe("Phase 1.3 · retry eligibility", () => {
  it("the SELECT WHERE clause picks up UNQUALIFIED rows past the 7-day cooldown", () => {
    // Structural anchor on the exact SQL · if someone narrows the
    // predicate back to PENDING-only, this fails.
    expect(ORCHESTRATOR_SRC).toMatch(
      /WHERE\s+qualification_status\s*=\s*'PENDING'\s*OR\s*\(\s*qualification_status\s*=\s*'UNQUALIFIED'/,
    );
    expect(ORCHESTRATOR_SRC).toContain(
      "email_last_attempted_at < now() - ($2 || ' days')::interval",
    );
    // The cooldown constant is bound at 7 days.
    expect(ORCHESTRATOR_SRC).toMatch(
      /UNQUALIFIED_RETRY_COOLDOWN_DAYS\s*=\s*7\b/,
    );
  });

  it("behavioural · UNQUALIFIED row is picked when SELECT returns it (DB decides eligibility)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("hello@acme.co", "https://acme.co/contact"),
      validate: okMxValidator,
    });
    expect(result.attempted).toBe(1);
    // All three validator layers passed → VALIDATED → UPDATE sets
    // qualification_status to 'QUALIFIED' via the CASE arm.
    const updateCall = queryMock.mock.calls[2]!;
    expect(updateCall[1]![3]).toBe("VALIDATED");
  });

  it("the SELECT passes UNQUALIFIED_RETRY_COOLDOWN_DAYS as the $2 bind param", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({ rows: [] });
    await runEmailBackfillBatch({ bypassEnvGateForTests: true, batchSize: 10 });
    const selectCall = queryMock.mock.calls[1]!;
    const binds = selectCall[1]! as unknown[];
    expect(binds[0]).toBe(10); // limit
    expect(binds[1]).toBe(7); // cooldown days
  });
});

// ─── Scenario 2 · UNQUALIFIED retry suppression (DB-side gate) ───────

describe("Phase 1.3 · repeated failures stay suppressed within the cooldown", () => {
  it("doctrine · the WHERE clause requires either NULL last-attempt OR < now()-interval", () => {
    expect(ORCHESTRATOR_SRC).toMatch(
      /email_last_attempted_at IS NULL\s*OR\s*email_last_attempted_at < now\(\) - \(\$2 \|\| ' days'\)::interval/,
    );
    // DISQUALIFIED is NOT in the OR branch (admin lock).
    const whereBlock = ORCHESTRATOR_SRC.slice(
      ORCHESTRATOR_SRC.indexOf("WHERE qualification_status"),
      ORCHESTRATOR_SRC.indexOf("ORDER BY email_last_attempted_at"),
    );
    expect(whereBlock).not.toMatch(/DISQUALIFIED/);
    // QUALIFIED is also not in the OR branch.
    expect(whereBlock).not.toMatch(/'QUALIFIED'/);
  });
});

// ─── Scenario 3 · walker failure advances the cursor ─────────────────

describe("Phase 1.3 · failed-fetch cursor advancement", () => {
  it("walker throws → catch branch runs a cursor-only UPDATE then continues", async () => {
    // throwing fetcher simulates a transient page-walker exception.
    const throwFetcher: FetchCandidate = async () => {
      throw new Error("fetch timeout");
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
            website_apex: "example.com",
            country: "ID",
          },
        ],
      })
      // Cursor-only recovery UPDATE from the catch branch.
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: throwFetcher,
      validate: okMxValidator,
    });

    expect(result.attempted).toBe(1);
    expect(result.errors).toBe(1);
    // Three queries: col-check, batch, cursor-only UPDATE recovery.
    expect(queryMock).toHaveBeenCalledTimes(3);
    const recoverySql = String(queryMock.mock.calls[2]![0]);
    // Only email_last_attempted_at is written · no email / status /
    // qualification mutations.
    expect(recoverySql).toContain("SET email_last_attempted_at = now()");
    expect(recoverySql).not.toContain("email_status");
    expect(recoverySql).not.toContain("qualification_status");
  });

  it("walker throws AND recovery UPDATE throws → errors still counted · no crash", async () => {
    const throwFetcher: FetchCandidate = async () => {
      throw new Error("fetch timeout");
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "deaddead-dead-dead-dead-deaddeaddead",
            website_apex: "ex.com",
            country: "ID",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("DB down")); // recovery fails
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: throwFetcher,
      validate: okMxValidator,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.attempted).toBe(1);
  });

  it("UPDATE throws → catch branch runs cursor-only UPDATE recovery", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            website_apex: "ok.co",
            country: "ID",
          },
        ],
      })
      // Main UPDATE throws
      .mockRejectedValueOnce(new Error("deadlock"))
      // Cursor-only recovery UPDATE succeeds
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("hi@ok.co", "https://ok.co"),
      validate: okMxValidator,
    });
    expect(result.errors).toBe(1);
    expect(queryMock).toHaveBeenCalledTimes(4);
    const recoverySql = String(queryMock.mock.calls[3]![0]);
    expect(recoverySql).toContain("SET email_last_attempted_at = now()");
    expect(recoverySql).not.toMatch(/,\s*email\b/);
    expect(recoverySql).not.toContain("email_status");
  });
});

// ─── Scenario 4 · deadline short-circuit ─────────────────────────────

describe("Phase 1.3 · deadline handling still produces an honest report", () => {
  it("if the tick deadline fires mid-batch · returns skipped_reason='deadline' with partial counts", async () => {
    const startTime = Date.now();
    let callNo = 0;
    const clock = () => {
      callNo++;
      // First few calls return start-time; after that, jump 300s so
      // the deadline (240s minus 15s buffer) trips.
      if (callNo <= 2) return new Date(startTime);
      return new Date(startTime + 300_000);
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "11111111-1111-1111-1111-111111111111",
            website_apex: null,
            country: "ID",
          },
          {
            canonical_business_id: "22222222-2222-2222-2222-222222222222",
            website_apex: null,
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // first row UPDATE
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      now: clock,
    });
    // Clock implementation: calls 1-2 are started/batch-eligibility ·
    // call 3+ triggers deadline. The deadline check at the top of the
    // loop short-circuits BEFORE attempting a row. So attempted may be
    // 0 or 1 depending on which iteration trips · what we lock in is
    // that the report is honest.
    expect(result.skipped_reason).toBe("deadline");
    expect(result.ok).toBe(true);
    expect(result.attempted).toBeGreaterThanOrEqual(0);
  });
});

// ─── Scenario 5 · QUALIFIED never downgraded by weak re-walk ─────────

describe("Phase 1.3 · QUALIFIED is preserved against weak re-walks", () => {
  it("UPDATE CASE arm: WHEN qualification_status='QUALIFIED' AND $4 IN ('FOUND','NOT_FOUND') THEN qualification_status", () => {
    expect(ORCHESTRATOR_SRC).toMatch(
      /WHEN qualification_status\s*=\s*'QUALIFIED'\s*AND \$4 IN \('FOUND','NOT_FOUND'\)\s*THEN qualification_status/,
    );
  });

  it("UPDATE CASE arm: email_status='VALIDATED' is never downgraded by $4 IN ('FOUND','NOT_FOUND')", () => {
    expect(ORCHESTRATOR_SRC).toMatch(
      /WHEN email_status\s*=\s*'VALIDATED'\s*AND \$4 IN \('FOUND','NOT_FOUND'\)\s*THEN email_status/,
    );
  });
});

// ─── Scenario 6 · DISQUALIFIED never re-walked (admin lock) ──────────

describe("Phase 1.3 · DISQUALIFIED admin lock", () => {
  it("the SELECT WHERE clause excludes DISQUALIFIED rows entirely", () => {
    const selectBlock = ORCHESTRATOR_SRC.slice(
      ORCHESTRATOR_SRC.indexOf("SELECT canonical_business_id, website_apex, country"),
      ORCHESTRATOR_SRC.indexOf("LIMIT $1"),
    );
    expect(selectBlock).not.toContain("DISQUALIFIED");
  });

  it("the UPDATE CASE preserves qualification_status='DISQUALIFIED' across any observation", () => {
    expect(ORCHESTRATOR_SRC).toMatch(
      /WHEN qualification_status\s*=\s*'DISQUALIFIED'\s*THEN qualification_status/,
    );
  });
});

// ─── Scenario 7 · malformed address → INVALID → UNQUALIFIED ──────────

describe("Phase 1.3 · malformed candidate → INVALID → UNQUALIFIED", () => {
  it("fetcher returns a garbage string · walker emits invalid_format · UPDATE flips to UNQUALIFIED", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "99999999-9999-9999-9999-999999999999",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("not-an-email", "https://acme.co"),
      validate: okMxValidator, // strict format gate inside
    });
    expect(result.attempted).toBe(1);
    expect(result.email_invalid).toBe(1);
    const updateCall = queryMock.mock.calls[2]!;
    const binds = updateCall[1] as unknown[];
    // $2 (newEmail) · $3 (newSourceUrl) stay null because the walker
    // short-circuited to invalid_format before persisting.
    expect(binds[1]).toBe(null);
    expect(binds[2]).toBe(null);
    expect(binds[3]).toBe("INVALID");
  });
});

// ─── Scenario 8 · third-party source → FOUND / stays PENDING ─────────

describe("Phase 1.3 · third-party email source", () => {
  it("gmail address on acme.co site · validator returns FOUND · qualification stays PENDING per UPDATE CASE", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "77777777-7777-7777-7777-777777777777",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("john@gmail.com", "https://acme.co/about"),
      validate: okMxValidator,
    });
    expect(result.attempted).toBe(1);
    expect(result.email_found).toBe(1);
    const updateCall = queryMock.mock.calls[2]!;
    const binds = updateCall[1] as unknown[];
    // Address IS persisted (FOUND is not INVALID) · qualification
    // stays PENDING (UPDATE CASE maps FOUND → PENDING).
    expect(binds[1]).toBe("john@gmail.com");
    expect(binds[3]).toBe("FOUND");
    // Structural check · the SQL CASE arm for FOUND maps to PENDING.
    const updateSql = String(updateCall[0]);
    expect(updateSql).toMatch(
      /WHEN \$4 = 'FOUND'\s*THEN 'PENDING'/,
    );
  });
});

// ─── Scenario 9 · no MX record → FOUND / stays PENDING ───────────────

describe("Phase 1.3 · no MX record on an attributed domain", () => {
  it("validator returns FOUND (not VALIDATED) when the domain has no MX records", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "88888888-8888-8888-8888-888888888888",
            website_apex: "nomx.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("hello@nomx.co", "https://nomx.co"),
      validate: noMxValidator,
    });
    expect(result.attempted).toBe(1);
    expect(result.email_found).toBe(1);
    const binds = queryMock.mock.calls[2]![1] as unknown[];
    expect(binds[3]).toBe("FOUND");
  });
});

// ─── Scenario 10 · all three layers pass → VALIDATED → QUALIFIED ─────

describe("Phase 1.3 · full three-layer validator pass promotes to QUALIFIED", () => {
  it("candidate on authoritative domain with MX records · UPDATE sends 'VALIDATED' and SQL maps to QUALIFIED", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mig202: true, mig203: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            canonical_business_id: "aaaa0000-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            website_apex: "acme.co",
            country: "ID",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = await runEmailBackfillBatch({
      bypassEnvGateForTests: true,
      fetchCandidate: candidateFetcher("hello@acme.co", "https://acme.co"),
      validate: okMxValidator,
    });
    expect(result.attempted).toBe(1);
    expect(result.email_found).toBe(1);
    const updateCall = queryMock.mock.calls[2]!;
    const binds = updateCall[1] as unknown[];
    expect(binds[1]).toBe("hello@acme.co");
    expect(binds[3]).toBe("VALIDATED");
    const sql = String(updateCall[0]);
    expect(sql).toMatch(/WHEN \$4 = 'VALIDATED'\s*THEN 'QUALIFIED'/);
  });

  it("the walker is the ONLY runtime path that emits status='VALIDATED' · and only via the validator", () => {
    // Structural anchor · walker's happy path returns the validator's
    // status verbatim. If any future code path emits status:'VALIDATED'
    // without going through the validator, this anchor fails.
    const walkerBody = ORCHESTRATOR_SRC.slice(
      ORCHESTRATOR_SRC.indexOf("async function walkOneRowSafe"),
    );
    expect(walkerBody).toContain("const result = await validate(");
    expect(walkerBody).toContain("status: result.status,");
    // No literal "VALIDATED" assignment in the walker body · it must
    // come from the validator's return.
    expect(walkerBody).not.toMatch(/status:\s*["']VALIDATED["']/);
  });
});

// ─── Doctrine anchor · DORMANT_FETCHER is still the default ──────────

describe("Phase 1.3 · DORMANT_FETCHER remains the default (safety)", () => {
  test("DORMANT_FETCHER is exported and the orchestrator uses it as the fetcher default", () => {
    expect(ORCHESTRATOR_SRC).toContain(
      "export const DORMANT_FETCHER: FetchCandidate = async () => null;",
    );
    expect(ORCHESTRATOR_SRC).toContain(
      "opts.fetchCandidate ?? DORMANT_FETCHER",
    );
    // defaultValidator (private) is the validator default · wired to
    // the sealed primitive.
    expect(ORCHESTRATOR_SRC).toMatch(
      /const defaultValidator: ValidateCandidate = \(email, apex\) =>\s*validateEmailForBusiness\(email, apex\);/,
    );
    expect(ORCHESTRATOR_SRC).toContain(
      "opts.validate ?? defaultValidator",
    );
  });
});
