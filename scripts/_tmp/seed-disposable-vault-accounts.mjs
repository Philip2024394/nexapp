// scripts/_tmp/seed-disposable-vault-accounts.mjs
//
// Sandbox-only · 2026-11-15 · Checkpoint 5 disposable seed.
// -----------------------------------------------------------------
// Mints TWO disposable NEX accounts for destructive Vault testing
// (cross-account reset defence; 3 consecutive runs). These are NOT
// Hammerex or Rosa · the hardcoded persona IDs + emails make it
// impossible to accidentally collide with either.
//
// Each run DELETES any prior disposable accounts under the sealed
// prefix and recreates them clean. The email prefix `e2e-vault-ck5-`
// (hardcoded + guarded) cannot match Hammerex (p6-customer), Rosa
// (p6-seller), any of the dp6-fN fixtures, or any real user.
//
// Writes credentials to `.env.playwright.vault-ck5` (gitignored via
// the `.env*` pattern). The spec reads from that file.

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const envRaw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

const URL = envValue("NEXT_PUBLIC_NEX_SUPABASE_URL") || envValue("NEX_SUPABASE_URL");
const KEY = envValue("NEX_SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = envValue("DATABASE_URL") || envValue("SANDBOX_DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";

if (!URL || !KEY || !DB_URL) { console.error("STOP missing env"); process.exit(1); }
if (!URL.includes("kdstoyyeygcopkogqsyv")) { console.error("STOP not sandbox"); process.exit(2); }
if (URL.includes(PROD_REF) || DB_URL.includes(PROD_REF)) { console.error("STOP prod ref"); process.exit(3); }

const EMAIL_PREFIX = "e2e-vault-ck5-";
const EMAIL_DOMAIN = "nex.invalid"; // admin.createUser accepts .invalid (auth.signUp doesn't)
const PROTECTED_RE = /hammerex|rosa|p6-customer|p6-seller|nex-99901|nex-99903|dp6-f/i;

function guard(email) {
  if (!email.startsWith(EMAIL_PREFIX)) throw new Error(`refuse · bad prefix: ${email}`);
  if (!email.endsWith("@" + EMAIL_DOMAIN)) throw new Error(`refuse · bad domain: ${email}`);
  if (PROTECTED_RE.test(email)) throw new Error(`refuse · touches protected id: ${email}`);
}

const admin = createClient(URL, KEY, { auth: { persistSession: false } });
const pool = new pg.Client({ connectionString: DB_URL });
await pool.connect();

async function hardCleanPriorDisposables() {
  // Walk auth.users in pages, delete any with our prefix. Hard-guard
  // every email before calling admin.auth.admin.deleteUser.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const rows = data?.users ?? [];
    if (rows.length === 0) break;
    for (const u of rows) {
      const email = (u.email ?? "").toLowerCase();
      if (!email.startsWith(EMAIL_PREFIX)) continue;
      guard(email);
      await admin.auth.admin.deleteUser(u.id).catch(() => undefined);
    }
    if (rows.length < 1000) break;
  }
  // Also clean orphan nex_account rows (should cascade via supabase_user_id, but belt-and-braces)
  const { rows } = await pool.query(
    `SELECT id FROM nex_account WHERE nex_handle LIKE 'nex-e2e-ck5-%'`,
  );
  for (const r of rows) {
    await pool.query(`DELETE FROM nex_vault_pin_reset_token WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_vault_key_envelope WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_vault_pin_lockout WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_vault_pin_attempt WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_vault_security_event WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_vault_setup WHERE account_id = $1`, [r.id]);
    await pool.query(`DELETE FROM nex_account WHERE id = $1`, [r.id]);
  }
}

async function createOne(label) {
  const stamp = Date.now().toString(36);
  const email = `${EMAIL_PREFIX}${label}-${stamp}@${EMAIL_DOMAIN}`;
  guard(email);
  const password = `e2e-vault-ck5-${stamp}-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // bypass email confirmation · fixture only
    user_metadata: {
      display_name: `E2E CK5 ${label}`,
      fixture: "e2e-vault-ck5",
    },
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const supabaseUserId = data.user.id;

  // Mint the matching nex_account row manually. `shop_tier='shop'` so
  // the vault gate opens.
  const accountId = randomUUID();
  // nex_handle · must match the sealed CHECK `^nex-\d{5,}$`. Use a
  // 6-digit synthetic range starting at 970000 · far from any real
  // or mock persona (99xxx / 88xxx / 50xxx).
  const n = 970000 + Math.floor(Math.random() * 20000);
  const handle = `nex-${n}`;
  await pool.query(
    `INSERT INTO nex_account (id, supabase_user_id, display_name, nex_handle, locale, tier, shop_tier, is_mock_persona)
     VALUES ($1, $2, $3, $4, 'en', 'bisnis', 'shop', false)`,
    [accountId, supabaseUserId, `E2E CK5 ${label}`, handle],
  );
  return { label, email, password, accountId, supabaseUserId, handle };
}

await hardCleanPriorDisposables();

const A = await createOne("A");
const B = await createOne("B");

const lines = [
  "# Generated by scripts/_tmp/seed-disposable-vault-accounts.mjs",
  "# Sandbox-only · regenerated each run · disposables only (NOT Hammerex/Rosa)",
  `PLAYWRIGHT_CK5_A_EMAIL='${A.email}'`,
  `PLAYWRIGHT_CK5_A_PASSWORD='${A.password}'`,
  `PLAYWRIGHT_CK5_A_ACCOUNT_ID='${A.accountId}'`,
  `PLAYWRIGHT_CK5_A_HANDLE='${A.handle}'`,
  "",
  `PLAYWRIGHT_CK5_B_EMAIL='${B.email}'`,
  `PLAYWRIGHT_CK5_B_PASSWORD='${B.password}'`,
  `PLAYWRIGHT_CK5_B_ACCOUNT_ID='${B.accountId}'`,
  `PLAYWRIGHT_CK5_B_HANDLE='${B.handle}'`,
  "",
];
writeFileSync(".env.playwright.vault-ck5", lines.join("\n"));
console.log(`[CK5 disposables]  A=${A.handle}  B=${B.handle}  (credentials written to .env.playwright.vault-ck5)`);

await pool.end();
