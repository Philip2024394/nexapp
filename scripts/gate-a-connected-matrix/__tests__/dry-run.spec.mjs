// scripts/gate-a-connected-matrix/__tests__/dry-run.spec.mjs
//
// Offline tests for the §16.48.18 GATE_A_DRY_RUN selector.
// Authored by Agent 1 · Lane G Gate A · 2026-11-20.
//
// Strategy: invoke the REAL _runner.mjs as a child process via spawnSync
// under the GATE_A_DRY_RUN=1 flag and inspect its output JSON + stdout.
// No simulateDispatch(). The dry-run short-circuit MUST execute before any
// SQL_FILES or MJS_FILES dispatch — zero pg.Client.connect(), zero
// createClient(), zero child spawnSync for V-* children.
//
// The existing _results.json.OUTPUT (which may hold §16.48.15 round-2 429
// evidence) is renamed aside in beforeEach and restored in afterEach so this
// spec cannot accidentally overwrite historical evidence.

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, statSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = resolve(__dir, "..", "_runner.mjs");
const OUTPUT_FILE = resolve(__dir, "..", "_results.json.OUTPUT");
const OUTPUT_ASIDE = resolve(__dir, "..", "_results.json.OUTPUT.aside-dry-run-spec");
const REPO_ROOT = resolve(__dir, "..", "..", "..");

const RUNNER_SRC = readFileSync(RUNNER_PATH, "utf8");

const ABC14_EXPECTED = Object.freeze([
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

// ─────────────────────────────────────────────────────────────────────────────
// Evidence protection — rotate aside before every test, restore after.
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  if (existsSync(OUTPUT_FILE)) {
    renameSync(OUTPUT_FILE, OUTPUT_ASIDE);
  }
});

afterEach(() => {
  if (existsSync(OUTPUT_FILE)) {
    try { unlinkSync(OUTPUT_FILE); } catch { /* ignore */ }
  }
  if (existsSync(OUTPUT_ASIDE)) {
    renameSync(OUTPUT_ASIDE, OUTPUT_FILE);
  }
});

function runRunner(envOverrides = {}, timeoutMs = 20_000) {
  const child = spawnSync(
    process.execPath,
    [RUNNER_PATH],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...envOverrides },
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  return {
    exit: child.status,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    error: child.error,
  };
}

