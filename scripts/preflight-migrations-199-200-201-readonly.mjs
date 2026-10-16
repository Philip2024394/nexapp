// scripts/preflight-migrations-199-200-201-readonly.mjs
//
// Read-only preflight for migrations 199 / 200 / 201.
// --------------------------------------------------------------
// STRICT RULES:
//   · SELECT-only. No DDL, no DML, no GRANT, no transaction writes.
//   · Credentials never printed · the DATABASE_URL string is read from
//     .env.local and used only for the pg Client · never echoed.
//   · Fails loudly if the project ref is not ijvqdvsvwtwxzcqmoqit.
//   · Prints a single JSON report at the end that the operator reviews
//     before deciding whether to apply.
//
// Usage: node scripts/preflight-migrations-199-200-201-readonly.mjs
//
// Owner directive 2026-10-16: "Do not expose credentials."

import { readFileSync } from "node:fs";
import pg from "pg";

const ENV_PATH = ".env.local";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const TARGET_COLUMNS = {
  199: [
    "read_receipts_enabled",
    "typing_indicator_enabled",
    "last_seen_visibility",
    "online_status_visibility",
  ],
  200: ["profile_visibility", "who_can_message"],
  201: [
    "auto_download_images",
    "auto_download_videos",
    "auto_download_audio",
    "upload_quality",
  ],
};

const TARGET_CHECK_CONSTRAINTS = {
  199: [
    "nex_account_last_seen_visibility_check",
    "nex_account_online_status_visibility_check",
  ],
  200: [
    "nex_account_profile_visibility_check",
    "nex_account_who_can_message_check",
  ],
  201: [
    "nex_account_auto_download_images_check",
    "nex_account_auto_download_videos_check",
    "nex_account_auto_download_audio_check",
    "nex_account_upload_quality_check",
  ],
};

