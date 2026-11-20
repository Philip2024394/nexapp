#!/usr/bin/env node
// =============================================================================
// Offline test harness · GB-WHITESPACE-GUARD candidate v3
// -----------------------------------------------------------------------------
// Pure Node · no DB · no network. Three sections:
//
//   SOURCE_ASSERTION   — static grep of the generated SQL to prove the exact
//                        guard string + grants + search_path + attachment_type
//                        line are present, and the mig-356 body guard string
//                        is NOT present.
//
//   OFFLINE_EXECUTABLE — JavaScript regex mirror of `_LANE_G_ACCEPT_HREF_PATTERN`
//                        from src/lib/nex-native/peer-message-service.ts:768,
//                        exercised against an exhaustive matrix.
//
//   UNVERIFIED         — Postgres semantic checks the JS mirror does NOT prove;
//                        each is recorded with the exact follow-up required.
//
// Writes a per-case JSON report to tmp-lane-g/30-offline-test-results.json.
// Keeps failures visible — the harness NEVER edits expectations to make a
// failing case pass.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SQL_PATH = join(
  REPO_ROOT,
  "nex-supabase",
  "candidate-migrations",
  "CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql",
);
const RESULTS_PATH = join(__dirname, "30-offline-test-results.json");

const results = {
  generated_at: new Date().toISOString(),
  sql_path: SQL_PATH,
  source_assertions: [],
  offline_executable: [],
  unverified: [],
  totals: { pass: 0, fail: 0, unverified_notes: 0 },
};

function recordSource(name, pass, detail) {
  results.source_assertions.push({ name, pass, detail });
  if (pass) results.totals.pass++;
  else results.totals.fail++;
  const flag = pass ? "PASS" : "FAIL";
  console.log(`[SOURCE_ASSERTION] ${flag} · ${name}${detail ? " · " + detail : ""}`);
}

function recordCase(name, expected, actual, detail) {
  const pass = expected === actual;
  results.offline_executable.push({ name, expected, actual, pass, detail });
  if (pass) results.totals.pass++;
  else results.totals.fail++;
  const flag = pass ? "PASS" : "FAIL";
  console.log(
    `[OFFLINE_EXECUTABLE] ${flag} · ${name} · expected=${expected} actual=${actual}${detail ? " · " + detail : ""}`,
  );
}

function recordUnverified(topic, follow_up) {
  results.unverified.push({ topic, follow_up });
  results.totals.unverified_notes++;
  console.log(`[UNVERIFIED] ${topic} · follow-up: ${follow_up}`);
}

// ─── SOURCE_ASSERTION ────────────────────────────────────────────────
let sql;
try {
  sql = readFileSync(SQL_PATH, "utf8");
} catch (err) {
  recordSource("sql_file_readable", false, String(err));
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  process.exit(1);
}
recordSource("sql_file_readable", true, `${sql.length} bytes`);

const expectedGuardRegexLiteral =
  "'^/nex-native/call/preview\\?session=[0-9a-f-]{36}&accept=1$'";
recordSource(
  "guard_contains_regex_literal",
  sql.includes(expectedGuardRegexLiteral),
  expectedGuardRegexLiteral,
);

recordSource(
  "guard_uses_case_insensitive_not_match_operator",
  sql.includes("!~*"),
  "operator `!~*` (POSIX ERE case-insensitive not-match)",
);

recordSource(
  "guard_raises_22023",
  sql.includes("USING ERRCODE = '22023'") &&
    sql.includes(
      "attachment_url_required · call_invite needs a well-formed accept_href matching _LANE_G_ACCEPT_HREF_PATTERN",
    ),
  "ERRCODE 22023 + contract-matching message",
);

recordSource(
  "mig356_btrim_body_guard_absent",
  !sql.includes("length(btrim(p_attachment_url)) = 0"),
  "mig-356 `length(btrim(...)) = 0` form must NOT appear",
);

recordSource(
  "preserves_security_definer",
  sql.includes("SECURITY DEFINER"),
  "function stays SECURITY DEFINER",
);

recordSource(
  "preserves_search_path",
  sql.includes("SET search_path = public, pg_temp"),
  "search_path pin",
);

recordSource(
  "preserves_attachment_type_call_invite",
  sql.includes("'call_invite'") && sql.includes("attachment_type"),
  "attachment_type='call_invite' literal preserved",
);

recordSource(
  "preserves_revoke_all_from_public",
  /REVOKE ALL ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM PUBLIC;/.test(sql),
  "REVOKE ALL FROM PUBLIC",
);

recordSource(
  "preserves_revoke_execute_from_anon",
  /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM anon;/.test(sql),
  "REVOKE EXECUTE FROM anon",
);

recordSource(
  "preserves_revoke_execute_from_service_role",
  /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM service_role;/.test(sql),
  "REVOKE EXECUTE FROM service_role",
);

recordSource(
  "preserves_grant_execute_to_authenticated",
  /GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) TO authenticated;/.test(sql),
  "GRANT EXECUTE TO authenticated",
);

// Strip `-- ...` line comments so comment text that MENTIONS the forbidden
// pattern (in an explanatory NOTE) is not treated as the pattern itself.
// This assertion is about executable SQL statements, not comment prose.
const sqlNoLineComments = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
recordSource(
  "no_insert_into_nex_migration_history",
  !/INSERT\s+INTO\s+nex_migration_history/i.test(sqlNoLineComments),
  "candidate preview must NOT claim a version row (executable SQL only · comments allowed to reference the pattern)",
);

// ─── OFFLINE_EXECUTABLE ──────────────────────────────────────────────
// Mirror of _LANE_G_ACCEPT_HREF_PATTERN · peer-message-service.ts:768
const PATTERN = /^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i;

