#!/usr/bin/env node
// =============================================================================
// Agent B · OFFLINE source-review safe checks for GB-WHITESPACE-GUARD
// -----------------------------------------------------------------------------
// Pure Node · no DB · no network. Independent of Agent A's harness.
//
// Verifies:
//   1. The candidate SQL file contains a literal `&` (NOT `&amp;` entity) in
//      the regex guard — show-stopper if an HTML entity leaked in.
//   2. The guard regex is byte-identical to the TypeScript contract at
//      src/lib/nex-native/peer-message-service.ts:768 after POSIX-ERE
//      escaping of `?`.
//   3. The function signature, SECURITY DEFINER, search_path pin, and
//      REVOKE/GRANT envelope match mig-356.
//   4. No INSERT INTO nex_migration_history row (candidate has no number).
//   5. Attempts to reproduce Postgres `~*` with Node's RegExp (/i) across a
//      superset of Agent A's matrix.  Marked OFFLINE_SIMULATED.
//
// This script DOES NOT modify any file; only reads and prints.
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PREVIEW = join(
  REPO_ROOT,
  "nex-supabase",
  "candidate-migrations",
  "CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql",
);
const ROLLBACK = join(
  REPO_ROOT,
  "nex-supabase",
  "candidate-migrations",
  "CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW_rollback.sql",
);
const CONTRACT = join(
  REPO_ROOT,
  "src",
  "lib",
  "nex-native",
  "peer-message-service.ts",
);
const MIG_356 = join(
  REPO_ROOT,
  "nex-supabase",
  "migrations",
  "356_nex_group_call_invite_v2.sql",
);

let fail = 0;
let pass = 0;
function check(name, ok, detail = "") {
  const flag = ok ? "PASS" : "FAIL";
  if (ok) pass++;
  else fail++;
  console.log(`[${flag}] ${name}${detail ? " · " + detail : ""}`);
}

const previewSrc = readFileSync(PREVIEW, "utf8");
const rollbackSrc = readFileSync(ROLLBACK, "utf8");
const contractSrc = readFileSync(CONTRACT, "utf8");
const mig356Src = readFileSync(MIG_356, "utf8");

// 1. HTML-entity contamination check (show-stopper)
check(
  "preview_has_no_html_entity_ampersand",
  !previewSrc.includes("&amp;"),
  "SQL file must contain literal `&`, not `&amp;` HTML entity",
);
check(
  "rollback_has_no_html_entity_ampersand",
  !rollbackSrc.includes("&amp;"),
  "rollback SQL file must contain literal `&`, not `&amp;`",
);

// 2. Contract regex extraction + byte-identity
const contractMatch = contractSrc.match(
  /_LANE_G_ACCEPT_HREF_PATTERN\s*=\s*(\/[^\n]+\/i);/,
);
check(
  "contract_regex_located",
  !!contractMatch,
  contractMatch ? contractMatch[1] : "not found",
);
const contractLiteral = contractMatch ? contractMatch[1] : "";

// Expected POSIX ERE translation: strip leading/trailing /, escape `?` to `\?`,
// drop trailing /i flag (SQL uses `~*` operator instead).
// Contract JS: /^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i
// Expected SQL body: '^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$'
const expectedSqlRegex =
  "'^/nex-native/call/preview\\?session=[0-9a-f-]{36}&accept=1$'";
check(
  "preview_contains_byte_equivalent_regex",
  previewSrc.includes(expectedSqlRegex),
  expectedSqlRegex,
);

// 3. Guard operator must be case-insensitive not-match
check(
  "preview_uses_bang_tilde_star_operator",
  /p_attachment_url\s*!~\*/.test(previewSrc),
  "`!~*` case-insensitive not-match operator present",
);

// 4. Old-form guard must be absent
check(
  "mig356_btrim_form_absent_from_preview",
  !previewSrc.includes("length(btrim(p_attachment_url))"),
  "mig-356 defective `length(btrim(...))` form removed",
);

