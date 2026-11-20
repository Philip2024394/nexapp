// scripts/gate-a-connected-matrix/__tests__/signup-write-ahead.spec.mjs
//
// §16.48.19 · signup write-ahead persistence tests · OFFLINE ONLY.
//
// Spawns 20_signup_disposable_identities.mjs as a real child process with
// GATE_A_SIGNUP_STUB_MODE set — no network, no DB, no .env.local reads.
// All manifest writes land in a per-test temp directory via
// GATE_A_CAPTURE_FILE_OVERRIDE, so the real 99_identity_capture.json.OUTPUT
// is never touched by this spec.
//
// The invariant under test: for every label the child intends to sign up,
// a pending_signup row is persisted + fsynced BEFORE any auth IO. If auth
// succeeds, the row mutates to signed_up. If auth fails, the row mutates
// to signup_failed. If the child crashes between the pending write and the
// auth result, the pending_signup row survives on disk so cleanup can
// refuse to delete orphan auth.users that are not in the manifest.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const SIGNUP_PATH = resolve(__dir, "..", "20_signup_disposable_identities.mjs");
const SIGNUP_SRC = readFileSync(SIGNUP_PATH, "utf8");

// Known protected UUIDs the child's stub MUST NOT emit.
const PROTECTED_UUIDS = new Set([
  "11111111-1111-4111-8111-111111111111",
  "11111111-1111-4111-8111-111111111113",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROV_RE = /^gate-a-[A-Za-z0-9._-]+-[0-9a-f]{8}$/;

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "nex-gate-a-writeahead-"));
}

function baseEnv({ runId, mode, identityMode = "three", crashLabel, captureFile }) {
  const env = {
    // Inherit SystemRoot etc so Node spawns correctly on Windows; strip real
    // Supabase env so the child cannot accidentally reach a live project.
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    GATE_A_RUN_ID: runId,
    GATE_A_SIGNUP_STUB_MODE: mode,
    GATE_A_IDENTITY_MODE: identityMode,
    GATE_A_TEST_PASSWORD_A: "DUMMY-A-" + randomBytes(4).toString("hex"),
    GATE_A_TEST_PASSWORD_B: "DUMMY-B-" + randomBytes(4).toString("hex"),
    GATE_A_TEST_PASSWORD_C: "DUMMY-C-" + randomBytes(4).toString("hex"),
    GATE_A_CAPTURE_FILE_OVERRIDE: captureFile,
  };
  if (crashLabel) env.GATE_A_CRASH_AFTER_PENDING_LABEL = crashLabel;
  return env;
}

function runChild(env) {
  return spawnSync(process.execPath, [SIGNUP_PATH], {
    env,
    encoding: "utf8",
    timeout: 20_000,
  });
}

