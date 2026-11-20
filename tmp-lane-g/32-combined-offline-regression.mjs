#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// OFFLINE JS MODEL ONLY · DOES NOT PROVE POSTGRESQL LOCK SEMANTICS ·
// SOURCE ASSERTIONS ARE NOT SQL-RUNTIME PROOF · GB-WHITESPACE-GUARD
// AND GB-4CAP BOTH REMAIN OPEN AT THE DB BOUNDARY.
// ════════════════════════════════════════════════════════════════════
//
// Lane-G Package C · Combined-preview offline regression harness.
//
// Purpose: focused regression + concurrency-model coverage for the
// forthcoming COMBINED preview that merges GB-WHITESPACE-GUARD
// (contract-matching regex) and GB-4CAP (session-row FOR UPDATE) into
// one `nex_invite_to_call_tx` function body.
//
// NON-DUPLICATION STATEMENT
// -------------------------
// This harness is strictly additive to:
//   · tmp-lane-g/30-whitespace-guard-offline-tests.mjs (Agent A)
//   · tmp-lane-g/31-4cap-model.test.mjs (Agent C prior)
// It does NOT re-run cases already covered there. See notes doc for
// per-case rationale.
//
// Parts covered:
//   P1 · destination-grammar near-miss cases uncovered by Agent A
//   P2 · combined-ordering source assertions (if combined file lands)
//   P3 · concurrency-model cases uncovered by Agent C prior
//   P4 · contract observations (modelled, not proved)
//
// Writes: 32-combined-offline-results.json
// ════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const COMBINED_SQL_PATH = join(
  REPO_ROOT,
  "nex-supabase",
  "candidate-migrations",
  "CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql",
);
const RESULTS_PATH = join(__dirname, "32-combined-offline-results.json");

const BANNER = [
  "",
  "════════════════════════════════════════════════════════════════════",
  "OFFLINE JS MODEL ONLY · DOES NOT PROVE POSTGRESQL LOCK SEMANTICS ·",
  "SOURCE ASSERTIONS ARE NOT SQL-RUNTIME PROOF · GB-WHITESPACE-GUARD",
  "AND GB-4CAP BOTH REMAIN OPEN AT THE DB BOUNDARY.",
  "════════════════════════════════════════════════════════════════════",
  "",
].join("\n");

console.log(BANNER);

const results = {
  generatedAt: new Date().toISOString(),
  banner: BANNER.trim(),
  combinedSqlPath: COMBINED_SQL_PATH,
  combinedSqlPresent: existsSync(COMBINED_SQL_PATH),
  cases: [],
  totals: { total: 0, pass: 0, fail: 0, pending: 0 },
};

function record(id, part, kind, expected, actual, status, detail) {
  results.cases.push({ id, part, kind, expected, actual, status, detail });
  results.totals.total++;
  if (status === "PASS") results.totals.pass++;
  else if (status === "FAIL") results.totals.fail++;
  else if (status === "PENDING") results.totals.pending++;
  console.log(
    `[${status}] ${part} · ${kind} · ${id} · expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}${detail ? " · " + detail : ""}`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// PART 1 · Destination-grammar near-miss cases uncovered by Agent A
// ─────────────────────────────────────────────────────────────────────
// Mirror of _LANE_G_ACCEPT_HREF_PATTERN (peer-message-service.ts:768).
// Must match the regex literal written into both Agent A's candidate
// and the forthcoming combined candidate.
const PATTERN =
  /^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i;
const accepts = (v) => v !== null && v !== undefined && PATTERN.test(v);

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_HREF = `/nex-native/call/preview?session=${VALID_UUID}&accept=1`;

// Dot/underscore are not in [0-9a-f-] — must reject.
record(
  "p1_session_with_dot_rejected",
  "P1",
  "js_model",
  false,
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}.&accept=1`,
  ),
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}.&accept=1`,
  ) === false
    ? "PASS"
    : "FAIL",
  "dot (.) is not in POSIX class [0-9a-f-]",
);
record(
  "p1_session_with_underscore_rejected",
  "P1",
  "js_model",
  false,
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}_&accept=1`,
  ),
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}_&accept=1`,
  ) === false
    ? "PASS"
    : "FAIL",
  "underscore (_) not in class",
);

