// scripts/gate-a-connected-matrix/__tests__/auth-state-check.spec.mjs
//
// §16.48.21 · Offline test suite for 92_auth_state_check.mjs.
// Authored by Agent C · 2026-11-20.
//
// Approach: spawn 92_auth_state_check.mjs as a real child process with a
// per-test tmpdir, drive its behaviour via env-only inputs:
//   • SANDBOX_SUPABASE_URL / NEXT_PUBLIC_NEX_SUPABASE_URL — URL resolution
//   • SANDBOX_SUPABASE_SERVICE_ROLE_KEY / NEX_SUPABASE_SERVICE_ROLE_KEY
//   • SUPABASE_ACCESS_TOKEN — presence controls soft-fail vs. fetch path
//   • GATE_A_AUTH_CHECK_FETCH_STUB=1       — swap fetch for a recorder
//   • GATE_A_AUTH_CHECK_STUB_MODE          — mailer_autoconfirm_true |
//                                            mailer_autoconfirm_false |
//                                            malformed_json | happy
//   • GATE_A_AUTH_CHECK_STUB_STATUS        — stub HTTP status code
//   • GATE_A_AUTH_CHECK_STUB_LOG_OVERRIDE  — recorder output path
//
// Invariants:
//   • NO call ever reaches the real sandbox or Management API.
//   • Sentinel values for keys / tokens never appear in stdout+stderr.
//   • The hard-coded sandbox ref inside the helper's URL template cannot
//     be overridden by any env var the spec tries.

import { describe, it, expect } from "vitest";
import {
  readFileSync, mkdtempSync, rmSync, existsSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dir, "..", "92_auth_state_check.mjs");

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// Distinctive sentinels — the spec asserts these never appear in any
// stdout/stderr output. NOT real credentials.
const SENTINEL_KEY = "_SENTINEL_KEY_ABCDEF_";
const SENTINEL_TOKEN = "_SENTINEL_TOKEN_123456_";

function sandboxUrl() {
  return `https://${SANDBOX_REF}.supabase.co`;
}
function sandboxUrlDbForm() {
  return `https://db.${SANDBOX_REF}.supabase.co`;
}
function productionUrl() {
  return `https://${PRODUCTION_REF}.supabase.co`;
}
function wrongRefUrl() {
  return `https://aaaaaaaaaaaaaaaaaaaa.supabase.co`;
}

