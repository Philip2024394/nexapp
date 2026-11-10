// scripts/apply-migration-295-sandbox.mjs
//
// Phase A Chat · apply mig 295 (storage.objects RLS policies for
// nex-peer-chat-ciphertext private bucket) to SANDBOX. Hard-refuses
// production ref.
//
// Prereq · the storage bucket `nex-peer-chat-ciphertext` MUST already
// exist in the sandbox project. If it doesn't, create it first with:
//
//   node scripts/create-sandbox-bucket-ciphertext.mjs
//
// (The RLS policies this migration installs reference the bucket by
// id · they apply fine even without the bucket, but the bucket must
// exist before any upload or signed-URL mint attempts resolve.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/295_nex_peer_chat_ciphertext_bucket.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 295 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '295'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · history row missing");
    process.exit(4);
  }
  console.log(`✓ History: 295 · ${hist.rows[0].description}`);

  const policies = await v.query(
    `SELECT policyname, permissive, roles, cmd
       FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname LIKE 'nex_peer_chat_ciphertext_%'
      ORDER BY policyname`
  );
  const expected = [
    "nex_peer_chat_ciphertext_anon_deny",
    "nex_peer_chat_ciphertext_authenticated_deny",
    "nex_peer_chat_ciphertext_service_role_all",
  ];
  const got = policies.rows.map((r) => r.policyname).sort();
  for (const e of expected) {
    if (!got.includes(e)) {
      console.error(`✗ Policy missing: ${e}`);
      console.error(`Current policies: ${got.join(", ")}`);
      process.exit(5);
    }
  }
  console.log(`✓ All 3 ciphertext-bucket policies present`);

  const rolesByPolicy = Object.fromEntries(policies.rows.map((r) => [r.policyname, r]));
  if (!rolesByPolicy["nex_peer_chat_ciphertext_service_role_all"].roles.includes("service_role")) {
    console.error("✗ service_role_all policy does not target service_role");
    process.exit(6);
  }
  if (rolesByPolicy["nex_peer_chat_ciphertext_anon_deny"].permissive !== "RESTRICTIVE") {
    console.error("✗ anon_deny policy is not RESTRICTIVE");
    process.exit(7);
  }
  if (rolesByPolicy["nex_peer_chat_ciphertext_authenticated_deny"].permissive !== "RESTRICTIVE") {
    console.error("✗ authenticated_deny policy is not RESTRICTIVE");
    process.exit(8);
  }
  console.log(`✓ Policy roles + permissive/restrictive modes correct`);
} finally {
  await v.end();
}

console.log("\nMig 295 sandbox apply + verification complete.");
