// scripts/verify-shop-enquiry-path-a-sandbox.mjs
//
// Live sandbox verification · Rev 3 guest-shop-enquiry · Path A auto-
// create account.
// ---------------------------------------------------------------------------
// Owner directive 2026-11-28 (post-fifth-pass): verify Path A against
// the NEX sandbox Supabase project (`kdstoyyeygcopkogqsyv`). NOT prod
// (`ijvqdvsvwtwxzcqmoqit`) · hard-abort if the URL points at prod.
//
// This script:
//   1. Parses NEXT_PUBLIC_NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY
//      from .env.local.
//   2. Aborts if the URL is not sandbox.
//   3. Creates a service-role Supabase client.
//   4. Pre-checks `nex_account` + `nex_shop_enquiry` table existence
//      (presence of the 2026-11-28 migration 372).
//   5. Runs the same three provisionShopEnquiryAccount scenarios the
//      mocked unit test pins, but LIVE:
//        A. Brand-new email → expect outcome "created" · auth.users row
//           with email_confirmed_at=null · user_metadata.visitor_phone
//           set · nex_account row linked.
//        B. Repeat same email → expect outcome "pre_existing_auth_user".
//        C. Cleanup: delete both the nex_account row and the auth.users
//           row so the sandbox has no residue.
//   6. Prints VERIFIED/FAILED per assertion with the real auth user
//      id and nex_account id so the owner can spot-check the sandbox
//      dashboard if desired.
//
// Credentials: NEVER logged. The script exits non-zero if the pre-
// check fails; the cleanup still runs where possible even if a later
// assertion fails.
//
// Usage:
//   node scripts/verify-shop-enquiry-path-a-sandbox.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

const url = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL") ?? readEnv("NEX_SUPABASE_URL");
const serviceKey = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");

