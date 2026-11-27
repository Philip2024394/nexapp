// tests/e2e/rls-migration-370-account-id-bridge.spec.ts
//
// L-057 · integration spec for migration 370 · authored 2026-11-27
// alongside the migration draft. Companion to:
//   · nex-supabase/migrations/370_fix_rls_account_id_bridge.sql
//   · nex-supabase/migrations/370_fix_rls_account_id_bridge_rollback.sql
//
// Purpose
// -------
// Prove the five policies migration 370 rewrites actually enforce the
// intended "my row, not yours" contract against an AUTHENTICATED
// supabase-js client (not service-role, which bypasses RLS).
//
// Pre-apply state: the five pre-370 policies compare `auth.uid()`
// directly against a column that FKs to `nex_account(id)`. Because
// `nex_account.id` is a `gen_random_uuid()` surrogate column distinct
// from `auth.users.id`, every authenticated row-check evaluates to
// false — authenticated clients see ZERO rows on these three tables.
// Running THIS spec against the pre-370 schema would therefore produce
// legitimate failures (A cannot see A's own row), which is a different
// bug class from the one the spec is designed to detect.
//
// To avoid that confusion, every test body gates on a canary:
//   `nex_migration_history` contains a row with `version = '370'`.
// If the migration has not been applied against the live sandbox,
// the test HARD-SKIPs with reason `BLOCKED-PENDING-MIG-370-APPLY`.
// This is the correct Rule 8 classification — the spec cannot assert
// its intended contract until the schema it is designed to verify
// is present.
//
// Post-apply state: once the owner issues the approval phrase and the
// migration is applied, this spec actively exercises the fix. Running
// green = defence-in-depth is in force; running red = either the
// migration was reverted, the sealed helper changed, or a downstream
// policy regressed.
//
// Sealed invariants preserved
// ---------------------------
//   · Sandbox-only · `assertSandboxRef()` fails loudly on prod.
//   · Only PUBLIC columns are read: `id`, `read_at`, `account_id`,
//     `recipient_account_id`, `affiliate_account_id`, `signal_type`.
//     No plaintext message body, no device-key material.
//   · Authenticated client uses the standard anon key +
//     `signInWithPassword` path a real user takes. No admin bypass
//     from the authenticated client's perspective.
//   · Teardown deletes the two fixture accounts; FK CASCADES clean
//     the seeded rows on all three tables without separate work.
//
// Rule 7 posture
// --------------
// This spec file is pure test authoring. It does not apply any
// migration, touch production, or activate any credential.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  sandboxAnonKey,
  sandboxSupabaseUrl,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
  type TestBusinessHandle,
} from "./_fixtures/sandbox-test-harness";

/** Returns true iff migration 370 is recorded as applied against the
 *  sandbox Supabase. Service-role read · bypasses RLS. */
async function isMigration370Applied(): Promise<boolean> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("nex_migration_history")
    .select("version")
    .eq("version", "370")
    .maybeSingle();
  if (error) {
    // An error here is not a reason to pass — bubble it so the
    // owner sees the schema state is unclear rather than silently
    // skipping every test.
    throw new Error(
      `isMigration370Applied · nex_migration_history query failed · ${error.message}`,
    );
  }
  return data != null;
}

/** Opens an authenticated supabase-js client scoped to a single
 *  fixture account. Uses the public anon key + sealed sign-in flow
 *  — NOT the service-role key — so RLS is evaluated normally. */
async function openAuthedClientForFixture(
  account: TestAccountHandle & { _password?: string },
): Promise<SupabaseClient> {
  if (!account._password) {
    throw new Error(
      "openAuthedClientForFixture · account handle has no _password · " +
        "create with createTestAccount({ returnPassword: true })",
    );
  }
  const anon = sandboxAnonKey();
  if (!anon) {
    throw new Error(
      "openAuthedClientForFixture · sandbox anon key is not set · check " +
        "NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY in .env.local",
    );
  }
  const client = createClient(sandboxSupabaseUrl(), anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account._password,
  });
  if (error) {
    throw new Error(
      `openAuthedClientForFixture · signInWithPassword failed · ${error.message}`,
    );
  }
  return client;
}