// 36 hyphens: contract-faithful acceptance under [0-9a-f-]{36}.
// Recorded as contract observation — not a bug.
const ALL_HYPHENS = "-".repeat(36);
record(
  "p1_session_all_hyphens_contract_accept",
  "P1",
  "js_model",
  true,
  accepts(`/nex-native/call/preview?session=${ALL_HYPHENS}&accept=1`),
  accepts(`/nex-native/call/preview?session=${ALL_HYPHENS}&accept=1`) === true
    ? "PASS"
    : "FAIL",
  "contract-faithful acceptance of 36-hyphen session segment · noted as observation not defect · Postgres POSIX behaviour UNVERIFIED",
);

// Unicode non-ASCII — must reject.
record(
  "p1_session_non_ascii_e_acute_rejected",
  "P1",
  "js_model",
  false,
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}é&accept=1`,
  ),
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}é&accept=1`,
  ) === false
    ? "PASS"
    : "FAIL",
  "é is outside [0-9a-f-] even case-insensitive",
);
record(
  "p1_session_non_ascii_u_umlaut_rejected",
  "P1",
  "js_model",
  false,
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}ü&accept=1`,
  ),
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, -1)}ü&accept=1`,
  ) === false
    ? "PASS"
    : "FAIL",
  "ü outside class",
);

// Duplicated accept param — must reject (full-anchor).
record(
  "p1_duplicate_accept_param_rejected",
  "P1",
  "js_model",
  false,
  accepts(`${VALID_HREF}&accept=1`),
  accepts(`${VALID_HREF}&accept=1`) === false ? "PASS" : "FAIL",
  "trailing &accept=1 violates $ anchor",
);

// Extra params appended — must reject.
record(
  "p1_extra_param_after_accept_rejected",
  "P1",
  "js_model",
  false,
  accepts(`${VALID_HREF}&foo=bar`),
  accepts(`${VALID_HREF}&foo=bar`) === false ? "PASS" : "FAIL",
  "trailing &foo=bar violates $ anchor",
);

// Absolute URL with scheme and host — must reject.
record(
  "p1_absolute_url_with_host_rejected",
  "P1",
  "js_model",
  false,
  accepts(`http://example.com${VALID_HREF}`),
  accepts(`http://example.com${VALID_HREF}`) === false ? "PASS" : "FAIL",
  "no scheme/authority allowed by grammar",
);

// Protocol-relative URL — must reject.
record(
  "p1_protocol_relative_url_rejected",
  "P1",
  "js_model",
  false,
  accepts(`/${VALID_HREF}`),
  accepts(`/${VALID_HREF}`) === false ? "PASS" : "FAIL",
  "leading // or /… prefix violates ^ anchor",
);

// Trailing fragment — must reject.
record(
  "p1_trailing_fragment_rejected",
  "P1",
  "js_model",
  false,
  accepts(`${VALID_HREF}#foo`),
  accepts(`${VALID_HREF}#foo`) === false ? "PASS" : "FAIL",
  "trailing #foo violates $ anchor",
);

// All uppercase hex — must PASS due to ~* case-insensitive flag.
const UPPER_UUID = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
record(
  "p1_uppercase_hex_accepted_case_insensitive",
  "P1",
  "js_model",
  true,
  accepts(`/nex-native/call/preview?session=${UPPER_UUID}&accept=1`),
  accepts(`/nex-native/call/preview?session=${UPPER_UUID}&accept=1`) === true
    ? "PASS"
    : "FAIL",
  "case-insensitive flag covers A-F",
);

// Mixed case interleaved — must PASS.
const MIXED_UUID = "AaBbCcDd-1234-4EeF-8aAb-CcDd12345678";
record(
  "p1_mixed_case_hex_accepted",
  "P1",
  "js_model",
  true,
  accepts(`/nex-native/call/preview?session=${MIXED_UUID}&accept=1`),
  accepts(`/nex-native/call/preview?session=${MIXED_UUID}&accept=1`) === true
    ? "PASS"
    : "FAIL",
  "mixed case within hex range",
);

// ─────────────────────────────────────────────────────────────────────
// PART 2 · Combined-ordering source assertions
// ─────────────────────────────────────────────────────────────────────
let combinedSql = null;
if (results.combinedSqlPresent) {
  try {
    combinedSql = readFileSync(COMBINED_SQL_PATH, "utf8");
  } catch (err) {
    record(
      "p2_combined_sql_readable",
      "P2",
      "source_assertion",
      "readable",
      String(err),
      "FAIL",
      "unexpected read error",
    );
  }
}

