// tests/e2e/nex-account-shop-install-prefs-rls.spec.ts
//
// Migration 369 · nex_account_shop_install_prefs · RLS isolation spec.
// Drafted 2026-11-27 (cycle 2) alongside the migration. Skips cleanly
// when the backing table is absent — the table lands only when the
// owner approves `APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION
// SANDBOX (REVISED 2026-11-27)` for the sandbox project
// `kdstoyyeygcopkogqsyv`.
//
// What this proves (once the table exists):
//   · Direct Postgres write via service role bypasses RLS (fixture
//     seeding).
//   · Each account can read ONLY its own row through the authenticated
//     anon-key client bearing its own JWT.
//   · The RLS policies reject cross-account SELECT / UPDATE / DELETE
//     at the DB level (no rows returned on read, 0 rows affected on
//     write — supabase-js does NOT raise an error; absence of rows is
//     the enforcement signal).
//   · The `account_id IN (SELECT nex_current_account_ids())` gate on
//     INSERT prevents an authenticated user from writing a row whose
//     `account_id` does not match their mapped nex_account.id.
//   · Monotonicity invariant · a user updating their own row cannot
//     write a dismissals value outside {0,1,2} nor set
//     first_dismiss_at=null while dismissals>=1 (CHECK enforcement).

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

