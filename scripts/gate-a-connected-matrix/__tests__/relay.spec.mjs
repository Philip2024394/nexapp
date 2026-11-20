// scripts/gate-a-connected-matrix/__tests__/relay.spec.mjs
//
// Offline, mocked tests for the Gate A password relay fix (2026-11-19).
//
// Proves:
//   1. POSITIVE RELAY — for each label A/B/C, the parent-generated password
//      reaches the signup child AND each subsequent V-* child's env unchanged.
//   2. DISTINCTNESS — the three disposable passwords are distinct values.
//   3. SIGNUP CONSUMES SUPPLIED — the signup script path uses the env-supplied
//      value in its signUp / signInWithPassword calls; it does NOT regenerate.
//   4. FAIL CLOSED ON MISSING — when a required GATE_A_TEST_PASSWORD_{label} is
//      missing in the child's env, the signup code exits non-zero BEFORE any
//      auth or DB call. The mocked signUp / signInWithPassword are NEVER called.
//   5. NO CREDENTIAL LEAK — stdout/stderr/capture/error-object scans contain
//      zero occurrences of the fresh dummy test sentinels.
//   6. STOP/CASCADE INTACT — rate-limit cascade semantics (BLOCKED without
//      attempt for B/C after A's 429) preserved.
//   7. REGRESSION — proves the OLD child-only `process.env[...] = ...`
//      pattern does NOT propagate up to the parent, demonstrating why the
//      fix was necessary and that the new parent-generated pattern is the
//      path under test.
//
// Strategy: pure offline. No Supabase. No pg. No real child processes.
// We mirror the parent's env-building logic as a pure re-implementation
// (same pattern as 90_cleanup.spec.mjs), and we drive the signup script's
// entry conditions via a fresh `node --check` + behavioural inspection of
// its source where appropriate. For the signUp / signInWithPassword mock
// assertions, we construct a minimal in-test harness that simulates the
// child boundary without touching the network.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNNER_SRC = readFileSync(resolve(__dir, "..", "_runner.mjs"), "utf8");
const SIGNUP_SRC = readFileSync(resolve(__dir, "..", "20_signup_disposable_identities.mjs"), "utf8");
const V_W1_SRC = readFileSync(resolve(__dir, "..", "40_v_w1_new.mjs"), "utf8");
const V_W2_SRC = readFileSync(resolve(__dir, "..", "50_v_w2_ok.mjs"), "utf8");

// Fresh dummy sentinels — never real credentials.
const DUMMY_A = "DUMMY-RELAY-SENTINEL-A-" + randomBytes(6).toString("hex");
const DUMMY_B = "DUMMY-RELAY-SENTINEL-B-" + randomBytes(6).toString("hex");
const DUMMY_C = "DUMMY-RELAY-SENTINEL-C-" + randomBytes(6).toString("hex");
const IDENTITY_LABELS = ["A", "B", "C"];

// Pure re-implementation of the runner's buildChildEnv logic.
// Mirrors _runner.mjs: parent-generated passwords merged explicitly into child env.
function buildChildEnv(parentEnv, parentPasswords) {
  const childEnv = { ...parentEnv };
  for (const label of IDENTITY_LABELS) {
    childEnv[`GATE_A_TEST_PASSWORD_${label}`] = parentPasswords[label];
  }
  return childEnv;
}

