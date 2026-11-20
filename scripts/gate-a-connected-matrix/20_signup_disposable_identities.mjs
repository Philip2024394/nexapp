#!/usr/bin/env node
// scripts/gate-a-connected-matrix/20_signup_disposable_identities.mjs
//
// Gate A Connected Matrix — sign up disposable identities (mode-driven).
// §16.48.19 · write-ahead manifest persistence added 2026-11-20.
//
// §16.48.19 additions
// ───────────────────
// · Generates a run-scoped PROVENANCE_TAG = "gate-a-<run_id>-<rand8hex>".
// · Before each signUp, appends a pending_signup row to created_fixtures and
//   persists+fsyncs+reads-back BEFORE any auth IO. If the script dies in the
//   window between write-ahead and auth success, the on-disk manifest still
//   records the row (status=pending_signup) so cleanup can refuse to delete
//   any orphan auth.user whose supabase_user_id is not in the manifest.
// · Mutates the same row in place to "signed_up" (success) or "signup_failed"
//   (failure) and persists again.
// · GATE_A_CAPTURE_FILE_OVERRIDE env (optional) overrides the capture path —
//   used by signup-write-ahead.spec.mjs to redirect into a temp directory.
// · GATE_A_SIGNUP_STUB_MODE env (optional) swaps in an in-memory stub supabase
//   client. Allowed values: "" | "success" | "failure" | "rate_limit". Stub
//   mode also skips every real-env read (.env.local, DATABASE_URL) because no
//   network IO occurs. Any other value is a fail-closed exit(2).
// · GATE_A_CRASH_AFTER_PENDING_LABEL env (optional) causes process.exit(99)
//   immediately after writing pending_signup for the named label. Proves the
//   write-ahead row survives a mid-run crash.
//
// Hard invariants (unchanged)
// ───────────────────────────
// · Uses signUp ONLY. Never uses supabase.auth.admin.createUser.
// · Passwords held in memory only. NEVER written to disk.
// · Only non-secret fields are written to the capture file.
// · Email pattern uses owner-supplied Gmail candidates (plus-aliases).
// · Production ref hard-refused in non-stub path.
// · GATE_A_IDENTITY_MODE grammar + rate-limit cascade semantics preserved.