function runCheck({ env = {} } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "gate-a-authstate-"));
  const STUB_LOG = join(tmp, "fetch_stub.log.json");

  const spawnEnv = {
    PATH: process.env.PATH,
    // Default stub log override — individual tests may ignore or override.
    GATE_A_AUTH_CHECK_STUB_LOG_OVERRIDE: STUB_LOG,
    ...env,
  };

  try {
    const out = spawnSync(process.execPath, [SCRIPT], {
      env: spawnEnv,
      encoding: "utf8",
    });
    const stubLogExists = existsSync(STUB_LOG);
    const stubLog = stubLogExists
      ? JSON.parse(readFileSync(STUB_LOG, "utf8"))
      : null;
    return {
      status: out.status,
      stdout: out.stdout ?? "",
      stderr: out.stderr ?? "",
      stubLogExists,
      stubLog,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

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

// Standard happy-path env scaffold with sentinels for the key and token so
// every test can assert secret hygiene.
function baseEnvWithSentinels(overrides = {}) {
  return {
    SANDBOX_SUPABASE_URL: sandboxUrl(),
    SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
    SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
    GATE_A_AUTH_CHECK_FETCH_STUB: "1",
    ...overrides,
  };
}

describe("§16.48.21 · 92_auth_state_check.mjs — offline auth-state helper", () => {
  it("1 · missing SANDBOX URL → exit 2, MISSING_SANDBOX_URL, no fetch, no secrets echoed", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/MISSING_SANDBOX_URL/);
    expect(r.stubLogExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_REFUSED");
    expect(v?.refusalCode).toBe("MISSING_SANDBOX_URL");
    expect(v?.rate_limits_readable).toBe(false);
  });

  it("1b · empty SANDBOX URLs → exit 2, MISSING_SANDBOX_URL", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: "",
        NEXT_PUBLIC_NEX_SUPABASE_URL: "",
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/MISSING_SANDBOX_URL/);
    expect(r.stubLogExists).toBe(false);
  });

  it("2 · missing service-role key → exit 2, MISSING_SANDBOX_SERVICE_ROLE_KEY, no fetch", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/MISSING_SANDBOX_SERVICE_ROLE_KEY/);
    expect(r.stubLogExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(SENTINEL_TOKEN);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_REFUSED");
    expect(v?.refusalCode).toBe("MISSING_SANDBOX_SERVICE_ROLE_KEY");
  });

  it("3 · wrong ref URL → exit 3, WRONG_TARGET_REF, no fetch, no host echo", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: wrongRefUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      },
    });
    expect(r.status).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/WRONG_TARGET_REF/);
    expect(r.stubLogExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain("aaaaaaaaaaaaaaaaaaaa");
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_REFUSED");
    expect(v?.refusalCode).toBe("WRONG_TARGET_REF");
  });

  it("4 · production ref URL refused (defence in depth) → exit 3, WRONG_TARGET_REF", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: productionUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      },
    });
    expect(r.status).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/WRONG_TARGET_REF/);
    expect(r.stubLogExists).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(PRODUCTION_REF);
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
  });

  it("5 · missing SUPABASE_ACCESS_TOKEN → exit 0, AUTH_STATE_UNREADABLE, MGMT_TOKEN_MISSING, no fetch", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        // SUPABASE_ACCESS_TOKEN deliberately unset
      },
    });
    expect(r.status).toBe(0);
    expect(r.stubLogExists).toBe(false);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_UNREADABLE");
    expect(v?.refusalCode).toBe("MGMT_TOKEN_MISSING");
    expect(v?.config_detected).toBe("unknown");
    expect(v?.rate_limits_readable).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).toMatch(/UNREADABLE_WITHOUT_MGMT_TOKEN/);
    expect(combined).not.toContain(SENTINEL_KEY);
  });

  it("6 · happy path · mailer_autoconfirm=true → AUTH_STATE_READ, config X, rate limits", () => {
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }),
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_READ");
    expect(v?.config_detected).toBe("X");
    expect(v?.rate_limits_readable).toBe(true);
    expect(r.stubLogExists).toBe(true);
    expect(Array.isArray(r.stubLog)).toBe(true);
    expect(r.stubLog.length).toBeGreaterThanOrEqual(1);
    // The one recorded call must have hit the hard-coded URL template.
    for (const call of r.stubLog) {
      expect(call.op).toBe("fetch");
      expect(call.url_matches_template).toBe(true);
    }
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
  });

  it("7 · happy path · mailer_autoconfirm=false → config Y", () => {
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_false",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }),
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_READ");
    expect(v?.config_detected).toBe("Y");
    expect(v?.rate_limits_readable).toBe(true);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
  });

  it("8 · Management API 401 → AUTH_STATE_UNREADABLE, MGMT_API_HTTP_ERROR_401, no headers leaked", () => {
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "401",
      }),
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_UNREADABLE");
    expect(v?.refusalCode).toBe("MGMT_API_HTTP_ERROR_401");
    expect(v?.rate_limits_readable).toBe(false);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TOKEN);
    // Stub log does not record headers.
    if (r.stubLog) {
      for (const call of r.stubLog) {
        expect(Object.prototype.hasOwnProperty.call(call, "headers")).toBe(false);
      }
    }
  });

  it("9 · Management API 500 → AUTH_STATE_UNREADABLE, MGMT_API_HTTP_ERROR_500", () => {
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "500",
      }),
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_UNREADABLE");
    expect(v?.refusalCode).toBe("MGMT_API_HTTP_ERROR_500");
    expect(v?.rate_limits_readable).toBe(false);
  });

  it("10 · Malformed JSON → AUTH_STATE_UNREADABLE, MGMT_API_PARSE_ERROR", () => {
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "malformed_json",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }),
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_UNREADABLE");
    expect(v?.refusalCode).toBe("MGMT_API_PARSE_ERROR");
    expect(v?.rate_limits_readable).toBe(false);
  });

  it("11 · bogus GATE_A_AUTH_CHECK_FETCH_STUB value → exit 2, raw value NOT echoed", () => {
    const r = runCheck({
      env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
        GATE_A_AUTH_CHECK_FETCH_STUB: "true-bogus-xyz",
      },
    });
    expect(r.status).toBe(2);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain("true-bogus-xyz");
    expect(r.stderr).toMatch(/GATE_A_AUTH_CHECK_FETCH_STUB has an unrecognised value/);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_REFUSED");
    expect(v?.refusalCode).toBe("BAD_ENV_GRAMMAR");
  });

  it("12 · secret hygiene · sentinel key + token NEVER appear in stdout+stderr across every path", () => {
    const paths = [
      // Missing URL
      { env: {
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      } },
      // Missing key
      { env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      } },
      // Wrong ref
      { env: {
        SANDBOX_SUPABASE_URL: wrongRefUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      } },
      // Production ref
      { env: {
        SANDBOX_SUPABASE_URL: productionUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
      } },
      // Missing mgmt token (soft-fail)
      { env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
      } },
      // Happy path true
      { env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }) },
      // Happy path false
      { env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_false",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }) },
      // HTTP 401
      { env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_STATUS: "401",
      }) },
      // HTTP 500
      { env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_STATUS: "500",
      }) },
      // Malformed JSON
      { env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "malformed_json",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      }) },
      // Env grammar refusal
      { env: {
        SANDBOX_SUPABASE_URL: sandboxUrl(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
        GATE_A_AUTH_CHECK_FETCH_STUB: "bogus",
      } },
    ];
    for (const p of paths) {
      const r = runCheck(p);
      const combined = r.stdout + r.stderr;
      expect(combined).not.toContain(SENTINEL_KEY);
      expect(combined).not.toContain(SENTINEL_TOKEN);
    }
  });

  it("13 · hard-coded sandbox ref in URL template is NOT overridable by env", () => {
    // A rogue env var that might be used by a future bad edit to override
    // the ref — we assert the stub still sees the hard-coded canonical URL.
    const r = runCheck({
      env: baseEnvWithSentinels({
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
        // Attempt to inject an override — the helper must ignore it.
        GATE_A_AUTH_CHECK_MGMT_URL_OVERRIDE:
          `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/config/auth`,
        GATE_A_MGMT_PROJECT_REF: PRODUCTION_REF,
        MGMT_API_URL:
          `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/config/auth`,
      }),
    });
    expect(r.status).toBe(0);
    expect(r.stubLogExists).toBe(true);
    expect(r.stubLog.length).toBeGreaterThanOrEqual(1);
    for (const call of r.stubLog) {
      expect(call.url_matches_template).toBe(true);
    }
    // And no echo of the production ref anywhere.
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(PRODUCTION_REF);
  });

  it("13b · NEXT_PUBLIC_NEX_SUPABASE_URL is accepted as fallback when SANDBOX_SUPABASE_URL is unset", () => {
    const r = runCheck({
      env: {
        NEXT_PUBLIC_NEX_SUPABASE_URL: sandboxUrlDbForm(),
        SANDBOX_SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        SUPABASE_ACCESS_TOKEN: SENTINEL_TOKEN,
        GATE_A_AUTH_CHECK_FETCH_STUB: "1",
        GATE_A_AUTH_CHECK_STUB_MODE: "mailer_autoconfirm_true",
        GATE_A_AUTH_CHECK_STUB_STATUS: "200",
      },
    });
    expect(r.status).toBe(0);
    const v = parseVerdictLine(r.stdout);
    expect(v?.verdict).toBe("AUTH_STATE_READ");
    expect(v?.config_detected).toBe("X");
  });
});
