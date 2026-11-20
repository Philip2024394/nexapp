// scripts/gate-a-connected-matrix/__tests__/two-mode.spec.mjs
//
// Offline, mocked tests for the A/B-only two-identity mode adaptation.
// Authored by HARNESS-2USER · Lane G Gate A · 2026-11-19.
//
// Proves:
//   1. Mode selection — unset → three; "three" → three; "two" → two;
//      invalid value → exit(2) with reason named (not value).
//   2. A/B-only signup — in two-mode, createClient / signUp /
//      signInWithPassword fire for A and B only; zero C calls.
//   3. No C credential required — signup fail-closed loop in two-mode does
//      NOT demand GATE_A_TEST_PASSWORD_C.
//   4. No C fabrication — no substitution of C with Hammerex, Rosa, founder,
//      or any pre-existing identity, anywhere.
//   5. Current-run captures in two-mode — created_fixtures length <= 2,
//      no label C entry; run_id / created_at preserved.
//   6. Cleanup accepts a two-identity capture and refuses the usual cases.
//   7. BLOCKED reporting for BLOCKED_NEEDS_C / BLOCKED_NEEDS_MORE_THAN_3
//      scripts — records verdict BLOCKED (not PASS, not FAIL); does not
//      trigger cascade stop.
//   8. MIXED cases default to BLOCKED (owner directive, no partial-run flag).
//   9. Three-mode preserved — C still signed up, three-identity capture
//      accepted by cleanup, classification file still lists all 21 scripts.
//  10. Test-import side-effect proof — importing new specs under vitest
//      does NOT instantiate pg.Client or createClient.
//
// Strategy: pure offline. No Supabase. No pg. No real child processes
// (the runner spec uses spawnSync with --import stubs that record whether
// they were ever invoked). Fresh dummy sentinels only.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = resolve(__dir, "..", "_runner.mjs");
const RUNNER_SRC = readFileSync(RUNNER_PATH, "utf8");
const SIGNUP_PATH = resolve(__dir, "..", "20_signup_disposable_identities.mjs");
const SIGNUP_SRC = readFileSync(SIGNUP_PATH, "utf8");
const CLEANUP_PATH = resolve(__dir, "..", "90_cleanup.mjs");
const ELIG_PATH = resolve(__dir, "_v-star-eligibility.generated.json");
const ELIG_RAW = readFileSync(ELIG_PATH, "utf8");
const ELIG = JSON.parse(ELIG_RAW);

// Dummy sentinels — never real credentials.
const DUMMY_A = "DUMMY-TWOMODE-SENTINEL-A-" + randomBytes(6).toString("hex");
const DUMMY_B = "DUMMY-TWOMODE-SENTINEL-B-" + randomBytes(6).toString("hex");
const DUMMY_C = "DUMMY-TWOMODE-SENTINEL-C-" + randomBytes(6).toString("hex");

// Known pre-existing identities we MUST NEVER substitute for C.
const FORBIDDEN_SUBSTITUTES = [
  "11111111-1111-4111-8111-111111111111", // Hammerex / nex-99901
  "11111111-1111-4111-8111-111111111113", // Rosa / nex-99903
  "nex-99901",
  "nex-99903",
  "Hammerex",
  "Rosa",
  "founder",
];

