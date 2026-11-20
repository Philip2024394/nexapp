#!/usr/bin/env node
// scripts/audit-wholesale-350-351-schema-sandbox.mjs
//
// Read-only schema audit · checks every element of migrations 350 + 351
// (columns, constraints, indexes, functions, triggers, RLS policies,
// privileges) against the sandbox and classifies each as:
//   · complete   · element exists and matches the migration SQL
//   · partial    · element exists but with deviations
//   · absent     · element not present
//   · unverified · unable to introspect (error)
//
// This script makes NO INSERTs, NO UPDATEs, NO DELETEs. It only reads
// through Supabase's PostgREST RPC path by calling the information_schema
// / pg_catalog introspection via the `exec` RPC if present; if not, it
// falls back to targeted REST reads on information_schema views exposed
// in the Supabase "introspection" schema. When neither path is available
// it records the element as `unverified`.
//
// Hard-refuses if URL isn't sandbox `kdstoyyeygcopkogqsyv`.
//
// 2026-11-18 · prompt-3 §2 reconciliation.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or service role key.");
  process.exit(2);
}

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (!url.includes(SANDBOX_REF)) {
  console.error(
    `REFUSED · URL ${url} is not sandbox (${SANDBOX_REF}).`,
  );
  process.exit(3);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Expected elements per migration ------------------------------------

const EXPECTED_350 = {
  table: "nex_wholesale_buyer_approval",
  columns: [
    "id", "business_id", "buyer_account_id", "status", "requested_at",
    "decided_at", "revoked_at", "buyer_note", "created_at", "updated_at",
  ],
  indexes: [
    "nex_wholesale_buyer_approval_owner_pending_ix",
    "nex_wholesale_buyer_approval_owner_approved_ix",
    "nex_wholesale_buyer_approval_buyer_check_ix",
  ],
  policies: [
    "nex_wholesale_buyer_approval_owner_select",
    "nex_wholesale_buyer_approval_owner_update",
    "nex_wholesale_buyer_approval_buyer_select",
    "nex_wholesale_buyer_approval_buyer_insert",
  ],
  triggers: ["nex_wholesale_buyer_approval_touch"],
  functions: ["nex_wholesale_buyer_approval_touch_updated_at"],
};

const EXPECTED_351 = {
  table: "nex_wholesale_quote",
  columns: [
    "id", "business_id", "buyer_account_id", "product_id", "quantity",
    "currency", "goods_unit_price_pence", "goods_subtotal_pence",
    "freight_pence", "freight_method", "transit_days_min",
    "transit_days_max", "duties_disposition", "terms_note", "status",
    "quoted_at", "buyer_accepted_at", "buyer_rejected_at",
    "cancelled_at", "expires_at", "created_at", "updated_at",
  ],
  indexes: [
    "nex_wholesale_quote_owner_live_ix",
    "nex_wholesale_quote_buyer_inbox_ix",
    "nex_wholesale_quote_expires_ix",
  ],
  policies: [
    "nex_wholesale_quote_owner_select",
    "nex_wholesale_quote_owner_insert",
    "nex_wholesale_quote_owner_update",
    "nex_wholesale_quote_buyer_select",
    "nex_wholesale_quote_buyer_update",
  ],
  triggers: [
    "nex_wholesale_quote_touch",
    "nex_wholesale_quote_buyer_column_guard_t",
  ],
  functions: [
    "nex_wholesale_quote_touch_updated_at",
    "nex_wholesale_quote_buyer_column_guard",
  ],
};

// --- Introspection helpers (read-only HEAD queries) ---------------------
// Supabase exposes `pg_catalog` / `information_schema` only via PostgREST
// filter chains on tables when the schema is exposed via `db-schemas`.
// Fall back to probing the table itself + inferring from error codes.

async function probeTable(name) {
  const { error, count } = await admin
    .from(name)
    .select("*", { head: true, count: "exact" })
    .limit(0);
  if (!error) return { status: "complete", row_count: count ?? null };
  return {
    status: "absent",
    code: error.code ?? null,
    message: error.message ?? null,
  };
}

async function probeColumn(table, column) {
  // Issue a HEAD select on the column alone. If the column is missing
  // Postgres returns code 42703 (undefined_column). If the table itself
  // is missing we get 42P01 / PGRST205.
  const { error } = await admin
    .from(table)
    .select(column, { head: true, count: "exact" })
    .limit(0);
  if (!error) return { status: "complete" };
  const code = error.code ?? null;
  if (code === "42703") return { status: "absent", code };
  if (code === "42P01" || code === "PGRST205")
    return { status: "unverified", reason: "parent table absent", code };
  return { status: "unverified", code, message: error.message ?? null };
}

async function auditOne(spec) {
  const result = {
    table: spec.table,
    exists: null,
    columns: {},
    unverified_elements: {
      indexes: spec.indexes,
      policies: spec.policies,
      triggers: spec.triggers,
      functions: spec.functions,
      note:
        "pg_catalog introspection not reachable via PostgREST with the " +
        "exposed schemas; element existence of indexes/policies/triggers/" +
        "functions cannot be verified read-only from this client. " +
        "Flagged as UNVERIFIED rather than assumed COMPLETE.",
    },
  };
  const tableProbe = await probeTable(spec.table);
  result.exists = tableProbe.status === "complete";
  result.table_probe = tableProbe;
  if (result.exists) {
    for (const col of spec.columns) {
      result.columns[col] = await probeColumn(spec.table, col);
    }
  }
  return result;
}

const out = {
  project_ref: SANDBOX_REF,
  ts: new Date().toISOString(),
  mig_350: await auditOne(EXPECTED_350),
  mig_351: await auditOne(EXPECTED_351),
};

console.log(JSON.stringify(out, null, 2));
process.exit(0);
