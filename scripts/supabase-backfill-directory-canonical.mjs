#!/usr/bin/env node
// scripts/supabase-backfill-directory-canonical.mjs
//
// Copies business_canonical + business_evidence rows from nex_dev
// (localhost) to the sealed Supabase project.
//
// Safety:
//   · Verifies both endpoints before touching data.
//   · Supabase target hard-gated on project id ijvqdvsvwtwxzcqmoqit.
//   · ON CONFLICT (canonical_business_id) DO NOTHING for canonical.
//   · ON CONFLICT (candidate_id) DO NOTHING for evidence (unique key).
//   · Reads coordinates as text via ST_AsEWKT and writes with
//     ST_GeogFromText so the geography column round-trips cleanly.
//   · Batched inserts for throughput.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-backfill-directory-canonical.mjs

import pg from "pg";

const SOURCE_URL = process.env.NEX_POSTGRES_URL;
const TARGET_URL = process.env.DATABASE_URL;
const BATCH_SIZE = 200;
const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  if (!u.hostname.endsWith("pooler.supabase.com")) {
    throw new Error(`REFUSED · target host '${u.hostname}' is not the Supabase pooler`);
  }
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · target pooler user '${u.username}' is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

function verifySource(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
    throw new Error(`REFUSED · source host '${u.hostname}' is not localhost (nex_dev)`);
  }
}

async function main() {
  verifySource(SOURCE_URL);
  verifyTarget(TARGET_URL);
  const src = new pg.Client({ connectionString: SOURCE_URL });
  const dst = new pg.Client({ connectionString: TARGET_URL });
  await src.connect();
  await dst.connect();

  const srcCount = await src.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical");
  const dstCount = await dst.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical");
  console.log(`canonical rows · source=${srcCount.rows[0].n} · target=${dstCount.rows[0].n}`);

  const srcEvCount = await src.query("SELECT COUNT(*)::int AS n FROM nex.business_evidence");
  const dstEvCount = await dst.query("SELECT COUNT(*)::int AS n FROM nex.business_evidence");
  console.log(`evidence rows · source=${srcEvCount.rows[0].n} · target=${dstEvCount.rows[0].n}`);
  console.log("");

  // === business_canonical ===
  console.log("=== business_canonical backfill ===");
  // name_norm omitted · it is GENERATED ALWAYS on Supabase and auto-computed
  // from name_canonical. On nex_dev it is a regular column; the DB rebuilds
  // the value on insert and matches the source.
  const canonicalCols = [
    "canonical_business_id", "entity_type", "country", "lifecycle_state",
    "name_canonical", "aliases", "phone_e164", "website_apex",
    "osm_id", "wikidata_qid", "city", "district", "street_line",
    "neighbourhood", "address",
    "category_ids", "services_products",
    "supersedes_business_id", "superseded_by_business_id",
    "last_verified_at", "created_at", "updated_at",
  ];
  const canonSelectSql =
    "SELECT " +
    canonicalCols.map((c) => (c === "last_verified_at" || c === "created_at" || c === "updated_at" ? c : c)).join(", ") +
    ", ST_AsEWKT(coordinates) AS coordinates_ewkt " +
    "FROM nex.business_canonical ORDER BY canonical_business_id";

  const canonInsertCols = [...canonicalCols, "coordinates"];
  const canonInsertSql =
    "INSERT INTO nex.business_canonical (" + canonInsertCols.join(", ") + ") " +
    "VALUES " + /* placeholders filled per-batch */ "%VALUES% " +
    "ON CONFLICT (canonical_business_id) DO NOTHING";

  await streamCopy({
    src,
    dst,
    label: "business_canonical",
    selectSql: canonSelectSql,
    buildInsert: (rows) => {
      const colCount = canonInsertCols.length;
      const tuples = [];
      const params = [];
      for (let i = 0; i < rows.length; i++) {
        const base = i * colCount + 1;
        const r = rows[i];
        tuples.push("(" + canonInsertCols.map((_, k) => "$" + (base + k)).join(", ") + ")");
        for (const c of canonicalCols) {
          params.push(r[c] === undefined ? null : r[c]);
        }
        // coordinates: ST_GeogFromText(ewkt) · caller passes the EWKT text
        // but we need to wrap at SQL level. We swap the placeholder for an
        // inline expression further below.
        params.push(r.coordinates_ewkt);
      }
      let sql = "INSERT INTO nex.business_canonical (" + canonInsertCols.join(", ") + ") VALUES " + tuples.join(", ") + " ON CONFLICT (canonical_business_id) DO NOTHING";
      // Replace each coordinates placeholder with ST_GeogFromText($N) · last
      // placeholder of each tuple is coordinates. Compute per-tuple index.
      const lastColIndex = canonInsertCols.length - 1;
      // Walk tuples and rewrite $(base+lastColIndex) → ST_GeogFromText($base+lastColIndex)
      for (let i = 0; i < rows.length; i++) {
        const base = i * colCount + 1;
        const target = "$" + (base + lastColIndex);
        const needle = new RegExp("\\" + target + "(?![0-9])");
        sql = sql.replace(needle, "ST_GeogFromText(" + target + ")");
      }
      return { sql, params };
    },
  });

  // === business_evidence ===
  console.log("");
  console.log("=== business_evidence backfill ===");
  const evCols = [
    "evidence_id", "canonical_business_id", "schema_version", "candidate_id",
    "candidate_integrity_hash", "decision_record_id", "review_package_id",
    "legacy_source_table", "legacy_source_ref", "legacy_source_internal_id",
    "resolver_verdict_kind", "resolver_target_id", "resolver_score",
    "observation_generator", "observation_run_id", "observation_generated_at",
    "observation_decision_timestamp", "observation_founder_id",
    "source_id", "created_at",
  ];
  await streamCopy({
    src,
    dst,
    label: "business_evidence",
    selectSql: "SELECT " + evCols.join(", ") + " FROM nex.business_evidence ORDER BY evidence_id",
    buildInsert: (rows) => {
      const n = evCols.length;
      const tuples = [];
      const params = [];
      for (let i = 0; i < rows.length; i++) {
        const base = i * n + 1;
        tuples.push("(" + evCols.map((_, k) => "$" + (base + k)).join(", ") + ")");
        for (const c of evCols) params.push(rows[i][c] === undefined ? null : rows[i][c]);
      }
      return {
        sql: "INSERT INTO nex.business_evidence (" + evCols.join(", ") + ") VALUES " + tuples.join(", ") + " ON CONFLICT (evidence_id) DO NOTHING",
        params,
      };
    },
  });

  await src.end();
  await dst.end();
}

