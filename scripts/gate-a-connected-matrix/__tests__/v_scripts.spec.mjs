// scripts/gate-a-connected-matrix/__tests__/v_scripts.spec.mjs
//
// Offline source-invariant tests for V-* harness scripts:
//   · 30_v_auth_null.mjs     (V-AUTH-NULL — anon ACL block)
//   · 40_v_w1_new.mjs        (V-W1-NEW — RPC assertion shape)
//   · 50_v_w2_ok.mjs         (V-W2-OK  — RPC assertion shape)
//
// Proves each script:
//   1. Hard-refuses production ref.
//   2. Pins sandbox ref.
//   3. Sends the expected RPC name.
//   4. Asserts on the specific response-shape fields the harness documents.
//   5. Records exact IDs for cleanup (not prefix-match, not table scan).
//   6. Never leaks password or JWT to capture file or stdout.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
function src(name) {
  return readFileSync(resolve(__dir, "..", name), "utf8");
}

const SRC_30 = src("30_v_auth_null.mjs");
const SRC_40 = src("40_v_w1_new.mjs");
const SRC_50 = src("50_v_w2_ok.mjs");

function expectCommonInvariants(src, label) {
  // production refusal
  expect(src, `${label}: production refusal`).toContain('PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit"');
  expect(src, `${label}: production refusal check`).toMatch(/includes\(PRODUCTION_REF\)/);
  // sandbox pin
  expect(src, `${label}: sandbox pin`).toContain('CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"');
  // never prints anon key or jwt
  expect(src, `${label}: anonKey never logged`).not.toMatch(/console\.log\([^)]*anonKey/);
  expect(src, `${label}: jwt never logged`).not.toMatch(/console\.log\([^)]*jwt\s*[,)]/i);
  expect(src, `${label}: access_token never logged`).not.toMatch(/console\.log\([^)]*access_token/);
  expect(src, `${label}: password never logged`).not.toMatch(/console\.log\([^)]*password/i);
  // never uses admin API
  expect(src, `${label}: no admin API`).not.toMatch(/\.auth\.admin\./);
}

describe("30_v_auth_null — V-AUTH-NULL", () => {
  it("has common invariants", () => expectCommonInvariants(SRC_30, "30"));

  it("calls nex_invite_to_call_tx via RPC with anon client (no JWT)", () => {
    expect(SRC_30).toMatch(/\.rpc\("nex_invite_to_call_tx"/);
    // The anon client is built WITHOUT the Authorization header
    const clientBuild = SRC_30.match(/createClient\(supabaseUrl, anonKey,[^)]*\)/);
    expect(clientBuild).toBeTruthy();
    expect(clientBuild[0]).not.toMatch(/Authorization/);
  });

  it("asserts ACL-level block codes (42501, 42883, PGRST301)", () => {
    expect(SRC_30).toContain('"42501"');
    expect(SRC_30).toContain('"42883"');
    expect(SRC_30).toContain('"PGRST301"');
  });

  it("FAILs if anon receives data (REVOKE not effective)", () => {
    expect(SRC_30).toMatch(/REVOKE.*NOT.*effective/i);
    expect(SRC_30).toMatch(/verdict: "FAIL"/);
  });

  it("negative: unexpected error code → FAIL (does not silently pass)", () => {
    const unexpectedBranch = SRC_30.match(/FAIL: unexpected error code[\s\S]{0,400}/);
    expect(unexpectedBranch).toBeTruthy();
    expect(unexpectedBranch[0]).toMatch(/exit\(1\)/);
  });
});

