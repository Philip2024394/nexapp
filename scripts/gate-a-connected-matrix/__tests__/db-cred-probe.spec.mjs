// scripts/gate-a-connected-matrix/__tests__/db-cred-probe.spec.mjs
//
// §16.48.20 · Offline test suite for 91_db_cred_probe.mjs.
// Authored by Agent B · 2026-11-20.
//
// Approach: spawn 91_db_cred_probe.mjs as a real child process with a
// per-test tmpdir, drive its behaviour via env-only inputs:
//   • SANDBOX_DATABASE_URL — real-shape sandbox / production / other URLs
//   • GATE_A_DB_CRED_PROBE_PG_STUB=1    — swap pg.Client for a recorder
//   • GATE_A_DB_CRED_PROBE_STUB_MODE    — happy | connect_error | query_error
//   • GATE_A_DB_CRED_PROBE_STUB_LOG_OVERRIDE — recorder output path
//   • GATE_A_DB_CRED_PROBE_FLAG_OVERRIDE    — temp flag write path
//
// Invariants:
//   • NO call ever reaches a real database.
//   • NO file is ever written at evidence/attestations/db-cred-verified.flag.
//   • Password substring never appears in stdout+stderr on refusal paths.

import { describe, it, expect } from "vitest";
import {
  readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dir, "..", "91_db_cred_probe.mjs");
const REPO_ROOT = resolve(__dir, "..", "..", "..");
const REAL_FLAG_PATH = resolve(
  REPO_ROOT,
  "evidence",
  "attestations",
  "db-cred-verified.flag"
);

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// Distinctive, fake password token — tests assert it never appears in
// any stdout/stderr output. Not a real credential.
const FAKE_PW = "s3cret-PROBE-CANARY-DO-NOT-LEAK";
const FAKE_USER = "testuser-CANARY";

function buildSandboxPoolerUrl(password = FAKE_PW) {
  return `postgresql://postgres.${SANDBOX_REF}:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}
function buildSandboxDirectUrl(password = FAKE_PW) {
  return `postgresql://postgres:${password}@db.${SANDBOX_REF}.supabase.co:5432/postgres`;
}
function buildProductionPoolerUrl() {
  return `postgresql://postgres.${PRODUCTION_REF}:${FAKE_PW}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}
function buildUnknownRefUrl() {
  // A plausible-looking Supabase URL for a different ref — must be refused
  // WITHOUT echoing the host.
  return `postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:${FAKE_PW}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}
function buildBogusUrl() {
  return `postgresql://${FAKE_USER}:${FAKE_PW}@example.com:5432/postgres`;
}

