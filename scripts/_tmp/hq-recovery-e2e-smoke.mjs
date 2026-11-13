#!/usr/bin/env node
// HQ Security & Recovery · end-to-end sandbox smoke test.
// Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Steps:
//   1. Load SANDBOX_DATABASE_URL + SANDBOX_SUPABASE_* from .env.local.
//      Verify project ref is kdstoyyeygcopkogqsyv. Hard-abort if any
//      production ref (ijvqdvsvwtwxzcqmoqit) is detected.
//   2. Point the nex-native supabase-admin at the sandbox project via
//      NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY env (so the
//      service-layer dynamic imports use the sandbox).
//   3. Create a synthetic incident via raw INSERT (bypasses the service
//      for determinism · cleanup is also raw).
//   4. Dynamic-import the service via a sibling TS driver (hq-recovery-
//      e2e-smoke-driver.ts) with --conditions=react-server. The driver
//      calls fetchRecentIncidents + fetchIncidentEvents.
//   5. Walk DETECTED → INVESTIGATING → PROTECTING → RECOVERING → RECOVERED
//      via raw UPDATE. Insert a matching nex_incident_event per
//      transition (kind='status_transition').
//   6. Read events back · assert 5 transition events + the implicit
//      'created' marker written by the service when using createIncident
//      (we are inserting raw so no 'created' marker · expect 5 events).
//   7. UNKNOWN state · rename nex_incident_event → nex_incident_event_e2e
//      then run the driver again · verify fetchIncidentEvents returns
//      an empty array (not an error).
//   8. Restore the renamed table.
//   9. Clean up all synthetic rows.
//
// Usage:
//   node scripts/_tmp/hq-recovery-e2e-smoke.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

// ─── 1. Env resolution ─────────────────────────────────────────────────
const envPath = path.join(repoRoot, ".env.local");
if (!fs.existsSync(envPath)) throw new Error(".env.local missing");
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
if (!SBX_DB || !SBX_URL || !SBX_KEY) {
  throw new Error("missing SANDBOX_DATABASE_URL / SANDBOX_SUPABASE_URL / SANDBOX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
}
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit") || SBX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("safeguard · production project ref detected · aborting");
}
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv") || !SBX_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("safeguard · unexpected sandbox ref · aborting");
}

const SYN_INCIDENT_ID = "00000000-e2e5-4000-8000-000000000301";
const SYN_CORRELATION = "e2e-recovery-smoke-2026-11-08";
let PASS = 0;
let FAIL = 0;
const RESULTS = [];