describe("40_v_w1_new — V-W1-NEW", () => {
  it("has common invariants", () => expectCommonInvariants(SRC_40, "40"));

  it("calls nex_invite_to_call_tx with p_existing_session_id=null (new session)", () => {
    expect(SRC_40).toMatch(/\.rpc\("nex_invite_to_call_tx"/);
    expect(SRC_40).toMatch(/p_existing_session_id:\s*null/);
  });

  it("asserts on the 5-column return shape", () => {
    expect(SRC_40).toMatch(/out_session_id present/);
    expect(SRC_40).toMatch(/out_participant_id present/);
    expect(SRC_40).toMatch(/out_conversation_id present/);
    expect(SRC_40).toMatch(/out_message_id present/);
    expect(SRC_40).toMatch(/out_skipped is null/);
  });

  it("verifies downstream row shape (session.state=ringing, participant, message)", () => {
    expect(SRC_40).toMatch(/session state=ringing/);
    expect(SRC_40).toMatch(/pass: sess\?\.state === "ringing"/);
    expect(SRC_40).toMatch(/participant role=guest/);
    expect(SRC_40).toMatch(/attachment_type=call_invite/);
  });

  it("records EXACT IDs to retained_rows (no prefix, no table ref)", () => {
    expect(SRC_40).toMatch(/nex_group_call_session:\s*\[row\.out_session_id\]/);
    expect(SRC_40).toMatch(/nex_group_call_participant:\s*\[row\.out_participant_id\]/);
    expect(SRC_40).toMatch(/nex_peer_conversation:\s*\[row\.out_conversation_id\]/);
    expect(SRC_40).toMatch(/nex_peer_message:\s*\[row\.out_message_id\]/);
  });

  it("negative: empty rowset → FAIL exit 1", () => {
    expect(SRC_40).toMatch(/empty rowset[\s\S]{0,200}verdict: "FAIL"/);
    expect(SRC_40).toMatch(/exit\(1\)/);
  });

  it("negative: any check failure → FAIL (checks.every semantic)", () => {
    expect(SRC_40).toMatch(/const allPass = checks\.every\(c => c\.pass\)/);
    expect(SRC_40).toMatch(/verdict: allPass \? "PASS" : "FAIL"/);
  });

  it("stdout emitted JSON line never includes password/jwt", () => {
    // Inspect the final console.log(JSON.stringify({...})) — anchor on the LAST
    // console.log in the file (the structured verdict emit).
    const lastEmitIdx = SRC_40.lastIndexOf("console.log(JSON.stringify({");
    expect(lastEmitIdx).toBeGreaterThan(0);
    const after = SRC_40.slice(lastEmitIdx);
    // Terminates at the first `}));` after that console.log.
    const endIdx = after.indexOf("}));");
    expect(endIdx).toBeGreaterThan(0);
    const emitBlock = after.slice(0, endIdx);
    expect(emitBlock).not.toMatch(/password/i);
    expect(emitBlock).not.toMatch(/\bjwt\b/i);
    expect(emitBlock).not.toMatch(/access_token/);
  });
});

describe("50_v_w2_ok — V-W2-OK", () => {
  it("has common invariants", () => expectCommonInvariants(SRC_50, "50"));

  it("calls nex_create_group_call_session_tx with host A + invitees [B,C]", () => {
    expect(SRC_50).toMatch(/\.rpc\("nex_create_group_call_session_tx"/);
    expect(SRC_50).toMatch(/p_invitee_account_ids:\s*\[idB\.nex_account_id,\s*idC\.nex_account_id\]/);
  });

  it("asserts participants.length === 3 (host + B + C)", () => {
    expect(SRC_50).toMatch(/pass: participants\.length === 3/);
  });

  it("asserts host role=host, guest role=guest, joined_at semantics", () => {
    expect(SRC_50).toMatch(/host role=host/);
    expect(SRC_50).toMatch(/guest B role=guest/);
    expect(SRC_50).toMatch(/guest C role=guest/);
    expect(SRC_50).toMatch(/host joined_at set/);
    expect(SRC_50).toMatch(/guest B joined_at null/);
    expect(SRC_50).toMatch(/guest C joined_at null/);
  });

  it("asserts out_rejected_count=0 and session state=ringing", () => {
    expect(SRC_50).toMatch(/out_rejected_count=0/);
    expect(SRC_50).toMatch(/session state=ringing/);
  });

  it("negative: 42883 (function not found) → BLOCKED, not PASS", () => {
    expect(SRC_50).toMatch(/error\.code === "42883"[\s\S]{0,400}verdict: "BLOCKED"/);
  });

  it("records EXACT session + participant IDs for cleanup (no prefix)", () => {
    expect(SRC_50).toMatch(/nex_group_call_session:\s*\[row\.out_session_id\]/);
    expect(SRC_50).toMatch(/nex_group_call_participant:\s*retainedParticipants/);
    expect(SRC_50).toMatch(/retainedParticipants = participants\.map\(p => p\.id\)\.filter\(Boolean\)/);
  });

  it("BLOCKED when A/B/C identities missing from capture — does not silently succeed", () => {
    expect(SRC_50).toMatch(/need A, B, C/);
    expect(SRC_50).toMatch(/verdict: "BLOCKED"/);
  });
});

describe("Cross-script invariants (identity capture consumption)", () => {
  it("40_v_w1_new.mjs, 50_v_w2_ok.mjs, 30_v_auth_null.mjs all share production-refusal pattern", () => {
    for (const [name, s] of [["30", SRC_30], ["40", SRC_40], ["50", SRC_50]]) {
      expect(s, `${name}: refuses production`).toMatch(/includes\(PRODUCTION_REF\)/);
    }
  });

  it("40 and 50 read identity capture via existsSync guard (not assume)", () => {
    expect(SRC_40).toMatch(/if \(!existsSync\(IDENTITY_CAPTURE_FILE\)\)/);
    expect(SRC_50).toMatch(/if \(!existsSync\(IDENTITY_CAPTURE_FILE\)\)/);
  });

  it("40 and 50 sign-in via GATE_A_TEST_PASSWORD_{label} env var only (not from capture file)", () => {
    expect(SRC_40).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
    expect(SRC_50).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
  });
});