function sourceAssertOrPending(id, detail, assertion) {
  if (!combinedSql) {
    record(
      id,
      "P2",
      "source_assertion",
      "assertion holds against combined SQL",
      "combined SQL file not present at harness-run time",
      "PENDING",
      detail,
    );
    return;
  }
  const ok = assertion(combinedSql);
  record(
    id,
    "P2",
    "source_assertion",
    true,
    ok,
    ok ? "PASS" : "FAIL",
    detail,
  );
}

// 2.1 — contract regex literal present (byte-match Agent A's string).
const EXPECTED_REGEX_LITERAL =
  "'^/nex-native/call/preview\\?session=[0-9a-f-]{36}&accept=1$'";
sourceAssertOrPending(
  "p2_contains_contract_regex_literal",
  "regex literal byte-match with Agent A candidate",
  (sql) => sql.includes(EXPECTED_REGEX_LITERAL),
);

// 2.2 — uses !~* operator.
sourceAssertOrPending(
  "p2_uses_not_match_case_insensitive",
  "guard uses POSIX ERE case-insensitive not-match (!~*)",
  (sql) => sql.includes("!~*"),
);

// 2.3 — mig-356 btrim body guard absent in executable SQL (comments ok).
sourceAssertOrPending(
  "p2_no_btrim_body_guard",
  "superseded btrim(p_attachment_url)) = 0 form must NOT appear in executable SQL · comments allowed to reference it",
  (sql) => {
    const stripped = sql
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    return !stripped.includes("length(btrim(p_attachment_url)) = 0");
  },
);

// 2.4 — FOR UPDATE on session row present.
const FOR_UPDATE_RE =
  /PERFORM\s+1\s+FROM\s+nex_group_call_session\s+WHERE\s+id\s*=\s*v_session_id\s+FOR\s+UPDATE\s*;/i;
sourceAssertOrPending(
  "p2_contains_for_update_perform",
  "PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id FOR UPDATE;",
  (sql) => FOR_UPDATE_RE.test(sql),
);

// 2.5 — Ordering: FOR UPDATE must appear AFTER the session block END IF
// and BEFORE the participant INSERT. Model this by searching the file
// for three anchors and comparing indices.
sourceAssertOrPending(
  "p2_for_update_between_session_block_and_participant_insert",
  "lock sits strictly between session ownership block and participant INSERT",
  (sql) => {
    const forUpdateIdx = sql.search(FOR_UPDATE_RE);
    const participantInsertIdx = sql.indexOf(
      "INSERT INTO nex_group_call_participant",
    );
    // Anchor the session block END IF: last END IF before FOR UPDATE.
    const upToLock = sql.slice(0, forUpdateIdx);
    const sessionEndIfIdx = upToLock.lastIndexOf("END IF;");
    return (
      forUpdateIdx > 0 &&
      participantInsertIdx > 0 &&
      sessionEndIfIdx > 0 &&
      sessionEndIfIdx < forUpdateIdx &&
      forUpdateIdx < participantInsertIdx
    );
  },
);

// 2.6 — attachment_url guard precedes session block (first 22023 raise
// after identity is established).
sourceAssertOrPending(
  "p2_attachment_url_guard_before_session_block",
  "attachment_url guard is the first 22023-raising check after identity",
  (sql) => {
    const attachUrlIdx = sql.indexOf("attachment_url_required");
    const sessionBlockIdx = sql.indexOf("p_existing_session_id IS NOT NULL");
    const inviteeCheckIdx = sql.indexOf("invitee_account_id_required");
    return (
      attachUrlIdx > 0 &&
      sessionBlockIdx > 0 &&
      inviteeCheckIdx > 0 &&
      attachUrlIdx < inviteeCheckIdx &&
      attachUrlIdx < sessionBlockIdx
    );
  },
);

// 2.7 — dedup catch remains right below participant INSERT.
sourceAssertOrPending(
  "p2_dedup_catch_right_below_participant_insert",
  "EXCEPTION WHEN unique_violation follows participant INSERT in same BEGIN block",
  (sql) => {
    const partInsIdx = sql.indexOf("INSERT INTO nex_group_call_participant");
    const dedupIdx = sql.indexOf("WHEN unique_violation THEN", partInsIdx);
    const convInsIdx = sql.indexOf("INSERT INTO nex_peer_conversation");
    return (
      partInsIdx > 0 &&
      dedupIdx > partInsIdx &&
      (convInsIdx === -1 || dedupIdx < convInsIdx)
    );
  },
);

