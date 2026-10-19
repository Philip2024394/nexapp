// src/lib/nex-calling/gate.test.ts
//
// NEX Calling · Business Gate Integration Tests · Philip 2026-08-27.
// Phase 7 realignment 2026-10-19 · explicit opt-in via NEX_PG_UP=1.
//
// This is an INTEGRATION suite that requires a reachable Postgres with
// the nex.business_calling_config table (migration 116). Running it
// without those prerequisites previously threw inside beforeAll and
// caused a baseline failure every time `npm run test` executed.
//
// New opt-in contract (sealed 2026-10-19):
//
//   · Default behaviour · the whole describe block is SKIPPED when
//     the opt-in flag is not set. `npm run test` reports a clean skip,
//     NOT a failure.
//   · Opt-in · set `NEX_PG_UP=1` (and optionally `NEX_POSTGRES_URL`)
//     to run the real integration tests:
//
//         NEX_PG_UP=1 npx vitest run src/lib/nex-calling/gate.test.ts
//
//   · Under opt-in, every test uses a real transaction that ROLLS
//     BACK · zero DB persistence · zero risk to production data.
//
// This matches the Phase 7 directive · "Prefer an explicit opt-in
// integration-test configuration or a documented lifecycle hook
// rather than requiring developers to remember an undocumented
// background process."

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { decideCall } from "./gate";

const PG_OPT_IN = process.env.NEX_PG_UP === "1";

const POOL = PG_OPT_IN
  ? new pg.Pool({
      connectionString: process.env.NEX_POSTGRES_URL
        ?? "postgresql://postgres:changeme@localhost:5433/nex_dev",
      max: 3,
    })
  : null;

beforeAll(async () => {
  if (!POOL) return;
  // Opt-in path · ensure the migration-116 table exists.
  const r = await POOL.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema='nex' AND table_name='business_calling_config'`,
  );
  if (r.rows[0].n === 0) {
    throw new Error("nex.business_calling_config missing · run migration 116");
  }
});

afterAll(async () => { if (POOL) await POOL.end(); });

async function inTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!POOL) throw new Error("inTx called with POOL=null · opt-in gate failed");
  const c = await POOL.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("ROLLBACK");
    return out;
  } finally { c.release(); }
}

describe.skipIf(!PG_OPT_IN)("nex-calling · business gate · integration (opt-in NEX_PG_UP=1)", () => {
  it("denies when no config row exists", async () => {
    await inTx(async (c) => {
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-UNCONFIGURED",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_config");
    });
  });

  it("denies when consent not yet given", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled)
         VALUES ('nex.food_business', '#FL-TEST-NOCONSENT', true, true)`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-NOCONSENT",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_consent");
    });
  });

  it("denies when the requested media type is disabled", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by)
         VALUES ('nex.food_business', '#FL-TEST-VOICEOFF', false, true, now(), 'admin')`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-VOICEOFF",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("not_enabled");
    });
  });

  it("denies blocked callers even with consent + enablement", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by, blocked_callers)
         VALUES ('nex.food_business', '#FL-TEST-BLOCK', true, true, now(), 'admin', ARRAY['user-blocked'])`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-BLOCK",
        callerIdentity: "user-blocked",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("caller_blocked");
    });
  });

  it("allows when everything green (no hours restriction)", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by)
         VALUES ('nex.food_business', '#FL-TEST-GREEN', true, true, now(), 'admin')`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-GREEN",
        callerIdentity: "user-abc",
        mediaType: "video",
      });
      expect(d.allow).toBe(true);
      if (d.allow) expect(d.mediaType).toBe("video");
    });
  });

  it("rejects unknown business_table (default deny)", async () => {
    await inTx(async (c) => {
      const d = await decideCall(c, {
        businessTable: "nex.some_unknown_table",
        businessRef: "#XX-000",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_config");
    });
  });
});