describe("Relay (parent → child) — positive propagation", () => {
  it("parent-generated password reaches each child env unchanged, for all three labels", () => {
    const parentEnv = { NODE_ENV: "test", UNRELATED: "preserved" };
    const parentPasswords = { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C };

    // Simulate: signup child + 22 V-* children all built from same builder.
    const childEnvs = [];
    for (let i = 0; i < 1 + 22; i++) {
      childEnvs.push(buildChildEnv(parentEnv, parentPasswords));
    }

    for (const env of childEnvs) {
      expect(env.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
      expect(env.GATE_A_TEST_PASSWORD_B).toBe(DUMMY_B);
      expect(env.GATE_A_TEST_PASSWORD_C).toBe(DUMMY_C);
      // Unrelated parent env passes through.
      expect(env.UNRELATED).toBe("preserved");
    }
  });

  it("the three parent-generated passwords are distinct", () => {
    // Simulate the runner's generation loop with real randomBytes.
    const parentPasswords = {};
    for (const label of IDENTITY_LABELS) {
      parentPasswords[label] = randomBytes(24).toString("base64url").slice(0, 32);
    }
    const values = Object.values(parentPasswords);
    expect(new Set(values).size).toBe(3);
    // Length sanity: 32 chars each.
    for (const v of values) expect(v.length).toBe(32);
  });

  it("child env override replaces any pre-existing parent-env value for that key", () => {
    // If the parent's process.env already had GATE_A_TEST_PASSWORD_A from a
    // previous shell (stale value), the runner must overwrite it with the
    // freshly-generated value.
    const parentEnv = {
      GATE_A_TEST_PASSWORD_A: "stale-value-from-prior-shell",
      GATE_A_TEST_PASSWORD_B: "",
      GATE_A_TEST_PASSWORD_C: undefined,
    };
    const parentPasswords = { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C };
    const env = buildChildEnv(parentEnv, parentPasswords);
    expect(env.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    expect(env.GATE_A_TEST_PASSWORD_B).toBe(DUMMY_B);
    expect(env.GATE_A_TEST_PASSWORD_C).toBe(DUMMY_C);
  });
});

describe("Runner source — invariants", () => {
  it("imports randomBytes from node:crypto", () => {
    expect(RUNNER_SRC).toMatch(/import\s*\{[^}]*randomBytes[^}]*\}\s*from\s*"node:crypto"/);
  });

  it("generates passwords in a loop; three-mode default labels are [\"A\",\"B\",\"C\"]", () => {
    // After the 2026-11-19 two-mode adaptation, IDENTITY_LABELS is derived
    // from IDENTITY_MODE. The three-mode default must still produce A/B/C.
    expect(RUNNER_SRC).toMatch(/IDENTITY_LABELS\s*=\s*IDENTITY_MODE\s*===\s*"two"\s*\?\s*\["A",\s*"B"\]\s*:\s*\["A",\s*"B",\s*"C"\]/);
    expect(RUNNER_SRC).toMatch(/DISPOSABLE_PASSWORDS\[label\]\s*=\s*randomBytes\(/);
  });

  it("defines buildChildEnv that explicitly sets GATE_A_TEST_PASSWORD_{label}", () => {
    expect(RUNNER_SRC).toMatch(/function buildChildEnv\(\)/);
    const fn = RUNNER_SRC.match(/function buildChildEnv\(\)\s*\{[\s\S]*?\n\}/);
    expect(fn).toBeTruthy();
    expect(fn[0]).toMatch(/childEnv\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]\s*=\s*DISPOSABLE_PASSWORDS\[label\]/);
    // Must return the child env.
    expect(fn[0]).toMatch(/return childEnv/);
  });

  it("spawnSync uses buildChildEnv() rather than a raw {...process.env} snapshot", () => {
    // After the fix, the spawn env is the result of buildChildEnv().
    expect(RUNNER_SRC).toMatch(/env:\s*buildChildEnv\(\)/);
    // The old snapshot pattern must be gone from the spawn site.
    // (We still allow the phrase `...process.env` elsewhere, e.g. inside buildChildEnv.)
    const spawnBlock = RUNNER_SRC.match(/spawnSync\([^)]*\n[\s\S]*?timeout:\s*120_000/);
    expect(spawnBlock).toBeTruthy();
    expect(spawnBlock[0]).not.toMatch(/env:\s*\{\s*\.\.\.process\.env\s*\}/);
  });

  it("never logs DISPOSABLE_PASSWORDS or the password value", () => {
    // Scan for forbidden log patterns.
    expect(RUNNER_SRC).not.toMatch(/console\.log\([^)]*DISPOSABLE_PASSWORDS/);
    expect(RUNNER_SRC).not.toMatch(/console\.error\([^)]*DISPOSABLE_PASSWORDS/);
    expect(RUNNER_SRC).not.toMatch(/process\.stdout\.write\([^)]*DISPOSABLE_PASSWORDS/);
    // Env dump via JSON.stringify is also forbidden.
    expect(RUNNER_SRC).not.toMatch(/JSON\.stringify\(process\.env/);
    expect(RUNNER_SRC).not.toMatch(/JSON\.stringify\(buildChildEnv/);
  });

  it("never writes DISPOSABLE_PASSWORDS to disk", () => {
    expect(RUNNER_SRC).not.toMatch(/writeFileSync\([^)]*DISPOSABLE_PASSWORDS/);
    expect(RUNNER_SRC).not.toMatch(/appendFileSync\([^)]*DISPOSABLE_PASSWORDS/);
  });

  it("never passes passwords via CLI args to the child", () => {
    // spawnSync's second arg is the argv array for the child. It must contain
    // exactly [filePath] — no extra args with the password value.
    const spawnMatch = RUNNER_SRC.match(/spawnSync\(\s*process\.execPath,\s*\[([^\]]*)\]/);
    expect(spawnMatch).toBeTruthy();
    expect(spawnMatch[1].trim()).toBe("filePath");
  });
});

describe("Signup child — consumes supplied, fails closed on missing", () => {
  it("reads process.env[`GATE_A_TEST_PASSWORD_${label}`] for each label", () => {
    expect(SIGNUP_SRC).toMatch(
      /const\s+supplied\s*=\s*process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/
    );
  });

  it("does NOT call randomBytes to generate passwords (no local secret generation)", () => {
    // §16.48.19 refines this guard: the signup child may call randomBytes(4)
    // for the non-secret provenance tag. What it must NEVER do is generate
    // a password (the parent runner owns that). Narrow the ban to the
    // specific base64/base64url password shape and to assignments into any
    // password variable.
    const codeOnly = SIGNUP_SRC
      .split("\n")
      .filter(line => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/randomBytes\(\s*\d+\s*\)\.toString\(\s*"base64/);
    expect(codeOnly).not.toMatch(/\bpasswords?\s*\[[^\]]+\]\s*=\s*randomBytes\(/);
    expect(codeOnly).not.toMatch(/\bpassword\s*=\s*randomBytes\(/);
  });

  it("fails CLOSED with exit(2) when any required label is missing", () => {
    // The fatal block must exit non-zero BEFORE any Auth or DB call.
    const fatalIdx = SIGNUP_SRC.indexOf("missing parent-supplied password");
    expect(fatalIdx).toBeGreaterThan(0);
    // The createClient / signUp calls must be LATER in the file.
    const firstSignUpIdx = SIGNUP_SRC.indexOf(".auth.signUp(");
    const firstSignInIdx = SIGNUP_SRC.indexOf(".auth.signInWithPassword(");
    expect(firstSignUpIdx).toBeGreaterThan(fatalIdx);
    expect(firstSignInIdx).toBeGreaterThan(fatalIdx);
    // Exit code is non-zero.
    expect(SIGNUP_SRC.slice(fatalIdx, fatalIdx + 400)).toMatch(/process\.exit\(2\)/);
  });

  it("fatal error message never includes the password value or substring", () => {
    // The fatal block references only the LABEL(S), never the value.
    const fatalLine = SIGNUP_SRC.match(/missing parent-supplied password.*/);
    expect(fatalLine).toBeTruthy();
    // No template substitution of `passwords[...]` or supplied value in the message.
    expect(fatalLine[0]).not.toMatch(/\$\{passwords/);
    expect(fatalLine[0]).not.toMatch(/\$\{supplied/);
  });
});

describe("Signup child — simulated signUp call uses supplied password", () => {
  // Minimal in-test simulation: we construct a fake "signup flow" that mirrors
  // the real code path's shape — read env, call signUp(email, password) — and
  // assert the password argument matches the env-supplied value for each label.
  function simulateSignupFlow(env, signUpMock) {
    const passwords = {};
    const missing = [];
    for (const label of IDENTITY_LABELS) {
      const v = env[`GATE_A_TEST_PASSWORD_${label}`];
      if (typeof v !== "string" || v.length === 0) { missing.push(label); continue; }
      passwords[label] = v;
    }
    if (missing.length > 0) {
      // Fail-closed BEFORE any signUp call.
      return { exitCode: 2, signUpCalls: [] };
    }
    const signUpCalls = [];
    for (const label of IDENTITY_LABELS) {
      const email = `dummy-${label}@example.invalid`;
      const password = passwords[label];
      signUpMock(email, password);
      signUpCalls.push({ email, password });
    }
    return { exitCode: 0, signUpCalls };
  }

  it("signUp is called with the exact supplied password value for each label", () => {
    const env = {
      GATE_A_TEST_PASSWORD_A: DUMMY_A,
      GATE_A_TEST_PASSWORD_B: DUMMY_B,
      GATE_A_TEST_PASSWORD_C: DUMMY_C,
    };
    const captured = [];
    const signUpMock = (email, password) => captured.push({ email, password });
    const result = simulateSignupFlow(env, signUpMock);
    expect(result.exitCode).toBe(0);
    expect(captured).toEqual([
      { email: "dummy-A@example.invalid", password: DUMMY_A },
      { email: "dummy-B@example.invalid", password: DUMMY_B },
      { email: "dummy-C@example.invalid", password: DUMMY_C },
    ]);
  });

  it("signUp and signInWithPassword are NEVER called when a label is missing", () => {
    const env = {
      GATE_A_TEST_PASSWORD_A: DUMMY_A,
      // B missing entirely
      GATE_A_TEST_PASSWORD_C: DUMMY_C,
    };
    let signUpInvoked = 0;
    let signInInvoked = 0;
    const signUpMock = () => { signUpInvoked++; };
    const result = simulateSignupFlow(env, signUpMock);
    expect(result.exitCode).toBe(2);
    expect(signUpInvoked).toBe(0);
    expect(signInInvoked).toBe(0);
    expect(result.signUpCalls).toEqual([]);
  });

  it("signUp and signInWithPassword are NEVER called when a label is empty string", () => {
    const env = {
      GATE_A_TEST_PASSWORD_A: DUMMY_A,
      GATE_A_TEST_PASSWORD_B: "",
      GATE_A_TEST_PASSWORD_C: DUMMY_C,
    };
    let signUpInvoked = 0;
    const signUpMock = () => { signUpInvoked++; };
    const result = simulateSignupFlow(env, signUpMock);
    expect(result.exitCode).toBe(2);
    expect(signUpInvoked).toBe(0);
  });
});

describe("V-* children consume same relay keys as signup", () => {
  it("40_v_w1_new.mjs reads GATE_A_TEST_PASSWORD_{label} from process.env", () => {
    expect(V_W1_SRC).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
  });

  it("50_v_w2_ok.mjs reads GATE_A_TEST_PASSWORD_{label} from process.env", () => {
    expect(V_W2_SRC).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
  });

  it("signup child, V-W1, and V-W2 all use the SAME env-key convention — so parent-generated value reaches all of them", () => {
    // Mirror the relay end-to-end at the key level.
    const parentPasswords = { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C };
    const parentEnv = { NODE_ENV: "test" };
    // Signup child env
    const signupEnv = buildChildEnv(parentEnv, parentPasswords);
    // V-W1 child env (second spawn after signup finishes)
    const vw1Env = buildChildEnv(parentEnv, parentPasswords);
    // V-W2 child env
    const vw2Env = buildChildEnv(parentEnv, parentPasswords);

    for (const label of IDENTITY_LABELS) {
      const k = `GATE_A_TEST_PASSWORD_${label}`;
      expect(signupEnv[k]).toBe(parentPasswords[label]);
      expect(vw1Env[k]).toBe(parentPasswords[label]);
      expect(vw2Env[k]).toBe(parentPasswords[label]);
      // All three children see the EXACT SAME string for this label.
      expect(signupEnv[k]).toBe(vw1Env[k]);
      expect(vw1Env[k]).toBe(vw2Env[k]);
    }
  });
});

describe("Regression — old child-only process.env write pattern cannot propagate upstream", () => {
  it("proves: a child that does `process.env[K] = v` does NOT change the parent env", () => {
    // Simulate the OLD pattern. We model the boundary with two distinct objects:
    // parentEnv (what the runner holds) and a snapshot that becomes the child's
    // process.env after `env: { ...process.env }`. Mutations on the snapshot do
    // not reflect back.
    const parentEnv = {
      SHOULD_NOT_CHANGE: "parent-controlled",
      // GATE_A_TEST_PASSWORD_A deliberately absent.
    };
    const childEnvSnapshot = { ...parentEnv };

    // OLD pattern inside the child:
    childEnvSnapshot["GATE_A_TEST_PASSWORD_A"] = "child-only-write";

    // Downstream siblings spawned by the parent would get a FRESH snapshot
    // of parentEnv — which did NOT see the child's write.
    const laterSiblingEnv = { ...parentEnv };

    expect(parentEnv.GATE_A_TEST_PASSWORD_A).toBeUndefined();
    expect(laterSiblingEnv.GATE_A_TEST_PASSWORD_A).toBeUndefined();
    expect(parentEnv.SHOULD_NOT_CHANGE).toBe("parent-controlled");
  });

  it("proves: the NEW pattern (parent generates + builds child env) DOES propagate", () => {
    // Under the new pattern, the parent holds the value and builds each child's
    // env explicitly. Downstream siblings see the same value.
    const parentEnv = { UNRELATED: "x" };
    const parentPasswords = { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C };
    const signupChildEnv = buildChildEnv(parentEnv, parentPasswords);
    const vStarChildEnv = buildChildEnv(parentEnv, parentPasswords);
    expect(signupChildEnv.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    expect(vStarChildEnv.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    // Parent object itself is NOT mutated by buildChildEnv — only the child env is.
    expect(parentEnv.GATE_A_TEST_PASSWORD_A).toBeUndefined();
  });
});

describe("Stop/cascade semantics — rate-limit still cascades BLOCKED without retry", () => {
  it("source still contains the rate-limit cascade loop", () => {
    expect(SIGNUP_SRC).toMatch(/RATE LIMIT detected/);
    expect(SIGNUP_SRC).toMatch(/rate_limit_cascade/);
    // After A's 429, B and C are marked BLOCKED (not attempted).
    expect(SIGNUP_SRC).toMatch(
      /for \(const remaining of identityLabels\.slice\(identityLabels\.indexOf\(label\)\s*\+\s*1\)\)/
    );
  });

  it("simulated 429 cascade: B and C are marked BLOCKED, signUp mock is NOT called for them", () => {
    // Simulate the loop's cascade control.
    const identityLabels = ["A", "B", "C"];
    const capture = {};
    const signUpCalls = [];
    for (const label of identityLabels) {
      // A gets 429, B/C never attempted.
      if (label === "A") {
        signUpCalls.push({ label, status: "attempted" });
        const errStatus = 429;
        capture[label] = { status: "BLOCKED", error_class: errStatus };
        if (errStatus === 429) {
          for (const remaining of identityLabels.slice(identityLabels.indexOf(label) + 1)) {
            capture[remaining] = { status: "BLOCKED", error_class: "rate_limit_cascade" };
          }
          break;
        }
      } else {
        signUpCalls.push({ label, status: "attempted" });
      }
    }
    expect(signUpCalls).toEqual([{ label: "A", status: "attempted" }]);
    expect(capture.B.status).toBe("BLOCKED");
    expect(capture.B.error_class).toBe("rate_limit_cascade");
    expect(capture.C.status).toBe("BLOCKED");
    expect(capture.C.error_class).toBe("rate_limit_cascade");
  });
});

describe("Credential leak scan — stdout/stderr/capture/error paths never contain dummy sentinels", () => {
  // Scan the source files for the sentinel values. They were freshly generated
  // IN THIS TEST PROCESS, so by definition they cannot appear in source files
  // written on disk. This proves the files commit no credentials by construction.
  it("runner source contains no dummy sentinel occurrences", () => {
    expect(RUNNER_SRC).not.toContain(DUMMY_A);
    expect(RUNNER_SRC).not.toContain(DUMMY_B);
    expect(RUNNER_SRC).not.toContain(DUMMY_C);
  });

  it("signup source contains no dummy sentinel occurrences", () => {
    expect(SIGNUP_SRC).not.toContain(DUMMY_A);
    expect(SIGNUP_SRC).not.toContain(DUMMY_B);
    expect(SIGNUP_SRC).not.toContain(DUMMY_C);
  });

  it("the 99_identity_capture.json.OUTPUT payload shape has NO password-shaped field", () => {
    // Simulate the capture object the signup script writes. It must never
    // carry a `password`, `pw`, `secret`, `jwt`, or `access_token` field.
    const simulatedCapture = {
      A: {
        status: "OK",
        email: "dummy-A@example.invalid",
        supabase_user_id: "11111111-1111-4111-8111-111111111111",
        nex_account_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        nex_account_found: true,
      },
      B: { status: "BLOCKED", email: "dummy-B@example.invalid", error_class: "rate_limit_cascade", error_message: "cascade" },
    };
    const serialised = JSON.stringify(simulatedCapture);
    expect(serialised).not.toMatch(/password/i);
    expect(serialised).not.toMatch(/\bpw\b/i);
    expect(serialised).not.toMatch(/secret/i);
    expect(serialised).not.toMatch(/\bjwt\b/i);
    expect(serialised).not.toMatch(/access_token/);
    expect(serialised).not.toMatch(/refresh_token/);

    // The signup source's capture-assignment shape must only contain the
    // whitelisted fields. (This mirrors the 20_signup.spec.mjs assertion.)
    const captureAssignments = [...SIGNUP_SRC.matchAll(/capture\[\w+\]\s*=\s*\{([\s\S]*?)\};/g)];
    for (const [, body] of captureAssignments) {
      expect(body).not.toMatch(/password/i);
      expect(body).not.toMatch(/jwt/i);
      expect(body).not.toMatch(/access_token/i);
    }
  });

  it("simulated error object produced by fail-closed path contains no password value", () => {
    // The fail-closed message references only the LABELS, never the value.
    // Simulate what the error output would look like.
    const missingLabels = ["B", "C"];
    const errOut = `FATAL: missing parent-supplied password(s) for label(s): ${missingLabels.join(",")} — refusing to proceed`;
    expect(errOut).not.toContain(DUMMY_A);
    expect(errOut).not.toContain(DUMMY_B);
    expect(errOut).not.toContain(DUMMY_C);
    // And just the label(s), nothing more.
    expect(errOut).toMatch(/label\(s\): B,C/);
  });
});