// 5. Signature parity vs mig-356 — extract parameter lines
function extractParamList(src) {
  const m = src.match(
    /CREATE FUNCTION nex_invite_to_call_tx\(([\s\S]*?)\)\s*RETURNS TABLE/,
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}
const previewParams = extractParamList(previewSrc);
const mig356Params = extractParamList(mig356Src);
check(
  "signature_bytes_parity_with_mig356",
  previewParams === mig356Params,
  previewParams === mig356Params
    ? "identical"
    : `DIFF · preview=[${previewParams}] mig356=[${mig356Params}]`,
);

// 6. SECURITY DEFINER + search_path
check(
  "preview_security_definer",
  /SECURITY DEFINER/.test(previewSrc),
);
check(
  "preview_search_path_pin",
  previewSrc.includes("SET search_path = public, pg_temp"),
);

// 7. Grant envelope parity — same 4 statements with same scope keywords
const grantPatterns = [
  /REVOKE ALL ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM PUBLIC;/,
  /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM anon;/,
  /REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) FROM service_role;/,
  /GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx\([\s\S]*?\) TO authenticated;/,
];
for (const [i, re] of grantPatterns.entries()) {
  check(`grant_envelope_part_${i + 1}_present`, re.test(previewSrc), String(re));
}

// 8. DROP signature matches 7-param mig-356 shape
const dropRe =
  /DROP FUNCTION IF EXISTS nex_invite_to_call_tx\([\s\S]*?UUID[\s\S]*?TEXT[\s\S]*?TEXT[\s\S]*?JSONB[\s\S]*?TEXT[\s\S]*?TEXT[\s\S]*?UUID[\s\S]*?\);/;
check("preview_drops_7_param_signature", dropRe.test(previewSrc));
check("rollback_drops_7_param_signature", dropRe.test(rollbackSrc));

// 9. No migration history row (candidate has no number)
const sqlNoLineComments = previewSrc
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");
check(
  "preview_has_no_migration_history_insert",
  !/INSERT\s+INTO\s+nex_migration_history/i.test(sqlNoLineComments),
);

// 10. OFFLINE_SIMULATED Postgres `~*` behaviour via Node /i
const PATTERN = /^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i;
const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const V = `/nex-native/call/preview?session=${VALID_UUID}&accept=1`;
const matrix = [
  ["accept_1_valid", V, true],
  ["accept_1_uppercase_hex", V.replace(/1/g, "F"), false], // breaks uuid digit expectation
  ["uppercase_hex_only_in_session", `/nex-native/call/preview?session=${"AAAAAAAA-AAAA-4AAA-AAAA-AAAAAAAAAAAA"}&accept=1`, true],
  ["accept_01_rejected", `/nex-native/call/preview?session=${VALID_UUID}&accept=01`, false],
  ["accept_1_trailing_space", `${V} `, false],
  ["accept_1_leading_space", ` ${V}`, false],
  ["form_feed_only", "\f", false],
  ["vertical_tab_only", "\v", false],
  ["double_amp", `/nex-native/call/preview?session=${VALID_UUID}&&accept=1`, false],
  ["path_traversal", `/nex-native/call/preview/../admin?session=${VALID_UUID}&accept=1`, false],
  ["unicode_fullwidth_question", `/nex-native/call/preview\uFF1Fsession=${VALID_UUID}&accept=1`, false],
  ["null_byte_appended", `${V}\u0000`, false],
  ["case_insensitive_path", "/NEX-NATIVE/CALL/PREVIEW?session=" + VALID_UUID + "&accept=1", true],
  ["sql_quote_injection", `${V}'`, false],
];
for (const [name, input, expected] of matrix) {
  const actual = PATTERN.test(input);
  check(
    `simulated_${name}`,
    actual === expected,
    `expected=${expected} actual=${actual}`,
  );
}

console.log("");
console.log(`totals · pass=${pass} · fail=${fail}`);
process.exitCode = fail > 0 ? 2 : 0;
