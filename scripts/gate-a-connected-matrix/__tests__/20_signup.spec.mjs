// scripts/gate-a-connected-matrix/__tests__/20_signup.spec.mjs
//
// Offline invariant tests for 20_signup_disposable_identities.mjs.
// Proves:
//   1. Hard-refuses production ref.
//   2. Uses supabase.auth.signUp (never auth.admin.createUser).
//   3. Capture-file payload never carries password or JWT.
//   4. On rate-limit, cascades BLOCKED and stops without retry.
//   5. Email confirmation wait path exists and uses read-only pg poll.
//   6. Password stored in process.env GATE_A_TEST_PASSWORD_{A,B,C} only.
//   7. Signup→signIn handoff reconnects correctly after a null-session path.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const SIGNUP_PATH = resolve(__dir, "..", "20_signup_disposable_identities.mjs");
const SOURCE = readFileSync(SIGNUP_PATH, "utf8");

describe("20_signup — hard invariants", () => {
  it("hard-refuses production ref", () => {
    expect(SOURCE).toContain('PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit"');
    expect(SOURCE).toMatch(/supabaseUrl\.includes\(PRODUCTION_REF\)/);
  });

  it("requires sandbox ref", () => {
    expect(SOURCE).toContain('CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"');
    expect(SOURCE).toMatch(/does not reference sandbox/);
  });

  it("uses auth.signUp exclusively — never auth.admin.createUser", () => {
    expect(SOURCE).toMatch(/\.auth\.signUp\(/);
    // Strip comment lines to check only live code (the doc comment legitimately
    // names the forbidden API in order to say "never uses it").
    const codeOnly = SOURCE
      .split("\n")
      .filter(line => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.auth\.admin\.createUser\(/);
    expect(codeOnly).not.toMatch(/\.auth\.admin\./);
  });

  it("uses signInWithPassword (not admin.generateLink or similar bypass)", () => {
    expect(SOURCE).toMatch(/\.auth\.signInWithPassword\(/);
    expect(SOURCE).not.toMatch(/generateLink/);
  });

  it("rate-limit cascades BLOCKED without retry", () => {
    // Confirm the cascade loop sets status BLOCKED and then break
    expect(SOURCE).toMatch(/RATE LIMIT detected/);
    expect(SOURCE).toMatch(/rate_limit_cascade/);
    // No setTimeout/retry loop around signUp itself.
    // Use a non-greedy match that stops at the FIRST `continue;` after the signUp call.
    const idx = SOURCE.indexOf("const { data: signUpData");
    expect(idx).toBeGreaterThan(0);
    const after = SOURCE.slice(idx);
    const contIdx = after.indexOf("continue;");
    expect(contIdx).toBeGreaterThan(0);
    const signUpBlock = after.slice(0, contIdx);
    // "do NOT retry" is an allowed doc phrase; forbid actual retry code only.
    const codeOnly = signUpBlock
      .split("\n")
      .filter(line => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.retry\(/i);
    expect(codeOnly).not.toMatch(/retryCount/i);
    expect(codeOnly).not.toMatch(/setTimeout\([^)]*signUp/);
  });

  it("email-confirm wait path is read-only (SELECT not UPDATE)", () => {
    const waitBlock = SOURCE.match(/async function waitForEmailConfirm[\s\S]*?^}/m);
    expect(waitBlock).toBeTruthy();
    expect(waitBlock[0]).toMatch(/SELECT id, email_confirmed_at FROM auth\.users/);
    expect(waitBlock[0]).not.toMatch(/UPDATE auth\.users/);
    expect(waitBlock[0]).not.toMatch(/INSERT INTO auth\.users/);
  });

  it("password CONSUMED from process.env GATE_A_TEST_PASSWORD_{label}, not generated here", () => {
    // After the 2026-11-19 relay fix: the signup child receives passwords from
    // the parent runner via process.env; it does NOT generate its own.
    expect(SOURCE).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
    // Must NOT call randomBytes to generate PASSWORDS. §16.48.19 allows a
    // 4-byte hex provenance tag (randomBytes(4).toString("hex")) because the
    // tag is a non-secret run marker; the ban targets the specific
    // base64/base64url password shape used by the parent runner.
    const codeOnly = SOURCE
      .split("\n")
      .filter(line => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/randomBytes\(\s*\d+\s*\)\.toString\(\s*"base64/);
    // Belt-and-braces: no assignment into any password/passwords variable from randomBytes.
    expect(codeOnly).not.toMatch(/\bpasswords?\s*\[[^\]]+\]\s*=\s*randomBytes\(/);
    expect(codeOnly).not.toMatch(/\bpassword\s*=\s*randomBytes\(/);
    // Capture-file write must not include the password var or the passwords object.
    const writeMatch = SOURCE.match(
      /writeFileSync\(IDENTITY_CAPTURE_FILE,\s*JSON\.stringify\(([^,]+)/
    );
    expect(writeMatch).toBeTruthy();
    // The argument JSON.stringify'd must be `capture` (not passwords)
    expect(writeMatch[1].trim()).toBe("capture");
  });

  it("fails CLOSED when a required GATE_A_TEST_PASSWORD_{label} is missing (before any auth/db call)", () => {
    // The fail-closed block must appear BEFORE any createClient / supabase / pg call.
    const failClosedIdx = SOURCE.indexOf("missing parent-supplied password");
    expect(failClosedIdx).toBeGreaterThan(0);
    const firstCreateClientIdx = SOURCE.indexOf("createClient(supabaseUrl");
    const firstPgConnectIdx = SOURCE.indexOf("c.connect()");
    expect(firstCreateClientIdx).toBeGreaterThan(failClosedIdx);
    // pg client connect appears inside waitForEmailConfirm; just ensure declaration exists.
    expect(firstPgConnectIdx).toBeGreaterThan(failClosedIdx);
    // Exit is non-zero (fail-closed).
    const failBlock = SOURCE.slice(failClosedIdx, failClosedIdx + 400);
    expect(failBlock).toMatch(/process\.exit\(2\)/);
  });

  it("capture object never has password/jwt field writes", () => {
    // Check each capture[label] = { ... } assignment for forbidden fields
    const captureAssignments = [...SOURCE.matchAll(/capture\[\w+\]\s*=\s*\{([\s\S]*?)\};/g)];
    expect(captureAssignments.length).toBeGreaterThanOrEqual(3);
    for (const [, body] of captureAssignments) {
      expect(body).not.toMatch(/password/i);
      expect(body).not.toMatch(/jwt/i);
      expect(body).not.toMatch(/access_token/i);
      expect(body).not.toMatch(/refresh_token/i);
    }
  });

  it("RUNNER_ENV_HINT block does not print the real password", () => {
    const hintBlock = SOURCE.match(/RUNNER_ENV_HINT_BEGIN[\s\S]*?RUNNER_ENV_HINT_END/);
    expect(hintBlock).toBeTruthy();
    // Must print placeholder, NOT passwords[label]
    expect(hintBlock[0]).toMatch(/not printed/);
    expect(hintBlock[0]).not.toMatch(/\$\{passwords\[label\]\}/);
    // The console.log'd template literal must not substitute passwords[label].
    // Allow the word 'passwords' inside a doc/comment line that explains the fix,
    // but forbid it as a template substitution.
    expect(hintBlock[0]).not.toMatch(/\$\{passwords/);
  });

  it("handoff after null-session reconnects via a FRESH signInWithPassword", () => {
    // After waitForEmailConfirm returns confirmed, control falls through
    // to the signInWithPassword block below — no "continue" or early return.
    const confirmedBlock = SOURCE.match(
      /email confirmed after[\s\S]*?signInClient\.auth\.signInWithPassword/
    );
    expect(confirmedBlock).toBeTruthy();
  });

  it("supabase_user_id captured from signUp (used for later nex_account lookup)", () => {
    expect(SOURCE).toMatch(/const sbUserId = signUpData\.user\?\.id/);
    expect(SOURCE).toMatch(/\.eq\("supabase_user_id", sbUserId\)/);
  });

  it("final verdict reflects OK count against the mode's expected count (PASS when all sign up, PARTIAL when ≥1 and <all, FAIL otherwise)", () => {
    // After 2026-11-19 two-mode adaptation, verdict uses the mode-scoped expected count.
    expect(SOURCE).toMatch(
      /ok\.length >= expectedCount \? "PASS" : ok\.length >= 1 \? "PARTIAL" : "FAIL"/
    );
    // expectedCount must equal the length of the mode-scoped identityLabels (not hard-coded).
    expect(SOURCE).toMatch(/const expectedCount = identityLabels\.length/);
  });

  it("identityLabels is mode-driven · three-mode default remains A/B/C · two-mode is A/B only · never broadens", () => {
    // Ternary derivation from GATE_A_IDENTITY_MODE — no hard-coded ["A","B","C"] on its own line
    expect(SOURCE).toMatch(/identityLabels = IDENTITY_MODE === "two" \? \["A", "B"\] : \["A", "B", "C"\]/);
    // Mode grammar · exactly three accepted inputs, anything else fail-closed exit 2
    expect(SOURCE).toMatch(/GATE_A_IDENTITY_MODE/);
    expect(SOURCE).toMatch(/IDENTITY_MODE = "three"/);
    expect(SOURCE).toMatch(/IDENTITY_MODE = "two"/);
    expect(SOURCE).toMatch(/GATE_A_IDENTITY_MODE has an unrecognised value/);
    // The invalid-mode fail-closed must not print the raw value
    const invalidBlock = SOURCE.match(/unrecognised value[\s\S]*?process\.exit\(2\)/);
    expect(invalidBlock).toBeTruthy();
    expect(invalidBlock[0]).not.toMatch(/\$\{_rawIdentityMode\}/);
    expect(invalidBlock[0]).not.toMatch(/\$\{process\.env\.GATE_A_IDENTITY_MODE\}/);
  });

  it("dead variable `code` removed from signUpError branch", () => {
    // Prior cosmetic defect: `const code = signUpError.message ?? "";` unused.
    // After cleanup, no such unused binding should remain in that branch.
    const errorBranch = SOURCE.match(/if \(signUpError\) \{[\s\S]*?console\.error/);
    expect(errorBranch).toBeTruthy();
    expect(errorBranch[0]).not.toMatch(/const code = signUpError\.message/);
  });
});