async function streamCopy({ src, dst, label, selectSql, buildInsert }) {
  const t0 = Date.now();
  // Count first for progress
  const total = (await src.query("SELECT COUNT(*)::int AS n FROM (" + selectSql + ") x")).rows[0].n;
  console.log("  source rows: " + total);
  if (total === 0) {
    console.log("  nothing to copy");
    return;
  }

  // Stream the rows via cursor
  await src.query("BEGIN READ ONLY");
  await src.query("DECLARE copy_cursor NO SCROLL CURSOR FOR " + selectSql);

  let inserted = 0;
  let fetched = 0;
  let failed = 0;
  const sampleFailures = [];
  while (true) {
    const chunk = await src.query("FETCH " + BATCH_SIZE + " FROM copy_cursor");
    if (chunk.rows.length === 0) break;
    fetched += chunk.rows.length;
    const { sql, params } = buildInsert(chunk.rows);
    try {
      const r = await dst.query(sql, params);
      inserted += r.rowCount ?? 0;
    } catch (e) {
      failed += chunk.rows.length;
      if (sampleFailures.length < 3) sampleFailures.push(e.message.slice(0, 200));
    }
    if (fetched % 2000 === 0) {
      const pct = ((100 * fetched) / total).toFixed(0);
      console.log("  " + pct + "% · fetched=" + fetched + " · inserted=" + inserted + (failed ? " · failed=" + failed : ""));
    }
  }

  await src.query("CLOSE copy_cursor");
  await src.query("COMMIT");

  const after = await dst.query("SELECT COUNT(*)::int AS n FROM nex." + label);
  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log("  " + label + " · total source=" + total + " · inserted=" + inserted + " · failed=" + failed + " · target now=" + after.rows[0].n + " · " + elapsed + "s");
  if (sampleFailures.length > 0) {
    console.log("  sample failures:");
    for (const f of sampleFailures) console.log("    · " + f);
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
