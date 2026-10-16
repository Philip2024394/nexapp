#!/usr/bin/env node
// scripts/preflight-see-my-theme-legacy-count-readonly.mjs
//
// Read-only preflight for the See-My-Theme legacy-impact decision.
// Owner-authored 2026-10-16 to quantify Defect 2 (asymmetric rows in
// nex_account_relationship_prefs that will cause themes to be HIDDEN
// after the See-My-Theme AND-rule gate ships).
//
// STRICT RULES:
//   · SELECT-only. No DDL, no DML, no GRANT, no transaction writes.
//   · Credentials never printed · the DATABASE_URL string is read from
//     .env.local and used only for the pg Client · never echoed.
//   · Fails loudly if the project ref is not ijvqdvsvwtwxzcqmoqit.
//   · Refuses to run without the --authorize flag · owner must opt in
//     explicitly, mirroring the sealed preflight for migrations 199-201.
//   · Prints a single JSON report at the end for the operator to review.
//
// Usage:
//   # Owner runs ONLY after explicit authorisation:
//   node scripts/preflight-see-my-theme-legacy-count-readonly.mjs --authorize
//
// What the script reports:
//   1. Row counts partitioned by {a=T,b=T}, {a=T,b=F}, {a=F,b=T},
//      {a=F,b=F} to size the legacy-impact decision precisely.
//   2. Join with nex_friend_edge (status='accepted') so the asymmetric
//      count is restricted to CURRENTLY ACCEPTED friends · pref rows
//      for ex-friends are irrelevant to the shipping decision.
//   3. Distinct account_id count on either side of any asymmetric row ·
//      an estimate of how many unique users will experience a change.

import { readFileSync } from "node:fs";
import pg from "pg";

const ENV_PATH = ".env.local";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

if (!process.argv.includes("--authorize")) {
  console.error("REFUSED · owner authorisation required.");
  console.error(
    "This script performs a read-only SELECT on the live Supabase project.",
  );
  console.error(
    "Re-run with --authorize ONLY after explicit owner authorisation.",
  );
  console.error("");
  console.error("No DB connection attempted. Nothing has run.");
  process.exit(1);
}

function loadDatabaseUrl() {
  const txt = readFileSync(ENV_PATH, "utf8");
  const match = txt.match(/^DATABASE_URL=(.+?)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1]
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
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
    total_rows: null,
    row_distribution: null,
    accepted_friend_asymmetric: null,
    unique_accounts_affected: null,
    sql_executed: [],
  };

  try {
    // 1 · Total row count · establishes baseline for "how much legacy
    //     preference data exists at all".
    const totalSql =
      "SELECT COUNT(*)::int AS total FROM nex_account_relationship_prefs";
    const total = await client.query(totalSql);
    report.total_rows = total.rows[0].total;
    report.sql_executed.push(totalSql);

    // 2 · Partition by the 4 cells of the a_shares × b_shares truth
    //     table. The two asymmetric cells (T,F) and (F,T) are the
    //     Defect-2-impacted population.
    const distSql = `
      SELECT
        SUM(CASE WHEN a_shares_theme = TRUE  AND b_shares_theme = TRUE  THEN 1 ELSE 0 END)::int AS both_true,
        SUM(CASE WHEN a_shares_theme = TRUE  AND b_shares_theme = FALSE THEN 1 ELSE 0 END)::int AS a_true_b_false,
        SUM(CASE WHEN a_shares_theme = FALSE AND b_shares_theme = TRUE  THEN 1 ELSE 0 END)::int AS a_false_b_true,
        SUM(CASE WHEN a_shares_theme = FALSE AND b_shares_theme = FALSE THEN 1 ELSE 0 END)::int AS both_false
      FROM nex_account_relationship_prefs
    `;
    const dist = await client.query(distSql);
    report.row_distribution = {
      ...dist.rows[0],
      asymmetric_total:
        (dist.rows[0].a_true_b_false ?? 0) + (dist.rows[0].a_false_b_true ?? 0),
    };
    report.sql_executed.push(distSql.replace(/\s+/g, " ").trim());

    // 3 · Restrict asymmetric rows to CURRENTLY ACCEPTED friend edges.
    //     Pref rows that outlive an unfriend / block don't affect the
    //     See-My-Theme release.
    const acceptedSql = `
      SELECT COUNT(*)::int AS n
      FROM nex_account_relationship_prefs p
      JOIN nex_friend_edge e
        ON e.a_account_id = p.a_account_id
       AND e.b_account_id = p.b_account_id
       AND e.status = 'accepted'
      WHERE p.a_shares_theme <> p.b_shares_theme
    `;
    const accepted = await client.query(acceptedSql);
    report.accepted_friend_asymmetric = accepted.rows[0].n;
    report.sql_executed.push(acceptedSql.replace(/\s+/g, " ").trim());

    // 4 · Distinct account IDs on either side of any asymmetric-and-
    //     currently-accepted relationship · upper-bound estimate of
    //     users who will see at least one theme go dark after release.
    const uniqueSql = `
      SELECT COUNT(DISTINCT account_id)::int AS n
      FROM (
        SELECT p.a_account_id AS account_id
          FROM nex_account_relationship_prefs p
          JOIN nex_friend_edge e
            ON e.a_account_id = p.a_account_id
           AND e.b_account_id = p.b_account_id
           AND e.status = 'accepted'
          WHERE p.a_shares_theme <> p.b_shares_theme
        UNION
        SELECT p.b_account_id AS account_id
          FROM nex_account_relationship_prefs p
          JOIN nex_friend_edge e
            ON e.a_account_id = p.a_account_id
           AND e.b_account_id = p.b_account_id
           AND e.status = 'accepted'
          WHERE p.a_shares_theme <> p.b_shares_theme
      ) t
    `;
    const unique = await client.query(uniqueSql);
    report.unique_accounts_affected = unique.rows[0].n;
    report.sql_executed.push(uniqueSql.replace(/\s+/g, " ").trim());
  } finally {
    await client.end();
  }

  // Decision guidance appended to the report (text only · no live
  // policy change).
  report.decision_guidance = {
    note: "Decision options · (A) ship if accepted_friend_asymmetric is 0; (B) deprecate the legacy /contacts theme-share toggle via a follow-up code change if the count is non-zero; (C) authorise a one-time data backfill after separate review. The script performs NO writes · the decision stays with the owner.",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("PREFLIGHT_ERROR:", err.message);
  process.exit(1);
});