function readOutput() {
  if (!existsSync(OUTPUT_FILE)) return null;
  return JSON.parse(readFileSync(OUTPUT_FILE, "utf8"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Static source inspection — no child process needed.
// ─────────────────────────────────────────────────────────────────────────────
describe("§16.48.18 · GATE_A_DRY_RUN · static source pins", () => {
  it("source reads GATE_A_DRY_RUN from process.env (not from .env.local)", () => {
    expect(RUNNER_SRC).toMatch(/const\s+RAW_DRY_RUN\s*=\s*process\.env\.GATE_A_DRY_RUN/);
    const block = RUNNER_SRC.match(/RAW_DRY_RUN[\s\S]{0,400}DRY_RUN/);
    expect(block).toBeTruthy();
    expect(block[0]).not.toMatch(/readEnv\("GATE_A_DRY_RUN/);
  });

  it("source defaults DRY_RUN to false when unset or empty", () => {
    expect(RUNNER_SRC).toMatch(
      /RAW_DRY_RUN\s*===\s*undefined\s*\|\|\s*RAW_DRY_RUN\s*===\s*""[\s\S]{0,40}DRY_RUN\s*=\s*false/
    );
  });

  it("source accepts exactly \"1\" and no other value", () => {
    // Source text contains literal \" (backslash-quote inside a double-quoted string).
    expect(RUNNER_SRC).toMatch(/RAW_DRY_RUN\s*===\s*"1"[\s\S]{0,40}DRY_RUN\s*=\s*true/);
  });

  it("source refuses any other GATE_A_DRY_RUN value with exit(2) and names accepted values not the token", () => {
    const fatalBlock = RUNNER_SRC.match(
      /FATAL: GATE_A_DRY_RUN has an unrecognised value[\s\S]{0,300}process\.exit\(2\)/
    );
    expect(fatalBlock).toBeTruthy();
    // Message names the accepted values ("1" appears as \"1\" in a double-quoted literal).
    expect(fatalBlock[0]).toMatch(/accepted values are[\s\S]{0,80}\\"1\\"/);
    // Message does NOT interpolate the raw value
    expect(fatalBlock[0]).not.toMatch(/\$\{RAW_DRY_RUN\}/);
    expect(fatalBlock[0]).not.toMatch(/\$\{process\.env\.GATE_A_DRY_RUN\}/);
  });

  it("source places dry-run short-circuit BEFORE the SQL_FILES for-loop", () => {
    const dryRunIdx = RUNNER_SRC.indexOf("if (DRY_RUN) {");
    const sqlLoopIdx = RUNNER_SRC.indexOf("for (const f of SQL_FILES)");
    expect(dryRunIdx).toBeGreaterThan(-1);
    expect(sqlLoopIdx).toBeGreaterThan(-1);
    expect(dryRunIdx).toBeLessThan(sqlLoopIdx);
  });

  it("dry-run block exits 0 after writing OUTPUT, never spawns V-* children", () => {
    const dryBlock = RUNNER_SRC.match(/if\s*\(DRY_RUN\)\s*\{[\s\S]*?process\.exit\(0\)/);
    expect(dryBlock).toBeTruthy();
    // Within the dry-run block there must be no spawnSync, no pg.Client, no createClient.
    expect(dryBlock[0]).not.toMatch(/spawnSync/);
    expect(dryBlock[0]).not.toMatch(/new\s+pg\.Client/);
    expect(dryBlock[0]).not.toMatch(/createClient/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real child-process execution — the runner is invoked for real.
// ─────────────────────────────────────────────────────────────────────────────
describe("§16.48.18 · GATE_A_DRY_RUN=1 · bounded abc-14 execution", () => {
  it("resolves exactly the 14-entry abc-14 manifest in order and exits 0 with no 90_cleanup.mjs", () => {
    const { exit, stdout, stderr } = runRunner({
      GATE_A_IDENTITY_MODE: "three",
      GATE_A_BOUNDED_PROFILE: "abc-14",
      GATE_A_SKIP_CLEANUP: "1",
      GATE_A_DRY_RUN: "1",
    });
    expect(exit, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);

    const out = readOutput();
    expect(out).toBeTruthy();
    expect(out.dry_run).toBe(true);
    expect(Array.isArray(out.dry_run_manifest)).toBe(true);
    expect(out.dry_run_manifest).toEqual([...ABC14_EXPECTED]);
    expect(out.dry_run_manifest).not.toContain("90_cleanup.mjs");
    expect(out.runner_exit).toBe(0);
    expect(out.runner_completed_at).toBeTruthy();
    // Entries array must be empty — no dispatch occurred.
    expect(Array.isArray(out.entries)).toBe(true);
    expect(out.entries.length).toBe(0);
  });

  it("stdout prints each basename in the correct order and does NOT print secrets", () => {
    const { stdout } = runRunner({
      GATE_A_IDENTITY_MODE: "three",
      GATE_A_BOUNDED_PROFILE: "abc-14",
      GATE_A_SKIP_CLEANUP: "1",
      GATE_A_DRY_RUN: "1",
    });
    // Each expected basename appears in order.
    let cursor = 0;
    for (const name of ABC14_EXPECTED) {
      const idx = stdout.indexOf(name, cursor);
      expect(idx, `missing ${name} at or after ${cursor}`).toBeGreaterThan(-1);
      cursor = idx;
    }
    // Secret-leak checks. No JWT prefix, no DATABASE_URL substring, no raw password.
    expect(stdout).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT header prefix pattern
    expect(stdout).not.toMatch(/postgres:\/\/postgres\./);
    expect(stdout).not.toMatch(/DATABASE_URL=/);
    expect(stdout).not.toMatch(/GATE_A_TEST_PASSWORD_[ABC]=/);
    expect(stdout).not.toMatch(/service_role/);
  });

  it("does NOT dispatch any MJS or SQL child (no PASS entries, no SQL logs)", () => {
    const { stdout } = runRunner({
      GATE_A_IDENTITY_MODE: "three",
      GATE_A_BOUNDED_PROFILE: "abc-14",
      GATE_A_SKIP_CLEANUP: "1",
      GATE_A_DRY_RUN: "1",
    });
    // No "SQL: 00_preflight.sql" log should appear — that log is inside runSqlFile
    // which is only called from the main loop that the dry-run short-circuit skips.
    expect(stdout).not.toMatch(/^SQL: 00_preflight\.sql/m);
    expect(stdout).not.toMatch(/^SQL: 10_grants\.sql/m);
    // No "EXIT: 0 → PASS" log should appear — that is inside runMjsFile.
    expect(stdout).not.toMatch(/EXIT: 0 → PASS/);
    // Dry-run banner must appear.
    expect(stdout).toMatch(/GATE_A_DRY_RUN=1 — resolved 14 MJS script\(s\), no dispatch/);
    expect(stdout).toMatch(/DRY-RUN COMPLETE — no network, no DB, no spawn/);
  });
});

describe("§16.48.18 · GATE_A_DRY_RUN=1 · without bounded profile", () => {
  it("resolves the full forward MJS_FILES list when GATE_A_BOUNDED_PROFILE is unset (dry-run still exits 0)", () => {
    const envNoBounded = { ...process.env };
    delete envNoBounded.GATE_A_BOUNDED_PROFILE;
    delete envNoBounded.GATE_A_SKIP_CLEANUP;
    envNoBounded.GATE_A_IDENTITY_MODE = "three";
    envNoBounded.GATE_A_DRY_RUN = "1";
    const child = spawnSync(process.execPath, [RUNNER_PATH], {
      cwd: REPO_ROOT,
      env: envNoBounded,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(child.status, `stdout:\n${child.stdout}\n\nstderr:\n${child.stderr}`).toBe(0);
    const out = readOutput();
    expect(out).toBeTruthy();
    expect(out.dry_run).toBe(true);
    // Full MJS_FILES list has 23 entries (21 behavioural + signup + cleanup); bounded is unset so the full list resolves.
    expect(out.dry_run_manifest.length).toBeGreaterThan(14);
    expect(out.dry_run_manifest[0]).toBe("20_signup_disposable_identities.mjs");
    // Cleanup IS present when bounded profile is unset. (SKIP_CLEANUP unset means the runner would dispatch it.)
    expect(out.dry_run_manifest).toContain("90_cleanup.mjs");
  });
});

describe("§16.48.18 · GATE_A_DRY_RUN · fail-closed on invalid values", () => {
  it("GATE_A_DRY_RUN=bogus → exits 2 and names accepted values, not the token", () => {
    const { exit, stderr, stdout } = runRunner({
      GATE_A_IDENTITY_MODE: "three",
      GATE_A_BOUNDED_PROFILE: "abc-14",
      GATE_A_SKIP_CLEANUP: "1",
      GATE_A_DRY_RUN: "bogus",
    });
    expect(exit).toBe(2);
    expect(stderr).toMatch(/FATAL: GATE_A_DRY_RUN has an unrecognised value/);
    expect(stderr).toMatch(/accepted values are[\s\S]{0,60}"1"/);
    // Must NOT echo the invalid token.
    expect(stderr).not.toMatch(/bogus/);
    expect(stdout).not.toMatch(/bogus/);
    // No OUTPUT written — exit before the dry-run short-circuit.
    expect(existsSync(OUTPUT_FILE)).toBe(false);
  });

  it("GATE_A_DRY_RUN=0 → also exits 2 (only \"1\" is accepted)", () => {
    const { exit, stderr } = runRunner({
      GATE_A_IDENTITY_MODE: "three",
      GATE_A_BOUNDED_PROFILE: "abc-14",
      GATE_A_SKIP_CLEANUP: "1",
      GATE_A_DRY_RUN: "0",
    });
    expect(exit).toBe(2);
    expect(stderr).toMatch(/FATAL: GATE_A_DRY_RUN has an unrecognised value/);
  });
});