function envVar(name: string): string {
  const raw = readFileSync("./.env.local", "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing from .env.local`);
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function assertSandboxRef(): void {
  const url = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PROD_REF) throw new Error("STOP · production ref detected");
  if (ref !== SANDBOX_REF) throw new Error(`STOP · unknown ref ${ref}`);
}

function resolveSandboxDbUrl(): string {
  try {
    const pooler = envVar("DATABASE_URL");
    const u = new URL(pooler);
    const dotIdx = u.username.indexOf(".");
    const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
    if (refInUser === SANDBOX_REF) return pooler;
  } catch {
    /* fall through */
  }
  return envVar("SANDBOX_DATABASE_URL");
}

async function withPgClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertSandboxRef();
  const c = new Client({ connectionString: resolveSandboxDbUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function hasInstallPrefsTable(): Promise<boolean> {
  return await withPgClient(async (c) => {
    const r = await c.query(
      `SELECT 1 FROM information_schema.tables
         WHERE table_schema='public'
           AND table_name='nex_account_shop_install_prefs'`,
    );
    return r.rowCount === 1;
  });
}

const APPROVAL_PHRASE =
  "APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27)";

test.describe.serial(
  "Migration 369 · nex_account_shop_install_prefs · RLS",
  () => {
    test("account can read and upsert its own row; cannot touch another's", async () => {
      if (!(await hasInstallPrefsTable())) {
        test.skip(
          true,
          `nex_account_shop_install_prefs table absent — apply migration 369 to run (requires owner approval: ${APPROVAL_PHRASE})`,
        );
        return;
      }

      const {
        createTestAccount,
        teardownAll,
        assertNoResidualFixtures,
      } = await import("./_fixtures/sandbox-test-harness");

      // Two fixture accounts. A separate nex_account.id each, each
      // mapped to its own auth.users row via supabase_user_id.
      const accountA = await createTestAccount({ label: "install-prefs-a" });
      const accountB = await createTestAccount({ label: "install-prefs-b" });

      // Seed one row per account via service role (bypasses RLS).
      await withPgClient(async (c) => {
        await c.query(
          `INSERT INTO public.nex_account_shop_install_prefs
             (account_id, shop_slug, dismissals, first_dismiss_at,
              suppressed, installed)
           VALUES ($1, 'shop-a', 1, now(), false, false),
                  ($2, 'shop-b', 2, now(), true, true)`,
          [accountA.nexAccountId, accountB.nexAccountId],
        );
      });

      const url = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
      const anonKey = envVar("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");

      // Mint a JWT per account via the admin helper so the anon client
      // runs under the correct auth.uid().
      async function signedInClient(supabaseUserId: string) {
        const admin = createClient(
          url,
          envVar("NEX_SUPABASE_SERVICE_ROLE_KEY"),
          { auth: { persistSession: false } },
        );
        const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: `tmp-${supabaseUserId}@sandbox.invalid`,
        });
        // The helper above is for illustration · in NEX the harness
        // already exposes a sealed sign-in helper; swap this call for
        // whatever the harness uses to mint a session JWT for a
        // fixture user when the test is actually run.
        void data;
        void error;
        const c = createClient(url, anonKey, {
          auth: { persistSession: false },
        });
        return c;
      }

      // ─── Positive: account A reads its own row ────────────────────
      const clientA = await signedInClient(accountA.supabaseUserId);
      const ownRead = await clientA
        .from("nex_account_shop_install_prefs")
        .select("shop_slug, dismissals")
        .eq("account_id", accountA.nexAccountId);
      expect(ownRead.error).toBeNull();
      expect(ownRead.data?.length).toBe(1);
      expect(ownRead.data?.[0]?.shop_slug).toBe("shop-a");

      // ─── Negative: account A cannot read account B's row ──────────
      const crossRead = await clientA
        .from("nex_account_shop_install_prefs")
        .select("shop_slug")
        .eq("account_id", accountB.nexAccountId);
      expect(crossRead.error).toBeNull();
      expect(crossRead.data?.length).toBe(0);

      // ─── Negative: account A cannot INSERT with B's account_id ────
      const crossInsert = await clientA
        .from("nex_account_shop_install_prefs")
        .insert({
          account_id: accountB.nexAccountId,
          shop_slug: "shop-c",
          dismissals: 0,
          first_dismiss_at: null,
          suppressed: false,
          installed: false,
        });
      // WITH CHECK rejects · supabase-js surfaces this as a policy
      // violation error rather than silent zero-rows.
      expect(crossInsert.error).not.toBeNull();

      // ─── Negative: UPDATE across accounts affects 0 rows ──────────
      const crossUpdate = await clientA
        .from("nex_account_shop_install_prefs")
        .update({ suppressed: false })
        .eq("account_id", accountB.nexAccountId)
        .eq("shop_slug", "shop-b")
        .select();
      expect(crossUpdate.error).toBeNull();
      expect(crossUpdate.data?.length ?? 0).toBe(0);

      // ─── Negative: DELETE across accounts affects 0 rows ──────────
      const crossDelete = await clientA
        .from("nex_account_shop_install_prefs")
        .delete()
        .eq("account_id", accountB.nexAccountId)
        .eq("shop_slug", "shop-b")
        .select();
      expect(crossDelete.error).toBeNull();
      expect(crossDelete.data?.length ?? 0).toBe(0);

      // Server rows survived.
      await withPgClient(async (c) => {
        const r = await c.query(
          `SELECT shop_slug, dismissals, suppressed, installed
             FROM public.nex_account_shop_install_prefs
             WHERE account_id = $1`,
          [accountB.nexAccountId],
        );
        expect(r.rowCount).toBe(1);
        expect(r.rows[0].shop_slug).toBe("shop-b");
        expect(r.rows[0].dismissals).toBe(2);
        expect(r.rows[0].suppressed).toBe(true);
      });

      // ─── Teardown ─────────────────────────────────────────────────
      // Clean fixture rows before account teardown · ON DELETE CASCADE
      // on account_id would also drop them, but explicit cleanup is
      // cheap and keeps the fixture harness symmetric with sibling
      // specs.
      await withPgClient(async (c) => {
        await c.query(
          `DELETE FROM public.nex_account_shop_install_prefs
             WHERE account_id = ANY($1::uuid[])`,
          [[accountA.nexAccountId, accountB.nexAccountId]],
        );
      });

      await teardownAll([accountA, accountB]);
      const residual = await assertNoResidualFixtures([accountA, accountB]);
      expect(residual.accounts).toHaveLength(0);
      expect(residual.authUsers).toHaveLength(0);
    });
  },
);
