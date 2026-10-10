// scripts/nex-provision-dev-admin.mts
//
// Creates (or updates) a dev-admin Supabase auth user + linked nex_account
// row + a nex_handle. Prints the credentials on completion.
//
// Idempotent: safe to run multiple times · will not duplicate accounts.
// Use only for local development · this bypasses the normal signup flow.

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const NEX_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const svc = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !url.includes(NEX_PROJECT_REF)) throw new Error(`URL not ${NEX_PROJECT_REF}`);
if (!svc) throw new Error("NEX_SUPABASE_SERVICE_ROLE_KEY missing");

const DEV_EMAIL = "dev-admin@nex-native.local";
const DEV_PASSWORD = "NexDevAdmin!2026";
const DEV_DISPLAY_NAME = "Dev Admin";

const admin = createClient(url, svc, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. Create-or-lookup the auth user.
let authUserId: string;
const listRes = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listRes.error) throw new Error(`listUsers · ${listRes.error.message}`);
const existing = listRes.data.users.find((u) => u.email === DEV_EMAIL);

if (existing) {
  authUserId = existing.id;
  // Reset password to the well-known value and confirm the email.
  const upd = await admin.auth.admin.updateUserById(existing.id, {
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (upd.error) throw new Error(`updateUserById · ${upd.error.message}`);
  console.log(`  · auth user existed · password reset · id=${authUserId.slice(0, 8)}…`);
} else {
  const cre = await admin.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: DEV_DISPLAY_NAME },
  });
  if (cre.error) throw new Error(`createUser · ${cre.error.message}`);
  authUserId = cre.data.user.id;
  console.log(`  · auth user created · id=${authUserId.slice(0, 8)}…`);
}

// 2. Create-or-look-up the nex_account row.
const findAcc = await admin.from("nex_account")
  .select("*")
  .eq("supabase_user_id", authUserId)
  .maybeSingle();
if (findAcc.error) throw new Error(`nex_account lookup · ${findAcc.error.message}`);

let accountId: string;
if (findAcc.data) {
  accountId = (findAcc.data as { id: string }).id;
  console.log(`  · nex_account existed · id=${accountId.slice(0, 8)}…`);
} else {
  const ins = await admin.from("nex_account").insert({
    supabase_user_id: authUserId,
    display_name: DEV_DISPLAY_NAME,
  }).select("*").single();
  if (ins.error) throw new Error(`nex_account insert · ${ins.error.message}`);
  accountId = (ins.data as { id: string }).id;
  console.log(`  · nex_account created · id=${accountId.slice(0, 8)}…`);
}

// 3. Ensure a nex_handle via the same RPC the session layer uses.
//    Direct RPC call (bypasses the "server-only" import guard).
const existingHandle = await admin.from("nex_account")
  .select("nex_handle")
  .eq("id", accountId)
  .single();
let handle: string;
if (existingHandle.data && (existingHandle.data as { nex_handle: string | null }).nex_handle) {
  handle = (existingHandle.data as { nex_handle: string }).nex_handle;
  console.log(`  · nex_handle existed · ${handle}`);
} else {
  const rpc = await admin.rpc("nex_allocate_handle", { p_account_id: accountId });
  if (rpc.error) throw new Error(`allocate handle · ${rpc.error.message}`);
  const row = await admin.from("nex_account").select("nex_handle").eq("id", accountId).single();
  if (row.error) throw new Error(`re-read · ${row.error.message}`);
  handle = (row.data as { nex_handle: string }).nex_handle;
  console.log(`  · nex_handle allocated · ${handle}`);
}

// 4. Print credentials.
console.log("");
console.log("────────────────────────────────────────────────");
console.log("  Dev Admin credentials (bookmark these):");
console.log("────────────────────────────────────────────────");
console.log(`  Email     · ${DEV_EMAIL}`);
console.log(`  Password  · ${DEV_PASSWORD}`);
console.log(`  Handle    · ${handle}`);
console.log(`  Account   · ${accountId}`);
console.log(`  Auth uid  · ${authUserId}`);
console.log("────────────────────────────────────────────────");
console.log("");
console.log("Sign in at: http://localhost:3008/nex-native/conversations");
