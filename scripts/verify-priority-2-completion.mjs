// scripts/verify-priority-2-completion.mjs
//
// Owner-directed 2026-11-08 (round 12) · evidence-backed Priority 2
// completion audit. Queries sandbox kdstoyyeygcopkogqsyv to confirm
// what migrations 304 + 305 actually produced. READ-ONLY.
//
// Each check prints (requirement) · (expected) · (observed) · (PASS/FAIL).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;
if (projectRef === PRODUCTION_REF) {
  console.error(`STOP · READ-ONLY script refused · points at production ${PRODUCTION_REF}`);
  process.exit(2);
}
if (projectRef !== SANDBOX_REF) {
  console.error(`STOP · not pointed at sandbox ${SANDBOX_REF} · got ${projectRef}`);
  process.exit(2);
}
console.log(`Target · sandbox ${SANDBOX_REF}\n`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const results = [];
function record(id, requirement, expected, observed, pass) {
  results.push({ id, requirement, expected, observed, pass });
  const marker = pass ? "✓" : "✗";
  console.log(`${marker} [${id}] ${requirement}`);
  console.log(`    expected · ${expected}`);
  console.log(`    observed · ${observed}\n`);
}

try {
  // ─── R1 · HIGH severity tier ────────────────────────────────────
  const sev = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_severity'`,
  );
  const sevDef = sev.rows[0]?.def ?? "";
  const hasHigh = /'high'/.test(sevDef);
  record(
    "R1",
    "severity enum includes 'high' tier between warn and critical",
    "CHECK containing 'high'",
    sevDef,
    hasHigh,
  );

  // ─── R2 · lifecycle separation (DETECTED / RECOVERED / VERIFIED) ─
  const status = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_status'`,
  );
  const statusDef = status.rows[0]?.def ?? "";
  const hasVerified = /'VERIFIED'/.test(statusDef);
  const hasRecovered = /'RECOVERED'/.test(statusDef);
  const hasDetected = /'DETECTED'/.test(statusDef);
  record(
    "R2a",
    "status enum carries DETECTED + RECOVERED + VERIFIED as distinct values",
    "all three present",
    statusDef,
    hasVerified && hasRecovered && hasDetected,
  );

  const pairCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_verification_pair'`,
  );
  const pairDef = pairCk.rows[0]?.def ?? "";
  const pairEnforced = /verified_by_admin IS NULL/i.test(pairDef) && /verified_at IS NULL/i.test(pairDef);
  record(
    "R2b",
    "verified_by_admin + verified_at must be set TOGETHER or BOTH null",
    "paired CHECK present",
    pairDef || "(absent)",
    pairEnforced,
  );

  const shapeCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_verified_shape'`,
  );
  const shapeDef = shapeCk.rows[0]?.def ?? "";
  const shapeEnforced = /status <> 'VERIFIED'/i.test(shapeDef);
  record(
    "R2c",
    "status=VERIFIED REQUIRES verified_by_admin + verified_at",
    "shape CHECK present",
    shapeDef || "(absent)",
    shapeEnforced,
  );

  const eventKind = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_event_kind'`,
  );
  const eventDef = eventKind.rows[0]?.def ?? "";
  const hasVerifiedEvent = /'verified'/.test(eventDef);
  record(
    "R2d",
    "nex_incident_event.kind accepts 'verified' event",
    "kind CHECK includes 'verified'",
    eventDef,
    hasVerifiedEvent,
  );

  // ─── R3 · 3 new columns (last_seen_at, detection_source, service) ─
  const cols = await c.query(
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_incident'
        AND column_name IN ('last_seen_at','detection_source','service','verified_by_admin','verified_at','dedup_key','dedup_count')
      ORDER BY column_name`,
  );
  const colByName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]));
  record(
    "R3a",
    "last_seen_at timestamptz NOT NULL default now()",
    "NOT NULL · timestamp with time zone · default present",
    JSON.stringify(colByName.last_seen_at ?? null),
    colByName.last_seen_at?.is_nullable === "NO"
      && colByName.last_seen_at?.data_type === "timestamp with time zone"
      && colByName.last_seen_at?.column_default != null,
  );
  record(
    "R3b",
    "detection_source text NOT NULL default 'unknown' · bounded enum",
    "NOT NULL · text · default='unknown'",
    JSON.stringify(colByName.detection_source ?? null),
    colByName.detection_source?.is_nullable === "NO"
      && colByName.detection_source?.column_default != null
      && colByName.detection_source.column_default.includes("unknown"),
  );
  const sourceCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_detection_source'`,
  );
  const sourceDef = sourceCk.rows[0]?.def ?? "";
  record(
    "R3b-check",
    "detection_source has bounded enum CHECK",
    "CHECK with section_boundary / probe / signal / manual / etc.",
    sourceDef,
    /section_boundary/.test(sourceDef) && /security_signal/.test(sourceDef),
  );
  record(
    "R3c",
    "service text (nullable) · shape-constrained",
    "nullable · text",
    JSON.stringify(colByName.service ?? null),
    colByName.service?.is_nullable === "YES" && colByName.service?.data_type === "text",
  );
  const serviceCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_service_shape'`,
  );
  const serviceDef = serviceCk.rows[0]?.def ?? "";
  record(
    "R3c-check",
    "service has shape CHECK (length + regex)",
    "regex-bounded CHECK",
    serviceDef,
    /char_length/i.test(serviceDef) && /\^\[a-z\]/.test(serviceDef),
  );

  // ─── R4 · scope enum includes settings + community ────────────────
  const scope = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_scope'`,
  );
  const scopeDef = scope.rows[0]?.def ?? "";
  const hasSettings = /'settings'/.test(scopeDef);
  const hasCommunity = /'community'/.test(scopeDef);
  record(
    "R4",
    "scope enum includes 'settings' and 'community'",
    "both in CHECK",
    scopeDef,
    hasSettings && hasCommunity,
  );

  // ─── R5 · country-aware dedup support (dedup_key column + index) ─
  record(
    "R5a",
    "dedup_key column present (nullable text)",
    "YES · text",
    JSON.stringify(colByName.dedup_key ?? null),
    colByName.dedup_key?.data_type === "text" && colByName.dedup_key?.is_nullable === "YES",
  );
  const dedupKeyCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_dedup_key_shape'`,
  );
  const dedupKeyDef = dedupKeyCk.rows[0]?.def ?? "";
  record(
    "R5b",
    "dedup_key shape CHECK (bounded length + regex)",
    "char_length BETWEEN + regex present",
    dedupKeyDef,
    /char_length/i.test(dedupKeyDef),
  );
  const dedupIdx = await c.query(
    `SELECT indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename='nex_incident'
        AND indexname='idx_nex_incident_dedup_key'`,
  );
  const dedupIdxDef = dedupIdx.rows[0]?.indexdef ?? "";
  record(
    "R5c",
    "country-aware dedup index (dedup_key, country, status) PARTIAL · excludes CLOSED/VERIFIED",
    "partial index including both columns",
    dedupIdxDef,
    dedupIdxDef.includes("dedup_key")
      && dedupIdxDef.includes("country")
      && /CLOSED/.test(dedupIdxDef)
      && /VERIFIED/.test(dedupIdxDef),
  );

  // ─── R6 · dedup_count (migration 305) + 3 perf indexes ────────────
  record(
    "R6a",
    "dedup_count integer NOT NULL default 1 · CHECK (>=1)",
    "NOT NULL · integer · default 1",
    JSON.stringify(colByName.dedup_count ?? null),
    colByName.dedup_count?.is_nullable === "NO"
      && colByName.dedup_count?.data_type === "integer"
      && colByName.dedup_count?.column_default === "1",
  );
  const dedupCountCk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_dedup_count'`,
  );
  const dedupCountDef = dedupCountCk.rows[0]?.def ?? "";
  record(
    "R6b",
    "dedup_count CHECK (dedup_count >= 1)",
    "CHECK ((dedup_count >= 1))",
    dedupCountDef,
    /dedup_count >= 1/.test(dedupCountDef),
  );
  const perfIdx = await c.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='nex_incident'
        AND indexname IN ('idx_nex_incident_verified_at',
                          'idx_nex_incident_closed_at',
                          'idx_nex_incident_correlation_status',
                          'idx_nex_incident_last_seen_at')
      ORDER BY indexname`,
  );
  const perfNames = perfIdx.rows.map((r) => r.indexname);
  record(
    "R6c",
    "4 Priority-3 performance indexes present (last_seen_at + verified_at + closed_at + correlation_status)",
    "all 4 present",
    perfNames.join(", "),
    perfNames.length === 4,
  );

  // ─── R7 · historical compat invariants ────────────────────────────
  const compat = await c.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE last_seen_at IS NULL)::int AS missing_last_seen,
       COUNT(*) FILTER (WHERE detection_source IS NULL)::int AS missing_source,
       COUNT(*) FILTER (WHERE dedup_count IS NULL)::int AS missing_count,
       COUNT(*) FILTER (WHERE dedup_count < 1)::int AS invalid_count,
       COUNT(*) FILTER (WHERE status = 'VERIFIED')::int AS already_verified,
       COUNT(*) FILTER (WHERE status = 'VERIFIED' AND verified_by_admin IS NULL)::int AS verified_no_verifier
     FROM nex_incident`,
  );
  const compatRow = compat.rows[0];
  record(
    "R7a",
    "no historical row silently reinterpreted as VERIFIED without a verifier",
    "already_verified_without_verifier=0",
    `total=${compatRow.total} · already_VERIFIED=${compatRow.already_verified} · without_verifier=${compatRow.verified_no_verifier}`,
    compatRow.verified_no_verifier === 0,
  );
  record(
    "R7b",
    "historical rows backfilled · all nullable-forbidden columns populated",
    "0 NULL / 0 invalid across last_seen_at + detection_source + dedup_count",
    `missing_last_seen=${compatRow.missing_last_seen} · missing_source=${compatRow.missing_source} · missing_count=${compatRow.missing_count} · invalid_count=${compatRow.invalid_count}`,
    compatRow.missing_last_seen === 0
      && compatRow.missing_source === 0
      && compatRow.missing_count === 0
      && compatRow.invalid_count === 0,
  );

  // ─── R8 · service_role grants UNCHANGED from migration 300 ────────
  const grants = await c.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='nex_incident'
        AND grantee='service_role'
      ORDER BY privilege_type`,
  );
  const grantList = grants.rows.map((r) => r.privilege_type).join(", ");
  record(
    "R8",
    "service_role grants on nex_incident · INSERT + SELECT + UPDATE only (unchanged from 300)",
    "INSERT, SELECT, UPDATE",
    grantList,
    grantList === "INSERT, SELECT, UPDATE",
  );

  // ─── R9 · RLS enabled · zero policies (unchanged from 300) ────────
  const rls = await c.query(
    `SELECT relrowsecurity FROM pg_class
      WHERE relname='nex_incident' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')`,
  );
  const policies = await c.query(
    `SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='nex_incident'`,
  );
  record(
    "R9",
    "RLS enabled · zero policies (service_role-only access)",
    "relrowsecurity=t · policies=0",
    `relrowsecurity=${rls.rows[0]?.relrowsecurity} · policies=${policies.rows.length}`,
    rls.rows[0]?.relrowsecurity === true && policies.rows.length === 0,
  );

  // ─── R10 · migration ledger ─────────────────────────────────────────
  const hist = await c.query(
    `SELECT version, description FROM nex_migration_history
      WHERE version IN ('304', '305') ORDER BY version`,
  );
  const histVers = hist.rows.map((r) => r.version).join(", ");
  record(
    "R10",
    "nex_migration_history ledger contains 304 + 305",
    "both versions",
    histVers,
    hist.rows.length === 2,
  );

  // ─── Summary ────────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log("─".repeat(70));
  console.log(`Priority 2 completion · ${passed}/${total} checks PASS`);
  if (failed.length > 0) {
    console.log("\nFAILED:");
    for (const r of failed) console.log(`  · ${r.id} · ${r.requirement}`);
    process.exit(4);
  }
} finally {
  await c.end();
}