// Run the probe with env overrides routed to a per-test tmpdir. Every test
// uses this; nothing escapes to the real evidence/ path.
function runProbe({ env = {}, stubMode = undefined } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "gate-a-dbcred-"));
  const FLAG_PATH = join(tmp, "flag.json");
  const STUB_LOG = join(tmp, "pg_stub.log.json");

  const spawnEnv = {
    PATH: process.env.PATH,
    // Default: enable the stub. Individual tests may override.
    GATE_A_DB_CRED_PROBE_PG_STUB: "1",
    GATE_A_DB_CRED_PROBE_FLAG_OVERRIDE: FLAG_PATH,
    GATE_A_DB_CRED_PROBE_STUB_LOG_OVERRIDE: STUB_LOG,
    ...env,
  };
  if (stubMode !== undefined) {
    spawnEnv.GATE_A_DB_CRED_PROBE_STUB_MODE = stubMode;
  }

  try {
    const out = spawnSync(process.execPath, [SCRIPT], {
      env: spawnEnv,
      encoding: "utf8",
    });
    const flagExists = existsSync(FLAG_PATH);
    const flag = flagExists ? JSON.parse(readFileSync(FLAG_PATH, "utf8")) : null;
    const stubLogExists = existsSync(STUB_LOG);
    const stubLog = stubLogExists ? JSON.parse(readFileSync(STUB_LOG, "utf8")) : null;
    return {
      status: out.status,
      stdout: out.stdout ?? "",
      stderr: out.stderr ?? "",
      flagExists,
      flag,
      stubLogExists,
      stubLog,
      flagPath: FLAG_PATH,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// The final JSON verdict line is always the LAST JSON-shaped line on stdout.
function parseVerdictLine(stdout) {
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const t = lines[i];
    if (t.startsWith("{") && t.endsWith("}") && t.includes('"verdict"')) {
      try { return JSON.parse(t); } catch { /* try earlier */ }
    }
  }
  return null;
}

describe("§16.48.20 · 91_db_cred_probe.mjs — offline DB credential probe", () => {
  it("1 · missing SANDBOX_DATABASE_URL → exit 2, MISSING_SANDBOX_DATABASE_URL, no flag", () => {
    const r = runProbe({ env: { /* SANDBOX_DATABASE_URL deliberately unset */ } });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/MISSING_SANDBOX_DATABASE_URL/);
    expect(r.flagExists).toBe(false);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_FAIL");
    expect(v?.refusalCode).toBe("MISSING_SANDBOX_DATABASE_URL");
  });

  it("1b · empty SANDBOX_DATABASE_URL → exit 2, MISSING_SANDBOX_DATABASE_URL, no flag", () => {
    const r = runProbe({ env: { SANDBOX_DATABASE_URL: "" } });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/MISSING_SANDBOX_DATABASE_URL/);
    expect(r.flagExists).toBe(false);
  });

  it("2 · wrong ref (plausible other Supabase URL) → exit 3, WRONG_TARGET_REF, no flag, no host echo", () => {
    const url = buildUnknownRefUrl();
    const r = runProbe({ env: { SANDBOX_DATABASE_URL: url } });
    expect(r.status).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/WRONG_TARGET_REF/);
    expect(r.flagExists).toBe(false);
    // Stdout/stderr must not leak the observed ref/host.
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain("aaaaaaaaaaaaaaaaaaaa");
    expect(combined).not.toContain("aws-0-eu-west-1.pooler.supabase.com");
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_FAIL");
    expect(v?.refusalCode).toBe("WRONG_TARGET_REF");
  });

  it("3 · production ref refused → WRONG_TARGET_REF (defence in depth), no flag", () => {
    const url = buildProductionPoolerUrl();
    const r = runProbe({ env: { SANDBOX_DATABASE_URL: url } });
    expect(r.status).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/WRONG_TARGET_REF/);
    expect(r.flagExists).toBe(false);
    // Must not echo the production ref value.
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(PRODUCTION_REF);
  });

  it("3b · non-Supabase bogus host → WRONG_TARGET_REF, no flag", () => {
    const r = runProbe({ env: { SANDBOX_DATABASE_URL: buildBogusUrl() } });
    expect(r.status).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/WRONG_TARGET_REF/);
    expect(r.flagExists).toBe(false);
  });

  it("4 · happy path (pooler URL, stub returns rows) → exit 0, verdict PASS, flag written at override", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "happy",
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_PASS");
    expect(r.flagExists).toBe(true);
    expect(r.flag).toBeTruthy();
    expect(r.flag.verdict).toBe("DB_CRED_PROBE_PASS");
    expect(typeof r.flag.checked_at).toBe("string");
    expect(typeof r.flag.probe_version).toBe("string");
    expect(r.flag.current_database).toBe("postgres");
    // Flag contents must NOT contain any credential or URL fragment.
    const flagBlob = JSON.stringify(r.flag);
    expect(flagBlob).not.toContain(FAKE_PW);
    expect(flagBlob).not.toContain(FAKE_USER);
    expect(flagBlob).not.toContain("postgresql://");
    expect(flagBlob).not.toContain(".pooler.supabase.com");
    // Stub log should show connect + 2 queries + end.
    expect(r.stubLogExists).toBe(true);
    const ops = r.stubLog.map((c) => c.op);
    expect(ops.filter((o) => o === "connect")).toHaveLength(1);
    expect(ops.filter((o) => o === "query")).toHaveLength(2);
    expect(ops.filter((o) => o === "end")).toHaveLength(1);
  });

  it("4b · happy path · direct host form is also accepted", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxDirectUrl() },
      stubMode: "happy",
    });
    expect(r.status).toBe(0);
    expect(r.flagExists).toBe(true);
  });

  it("5 · flag write respects GATE_A_DB_CRED_PROBE_FLAG_OVERRIDE and does NOT touch the real path", () => {
    // Record real-flag state BEFORE the run.
    const realExistedBefore = existsSync(REAL_FLAG_PATH);
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "happy",
    });
    expect(r.status).toBe(0);
    expect(r.flagExists).toBe(true); // override path WAS written
    // The real flag path state must be unchanged by this test.
    const realExistsAfter = existsSync(REAL_FLAG_PATH);
    expect(realExistsAfter).toBe(realExistedBefore);
  });

  it("6 · stub connect() error → non-zero exit, FAIL verdict, no flag, URL redacted", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "connect_error",
    });
    expect(r.status).not.toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_FAIL");
    expect(r.flagExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(FAKE_PW);
    expect(combined).not.toContain(FAKE_USER);
  });

  it("7 · stub query() error on SELECT 1 → non-zero exit, no flag, URL redacted", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "query_error",
    });
    expect(r.status).not.toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_FAIL");
    expect(r.flagExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(FAKE_PW);
    expect(combined).not.toContain(FAKE_USER);
  });

  it("8 · bogus GATE_A_DB_CRED_PROBE_PG_STUB value → exit 2, raw value NOT echoed, no flag", () => {
    const r = runProbe({
      env: {
        SANDBOX_DATABASE_URL: buildSandboxPoolerUrl(),
        GATE_A_DB_CRED_PROBE_PG_STUB: "yes-bogus-xyz",
      },
    });
    expect(r.status).toBe(2);
    expect(r.flagExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain("yes-bogus-xyz");
    expect(r.stderr).toMatch(/GATE_A_DB_CRED_PROBE_PG_STUB has an unrecognised value/);
  });

  it("8b · bogus GATE_A_DB_CRED_PROBE_STUB_MODE value → exit 2, raw value NOT echoed", () => {
    const r = runProbe({
      env: {
        SANDBOX_DATABASE_URL: buildSandboxPoolerUrl(),
        GATE_A_DB_CRED_PROBE_STUB_MODE: "sabotage-mode-bogus",
      },
    });
    expect(r.status).toBe(2);
    expect(r.flagExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain("sabotage-mode-bogus");
    expect(r.stderr).toMatch(/GATE_A_DB_CRED_PROBE_STUB_MODE has an unrecognised value/);
  });

  it("9 · secret hygiene · password substring never appears in stdout+stderr across every failure path", () => {
    const paths = [
      // Missing URL
      { env: { } },
      // Wrong ref
      { env: { SANDBOX_DATABASE_URL: buildUnknownRefUrl() } },
      // Production ref
      { env: { SANDBOX_DATABASE_URL: buildProductionPoolerUrl() } },
      // Bogus (non-Supabase) host
      { env: { SANDBOX_DATABASE_URL: buildBogusUrl() } },
      // Connect error
      { env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() }, stubMode: "connect_error" },
      // Query error
      { env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() }, stubMode: "query_error" },
      // Env grammar
      { env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl(), GATE_A_DB_CRED_PROBE_PG_STUB: "bogus" } },
    ];
    for (const p of paths) {
      const r = runProbe(p);
      const combined = r.stdout + r.stderr;
      expect(combined).not.toContain(FAKE_PW);
      expect(combined).not.toContain(FAKE_USER);
    }
  });

  it("10 · flag is NEVER written when the SELECT 1 query fails (connect() succeeded)", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "query_error",
    });
    expect(r.flagExists).toBe(false);
    // And the stub log shows a connect happened but no 'end'-after-success path;
    // the verdict must be FAIL.
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("DB_CRED_PROBE_FAIL");
  });

  it("11 · flag JSON shape has timestamp + probe version + db only (no url, user, pass, ref)", () => {
    const r = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "happy",
    });
    expect(r.status).toBe(0);
    expect(r.flag).toBeTruthy();
    // Allowed keys only.
    const keys = Object.keys(r.flag).sort();
    expect(keys).toEqual(["checked_at", "current_database", "probe_version", "verdict"]);
    // Timestamp parses
    expect(Number.isFinite(Date.parse(r.flag.checked_at))).toBe(true);
    const blob = JSON.stringify(r.flag);
    expect(blob).not.toContain(FAKE_PW);
    expect(blob).not.toContain(FAKE_USER);
    expect(blob).not.toContain(SANDBOX_REF);
    expect(blob).not.toContain(PRODUCTION_REF);
  });

  it("12 · final-line JSON verdict is present on both success and refusal paths", () => {
    // Success
    const good = runProbe({
      env: { SANDBOX_DATABASE_URL: buildSandboxPoolerUrl() },
      stubMode: "happy",
    });
    expect(parseVerdictLine(good.stdout)?.verdict).toBe("DB_CRED_PROBE_PASS");

    // Refusal (missing)
    const bad = runProbe({ env: {} });
    expect(parseVerdictLine(bad.stdout)?.verdict).toBe("DB_CRED_PROBE_FAIL");
    expect(parseVerdictLine(bad.stdout)?.refusalCode).toBe("MISSING_SANDBOX_DATABASE_URL");
  });
});
