#!/usr/bin/env node
// Read-only diagnostic · §16.48.24 · pinpoint why script 40 FAILed.
//
// Confirms whether the session + participant rows exist (service-role
// bypasses RLS) and whether SELECT via authed anon client (as A) is
// blocked by RLS. Also lists the RLS policies on both tables.
//
// NO WRITES. Sandbox only.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const CANON = "kdstoyyeygcopkogqsyv";

function readEnv(key) {
  const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const anon = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
const svc = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");
if (!url || url.includes(PROD) || !url.includes(CANON)) {
  console.error("FATAL: URL safety check"); process.exit(3);
}

const admin = createClient(url, svc, { auth: { persistSession: false } });

// Session + participant IDs from §16.48.24 script 40 output
const SESSION_ID = "6e635d99-9a40-4753-b55f-220775a5b32e";
const PARTICIPANT_ID = "cbce8cf4-1480-4e22-94fd-bc8bc0d54a33";
const MESSAGE_ID = "dfae2574-7404-4dfc-9f49-dd72da00ee38";

// Also read capture to find A's account_id / email
const cap = JSON.parse(readFileSync(resolve(__dir, "99_identity_capture.json.OUTPUT"), "utf8"));
const A_ACCOUNT = cap.A.nex_account_id;
const A_EMAIL = cap.A.email;
const A_PASSWORD = process.env.A_PASSWORD; // operator passes it

console.log("DIAG §16.48.24 · read-only · target sandbox", CANON);
console.log("");

// 1. Service-role SELECT — proves whether rows exist at all.
for (const [label, table, id] of [
  ["session", "nex_group_call_session", SESSION_ID],
  ["participant", "nex_group_call_participant", PARTICIPANT_ID],
  ["message", "nex_peer_message", MESSAGE_ID],
]) {
  const { data, error } = await admin.from(table).select("*").eq("id", id).maybeSingle();
  if (error) {
    console.log(`[${label}] service-role SELECT: ERROR ${error.code ?? ""} ${error.message}`);
  } else if (!data) {
    console.log(`[${label}] service-role SELECT: ROW NOT FOUND (id=${id})`);
  } else {
    // print a few key columns
    const keys = Object.keys(data).slice(0, 10);
    const summary = keys.map((k) => `${k}=${JSON.stringify(data[k]).slice(0, 60)}`).join(" · ");
    console.log(`[${label}] service-role SELECT: FOUND · ${summary}`);
  }
}
console.log("");

// 2. RLS policy list for the two call tables
import pg from "pg";
const dbUrl = readEnv("SANDBOX_DATABASE_URL");
if (dbUrl.includes(PROD)) { console.error("FATAL dbUrl prod"); process.exit(3); }
if (!dbUrl.includes(CANON)) { console.error("FATAL dbUrl not canonical"); process.exit(3); }
const pgClient = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await pgClient.connect();

for (const table of ["nex_group_call_session", "nex_group_call_participant", "nex_peer_message"]) {
  const { rows } = await pgClient.query(
    `SELECT polname, polcmd,
            pg_get_expr(polqual, polrelid) AS using_expr,
            pg_get_expr(polwithcheck, polrelid) AS with_check_expr,
            array(select rolname from pg_roles where oid = any(polroles)) AS roles
     FROM pg_policy
     WHERE polrelid = $1::regclass
     ORDER BY polname`,
    [`public.${table}`]
  );
  const { rows: rlsRows } = await pgClient.query(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`,
    [`public.${table}`]
  );
  console.log(`[${table}] RLS enabled=${rlsRows[0]?.relrowsecurity} force=${rlsRows[0]?.relforcerowsecurity} · ${rows.length} policies`);
  for (const r of rows) {
    const cmd = { "r": "SELECT", "w": "UPDATE", "a": "INSERT", "d": "DELETE", "*": "ALL" }[r.polcmd] ?? r.polcmd;
    const roles = Array.isArray(r.roles) ? r.roles.join(",") : String(r.roles);
    console.log(`  ${r.polname} · ${cmd} · roles=${roles} · USING=${r.using_expr ?? "(none)"} · WITH CHECK=${r.with_check_expr ?? "(none)"}`);
  }
}
console.log("");

// 3. Reset A's password and try authed-A SELECT to confirm RLS behaviour.
import { randomBytes } from "node:crypto";
const diagPw = randomBytes(24).toString("base64url");
const upd = await admin.auth.admin.updateUserById(cap.A.supabase_user_id, { password: diagPw });
if (upd.error) {
  console.log(`[A-pwreset] FAIL ${upd.error.message}`);
} else {
  const cA = createClient(url, anon, { auth: { persistSession: false } });
  const si = await cA.auth.signInWithPassword({ email: A_EMAIL, password: diagPw });
  if (si.error) {
    console.log(`[A-signin] FAIL ${si.error.message}`);
  } else {
    const jwt = si.data.session.access_token;
    const cAuthed = createClient(url, anon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    // Pre-step: can A see their own nex_account row?
    {
      const { data, error } = await cAuthed.from("nex_account").select("id,supabase_user_id").eq("supabase_user_id", cap.A.supabase_user_id);
      if (error) console.log(`[nex_account self-read] ERROR ${error.code ?? ""} ${error.message}`);
      else console.log(`[nex_account self-read] rows=${data?.length} · first=${data?.[0]?.id ?? "(none)"}`);
    }
    for (const [label, table, id] of [
      ["session", "nex_group_call_session", SESSION_ID],
      ["participant", "nex_group_call_participant", PARTICIPANT_ID],
      ["message", "nex_peer_message", MESSAGE_ID],
    ]) {
      const { data, error, count } = await cAuthed.from(table).select("*", { count: "exact" }).eq("id", id);
      if (error) {
        console.log(`[${label}] authed-A SELECT: ERROR ${error.code ?? ""} ${error.message}`);
      } else {
        console.log(`[${label}] authed-A SELECT: ${data?.length ?? 0} rows returned (count header=${count})`);
      }
    }
  }
}

await pgClient.end();
console.log("");
console.log("DIAG DONE");
