// scripts/apply-migration-324-sandbox.mjs
// Apply mig 324 (nex_peer_message.delivery_status) to SANDBOX.
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
  resolve(repoRoot, "nex-supabase/migrations/324_nex_peer_message_delivery_status_PROPOSAL.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 324 applied · committed");
} catch (e) {
  if (!/already exists|duplicate|already recorded/i.test(e?.message ?? "")) {
    console.error("Apply failed:", e?.message);
    process.exit(3);
  }
  console.log(`(idempotent: ${e.message})`);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const col = await v.query(
    `SELECT column_name, column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_peer_message' AND column_name='delivery_status'`
  );
  if (col.rows.length !== 1) {
    console.error("✗ delivery_status column missing");
    process.exit(4);
  }
  console.log(`✓ delivery_status column · default=${col.rows[0].column_default}`);

  const chk = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.nex_peer_message'::regclass
        AND conname LIKE '%delivery_status%'`
  );
  if (chk.rows.length < 1) {
    console.error("✗ delivery_status CHECK missing");
    process.exit(5);
  }
  const def = chk.rows[0].def;
  for (const v2 of ["pending", "delivered", "expired"]) {
    if (!def.includes(`'${v2}'`)) {
      console.error(`✗ CHECK missing value ${v2} · got ${def}`);
      process.exit(6);
    }
  }
  console.log(`✓ CHECK contains pending/delivered/expired`);

  const idx = await v.query(
    "SELECT indexname FROM pg_indexes WHERE indexname='nex_peer_message_pending_encrypted_idx'"
  );
  if (idx.rows.length !== 1) {
    console.error("✗ pending-encrypted index missing");
    process.exit(7);
  }
  console.log(`✓ Partial index nex_peer_message_pending_encrypted_idx present`);
} finally {
  await v.end();
}
console.log("\nMig 324 sandbox apply + verification complete.");