function record(label, ok, detail) {
  if (ok) PASS += 1; else FAIL += 1;
  RESULTS.push({ label, ok, detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? " · " + detail : ""}`);
}

async function run(label, fn) {
  try {
    const detail = await fn();
    record(label, true, detail);
  } catch (e) {
    record(label, false, e?.message ?? String(e));
  }
}

const client = new pg.Client({
  connectionString: SBX_DB,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const ref = await client.query(
  "SELECT current_database() AS db, inet_server_addr() AS host",
);
console.log(`sandbox db · ${ref.rows[0].db} · host ${ref.rows[0].host}`);

// Pre-flight · verify migration 300 is applied + tables exist.
const preflight = await client.query(`
  SELECT
    (SELECT 1 FROM nex_migration_history WHERE version = '300') AS mig300,
    to_regclass('nex_incident')       AS t_incident,
    to_regclass('nex_incident_event') AS t_event
`);
console.log("preflight:", preflight.rows[0]);

// Idempotent prior-run cleanup.
async function cleanup() {
  await client.query(`DELETE FROM nex_incident_event WHERE incident_id = $1`, [SYN_INCIDENT_ID]);
  await client.query(`DELETE FROM nex_incident WHERE id = $1`, [SYN_INCIDENT_ID]);
  await client.query(`DELETE FROM nex_incident WHERE correlation_id = $1`, [SYN_CORRELATION]);
}
await cleanup();

// ─── Step 2 · create synthetic incident via raw INSERT ────────────────
await run("step 2 · raw INSERT synthetic incident (DETECTED, severity=warn, scope=chat, country=ireland)", async () => {
  await client.query(
    `
    INSERT INTO nex_incident (id, category, severity, scope, country, status, summary, correlation_id, users_affected_count, admin_action_required)
    VALUES ($1, 'service', 'warn', 'chat', 'ireland', 'DETECTED', 'e2e smoke · chat degraded', $2, 0, false)
    `,
    [SYN_INCIDENT_ID, SYN_CORRELATION],
  );
  return `inserted id=${SYN_INCIDENT_ID}`;
});

// ─── Step 3 · read via fetchRecentIncidents through TS driver ─────────
const driverPath = path.join(__dirname, "hq-recovery-e2e-smoke-driver.ts");

function callDriver(args) {
  const env = {
    ...process.env,
    NEX_SUPABASE_URL: SBX_URL,
    NEXT_PUBLIC_NEX_SUPABASE_URL: SBX_URL,
    NEX_SUPABASE_SERVICE_ROLE_KEY: SBX_KEY,
  };
  const binTsx = process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "tsx.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "tsx");
  const res = spawnSync(
    binTsx,
    ["--conditions=react-server", driverPath, ...args],
    { env, encoding: "utf8", cwd: repoRoot, shell: process.platform === "win32" },
  );
  return res;
}

await run("step 3 · driver fetchRecentIncidents finds synthetic incident", async () => {
  const res = callDriver(["fetchRecent", SYN_INCIDENT_ID]);
  if (res.status !== 0) {
    throw new Error(`driver exited ${res.status} · stdout=${res.stdout?.slice(0, 500)} · stderr=${res.stderr?.slice(0, 500)}`);
  }
  const line = res.stdout.split(/\r?\n/).find((l) => l.startsWith("DRIVER:"));
  if (!line) throw new Error(`no DRIVER line in stdout · ${res.stdout?.slice(0, 500)}`);
  const parsed = JSON.parse(line.replace("DRIVER:", ""));
  if (!parsed.found) throw new Error(`synthetic incident not found in fetchRecentIncidents · got ${parsed.count} rows`);
  return `found id in recent list (count=${parsed.count})`;
});

// ─── Step 4 · lifecycle transitions ───────────────────────────────────
async function transition(fromStatus, toStatus) {
  const upd = await client.query(
    `UPDATE nex_incident SET status = $1, updated_at = now() WHERE id = $2 AND status = $3 RETURNING id`,
    [toStatus, SYN_INCIDENT_ID, fromStatus],
  );
  if (upd.rowCount !== 1) throw new Error(`update expected 1 row (from=${fromStatus}→${toStatus}) got ${upd.rowCount}`);
  await client.query(
    `INSERT INTO nex_incident_event (incident_id, kind, from_status, to_status, note) VALUES ($1, 'status_transition', $2, $3, $4)`,
    [SYN_INCIDENT_ID, fromStatus, toStatus, `e2e transition ${fromStatus}->${toStatus}`],
  );
}

await run("step 4a · DETECTED → INVESTIGATING", () => transition("DETECTED", "INVESTIGATING"));
await run("step 4b · INVESTIGATING → PROTECTING", () => transition("INVESTIGATING", "PROTECTING"));
await run("step 4c · PROTECTING → RECOVERING", () => transition("PROTECTING", "RECOVERING"));
await run("step 4d · RECOVERING → RECOVERED", async () => {
  await transition("RECOVERING", "RECOVERED");
  await client.query(`UPDATE nex_incident SET resolved_at = now() WHERE id = $1`, [SYN_INCIDENT_ID]);
});

// ─── Step 5 · event history readback ──────────────────────────────────
await run("step 5 · event history has 4 transitions in order", async () => {
  const r = await client.query(
    `SELECT from_status, to_status FROM nex_incident_event WHERE incident_id = $1 AND kind = 'status_transition' ORDER BY at ASC, id ASC`,
    [SYN_INCIDENT_ID],
  );
  const expect = [
    ["DETECTED", "INVESTIGATING"],
    ["INVESTIGATING", "PROTECTING"],
    ["PROTECTING", "RECOVERING"],
    ["RECOVERING", "RECOVERED"],
  ];
  if (r.rowCount !== 4) throw new Error(`expected 4 transition events · got ${r.rowCount}`);
  for (let i = 0; i < expect.length; i += 1) {
    const [fe, te] = expect[i];
    if (r.rows[i].from_status !== fe || r.rows[i].to_status !== te) {
      throw new Error(`row ${i} = ${r.rows[i].from_status}→${r.rows[i].to_status} expected ${fe}→${te}`);
    }
  }
  return `4 transitions verified`;
});

// Verify the driver's fetchIncidentEvents sees the events too.
await run("step 5b · driver fetchIncidentEvents returns 4 events ordered ascending", async () => {
  const res = callDriver(["fetchEvents", SYN_INCIDENT_ID]);
  if (res.status !== 0) throw new Error(`driver exited ${res.status} · ${res.stderr?.slice(0, 500)}`);
  const line = res.stdout.split(/\r?\n/).find((l) => l.startsWith("DRIVER:"));
  const parsed = JSON.parse(line.replace("DRIVER:", ""));
  if (parsed.count !== 4) throw new Error(`driver saw ${parsed.count} events · expected 4`);
  return `driver count=${parsed.count}`;
});

// ─── Step 7 · UNKNOWN state · rename nex_incident_event ───────────────
await run("step 7a · rename nex_incident_event → nex_incident_event_e2e_backup", async () => {
  await client.query(`ALTER TABLE nex_incident_event RENAME TO nex_incident_event_e2e_backup`);
});

await run("step 7b · fetchIncidentEvents returns [] (no throw) when table absent", async () => {
  const res = callDriver(["fetchEvents", SYN_INCIDENT_ID]);
  if (res.status !== 0) throw new Error(`driver exited ${res.status} · ${res.stderr?.slice(0, 500)}`);
  const line = res.stdout.split(/\r?\n/).find((l) => l.startsWith("DRIVER:"));
  const parsed = JSON.parse(line.replace("DRIVER:", ""));
  if (parsed.count !== 0) throw new Error(`expected 0 events (table renamed) · got ${parsed.count}`);
  if (parsed.threw) throw new Error(`driver threw during fetchIncidentEvents · ${parsed.error}`);
  return "returned [] gracefully";
});

// ─── Step 8 · restore table ───────────────────────────────────────────
await run("step 8 · rename back · restore nex_incident_event", async () => {
  await client.query(`ALTER TABLE nex_incident_event_e2e_backup RENAME TO nex_incident_event`);
});

await run("step 8b · post-restore sanity · 4 events still present", async () => {
  const r = await client.query(
    `SELECT count(*)::int AS n FROM nex_incident_event WHERE incident_id = $1`,
    [SYN_INCIDENT_ID],
  );
  if (r.rows[0].n !== 4) throw new Error(`expected 4 events after restore · got ${r.rows[0].n}`);
  return `${r.rows[0].n} events present`;
});

// ─── Step 9 · cleanup ─────────────────────────────────────────────────
await run("step 9 · cleanup synthetic rows", async () => {
  await cleanup();
  const r = await client.query(`SELECT count(*)::int AS n FROM nex_incident WHERE id = $1`, [SYN_INCIDENT_ID]);
  if (r.rows[0].n !== 0) throw new Error("synthetic row not cleaned");
  return "cleaned";
});

await client.end();

console.log(`\nSUMMARY · PASS=${PASS} · FAIL=${FAIL}`);
// Emit a machine-readable summary line for the markdown writer.
console.log("SUMMARY:" + JSON.stringify({ pass: PASS, fail: FAIL, results: RESULTS }));
process.exit(FAIL === 0 ? 0 : 1);
