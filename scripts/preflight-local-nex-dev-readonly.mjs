#!/usr/bin/env node
// scripts/preflight-local-nex-dev-readonly.mjs
//
// NEX local-dev schema probe · READ-ONLY.
// Owner-authorised 2026-10-21 (Food Vertical Proof · Stage 1
// local-database verification).
// ------------------------------------------------------------------
// Narrow scope: verify that the PostgreSQL instance on localhost:5433
// is genuinely local + isolated, then run a strictly read-only
// schema and migration-state probe to determine whether it is
// suitable for an eventual seeded end-to-end test.
//
// STRICT SAFEGUARDS (every rule below is load-bearing):
//
//   1. Anti-production gate · the probe refuses to connect to any
//      host matching the sealed production pooler
//      (`aws-0-eu-west-1.pooler.supabase.com`) OR carrying the
//      sealed project ref `ijvqdvsvwtwxzcqmoqit`. If the active
//      `NEX_POSTGRES_URL` points there, we fall back to the
//      commented localhost entry from .env.local without ever
//      touching production.
//
//   2. Localhost-only · the probe refuses to connect to any host
//      that is not `localhost` or `127.0.0.1`.
//
//   3. Credentials never printed · only a SHA-256 fingerprint of
//      the password-redacted URL is logged.
//
//   4. SELECT only · zero INSERT / UPDATE / DELETE / DDL. The
//      queries below are read-only catalog introspection.
//
//   5. No env-file modification · the probe READS .env.local but
//      never writes to it. If the active URL is production, the
//      probe uses the commented fallback entry WITHOUT uncommenting
//      the file.
//
// Usage:
//   node scripts/preflight-local-nex-dev-readonly.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ENV_PATH = ".env.local";
const BLOCKED_HOST_SUBSTR = "pooler.supabase.com";
const BLOCKED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const ALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// ─── 1 · Load candidate URLs from .env.local without writing it ────
function loadCandidateUrlsFromEnv() {
  let txt;
  try {
    txt = readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    throw new Error(
      `cannot read ${ENV_PATH} · ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  // Capture every `NEX_POSTGRES_URL=` line · active OR commented.
  // We'll pick the first LOCAL one · never the production one.
  const lines = txt.split(/\r?\n/);
  const matches = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    // Match both uncommented and commented forms.
    const m = /^#?\s*NEX_POSTGRES_URL=(.+?)$/.exec(line);
    if (!m) continue;
    const url = m[1].trim().replace(/^["']|["']$/g, "");
    if (url.length === 0) continue;
    matches.push({ url, isCommented: line.startsWith("#") });
  }
  return matches;
}

// ─── 2 · Anti-production gate ──────────────────────────────────────
function classifyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  } catch {
    return { ok: false, reason: "unparseable URL" };
  }
  const host = parsed.hostname;
  // Hard-block production pooler host.
  if (host.includes(BLOCKED_HOST_SUBSTR)) {
    return {
      ok: false,
      reason: `REFUSED · host contains '${BLOCKED_HOST_SUBSTR}' (production pooler)`,
      host,
    };
  }
  // Hard-block sealed project ref anywhere in the URL.
  if (url.includes(BLOCKED_PROJECT_REF)) {
    return {
      ok: false,
      reason: `REFUSED · URL contains sealed production project ref '${BLOCKED_PROJECT_REF}'`,
      host,
    };
  }
  // Only accept localhost or 127.0.0.1.
  if (!ALLOWED_LOCAL_HOSTS.has(host)) {
    return {
      ok: false,
      reason: `REFUSED · host '${host}' is not in the allowed localhost set`,
      host,
    };
  }
  return { ok: true, host, parsed };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ─── 3 · Main ─────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(72));
  console.log("NEX local nex_dev schema probe · READ-ONLY · 2026-10-21");
  console.log("=".repeat(72));

  const candidates = loadCandidateUrlsFromEnv();
  if (candidates.length === 0) {
    throw new Error(
      "No NEX_POSTGRES_URL entries (active or commented) found in .env.local",
    );
  }
  console.log(`candidate_nex_postgres_url_entries: ${candidates.length}`);
  for (const c of candidates) {
    const cls = classifyUrl(c.url);
    console.log(
      `  · [${c.isCommented ? "commented" : "active   "}] host=${
        cls.host ?? "?"
      } · ${cls.ok ? "ACCEPTED" : cls.reason}`,
    );
  }

  // Pick the FIRST classified-safe candidate · prefer active, fall
  // back to commented. If the active URL is blocked but a commented
  // local one exists, we use the local one (we never touch .env.local
  // but we can connect using its value in-memory).
  let chosen = null;
  for (const c of candidates) {
    const cls = classifyUrl(c.url);
    if (cls.ok) {
      chosen = { ...c, cls };
      break;
    }
  }
  if (!chosen) {
    console.log("");
    console.log(
      "RESULT · no safe local NEX_POSTGRES_URL candidate · stop before any connection.",
    );
    process.exit(2);
  }

  console.log("");
  console.log(`chosen_source: ${chosen.isCommented ? "commented" : "active"}`);
  console.log(`chosen_host:   ${chosen.cls.host}`);
  console.log(
    `conn_fingerprint (sha256 of pwd-redacted URL, 16 chars): ${sha256(
      chosen.url.replace(/:[^:/@]+@/, ":****@"),
    ).slice(0, 16)}`,
  );
  console.log("");

  // Late-import pg.
  let pg;
  try {
    pg = (await import("pg")).default;
  } catch (e) {
    throw new Error(
      `cannot import 'pg' · ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const client = new pg.Client({
    connectionString: chosen.url,
    // Short timeout for the local probe · if the DB is slow we fail
    // fast rather than hang.
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });

  try {
    await client.connect();
  } catch (e) {
    console.log(
      `CONNECT_FAILED · ${e instanceof Error ? e.message : String(e)}`,
    );
    console.log(
      "This usually means Postgres isn't running on localhost:5433 or credentials are wrong.",
    );
    process.exit(2);
  }

  try {
    // ─ Identity probe · verify the DB is truly local + non-production
    console.log("§ 1 · Identity verification");
    console.log("-".repeat(60));
    const idRows = await client.query(`
      SELECT
        current_database()                 AS db,
        current_user                       AS "user",
        inet_server_addr()::text           AS server_addr,
        inet_server_port()                 AS server_port,
        version()                          AS version,
        pg_is_in_recovery()                AS in_recovery
    `);
    for (const [k, v] of Object.entries(idRows.rows[0])) {
      const display =
        typeof v === "string" && v.length > 90 ? v.slice(0, 87) + "..." : v;
      console.log(`  ${k.padEnd(16)} = ${display}`);
    }
    console.log("");

    // Second line of defence: refuse to proceed if server_addr is NOT
    // localhost (the pg driver sometimes resolves 'localhost' → ::1
    // or 127.0.0.1 · we accept all localhost loopback variants
    // including IPv6 with CIDR suffixes like '::1/128').
    const serverAddr = String(idRows.rows[0].server_addr ?? "");
    const serverAddrOk =
      serverAddr === "" || // Unix socket · locally bound
      serverAddr === "127.0.0.1" ||
      serverAddr.startsWith("127.0.0.1/") ||
      serverAddr === "::1" ||
      serverAddr.startsWith("::1/") ||
      serverAddr === "localhost";
    if (!serverAddrOk) {
      console.log(
        `REFUSED · pg server_addr='${serverAddr}' is not local · aborting before any further query.`,
      );
      await client.end();
      process.exit(2);
    }

    // ─ Table-existence probe for the 4 vertical schemas we care about
    console.log("§ 2 · Required table existence (public schema)");
    console.log("-".repeat(60));
    const tableChecks = [
      "nex_migration_history",
      "nex_account",
      "nex_business",
      "nex_product",
      "nex_menu_section",
      "nex_menu_item",
      "nex_service",
      "nex_peer_conversation",
      "nex_peer_message",
      "nex_cart",
    ];
    for (const t of tableChecks) {
      const r = await client.query(
        `SELECT to_regclass('public.' || $1)::text AS t`,
        [t],
      );
      const present = r.rows[0].t !== null;
      console.log(
        `  ${t.padEnd(26)} ${present ? "✓ present" : "✗ MISSING"}`,
      );
    }
    console.log("");

    // ─ nex.* schema (Directory Spine · optional for Food proof)
    console.log("§ 3 · Optional nex.* schema tables (Directory Spine)");
    console.log("-".repeat(60));
    const nexSchemaChecks = [
      "nex.source_registry",
      "nex.business_canonical",
      "nex.business_evidence",
      "nex.business_media",
    ];
    for (const t of nexSchemaChecks) {
      const r = await client.query(
        `SELECT to_regclass($1)::text AS t`,
        [t],
      );
      const present = r.rows[0].t !== null;
      console.log(
        `  ${t.padEnd(32)} ${present ? "✓ present" : "✗ absent"}`,
      );
    }
    console.log("");

    // ─ Migration history · if table exists
    console.log("§ 4 · nex_migration_history (if present)");
    console.log("-".repeat(60));
    const historyExists = await client.query(
      `SELECT to_regclass('public.nex_migration_history')::text AS t`,
    );
    if (historyExists.rows[0].t === null) {
      console.log("  (table missing · migration 001 has not been applied here)");
    } else {
      const counts = await client.query(`
        SELECT
          COUNT(*)                           AS total_count,
          MIN(version)                       AS min_version,
          MAX(version)                       AS max_version,
          MIN(applied_at)                    AS first_applied_at,
          MAX(applied_at)                    AS last_applied_at
        FROM nex_migration_history
      `);
      const row = counts.rows[0];
      console.log(`  total_count       = ${row.total_count}`);
      console.log(`  min_version       = ${row.min_version}`);
      console.log(`  max_version       = ${row.max_version}`);
      console.log(`  first_applied_at  = ${row.first_applied_at}`);
      console.log(`  last_applied_at   = ${row.last_applied_at}`);

      // Which migrations relevant to Food end-to-end are present?
      const foodRelevantVersions = [
        "001",
        "002",
        "003",
        "004",
        "005",
        "046",
        "066",
        "077",
        "102",
        "126",
      ];
      const applied = await client.query(
        `SELECT version FROM nex_migration_history WHERE version = ANY($1::text[]) ORDER BY version`,
        [foodRelevantVersions],
      );
      const appliedSet = new Set(applied.rows.map((r) => r.version));
      console.log("");
      console.log("  Food-journey-critical migrations:");
      for (const v of foodRelevantVersions) {
        console.log(
          `    ${v}  ${appliedSet.has(v) ? "✓ applied" : "✗ missing"}`,
        );
      }
    }
    console.log("");

    // ─ nex_product.status + nex_menu_item.is_available / status
    console.log("§ 5 · nex_product.status / nex_menu_item.is_available");
    console.log("-".repeat(60));
    const columnChecks = [
      ["nex_product", "status"],
      ["nex_menu_item", "status"],
      ["nex_menu_item", "is_available"],
      ["nex_menu_section", "status"],
    ];
    for (const [tab, col] of columnChecks) {
      const r = await client.query(
        `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tab, col],
      );
      if (r.rows.length === 0) {
        console.log(`  ${tab}.${col}`.padEnd(36) + " ✗ absent");
      } else {
        const row = r.rows[0];
        console.log(
          `  ${(tab + "." + col).padEnd(32)} ✓ ${row.data_type.padEnd(16)} nullable=${row.is_nullable} default=${row.column_default ?? "(none)"}`,
        );
      }
    }
    console.log("");

    // ─ Row counts (empty vs seeded)
    console.log("§ 6 · Row counts (safety · all zero = clean canvas)");
    console.log("-".repeat(60));
    for (const t of [
      "nex_account",
      "nex_business",
      "nex_product",
      "nex_menu_section",
      "nex_menu_item",
      "nex_peer_message",
    ]) {
      try {
        const r = await client.query(`SELECT COUNT(*)::text AS c FROM ${t}`);
        console.log(`  ${t.padEnd(26)} ${r.rows[0].c} rows`);
      } catch (e) {
        console.log(
          `  ${t.padEnd(26)} (not readable · ${e instanceof Error ? e.message.slice(0, 60) : "err"})`,
        );
      }
    }
    console.log("");

    // ─ §7 · Extensions (Step S0 · 2026-10-21 owner authorisation)
    console.log("§ 7 · PostgreSQL extensions (Step S0 probe)");
    console.log("-".repeat(60));
    const extRes = await client.query(
      `SELECT extname FROM pg_extension ORDER BY extname`,
    );
    const extInstalled = new Set(extRes.rows.map((r) => String(r.extname)));
    const requiredExtensions = ["pgcrypto", "pg_trgm"];
    for (const name of requiredExtensions) {
      const present = extInstalled.has(name);
      console.log(
        `  ${name.padEnd(16)} ${present ? "✓ installed" : "✗ MISSING"}`,
      );
    }
    // Also list every other extension present · useful context, never
    // sensitive, read-only.
    const otherExtensions = [...extInstalled].filter(
      (e) => !requiredExtensions.includes(e),
    );
    if (otherExtensions.length > 0) {
      console.log(
        `  (other extensions present: ${otherExtensions.join(", ")})`,
      );
    }
    console.log("");

    // ─ §8 · Required Supabase built-in roles (Step S0)
    console.log("§ 8 · Required roles (Step S0 probe)");
    console.log("-".repeat(60));
    const roleRes = await client.query(
      `SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
      [["authenticated", "anon", "service_role"]],
    );
    const rolesPresent = new Set(roleRes.rows.map((r) => String(r.rolname)));
    const requiredRoles = ["anon", "authenticated", "service_role"];
    for (const r of requiredRoles) {
      const present = rolesPresent.has(r);
      console.log(
        `  ${r.padEnd(20)} ${present ? "✓ exists" : "✗ MISSING"}`,
      );
    }
    console.log("");

    // ─ §9 · Final verdict (header only · narrative in script output)
    console.log("§ 9 · Final verdict");
    console.log("-".repeat(60));
    const allExtensionsPresent = requiredExtensions.every((e) =>
      extInstalled.has(e),
    );
    const allRolesPresent = requiredRoles.every((r) => rolesPresent.has(r));
    const historyExistsForVerdict = (
      await client.query(
        `SELECT to_regclass('public.nex_migration_history')::text AS t`,
      )
    ).rows[0].t;
    console.log(
      `  Extensions ready       : ${allExtensionsPresent ? "YES" : "NO"} ${!allExtensionsPresent ? "(S1 required)" : ""}`,
    );
    console.log(
      `  Roles ready            : ${allRolesPresent ? "YES" : "NO"} ${!allRolesPresent ? "(S1 required)" : ""}`,
    );
    console.log(
      `  Migration history table: ${historyExistsForVerdict ? "present" : "MISSING (S2 would create it)"}`,
    );
    console.log(
      `  Consumer schema status : ${historyExistsForVerdict ? "possibly applied" : "blank slate (001-126 not applied)"}`,
    );
    console.log(
      `  Step S1 needed?        : ${!allExtensionsPresent || !allRolesPresent ? "YES · setup required before migrations" : "NO · prerequisites in place"}`,
    );
    console.log("");
  } finally {
    await client.end();
  }
}

main()
  .then(() => {
    // Verdict is logged at the END of main; a successful exit means
    // the probe ran cleanly. Any issues were already surfaced inline.
  })
  .catch((e) => {
    console.error(
      "\nPROBE FAILED · ",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  });
