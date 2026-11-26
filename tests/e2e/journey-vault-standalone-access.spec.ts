// tests/e2e/journey-vault-standalone-access.spec.ts
//
// CYCLE 14 · F1 regression · Vault gate seal-violation fix.
// Owner-approved 2026-11-25.
// -----------------------------------------------------------------------------
// The sealed 2026-11-25 Vault entitlement rule (owner verbatim: "NEX Vault
// must remain separate from Shop subscriptions. Customers who want Vault
// purchase it separately.") is enforced by `effectiveVaultAccess` in
// `src/lib/nex-native/vault/vault-service.ts`, which considers ONLY the
// `vault_tier` and `vault_trial_used_at` columns on `nex_account`.
//
// Before F1, `src/app/nex-native/vault/page.tsx` gated Vault on
// `shop_tier IS NOT NULL` · a direct seal violation that let any Shop
// subscriber into the Vault even when they had never paid for it, and
// locked a Vault-only subscriber out because they had no Shop. This
// spec prevents the seal-violation code from ever returning.
//
// Scenarios exercised against the admin fixture row:
//   (1) vault_tier paid + no shop                → entitled (bounce to
//       /nex-native/vault/setup — no nex_vault_setup row exists yet)
//   (2) shop_tier paid + null vault entitlement  → NOT entitled
//       (Shop subscription MUST NOT grant Vault)
//   (3) no shop + no vault entitlement           → NOT entitled
//   (4) active vault_trial_used_at (3d old)      → entitled
//   (5) expired vault_trial_used_at (8d old)     → NOT entitled
//   (6) vault_tier='gratis' + null trial         → NOT entitled
//       ('gratis' is the no-paid-plan sentinel, not an entitlement)
//
// Scope honesty:
//   · All DB writes target `nex_account.id = ADMIN_ACCOUNT_ID`, the
//     admin fixture bound to `tests/e2e/.auth/state.json`. The spec
//     uses `test.describe.serial` + a baseline reset in `beforeEach`
//     + a final reset in `afterAll` so it cannot poison other specs
//     in the stage-a-pixel7 project.
//   · This spec does NOT prove Vault's inside-the-gate flows
//     (PIN setup wizard, unlock, encrypted chats) · those live in
//     their own specs. Here we prove only one thing: the gate
//     decision honours the sealed Vault-independent rule.
//   · No nex_vault_setup row is created, so entitled visits land on
//     /nex-native/vault/setup via the server redirect. We detect that
//     with maxRedirects:0 + Location header, not page.goto · the
//     signal is clean and independent of client-side JS.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

// Admin fixture bound to tests/e2e/.auth/state.json.
const ADMIN_ACCOUNT_ID = "80a9cedb-f477-4116-bcd8-78fb337d31e2";

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

/**
 * Prefer the pooler URL (`DATABASE_URL`) when its username-encoded ref
 * matches the sealed sandbox ref. The direct URL
 * (`SANDBOX_DATABASE_URL`) is IPv6-only on Supabase projects without
 * the IPv4 add-on and times out from IPv4-only hosts. The pooler URL
 * resolves over IPv4 and routes to the same sandbox project. Both
 * paths are gated by the sealed sandbox-ref guard · if the pooler
 * username does NOT encode the sandbox ref, we fall back to the
 * direct URL (which also runs through `assertSandboxRef`).
 */
