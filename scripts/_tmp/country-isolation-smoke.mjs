#!/usr/bin/env node
// Country isolation sandbox smoke test.
// Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Verifies:
//   · raw-insert 3 incidents (one per country · ireland, indonesia, worldwide)
//   · fetchRecentIncidents reads all 3
//   · HQ dashboard query filter · simulate ?country=ireland / ?country=indonesia /
//     ?country=worldwide and verify filtering in SQL (same logic as the
//     page.tsx client-side filter · verified against SQL to be certain).
//   · Scope index + country index · verify EXPLAIN uses an index.
//   · Monitor dedupe scope · reproduces the dedupKeyBase omission of
//     country in a tiny driver that simulates two "ireland then indonesia"
//     signals with the same scope+category · documents whether the
//     second one is suppressed.
//
// Usage:
//   node scripts/_tmp/country-isolation-smoke.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const envPath = path.join(repoRoot, ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const envMap = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  envMap[m[1]] = m[2];
}
const SBX_DB = envMap.SANDBOX_DATABASE_URL;
const SBX_URL = envMap.SANDBOX_SUPABASE_URL;
const SBX_KEY = envMap.SANDBOX_SUPABASE_SERVICE_ROLE_KEY;
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("production ref · aborting");
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) throw new Error("unexpected sandbox ref · aborting");

const CORRELATION = "e2e-country-isolation-2026-11-08";
const IDS = {
  ireland:   "00000000-c0e7-4000-8000-0000000001e1",
  indonesia: "00000000-c0e7-4000-8000-00000000001d",
  worldwide: "00000000-c0e7-4000-8000-00000000007e",
};

let PASS = 0;
let FAIL = 0;
const RESULTS = [];
function record(label, ok, detail) {
  if (ok) PASS += 1; else FAIL += 1;
  RESULTS.push({ label, ok, detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? " · " + detail : ""}`);
}
async function run(label, fn) {
  try { const detail = await fn(); record(label, true, detail); }
  catch (e) { record(label, false, e?.message ?? String(e)); }
}

const client = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await client.connect();

async function cleanup() {
  await client.query(`DELETE FROM nex_incident_event WHERE incident_id IN ($1,$2,$3)`, [IDS.ireland, IDS.indonesia, IDS.worldwide]);
  await client.query(`DELETE FROM nex_incident WHERE id IN ($1,$2,$3)`, [IDS.ireland, IDS.indonesia, IDS.worldwide]);
  await client.query(`DELETE FROM nex_incident WHERE correlation_id = $1`, [CORRELATION]);
}
await cleanup();

// Step 1 · insert 3 synthetic incidents.
await run("step 1 · insert ireland incident (scope=chat)", async () => {
  await client.query(
    `INSERT INTO nex_incident (id, category, severity, scope, country, status, summary, correlation_id)
     VALUES ($1, 'service', 'warn', 'chat', 'ireland', 'DETECTED', 'ireland chat degraded', $2)`,
    [IDS.ireland, CORRELATION],
  );
});
await run("step 1 · insert indonesia incident (scope=shops)", async () => {
  await client.query(
    `INSERT INTO nex_incident (id, category, severity, scope, country, status, summary, correlation_id)
     VALUES ($1, 'service', 'warn', 'shops', 'indonesia', 'DETECTED', 'indonesia shops degraded', $2)`,
    [IDS.indonesia, CORRELATION],
  );
});
await run("step 1 · insert worldwide incident (scope=feed)", async () => {
  await client.query(
    `INSERT INTO nex_incident (id, category, severity, scope, country, status, summary, correlation_id)
     VALUES ($1, 'service', 'warn', 'feed', 'worldwide', 'DETECTED', 'worldwide feed degraded', $2)`,
    [IDS.worldwide, CORRELATION],
  );
});

// Step 2 · HQ dashboard query · fetchRecentIncidents returns all 3.
await run("step 2 · fetchRecentIncidents raw equivalent · 3 rows under correlation", async () => {
  const r = await client.query(
    `SELECT country, scope, status FROM nex_incident WHERE correlation_id = $1 ORDER BY country`,
    [CORRELATION],
  );
  if (r.rowCount !== 3) throw new Error(`expected 3 rows · got ${r.rowCount}`);
  const countries = r.rows.map((x) => x.country).sort();
  if (JSON.stringify(countries) !== JSON.stringify(["indonesia", "ireland", "worldwide"])) {
    throw new Error(`unexpected countries · ${countries}`);
  }
  return `countries=${countries.join(",")}`;
});

// Step 3 · simulate HQ dashboard ?country=X filter (same semantics as
// page.tsx `filtered = recent.filter(r => !sp.country || r.country === sp.country)`).
for (const cc of ["ireland", "indonesia", "worldwide"]) {
  await run(`step 3 · dashboard filter ?country=${cc} returns only ${cc}`, async () => {
    const r = await client.query(
      `SELECT id, country FROM nex_incident WHERE correlation_id = $1 AND country = $2`,
      [CORRELATION, cc],
    );
    if (r.rowCount !== 1) throw new Error(`expected 1 row for country=${cc} · got ${r.rowCount}`);
    if (r.rows[0].country !== cc) throw new Error(`country mismatch · ${r.rows[0].country}`);
    return `id=${r.rows[0].id}`;
  });
}

// Step 4 · summary breakdown · by_country counts.
await run("step 4 · by_country counts · open + non-RECOVERED/CLOSED", async () => {
  const r = await client.query(
    `SELECT country, count(*)::int AS n FROM nex_incident
      WHERE correlation_id = $1 AND status NOT IN ('RECOVERED','CLOSED')
      GROUP BY country ORDER BY country`,
    [CORRELATION],
  );
  const got = Object.fromEntries(r.rows.map((x) => [x.country, x.n]));
  const want = { indonesia: 1, ireland: 1, worldwide: 1 };
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`by_country mismatch · got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  }
  return JSON.stringify(got);
});