// 2.8 — SECURITY DEFINER + search_path preserved.
sourceAssertOrPending(
  "p2_security_definer_preserved",
  "SECURITY DEFINER retained",
  (sql) => sql.includes("SECURITY DEFINER"),
);
sourceAssertOrPending(
  "p2_search_path_preserved",
  "SET search_path = public, pg_temp retained",
  (sql) => sql.includes("SET search_path = public, pg_temp"),
);

// 2.9 — grant/revoke envelope preserved.
sourceAssertOrPending(
  "p2_grants_preserved",
  "REVOKE FROM PUBLIC/anon/service_role + GRANT TO authenticated",
  (sql) =>
    /REVOKE ALL ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM PUBLIC;/.test(
      sql,
    ) &&
    /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM anon;/.test(
      sql,
    ) &&
    /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM service_role;/.test(
      sql,
    ) &&
    /GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) TO authenticated;/.test(
      sql,
    ),
);

// 2.10 — no migration-history row (preview rule).
sourceAssertOrPending(
  "p2_no_migration_history_row",
  "preview must not claim a sequential version number",
  (sql) => {
    const stripped = sql
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    return !/INSERT\s+INTO\s+nex_migration_history/i.test(stripped);
  },
);

// ─────────────────────────────────────────────────────────────────────
// PART 3 · Concurrency model (uncovered by Agent C prior)
// ─────────────────────────────────────────────────────────────────────
// Models the combined function body: WITH session-row FOR UPDATE lock
// (serialises same session) AND dedup via UNIQUE(session_id,account_id)
// catch. Agent C prior covered A/B/C/D — we add E/F/G/H.

function makeWorld(cap = 4) {
  return { sessions: new Map(), locks: new Map(), cap };
}
function ensureSession(w, s) {
  if (!w.sessions.has(s)) w.sessions.set(s, { participants: [] });
  return w.sessions.get(s);
}
function withSessionLock(w, s, body) {
  const prev = w.locks.get(s) ?? Promise.resolve();
  let release;
  const held = new Promise((r) => (release = r));
  w.locks.set(
    s,
    prev.then(() => held),
  );
  return prev.then(async () => {
    try {
      return await body();
    } finally {
      release();
    }
  });
}
// Models the combined function body: identity + url guard assumed OK;
// acquire lock, dedup-check via UNIQUE, cap-check via trigger-like COUNT.
async function inviteCombined(world, sessionId, invitee) {
  return withSessionLock(world, sessionId, async () => {
    const session = ensureSession(world, sessionId);
    if (session.participants.includes(invitee)) {
      return { ok: true, dedup: true };
    }
    const cnt = session.participants.length;
    if (cnt >= world.cap) {
      const err = new Error(
        `cap_exceeded · session ${sessionId} has ${cnt}`,
      );
      err.errcode = "P0001";
      throw err;
    }
    session.participants.push(invitee);
    return { ok: true, dedup: false };
  });
}

// Case E — same session, 5 concurrent invites + 1 retry on same account.
async function caseE() {
  const world = makeWorld();
  ensureSession(world, "S1");
  const invitees = ["I1", "I2", "I3", "I4", "I5"];
  const workers = invitees.map((i) => inviteCombined(world, "S1", i));
  const retry = inviteCombined(world, "S1", "I1"); // dedup
  const out = await Promise.allSettled([...workers, retry]);
  const count = world.sessions.get("S1").participants.length;
  const capRaises = out.filter(
    (o) => o.status === "rejected" && /cap_exceeded/.test(o.reason.message),
  ).length;
  const dedupReturns = out.filter(
    (o) => o.status === "fulfilled" && o.value.dedup === true,
  ).length;
  const ok = count === 4 && capRaises === 1 && dedupReturns >= 1;
  record(
    "p3_caseE_5concurrent_plus_retry",
    "P3",
    "js_model",
    "count=4, 1 cap raise, dedup>=1",
    { count, capRaises, dedupReturns },
    ok ? "PASS" : "FAIL",
    "models: cap holds at 4, one over-cap raise, retry on existing participant dedups",
  );
}

