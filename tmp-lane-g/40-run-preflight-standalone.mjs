// tmp-lane-g/40-run-preflight-standalone.mjs
//
// Standalone READ-ONLY validation of the repaired 00_preflight.sql.
// Runs the SQL directly, then inspects returned rows and reports per-check
// expected/observed/passed_bool. Sandbox-ref pinned.

import { readFileSync } from "node:fs";
import pg from "pg";

function env(key) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
const parsed = new URL(url);
let ref = null;
if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  ref = parsed.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? null;
} else if (parsed.hostname.endsWith(".supabase.co")) {
  ref = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
}
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ref '${ref}'`); process.exit(3); }
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production"); process.exit(3); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync("scripts/gate-a-connected-matrix/00_preflight.sql", "utf8");
console.log(`SQL length: ${sql.length} bytes`);

const c = new pg.Client({ connectionString: url });
await c.connect();
console.log("CONNECTED · running preflight (read-only)");
try {
  const r = await c.query(sql);
  const rows = Array.isArray(r) ? r.flatMap(x => x.rows ?? []) : (r.rows ?? []);
  console.log(`\nRETURNED ${rows.length} check rows:\n`);
  let fails = 0;
  for (const row of rows) {
    const ok = row.passed_bool === true;
    const tag = ok ? "PASS" : "FAIL";
    console.log(`  ${tag} · ${row.check_name}`);
    console.log(`         expected=${row.expected} observed=${row.observed}`);
    if (!ok) fails++;
  }
  console.log(`\n${rows.length - fails} PASS · ${fails} FAIL`);
  if (fails > 0) process.exit(1);
} catch (e) {
  console.error(`SQL EXECUTION FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
console.log("\nStandalone preflight validation · ALL CHECKS PASSED");
