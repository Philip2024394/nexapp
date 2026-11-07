#!/usr/bin/env node
// scripts/concurrency-rehearsal/run-rehearsal.mjs
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-07 · migration 281 local rehearsal orchestrator.
// Creates a disposable database, applies minimal schema + migration 281,
// runs every test, prints results, then drops the database.
//
// Usage:
//   export NEX_REHEARSAL_PG_URL="postgresql://postgres:rehearsal@127.0.0.1:55432/postgres"
//   node scripts/concurrency-rehearsal/run-rehearsal.mjs
//
// Refuses to run if NEX_REHEARSAL_PG_URL is unset OR contains a
// known production hostname fragment.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getRehearsalConnection,
  withDatabase,
  connect,
  withClient,
  callRpc,
  assertEquals,
  assertAtLeast,
  assertAtMost,
  freshDbName,
  uuid,
} from "./_lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MIGRATION_SQL = readFileSync(
  join(REPO_ROOT, "nex-supabase", "migrations", "281_nex_product_create_with_cap_gate.sql"),
  "utf8",
);
const ROLLBACK_SQL = readFileSync(
  join(REPO_ROOT, "nex-supabase", "migrations", "281_nex_product_create_with_cap_gate.rollback.sql"),
  "utf8",
);

// Minimal schema just enough to support migration 281 · we don't
// copy production schema. Owner directive §: "Do not use production
// credentials for this rehearsal." We also don't copy production
// column shapes beyond what the RPC touches.
const MINIMAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS public.nex_account (
  id uuid PRIMARY KEY,
  shop_tier text
);

CREATE TABLE IF NOT EXISTS public.nex_business (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES public.nex_account(id)
);

CREATE TABLE IF NOT EXISTS public.nex_product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.nex_business(id),
  name text NOT NULL,
  description text,
  image_url text,
  gallery_urls text[],
  tags text[],
  sku text,
  stock_status text,
  price_pence integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('live', 'draft', 'archived')),
  department_id text,
  category_id text,
  spec jsonb NOT NULL DEFAULT '{}',
  dispatch_time text,
  background_video_id uuid,
  background_image_url text,
  background_music_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Minimal role shim · prod has service_role + authenticated. The
-- rehearsal verifies the migration's GRANT statements work correctly
-- so the roles must exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOINHERIT;
  END IF;
END
$$;

-- pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`;

function summary(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const { url: adminUrl } = getRehearsalConnection();
  const dbName = freshDbName();

  summary("probe");
  await withClient(adminUrl, async (c) => {
    const r = await c.query("SELECT version() AS v");
    console.log(`[probe] ${r.rows[0].v}`);
  });

  summary("setup · disposable database");
  await withClient(adminUrl, async (c) => {
    await c.query(`CREATE DATABASE ${dbName}`);
    console.log(`[setup] created ${dbName}`);
  });

  const workUrl = withDatabase(adminUrl, dbName);

  try {
    await withClient(workUrl, async (c) => {
      summary("setup · minimal schema");
      await c.query(MINIMAL_SCHEMA);
      console.log("[setup] schema created");

      // Seed · two owner accounts, two businesses, zero products.
      const ownerA = uuid();
      const ownerB = uuid();
      const bizA = uuid();
      const bizB = uuid();
      await c.query("INSERT INTO nex_account (id, shop_tier) VALUES ($1, 'professional'), ($2, 'professional')", [ownerA, ownerB]);
      await c.query("INSERT INTO nex_business (id, owner_account_id) VALUES ($1, $2), ($3, $4)", [bizA, ownerA, bizB, ownerB]);
      console.log(`[setup] seeded bizA=${bizA} bizB=${bizB}`);

      summary("apply · migration 281");
      const applyStart = Date.now();
      await c.query(MIGRATION_SQL);
      console.log(`[apply] applied in ${Date.now() - applyStart}ms`);

      // ─── test:01 · boundary · 20 concurrent at cap=50 with 49 pre-seeded ──
      summary("test:01 · boundary · 20 concurrent at cap");
      const CAP = 50;
      for (let i = 0; i < CAP - 1; i++) {
        await c.query(
          `INSERT INTO nex_product (business_id, name, price_pence, currency, status) VALUES ($1, $2, 100, 'EUR', 'live')`,
          [bizA, `pre-${i}`],
        );
      }
      const pre = await c.query(`SELECT count(*)::int AS n FROM nex_product WHERE business_id = $1 AND status IN ('live','draft')`, [bizA]);
      console.log(`[test:01] seeded bizA at count=${pre.rows[0].n} (cap=${CAP})`);

      // 20 concurrent RPC calls. Each attempts to create 1 product.
      const clients = await Promise.all(
        Array.from({ length: 20 }, () => connect(workUrl)),
      );
      const t0 = Date.now();
      const settled = await Promise.allSettled(
        clients.map((cc, i) =>
          callRpc(cc, {
            businessId: bizA,
            name: `concurrent-${i}`,
            cap: CAP,
          }),
        ),
      );
      const elapsed = Date.now() - t0;
      await Promise.all(clients.map((cc) => cc.end().catch(() => {})));

      const succeeded = settled.filter((r) => r.status === "fulfilled").length;
      const failed = settled.filter((r) => r.status === "rejected");
      const checkViolations = failed.filter((r) =>
        /check_violation|tier limit reached/.test(r.reason?.message ?? ""),
      ).length;
      const otherFails = failed.length - checkViolations;

      console.log(
        `[test:01] result · ${succeeded} succeeded · ${checkViolations} check_violation · ${otherFails} other failures · elapsed ${elapsed}ms`,
      );
      assertEquals(succeeded, 1, "[test:01] exactly 1 succeeded");
      assertEquals(checkViolations, 19, "[test:01] 19 rejected with check_violation");
      assertEquals(otherFails, 0, "[test:01] no infrastructure failures");

      const post = await c.query(
        `SELECT count(*)::int AS n FROM nex_product WHERE business_id = $1 AND status IN ('live','draft')`,
        [bizA],
      );
      assertEquals(post.rows[0].n, CAP, "[test:01] final count equals cap");
      console.log(`[test:01] final count=${post.rows[0].n} == cap=${CAP} · PASS`);

      // ─── test:02 · cross-business parallel ───────────────────────
      summary("test:02 · cross-business parallel");
      // bizA is now at cap. bizB is empty. Fire 10 parallel against bizB
      // while 10 parallel against bizA · the bizA locks must not block
      // bizB. Measure elapsed vs. serial cost.
      const combined = await Promise.all([
        ...Array.from({ length: 10 }, async () => {
          const cc = await connect(workUrl);
          const start = Date.now();
          try {
            await callRpc(cc, { businessId: bizA, name: "x", cap: CAP }).catch(() => undefined);
          } finally {
            await cc.end().catch(() => {});
          }
          return Date.now() - start;
        }),
        ...Array.from({ length: 10 }, async () => {
          const cc = await connect(workUrl);
          const start = Date.now();
          try {
            await callRpc(cc, { businessId: bizB, name: "y", cap: 100 });
          } finally {
            await cc.end().catch(() => {});
          }
          return Date.now() - start;
        }),
      ]);
      const maxLatencyMs = Math.max(...combined);
      const bizBCount = await c.query(
        `SELECT count(*)::int AS n FROM nex_product WHERE business_id = $1`,
        [bizB],
      );
      console.log(`[test:02] max latency ${maxLatencyMs}ms · bizB inserts: ${bizBCount.rows[0].n}/10`);
      assertEquals(bizBCount.rows[0].n, 10, "[test:02] bizB received all 10 inserts");

      // ─── test:03 · missing business ──────────────────────────────
      summary("test:03 · missing business → foreign_key_violation");
      const bogus = uuid();
      try {
        await callRpc(c, { businessId: bogus, name: "ghost", cap: 50 });
        throw new Error("[test:03] expected failure, got success");
      } catch (err) {
        const msg = err.message ?? "";
        if (!/does not exist|foreign_key_violation/.test(msg)) {
          throw new Error(`[test:03] wrong error: ${msg}`);
        }
        console.log(`[test:03] PASS · ${msg.slice(0, 120)}`);
      }

      // ─── test:04 · security · authenticated has no EXECUTE ─────
      summary("test:04 · security · authenticated role grant check");
      const grants = await c.query(
        `SELECT grantee, privilege_type
         FROM information_schema.routine_privileges
         WHERE routine_schema = 'public'
           AND routine_name = 'nex_product_create_with_cap_gate'
         ORDER BY grantee`,
      );
      const roles = grants.rows.map((r) => r.grantee);
      console.log(`[test:04] EXECUTE grantees: ${JSON.stringify(roles)}`);
      if (roles.includes("authenticated")) {
        throw new Error("[test:04] FAIL · authenticated role has EXECUTE · must be revoked");
      }
      if (roles.includes("PUBLIC") || roles.includes("public")) {
        throw new Error("[test:04] FAIL · PUBLIC has EXECUTE");
      }
      if (!roles.includes("service_role")) {
        throw new Error("[test:04] FAIL · service_role missing EXECUTE");
      }
      console.log("[test:04] PASS · service_role only");

      // ─── test:05 · rollback ────────────────────────────────────
      summary("test:05 · rollback");
      const productsBefore = await c.query("SELECT count(*)::int AS n FROM nex_product");
      await c.query(ROLLBACK_SQL);
      const functionGone = await c.query(
        `SELECT count(*)::int AS n FROM pg_proc
         WHERE proname = 'nex_product_create_with_cap_gate'`,
      );
      const productsAfter = await c.query("SELECT count(*)::int AS n FROM nex_product");
      assertEquals(functionGone.rows[0].n, 0, "[test:05] function dropped");
      assertEquals(productsAfter.rows[0].n, productsBefore.rows[0].n, "[test:05] product rows unchanged");
      console.log(`[test:05] PASS · function gone · rows ${productsAfter.rows[0].n} unchanged`);

      // ─── test:06 · re-apply (idempotent) ───────────────────────
      summary("test:06 · re-apply is idempotent");
      await c.query(MIGRATION_SQL);
      await c.query(MIGRATION_SQL); // second apply must be a no-op OR CREATE OR REPLACE
      const found = await c.query(
        `SELECT count(*)::int AS n FROM pg_proc
         WHERE proname = 'nex_product_create_with_cap_gate'`,
      );
      assertAtLeast(found.rows[0].n, 1, "[test:06] function present after re-apply");
      console.log("[test:06] PASS · CREATE OR REPLACE is idempotent");
    });

    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║  REHEARSAL COMPLETE · ALL TESTS PASSED               ║");
    console.log("╚══════════════════════════════════════════════════════╝");
  } finally {
    summary("cleanup");
    await withClient(adminUrl, async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${dbName}`);
      console.log(`[cleanup] dropped ${dbName}`);
    });
  }
}

main().catch((err) => {
  console.error("\n❌ REHEARSAL FAILED");
  console.error(err);
  process.exit(1);
});