if (!url) {
  console.error("ABORT: NEXT_PUBLIC_NEX_SUPABASE_URL missing from .env.local");
  process.exit(2);
}
if (!serviceKey) {
  console.error("ABORT: NEX_SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(2);
}
if (url.includes(PROD_REF)) {
  console.error(`ABORT: URL points at PROD ${PROD_REF} · this script is sandbox-only`);
  process.exit(3);
}
if (!url.includes(SANDBOX_REF)) {
  console.error(`ABORT: URL is neither ${PROD_REF} (blocked) nor ${SANDBOX_REF} (allowed); refusing to run`);
  console.error(`       URL: ${url}`);
  process.exit(3);
}

console.log(`▶ Sandbox target: ${url} (ref: ${SANDBOX_REF})`);
console.log();

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Ledger of outcomes printed at the end. */
const results = [];
function record(step, status, detail) {
  results.push({ step, status, detail });
  const icon = status === "VERIFIED" ? "✓" : status === "FAILED" ? "✗" : "·";
  console.log(`${icon} ${step} · ${status}${detail ? ` · ${detail}` : ""}`);
}

// Stable but unique test identity. Uses the reserved example.com domain
// (RFC 2606) so the email cannot leak anywhere even if the sandbox has
// an SMTP provider configured.
const testEmail = `nex-path-a-sandbox-${Date.now()}@example.com`;
const testName = "Sandbox Path A Tester";
const testPhone = "+353871234567";
const testCountry = "IE";
const testShopBusinessId = "00000000-0000-4000-8000-000000000000"; // doctrinal placeholder, not FK-constrained in metadata.

let createdAuthUserId = null;
let createdNexAccountId = null;

async function tableExists(name) {
  const { error } = await admin.from(name).select("*", { head: true, count: "exact" }).limit(0);
  if (error) return { exists: false, error: error.message };
  return { exists: true };
}

async function main() {
  // Step 1 · schema pre-checks.
  const accountTable = await tableExists("nex_account");
  if (accountTable.exists) {
    record("precheck · nex_account table reachable", "VERIFIED");
  } else {
    record("precheck · nex_account table reachable", "FAILED", accountTable.error);
    return;
  }

  const enquiryTable = await tableExists("nex_shop_enquiry");
  if (enquiryTable.exists) {
    record("precheck · nex_shop_enquiry table present (migration 372 applied)", "VERIFIED");
  } else {
    record(
      "precheck · nex_shop_enquiry table present (migration 372 applied)",
      "FAILED",
      enquiryTable.error ?? "table missing · migration 372 not applied to sandbox",
    );
    // We can still verify provisionShopEnquiryAccount even without the
    // enquiry table · it only touches auth.users + nex_account. Record
    // the gap and press on.
  }

  // ---- Scenario A · brand new email.
  console.log();
  console.log("Scenario A · brand new email → outcome=created");

  const createA = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: false,
    user_metadata: {
      nex_source: "guest_shop_enquiry",
      display_name: testName,
      visitor_phone: testPhone,
      country: testCountry,
      created_via_shop_business_id: testShopBusinessId,
      created_at_iso: new Date().toISOString(),
    },
  });

  if (createA.error || !createA.data.user) {
    record(
      "scenarioA · auth.admin.createUser succeeded",
      "FAILED",
      createA.error?.message ?? "no user returned",
    );
    await cleanup();
    return;
  }
  createdAuthUserId = createA.data.user.id;
  record(
    "scenarioA · auth.admin.createUser succeeded",
    "VERIFIED",
    `auth user id ${createdAuthUserId}`,
  );

  // Check email_confirmed_at is null (email_confirm:false honoured).
  if (createA.data.user.email_confirmed_at == null) {
    record("scenarioA · email_confirmed_at is null (email_confirm:false honoured)", "VERIFIED");
  } else {
    record(
      "scenarioA · email_confirmed_at is null (email_confirm:false honoured)",
      "FAILED",
      `got ${createA.data.user.email_confirmed_at}`,
    );
  }

  // Check user_metadata.visitor_phone matches input (identity doctrine:
  // phone must be in metadata, not on auth.users.phone).
  const meta = createA.data.user.user_metadata ?? {};
  if (meta.visitor_phone === testPhone) {
    record("scenarioA · user_metadata.visitor_phone matches input", "VERIFIED");
  } else {
    record(
      "scenarioA · user_metadata.visitor_phone matches input",
      "FAILED",
      `got ${JSON.stringify(meta.visitor_phone)}`,
    );
  }
  if (createA.data.user.phone == null || createA.data.user.phone === "") {
    record("scenarioA · auth.users.phone is NOT populated (identity doctrine)", "VERIFIED");
  } else {
    record(
      "scenarioA · auth.users.phone is NOT populated (identity doctrine)",
      "FAILED",
      `got ${createA.data.user.phone}`,
    );
  }

  // Insert nex_account row (mirrors provisionShopEnquiryAccount step 2).
  const { data: accountRow, error: insertErr } = await admin
    .from("nex_account")
    .insert({ supabase_user_id: createdAuthUserId, display_name: testName })
    .select("id, supabase_user_id, display_name, created_at")
    .maybeSingle();

  if (insertErr || !accountRow) {
    record(
      "scenarioA · nex_account row inserted and linked",
      "FAILED",
      insertErr?.message ?? "no row returned",
    );
    await cleanup();
    return;
  }
  createdNexAccountId = accountRow.id;
  record(
    "scenarioA · nex_account row inserted and linked",
    "VERIFIED",
    `nex_account id ${createdNexAccountId}`,
  );
  if (accountRow.supabase_user_id === createdAuthUserId) {
    record("scenarioA · nex_account.supabase_user_id matches auth user id", "VERIFIED");
  } else {
    record(
      "scenarioA · nex_account.supabase_user_id matches auth user id",
      "FAILED",
      `linked to ${accountRow.supabase_user_id} instead`,
    );
  }
  if (accountRow.display_name === testName) {
    record("scenarioA · nex_account.display_name matches visitor name", "VERIFIED");
  } else {
    record(
      "scenarioA · nex_account.display_name matches visitor name",
      "FAILED",
      `got ${accountRow.display_name}`,
    );
  }

  // ---- Scenario B · duplicate email.
  console.log();
  console.log("Scenario B · same email again → outcome=pre_existing_auth_user");

  const createB = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: false,
    user_metadata: {
      nex_source: "guest_shop_enquiry",
      display_name: testName + " 2",
      visitor_phone: testPhone,
      country: testCountry,
    },
  });

  const EMAIL_EXISTS_PATTERN =
    /already registered|already (been )?used|user already exists|email_exists|email address.*already/i;

  if (createB.error && EMAIL_EXISTS_PATTERN.test(createB.error.message ?? "")) {
    record(
      "scenarioB · repeat email surfaces the 'already registered' error (routes to pre_existing_auth_user)",
      "VERIFIED",
      `error: "${createB.error.message}"`,
    );
  } else if (createB.error) {
    record(
      "scenarioB · repeat email surfaces the 'already registered' error",
      "FAILED",
      `unexpected error: ${createB.error.message}`,
    );
  } else {
    record(
      "scenarioB · repeat email surfaces the 'already registered' error",
      "FAILED",
      `createUser SUCCEEDED on a repeat email · would leak a duplicate account · auth user id ${createB.data.user?.id}`,
    );
    // If this happens we must also clean up the duplicate.
    if (createB.data.user?.id) {
      await admin.auth.admin.deleteUser(createB.data.user.id);
    }
  }

  // Confirm no duplicate nex_account row exists for the test email.
  const { data: dupRows, error: dupErr } = await admin
    .from("nex_account")
    .select("id, supabase_user_id")
    .eq("supabase_user_id", createdAuthUserId);
  if (dupErr) {
    record("scenarioB · nex_account row count for this auth user", "FAILED", dupErr.message);
  } else if (dupRows && dupRows.length === 1) {
    record("scenarioB · exactly one nex_account row per auth user (no duplicate)", "VERIFIED");
  } else {
    record(
      "scenarioB · exactly one nex_account row per auth user (no duplicate)",
      "FAILED",
      `found ${dupRows?.length ?? 0} rows`,
    );
  }

  await cleanup();
}

async function cleanup() {
  console.log();
  console.log("Cleanup");
  if (createdNexAccountId) {
    const { error } = await admin.from("nex_account").delete().eq("id", createdNexAccountId);
    if (error) {
      record("cleanup · delete nex_account row", "FAILED", error.message);
    } else {
      record("cleanup · delete nex_account row", "VERIFIED", `id ${createdNexAccountId}`);
    }
  }
  if (createdAuthUserId) {
    const { error } = await admin.auth.admin.deleteUser(createdAuthUserId);
    if (error) {
      record("cleanup · delete auth.users row", "FAILED", error.message);
    } else {
      record("cleanup · delete auth.users row", "VERIFIED", `id ${createdAuthUserId}`);
    }
  }
}

await main();

console.log();
console.log("──────────────────── summary ────────────────────");
let v = 0;
let f = 0;
for (const r of results) {
  if (r.status === "VERIFIED") v += 1;
  else if (r.status === "FAILED") f += 1;
}
console.log(`VERIFIED: ${v} · FAILED: ${f}`);
process.exit(f === 0 ? 0 : 1);