test.describe.serial("L-057 · migration 370 RLS account_id bridge · integration contract", () => {
  test("nex_notification · A sees own row, cannot see B's; A can UPDATE own read_at, cannot UPDATE B's", async () => {
    test.setTimeout(45_000);
    assertSandboxRef();

    const applied = await isMigration370Applied();
    test.skip(
      !applied,
      "BLOCKED-PENDING-MIG-370-APPLY · migration 370 is not recorded in nex_migration_history · " +
        "owner must issue `APPROVE MIGRATION 370 NEX_NOTIFICATION + NEX_AFFILIATE_MARKETPLACE + " +
        "NEX_DISCOVERY_SIGNAL RLS CORRECTION SANDBOX (kdstoyyeygcopkogqsyv)` and apply",
    );

    const handles: FixtureHandle[] = [];
    let clientA: SupabaseClient | null = null;
    try {
      const sb = supabaseAdmin();
      const a = await createTestAccount({ label: "mig370-notif-a", returnPassword: true });
      handles.push(a);
      const b = await createTestAccount({ label: "mig370-notif-b", returnPassword: true });
      handles.push(b);

      // Seed one notification per account via service-role (bypasses RLS).
      const seedA = await sb
        .from("nex_notification")
        .insert({
          recipient_account_id: a.nexAccountId,
          source: "message",
          source_ref: `mig370-spec:${a.nexAccountId}:a`,
          category: "chats",
          title: "A-title",
          subtitle: "A-subtitle",
          href: "/nex-native/x",
        })
        .select("id, read_at")
        .single();
      expect(seedA.error, "seed A row has no error").toBeNull();
      const seedB = await sb
        .from("nex_notification")
        .insert({
          recipient_account_id: b.nexAccountId,
          source: "message",
          source_ref: `mig370-spec:${b.nexAccountId}:b`,
          category: "chats",
          title: "B-title",
          subtitle: "B-subtitle",
          href: "/nex-native/x",
        })
        .select("id, read_at")
        .single();
      expect(seedB.error, "seed B row has no error").toBeNull();

      clientA = await openAuthedClientForFixture(a);

      // SELECT · A must see own row and NOT B's.
      const selA = await clientA
        .from("nex_notification")
        .select("id, recipient_account_id")
        .order("title", { ascending: true });
      expect(selA.error, "A SELECT nex_notification has no error").toBeNull();
      expect(
        selA.data?.map((r) => r.id).sort(),
        "A sees exactly their own notification · B's row invisible",
      ).toEqual([seedA.data?.id].sort());

      // UPDATE · A can flip own read_at.
      const now = new Date().toISOString();
      const updOwn = await clientA
        .from("nex_notification")
        .update({ read_at: now })
        .eq("id", seedA.data!.id)
        .select("id, read_at");
      expect(updOwn.error, "A UPDATE own read_at has no error").toBeNull();
      expect(
        updOwn.data?.length,
        "A UPDATE own returns the affected row",
      ).toBe(1);
      expect(
        updOwn.data?.[0]?.read_at,
        "A UPDATE own actually set read_at",
      ).not.toBeNull();

      // UPDATE · A cannot flip B's read_at (RLS filter returns zero
      // matching rows · supabase-js reports no error, 0 rows).
      const updOther = await clientA
        .from("nex_notification")
        .update({ read_at: now })
        .eq("id", seedB.data!.id)
        .select("id");
      expect(updOther.error, "A UPDATE B's returns no error").toBeNull();
      expect(
        updOther.data?.length ?? 0,
        "A UPDATE B's affects zero rows",
      ).toBe(0);

      // Service-role verifies B's row is still untouched.
      const verifyB = await sb
        .from("nex_notification")
        .select("read_at")
        .eq("id", seedB.data!.id)
        .maybeSingle();
      expect(
        verifyB.data?.read_at,
        "B's read_at remains null · A's UPDATE did not penetrate",
      ).toBeNull();
    } finally {
      if (clientA) await clientA.auth.signOut().catch(() => undefined);
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });

  test("nex_affiliate_promotion · A sees own promotion row, cannot see B's", async () => {
    test.setTimeout(45_000);
    assertSandboxRef();

    const applied = await isMigration370Applied();
    test.skip(!applied, "BLOCKED-PENDING-MIG-370-APPLY");

    const handles: FixtureHandle[] = [];
    let clientA: SupabaseClient | null = null;
    try {
      const sb = supabaseAdmin();
      const a = await createTestAccount({ label: "mig370-aff-a", returnPassword: true });
      handles.push(a);
      const b = await createTestAccount({ label: "mig370-aff-b", returnPassword: true });
      handles.push(b);

      // Each account owns a business; each self-promotes to it. Self-
      // promotion is the simplest valid seed · no cross-account data
      // is needed for the policy contract test.
      const bizA: TestBusinessHandle = await createTestBusiness(a, {
        label: "mig370-aff-a-biz",
      });
      handles.push(bizA);
      const bizB: TestBusinessHandle = await createTestBusiness(b, {
        label: "mig370-aff-b-biz",
      });
      handles.push(bizB);

      const seedA = await sb
        .from("nex_affiliate_promotion")
        .insert({
          affiliate_account_id: a.nexAccountId,
          business_id: bizA.businessId,
        })
        .select("id")
        .single();
      expect(seedA.error, "seed A promotion has no error").toBeNull();
      const seedB = await sb
        .from("nex_affiliate_promotion")
        .insert({
          affiliate_account_id: b.nexAccountId,
          business_id: bizB.businessId,
        })
        .select("id")
        .single();
      expect(seedB.error, "seed B promotion has no error").toBeNull();

      clientA = await openAuthedClientForFixture(a);

      const selA = await clientA
        .from("nex_affiliate_promotion")
        .select("id, affiliate_account_id");
      expect(selA.error, "A SELECT nex_affiliate_promotion has no error").toBeNull();
      expect(
        selA.data?.map((r) => r.id).sort(),
        "A sees exactly their own promotion · B's row invisible",
      ).toEqual([seedA.data?.id].sort());
    } finally {
      if (clientA) await clientA.auth.signOut().catch(() => undefined);
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });

  test("nex.discovery_signal · A sees own, cannot see B's; A can DELETE own, cannot DELETE B's", async () => {
    test.setTimeout(45_000);
    assertSandboxRef();

    const applied = await isMigration370Applied();
    test.skip(!applied, "BLOCKED-PENDING-MIG-370-APPLY");

    const handles: FixtureHandle[] = [];
    let clientA: SupabaseClient | null = null;
    try {
      const sb = supabaseAdmin();
      const a = await createTestAccount({ label: "mig370-sig-a", returnPassword: true });
      handles.push(a);
      const b = await createTestAccount({ label: "mig370-sig-b", returnPassword: true });
      handles.push(b);

      const bizA = await createTestBusiness(a, { label: "mig370-sig-a-biz" });
      handles.push(bizA);
      const bizB = await createTestBusiness(b, { label: "mig370-sig-b-biz" });
      handles.push(bizB);

      // discovery_signal lives in the `nex` schema · service-role
      // insert goes through the schema() selector.
      const seedA = await sb
        .schema("nex")
        .from("discovery_signal")
        .insert({
          account_id: a.nexAccountId,
          signal_type: "view",
          business_id: bizA.businessId,
          metadata: {},
        })
        .select("id")
        .single();
      expect(seedA.error, "seed A discovery_signal has no error").toBeNull();
      const seedB = await sb
        .schema("nex")
        .from("discovery_signal")
        .insert({
          account_id: b.nexAccountId,
          signal_type: "view",
          business_id: bizB.businessId,
          metadata: {},
        })
        .select("id")
        .single();
      expect(seedB.error, "seed B discovery_signal has no error").toBeNull();

      clientA = await openAuthedClientForFixture(a);

      const selA = await clientA
        .schema("nex")
        .from("discovery_signal")
        .select("id, account_id");
      expect(
        selA.error,
        "A SELECT nex.discovery_signal has no error",
      ).toBeNull();
      expect(
        selA.data?.map((r) => r.id).sort(),
        "A sees exactly their own discovery_signal · B's row invisible",
      ).toEqual([seedA.data?.id].sort());

      // DELETE · A can remove own row.
      const delOwn = await clientA
        .schema("nex")
        .from("discovery_signal")
        .delete()
        .eq("id", seedA.data!.id)
        .select("id");
      expect(delOwn.error, "A DELETE own has no error").toBeNull();
      expect(
        delOwn.data?.length,
        "A DELETE own returns the removed row",
      ).toBe(1);

      // DELETE · A cannot remove B's row (RLS returns zero matching).
      const delOther = await clientA
        .schema("nex")
        .from("discovery_signal")
        .delete()
        .eq("id", seedB.data!.id)
        .select("id");
      expect(delOther.error, "A DELETE B's returns no error").toBeNull();
      expect(
        delOther.data?.length ?? 0,
        "A DELETE B's affects zero rows",
      ).toBe(0);

      // Service-role verifies B's row still present.
      const verifyB = await sb
        .schema("nex")
        .from("discovery_signal")
        .select("id")
        .eq("id", seedB.data!.id)
        .maybeSingle();
      expect(
        verifyB.data?.id,
        "B's discovery_signal row survives A's DELETE attempt",
      ).toBe(seedB.data!.id);
    } finally {
      if (clientA) await clientA.auth.signOut().catch(() => undefined);
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });
});
