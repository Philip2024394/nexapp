// scripts/_tmp/provision-vault-acceptance-fixtures.mjs
//
// Sandbox-only · 2026-11-14 · Vault browser acceptance fixtures.
// -----------------------------------------------------------------
// Prepares the sandbox for the Vault Contacts + Settings browser
// acceptance pass:
//
//   1. Reuses the two P6 auth fixtures (p6-customer@nex.invalid,
//      p6-seller@nex.invalid) linked to the sealed mock personas
//      nex-99901 (Hammerex Products) and nex-99903 (Rosa).
//   2. Grants both fixtures Shop entitlement (nex_account.shop_tier =
//      'shop') so the Vault setup gate passes.
//   3. Resets any existing nex_vault_setup row for BOTH fixtures so
//      the browser acceptance can drive the sealed setup wizard end-
//      to-end fresh each run. We delete only setup rows for THESE
//      two personas · no other data is touched.
//   4. Creates four disposable sandbox friends (dp6-f1 / dp6-f2 /
//      dp6-f3 wired to the customer, dp6-f4 wired to the seller),
//      friend edges in nex_friend_edge with status='accepted',
//      peer conversations where the branch requires it, and ZERO
//      vault entries (the browser will drive move-to-vault + delete
//      + block itself).
//
// Hard-refuses non-sandbox. Idempotent. Rotates passwords each run
// and writes everything the Playwright spec needs into
// .env.playwright.vault-acceptance (gitignored via .env*).
//
// NEVER creates `nex_vault_setup` rows directly. NEVER fabricates
// Vault key material. NEVER touches auth/security logic.

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { Client as PgClient } from "pg";

// ─── env ───────────────────────────────────────────────────────────

const envRaw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

const url =
  envValue("NEXT_PUBLIC_NEX_SUPABASE_URL") || envValue("NEX_SUPABASE_URL");
const serviceKey = envValue("NEX_SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = envValue("DATABASE_URL");

if (!url || !serviceKey || !databaseUrl) {
  console.error("STOP · missing Supabase or DATABASE_URL env");
  process.exit(1);
}
if (!url.includes("kdstoyyeygcopkogqsyv")) {
  console.error(`STOP · not sandbox (url=${url})`);
  process.exit(2);
}
if (url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · url contains production ref");
  process.exit(3);
}
if (!databaseUrl.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · DATABASE_URL is not sandbox");
  process.exit(4);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── fixture identities ───────────────────────────────────────────

const CUSTOMER = {
  label: "customer",
  email: "p6-customer@nex.invalid",
  personaHandle: "nex-99901",
  personaId: "11111111-1111-4111-8111-111111111111",
};
const SELLER = {
  label: "seller",
  email: "p6-seller@nex.invalid",
  personaHandle: "nex-99903",
  personaId: "11111111-1111-4111-8111-111111111113",
};

// Disposable sandbox friends. UUIDs fixed so repeated runs re-use
// the SAME disposable records (idempotent). Prefix `dddddddd-` is
// clearly a fixture · zero chance of colliding with real data.
// Sealed nex_account_handle_format constraint requires
// ^nex-[0-9]{5,}$ so we use the reserved 88xxx band for Vault
// acceptance fixtures (keeps them clearly distinct from the 999xx
// mock persona range + from real production handles).
const DISPOSABLES = [
  {
    key: "f1_vaulted_target",
    label: "Dp6 F1 (vaulted-target)",
    nexHandle: "nex-88001",
    accountId: "dddddddd-dddd-4000-8000-000000000001",
    friendOf: CUSTOMER,
    withConversation: true,
  },
  {
    key: "f2_not_vaulted",
    label: "Dp6 F2 (not-vaulted)",
    nexHandle: "nex-88002",
    accountId: "dddddddd-dddd-4000-8000-000000000002",
    friendOf: CUSTOMER,
    withConversation: true,
  },
  {
    key: "f3_no_conversation",
    label: "Dp6 F3 (no-conversation)",
    nexHandle: "nex-88003",
    accountId: "dddddddd-dddd-4000-8000-000000000003",
    friendOf: CUSTOMER,
    withConversation: false,
  },
  {
    key: "f4_seller_only",
    label: "Dp6 F4 (seller-only)",
    nexHandle: "nex-88004",
    accountId: "dddddddd-dddd-4000-8000-000000000004",
    friendOf: SELLER,
    withConversation: true,
  },
];

// ─── helpers ──────────────────────────────────────────────────────

function freshPassword() {
  return randomBytes(18).toString("base64url");
}

async function ensureAuthUser(email, password) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`admin.listUsers failed: ${listErr.message}`);
  const existing = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (upErr) throw new Error(`admin.updateUserById failed: ${upErr.message}`);
    return { id: existing.id, created: false };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`admin.createUser failed: ${error?.message ?? "no user"}`);
  return { id: data.user.id, created: true };
}

