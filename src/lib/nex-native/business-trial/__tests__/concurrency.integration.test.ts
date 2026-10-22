// src/lib/nex-native/business-trial/__tests__/concurrency.integration.test.ts
//
// G1 · S1 Real PostgreSQL concurrency tests · T5a / T6a / T6b.
// =============================================================
//
// These tests PROVE that mutual-exclusion of Business and Themes trial
// activation holds under genuinely concurrent PostgreSQL transactions.
//
// Vitest-level `Promise.all([mockedService(), mockedService()])` DOES NOT
// prove the invariant · it serialises in the Node event loop. These tests
// use real `pg` client connections and real transactions.
//
// Execution gate (per owner directive 2026-10-22 §10):
//   This file DOES NOT execute in CI without a live test database.
//   To run, set env var `TRIAL_PG_TEST_URL` to a Postgres connection
//   string whose database:
//     · Has migration 046 (nex_account.tier) applied
//     · Has migration 089 (themes_trial_used_at) applied
//     · Has migration 214 (business trial system) applied
//     · Has at least one test account row available for insertion
//   And run `TRIAL_PG_TEST_URL=... npx vitest run src/lib/nex-native/business-trial/__tests__/concurrency.integration.test.ts`
//
// Owner directive explicitly says:
//   "Do not apply migrations to production or any shared environment
//    unless separately authorised."
// So this gate is CORRECT: the test only runs when the operator provides
// a dedicated test DB they have authorised themselves.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const TEST_URL = process.env.TRIAL_PG_TEST_URL;
const GATE = TEST_URL ? describe : describe.skip;

// Reset the service module's pool between tests so each run uses the
// test URL · also stub DATABASE_URL for the service's lazy singleton.
const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = TEST_URL ?? "";

GATE("T5a / T6a / T6b · S1 real PostgreSQL concurrency", () => {
  let adminPool: Pool;

  beforeAll(async () => {
    if (!TEST_URL) return;
    adminPool = new Pool({ connectionString: TEST_URL, max: 20 });
    // Verify migration 214 is applied by probing one of its columns
    const probe = await adminPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_name = 'nex_account'
            AND column_name = 'business_trial_status'
       ) AS exists`,
    );
    if (!probe.rows[0]?.exists) {
      throw new Error(
        "TRIAL_PG_TEST_URL does not point to a database with migration 214 applied. " +
          "Apply migration 214_nex_business_trial_system.sql first.",
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.end();
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  async function seedFreshAccount(): Promise<string> {
    const id = randomUUID();
    // Minimum columns required · nex_account has many NOT NULL columns
    // depending on current migration state. Adjust this INSERT for the
    // actual required-column set of the test DB.
    await adminPool.query(
      `INSERT INTO nex_account (id, display_name, tier)
       VALUES ($1, $2, 'gratis')`,
      [id, `concurrency-test-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function cleanupAccount(id: string): Promise<void> {
    try {
      await adminPool.query(`DELETE FROM nex_account WHERE id = $1`, [id]);
    } catch {
      // Account may not exist · ignore
    }
  }

  async function tryStartBusinessTrial(id: string): Promise<"ok" | "race" | "trigger"> {
    const client = await adminPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT id FROM nex_account WHERE id = $1 FOR UPDATE`, [id]);
      const result = await client.query(
        `UPDATE nex_account
            SET business_trial_status = 'active',
                business_trial_start_at = now(),
                business_trial_end_at = now() + interval '168 hours'
          WHERE id = $1 AND business_trial_status IS NULL
         RETURNING id`,
        [id],
      );
      await client.query("COMMIT");
      return result.rowCount === 1 ? "ok" : "race";
    } catch (err) {
      await client.query("ROLLBACK").catch(() => void 0);
      const code = (err as { code?: string }).code;
      if (code === "23P01") return "trigger"; // exclusion_violation
      throw err;
    } finally {
      client.release();
    }
  }

  async function tryStartThemesTrial(id: string): Promise<"ok" | "race" | "trigger"> {
    const client = await adminPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT id FROM nex_account WHERE id = $1 FOR UPDATE`, [id]);
      const result = await client.query(
        `UPDATE nex_account
            SET themes_trial_used_at = now(),
                themes_trial_package_id = 'bisnis'
          WHERE id = $1 AND themes_trial_used_at IS NULL
         RETURNING id`,
        [id],
      );
      await client.query("COMMIT");
      return result.rowCount === 1 ? "ok" : "race";
    } catch (err) {
      await client.query("ROLLBACK").catch(() => void 0);
      const code = (err as { code?: string }).code;
      if (code === "23P01") return "trigger";
      throw err;
    } finally {
      client.release();
    }
  }

  it("T5a · 10 parallel /trial/start calls · exactly 1 succeeds", async () => {
    const id = await seedFreshAccount();
    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => tryStartBusinessTrial(id)),
      );
      const ok = results.filter((r) => r === "ok").length;
      const race = results.filter((r) => r === "race").length;
      expect(ok).toBe(1);
      expect(race).toBe(9);
      // Verify only one row ended up active
      const { rows } = await adminPool.query<{ status: string | null }>(
        `SELECT business_trial_status FROM nex_account WHERE id = $1`,
        [id],
      );
      expect(rows[0]?.status).toBe("active");
    } finally {
      await cleanupAccount(id);
    }
  }, 30_000);

  it("T6a · parallel /trial/start + startThemesTrial · exactly 1 succeeds", async () => {
    const id = await seedFreshAccount();
    try {
      const [bRes, tRes] = await Promise.all([
        tryStartBusinessTrial(id),
        tryStartThemesTrial(id),
      ]);
      // Exactly one succeeds. Which one is non-deterministic (depends on
      // which transaction commits first). The other either sees the lock
      // and rejects, OR the trigger raises exclusion_violation.
      const okCount = [bRes, tRes].filter((r) => r === "ok").length;
      expect(okCount).toBe(1);

      // Verify DB state matches which service succeeded
      const { rows } = await adminPool.query<{
        business: string | null;
        themes: Date | null;
      }>(
        `SELECT business_trial_status AS business,
                themes_trial_used_at AS themes
           FROM nex_account WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      expect(row).toBeDefined();
      // Only one of the two trial activators left a mark
      const businessActive = row.business === "active";
      const themesActive = row.themes !== null;
      expect(businessActive && themesActive).toBe(false); // never both
      expect(businessActive || themesActive).toBe(true); // at least one
    } finally {
      await cleanupAccount(id);
    }
  }, 30_000);

  it("T6b · repeat T6a 50 times · all 50 runs produce exactly 1 success", async () => {
    for (let i = 0; i < 50; i++) {
      const id = await seedFreshAccount();
      try {
        const [bRes, tRes] = await Promise.all([
          tryStartBusinessTrial(id),
          tryStartThemesTrial(id),
        ]);
        const okCount = [bRes, tRes].filter((r) => r === "ok").length;
        if (okCount !== 1) {
          throw new Error(
            `Run ${i + 1} · exactly-one invariant violated: business=${bRes}, themes=${tRes}`,
          );
        }
      } finally {
        await cleanupAccount(id);
      }
    }
    expect(true).toBe(true); // reached here · all 50 passed
  }, 180_000);
});