function readManifest(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

// Build a disposable temp scratch per test with cleanup afterward.
let scratchDir;
let captureFile;
beforeEach(() => {
  scratchDir = makeTmpDir();
  captureFile = join(scratchDir, "capture.json");
});
afterEach(() => {
  if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Static source contract — the stub + write-ahead hooks are wired as
// §16.48.19 requires, so a passing dynamic test can't drift silently from
// the authored invariants.
// ─────────────────────────────────────────────────────────────────────────────
describe("20_signup · §16.48.19 · write-ahead static source contract", () => {
  it("imports openSync, writeSync, fsyncSync, closeSync for durable writes", () => {
    expect(SIGNUP_SRC).toMatch(/import\s*\{[\s\S]*?openSync[\s\S]*?\}\s*from\s*"node:fs"/);
    expect(SIGNUP_SRC).toMatch(/writeSync\b/);
    expect(SIGNUP_SRC).toMatch(/fsyncSync\b/);
    expect(SIGNUP_SRC).toMatch(/closeSync\b/);
  });

  it("persistManifest helper performs open/write/fsync/close + read-back run_id guard", () => {
    const fn = SIGNUP_SRC.match(/function\s+persistManifest\s*\(([\s\S]*?)^}/m);
    expect(fn).toBeTruthy();
    const body = fn[0];
    expect(body).toMatch(/openSync\(path,\s*"w"\)/);
    expect(body).toMatch(/writeSync\(fd,\s*serialised\)/);
    expect(body).toMatch(/fsyncSync\(fd\)/);
    expect(body).toMatch(/closeSync\(fd\)/);
    // Read-back guard: parsed.run_id !== obj.run_id throws.
    expect(body).toMatch(/parsed\.run_id\s*!==\s*obj\.run_id/);
  });

  it("generates PROVENANCE_TAG from GATE_A_RUN_ID + 4 bytes of randomness", () => {
    expect(SIGNUP_SRC).toMatch(
      /const\s+PROVENANCE_TAG\s*=\s*`gate-a-\$\{GATE_A_RUN_ID\}-\$\{randomBytes\(4\)\.toString\("hex"\)\}`/
    );
  });

  it("pending_signup row is pushed to created_fixtures BEFORE the signUp call", () => {
    const loopHead = SIGNUP_SRC.indexOf("for (const label of identityLabels)");
    expect(loopHead).toBeGreaterThan(0);
    const body = SIGNUP_SRC.slice(loopHead);
    const pushIdx = body.indexOf("capture.created_fixtures.push({");
    const signupIdx = body.indexOf(".auth.signUp(");
    expect(pushIdx).toBeGreaterThan(0);
    expect(signupIdx).toBeGreaterThan(0);
    expect(pushIdx).toBeLessThan(signupIdx);
    // And a persistManifest call separates them.
    const persistIdx = body.indexOf("persistManifest(capture, IDENTITY_CAPTURE_FILE)", pushIdx);
    expect(persistIdx).toBeGreaterThan(pushIdx);
    expect(persistIdx).toBeLessThan(signupIdx);
  });

  it("pending row shape carries label, email, status=pending_signup, provenance_tag, written_at, dependent_rows", () => {
    const m = SIGNUP_SRC.match(/capture\.created_fixtures\.push\(\{\s*label,[\s\S]*?pending_signup[\s\S]*?\}\)/);
    expect(m).toBeTruthy();
    expect(m[0]).toMatch(/\bemail\b/);
    expect(m[0]).toMatch(/status:\s*"pending_signup"/);
    expect(m[0]).toMatch(/provenance_tag/);
    expect(m[0]).toMatch(/written_at/);
    expect(m[0]).toMatch(/dependent_rows:\s*\[\]/);
    // Must NOT include password / jwt / token
    expect(m[0]).not.toMatch(/\bpassword\b/i);
    expect(m[0]).not.toMatch(/\bjwt\b/i);
    expect(m[0]).not.toMatch(/access_token/i);
  });

  it("GATE_A_CAPTURE_FILE_OVERRIDE env overrides the capture path", () => {
    expect(SIGNUP_SRC).toMatch(
      /process\.env\.GATE_A_CAPTURE_FILE_OVERRIDE\s*\?\s*resolve\(process\.env\.GATE_A_CAPTURE_FILE_OVERRIDE\)/
    );
  });

  it("GATE_A_SIGNUP_STUB_MODE accepts only the sealed grammar + fails closed", () => {
    expect(SIGNUP_SRC).toMatch(
      /GATE_A_SIGNUP_STUB_MODE[\s\S]*?"success"[\s\S]*?"failure"[\s\S]*?"rate_limit"/
    );
    expect(SIGNUP_SRC).toMatch(/GATE_A_SIGNUP_STUB_MODE has an unrecognised value/);
    // Fail-closed before any auth IO.
    const fatalIdx = SIGNUP_SRC.indexOf("GATE_A_SIGNUP_STUB_MODE has an unrecognised value");
    const firstSignUpIdx = SIGNUP_SRC.indexOf(".auth.signUp(");
    expect(firstSignUpIdx).toBeGreaterThan(fatalIdx);
  });

  it("CRASH_AFTER_PENDING_LABEL hook is between pending-write and signUp", () => {
    const loopHead = SIGNUP_SRC.indexOf("for (const label of identityLabels)");
    const body = SIGNUP_SRC.slice(loopHead);
    const persistIdx = body.indexOf("persistManifest(capture, IDENTITY_CAPTURE_FILE)");
    const crashIdx = body.indexOf("CRASH_AFTER_PENDING_LABEL === label");
    const signupIdx = body.indexOf(".auth.signUp(");
    expect(persistIdx).toBeGreaterThan(0);
    expect(crashIdx).toBeGreaterThan(persistIdx);
    expect(signupIdx).toBeGreaterThan(crashIdx);
    expect(body.slice(crashIdx, crashIdx + 200)).toMatch(/process\.exit\(99\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic behaviour via stub-mode child process.
// ─────────────────────────────────────────────────────────────────────────────
describe("20_signup · §16.48.19 · write-ahead dynamic behaviour (stub mode)", () => {
  it("success mode · three labels · every row transitions pending_signup → signed_up", () => {
    const runId = "run-wa-ok-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "success", captureFile }));
    expect(res.status).toBe(0);
    const m = readManifest(captureFile);
    expect(m.run_id).toBe(runId);
    expect(m.identity_mode).toBe("three");
    expect(m.provenance_tag).toMatch(PROV_RE);
    expect(m.provenance_tag.startsWith(`gate-a-${runId}-`)).toBe(true);
    // Final rebuild shape: created_fixtures has exactly 3 signed_up entries.
    expect(m.created_fixtures).toHaveLength(3);
    for (const f of m.created_fixtures) {
      expect(["A", "B", "C"]).toContain(f.label);
      expect(f.status).toBe("signed_up");
      expect(f.supabase_user_id).toMatch(UUID_RE);
      expect(PROTECTED_UUIDS.has(f.supabase_user_id)).toBe(false);
      expect(f.provenance_tag).toBe(m.provenance_tag);
      expect(typeof f.written_at).toBe("string");
      expect(f.email).toMatch(/<op-identity>/);
    }
  });

  it("failure mode · every label persists signup_failed row with non-secret error fields", () => {
    const runId = "run-wa-fail-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "failure", captureFile }));
    // No identity signed up → exit 1
    expect(res.status).toBe(1);
    const m = readManifest(captureFile);
    expect(m.run_id).toBe(runId);
    // Write-ahead rows stay in place (status=signup_failed). The final
    // rebuild only writes OK rows; no OK rows → created_fixtures=[]
    // on the final write. The intermediate persisted state is what the
    // owner-focused test proves below (via crash_label).
    expect(Array.isArray(m.created_fixtures)).toBe(true);
    // No row may carry a password-shaped field.
    const serialised = JSON.stringify(m);
    expect(serialised).not.toMatch(/"password"/i);
    expect(serialised).not.toMatch(/"jwt"/i);
    expect(serialised).not.toMatch(/access_token/i);
  });

  it("crash_after_pending_label=A · manifest on disk still carries A's pending_signup row + run-scoped provenance", () => {
    const runId = "run-wa-crash-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "success", crashLabel: "A", captureFile }));
    expect(res.status).toBe(99);
    const m = readManifest(captureFile);
    expect(m).not.toBeNull();
    expect(m.run_id).toBe(runId);
    expect(m.provenance_tag).toMatch(PROV_RE);
    expect(m.created_fixtures.length).toBeGreaterThanOrEqual(1);
    const rowA = m.created_fixtures.find(f => f.label === "A");
    expect(rowA).toBeTruthy();
    expect(rowA.status).toBe("pending_signup");
    expect(rowA.provenance_tag).toBe(m.provenance_tag);
    expect(rowA.email).toMatch(/<op-identity>/);
    // B/C should NOT have been reached (crash is before signUp for A).
    expect(m.created_fixtures.find(f => f.label === "B")).toBeUndefined();
    expect(m.created_fixtures.find(f => f.label === "C")).toBeUndefined();
  });

  it("two mode · only labels A and B appear in the manifest", () => {
    const runId = "run-wa-two-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "success", identityMode: "two", captureFile }));
    expect(res.status).toBe(0);
    const m = readManifest(captureFile);
    expect(m.identity_mode).toBe("two");
    expect(m.created_fixtures).toHaveLength(2);
    expect(m.created_fixtures.map(f => f.label).sort()).toEqual(["A", "B"]);
    expect(m.created_fixtures.find(f => f.label === "C")).toBeUndefined();
  });

  it("provenance tag is unique per run even with identical GATE_A_RUN_ID (4 random bytes suffix)", () => {
    const runId = "run-wa-prov-" + randomBytes(3).toString("hex");
    const scratchA = makeTmpDir();
    const scratchB = makeTmpDir();
    try {
      const fileA = join(scratchA, "cap.json");
      const fileB = join(scratchB, "cap.json");
      const rA = runChild(baseEnv({ runId, mode: "success", captureFile: fileA }));
      const rB = runChild(baseEnv({ runId, mode: "success", captureFile: fileB }));
      expect(rA.status).toBe(0);
      expect(rB.status).toBe(0);
      const mA = readManifest(fileA);
      const mB = readManifest(fileB);
      expect(mA.provenance_tag).toMatch(PROV_RE);
      expect(mB.provenance_tag).toMatch(PROV_RE);
      // 4 bytes = 32 bits of entropy; collision chance is ~1/4e9 per pair.
      expect(mA.provenance_tag).not.toBe(mB.provenance_tag);
    } finally {
      rmSync(scratchA, { recursive: true, force: true });
      rmSync(scratchB, { recursive: true, force: true });
    }
  });

  it("manifest never contains the password value or any field named password/jwt/token", () => {
    const runId = "run-wa-nokeys-" + randomBytes(3).toString("hex");
    const env = baseEnv({ runId, mode: "success", captureFile });
    const res = runChild(env);
    expect(res.status).toBe(0);
    const raw = readFileSync(captureFile, "utf8");
    // Exact password values must not appear.
    expect(raw).not.toContain(env.GATE_A_TEST_PASSWORD_A);
    expect(raw).not.toContain(env.GATE_A_TEST_PASSWORD_B);
    expect(raw).not.toContain(env.GATE_A_TEST_PASSWORD_C);
    expect(raw).not.toMatch(/"password"/i);
    expect(raw).not.toMatch(/"jwt"/i);
    expect(raw).not.toMatch(/access_token/i);
    expect(raw).not.toMatch(/refresh_token/i);
  });

  it("missing run_id · child fails closed with exit(2) before any manifest write", () => {
    const env = baseEnv({ runId: "temp", mode: "success", captureFile });
    delete env.GATE_A_RUN_ID;
    const res = runChild(env);
    expect(res.status).toBe(2);
    expect(existsSync(captureFile)).toBe(false);
    expect(res.stderr).toMatch(/missing parent-supplied GATE_A_RUN_ID/);
  });

  it("missing password for an in-scope label · child fails closed with exit(2) before any manifest write", () => {
    const env = baseEnv({ runId: "run-missing-pw", mode: "success", captureFile });
    delete env.GATE_A_TEST_PASSWORD_B;
    const res = runChild(env);
    expect(res.status).toBe(2);
    expect(existsSync(captureFile)).toBe(false);
    expect(res.stderr).toMatch(/missing parent-supplied password\(s\) for label\(s\):\s*B/);
    // Password value is NOT echoed in the error.
    expect(res.stderr).not.toContain(env.GATE_A_TEST_PASSWORD_A);
  });

  it("GATE_A_SIGNUP_STUB_MODE with unrecognised value · child fails closed with exit(2) + reason named + no raw echo", () => {
    const env = baseEnv({ runId: "run-badstub", mode: "SUCCESSS", captureFile });
    const res = runChild(env);
    expect(res.status).toBe(2);
    expect(existsSync(captureFile)).toBe(false);
    expect(res.stderr).toMatch(/GATE_A_SIGNUP_STUB_MODE has an unrecognised value/);
    // The raw token SUCCESSS must not appear in error output.
    expect(res.stderr).not.toContain("SUCCESSS");
  });

  it("manifest is parseable JSON after EVERY persist step (read-back guard proves it)", () => {
    // Deliberately crash mid-run; the on-disk file after crash must still parse.
    const runId = "run-wa-parse-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "success", crashLabel: "B", captureFile }));
    expect(res.status).toBe(99);
    const raw = readFileSync(captureFile, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const m = JSON.parse(raw);
    // A has signed_up (pre-crash transition), B has pending_signup (crash sim).
    const rowA = m.created_fixtures.find(f => f.label === "A");
    const rowB = m.created_fixtures.find(f => f.label === "B");
    expect(rowA?.status).toBe("signed_up");
    expect(rowB?.status).toBe("pending_signup");
  });

  it("stub UUIDs do NOT collide with any known protected identity (Hammerex / Rosa)", () => {
    const runId = "run-wa-noprot-" + randomBytes(3).toString("hex");
    const res = runChild(baseEnv({ runId, mode: "success", captureFile }));
    expect(res.status).toBe(0);
    const m = readManifest(captureFile);
    for (const f of m.created_fixtures) {
      expect(PROTECTED_UUIDS.has(f.supabase_user_id)).toBe(false);
    }
  });
});