async function linkPersona(personaId, authUserId) {
  const { error } = await admin
    .from("nex_account")
    .update({ supabase_user_id: authUserId })
    .eq("id", personaId)
    .eq("is_mock_persona", true);
  if (error) throw new Error(`nex_account link failed: ${error.message}`);
}

async function grantShopEntitlement(personaId) {
  const { error } = await admin
    .from("nex_account")
    .update({ shop_tier: "shop" })
    .eq("id", personaId);
  if (error) throw new Error(`shop_tier set failed: ${error.message}`);
}

async function clearVaultSetupRow(personaId) {
  // We can delete a row safely · the Vault setup wizard writes a
  // fresh row on completion. We NEVER insert one here.
  const { error } = await admin
    .from("nex_vault_setup")
    .delete()
    .eq("account_id", personaId);
  if (error) throw new Error(`nex_vault_setup clear failed: ${error.message}`);
}

async function clearVaultEntriesForAccount(personaId) {
  // Scrub previous-run vault entries so the Contacts browser flow
  // starts with ALL friends in the not-vaulted / no-conversation
  // branches. Only touches the fixture persona.
  const { error } = await admin
    .from("nex_vault_entry")
    .delete()
    .eq("account_id", personaId);
  if (error)
    throw new Error(`nex_vault_entry clear failed: ${error.message}`);
}

async function ensureDisposableAccount(d) {
  // Direct pg so we can use INSERT ... ON CONFLICT with the
  // explicit UUID we want.
  const pg = new PgClient({ connectionString: databaseUrl });
  await pg.connect();
  try {
    await pg.query(
      `
      INSERT INTO nex_account (id, display_name, nex_handle, is_mock_persona)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        nex_handle   = EXCLUDED.nex_handle,
        is_mock_persona = true
      `,
      [d.accountId, d.label, d.nexHandle],
    );
  } finally {
    await pg.end();
  }
}

async function ensureFriendEdge(a, b) {
  // orderPair: smaller UUID first.
  const [aid, bid] = a < b ? [a, b] : [b, a];
  const pg = new PgClient({ connectionString: databaseUrl });
  await pg.connect();
  try {
    await pg.query(
      `
      INSERT INTO nex_friend_edge
        (a_account_id, b_account_id, requested_by, status)
      VALUES ($1, $2, $1, 'accepted')
      ON CONFLICT (a_account_id, b_account_id) DO UPDATE SET
        status = 'accepted',
        updated_at = now()
      `,
      [aid, bid],
    );
  } finally {
    await pg.end();
  }
}

async function ensurePeerConversation(a, b) {
  const [aid, bid] = a < b ? [a, b] : [b, a];
  const pg = new PgClient({ connectionString: databaseUrl });
  await pg.connect();
  try {
    const existing = await pg.query(
      `SELECT id FROM nex_peer_conversation
       WHERE participant_a_id = $1 AND participant_b_id = $2`,
      [aid, bid],
    );
    if (existing.rowCount > 0) return existing.rows[0].id;
    const id = randomUUID();
    await pg.query(
      `INSERT INTO nex_peer_conversation (id, participant_a_id, participant_b_id)
       VALUES ($1, $2, $3)`,
      [id, aid, bid],
    );
    return id;
  } finally {
    await pg.end();
  }
}

async function deletePeerConversation(a, b) {
  const [aid, bid] = a < b ? [a, b] : [b, a];
  const pg = new PgClient({ connectionString: databaseUrl });
  await pg.connect();
  try {
    await pg.query(
      `DELETE FROM nex_peer_conversation
       WHERE participant_a_id = $1 AND participant_b_id = $2`,
      [aid, bid],
    );
  } finally {
    await pg.end();
  }
}

// ─── main ─────────────────────────────────────────────────────────