function accepts(v) {
  return v !== null && v !== undefined && PATTERN.test(v);
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111"; // 36 chars with hyphens
const VALID_HREF = `/nex-native/call/preview?session=${VALID_UUID}&accept=1`;

recordCase("null_is_rejected", false, accepts(null));
recordCase("undefined_is_rejected", false, accepts(undefined));
recordCase("empty_string_rejected", false, accepts(""));
recordCase("ascii_spaces_only_rejected", false, accepts("   "));
recordCase("tab_only_rejected", false, accepts("\t"));
recordCase("newline_only_rejected", false, accepts("\n"));
recordCase("cr_only_rejected", false, accepts("\r"));
recordCase("ff_only_rejected", false, accepts("\f"));
recordCase("vt_only_rejected", false, accepts("\v"));
recordCase(
  "mixed_whitespace_rejected",
  false,
  accepts(" \t\n\r\f\v "),
);

recordCase("valid_href_accepted", true, accepts(VALID_HREF));

const UPPER_UUID = VALID_UUID.replace(/f/g, "F");
const UPPER_HREF = `/nex-native/call/preview?session=${UPPER_UUID}&accept=1`;
recordCase(
  "uppercase_hex_accepted_due_to_case_insensitive_flag",
  true,
  accepts(UPPER_HREF),
);

// Near-misses on session length / charset
const SHORT_SESSION = VALID_UUID.slice(0, -1); // 35
const LONG_SESSION = VALID_UUID + "1"; // 37
const BAD_CHAR_SESSION = VALID_UUID.slice(0, -1) + "g"; // non-hex
recordCase(
  "session_35_chars_rejected",
  false,
  accepts(`/nex-native/call/preview?session=${SHORT_SESSION}&accept=1`),
);
recordCase(
  "session_37_chars_rejected",
  false,
  accepts(`/nex-native/call/preview?session=${LONG_SESSION}&accept=1`),
);
recordCase(
  "session_nonhex_char_rejected",
  false,
  accepts(`/nex-native/call/preview?session=${BAD_CHAR_SESSION}&accept=1`),
);

recordCase(
  "accept_equals_2_rejected",
  false,
  accepts(`/nex-native/call/preview?session=${VALID_UUID}&accept=2`),
);
recordCase(
  "missing_query_string_rejected",
  false,
  accepts("/nex-native/call/preview"),
);
recordCase(
  "trailing_slash_before_query_rejected",
  false,
  accepts(`/nex-native/call/preview/?session=${VALID_UUID}&accept=1`),
);
recordCase(
  "absolute_url_with_scheme_rejected",
  false,
  accepts(`http://host${VALID_HREF}`),
);
recordCase(
  "percent_encoded_space_in_path_rejected",
  false,
  accepts(`/nex-native/call%20preview?session=${VALID_UUID}&accept=1`),
);
recordCase(
  "null_byte_inside_href_rejected",
  false,
  accepts(`/nex-native/call/preview?session=${VALID_UUID}\u0000&accept=1`),
);
recordCase(
  "valid_href_wrapped_in_whitespace_rejected",
  false,
  accepts(` \t${VALID_HREF}\n `),
);
recordCase(
  "sql_injection_suffix_rejected",
  false,
  accepts(`${VALID_HREF};DROP TABLE nex_peer_message`),
);
recordCase(
  "rtl_override_u202e_mid_string_rejected",
  false,
  accepts(
    `/nex-native/call/preview?session=${VALID_UUID.slice(0, 18)}\u202E${VALID_UUID.slice(18)}&accept=1`,
  ),
);

// ─── UNVERIFIED · Postgres semantic checks not provable offline ──────
recordUnverified(
  "postgres_posix_ere_question_mark_escape",
  "In sandbox, run `SELECT '/nex-native/call/preview?session=11111111-1111-4111-8111-111111111111&accept=1' ~* '^/nex-native/call/preview\\?session=[0-9a-f-]{36}&accept=1$';` and confirm true. Postgres POSIX ERE requires `\\?` to escape `?` (a quantifier); the JS mirror cannot prove Postgres parses this literal identically.",
);
recordUnverified(
  "postgres_hex_hyphen_class_semantics",
  "In sandbox, run matrix of 36-char strings containing only [0-9a-f-] (mixed hyphen positions) and confirm `~*` matches; add one non-hex char and confirm it does not. The JS mirror uses the same character class source but Postgres regex engine differs at the implementation level.",
);
recordUnverified(
  "postgres_u0000_handling_in_text",
  "Postgres text values cannot contain NUL (\\u0000); drivers typically reject or strip. The JS mirror rejects at regex level; Postgres behaviour depends on the driver surface. Confirm in sandbox whether the driver raises `invalid byte sequence` before the regex is evaluated, or whether the regex sees the character.",
);
recordUnverified(
  "postgres_tilde_star_case_insensitivity_over_a_f",
  "Confirm `~*` treats `[0-9a-f-]` as case-insensitive covering `A-F` identically. Run a session string using A-F uppercase hex against the guard and confirm it is accepted (matches the `/i` flag semantics of the JS mirror).",
);

// ─── Persist ──────────────────────────────────────────────────────────
writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2) + "\n");

console.log("");
console.log("──────────────────────────────────────────────────────────────");
console.log(
  `Totals · pass=${results.totals.pass} · fail=${results.totals.fail} · unverified=${results.totals.unverified_notes}`,
);
console.log(`Results JSON: ${RESULTS_PATH}`);

if (results.totals.fail > 0) {
  process.exitCode = 2;
}