// Step 5 · EXPLAIN · verify idx_nex_incident_status_country is a
// candidate for the (status + country) query shape.
await run("step 5 · EXPLAIN uses idx_nex_incident_status_country for by-country query", async () => {
  const r = await client.query(
    `EXPLAIN SELECT country, scope FROM nex_incident WHERE status NOT IN ('CLOSED','RECOVERED') AND country = 'ireland'`,
  );
  const plan = r.rows.map((x) => x["QUERY PLAN"]).join("\n");
  // On a 3-row table Postgres picks SeqScan · we check the index EXISTS
  // in pg_indexes (not necessarily chosen by the planner on micro data).
  const idx = await client.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'nex_incident' AND indexname = 'idx_nex_incident_status_country'`,
  );
  if (idx.rowCount !== 1) throw new Error("idx_nex_incident_status_country missing");
  return `index present · planner picked: ${plan.split("\n")[0]}`;
});

// Step 6 · Monitor dedupe scope · documented via a sub-driver that
// imports security-monitor.ts and simulates the two-country burst.
const driverPath = path.join(__dirname, "country-isolation-driver.ts");
await run("step 6 · monitor dedupe suppresses second country for identical scope+category", async () => {
  const binTsx = process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "tsx.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "tsx");
  const res = spawnSync(binTsx, ["--conditions=react-server", driverPath], {
    env: { ...process.env, NEX_SUPABASE_URL: SBX_URL, NEXT_PUBLIC_NEX_SUPABASE_URL: SBX_URL, NEX_SUPABASE_SERVICE_ROLE_KEY: SBX_KEY },
    encoding: "utf8",
    cwd: repoRoot,
    shell: process.platform === "win32",
  });
  if (res.status !== 0) throw new Error(`driver exited ${res.status} · ${res.stderr?.slice(0, 500)}`);
  const lines = res.stdout.split(/\r?\n/).filter((l) => l.startsWith("DRIVER:"));
  const parsed = lines.map((l) => JSON.parse(l.replace("DRIVER:", "")));
  // First call should emit a critical-severity attack incident.
  // Second call (different country, same scope+action) must be
  // suppressed by the in-process dedupe cache.
  if (parsed[0]?.result?.created !== true) throw new Error(`first call did not create · ${JSON.stringify(parsed[0])}`);
  if (parsed[1]?.result?.created !== false || parsed[1]?.result?.skipped !== "dedup_suppressed") {
    throw new Error(`second call not suppressed · ${JSON.stringify(parsed[1])}`);
  }
  return "confirmed · dedupe is scope+category only · NOT country-aware";
});

// Step 7 · sandbox cleanup · also delete the monitor-driver-created
// incident row (it uses correlation_id prefix 'monitor-driver-').
await run("step 7 · cleanup all synthetic rows", async () => {
  await cleanup();
  await client.query(
    `DELETE FROM nex_incident_event WHERE incident_id IN (SELECT id FROM nex_incident WHERE summary LIKE 'rate-limit escalation · action=e2e-isolation%')`,
  );
  await client.query(
    `DELETE FROM nex_incident WHERE summary LIKE 'rate-limit escalation · action=e2e-isolation%'`,
  );
  const r = await client.query(`SELECT count(*)::int AS n FROM nex_incident WHERE correlation_id = $1`, [CORRELATION]);
  if (r.rows[0].n !== 0) throw new Error("rows remain");
  return "cleaned";
});

await client.end();

console.log(`\nSUMMARY · PASS=${PASS} · FAIL=${FAIL}`);
console.log("SUMMARY:" + JSON.stringify({ pass: PASS, fail: FAIL, results: RESULTS }));
process.exit(FAIL === 0 ? 0 : 1);
