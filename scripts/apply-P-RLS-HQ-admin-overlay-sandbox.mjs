// scripts/apply-P-RLS-HQ-admin-overlay-sandbox.mjs
// Apply the HQ admin SELECT overlay to SANDBOX. Hard-refuses prod.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/P-RLS-HQ-admin-overlay_PROPOSAL.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("HQ admin overlay applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const fn = await v.query(
    "SELECT 1 FROM pg_proc WHERE proname='nex_is_hq_admin' AND pronamespace='public'::regnamespace"
  );
  if (fn.rows.length < 1) { console.error("✗ nex_is_hq_admin() function missing"); process.exit(4); }
  console.log(`✓ nex_is_hq_admin() function present`);

  const policies = await v.query(
    "SELECT COUNT(*)::int AS n FROM pg_policies WHERE policyname LIKE '%admin_read'"
  );
  console.log(`✓ Admin-read policies present: ${policies.rows[0].n}`);

  // SAFETY INVARIANT · audit tables must NOT have admin overlay
  const auditOverlay = await v.query(
    "SELECT tablename, policyname FROM pg_policies WHERE policyname LIKE '%admin_read' AND tablename IN ('nex_pilot_operator_audit', 'nex_security_audit_log')"
  );
  if (auditOverlay.rows.length > 0) {
    console.error("✗ CRITICAL · admin overlay was added to audit tables · invariant breach");
    for (const r of auditOverlay.rows) console.error(`  - ${r.tablename}.${r.policyname}`);
    process.exit(5);
  }
  console.log(`✓ Audit tables DO NOT have admin overlay (invariant preserved)`);
} finally {
  await v.end();
}
console.log("\nHQ admin overlay sandbox apply + verification complete.");