function loadDatabaseUrl() {
  const txt = readFileSync(ENV_PATH, "utf8");
  const match = txt.match(/^DATABASE_URL=(.+?)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  // Strip optional surrounding quotes
  return match[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function identityGate(url) {
  const refMatch = url.match(/postgres\.([a-z0-9]{20})/);
  const ref = refMatch ? refMatch[1] : null;
  if (ref !== EXPECTED_PROJECT_REF) {
    throw new Error(
      `project-ref mismatch · expected ${EXPECTED_PROJECT_REF}, found ${ref ?? "none"}`,
    );
  }
  return { ref };
}

async function main() {
  const url = loadDatabaseUrl();
  const { ref } = identityGate(url);

  const client = new pg.Client({
    connectionString: url,
    statement_timeout: 15_000,
    query_timeout: 15_000,
  });
  await client.connect();

  const report = {
    timestamp_utc: new Date().toISOString(),
    identity: { project_ref: ref, expected: EXPECTED_PROJECT_REF, match: true },
    db_sanity: null,
    migration_history: {},
    column_precheck: { "199": {}, "200": {}, "201": {} },
    constraint_precheck: { "199": {}, "200": {}, "201": {} },
    row_counts: {},
    in_flight_ddl: null,
    r10_user_dependency: null,
    profile_page_behaviour: null,
    gates: {},
  };

  try {
    // 1 · DB sanity
    const sanity = await client.query(
      `select current_database() as db, current_user as role,
              inet_server_addr()::text as host,
              version() as pg_version`,
    );
    report.db_sanity = {
      database: sanity.rows[0].db,
      role: sanity.rows[0].role,
      // Host is masked · we only need to know it resolved, not the IP.
      server_resolved: !!sanity.rows[0].host,
      pg_version: sanity.rows[0].pg_version.split(" on ")[0],
    };

    // 2 · nex_migration_history presence of 198 + absence of 199/200/201
    //     Schema (confirmed read-only): (version text, applied_at timestamptz,
    //     description text, notes text). Version is the leading numeric
    //     prefix of the migration file (e.g. '198', not '198_foo').
    const hist = await client.query(
      `select version, applied_at, description from nex_migration_history
       where version in ('198','199','200','201')
       order by version`,
    );
    const histVersions = new Set(hist.rows.map((r) => r.version));
    report.migration_history = {
      "198_present": histVersions.has("198"),
      "199_present": histVersions.has("199"),
      "200_present": histVersions.has("200"),
      "201_present": histVersions.has("201"),
      rows: hist.rows.map((r) => ({
        version: r.version,
        applied_at: r.applied_at?.toISOString?.() ?? r.applied_at,
        description: r.description,
      })),
    };

    // 3 · Column pre-check for all 10 target columns
    const allTargets = [
      ...TARGET_COLUMNS[199],
      ...TARGET_COLUMNS[200],
      ...TARGET_COLUMNS[201],
    ];
    const cols = await client.query(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema='public' and table_name='nex_account'
         and column_name = ANY($1::text[])`,
      [allTargets],
    );
    const colMap = new Map(cols.rows.map((r) => [r.column_name, r]));
    for (const [migNum, names] of Object.entries(TARGET_COLUMNS)) {
      for (const name of names) {
        const row = colMap.get(name);
        report.column_precheck[migNum][name] = row
          ? {
              present: true,
              data_type: row.data_type,
              nullable: row.is_nullable === "YES",
              default: row.column_default,
            }
          : { present: false };
      }
    }

    // 4 · Check-constraint pre-check for 10 target constraints
    const allConstraints = [
      ...TARGET_CHECK_CONSTRAINTS[199],
      ...TARGET_CHECK_CONSTRAINTS[200],
      ...TARGET_CHECK_CONSTRAINTS[201],
    ];
    const cons = await client.query(
      `select conname from pg_constraint where conname = ANY($1::text[])`,
      [allConstraints],
    );
    const consSet = new Set(cons.rows.map((r) => r.conname));
    for (const [migNum, names] of Object.entries(TARGET_CHECK_CONSTRAINTS)) {
      for (const name of names) {
        report.constraint_precheck[migNum][name] = consSet.has(name);
      }
    }

    // 5 · Row count baselines
    const countsRes = await Promise.all([
      client.query(`select count(*)::int as n from nex_account`),
      client.query(`select count(*)::int as n from nex_account_profile`),
      client.query(`select count(*)::int as n from nex_peer_message`),
      client.query(`select count(*)::int as n from nex_peer_conversation`),
    ]);
    report.row_counts = {
      nex_account: countsRes[0].rows[0].n,
      nex_account_profile: countsRes[1].rows[0].n,
      nex_peer_message: countsRes[2].rows[0].n,
      nex_peer_conversation: countsRes[3].rows[0].n,
    };

    // 6 · In-flight DDL on nex_account
    const ddl = await client.query(
      `select pid, state, left(query, 200) as query_head
       from pg_stat_activity
       where query ilike '%nex_account%'
         and state != 'idle'
         and pid != pg_backend_pid()`,
    );
    report.in_flight_ddl = {
      count: ddl.rows.length,
      sessions: ddl.rows,
    };

    // 7 · R10 user-dependency check · do any clients ALREADY depend on
    //     any of the 10 new preference columns? Pre-apply this must be
    //     FALSE for all 10 (the columns don't exist yet, so no one can
    //     be reading them). This confirms there's no partial state.
    //     Also check: are there NON-DEFAULT values stored in any pre-
    //     existing column with the same name as a target (would signal
    //     a prior partial apply)?
    report.r10_user_dependency = {
      note: "Columns do not exist pre-apply (verified in column_precheck). No prior partial apply detected if column_precheck shows 'present:false' for all 10. Post-apply, defaults populate all pre-existing rows atomically via ADD COLUMN default-fill (PG 11+ fast-path).",
      prior_partial_apply_detected: [
        ...TARGET_COLUMNS[199],
        ...TARGET_COLUMNS[200],
        ...TARGET_COLUMNS[201],
      ].some((c) => colMap.has(c)),
    };

    // 8 · R10 current-profile-page behaviour · what is the server
    //     doing today for /u/[handle]? This is a CODE question with a
    //     DB-side signal: is there a nex_account_profile row for every
    //     active nex_account? If yes, the pre-gate code path would have
    //     served those profiles. If my dirty-tree gate shipped as-is
    //     with migration 200 UNAPPLIED, every non-self visit would 404.
    const profileCoverage = await client.query(
      `select
         (select count(*)::int from nex_account) as account_total,
         (select count(*)::int from nex_account_profile where is_discoverable = true) as discoverable_profiles,
         (select count(*)::int from nex_account_profile) as any_profile_total`,
    );
    report.profile_page_behaviour = {
      ...profileCoverage.rows[0],
      note: "If migration 200 is applied first, defaults populate profile_visibility='public' for all account_total rows. The /u/[handle] gate then serves non-self visitors successfully (default public). If the dirty-tree /u/[handle] code ships BEFORE migration 200, getPrivacyPreferencesSafe fails closed to 'private' and all non-self visits return 404 for discoverable_profiles accounts.",
    };

    // 9 · Gate aggregation
    const g = report.gates;

    g.G1_identity = {
      status: "PASS",
      detail: `project_ref=${ref} matches expected`,
    };

    g.G2_migration_198_applied = {
      status: report.migration_history["198_present"] ? "PASS" : "FAIL",
      detail: report.migration_history["198_present"]
        ? "198 history row present"
        : "198 history row ABSENT · investigate before applying 199/200/201",
    };

    const anyColumnPresent = [
      ...TARGET_COLUMNS[199],
      ...TARGET_COLUMNS[200],
      ...TARGET_COLUMNS[201],
    ].some((c) => colMap.has(c));
    g.G3_columns_clean = {
      status: anyColumnPresent ? "FAIL" : "PASS",
      detail: anyColumnPresent
        ? "At least one target column already exists · partial prior apply suspected"
        : "No target columns pre-exist · clean apply",
    };

    const anyConstraintPresent = [
      ...TARGET_CHECK_CONSTRAINTS[199],
      ...TARGET_CHECK_CONSTRAINTS[200],
      ...TARGET_CHECK_CONSTRAINTS[201],
    ].some((c) => consSet.has(c));
    g.G4_constraints_clean = {
      status: anyConstraintPresent ? "FAIL" : "PASS",
      detail: anyConstraintPresent
        ? "At least one target constraint already exists · partial prior apply suspected"
        : "No target constraints pre-exist · clean apply",
    };

    g.G5_no_in_flight_ddl = {
      status: ddl.rows.length === 0 ? "PASS" : "BLOCKED",
      detail:
        ddl.rows.length === 0
          ? "No competing DDL/DML sessions on nex_account"
          : `${ddl.rows.length} active session(s) touching nex_account · wait for drain`,
    };

    g.G6_history_rows_clean = {
      status:
        !report.migration_history["199_present"] &&
        !report.migration_history["200_present"] &&
        !report.migration_history["201_present"]
          ? "PASS"
          : "FAIL",
      detail:
        !report.migration_history["199_present"] &&
        !report.migration_history["200_present"] &&
        !report.migration_history["201_present"]
          ? "199/200/201 history rows absent · clean apply"
          : "At least one of 199/200/201 history rows exists · investigate",
    };

    g.G7_r10_rollout_risk = {
      status: "FLAGGED",
      detail:
        "The dirty-tree /u/[handle] code gates via getPrivacyPreferencesSafe. Pre-apply, this fails closed to profile_visibility='private' and returns 404 for all non-self visits. Deployment order MUST be: apply migration 200 FIRST (adds column with default 'public'), THEN ship the dirty-tree code. Owner is already preserving dirty tree uncommitted, so no deployment risk exists today. The risk crystallises at commit/push/deploy time.",
    };
  } finally {
    await client.end();
  }

  // Print a single consolidated JSON report
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("PREFLIGHT_ERROR:", err.message);
  process.exit(1);
});