// Case F — same session, 4 concurrent invites, 2 share invitee.
async function caseF() {
  const world = makeWorld();
  ensureSession(world, "S1");
  const workers = [
    inviteCombined(world, "S1", "A"),
    inviteCombined(world, "S1", "B"),
    inviteCombined(world, "S1", "C"),
    inviteCombined(world, "S1", "A"), // duplicate invitee
  ];
  const out = await Promise.allSettled(workers);
  const count = world.sessions.get("S1").participants.length;
  const dedupReturns = out.filter(
    (o) => o.status === "fulfilled" && o.value.dedup === true,
  ).length;
  const capRaises = out.filter(
    (o) => o.status === "rejected" && /cap_exceeded/.test(o.reason.message),
  ).length;
  const ok = count === 3 && dedupReturns === 1 && capRaises === 0;
  record(
    "p3_caseF_4concurrent_with_duplicate_invitee",
    "P3",
    "js_model",
    "count=3, dedup=1, no cap raise",
    { count, dedupReturns, capRaises },
    ok ? "PASS" : "FAIL",
    "dedup via UNIQUE(session_id, account_id) prevents double-write even when racing",
  );
}

// Case G — two unrelated sessions interleaved.
async function caseG() {
  const world = makeWorld();
  ensureSession(world, "SA");
  ensureSession(world, "SB");
  const workers = [
    inviteCombined(world, "SA", "A1"),
    inviteCombined(world, "SB", "B1"),
    inviteCombined(world, "SA", "A2"),
    inviteCombined(world, "SB", "B2"),
    inviteCombined(world, "SA", "A3"),
    inviteCombined(world, "SB", "B3"),
  ];
  const out = await Promise.allSettled(workers);
  const ca = world.sessions.get("SA").participants.length;
  const cb = world.sessions.get("SB").participants.length;
  const allOk = out.every((o) => o.status === "fulfilled");
  const ok = allOk && ca === 3 && cb === 3;
  record(
    "p3_caseG_two_sessions_independent",
    "P3",
    "js_model",
    "SA=3, SB=3, no rejections",
    { SA: ca, SB: cb, allOk },
    ok ? "PASS" : "FAIL",
    "scope `WHERE id = v_session_id` does not serialise unrelated sessions",
  );
}

// Case H — contract observation: mig-133 cap counts rows regardless of
// left_at. This is modelled, not proved. We simulate a session that
// hit cap, one participant 'left' (left_at set) but row remains; a
// re-invite must still raise because the trigger counts total rows.
async function caseH() {
  const world = makeWorld();
  ensureSession(world, "S1");
  world.sessions.get("S1").participants.push("P1", "P2", "P3", "P4");
  // Note: no 'left_at' column modelled — the observation is simply
  // that mig-133 trigger does SELECT COUNT(*) with no left_at filter.
  // Re-inviting a fresh invitee should raise.
  let raised = false;
  let raisedCode = null;
  try {
    await inviteCombined(world, "S1", "P5");
  } catch (err) {
    raised = true;
    raisedCode = err.errcode;
  }
  const ok = raised === true;
  record(
    "p3_caseH_reinvite_after_leave_still_raises",
    "P3",
    "js_model",
    "raise on 5th participant regardless of any left_at state",
    { raised, raisedCode },
    ok ? "PASS" : "FAIL",
    "contract observation: mig-133 cap invariant = '4 rows ever' not '4 active rows' · soft or re-join design must consider this",
  );
}

// ─────────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await caseE();
    await caseF();
    await caseG();
    await caseH();

    writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2) + "\n");

    const { total, pass, fail, pending } = results.totals;
    console.log("");
    console.log(
      "──────────────────────────────────────────────────────────────",
    );
    console.log(
      `TOTAL · ${total} cases · PASS ${pass} · FAIL ${fail} · PENDING ${pending}`,
    );
    console.log(`Results JSON: ${RESULTS_PATH}`);
    console.log(BANNER);

    // Exit non-zero only on actual FAIL, not on PENDING.
    process.exit(fail > 0 ? 2 : 0);
  } catch (err) {
    console.error("UNEXPECTED ERROR", err);
    process.exit(3);
  }
})();

// ════════════════════════════════════════════════════════════════════
// OFFLINE JS MODEL ONLY · DOES NOT PROVE POSTGRESQL LOCK SEMANTICS ·
// SOURCE ASSERTIONS ARE NOT SQL-RUNTIME PROOF · GB-WHITESPACE-GUARD
// AND GB-4CAP BOTH REMAIN OPEN AT THE DB BOUNDARY.
// ════════════════════════════════════════════════════════════════════