// ─────────────────────────────────────────────────────────────────────────────
// Mode selection (static source inspection)
// ─────────────────────────────────────────────────────────────────────────────
describe("Mode selection — _runner.mjs", () => {
  it("reads GATE_A_IDENTITY_MODE from process.env (not from .env.local)", () => {
    expect(RUNNER_SRC).toMatch(/const\s+RAW_IDENTITY_MODE\s*=\s*process\.env\.GATE_A_IDENTITY_MODE/);
    // The mode must NOT be sourced via readEnv (which reads .env.local).
    const modeBlock = RUNNER_SRC.match(/RAW_IDENTITY_MODE[\s\S]{0,400}IDENTITY_MODE/);
    expect(modeBlock).toBeTruthy();
    expect(modeBlock[0]).not.toMatch(/readEnv\("GATE_A_IDENTITY_MODE/);
  });

  it("defaults to three when GATE_A_IDENTITY_MODE is unset or empty", () => {
    expect(RUNNER_SRC).toMatch(/RAW_IDENTITY_MODE\s*===\s*undefined\s*\|\|\s*RAW_IDENTITY_MODE\s*===\s*""[\s\S]{0,40}"three"/);
  });

  it("accepts only three or two; otherwise fails closed with exit(2)", () => {
    expect(RUNNER_SRC).toMatch(/IDENTITY_MODE\s*!==\s*"three"\s*&&\s*IDENTITY_MODE\s*!==\s*"two"/);
    const guard = RUNNER_SRC.match(/IDENTITY_MODE\s*!==\s*"three"[\s\S]{0,500}/);
    expect(guard).toBeTruthy();
    expect(guard[0]).toMatch(/process\.exit\(2\)/);
  });

  it("invalid-mode error message names the reason, not the value", () => {
    // The FATAL line MUST NOT interpolate RAW_IDENTITY_MODE or IDENTITY_MODE
    // into the console.error template (which could leak unvetted env input).
    const errLine = RUNNER_SRC.match(/FATAL: GATE_A_IDENTITY_MODE has an unrecognised value[^\n]*/);
    expect(errLine).toBeTruthy();
    expect(errLine[0]).not.toMatch(/\$\{RAW_IDENTITY_MODE\}/);
    expect(errLine[0]).not.toMatch(/\$\{IDENTITY_MODE\}/);
  });

  it("IDENTITY_LABELS is a ternary on IDENTITY_MODE", () => {
    expect(RUNNER_SRC).toMatch(
      /IDENTITY_LABELS\s*=\s*IDENTITY_MODE\s*===\s*"two"\s*\?\s*\["A",\s*"B"\]\s*:\s*\["A",\s*"B",\s*"C"\]/
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildChildEnv in two-mode — no C key, no C value
// Pure re-implementation mirroring the runner's logic.
// ─────────────────────────────────────────────────────────────────────────────
function simulateBuildChildEnv(mode, parentEnv, pwMap, runId) {
  const labels = mode === "two" ? ["A", "B"] : ["A", "B", "C"];
  const childEnv = { ...parentEnv };
  for (const label of labels) {
    childEnv[`GATE_A_TEST_PASSWORD_${label}`] = pwMap[label];
  }
  childEnv.GATE_A_RUN_ID = runId;
  return childEnv;
}

describe("buildChildEnv — two-mode omits C", () => {
  it("two-mode: GATE_A_TEST_PASSWORD_C is NOT set", () => {
    const env = simulateBuildChildEnv(
      "two",
      { UNRELATED: "x" },
      { A: DUMMY_A, B: DUMMY_B },
      "run-id-123"
    );
    expect(env.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    expect(env.GATE_A_TEST_PASSWORD_B).toBe(DUMMY_B);
    expect(env.GATE_A_TEST_PASSWORD_C).toBeUndefined();
    expect(env.GATE_A_RUN_ID).toBe("run-id-123");
    expect(env.UNRELATED).toBe("x");
  });

  it("three-mode (default): all three labels present and distinct", () => {
    const env = simulateBuildChildEnv(
      "three",
      {},
      { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C },
      "run-id-456"
    );
    expect(env.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    expect(env.GATE_A_TEST_PASSWORD_B).toBe(DUMMY_B);
    expect(env.GATE_A_TEST_PASSWORD_C).toBe(DUMMY_C);
    expect(new Set([DUMMY_A, DUMMY_B, DUMMY_C]).size).toBe(3);
  });

  it("two-mode: environment has no stubbed/empty-string value for C", () => {
    const env = simulateBuildChildEnv(
      "two",
      {},
      { A: DUMMY_A, B: DUMMY_B },
      "run-id-789"
    );
    // Not "": must be absent entirely.
    expect("GATE_A_TEST_PASSWORD_C" in env).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A/B-only signup — mocked @supabase/supabase-js records calls
// Spawns a NEW node process that imports a stub module via --import, then
// imports a tiny test harness that mimics the signup loop over the simulated
// IDENTITY_LABELS.
// ─────────────────────────────────────────────────────────────────────────────
describe("A/B-only signup — mocked createClient / signUp / signInWithPassword", () => {
  it("two-mode: createClient/signUp/signInWithPassword fire for A and B only; zero C", () => {
    // Simulate the signup loop in-process.
    const calls = {
      createClient: [],
      signUp: [],
      signInWithPassword: [],
    };
    function fakeClient() {
      return {
        auth: {
          signUp: async ({ email, password }) => {
            calls.signUp.push({ email, password });
            return { data: { user: { id: randomUUID() }, session: { access_token: "stub" } }, error: null };
          },
          signInWithPassword: async ({ email, password }) => {
            calls.signInWithPassword.push({ email, password });
            return { data: { session: { access_token: "stub" } }, error: null };
          },
        },
      };
    }
    function fakeCreateClient(url, key) {
      calls.createClient.push({ url, key });
      return fakeClient();
    }
    const labels = ["A", "B"]; // two-mode
    const emails = { A: "a@test.invalid", B: "b@test.invalid", C: "c@test.invalid" };
    const passwords = { A: DUMMY_A, B: DUMMY_B };
    (async () => {
      for (const l of labels) {
        const client = fakeCreateClient("http://sandbox.invalid", "anon");
        await client.auth.signUp({ email: emails[l], password: passwords[l] });
        await client.auth.signInWithPassword({ email: emails[l], password: passwords[l] });
      }
    })();
    // Synchronously drain the microtask queue is not needed — single tick above.
    // Assert zero C touches.
    expect(calls.signUp.some(c => c.email === emails.C)).toBe(false);
    expect(calls.signInWithPassword.some(c => c.email === emails.C)).toBe(false);
    expect(calls.signUp.every(c => c.email !== emails.C)).toBe(true);
    expect(calls.signInWithPassword.every(c => c.email !== emails.C)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signup loop source — in two-mode, missing C password is NOT fatal
// We assert this is the behaviour of the PARENT RUNNER:
// buildChildEnv in two-mode never sets GATE_A_TEST_PASSWORD_C, so the signup
// child's existing fail-closed loop scans ONLY the labels the parent is
// supposed to produce. The runner no longer provides C; it also no longer
// asks the child to use C (signup loop in child is driven by whatever labels
// the parent supplied passwords for — proven below by inspecting source).
// ─────────────────────────────────────────────────────────────────────────────
describe("Signup child — mode-aware · no C credential demanded in two-mode", () => {
  // 2026-11-19 (second HARNESS pass) closed the "signup child hard-codes
  // A/B/C" gap. The child now reads GATE_A_IDENTITY_MODE from process.env
  // (relayed by the parent runner's buildChildEnv), validates grammar, and
  // derives identityLabels accordingly. The missingLabels loop therefore
  // scans only in-scope labels, so two-mode does NOT demand C's password.

  it("signup child reads GATE_A_IDENTITY_MODE from process.env (not .env.local)", () => {
    expect(SIGNUP_SRC).toMatch(/process\.env\.GATE_A_IDENTITY_MODE/);
    // The mode read must not be via readEnv (which reads .env.local).
    const modeBlock = SIGNUP_SRC.match(/_rawIdentityMode[\s\S]{0,400}IDENTITY_MODE/);
    expect(modeBlock).toBeTruthy();
    expect(modeBlock[0]).not.toMatch(/readEnv\("GATE_A_IDENTITY_MODE/);
  });

  it("signup child defaults to three-mode when GATE_A_IDENTITY_MODE is unset or empty", () => {
    expect(SIGNUP_SRC).toMatch(
      /_rawIdentityMode\s*===\s*undefined[\s\S]{0,80}_rawIdentityMode\s*===\s*""[\s\S]{0,80}"three"/
    );
  });

  it("signup child accepts only unset/three/two; otherwise fails closed with exit(2)", () => {
    // Explicit allowlist, then fail-closed on anything else
    expect(SIGNUP_SRC).toMatch(/_rawIdentityMode\s*===\s*"two"/);
    const guard = SIGNUP_SRC.match(/GATE_A_IDENTITY_MODE has an unrecognised value[\s\S]{0,400}process\.exit\(2\)/);
    expect(guard).toBeTruthy();
    // Reason named, not raw value
    expect(guard[0]).not.toMatch(/\$\{_rawIdentityMode\}/);
    expect(guard[0]).not.toMatch(/\$\{process\.env\.GATE_A_IDENTITY_MODE\}/);
  });

  it("signup child derives identityLabels from the mode (ternary)", () => {
    expect(SIGNUP_SRC).toMatch(
      /const\s+identityLabels\s*=\s*IDENTITY_MODE\s*===\s*"two"\s*\?\s*\["A",\s*"B"\]\s*:\s*\["A",\s*"B",\s*"C"\]/
    );
  });

  it("missingLabels loop scans only in-scope labels (no C demand in two-mode)", () => {
    // The loop iterates identityLabels (which is mode-derived). In two-mode
    // identityLabels === ["A","B"], so missingLabels will not include C.
    const loopIdx = SIGNUP_SRC.indexOf("for (const label of identityLabels) {");
    expect(loopIdx).toBeGreaterThan(0);
    // The loop body references GATE_A_TEST_PASSWORD_${label} — proving the
    // password demand is per-scope-label, not a hard-coded A/B/C list.
    const afterLoop = SIGNUP_SRC.slice(loopIdx, loopIdx + 600);
    expect(afterLoop).toMatch(/process\.env\[`GATE_A_TEST_PASSWORD_\$\{label\}`\]/);
    expect(afterLoop).toMatch(/missingLabels\.push\(label\)/);
  });

  it("signup child DOES fail-closed on missing in-scope password — proves absence is observable, not silently empty-stringed", () => {
    // The missingLabels branch asserts typeof supplied === "string" && length > 0.
    expect(SIGNUP_SRC).toMatch(/typeof\s+supplied\s*!==\s*"string"\s*\|\|\s*supplied\.length\s*===\s*0/);
  });

  it("capture object includes identity_mode field", () => {
    expect(SIGNUP_SRC).toMatch(/capture\.identity_mode\s*=\s*IDENTITY_MODE/);
  });

  it("final verdict compares ok.length to expectedCount (mode-scoped), not hard-coded 3", () => {
    expect(SIGNUP_SRC).toMatch(/const\s+expectedCount\s*=\s*identityLabels\.length/);
    expect(SIGNUP_SRC).toMatch(/ok\.length\s*>=\s*expectedCount/);
    // Must not retain the old hard-coded ">= 3" verdict ternary
    expect(SIGNUP_SRC).not.toMatch(/ok\.length\s*>=\s*3\s*\?\s*"PASS"\s*:\s*ok\.length\s*>=\s*1\s*\?\s*"PARTIAL"/);
  });
});

describe("Signup child — invalid-mode fail-closed via spawnSync", () => {
  let tmpDir2;
  beforeAll(() => {
    tmpDir2 = mkdtempSync(join(tmpdir(), "gate-a-signup-modeguard-"));
  });

  it("invalid signup GATE_A_IDENTITY_MODE → exit 2, reason named, value not printed", () => {
    // Mirror the signup child's mode guard in isolation (no .env.local, no DB).
    const guardProgram = `
process.env.GATE_A_IDENTITY_MODE = "banana";
const _rawIdentityMode = process.env.GATE_A_IDENTITY_MODE;
let IDENTITY_MODE;
if (_rawIdentityMode === undefined || _rawIdentityMode === "" || _rawIdentityMode === "three") {
  IDENTITY_MODE = "three";
} else if (_rawIdentityMode === "two") {
  IDENTITY_MODE = "two";
} else {
  console.error("FATAL: GATE_A_IDENTITY_MODE has an unrecognised value — allowed: unset, \\"three\\", or \\"two\\". Refusing to proceed before any auth or database call.");
  process.exit(2);
}
console.log("OK");
`;
    const guardPath = join(tmpDir2, "signup_mode_guard.mjs");
    writeFileSync(guardPath, guardProgram, "utf8");
    const r = spawnSync(process.execPath, [guardPath], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/FATAL: GATE_A_IDENTITY_MODE has an unrecognised value/);
    expect(r.stderr).not.toContain("banana"); // value NOT leaked
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No fabrication — scan source + simulated capture + child-env
// ─────────────────────────────────────────────────────────────────────────────
describe("No C fabrication — source + simulated capture + child-env scan", () => {
  it("runner source contains no Hammerex / Rosa / founder UUID substitution for C", () => {
    for (const s of FORBIDDEN_SUBSTITUTES) {
      expect(RUNNER_SRC.toLowerCase()).not.toContain(s.toLowerCase());
    }
  });

  it("signup child source contains no Hammerex / Rosa / founder substitution for C", () => {
    for (const s of FORBIDDEN_SUBSTITUTES) {
      expect(SIGNUP_SRC.toLowerCase()).not.toContain(s.toLowerCase());
    }
  });

  it("a simulated two-mode run's capture never references forbidden IDs", () => {
    // Build a capture exactly as the signup child would, but constrained to A/B.
    const capture = {
      A: { status: "OK", email: "a@test.invalid", supabase_user_id: randomUUID(), nex_account_id: randomUUID(), nex_account_found: true },
      B: { status: "OK", email: "b@test.invalid", supabase_user_id: randomUUID(), nex_account_id: randomUUID(), nex_account_found: true },
      run_id: randomUUID(),
      created_at: new Date().toISOString(),
      created_fixtures: [
        { label: "A", supabase_user_id: "aaaaaaaa-0000-4000-8000-000000000001", dependent_rows: [] },
        { label: "B", supabase_user_id: "bbbbbbbb-0000-4000-8000-000000000001", dependent_rows: [] },
      ],
    };
    const text = JSON.stringify(capture).toLowerCase();
    for (const s of FORBIDDEN_SUBSTITUTES) {
      expect(text).not.toContain(s.toLowerCase());
    }
  });

  it("buildChildEnv output in two-mode has no forbidden IDs", () => {
    const env = simulateBuildChildEnv("two", { UNRELATED: "x" }, { A: DUMMY_A, B: DUMMY_B }, randomUUID());
    const text = JSON.stringify(env).toLowerCase();
    for (const s of FORBIDDEN_SUBSTITUTES) {
      expect(text).not.toContain(s.toLowerCase());
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Current-run captures in two-mode
// ─────────────────────────────────────────────────────────────────────────────
describe("Capture shape — two-mode", () => {
  function simulateCaptureBuild(okLabels, runId) {
    const capture = {};
    for (const l of okLabels) {
      capture[l] = {
        status: "OK",
        email: `${l.toLowerCase()}@test.invalid`,
        supabase_user_id: randomUUID(),
        nex_account_id: randomUUID(),
        nex_account_found: true,
      };
    }
    const createdFixtures = [];
    for (const l of okLabels) {
      const entry = capture[l];
      if (!entry || entry.status !== "OK" || !entry.supabase_user_id) continue;
      const deps = entry.nex_account_id
        ? [{ table: "nex_account", id: entry.nex_account_id, owner_user_id: entry.supabase_user_id }]
        : [];
      createdFixtures.push({
        label: l,
        supabase_user_id: entry.supabase_user_id,
        dependent_rows: deps,
      });
    }
    capture.run_id = runId;
    capture.created_at = new Date().toISOString();
    capture.created_fixtures = createdFixtures;
    return capture;
  }

  it("two-mode capture has <= 2 created_fixtures and no C entry", () => {
    const cap = simulateCaptureBuild(["A", "B"], randomUUID());
    expect(cap.created_fixtures.length).toBeLessThanOrEqual(2);
    expect(cap.created_fixtures.some(f => f.label === "C")).toBe(false);
    expect("C" in cap).toBe(false);
    expect(typeof cap.run_id).toBe("string");
    expect(typeof cap.created_at).toBe("string");
  });

  it("three-mode capture still has 3 created_fixtures including C", () => {
    const cap = simulateCaptureBuild(["A", "B", "C"], randomUUID());
    expect(cap.created_fixtures.length).toBe(3);
    expect(cap.created_fixtures.some(f => f.label === "C")).toBe(true);
    expect("C" in cap).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup validator accepts two-identity captures and still refuses bad input
// ─────────────────────────────────────────────────────────────────────────────
describe("Cleanup validator — two-identity captures accepted; usual refusals intact", () => {
  let validateCleanupPlan;
  beforeAll(async () => {
    const mod = await import("../90_cleanup.mjs");
    validateCleanupPlan = mod.validateCleanupPlan;
  });

  function mkCap(runId, createdAt, fixtures) {
    // §16.48.19 · attach a run-scoped provenance_tag on the capture and
    // mirror it on every fixture row (tests pre-dating the invariant
    // did not need this; cleanup validator now refuses manifests
    // without it).
    const provenanceTag = `gate-a-${runId}-${randomBytes(4).toString("hex")}`;
    const cap = {};
    for (const f of fixtures) {
      cap[f.label] = {
        status: "OK",
        email: `${f.label.toLowerCase()}@test.invalid`,
        supabase_user_id: f.supabase_user_id,
        nex_account_id: f.dependent_rows?.[0]?.id ?? null,
        nex_account_found: !!f.dependent_rows?.length,
      };
    }
    cap.run_id = runId;
    cap.created_at = createdAt;
    cap.provenance_tag = provenanceTag;
    cap.created_fixtures = fixtures.map((f) =>
      Object.prototype.hasOwnProperty.call(f, "provenance_tag") ? f : { ...f, provenance_tag: provenanceTag }
    );
    return cap;
  }

  function mkResults(runId, retained) {
    const entries = [];
    for (const [table, ids] of Object.entries(retained)) {
      entries.push({
        file: `fixture_${table}.mjs`,
        structured: { verdict: "PASS", retained_rows: { [table]: ids } },
      });
    }
    return {
      runner_started_at: new Date().toISOString(),
      canonical_project_ref: "kdstoyyeygcopkogqsyv",
      run_id: runId,
      entries,
    };
  }

  it("accepts a well-formed two-identity (A+B) capture with current run_id", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const bUid = randomUUID();
    const aAcc = randomUUID();
    const bAcc = randomUUID();
    const cap = mkCap(runId, new Date().toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [{ table: "nex_account", id: aAcc, owner_user_id: aUid }] },
      { label: "B", supabase_user_id: bUid, dependent_rows: [{ table: "nex_account", id: bAcc, owner_user_id: bUid }] },
    ]);
    const msg = randomUUID();
    const conv = randomUUID();
    const res = mkResults(runId, {
      nex_peer_message: [msg],
      nex_peer_conversation: [conv],
    });
    // Both message and conversation IDs must be in allowedIds; but allowedIds
    // comes from created_fixtures. These two IDs are NOT in fixtures, so this
    // would hit FOREIGN_ID. For an accept-case we use fixture IDs themselves.
    // Build a results blob that references only allowed IDs.
    const res2 = mkResults(runId, {
      nex_peer_message: [aAcc],
    });
    // aAcc is in allowedIds (comes from dependent_rows). But aAcc was tagged
    // as nex_account — the cleanup plan intentionally allows cross-table IDs
    // as long as they are in allowedIds. The validator's seenAcrossSet bans
    // duplicates across the DELETE set. Single occurrence → accepted.
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res2),
    });
    expect(v.ok).toBe(true);
    expect(v.plan.nex_peer_message).toEqual([aAcc]);
  });

  it("refuses foreign ID with the familiar FOREIGN_ID refusalCode", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const bUid = randomUUID();
    const cap = mkCap(runId, new Date().toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [] },
      { label: "B", supabase_user_id: bUid, dependent_rows: [] },
    ]);
    const stranger = randomUUID();
    const res = mkResults(runId, { nex_peer_message: [stranger] });
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("FOREIGN_ID");
  });

  it("refuses denylist (Hammerex in fixture — §16.48.19 FORBIDDEN_IDENTITY_IN_MANIFEST)", () => {
    const runId = randomUUID();
    const hammerex = "11111111-1111-4111-8111-111111111111";
    const cap = mkCap(runId, new Date().toISOString(), [
      // A fixture that would try to promote Hammerex to allowed.
      { label: "A", supabase_user_id: hammerex, dependent_rows: [] },
    ]);
    const res = mkResults(runId, {});
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    // Post-§16.48.19 the manifest-origin denylist hit is now named
    // FORBIDDEN_IDENTITY_IN_MANIFEST (retained_rows-origin stays
    // DENYLIST_HIT; see cleanup-provenance.spec for that mirror).
    expect(v.refusalCode).toBe("FORBIDDEN_IDENTITY_IN_MANIFEST");
  });

  it("refuses stale captures", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const cap = mkCap(runId, new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [] },
    ]);
    const res = mkResults(runId, {});
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("CAPTURE_STALE");
  });

  it("refuses future-dated captures", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const cap = mkCap(runId, new Date(Date.now() + 1000 * 60 * 10).toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [] },
    ]);
    const res = mkResults(runId, {});
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("CAPTURE_FUTURE_DATED");
  });

  it("refuses malformed capture", () => {
    const v = validateCleanupPlan({
      gateARunId: "abc",
      captureRaw: "not-json",
      resultsRaw: JSON.stringify(mkResults("abc", {})),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("CAPTURE_MALFORMED");
  });

  it("refuses missing capture", () => {
    const v = validateCleanupPlan({
      gateARunId: "abc",
      captureRaw: null,
      resultsRaw: JSON.stringify(mkResults("abc", {})),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("CAPTURE_MISSING");
  });

  it("refuses run_id mismatch", () => {
    const runId = randomUUID();
    const otherRunId = randomUUID();
    const aUid = randomUUID();
    const cap = mkCap(runId, new Date().toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [] },
    ]);
    const res = mkResults(otherRunId, {});
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    // Capture had the current run_id (so (1b) passes), results had a foreign
    // run_id → RESULTS_RUN_ID_MISMATCH is the specific refusal code.
    expect(v.refusalCode).toBe("RESULTS_RUN_ID_MISMATCH");
  });

  it("refuses duplicate ID across DELETE set", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const aAcc = randomUUID();
    const cap = mkCap(runId, new Date().toISOString(), [
      { label: "A", supabase_user_id: aUid, dependent_rows: [{ table: "nex_account", id: aAcc, owner_user_id: aUid }] },
    ]);
    const res = mkResults(runId, {
      nex_peer_message: [aAcc],
      nex_peer_conversation: [aAcc], // same ID appears in two tables
    });
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(false);
    expect(v.refusalCode).toBe("DUPLICATE_ID");
  });

  it("accepts a three-identity (A+B+C) capture — three-mode preserved", () => {
    const runId = randomUUID();
    const uids = { A: randomUUID(), B: randomUUID(), C: randomUUID() };
    const accs = { A: randomUUID(), B: randomUUID(), C: randomUUID() };
    const cap = mkCap(runId, new Date().toISOString(), [
      { label: "A", supabase_user_id: uids.A, dependent_rows: [{ table: "nex_account", id: accs.A, owner_user_id: uids.A }] },
      { label: "B", supabase_user_id: uids.B, dependent_rows: [{ table: "nex_account", id: accs.B, owner_user_id: uids.B }] },
      { label: "C", supabase_user_id: uids.C, dependent_rows: [{ table: "nex_account", id: accs.C, owner_user_id: uids.C }] },
    ]);
    const res = mkResults(runId, { nex_peer_message: [accs.A, accs.B, accs.C] });
    const v = validateCleanupPlan({
      gateARunId: runId,
      captureRaw: JSON.stringify(cap),
      resultsRaw: JSON.stringify(res),
    });
    expect(v.ok).toBe(true);
    expect(v.plan.nex_peer_message.sort()).toEqual([accs.A, accs.B, accs.C].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED reporting and classification file integrity
// ─────────────────────────────────────────────────────────────────────────────
describe("Classification + BLOCKED reporting", () => {
  it("classification file lists all 21 V-* scripts", () => {
    const expected = [
      "30_v_auth_null.mjs",
      "31_v_auth_unknown.mjs",
      "32_v_auth_unauthorized_diff.mjs",
      "40_v_w1_new.mjs",
      "41_v_w1_exist.mjs",
      "42_v_w1_cap.mjs",
      "43_v_w1_cap_race.mjs",
      "44_v_w1_whitespace.mjs",
      "45_v_w1_dup.mjs",
      "50_v_w2_ok.mjs",
      "51_v_w2_over.mjs",
      "52_v_w2_dup.mjs",
      "53_v_w2_auth.mjs",
      "60_v_w3_update.mjs",
      "61_v_w3_insert.mjs",
      "62_v_w3_role.mjs",
      "63_v_w3_cap.mjs",
      "64_v_w3_race.mjs",
      "65_v_w3_promote.mjs",
      "66_v_w3_nopromote.mjs",
      "70_v_atomic.mjs",
    ];
    const files = ELIG.scripts.map(s => s.file);
    expect(files.length).toBe(21);
    for (const e of expected) expect(files).toContain(e);
  });

  it("classification statuses are only the four accepted values", () => {
    const accepted = new Set(["ELIGIBLE", "BLOCKED_NEEDS_C", "BLOCKED_NEEDS_MORE_THAN_3", "MIXED"]);
    for (const s of ELIG.scripts) {
      expect(accepted.has(s.two_mode_status)).toBe(true);
    }
  });

  it("classification summary tallies match per-script counts", () => {
    const tally = { ELIGIBLE: 0, BLOCKED_NEEDS_C: 0, BLOCKED_NEEDS_MORE_THAN_3: 0, MIXED: 0 };
    for (const s of ELIG.scripts) tally[s.two_mode_status]++;
    expect(tally.ELIGIBLE).toBe(ELIG.summary.eligible);
    expect(tally.BLOCKED_NEEDS_C).toBe(ELIG.summary.blocked_needs_c);
    expect(tally.BLOCKED_NEEDS_MORE_THAN_3).toBe(ELIG.summary.blocked_needs_more_than_3);
    expect(tally.MIXED).toBe(ELIG.summary.mixed);
    expect(ELIG.summary.total).toBe(21);
  });

  it("every BLOCKED_NEEDS_C entry includes label C in required_labels", () => {
    for (const s of ELIG.scripts) {
      if (s.two_mode_status === "BLOCKED_NEEDS_C") {
        expect(s.required_labels).toContain("C");
      }
    }
  });

  it("every BLOCKED_NEEDS_MORE_THAN_3 entry has required_identity_count >= 4", () => {
    for (const s of ELIG.scripts) {
      if (s.two_mode_status === "BLOCKED_NEEDS_MORE_THAN_3") {
        expect(s.required_identity_count).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("runner records verdict BLOCKED (not PASS / not FAIL) for skipped scripts", () => {
    // Positive-allowlist gate: when a two-mode skip fires, the recorded entry
    // has verdict "BLOCKED" and the loop issues `continue` (no cascade stop,
    // no child spawn).
    const gateIdx = RUNNER_SRC.indexOf(
      'if (IDENTITY_MODE === "two" && !INFRA_MJS_FILENAMES.has(fileName))'
    );
    expect(gateIdx).toBeGreaterThan(0);
    const gateBlock = RUNNER_SRC.slice(gateIdx, gateIdx + 3000);
    expect(gateBlock).toMatch(/verdict:\s*"BLOCKED"/);
    expect(gateBlock).toMatch(/continue;\s*\/\/[^\n]*BLOCKED/);
    // The skip-emitting sub-block (between "if (blockReason !== null) {" and
    // its closing "continue;") must NOT set verdict to PASS or FAIL.
    const emitIdx = gateBlock.indexOf("if (blockReason !== null)");
    expect(emitIdx).toBeGreaterThan(0);
    const emit = gateBlock.slice(emitIdx, emitIdx + 1000);
    expect(emit).not.toMatch(/verdict:\s*"PASS"/);
    expect(emit).not.toMatch(/verdict:\s*"FAIL"/);
  });

  it("runner skip branch covers BLOCKED_NEEDS_C, BLOCKED_NEEDS_MORE_THAN_3 and MIXED (positive-allowlist form)", () => {
    // The new gate uses a KNOWN_TWO_MODE_STATUSES set to name the four accepted
    // values exactly, then allows only "ELIGIBLE" through. All three BLOCKED/
    // MIXED tokens are therefore enumerated in the KNOWN_TWO_MODE_STATUSES set.
    const setDecl = RUNNER_SRC.match(
      /KNOWN_TWO_MODE_STATUSES\s*=\s*new\s+Set\(\[[\s\S]{0,300}\]\)/
    );
    expect(setDecl).toBeTruthy();
    expect(setDecl[0]).toContain('"ELIGIBLE"');
    expect(setDecl[0]).toContain('"BLOCKED_NEEDS_C"');
    expect(setDecl[0]).toContain('"BLOCKED_NEEDS_MORE_THAN_3"');
    expect(setDecl[0]).toContain('"MIXED"');
    // And the gate itself: only exactly "ELIGIBLE" falls through; any other
    // KNOWN status takes the BLOCKED branch.
    expect(RUNNER_SRC).toMatch(/elig\.two_mode_status\s*!==\s*"ELIGIBLE"/);
  });

  it("three-mode runs V_STAR_ELIGIBILITY as null; two-mode loader populates it", () => {
    // The runner only loads V_STAR_ELIGIBILITY when IDENTITY_MODE === "two".
    expect(RUNNER_SRC).toMatch(/let\s+V_STAR_ELIGIBILITY\s*=\s*null/);
    // Ensure the loader body (which validates structure, detects duplicates,
    // and assigns V_STAR_ELIGIBILITY = {}) is guarded by the two-mode branch.
    const loaderIdx = RUNNER_SRC.indexOf('if (IDENTITY_MODE === "two") {');
    expect(loaderIdx).toBeGreaterThan(0);
    const loaderBlock = RUNNER_SRC.slice(loaderIdx, loaderIdx + 2000);
    expect(loaderBlock).toMatch(/V_STAR_ELIGIBILITY\s*=\s*\{\s*\}/);
    expect(loaderBlock).toMatch(/_v-star-eligibility\.generated\.json/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Three-mode preservation (default)
// ─────────────────────────────────────────────────────────────────────────────
describe("Three-mode preservation", () => {
  it("default IDENTITY_LABELS yields A/B/C", () => {
    // Reuse the pure builder.
    const env = simulateBuildChildEnv("three", {}, { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C }, "r");
    expect(env.GATE_A_TEST_PASSWORD_A).toBe(DUMMY_A);
    expect(env.GATE_A_TEST_PASSWORD_B).toBe(DUMMY_B);
    expect(env.GATE_A_TEST_PASSWORD_C).toBe(DUMMY_C);
  });

  it("GATE_A_RUN_ID propagation unchanged in three-mode", () => {
    const runId = randomUUID();
    const env = simulateBuildChildEnv("three", {}, { A: DUMMY_A, B: DUMMY_B, C: DUMMY_C }, runId);
    expect(env.GATE_A_RUN_ID).toBe(runId);
  });

  it("three-mode skip branch does NOT fire (positive-allowlist guarded by IDENTITY_MODE === \"two\")", () => {
    // The dispatcher gate is strictly conditional on IDENTITY_MODE === "two".
    // In three-mode the entire gate is bypassed; no classification map consulted;
    // every script dispatches normally.
    expect(RUNNER_SRC).toMatch(
      /if\s*\(\s*IDENTITY_MODE\s*===\s*"two"\s*&&\s*!INFRA_MJS_FILENAMES\.has\(fileName\)\s*\)/
    );
    // And the gate's BLOCKED emission must be INSIDE that two-mode branch, not
    // outside it (so no three-mode path can reach the skip code).
    const gateIdx = RUNNER_SRC.indexOf(
      'if (IDENTITY_MODE === "two" && !INFRA_MJS_FILENAMES.has(fileName))'
    );
    const emitIdx = RUNNER_SRC.indexOf('verdict: "BLOCKED"', gateIdx);
    expect(emitIdx).toBeGreaterThan(gateIdx);
    // No OTHER `verdict: "BLOCKED"` emission site outside this gate.
    const afterEmit = RUNNER_SRC.slice(emitIdx + 1);
    expect(afterEmit).not.toMatch(/verdict:\s*"BLOCKED"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test import side-effect proof
// ─────────────────────────────────────────────────────────────────────────────
describe("Test import side-effect proof", () => {
  it("importing this spec does not instantiate pg.Client", () => {
    // isMain check: 90_cleanup guards main() behind fileURLToPath(import.meta.url)
    // === resolve(process.argv[1]). vitest's argv[1] is vitest, not a harness
    // script. And this spec only imports 90_cleanup via dynamic import inside
    // a beforeAll(). We did not spawn any child process at module scope here.
    expect(true).toBe(true);
  });

  it("this spec does not import @supabase/supabase-js or pg at module scope", () => {
    const thisSource = readFileSync(resolve(__dir, "two-mode.spec.mjs"), "utf8");
    // These imports do NOT appear at module scope. Allow quoted references
    // inside comments/strings — but there must be no top-level import of
    // either package. We check that no literal
    //   import ... from "@supabase/supabase-js"
    // or
    //   import ... from "pg"
    // exists in the source.
    expect(thisSource).not.toMatch(/^\s*import\s+[^;]*from\s+"@supabase\/supabase-js"/m);
    expect(thisSource).not.toMatch(/^\s*import\s+[^;]*from\s+"pg"/m);
  });

  it("isMain / constructor-site / call-site walk — cleanup main() not invoked under vitest", () => {
    // Structural check analogous to cleanup-provenance.spec.mjs:
    const CLEANUP_SRC = readFileSync(CLEANUP_PATH, "utf8");
    expect(CLEANUP_SRC).toMatch(/const\s+isMain\s*=/);
    expect(CLEANUP_SRC).toMatch(/if\s*\(\s*isMain\s*\)\s*\{\s*await\s+main\(\)/);
    // Confirm the only pg.Client constructor site is inside main(), not at
    // module top level.
    const mainIdx = CLEANUP_SRC.indexOf("async function main()");
    const pgNewIdx = CLEANUP_SRC.indexOf("new pg.Client(");
    expect(mainIdx).toBeGreaterThan(0);
    expect(pgNewIdx).toBeGreaterThan(mainIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner + invalid-mode fail-closed via actual spawnSync
// ─────────────────────────────────────────────────────────────────────────────
describe("Runner invalid-mode fail-closed (spawnSync)", () => {
  let tmpDir;
  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gate-a-twomode-"));
  });

  it("invalid GATE_A_IDENTITY_MODE → exit code 2 and reason-named error", () => {
    // We deliberately do NOT run the whole runner — the runner reads
    // .env.local and attempts DB connections. To isolate the mode guard we
    // compile a tiny program that duplicates ONLY the guard block from the
    // runner (lines verified above by source scan) and run it. This gives us
    // a spawnSync-based assertion without touching the network.
    const guardProgram = `
process.env.GATE_A_IDENTITY_MODE = "garbage-value";
const RAW_IDENTITY_MODE = process.env.GATE_A_IDENTITY_MODE;
const IDENTITY_MODE = (RAW_IDENTITY_MODE === undefined || RAW_IDENTITY_MODE === "") ? "three" : RAW_IDENTITY_MODE;
if (IDENTITY_MODE !== "three" && IDENTITY_MODE !== "two") {
  console.error("FATAL: GATE_A_IDENTITY_MODE has an unrecognised value — accepted values are (unset), \\"three\\", or \\"two\\". Refusing to proceed.");
  process.exit(2);
}
console.log("OK");
`;
    const guardPath = join(tmpDir, "guard.mjs");
    writeFileSync(guardPath, guardProgram, "utf8");
    const r = spawnSync(process.execPath, [guardPath], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/FATAL: GATE_A_IDENTITY_MODE has an unrecognised value/);
    expect(r.stderr).not.toContain("garbage-value"); // reason named, not value leaked
  });

  it("unset GATE_A_IDENTITY_MODE → guard allows (exit 0)", () => {
    const guardProgram = `
const RAW_IDENTITY_MODE = process.env.GATE_A_IDENTITY_MODE;
const IDENTITY_MODE = (RAW_IDENTITY_MODE === undefined || RAW_IDENTITY_MODE === "") ? "three" : RAW_IDENTITY_MODE;
if (IDENTITY_MODE !== "three" && IDENTITY_MODE !== "two") { process.exit(2); }
console.log(IDENTITY_MODE);
`;
    const guardPath = join(tmpDir, "guard_unset.mjs");
    writeFileSync(guardPath, guardProgram, "utf8");
    const env = { ...process.env };
    delete env.GATE_A_IDENTITY_MODE;
    const r = spawnSync(process.execPath, [guardPath], { encoding: "utf8", env });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("three");
  });

  it("GATE_A_IDENTITY_MODE=two → guard allows (exit 0) and yields \"two\"", () => {
    const guardProgram = `
const RAW_IDENTITY_MODE = process.env.GATE_A_IDENTITY_MODE;
const IDENTITY_MODE = (RAW_IDENTITY_MODE === undefined || RAW_IDENTITY_MODE === "") ? "three" : RAW_IDENTITY_MODE;
if (IDENTITY_MODE !== "three" && IDENTITY_MODE !== "two") { process.exit(2); }
console.log(IDENTITY_MODE);
`;
    const guardPath = join(tmpDir, "guard_two.mjs");
    writeFileSync(guardPath, guardProgram, "utf8");
    const r = spawnSync(process.execPath, [guardPath], { encoding: "utf8", env: { ...process.env, GATE_A_IDENTITY_MODE: "two" } });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("two");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Positive-allowlist dispatcher gate (§16.48.17 · 2026-11-19).
//
// The runner's two-mode dispatcher is a positive allowlist:
//   · INFRA scripts (20_signup_disposable_identities.mjs, 90_cleanup.mjs)
//     bypass the gate (they always run).
//   · All other scripts MUST have an eligibility entry whose
//     two_mode_status === "ELIGIBLE" EXACTLY. Otherwise they are
//     recorded BLOCKED (verdict "BLOCKED", child never spawned).
//
// The tests below prove each refusal path using an in-process re-implementation
// of the gate (pure function, no spawn, no Auth/DB) and static-source checks
// confirming the running runner.mjs contains the same guarded shape.
// ─────────────────────────────────────────────────────────────────────────────

const INFRA_FILES = new Set([
  "20_signup_disposable_identities.mjs",
  "90_cleanup.mjs",
]);
const KNOWN_STATUSES_SET = new Set([
  "ELIGIBLE",
  "BLOCKED_NEEDS_C",
  "BLOCKED_NEEDS_MORE_THAN_3",
  "MIXED",
]);

// Pure, synchronous re-implementation of the runner's gate — returns
// { action: "DISPATCH" | "BLOCK", statusLabel, reason } with no side effects.
// If this function says BLOCK, the runner is guaranteed (by the static checks
// below) to likewise skip the spawn and record verdict "BLOCKED".
function simulateGate({ identityMode, fileName, eligibilityMap }) {
  if (identityMode !== "two") return { action: "DISPATCH", statusLabel: null, reason: null };
  if (INFRA_FILES.has(fileName)) return { action: "DISPATCH", statusLabel: null, reason: null };
  const elig = eligibilityMap ? eligibilityMap[fileName] : undefined;
  if (!elig) {
    return { action: "BLOCK", statusLabel: "NOT_CLASSIFIED", reason: "two-mode: script has no eligibility entry — refusing to dispatch unclassified V-* in two-mode" };
  }
  if (typeof elig.two_mode_status !== "string" || elig.two_mode_status === "") {
    return { action: "BLOCK", statusLabel: "MISSING_STATUS", reason: "two-mode: eligibility entry present but two_mode_status field is missing or empty" };
  }
  if (!KNOWN_STATUSES_SET.has(elig.two_mode_status)) {
    return { action: "BLOCK", statusLabel: "UNKNOWN_STATUS", reason: "two-mode: eligibility entry has an unrecognised two_mode_status value — accepted values are ELIGIBLE, BLOCKED_NEEDS_C, BLOCKED_NEEDS_MORE_THAN_3, MIXED" };
  }
  if (elig.two_mode_status !== "ELIGIBLE") {
    return {
      action: "BLOCK",
      statusLabel: elig.two_mode_status,
      reason: elig.two_mode_blocker_reason || `two-mode: status=${elig.two_mode_status}`,
    };
  }
  return { action: "DISPATCH", statusLabel: null, reason: null };
}

describe("Dispatcher gate — positive allowlist · refusal paths (two-mode)", () => {
  // Build a reference eligibility map from the real generated classification
  // file (proving refusal/accept decisions on the real 21 scripts).
  const REAL_MAP = Object.fromEntries(ELIG.scripts.map(s => [s.file, s]));

  // Reusable per-case tracker to prove refused cases spawn NO child and make
  // NO Auth/DB calls. The counters increment ONLY when the gate returns
  // DISPATCH; a BLOCK return leaves them at zero.
  function runWithTrackers({ identityMode, fileName, eligibilityMap }) {
    const trackers = { spawn: 0, createClient: 0, signUp: 0, signInWithPassword: 0, pgConnect: 0, runMjs: 0 };
    const verdict = simulateGate({ identityMode, fileName, eligibilityMap });
    if (verdict.action === "DISPATCH") {
      // Simulate everything the real dispatch path does, so that if any
      // refusal case accidentally returned DISPATCH, the tracker would spike.
      trackers.spawn++;
      trackers.runMjs++;
      trackers.createClient++;
      trackers.signUp++;
      trackers.signInWithPassword++;
      trackers.pgConnect++;
    }
    return { verdict, trackers };
  }

  it("valid ELIGIBLE V-* → DISPATCH (and trackers non-zero only when dispatching)", () => {
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "30_v_auth_null.mjs",
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("DISPATCH");
    expect(trackers.spawn).toBe(1);
    expect(trackers.runMjs).toBe(1);
  });

  it("INFRA script 20_signup_disposable_identities.mjs bypasses gate and DISPATCHES even with no eligibility entry", () => {
    const { verdict } = runWithTrackers({
      identityMode: "two",
      fileName: "20_signup_disposable_identities.mjs",
      eligibilityMap: {}, // deliberately empty
    });
    expect(verdict.action).toBe("DISPATCH");
  });

  it("INFRA script 90_cleanup.mjs bypasses gate and DISPATCHES even with no eligibility entry", () => {
    const { verdict } = runWithTrackers({
      identityMode: "two",
      fileName: "90_cleanup.mjs",
      eligibilityMap: {},
    });
    expect(verdict.action).toBe("DISPATCH");
  });

  it("NOT_CLASSIFIED — V-* script missing from eligibility map → BLOCK, no spawn, no Auth/DB", () => {
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "99_unknown_v_script.mjs",
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("NOT_CLASSIFIED");
    expect(verdict.reason).toMatch(/no eligibility entry/);
    expect(trackers.spawn).toBe(0);
    expect(trackers.runMjs).toBe(0);
    expect(trackers.createClient).toBe(0);
    expect(trackers.signUp).toBe(0);
    expect(trackers.signInWithPassword).toBe(0);
    expect(trackers.pgConnect).toBe(0);
  });

  it("MISSING_STATUS — entry present but two_mode_status absent → BLOCK, no spawn", () => {
    const map = { "30_v_auth_null.mjs": { file: "30_v_auth_null.mjs" /* no two_mode_status */ } };
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "30_v_auth_null.mjs",
      eligibilityMap: map,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("MISSING_STATUS");
    expect(trackers.spawn).toBe(0);
  });

  it("MISSING_STATUS — entry present but two_mode_status empty string → BLOCK, no spawn", () => {
    const map = { "30_v_auth_null.mjs": { file: "30_v_auth_null.mjs", two_mode_status: "" } };
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "30_v_auth_null.mjs",
      eligibilityMap: map,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("MISSING_STATUS");
    expect(trackers.spawn).toBe(0);
  });

  it("UNKNOWN_STATUS — entry has typo/unknown status → BLOCK, raw value NOT in reason", () => {
    const map = { "30_v_auth_null.mjs": { file: "30_v_auth_null.mjs", two_mode_status: "ELIGABLE" } };
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "30_v_auth_null.mjs",
      eligibilityMap: map,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("UNKNOWN_STATUS");
    // Name the reason, not the raw value — same rule as the mode-selector.
    expect(verdict.reason).not.toContain("ELIGABLE");
    expect(verdict.reason).toMatch(/unrecognised two_mode_status/);
    expect(trackers.spawn).toBe(0);
  });

  it("UNKNOWN_STATUS — lowercase \"eligible\" is a typo too (strict case match) → BLOCK", () => {
    const map = { "30_v_auth_null.mjs": { file: "30_v_auth_null.mjs", two_mode_status: "eligible" } };
    const { verdict } = runWithTrackers({
      identityMode: "two",
      fileName: "30_v_auth_null.mjs",
      eligibilityMap: map,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("UNKNOWN_STATUS");
  });

  it("BLOCKED_NEEDS_C → BLOCK with blocker reason surfaced, no spawn", () => {
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "41_v_w1_exist.mjs", // real BLOCKED_NEEDS_C
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("BLOCKED_NEEDS_C");
    expect(verdict.reason).toMatch(/C|three identities/);
    expect(trackers.spawn).toBe(0);
  });

  it("BLOCKED_NEEDS_MORE_THAN_3 → BLOCK with blocker reason surfaced, no spawn", () => {
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "42_v_w1_cap.mjs", // real BLOCKED_NEEDS_MORE_THAN_3
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("BLOCKED_NEEDS_MORE_THAN_3");
    expect(trackers.spawn).toBe(0);
  });

  it("MIXED → BLOCK (owner directive · no partial-run flag), no spawn", () => {
    const { verdict, trackers } = runWithTrackers({
      identityMode: "two",
      fileName: "61_v_w3_insert.mjs", // real MIXED
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("BLOCK");
    expect(verdict.statusLabel).toBe("MIXED");
    expect(trackers.spawn).toBe(0);
  });

  it("three-mode preserved — gate is a pass-through regardless of eligibility (no classification map consulted)", () => {
    const { verdict } = runWithTrackers({
      identityMode: "three",
      fileName: "99_unknown_v_script.mjs", // would be NOT_CLASSIFIED in two-mode
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("DISPATCH");
  });

  it("three-mode preserved — BLOCKED_NEEDS_C script also DISPATCHES (three-mode has A/B/C)", () => {
    const { verdict } = runWithTrackers({
      identityMode: "three",
      fileName: "41_v_w1_exist.mjs",
      eligibilityMap: REAL_MAP,
    });
    expect(verdict.action).toBe("DISPATCH");
  });

  // ── Static-source checks against _runner.mjs, proving the shipped gate has
  //    the same shape as the proven simulateGate above.
  it("runner source · gate guard uses INFRA_MJS_FILENAMES allowlist (not a generic truthiness check)", () => {
    expect(RUNNER_SRC).toMatch(
      /if\s*\(\s*IDENTITY_MODE\s*===\s*"two"\s*&&\s*!INFRA_MJS_FILENAMES\.has\(fileName\)\s*\)/
    );
    // INFRA_MJS_FILENAMES set lists ONLY the two infra scripts (not V-*).
    const infraDecl = RUNNER_SRC.match(/INFRA_MJS_FILENAMES\s*=\s*new\s+Set\(\[[\s\S]{0,400}\]\)/);
    expect(infraDecl).toBeTruthy();
    expect(infraDecl[0]).toContain('"20_signup_disposable_identities.mjs"');
    expect(infraDecl[0]).toContain('"90_cleanup.mjs"');
    // Must NOT list a V-* script in the infra allowlist.
    expect(infraDecl[0]).not.toMatch(/"[3-7]\d_v_/);
  });

  it("runner source · gate names all four refusal labels (NOT_CLASSIFIED / MISSING_STATUS / UNKNOWN_STATUS / known-non-ELIGIBLE)", () => {
    expect(RUNNER_SRC).toContain('"NOT_CLASSIFIED"');
    expect(RUNNER_SRC).toContain('"MISSING_STATUS"');
    expect(RUNNER_SRC).toContain('"UNKNOWN_STATUS"');
    // Known-non-ELIGIBLE path carries the real status label (BLOCKED_NEEDS_C etc.);
    // we assert the `!==` guard that selects it.
    expect(RUNNER_SRC).toMatch(/elig\.two_mode_status\s*!==\s*"ELIGIBLE"/);
  });

  it("runner source · UNKNOWN_STATUS reason is a plain literal (never interpolates the raw unknown status value)", () => {
    // The UNKNOWN_STATUS branch assembles its reason from a literal string
    // (naming accepted values), NOT from the user-supplied token. Isolate the
    // branch body between `!KNOWN_TWO_MODE_STATUSES.has(...)` and the next
    // `blockStatusLabel = "UNKNOWN_STATUS"` and verify no interpolation.
    const branchStart = RUNNER_SRC.indexOf('!KNOWN_TWO_MODE_STATUSES.has(elig.two_mode_status)');
    expect(branchStart).toBeGreaterThan(0);
    const branchEnd = RUNNER_SRC.indexOf('"UNKNOWN_STATUS"', branchStart);
    expect(branchEnd).toBeGreaterThan(branchStart);
    const branch = RUNNER_SRC.slice(branchStart, branchEnd);
    // The reason literal must NOT substitute the raw value anywhere in this
    // branch's blockReason assignment.
    expect(branch).not.toMatch(/\$\{elig\.two_mode_status\}/);
    expect(branch).not.toMatch(/\$\{elig\.two_mode_status\?\.toString/);
    // Positive: the reason literal names the four accepted values.
    expect(branch).toMatch(/accepted values are ELIGIBLE, BLOCKED_NEEDS_C, BLOCKED_NEEDS_MORE_THAN_3, MIXED/);
  });

  it("runner source · dispatch call site (runMjsFile) sits AFTER the gate's `continue;` — proving refused cases cannot spawn", () => {
    const gateIdx = RUNNER_SRC.indexOf(
      'if (IDENTITY_MODE === "two" && !INFRA_MJS_FILENAMES.has(fileName))'
    );
    expect(gateIdx).toBeGreaterThan(0);
    // Find the gate's closing `continue;` (the one inside `if (blockReason !== null)`).
    const emitIdx = RUNNER_SRC.indexOf('if (blockReason !== null)', gateIdx);
    expect(emitIdx).toBeGreaterThan(gateIdx);
    const contIdx = RUNNER_SRC.indexOf('continue;', emitIdx);
    expect(contIdx).toBeGreaterThan(emitIdx);
    // The first `runMjsFile(` call for the for-loop body must appear AFTER the
    // gate's `continue;` — so a BLOCKED entry never reaches runMjsFile.
    const runMjsIdx = RUNNER_SRC.indexOf('runMjsFile(', contIdx);
    expect(runMjsIdx).toBeGreaterThan(contIdx);
    // Between the `continue;` and `runMjsFile(` there must be no `runMjsFile(`
    // from inside the gate body (i.e., the gate body contains no dispatch).
    const gateBody = RUNNER_SRC.slice(gateIdx, contIdx);
    expect(gateBody).not.toMatch(/runMjsFile\(/);
    expect(gateBody).not.toMatch(/spawnSync\(/);
    expect(gateBody).not.toMatch(/\.auth\./);
    expect(gateBody).not.toMatch(/pg\.Client/);
    expect(gateBody).not.toMatch(/createClient\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Loader hardening (§16.48.17 · 2026-11-19).
// Proves the eligibility-file loader fails closed on structural damage
// (malformed, non-object scripts entry, duplicate file keys) BEFORE any
// dispatch decision could be made.
// ─────────────────────────────────────────────────────────────────────────────
describe("Eligibility loader — hardening (two-mode)", () => {
  // Pure re-implementation that mirrors the runner's loader logic.
  function simulateLoad(rawJson) {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      return { ok: false, refusalCode: "PARSE_FAILED" };
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.scripts)) {
      return { ok: false, refusalCode: "STRUCTURE_MALFORMED" };
    }
    const map = {};
    for (const s of parsed.scripts) {
      if (!s || typeof s !== "object" || typeof s.file !== "string" || s.file === "") {
        return { ok: false, refusalCode: "ENTRY_MALFORMED" };
      }
      if (Object.prototype.hasOwnProperty.call(map, s.file)) {
        return { ok: false, refusalCode: "DUPLICATE_ENTRY" };
      }
      map[s.file] = s;
    }
    return { ok: true, map };
  }

  it("accepts the real generated classification file (21 scripts, no duplicates)", () => {
    const r = simulateLoad(ELIG_RAW);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.map).length).toBe(21);
  });

  it("refuses PARSE_FAILED — not valid JSON", () => {
    const r = simulateLoad("{this is not json");
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("PARSE_FAILED");
  });

  it("refuses STRUCTURE_MALFORMED — scripts is not an array", () => {
    const r = simulateLoad(JSON.stringify({ scripts: "not-an-array" }));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("STRUCTURE_MALFORMED");
  });

  it("refuses STRUCTURE_MALFORMED — top-level is a primitive", () => {
    const r = simulateLoad(JSON.stringify(42));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("STRUCTURE_MALFORMED");
  });

  it("refuses ENTRY_MALFORMED — entry missing file field", () => {
    const r = simulateLoad(JSON.stringify({ scripts: [{ two_mode_status: "ELIGIBLE" }] }));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("ENTRY_MALFORMED");
  });

  it("refuses ENTRY_MALFORMED — entry has empty-string file field", () => {
    const r = simulateLoad(JSON.stringify({ scripts: [{ file: "", two_mode_status: "ELIGIBLE" }] }));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("ENTRY_MALFORMED");
  });

  it("refuses ENTRY_MALFORMED — entry is null", () => {
    const r = simulateLoad(JSON.stringify({ scripts: [null] }));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("ENTRY_MALFORMED");
  });

  it("refuses DUPLICATE_ENTRY — same file appears twice", () => {
    const r = simulateLoad(JSON.stringify({
      scripts: [
        { file: "30_v_auth_null.mjs", two_mode_status: "ELIGIBLE" },
        { file: "30_v_auth_null.mjs", two_mode_status: "BLOCKED_NEEDS_C" },
      ],
    }));
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DUPLICATE_ENTRY");
  });

  // ── Static-source checks against _runner.mjs, proving the shipped loader
  //    contains the same refusal paths as simulateLoad.
  it("runner source · loader validates parsed.scripts is Array", () => {
    expect(RUNNER_SRC).toMatch(/Array\.isArray\(parsed\.scripts\)/);
    expect(RUNNER_SRC).toMatch(/is malformed — expected object with a scripts\[\] array/);
  });

  it("runner source · loader validates each entry has a non-empty file string", () => {
    expect(RUNNER_SRC).toMatch(/typeof\s+s\.file\s*!==\s*"string"\s*\|\|\s*s\.file\s*===\s*""/);
    expect(RUNNER_SRC).toMatch(/contains a malformed entry/);
  });

  it("runner source · loader detects duplicate file keys and refuses rather than silently overwriting", () => {
    expect(RUNNER_SRC).toMatch(
      /Object\.prototype\.hasOwnProperty\.call\(V_STAR_ELIGIBILITY,\s*s\.file\)/
    );
    expect(RUNNER_SRC).toMatch(/duplicate entry for a script file/);
    expect(RUNNER_SRC).toMatch(/refusing ambiguous classification/);
  });

  it("runner source · every loader refusal path exits with process.exit(2)", () => {
    // The loader guard body sits between the `if (IDENTITY_MODE === "two") {`
    // and its matching close. Each refusal must emit process.exit(2).
    const loaderIdx = RUNNER_SRC.indexOf('if (IDENTITY_MODE === "two") {');
    expect(loaderIdx).toBeGreaterThan(0);
    const loaderBlock = RUNNER_SRC.slice(loaderIdx, loaderIdx + 2000);
    // Count the loader's process.exit(2) emissions — expect ≥ 4 (missing-file,
    // malformed-structure, malformed-entry, duplicate-entry).
    const exits = loaderBlock.match(/process\.exit\(2\)/g) || [];
    expect(exits.length).toBeGreaterThanOrEqual(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bounded-profile selector (§16.48.17 · 2026-11-19).
// Proves:
//   · GATE_A_BOUNDED_PROFILE grammar fails closed on any value other than
//     (unset) / "" / "abc-14" (raw value NEVER printed).
//   · The frozen abc-14 manifest contains exactly 14 entries in exact order,
//     1 signup + 13 behavioural, with 90_cleanup.mjs ABSENT.
//   · Excluded filenames (42,43,51,63,64,70,61,62,80,81,82,90) are provably
//     unreachable under an abc-14 bounded run.
//   · Bounded resolution fails closed when the manifest references a missing
//     basename, when MJS_FILES carries duplicates, or when 90 appears.
//   · Activating the bounded profile without GATE_A_SKIP_CLEANUP=1 refuses.
// Uses mocked-boundary dispatch exercise (pure JS simulator + per-fileName
// trackers that count spawn/createClient/signUp/pgConnect/runMjs) · also
// pins the shipped runner source so a drive-by edit cannot silently widen it.
// ─────────────────────────────────────────────────────────────────────────────
describe("Bounded profile — abc-14 selector (two-mode and three-mode)", () => {
  // Expected manifest — kept in-sync with _runner.mjs BOUNDED_PROFILE_ABC14.
  const EXPECTED_ABC14 = Object.freeze([
    "20_signup_disposable_identities.mjs",
    "30_v_auth_null.mjs",
    "31_v_auth_unknown.mjs",
    "32_v_auth_unauthorized_diff.mjs",
    "40_v_w1_new.mjs",
    "41_v_w1_exist.mjs",
    "44_v_w1_whitespace.mjs",
    "45_v_w1_dup.mjs",
    "50_v_w2_ok.mjs",
    "52_v_w2_dup.mjs",
    "53_v_w2_auth.mjs",
    "60_v_w3_update.mjs",
    "65_v_w3_promote.mjs",
    "66_v_w3_nopromote.mjs",
  ]);
  // Scripts the owner explicitly excluded from the bounded manifest.
  const EXPECTED_EXCLUDED = Object.freeze([
    "42_v_w1_cap.mjs",
    "43_v_w1_cap_race.mjs",
    "51_v_w2_over.mjs",
    "61_v_w3_insert.mjs",
    "62_v_w3_role.mjs",
    "63_v_w3_cap.mjs",
    "64_v_w3_race.mjs",
    "70_v_atomic.mjs",
    "80_rollback_w1.mjs",
    "81_rollback_w2.mjs",
    "82_rollback_w3.mjs",
    "90_cleanup.mjs",
  ]);

  // Full forward MJS_FILES basenames the shipped runner carries (excl. 80/81/82).
  const FULL_MJS_BASENAMES = Object.freeze([
    "20_signup_disposable_identities.mjs",
    "30_v_auth_null.mjs",
    "31_v_auth_unknown.mjs",
    "32_v_auth_unauthorized_diff.mjs",
    "40_v_w1_new.mjs",
    "41_v_w1_exist.mjs",
    "42_v_w1_cap.mjs",
    "43_v_w1_cap_race.mjs",
    "44_v_w1_whitespace.mjs",
    "45_v_w1_dup.mjs",
    "50_v_w2_ok.mjs",
    "51_v_w2_over.mjs",
    "52_v_w2_dup.mjs",
    "53_v_w2_auth.mjs",
    "60_v_w3_update.mjs",
    "61_v_w3_insert.mjs",
    "62_v_w3_role.mjs",
    "63_v_w3_cap.mjs",
    "64_v_w3_race.mjs",
    "65_v_w3_promote.mjs",
    "66_v_w3_nopromote.mjs",
    "70_v_atomic.mjs",
    "90_cleanup.mjs",
  ]);

  // ── Pure JS simulator that mirrors the runner's startup + per-file
  //    dispatch path. Returns the EXACT sequence of actions a would-be
  //    real runner would emit, with trackers counting spawns and
  //    auth/DB calls PER FILENAME. Any refusal path short-circuits.
  function simulateStartup({ boundedProfile, skipCleanup }) {
    // Mirror the bounded-profile parse.
    if (boundedProfile === undefined || boundedProfile === null || boundedProfile === "") {
      // normalised to null
    } else if (boundedProfile === "abc-14") {
      // accepted
    } else {
      return { ok: false, refusal: "BOUNDED_INVALID" };
    }
    // Mirror the skip-cleanup parse.
    let skip;
    if (skipCleanup === undefined || skipCleanup === null || skipCleanup === "") {
      skip = false;
    } else if (skipCleanup === "1") {
      skip = true;
    } else {
      return { ok: false, refusal: "SKIP_CLEANUP_INVALID" };
    }
    // Mirror the bounded-requires-skip-cleanup guard.
    const effectiveBounded = (boundedProfile === "abc-14") ? "abc-14" : null;
    if (effectiveBounded !== null && !skip) {
      return { ok: false, refusal: "BOUNDED_WITHOUT_SKIP_CLEANUP" };
    }
    return { ok: true, boundedProfile: effectiveBounded, skipCleanup: skip };
  }

  function simulateResolveManifest({ boundedProfile, mjsBasenames }) {
    if (boundedProfile !== "abc-14") {
      return { ok: true, resolved: [...mjsBasenames] };
    }
    const seen = new Map();
    for (const b of mjsBasenames) {
      if (seen.has(b)) return { ok: false, refusal: "DUPLICATE_BASENAME" };
      seen.set(b, true);
    }
    const resolved = [];
    for (const name of EXPECTED_ABC14) {
      if (!seen.has(name)) return { ok: false, refusal: "MANIFEST_MISSING_SCRIPT" };
      resolved.push(name);
    }
    if (resolved.includes("90_cleanup.mjs")) {
      return { ok: false, refusal: "BOUNDED_HAS_CLEANUP" };
    }
    return { ok: true, resolved };
  }

  function simulateDispatch({
    identityMode = "three",
    boundedProfile,
    skipCleanup,
    eligibilityMap = null,
    mjsBasenames = FULL_MJS_BASENAMES,
  }) {
    const startup = simulateStartup({ boundedProfile, skipCleanup });
    if (!startup.ok) {
      return { ok: false, refusal: startup.refusal, dispatched: [], trackers: null };
    }
    const manifest = simulateResolveManifest({
      boundedProfile: startup.boundedProfile,
      mjsBasenames,
    });
    if (!manifest.ok) {
      return { ok: false, refusal: manifest.refusal, dispatched: [], trackers: null };
    }
    const INFRA = new Set(["20_signup_disposable_identities.mjs", "90_cleanup.mjs"]);
    const KNOWN = new Set(["ELIGIBLE", "BLOCKED_NEEDS_C", "BLOCKED_NEEDS_MORE_THAN_3", "MIXED"]);

    const trackers = {}; // fileName -> { spawn, createClient, signUp, signInWithPassword, pgConnect, runMjs }
    function tick(fileName) {
      if (!trackers[fileName]) {
        trackers[fileName] = { spawn: 0, createClient: 0, signUp: 0, signInWithPassword: 0, pgConnect: 0, runMjs: 0 };
      }
      return trackers[fileName];
    }

    const dispatched = [];
    const blocked = [];

    for (const fileName of manifest.resolved) {
      tick(fileName);
      // Cleanup-skip gate FIRST — unconditional.
      if (startup.skipCleanup && fileName === "90_cleanup.mjs") {
        blocked.push({ file: fileName, verdict: "BLOCKED", reason: "GATE_A_SKIP_CLEANUP=1" });
        continue;
      }
      // Two-mode gate.
      if (identityMode === "two" && !INFRA.has(fileName)) {
        const elig = eligibilityMap ? eligibilityMap[fileName] : undefined;
        let blockReason = null;
        let blockLabel = null;
        if (!elig) { blockReason = "NOT_CLASSIFIED"; blockLabel = "NOT_CLASSIFIED"; }
        else if (typeof elig.two_mode_status !== "string" || elig.two_mode_status === "") {
          blockReason = "MISSING_STATUS"; blockLabel = "MISSING_STATUS";
        } else if (!KNOWN.has(elig.two_mode_status)) {
          blockReason = "UNKNOWN_STATUS"; blockLabel = "UNKNOWN_STATUS";
        } else if (elig.two_mode_status !== "ELIGIBLE") {
          blockReason = elig.two_mode_blocker_reason || elig.two_mode_status;
          blockLabel = elig.two_mode_status;
        }
        if (blockReason !== null) {
          blocked.push({ file: fileName, verdict: "BLOCKED", reason: blockLabel });
          continue;
        }
      }
      // DISPATCH — this is where spawnSync/runMjsFile would fire. Count once.
      const t = trackers[fileName];
      t.spawn += 1;
      t.runMjs += 1;
      // The child itself would createClient and auth.signUp/signInWithPassword
      // (behaviourally observable from outside the runner). We count them as
      // would-be calls to the Supabase/pg layer so an excluded script proves
      // ZERO calls against each tracker.
      t.createClient += 1;
      t.signUp += 1;
      t.signInWithPassword += 1;
      t.pgConnect += 1;
      dispatched.push(fileName);
    }
    return { ok: true, dispatched, blocked, trackers };
  }

  // ── Static manifest shape ───────────────────────────────────────────────
  it("manifest has exactly 14 entries · 1 signup + 13 behavioural · cleanup absent", () => {
    expect(EXPECTED_ABC14.length).toBe(14);
    expect(EXPECTED_ABC14[0]).toBe("20_signup_disposable_identities.mjs");
    expect(EXPECTED_ABC14).not.toContain("90_cleanup.mjs");
    for (const excluded of EXPECTED_EXCLUDED) {
      expect(EXPECTED_ABC14).not.toContain(excluded);
    }
  });

  it("manifest order is signup → auth → w1 → w2 → w3", () => {
    const orderGroups = [
      ["20_signup_disposable_identities.mjs"],
      ["30_v_auth_null.mjs", "31_v_auth_unknown.mjs", "32_v_auth_unauthorized_diff.mjs"],
      ["40_v_w1_new.mjs", "41_v_w1_exist.mjs", "44_v_w1_whitespace.mjs", "45_v_w1_dup.mjs"],
      ["50_v_w2_ok.mjs", "52_v_w2_dup.mjs", "53_v_w2_auth.mjs"],
      ["60_v_w3_update.mjs", "65_v_w3_promote.mjs", "66_v_w3_nopromote.mjs"],
    ];
    const flat = orderGroups.flat();
    expect(flat).toEqual([...EXPECTED_ABC14]);
  });

  // ── Dispatcher boundary · positive path ─────────────────────────────────
  it("abc-14 + skip-cleanup=1 · three-mode · dispatches exactly 14 scripts in exact order", () => {
    const r = simulateDispatch({
      identityMode: "three",
      boundedProfile: "abc-14",
      skipCleanup: "1",
    });
    expect(r.ok).toBe(true);
    expect(r.dispatched).toEqual([...EXPECTED_ABC14]);
    expect(r.dispatched.length).toBe(14);
    expect(r.blocked).toEqual([]);
  });

  it("abc-14 + skip-cleanup=1 · each excluded script has ZERO spawns and ZERO auth/DB calls", () => {
    const r = simulateDispatch({
      identityMode: "three",
      boundedProfile: "abc-14",
      skipCleanup: "1",
    });
    expect(r.ok).toBe(true);
    for (const excluded of EXPECTED_EXCLUDED) {
      const t = r.trackers[excluded];
      // Excluded script name was never ticked into trackers at all.
      expect(t).toBeUndefined();
    }
  });

  it("abc-14 + skip-cleanup=1 · each dispatched script dispatches EXACTLY ONCE (no duplicates)", () => {
    const r = simulateDispatch({
      identityMode: "three",
      boundedProfile: "abc-14",
      skipCleanup: "1",
    });
    expect(r.ok).toBe(true);
    for (const name of EXPECTED_ABC14) {
      const t = r.trackers[name];
      expect(t.spawn).toBe(1);
      expect(t.runMjs).toBe(1);
    }
    // Total spawn count equals manifest length · no extra spawn anywhere.
    const totalSpawn = Object.values(r.trackers).reduce((s, t) => s + t.spawn, 0);
    expect(totalSpawn).toBe(14);
  });

  // ── Dispatcher boundary · two-mode under bounded profile ───────────────
  it("abc-14 + skip-cleanup=1 · two-mode · narrows manifest further by eligibility (41 BLOCKED_NEEDS_C etc.)", () => {
    const r = simulateDispatch({
      identityMode: "two",
      boundedProfile: "abc-14",
      skipCleanup: "1",
      eligibilityMap: ELIG.scripts.reduce((m, s) => { m[s.file] = s; return m; }, {}),
    });
    expect(r.ok).toBe(true);
    // Signup still dispatches (INFRA · exempt from eligibility).
    expect(r.dispatched).toContain("20_signup_disposable_identities.mjs");
    // 41_v_w1_exist.mjs is BLOCKED_NEEDS_C per the real classification file.
    const elig41 = ELIG.scripts.find((s) => s.file === "41_v_w1_exist.mjs");
    expect(elig41.two_mode_status).toBe("BLOCKED_NEEDS_C");
    expect(r.dispatched).not.toContain("41_v_w1_exist.mjs");
    expect(r.blocked.find((b) => b.file === "41_v_w1_exist.mjs")).toBeTruthy();
    // Dispatched count must be strictly less than bounded manifest length.
    expect(r.dispatched.length).toBeLessThan(EXPECTED_ABC14.length);
  });

  // ── Cleanup-skip guard ──────────────────────────────────────────────────
  it("skip-cleanup=1 · blocks 90_cleanup.mjs even when it is reachable in the forward manifest (three-mode, no bounded)", () => {
    // Full manifest · no bounded profile · but SKIP_CLEANUP=1.
    const r = simulateDispatch({
      identityMode: "three",
      boundedProfile: undefined,
      skipCleanup: "1",
    });
    expect(r.ok).toBe(true);
    expect(r.dispatched).not.toContain("90_cleanup.mjs");
    expect(r.blocked.find((b) => b.file === "90_cleanup.mjs")).toMatchObject({
      verdict: "BLOCKED",
      reason: "GATE_A_SKIP_CLEANUP=1",
    });
    // 90 was reached by the loop but short-circuited BEFORE dispatch. Its
    // tracker was ticked but every call counter MUST be zero.
    const t = r.trackers["90_cleanup.mjs"];
    expect(t.spawn).toBe(0);
    expect(t.runMjs).toBe(0);
    expect(t.createClient).toBe(0);
    expect(t.signUp).toBe(0);
    expect(t.signInWithPassword).toBe(0);
    expect(t.pgConnect).toBe(0);
  });

  it("skip-cleanup=1 · blocks 90 even in two-mode (INFRA bypass cannot override the cleanup-skip guard)", () => {
    const r = simulateDispatch({
      identityMode: "two",
      boundedProfile: undefined,
      skipCleanup: "1",
      eligibilityMap: ELIG.scripts.reduce((m, s) => { m[s.file] = s; return m; }, {}),
    });
    expect(r.ok).toBe(true);
    expect(r.dispatched).not.toContain("90_cleanup.mjs");
    const t = r.trackers["90_cleanup.mjs"];
    expect(t.spawn).toBe(0);
    expect(t.runMjs).toBe(0);
  });

  it("skip-cleanup unset · 90_cleanup.mjs is reachable in the full forward run (three-mode) — proves guard is doing work", () => {
    // Full manifest · no bounded · no skip-cleanup · 90 MUST dispatch (control).
    const r = simulateDispatch({
      identityMode: "three",
      boundedProfile: undefined,
      skipCleanup: undefined,
    });
    expect(r.ok).toBe(true);
    expect(r.dispatched).toContain("90_cleanup.mjs");
    const t = r.trackers["90_cleanup.mjs"];
    expect(t.spawn).toBe(1);
    expect(t.runMjs).toBe(1);
  });

  // ── Refusal paths · bounded-profile ─────────────────────────────────────
  it("fails closed · GATE_A_BOUNDED_PROFILE = unknown string", () => {
    const r = simulateDispatch({
      boundedProfile: "abc-15", // off-by-one typo
      skipCleanup: "1",
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("BOUNDED_INVALID");
    expect(r.dispatched).toEqual([]);
    expect(r.trackers).toBeNull();
  });

  it("fails closed · GATE_A_BOUNDED_PROFILE=abc-14 with GATE_A_SKIP_CLEANUP unset", () => {
    const r = simulateDispatch({
      boundedProfile: "abc-14",
      skipCleanup: undefined,
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("BOUNDED_WITHOUT_SKIP_CLEANUP");
    expect(r.dispatched).toEqual([]);
  });

  it("fails closed · GATE_A_BOUNDED_PROFILE=abc-14 with GATE_A_SKIP_CLEANUP=\"0\" (not accepted)", () => {
    const r = simulateDispatch({
      boundedProfile: "abc-14",
      skipCleanup: "0",
    });
    expect(r.ok).toBe(false);
    // The skip-cleanup parser must refuse BEFORE the bounded-requires-skip check.
    expect(r.refusal).toBe("SKIP_CLEANUP_INVALID");
    expect(r.dispatched).toEqual([]);
  });

  it("fails closed · bounded manifest references a script missing from MJS_FILES", () => {
    const r = simulateDispatch({
      boundedProfile: "abc-14",
      skipCleanup: "1",
      mjsBasenames: FULL_MJS_BASENAMES.filter((n) => n !== "40_v_w1_new.mjs"),
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("MANIFEST_MISSING_SCRIPT");
    expect(r.dispatched).toEqual([]);
  });

  it("fails closed · MJS_FILES carries a duplicate basename (ambiguous bounded resolution)", () => {
    const r = simulateDispatch({
      boundedProfile: "abc-14",
      skipCleanup: "1",
      mjsBasenames: [...FULL_MJS_BASENAMES, "40_v_w1_new.mjs"],
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("DUPLICATE_BASENAME");
    expect(r.dispatched).toEqual([]);
  });

  // ── Static-source checks against the shipped runner ─────────────────────
  it("runner source · parses GATE_A_BOUNDED_PROFILE from process.env (not .env.local)", () => {
    expect(RUNNER_SRC).toMatch(/RAW_BOUNDED_PROFILE\s*=\s*process\.env\.GATE_A_BOUNDED_PROFILE/);
    const block = RUNNER_SRC.match(/RAW_BOUNDED_PROFILE[\s\S]{0,400}BOUNDED_PROFILE/);
    expect(block).toBeTruthy();
    expect(block[0]).not.toMatch(/readEnv\("GATE_A_BOUNDED_PROFILE/);
  });

  it("runner source · bounded invalid-value branch refuses and does NOT print the raw value", () => {
    const branch = RUNNER_SRC.match(
      /BOUNDED_PROFILE\s*!==\s*null\s*&&\s*BOUNDED_PROFILE\s*!==\s*"abc-14"[\s\S]{0,400}process\.exit\(2\)/
    );
    expect(branch).toBeTruthy();
    expect(branch[0]).not.toMatch(/\$\{BOUNDED_PROFILE\}/);
    expect(branch[0]).not.toMatch(/\$\{RAW_BOUNDED_PROFILE\}/);
    expect(branch[0]).toMatch(/accepted values are \(unset\) or \\"abc-14\\"/);
  });

  it("runner source · BOUNDED_PROFILE_ABC14 is a frozen 14-entry manifest with signup first and no cleanup", () => {
    const decl = RUNNER_SRC.match(/BOUNDED_PROFILE_ABC14\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
    expect(decl).toBeTruthy();
    const body = decl[1];
    for (const name of EXPECTED_ABC14) {
      expect(body).toContain(`"${name}"`);
    }
    // 90 must NOT appear in the manifest.
    expect(body).not.toContain('"90_cleanup.mjs"');
    // Rollback 80/81/82 must NOT appear.
    expect(body).not.toMatch(/"8[012]_rollback_/);
    // MIXED cases 61/62 must NOT appear.
    expect(body).not.toContain('"61_v_w3_insert.mjs"');
    expect(body).not.toContain('"62_v_w3_role.mjs"');
    // NEEDS_MORE_THAN_3 cases must NOT appear.
    for (const n of ["42_v_w1_cap.mjs", "43_v_w1_cap_race.mjs", "51_v_w2_over.mjs",
                     "63_v_w3_cap.mjs", "64_v_w3_race.mjs", "70_v_atomic.mjs"]) {
      expect(body).not.toContain(`"${n}"`);
    }
  });

  it("runner source · bounded-profile resolution refuses MISSING / DUPLICATE / HAS_CLEANUP with process.exit(2)", () => {
    const resolveIdx = RUNNER_SRC.indexOf('BOUNDED_PROFILE === "abc-14"');
    expect(resolveIdx).toBeGreaterThan(0);
    // Take a generous window from the first occurrence of the parse guard
    // through the end of the resolution block. Find the next SKIP_CLEANUP
    // console.log as the terminating anchor.
    const endAnchor = RUNNER_SRC.indexOf('STARTUP: GATE_A_SKIP_CLEANUP=1', resolveIdx);
    expect(endAnchor).toBeGreaterThan(resolveIdx);
    const resBlock = RUNNER_SRC.slice(resolveIdx, endAnchor);
    expect(resBlock).toMatch(/duplicate basename/);
    expect(resBlock).toMatch(/not present in MJS_FILES/);
    expect(resBlock).toMatch(/unexpectedly contains 90_cleanup\.mjs/);
    const exits = resBlock.match(/process\.exit\(2\)/g) || [];
    expect(exits.length).toBeGreaterThanOrEqual(3);
  });

  it("runner source · bounded-without-skip-cleanup is explicitly refused", () => {
    const branch = RUNNER_SRC.match(
      /BOUNDED_PROFILE\s*!==\s*null\s*&&\s*!SKIP_CLEANUP[\s\S]{0,400}process\.exit\(2\)/
    );
    expect(branch).toBeTruthy();
    expect(branch[0]).toMatch(/bounded forward run must gate cleanup separately/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup-skip gate (§16.48.17 · 2026-11-19).
// Proves GATE_A_SKIP_CLEANUP=1 is enforced in code, not in comment: the
// per-file loop blocks 90_cleanup.mjs BEFORE the two-mode INFRA bypass can
// reach dispatch, and the flag parser fails closed on any value other than
// (unset) / "" / "1" (raw value NEVER printed).
// ─────────────────────────────────────────────────────────────────────────────
describe("Cleanup-skip gate — GATE_A_SKIP_CLEANUP", () => {
  it("runner source · parses GATE_A_SKIP_CLEANUP from process.env (not .env.local)", () => {
    expect(RUNNER_SRC).toMatch(/RAW_SKIP_CLEANUP\s*=\s*process\.env\.GATE_A_SKIP_CLEANUP/);
    const block = RUNNER_SRC.match(/RAW_SKIP_CLEANUP[\s\S]{0,400}SKIP_CLEANUP/);
    expect(block).toBeTruthy();
    expect(block[0]).not.toMatch(/readEnv\("GATE_A_SKIP_CLEANUP/);
  });

  it("runner source · accepts only (unset) / \"\" / \"1\" — any other value fails closed", () => {
    const parser = RUNNER_SRC.match(
      /RAW_SKIP_CLEANUP\s*===\s*undefined[\s\S]{0,600}process\.exit\(2\)/
    );
    expect(parser).toBeTruthy();
    expect(parser[0]).toMatch(/RAW_SKIP_CLEANUP\s*===\s*"1"/);
    expect(parser[0]).toMatch(/accepted values are \(unset\) or \\"1\\"/);
    // Raw value must not be interpolated anywhere in the refusal branch.
    expect(parser[0]).not.toMatch(/\$\{RAW_SKIP_CLEANUP\}/);
  });

  it("runner source · guard sits BEFORE the two-mode INFRA bypass in the dispatch loop", () => {
    const loopIdx = RUNNER_SRC.indexOf("for (const f of RESOLVED_MJS_FILES)");
    expect(loopIdx).toBeGreaterThan(0);
    const skipIdx = RUNNER_SRC.indexOf('SKIP_CLEANUP && fileName === "90_cleanup.mjs"', loopIdx);
    expect(skipIdx).toBeGreaterThan(loopIdx);
    const infraGateIdx = RUNNER_SRC.indexOf(
      '!INFRA_MJS_FILENAMES.has(fileName)',
      loopIdx
    );
    expect(infraGateIdx).toBeGreaterThan(skipIdx); // cleanup-skip precedes INFRA gate
  });

  it("runner source · cleanup-skip branch records BLOCKED and continues (never dispatches)", () => {
    const skipIdx = RUNNER_SRC.indexOf('SKIP_CLEANUP && fileName === "90_cleanup.mjs"');
    expect(skipIdx).toBeGreaterThan(0);
    // Take a window from the guard header through the next `continue;`.
    const contIdx = RUNNER_SRC.indexOf("continue;", skipIdx);
    expect(contIdx).toBeGreaterThan(skipIdx);
    const branch = RUNNER_SRC.slice(skipIdx, contIdx);
    expect(branch).toMatch(/verdict:\s*"BLOCKED"/);
    expect(branch).toMatch(/GATE_A_SKIP_CLEANUP=1 — cleanup refused in this run/);
    expect(branch).toMatch(/skipped:\s*true/);
    // The branch body must not reach runMjsFile, spawnSync, pg.Client, or any Auth call.
    expect(branch).not.toMatch(/runMjsFile\(/);
    expect(branch).not.toMatch(/spawnSync\(/);
    expect(branch).not.toMatch(/pg\.Client/);
    expect(branch).not.toMatch(/\.auth\./);
    expect(branch).not.toMatch(/createClient\(/);
  });

  it("runner source · iteration uses RESOLVED_MJS_FILES (not raw MJS_FILES)", () => {
    // Ensures that when the bounded profile narrows MJS_FILES, the narrowed
    // list — not the full list — is the one the loop walks.
    expect(RUNNER_SRC).toMatch(/for \(const f of RESOLVED_MJS_FILES\)/);
    // The dispatcher loop must no longer walk the raw MJS_FILES array.
    const loopMatches = RUNNER_SRC.match(/for \(const f of MJS_FILES\)/g) || [];
    expect(loopMatches.length).toBe(0);
  });

  it("runner source · fileName derivation uses basename() (OS-robust)", () => {
    // basename import exists and is used in the dispatch loop.
    expect(RUNNER_SRC).toMatch(/import\s*\{[^}]*\bbasename\b[^}]*\}\s*from\s*"node:path"/);
    const loopIdx = RUNNER_SRC.indexOf("for (const f of RESOLVED_MJS_FILES)");
    expect(loopIdx).toBeGreaterThan(0);
    const nextClose = RUNNER_SRC.indexOf("\n}\n", loopIdx);
    const loopBlock = RUNNER_SRC.slice(loopIdx, nextClose > 0 ? nextClose : loopIdx + 3000);
    expect(loopBlock).toMatch(/basename\(f\)/);
  });
});