const emitted = [];
for (const f of [CUSTOMER, SELLER]) {
  const password = freshPassword();
  const { id } = await ensureAuthUser(f.email, password);
  await linkPersona(f.personaId, id);
  await grantShopEntitlement(f.personaId);
  await clearVaultSetupRow(f.personaId);
  await clearVaultEntriesForAccount(f.personaId);
  emitted.push({ ...f, authUserId: id, password });
  console.log(
    `[${f.label}] email=${f.email} persona=${f.personaHandle} entitled=shop vault_setup=cleared`,
  );
}

for (const d of DISPOSABLES) {
  await ensureDisposableAccount(d);
  await ensureFriendEdge(d.accountId, d.friendOf.personaId);
  if (d.withConversation) {
    const convId = await ensurePeerConversation(
      d.accountId,
      d.friendOf.personaId,
    );
    d.conversationId = convId;
  } else {
    // Ensure NO conversation exists for the no-conversation branch.
    await deletePeerConversation(d.accountId, d.friendOf.personaId);
    d.conversationId = null;
  }
  console.log(
    `[disposable] ${d.label} → friend of ${d.friendOf.personaHandle} · conv=${d.conversationId ?? "none"}`,
  );
}

// Write env file the spec reads. Values that contain spaces or
// shell-meta are single-quoted so `export $(... | xargs)` is safe.
function escEnv(v) {
  // Single-quote-safe · anything inside '…' is literal except '
  // itself. We don't expect single-quotes in fixture values, but
  // escape to be defensive.
  return `'${String(v).replace(/'/g, "'\"'\"'")}'`;
}

const dest = ".env.playwright.vault-acceptance";
const body =
  "# Generated by scripts/_tmp/provision-vault-acceptance-fixtures.mjs\n" +
  "# Sandbox-only · regenerated on every run · do NOT commit.\n" +
  emitted
    .map(
      (f) =>
        `PLAYWRIGHT_VA_${f.label.toUpperCase()}_EMAIL=${escEnv(f.email)}\n` +
        `PLAYWRIGHT_VA_${f.label.toUpperCase()}_PASSWORD=${escEnv(f.password)}\n` +
        `PLAYWRIGHT_VA_${f.label.toUpperCase()}_ACCOUNT_ID=${escEnv(f.personaId)}\n`,
    )
    .join("\n") +
  "\n" +
  DISPOSABLES.map(
    (d) =>
      `PLAYWRIGHT_VA_${d.key.toUpperCase()}_ACCOUNT_ID=${escEnv(d.accountId)}\n` +
      `PLAYWRIGHT_VA_${d.key.toUpperCase()}_NAME=${escEnv(d.label)}\n` +
      `PLAYWRIGHT_VA_${d.key.toUpperCase()}_FRIEND_OF=${escEnv(d.friendOf.personaHandle)}\n` +
      (d.conversationId
        ? `PLAYWRIGHT_VA_${d.key.toUpperCase()}_CONV_ID=${escEnv(d.conversationId)}\n`
        : `PLAYWRIGHT_VA_${d.key.toUpperCase()}_CONV_ID=''\n`),
  ).join("") +
  "\n";
writeFileSync(dest, body);
console.log(`wrote ${dest}`);

// The earlier P6 provisioner wrote the SAME two fixture credentials
// into `.env.playwright.p6`. This acceptance script rotates those
// passwords on every run, so overwrite the P6 env file too to keep
// the earlier P6 specs green alongside this one.
const p6Dest = ".env.playwright.p6";
const p6Body =
  "# Generated by scripts/_tmp/provision-vault-acceptance-fixtures.mjs\n" +
  "# Sandbox-only · regenerated on every run · do NOT commit.\n" +
  "# Shared with the P6 two-context-isolation spec · both specs\n" +
  "# exercise the same two fixtures (p6-customer / p6-seller).\n" +
  emitted
    .map(
      (f) =>
        `PLAYWRIGHT_P6_${f.label.toUpperCase()}_EMAIL=${escEnv(f.email)}\n` +
        `PLAYWRIGHT_P6_${f.label.toUpperCase()}_PASSWORD=${escEnv(f.password)}\n`,
    )
    .join("\n") +
  "\n";
writeFileSync(p6Dest, p6Body);
console.log(`wrote ${p6Dest} (synced from acceptance provisioner)`);