import {
  readFileSync, writeFileSync, existsSync,
  openSync, writeSync, fsyncSync, closeSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const IDENTITY_CAPTURE_FILE = process.env.GATE_A_CAPTURE_FILE_OVERRIDE
  ? resolve(process.env.GATE_A_CAPTURE_FILE_OVERRIDE)
  : resolve(__dir, "99_identity_capture.json.OUTPUT");

// Stub mode grammar — tests substitute the supabase client without any IO.
const _rawStubMode = process.env.GATE_A_SIGNUP_STUB_MODE;
let STUB_MODE = "";
if (_rawStubMode === undefined || _rawStubMode === "") {
  STUB_MODE = "";
} else if (["success", "failure", "rate_limit"].includes(_rawStubMode)) {
  STUB_MODE = _rawStubMode;
} else {
  console.error(
    "FATAL: GATE_A_SIGNUP_STUB_MODE has an unrecognised value — " +
    "allowed: unset, \"success\", \"failure\", or \"rate_limit\". Refusing to proceed."
  );
  process.exit(2);
}
const IS_STUB = STUB_MODE !== "";

function readEnv(key) {
  const envPath = resolve(REPO_ROOT, ".env.local");
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

let supabaseUrl = null;
let anonKey = null;
let dbUrl = null;

if (!IS_STUB) {
  supabaseUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
  if (!supabaseUrl || supabaseUrl.includes(PRODUCTION_REF)) {
    console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_URL missing or contains production ref");
    process.exit(2);
  }
  if (!supabaseUrl.includes(CANONICAL_PROJECT_REF)) {
    console.error(`FATAL: NEXT_PUBLIC_NEX_SUPABASE_URL does not reference sandbox ${CANONICAL_PROJECT_REF}`);
    process.exit(3);
  }
  anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
  if (!anonKey) {
    console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY missing");
    process.exit(2);
  }
  dbUrl = readEnv("SANDBOX_DATABASE_URL") ?? readEnv("DATABASE_URL");
  if (!dbUrl || !dbUrl.includes(CANONICAL_PROJECT_REF)) {
    console.error("FATAL: DATABASE_URL missing or does not reference sandbox");
    process.exit(2);
  }
  console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
} else {
  console.log(`TARGET: STUB MODE (${STUB_MODE}) · no real auth IO`);
}

// Identity mode · owner-authorised two-identity adaptation, 2026-11-19.
const _rawIdentityMode = process.env.GATE_A_IDENTITY_MODE;
let IDENTITY_MODE;
if (_rawIdentityMode === undefined || _rawIdentityMode === "" || _rawIdentityMode === "three") {
  IDENTITY_MODE = "three";
} else if (_rawIdentityMode === "two") {
  IDENTITY_MODE = "two";
} else {
  console.error(
    "FATAL: GATE_A_IDENTITY_MODE has an unrecognised value — " +
    "allowed: unset, \"three\", or \"two\". Refusing to proceed before any auth or database call."
  );
  process.exit(2);
}
const identityLabels = IDENTITY_MODE === "two" ? ["A", "B"] : ["A", "B", "C"];
console.log(`IDENTITY MODE: ${IDENTITY_MODE} · labels: ${identityLabels.join(",")}`);

// Owner-approved candidate identities · authorized 2026-11-19
const candidateEmails = {
  A: "<op-email>",
  B: "<op-email+1>",
  C: "<op-email+2>",
};
function makeEmail(label) { return candidateEmails[label]; }

// Consume parent-supplied passwords from process.env. The parent runner
// generates these in parent memory and passes them explicitly into our env.
const passwords = {};
const missingLabels = [];
for (const label of identityLabels) {
  const supplied = process.env[`GATE_A_TEST_PASSWORD_${label}`];
  if (typeof supplied !== "string" || supplied.length === 0) {
    missingLabels.push(label);
    continue;
  }
  passwords[label] = supplied;
}
if (missingLabels.length > 0) {
  console.error(
    `FATAL: missing parent-supplied password(s) for label(s): ${missingLabels.join(",")} — ` +
    `refusing to proceed before any auth or database call`
  );
  process.exit(2);
}

// Consume parent-supplied GATE_A_RUN_ID.
const GATE_A_RUN_ID = process.env.GATE_A_RUN_ID;
if (typeof GATE_A_RUN_ID !== "string" || GATE_A_RUN_ID.length === 0) {
  console.error(
    "FATAL: missing parent-supplied GATE_A_RUN_ID — " +
    "refusing to proceed before any auth or database call"
  );
  process.exit(2);
}

// §16.48.19 · generate run-scoped provenance tag.
// Grammar: gate-a-<run_id>-<8 hex chars from randomBytes(4)>.
// Attached to every manifest row so cleanup can refuse rows that do not
// bear this run's tag (foreign row hardening).
const PROVENANCE_TAG = `gate-a-${GATE_A_RUN_ID}-${randomBytes(4).toString("hex")}`;
console.log(`PROVENANCE: ${PROVENANCE_TAG}`);

// Read-only DB handle for confirmation-status polling (owner clicks Gmail link).
async function waitForEmailConfirm(email, maxWaitMs = 900_000, pollMs = 15_000) {
  const start = Date.now();
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    while (Date.now() - start < maxWaitMs) {
      const r = await c.query(
        `SELECT id, email_confirmed_at FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
        [email]
      );
      if (r.rows.length > 0 && r.rows[0].email_confirmed_at) {
        return { confirmed: true, user_id: r.rows[0].id, waited_ms: Date.now() - start };
      }
      const waited = Math.round((Date.now() - start) / 1000);
      console.error(`  waiting for email confirmation of ${email} · ${waited}s elapsed · owner must click the Gmail confirmation link`);
      await new Promise(res => setTimeout(res, pollMs));
    }
    return { confirmed: false, waited_ms: Date.now() - start };
  } finally {
    try { await c.end(); } catch {}
  }
}

// §16.48.19 · durable manifest write — open, writeSync, fsyncSync, closeSync,
// then read-back parse + run_id check. Throws on any mismatch. Called
// every time the manifest mutates during the signup loop.
function persistManifest(obj, path) {
  const serialised = JSON.stringify(obj, null, 2);
  const fd = openSync(path, "w");
  try {
    writeSync(fd, serialised);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  const readBack = readFileSync(path, "utf8");
  let parsed;
  try { parsed = JSON.parse(readBack); }
  catch { throw new Error("persistManifest read-back guard: not valid JSON"); }
  if (parsed.run_id !== obj.run_id) {
    throw new Error("persistManifest read-back guard: run_id mismatch");
  }
  if (parsed.provenance_tag !== obj.provenance_tag) {
    throw new Error("persistManifest read-back guard: provenance_tag mismatch");
  }
  return parsed;
}

// Per-label top-level entries · preserved for downstream consumers that key
// off capture.A / capture.B / capture.C.
const capture = {};

// §16.48.19 · initial write-ahead manifest BEFORE any auth IO. If the process
// dies before the loop starts, the manifest still names this run and bears
// its provenance tag. created_fixtures starts empty and is mutated below.
capture.run_id = GATE_A_RUN_ID;
capture.created_at = new Date().toISOString();
capture.identity_mode = IDENTITY_MODE;
capture.provenance_tag = PROVENANCE_TAG;
capture.created_fixtures = [];
persistManifest(capture, IDENTITY_CAPTURE_FILE);
console.log(`Initial manifest persisted: ${IDENTITY_CAPTURE_FILE}`);

// Track each label's index into capture.created_fixtures so we can mutate
// the exact pending row when the auth result lands.
const labelIndex = {};

// §16.48.19 · stub client factory — zero network, zero fs. Deterministic
// per-label UUIDs (well-formed v4) chosen so none can collide with any
// protected identity on the hard denylist enforced by 90_cleanup.mjs.
const STUB_USER_IDS = {
  A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  C: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
function makeStubClient(label) {
  return {
    auth: {
      signUp: async () => {
        if (STUB_MODE === "failure") {
          return { data: { user: null, session: null }, error: { status: 400, code: "stub_failure", message: "stub_failure" } };
        }
        if (STUB_MODE === "rate_limit") {
          return { data: null, error: { status: 429, message: "rate limit — stub" } };
        }
        return { data: { user: { id: STUB_USER_IDS[label] }, session: { access_token: "stub-jwt-signup" } }, error: null };
      },
      signInWithPassword: async () => {
        return { data: { session: { access_token: "stub-jwt-signin" } }, error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  };
}

const CRASH_AFTER_PENDING_LABEL = process.env.GATE_A_CRASH_AFTER_PENDING_LABEL;

for (const label of identityLabels) {
  const email = makeEmail(label);
  console.log(`\nSIGNUP ${label}: ${email}`);

  // §16.48.19 · WRITE-AHEAD · append pending_signup row + persist BEFORE signUp.
  capture.created_fixtures.push({
    label,
    email,
    status: "pending_signup",
    provenance_tag: PROVENANCE_TAG,
    written_at: new Date().toISOString(),
    dependent_rows: [],
  });
  labelIndex[label] = capture.created_fixtures.length - 1;
  persistManifest(capture, IDENTITY_CAPTURE_FILE);
  console.log(`  write-ahead: pending_signup row persisted for ${label}`);

  // §16.48.19 · optional crash simulation BETWEEN write-ahead and signup.
  if (CRASH_AFTER_PENDING_LABEL === label) {
    console.error(`CRASH SIMULATION: GATE_A_CRASH_AFTER_PENDING_LABEL=${label} · exit(99)`);
    process.exit(99);
  }

  const client = IS_STUB
    ? makeStubClient(label)
    : createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email,
    password: passwords[label],
  });

  if (signUpError) {
    console.error(`BLOCKED: signUp for ${label} failed: ${signUpError.message}`);
    // Mutate write-ahead row → signup_failed (non-secret error fields only).
    {
      const row = capture.created_fixtures[labelIndex[label]];
      row.status = "signup_failed";
      row.error_class = signUpError.status ?? signUpError.code ?? "unknown";
      row.error_message = signUpError.message;
      persistManifest(capture, IDENTITY_CAPTURE_FILE);
    }
    // Preserve prior per-label top-level shape (downstream consumers).
    capture[label] = {
      status: "BLOCKED",
      email,
      error_class: signUpError.status ?? signUpError.code ?? "unknown",
      error_message: signUpError.message,
    };
    // Rate-limit cascade — mark remaining labels + persist once.
    if (
      signUpError.status === 429 ||
      /rate.limit|too.many/i.test(signUpError.message)
    ) {
      console.error("RATE LIMIT detected — marking remaining identities signup_failed without retry");
      for (const remaining of identityLabels.slice(identityLabels.indexOf(label) + 1)) {
        capture.created_fixtures.push({
          label: remaining,
          email: makeEmail(remaining),
          status: "signup_failed",
          provenance_tag: PROVENANCE_TAG,
          written_at: new Date().toISOString(),
          dependent_rows: [],
          error_class: "rate_limit_cascade",
          error_message: "cascade from prior rate-limit",
        });
        labelIndex[remaining] = capture.created_fixtures.length - 1;
        capture[remaining] = {
          status: "BLOCKED",
          email: makeEmail(remaining),
          error_class: "rate_limit_cascade",
          error_message: "cascade from prior rate-limit",
        };
      }
      persistManifest(capture, IDENTITY_CAPTURE_FILE);
      break;
    }
    continue;
  }

  const sbUserId = signUpData.user?.id;
  if (!sbUserId) {
    console.error(`BLOCKED: signUp for ${label} returned no user.id`);
    const row = capture.created_fixtures[labelIndex[label]];
    row.status = "signup_failed";
    row.error_class = "no_user_id";
    row.error_message = "signUp returned null user";
    persistManifest(capture, IDENTITY_CAPTURE_FILE);
    capture[label] = {
      status: "BLOCKED",
      email,
      error_class: "no_user_id",
      error_message: "signUp returned null user",
    };
    continue;
  }

  console.log(`  supabase_user_id: ${sbUserId}`);

  // §16.48.19 · mutate write-ahead row → signed_up + supabase_user_id.
  {
    const row = capture.created_fixtures[labelIndex[label]];
    row.status = "signed_up";
    row.supabase_user_id = sbUserId;
    persistManifest(capture, IDENTITY_CAPTURE_FILE);
    console.log(`  transitioned to signed_up for ${label}`);
  }

  const session = signUpData.session;
  if (!session && !IS_STUB) {
    console.error(`  session null — email confirmation ON · pausing for owner to click Gmail link for ${email}`);
    const waitResult = await waitForEmailConfirm(email);
    if (!waitResult.confirmed) {
      const row = capture.created_fixtures[labelIndex[label]];
      row.status = "signup_failed";
      row.error_class = "email_confirm_timeout";
      row.error_message = `owner did not confirm email within ${Math.round(waitResult.waited_ms / 1000)}s`;
      persistManifest(capture, IDENTITY_CAPTURE_FILE);
      capture[label] = {
        status: "BLOCKED",
        email,
        supabase_user_id: sbUserId,
        error_class: "email_confirm_timeout",
        error_message: `owner did not confirm email within ${Math.round(waitResult.waited_ms / 1000)}s`,
      };
      continue;
    }
    console.log(`  email confirmed after ${Math.round(waitResult.waited_ms / 1000)}s · proceeding with signInWithPassword`);
  }

  const signInClient = IS_STUB
    ? makeStubClient(label)
    : createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
    email,
    password: passwords[label],
  });

  if (signInError || !signInData?.session) {
    console.error(`BLOCKED: signInWithPassword for ${label} failed: ${signInError?.message}`);
    const row = capture.created_fixtures[labelIndex[label]];
    row.status = "signup_failed";
    row.error_class = signInError?.code ?? "signin_failed";
    row.error_message = signInError?.message ?? "no session";
    persistManifest(capture, IDENTITY_CAPTURE_FILE);
    capture[label] = {
      status: "BLOCKED",
      email,
      supabase_user_id: sbUserId,
      error_class: signInError?.code ?? "signin_failed",
      error_message: signInError?.message ?? "no session",
    };
    continue;
  }

  const jwt = signInData.session.access_token;

  const authedClient = IS_STUB
    ? makeStubClient(label)
    : createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });

  const { data: acctRows, error: acctError } = await authedClient
    .from("nex_account")
    .select("id")
    .eq("supabase_user_id", sbUserId)
    .limit(1);

  let nexAccountId = null;

  if (acctError) {
    console.log(`  nex_account lookup failed: ${acctError.message}`);
    console.log(
      `  NOTE: V-AUTH-UNKNOWN scenario (authenticated JWT with no nex_account) ` +
      `is NATURALLY AVAILABLE for this identity if nex_account was not auto-created.`
    );
  } else if (!acctRows || acctRows.length === 0) {
    console.log(
      `  nex_account: NOT FOUND — auto-create is OFF. ` +
      `V-AUTH-UNKNOWN is naturally available for ${label}.`
    );
  } else {
    nexAccountId = acctRows[0].id;
    console.log(`  nex_account_id: ${nexAccountId}`);
  }

  // Enrich write-ahead row with nex_account dependent info.
  {
    const row = capture.created_fixtures[labelIndex[label]];
    row.nex_account_id = nexAccountId;
    row.nex_account_found = nexAccountId !== null;
    if (nexAccountId) {
      row.dependent_rows.push({
        table: "nex_account",
        id: nexAccountId,
        owner_user_id: sbUserId,
      });
    }
    persistManifest(capture, IDENTITY_CAPTURE_FILE);
  }

  capture[label] = {
    status: "OK",
    email,
    supabase_user_id: sbUserId,
    nex_account_id: nexAccountId,
    nex_account_found: nexAccountId !== null,
  };
  // Password scrubbed — only "***" in capture; real password is process.env only
}

// Build canonical created_fixtures list from per-label OK entries. This
// final rebuild replaces the write-ahead rows with the authoritative
// happy-path shape (status + provenance_tag preserved so 90_cleanup's
// MISSING_OR_FOREIGN_PROVENANCE_TAG guard accepts each row).
const createdFixtures = [];
for (const label of identityLabels) {
  const entry = capture[label];
  if (!entry || entry.status !== "OK" || !entry.supabase_user_id) continue;
  const dependentRows = [];
  if (entry.nex_account_id) {
    dependentRows.push({
      table: "nex_account",
      id: entry.nex_account_id,
      owner_user_id: entry.supabase_user_id,
    });
  }
  createdFixtures.push({
    label,
    email: entry.email,
    status: "signed_up",
    supabase_user_id: entry.supabase_user_id,
    provenance_tag: PROVENANCE_TAG,
    written_at: new Date().toISOString(),
    dependent_rows: dependentRows,
  });
}

// Attach contract fields to capture.
capture.run_id = GATE_A_RUN_ID;
capture.created_at = new Date().toISOString();
capture.identity_mode = IDENTITY_MODE;
capture.provenance_tag = PROVENANCE_TAG;
capture.created_fixtures = createdFixtures;

// Final write — preserves the existing writeFileSync call shape expected by
// manifest-completeness.spec. All intermediate durable persists already fsync'd.
writeFileSync(IDENTITY_CAPTURE_FILE, JSON.stringify(capture, null, 2), "utf8");
console.log(`\nIdentity capture written to: ${IDENTITY_CAPTURE_FILE}`);
console.log(`NOTE: passwords NOT in capture file — held in process.env GATE_A_TEST_PASSWORD_{${identityLabels.join(",")}} only`);

// Summary
const ok = identityLabels
  .map((l) => [l, capture[l]])
  .filter(([, v]) => v && v.status === "OK");
const blocked = identityLabels
  .map((l) => [l, capture[l]])
  .filter(([, v]) => v && v.status === "BLOCKED");
console.log(`\nSUMMARY: ${ok.length} OK · ${blocked.length} BLOCKED`);

if (ok.length === 0) {
  console.error("FAIL: no identities signed up successfully — all scenarios will be BLOCKED");
  process.exit(1);
}

console.log("\n--- RUNNER_ENV_HINT_BEGIN ---");
for (const label of identityLabels) {
  if (capture[label]?.status === "OK") {
    console.log(`GATE_A_TEST_PASSWORD_${label}=<supplied by parent runner — not printed>`);
  }
}
console.log("--- RUNNER_ENV_HINT_END ---");

const expectedCount = identityLabels.length;
const verdict = ok.length >= expectedCount ? "PASS" : ok.length >= 1 ? "PARTIAL" : "FAIL";
console.log(JSON.stringify({
  verdict,
  detail: `${ok.length}/${expectedCount} identities signed up (mode=${IDENTITY_MODE}). BLOCKED: ${blocked.map(([l]) => l).join(",") || "none"}`,
  identity_count: ok.length,
  expected_count: expectedCount,
  identity_mode: IDENTITY_MODE,
  blocked_count: blocked.length,
}));

process.exit(verdict === "FAIL" ? 1 : 0);
