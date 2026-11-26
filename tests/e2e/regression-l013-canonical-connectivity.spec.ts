// tests/e2e/regression-l013-canonical-connectivity.spec.ts
//
// L-013 2026-11-26 · regression test for the NEX_POSTGRES_URL connection
// repair. Observable behaviour:
//
//   1. `NEX_POSTGRES_URL` resolves to a host that accepts TCP within 3 s
//      (regresses the pre-repair 21 s ETIMEDOUT against the IPv6-only
//      Supabase direct host `db.<proj>.supabase.co`).
//   2. A read-only probe through `pg.Pool` with the same config shape as
//      `src/lib/nex-native/local-directory-service.ts::getPool()` can run
//      `SELECT 1` and reach the `nex.business_canonical` schema without
//      throwing.
//   3. The live directory source (`public.nex_business`) answers with a
//      positive row count — this is the data the user-facing /directory
//      actually renders today.
//
// What this test deliberately does NOT assert:
//   · That `nex.business_canonical` has rows. In sandbox it is an empty
//     schema; populating it is a separate data-seeding decision, not a
//     connectivity bug, and L-013 is about connectivity + schema reach.
//     Row-level evidence captured in the probe log for the ledger.
//   · That the Directory landing page is publicly visible. Per the
//     2026-11-24 Founder directive the public Directory is intentionally
//     hidden until the launch active-seller threshold.
//
// This file runs in the default node test environment under the
// `connectivity-regression` project (see playwright.config.ts). It uses
// `test.describe.configure({ mode: "serial" })` to keep a single pool
// lifecycle across the probes.

import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Hydrate .env.local manually so this test has the same NEX_POSTGRES_URL
// the Next.js dev server reads (Playwright does not auto-load it).
function hydrateEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (line.trimStart().startsWith("#")) continue;
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* .env.local is optional in CI */
  }
}

hydrateEnv();

test.describe.configure({ mode: "serial" });

test.describe("L-013 · NEX_POSTGRES_URL canonical connectivity", () => {
  let pool: Pool | null = null;

  test.beforeAll(() => {
    const url = process.env.NEX_POSTGRES_URL;
    expect(url, "NEX_POSTGRES_URL must be configured").toBeTruthy();
    // Same shape as src/lib/nex-native/local-directory-service.ts
    pool = new Pool({
      connectionString: url!,
      max: 2,
      connectionTimeoutMillis: 3_000,
    });
  });

  test.afterAll(async () => {
    await pool?.end().catch(() => {});
    pool = null;
  });

  test("SELECT 1 responds within 3 s", async () => {
    const t0 = Date.now();
    const r = await pool!.query<{ ok: number }>("SELECT 1 AS ok");
    const elapsed = Date.now() - t0;
    expect(r.rows[0]?.ok, "SELECT 1 returns 1").toBe(1);
    expect(elapsed, "pool SELECT 1 elapsed ms").toBeLessThan(3_000);
  });

  test("nex.business_canonical schema is reachable (count is a non-negative int)", async () => {
    const r = await pool!.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM nex.business_canonical",
    );
    const n = r.rows[0]?.n;
    expect(typeof n, "count is numeric").toBe("number");
    expect(n, "count is non-negative").toBeGreaterThanOrEqual(0);
    // Note: sandbox currently has 0 rows. Seeding is a separate open
    // task; L-013 asserts reachability, not non-emptiness.
  });

  test("public.nex_business (live directory source) has rows", async () => {
    const r = await pool!.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.nex_business",
    );
    const n = r.rows[0]?.n;
    expect(n, "nex_business has at least one row").toBeGreaterThan(0);
  });
});