function resolveSandboxDbUrl(): string {
  try {
    const pooler = envVar("DATABASE_URL");
    const u = new URL(pooler);
    const dotIdx = u.username.indexOf(".");
    const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
    if (refInUser === SANDBOX_REF) return pooler;
  } catch {
    // fall through
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

/**
 * Entitlement-column tuple honouring the DB CHECK constraints:
 *   · non-null shop_tier requires shop_period_end + shop_status (mig 257)
 *   · non-null non-'gratis' vault_tier requires vault_period_end +
 *     vault_status (mig 257)
 */
interface EntitlementState {
  readonly shop_tier: string | null;
  readonly shop_status: string | null;
  readonly shop_period_end: string | null;
  readonly vault_tier: string | null;
  readonly vault_status: string | null;
  readonly vault_period_end: string | null;
  readonly vault_trial_used_at: string | null;
}

const NEUTRAL: EntitlementState = {
  shop_tier: null,
  shop_status: null,
  shop_period_end: null,
  vault_tier: null,
  vault_status: null,
  vault_period_end: null,
  vault_trial_used_at: null,
};

// Columns we'd like to set. The mig-257 additions (shop_status,
// shop_period_end, vault_status, vault_period_end) may be absent from a
// sandbox DB that hasn't applied mig 257 yet. We probe the live schema
// and UPDATE only the subset that exists. The columns that always exist
// (shop_tier, vault_tier, vault_trial_used_at) are required and fatal
// if missing.
const ALL_ENTITLEMENT_COLUMNS = [
  "shop_tier",
  "shop_status",
  "shop_period_end",
  "vault_tier",
  "vault_status",
  "vault_period_end",
  "vault_trial_used_at",
] as const;

// The only truly required columns to make the spec meaningful AT ALL
// are vault_trial_used_at (needed for scenarios 3/4/5) and shop_tier
// (needed for scenario 2, the direct F1 regression guard). vault_tier
// is NOT required because scenarios that depend on it are individually
// gated below via `requireColumns(["vault_tier"])`. This lets the
// spec run partial coverage on a sandbox where the vault_tier column
// (mig 207 or 257) has not yet been applied.
const REQUIRED_ENTITLEMENT_COLUMNS = new Set([
  "shop_tier",
  "vault_trial_used_at",
]);

let cachedPresentColumns: Set<string> | null = null;

async function detectEntitlementColumns(c: Client): Promise<Set<string>> {
  if (cachedPresentColumns) return cachedPresentColumns;
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'nex_account'
         AND column_name = ANY($1)`,
    [[...ALL_ENTITLEMENT_COLUMNS]],
  );
  const present = new Set<string>(r.rows.map((row: { column_name: string }) => row.column_name));
  for (const req of REQUIRED_ENTITLEMENT_COLUMNS) {
    if (!present.has(req)) {
      throw new Error(
        `baseline entitlement column "${req}" missing from nex_account · cannot run F1 regression`,
      );
    }
  }
  cachedPresentColumns = present;
  return present;
}

async function setEntitlement(state: EntitlementState): Promise<void> {
  await withPgClient(async (c) => {
    const present = await detectEntitlementColumns(c);
    const sets: string[] = [];
    const vals: Array<string | null> = [ADMIN_ACCOUNT_ID];
    let i = 2;
    for (const col of ALL_ENTITLEMENT_COLUMNS) {
      if (!present.has(col)) continue;
      sets.push(`${col} = $${i}`);
      vals.push(state[col as keyof EntitlementState]);
      i += 1;
    }
    if (sets.length === 0) {
      throw new Error("no entitlement columns present on nex_account");
    }
    await c.query(
      `UPDATE nex_account SET ${sets.join(", ")} WHERE id = $1`,
      vals,
    );
  });
}

async function mig257ColumnsApplied(): Promise<boolean> {
  return await withPgClient(async (c) => {
    const present = await detectEntitlementColumns(c);
    return (
      present.has("shop_status") &&
      present.has("shop_period_end") &&
      present.has("vault_status") &&
      present.has("vault_period_end")
    );
  });
}

async function hasColumn(name: string): Promise<boolean> {
  return await withPgClient(async (c) => {
    const present = await detectEntitlementColumns(c);
    return present.has(name);
  });
}

async function ensureNoVaultSetupRow(): Promise<void> {
  // Keep the signal clean: entitled visits must land on /vault/setup
  // via the server redirect. If a row exists, the entitled visit
  // would instead render VaultLockedBootstrap at /vault.
  await withPgClient(async (c) => {
    await c.query(`DELETE FROM nex_vault_setup WHERE account_id = $1`, [
      ADMIN_ACCOUNT_ID,
    ]);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("Cycle 14 F1 · Vault gate honours vault_tier / vault_trial_used_at only", () => {
  test.beforeEach(async () => {
    assertSandboxRef();
    await setEntitlement(NEUTRAL);
    await ensureNoVaultSetupRow();
  });

  test.afterAll(async () => {
    // Leave the row in the same neutral state unrelated specs assume.
    await setEntitlement(NEUTRAL);
  });

  test("paid vault_tier + no shop · entitled · redirect to /vault/setup", async ({
    page,
    baseURL,
  }) => {
    test.skip(
      !(await hasColumn("vault_tier")),
      "vault_tier column not present in sandbox · requires mig 207/257. Scenario BLOCKED without owner-approved sandbox migration.",
    );
    await setEntitlement({
      ...NEUTRAL,
      vault_tier: "5gb",
      vault_status: "active",
      vault_period_end: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    });

    const res = await page.request.get(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { maxRedirects: 0, failOnStatusCode: false },
    );

    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(
      location,
      "paid Vault subscriber with no Shop MUST be let into Vault · " +
        "the sealed rule is that Vault is Shop-independent",
    ).toContain("/nex-native/vault/setup");
  });

  test("paid shop_tier + null vault entitlement · NOT entitled · paywall", async ({
    page,
    baseURL,
  }) => {
    // The regression this spec exists to prevent: before F1, this row
    // shape unlocked Vault because the page gated on shop_tier. The
    // sealed 2026-11-25 rule forbids that.
    await setEntitlement({
      ...NEUTRAL,
      shop_tier: "unlimited",
      shop_status: "active",
      shop_period_end: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    });

    await page.goto(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.locator("[data-nex-vault-entitlement-gate]"),
      "Shop subscriber without a separate Vault entitlement MUST see " +
        "the Vault paywall · Shop subscription MUST NOT grant Vault",
    ).toBeVisible();
    expect(page.url()).toContain("/nex-native/vault");
    expect(page.url()).not.toContain("/vault/setup");
  });

  test("no shop + no vault entitlement · NOT entitled · paywall", async ({
    page,
    baseURL,
  }) => {
    // NEUTRAL is already applied by beforeEach.
    await page.goto(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.locator("[data-nex-vault-entitlement-gate]"),
      "unentitled visitor MUST see the Vault paywall",
    ).toBeVisible();
  });

  test("active vault_trial_used_at (3 days old) · entitled · redirect to /vault/setup", async ({
    page,
    baseURL,
  }) => {
    // Vault page selects `vault_tier, vault_trial_used_at` in a single
    // Supabase query. If `vault_tier` is absent (mig 207/257 not applied
    // to sandbox) the select errors and both fields fall to null · the
    // trial check cannot succeed. Skip rather than mis-report.
    test.skip(
      !(await hasColumn("vault_tier")),
      "vault_tier column absent in sandbox · page-level select fails · trial path cannot be exercised · BLOCKED on mig 207/257.",
    );
    await setEntitlement({
      ...NEUTRAL,
      vault_trial_used_at: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    });

    const res = await page.request.get(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { maxRedirects: 0, failOnStatusCode: false },
    );

    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(
      location,
      "active trial window (< 7 days) must grant Vault access",
    ).toContain("/nex-native/vault/setup");
  });

  test("expired vault_trial_used_at (8 days old) · NOT entitled · paywall", async ({
    page,
    baseURL,
  }) => {
    await setEntitlement({
      ...NEUTRAL,
      vault_trial_used_at: new Date(Date.now() - 8 * DAY_MS).toISOString(),
    });

    await page.goto(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.locator("[data-nex-vault-entitlement-gate]"),
      "expired trial window (> 7 days) MUST drop the visitor onto the paywall",
    ).toBeVisible();
  });

  test("vault_tier='gratis' with no trial · NOT entitled · paywall", async ({
    page,
    baseURL,
  }) => {
    // 'gratis' is the no-paid-plan sentinel · it is NOT an entitlement.
    // `effectiveVaultAccess` explicitly treats `vault_tier !== 'gratis'`
    // as the paid-tier check.
    test.skip(
      !(await hasColumn("vault_tier")),
      "vault_tier column not present in sandbox · requires mig 207/257. Scenario BLOCKED without owner-approved sandbox migration.",
    );
    await setEntitlement({
      ...NEUTRAL,
      vault_tier: "gratis",
    });

    await page.goto(
      `${baseURL ?? "http://localhost:3008"}/nex-native/vault`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.locator("[data-nex-vault-entitlement-gate]"),
      "vault_tier='gratis' is the no-plan sentinel and MUST NOT grant Vault",
    ).toBeVisible();
  });
});
