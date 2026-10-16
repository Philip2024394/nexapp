// scripts/__tests__/validate-env.test.mjs
//
// D10 · nex-env-validator · focused unit tests.
//
// Tests inject explicit env snapshots. Real `process.env` is NEVER
// consulted. Real `.env.local` is NEVER opened. No network, no DB,
// no filesystem.
//
// Discipline: adversarial inputs include newlines, credential-like
// strings, and sentinel values that would be obvious if they leaked
// into any output. Every test that passes a sensitive-looking value
// asserts that value never appears in `result.messages`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  validateEnvironment,
  runValidator,
  parseFlag,
  REQUIRED_PHASE1,
  DECISION_REQUIRED,
  PROD_PROHIBITED_FLAG,
  PROD_PROHIBITED_PRESENCE,
  WARN_IF_PRESENT,
  PROFILE_PRODUCTION_PHASE1,
  AVAILABLE_PROFILES,
} from "../validate-env.mjs";

// ─── Fixtures ─────────────────────────────────────────────────────

// A plausibly-shaped JWT. NOT a real token. Shape: eyJ... . eyJ... . sig
const FIXTURE_JWT_1 = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.PLACEHOLDER_sig_do_not_use";
const FIXTURE_JWT_2 = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.PLACEHOLDER_sig_do_not_use";

// 44-char random-looking base64 (not real) · passes secret-32 check
const FIXTURE_SECRET_32 =
  "PLACEHOLDER_random_32byte_base64_abcdefghij==";

// ~87-char base64url · passes vapid-public shape
const FIXTURE_VAPID_PUBLIC =
  "B" + "a".repeat(86); // 87 chars, all base64url-safe

// ~43-char base64url · passes vapid-private shape
const FIXTURE_VAPID_PRIVATE = "p" + "a".repeat(42); // 43 chars

const FIXTURE_SUPABASE_URL = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";
const FIXTURE_APP_URL = "https://nex.app";
const FIXTURE_SUBJECT = "mailto:ops@example.org";

/** Minimum env snapshot that passes production-phase1 WITHOUT any
 *  decisions pending. Each field uses a plausibly-shaped placeholder
 *  that is NOT a real credential. */
function makeValidEnv(overrides = {}) {
  return {
    // Part 1 · required
    NEX_SUPABASE_URL: FIXTURE_SUPABASE_URL,
    NEX_SUPABASE_SERVICE_ROLE_KEY: FIXTURE_JWT_2,
    NEXT_PUBLIC_NEX_SUPABASE_URL: FIXTURE_SUPABASE_URL,
    NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY: FIXTURE_JWT_1,
    NEX_SESSION_SECRET: FIXTURE_SECRET_32,
    ENC_KEY: FIXTURE_SECRET_32,
    CRON_SECRET: FIXTURE_SECRET_32,
    NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY: FIXTURE_VAPID_PUBLIC,
    XRATED_VAPID_PRIVATE_KEY: FIXTURE_VAPID_PRIVATE,
    XRATED_VAPID_SUBJECT: FIXTURE_SUBJECT,
    // Part 2 · decisions resolved
    NEX_POSTGRES_URL: "postgres://db-user@db.supabase.co:5432/postgres",
    NEXT_PUBLIC_APP_BASE_URL: FIXTURE_APP_URL,
    NEX_WEBAUTHN_RP_ID: "nex.app",
    NEX_WEBAUTHN_ORIGIN: "https://nex.app",
    ...overrides,
  };
}

// ─── Policy constants · exported shape ────────────────────────────

describe("Exported constants", () => {
  it("REQUIRED_PHASE1 is a frozen array of 10 variable descriptors", () => {
    expect(Array.isArray(REQUIRED_PHASE1)).toBe(true);
    expect(REQUIRED_PHASE1).toHaveLength(10);
    expect(Object.isFrozen(REQUIRED_PHASE1)).toBe(true);
    for (const entry of REQUIRED_PHASE1) {
      expect(entry.name).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(typeof entry.format).toBe("string");
      expect(typeof entry.purpose).toBe("string");
    }
  });

  it("DECISION_REQUIRED is a frozen array covering D1-D3", () => {
    expect(Object.isFrozen(DECISION_REQUIRED)).toBe(true);
    const decisionIds = DECISION_REQUIRED.map((e) => e.decision);
    expect(decisionIds).toContain("D1");
    expect(decisionIds).toContain("D2");
    expect(decisionIds).toContain("D3");
  });

  it("PROD_PROHIBITED_PRESENCE includes every legacy Supabase name", () => {
    const names = PROD_PROHIBITED_PRESENCE.map((e) => e.name);
    expect(names).toContain("SUPABASE_URL");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names).toContain("SUPABASE_SERVICE_KEY");
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("PROD_PROHIBITED_FLAG includes dev-admin and dev-routes bypasses", () => {
    const names = PROD_PROHIBITED_FLAG.map((e) => e.name);
    expect(names).toContain("NEX_ALLOW_DEV_ADMIN");
    expect(names).toContain("NEX_DEV_ROUTES");
    expect(names).toContain("NEX_CROSS_DB_RECONCILER_ENABLED");
  });

  it("WARN_IF_PRESENT includes STRIPE_* (payment not implemented)", () => {
    const names = WARN_IF_PRESENT.map((e) => e.name);
    expect(names).toContain("STRIPE_SECRET_KEY");
    expect(names).toContain("STRIPE_PUBLISHABLE_KEY");
    expect(names).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("AVAILABLE_PROFILES is frozen and includes production-phase1", () => {
    expect(Object.isFrozen(AVAILABLE_PROFILES)).toBe(true);
    expect(AVAILABLE_PROFILES).toContain(PROFILE_PRODUCTION_PHASE1);
  });
});

// ─── parseFlag ────────────────────────────────────────────────────

describe("parseFlag · mirrors launch-flags.ts parse logic", () => {
  it("accepts the sealed truthy tokens", () => {
    expect(parseFlag("1")).toBe(true);
    expect(parseFlag("true")).toBe(true);
    expect(parseFlag("yes")).toBe(true);
    expect(parseFlag(" TRUE ")).toBe(true);
    expect(parseFlag("YES")).toBe(true);
  });

  it("rejects everything else as false", () => {
    expect(parseFlag(undefined)).toBe(false);
    expect(parseFlag(null)).toBe(false);
    expect(parseFlag("")).toBe(false);
    expect(parseFlag("0")).toBe(false);
    expect(parseFlag("false")).toBe(false);
    expect(parseFlag("no")).toBe(false);
    expect(parseFlag("random")).toBe(false);
    expect(parseFlag(" ")).toBe(false);
  });
});

// ─── Valid minimum snapshot ───────────────────────────────────────

describe("validateEnvironment · valid minimum snapshot", () => {
  it("ok=true · no missing / invalid / decisions / prohibited", () => {
    const result = validateEnvironment({ env: makeValidEnv() });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.prohibited).toEqual([]);
  });

  it("profile echoed back on result", () => {
    const result = validateEnvironment({ env: makeValidEnv() });
    expect(result.profile).toBe(PROFILE_PRODUCTION_PHASE1);
  });

  it("messages array is non-empty but contains no supplied value", () => {
    const env = makeValidEnv({ NEX_SESSION_SECRET: "SENTINEL_VALUE_abcdefghij_abcdefghij_abcdef" });
    const result = validateEnvironment({ env });
    expect(result.messages.length).toBeGreaterThan(0);
    for (const line of result.messages) {
      expect(line).not.toContain("SENTINEL_VALUE");
    }
  });
});

// ─── Missing required variable ────────────────────────────────────

describe("validateEnvironment · missing required variable", () => {
  it("records in `missing` and sets ok=false when a required var is undefined", () => {
    const env = makeValidEnv();
    delete env.NEX_SUPABASE_URL;
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    const names = result.missing.map((m) => m.name);
    expect(names).toContain("NEX_SUPABASE_URL");
  });

  it("records in `missing` when a required var is empty string", () => {
    const env = makeValidEnv({ NEX_SUPABASE_SERVICE_ROLE_KEY: "" });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(result.missing.map((m) => m.name)).toContain("NEX_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("records in `missing` when a required var is null", () => {
    const env = makeValidEnv({ CRON_SECRET: null });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(result.missing.map((m) => m.name)).toContain("CRON_SECRET");
  });

  it("emits a MISSING line in messages", () => {
    const env = makeValidEnv();
    delete env.ENC_KEY;
    const result = validateEnvironment({ env });
    expect(result.messages.some((m) => m.includes("MISSING") && m.includes("ENC_KEY"))).toBe(true);
  });
});

// ─── Malformed values · format checks are justified by source ─────

describe("validateEnvironment · malformed values", () => {
  it("rejects a Supabase URL that is not https://", () => {
    const env = makeValidEnv({ NEX_SUPABASE_URL: "http://example.com" });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(result.invalid.map((e) => e.name)).toContain("NEX_SUPABASE_URL");
  });

  it("rejects a JWT missing the eyJ.eyJ.sig shape", () => {
    const env = makeValidEnv({ NEX_SUPABASE_SERVICE_ROLE_KEY: "not-a-jwt" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects a secret shorter than 32 characters", () => {
    const env = makeValidEnv({ NEX_SESSION_SECRET: "short" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_SESSION_SECRET");
  });

  it("rejects a VAPID public key with wrong length", () => {
    const env = makeValidEnv({ NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY: "a".repeat(50) });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY");
  });

  it("rejects a VAPID subject that is neither mailto: nor https://", () => {
    const env = makeValidEnv({ XRATED_VAPID_SUBJECT: "ftp://nope.example.org" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("XRATED_VAPID_SUBJECT");
  });

  it("rejects a WebAuthn origin with a trailing slash", () => {
    const env = makeValidEnv({ NEX_WEBAUTHN_ORIGIN: "https://nex.app/" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_WEBAUTHN_ORIGIN");
  });

  it("rejects a WebAuthn RP_ID with a scheme or port", () => {
    const env1 = makeValidEnv({ NEX_WEBAUTHN_RP_ID: "https://nex.app" });
    const result1 = validateEnvironment({ env: env1 });
    expect(result1.invalid.map((e) => e.name)).toContain("NEX_WEBAUTHN_RP_ID");

    const env2 = makeValidEnv({ NEX_WEBAUTHN_RP_ID: "nex.app:443" });
    const result2 = validateEnvironment({ env: env2 });
    expect(result2.invalid.map((e) => e.name)).toContain("NEX_WEBAUTHN_RP_ID");
  });

  it("rejects a Postgres URL pointing at localhost (D1 production rule)", () => {
    const env1 = makeValidEnv({ NEX_POSTGRES_URL: "postgres://user:pass@localhost:5432/db" });
    const result1 = validateEnvironment({ env: env1 });
    expect(result1.invalid.map((e) => e.name)).toContain("NEX_POSTGRES_URL");

    const env2 = makeValidEnv({ NEX_POSTGRES_URL: "postgres://user@127.0.0.1:5432/db" });
    const result2 = validateEnvironment({ env: env2 });
    expect(result2.invalid.map((e) => e.name)).toContain("NEX_POSTGRES_URL");
  });

  it("rejects a Postgres URL with wrong scheme", () => {
    const env = makeValidEnv({ NEX_POSTGRES_URL: "mysql://user@db/db" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_POSTGRES_URL");
  });

  it("rejects a value with embedded newlines (adversarial input)", () => {
    const env = makeValidEnv({ NEX_SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJ\n.sig" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects a value with carriage returns", () => {
    const env = makeValidEnv({ NEX_SESSION_SECRET: "abcdefghij\rabcdefghij\rabcdefghij\rab" });
    const result = validateEnvironment({ env });
    expect(result.invalid.map((e) => e.name)).toContain("NEX_SESSION_SECRET");
  });

  it("flags Supabase URL/public mismatch (CLAUDE.md §8 pair-equality)", () => {
    const env = makeValidEnv({
      NEX_SUPABASE_URL: "https://aaa.supabase.co",
      NEXT_PUBLIC_NEX_SUPABASE_URL: "https://bbb.supabase.co",
    });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(
      result.invalid.some((e) => e.name.includes("NEX_SUPABASE_URL") && e.name.includes("NEXT_PUBLIC_NEX_SUPABASE_URL"))
    ).toBe(true);
  });
});

// ─── Unresolved operator decisions ────────────────────────────────

describe("validateEnvironment · unresolved operator decisions", () => {
  it("records in `decisions` when NEX_POSTGRES_URL is absent (D1)", () => {
    const env = makeValidEnv();
    delete env.NEX_POSTGRES_URL;
    const result = validateEnvironment({ env });
    const names = result.decisions.map((d) => d.name);
    expect(names).toContain("NEX_POSTGRES_URL");
    expect(result.decisions.find((d) => d.name === "NEX_POSTGRES_URL").decision).toBe("D1");
  });

  it("records in `decisions` when NEXT_PUBLIC_APP_BASE_URL is absent (D2)", () => {
    const env = makeValidEnv();
    delete env.NEXT_PUBLIC_APP_BASE_URL;
    const result = validateEnvironment({ env });
    expect(result.decisions.find((d) => d.name === "NEXT_PUBLIC_APP_BASE_URL").decision).toBe("D2");
  });

  it("records in `decisions` when WebAuthn pair is absent (D3)", () => {
    const env = makeValidEnv();
    delete env.NEX_WEBAUTHN_RP_ID;
    delete env.NEX_WEBAUTHN_ORIGIN;
    const result = validateEnvironment({ env });
    const d3s = result.decisions.filter((d) => d.decision === "D3").map((d) => d.name);
    expect(d3s).toContain("NEX_WEBAUTHN_RP_ID");
    expect(d3s).toContain("NEX_WEBAUTHN_ORIGIN");
  });

  it("decisions-only state produces ok=false (hard failures = none, decisions pending)", () => {
    const env = makeValidEnv();
    delete env.NEX_POSTGRES_URL;
    delete env.NEXT_PUBLIC_APP_BASE_URL;
    delete env.NEX_WEBAUTHN_RP_ID;
    delete env.NEX_WEBAUTHN_ORIGIN;
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.prohibited).toEqual([]);
    expect(result.decisions.length).toBe(4);
  });
});

// ─── Optional variable absence ────────────────────────────────────

describe("validateEnvironment · optional variables", () => {
  it("absence of NEX_COMMERCE_ENABLED and NEX_SEARCH_ENABLED is fine", () => {
    const env = makeValidEnv();
    // These are not even in makeValidEnv() so they are absent.
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(true);
  });

  it("optional/legacy src/lib/nex/* vars absent does not fail", () => {
    const env = makeValidEnv();
    // No RESEND_API_KEY, no OPENAI_API_KEY, no NEX_P0_*, etc.
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

// ─── Prod-prohibited variables ────────────────────────────────────

describe("validateEnvironment · prod-prohibited presence (legacy Supabase)", () => {
  it("rejects a non-empty SUPABASE_URL (legacy stale project)", () => {
    const env = makeValidEnv({ SUPABASE_URL: "https://legacy-stale-project.supabase.co" });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    const names = result.prohibited.map((p) => p.name);
    expect(names).toContain("SUPABASE_URL");
    const entry = result.prohibited.find((p) => p.name === "SUPABASE_URL");
    expect(entry.severity).toBe("critical");
  });

  it("rejects any of the four legacy Supabase variables when non-empty", () => {
    const env = makeValidEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: FIXTURE_JWT_1,
      SUPABASE_SERVICE_ROLE_KEY: FIXTURE_JWT_2,
      SUPABASE_SERVICE_KEY: FIXTURE_JWT_2,
    });
    const result = validateEnvironment({ env });
    const names = result.prohibited.map((p) => p.name);
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names).toContain("SUPABASE_SERVICE_KEY");
  });

  it("empty prohibited presence vars do not trigger prohibition", () => {
    const env = makeValidEnv({ SUPABASE_URL: "" });
    const result = validateEnvironment({ env });
    expect(result.prohibited.map((p) => p.name)).not.toContain("SUPABASE_URL");
  });

  it("rejects local Postgres config in production (NEX_LOCALPG_*)", () => {
    const env = makeValidEnv({
      NEX_LOCALPG_USER: "nex",
      NEX_LOCALPG_PORT: "5433",
      NEX_LOCALPG_PASSWORD: "any",
    });
    const result = validateEnvironment({ env });
    const names = result.prohibited.map((p) => p.name);
    expect(names).toContain("NEX_LOCALPG_USER");
    expect(names).toContain("NEX_LOCALPG_PORT");
    expect(names).toContain("NEX_LOCALPG_PASSWORD");
  });
});

describe("validateEnvironment · prod-prohibited flag (dev shortcuts)", () => {
  it("rejects NEX_ALLOW_DEV_ADMIN set to a truthy value", () => {
    for (const truthy of ["1", "true", "yes", "YES", "TRUE "]) {
      const env = makeValidEnv({ NEX_ALLOW_DEV_ADMIN: truthy });
      const result = validateEnvironment({ env });
      expect(result.prohibited.map((p) => p.name), `truthy=${JSON.stringify(truthy)}`).toContain("NEX_ALLOW_DEV_ADMIN");
    }
  });

  it("accepts NEX_ALLOW_DEV_ADMIN set to a falsy string ('0' / 'false' / '')", () => {
    for (const falsy of ["0", "false", "no", ""]) {
      const env = makeValidEnv({ NEX_ALLOW_DEV_ADMIN: falsy });
      const result = validateEnvironment({ env });
      expect(result.prohibited.map((p) => p.name), `falsy=${JSON.stringify(falsy)}`).not.toContain("NEX_ALLOW_DEV_ADMIN");
    }
  });

  it("rejects the agent-force internet shaping flags", () => {
    const env = makeValidEnv({
      NEX_AGENT_INTERNET_FORCE_OFFLINE: "1",
      NEX_AGENT_INTERNET_FORCE_ONLINE: "1",
      NEX_LOCAL_ONLY: "1",
    });
    const result = validateEnvironment({ env });
    const names = result.prohibited.map((p) => p.name);
    expect(names).toContain("NEX_AGENT_INTERNET_FORCE_OFFLINE");
    expect(names).toContain("NEX_AGENT_INTERNET_FORCE_ONLINE");
    expect(names).toContain("NEX_LOCAL_ONLY");
  });

  it("rejects NEX_CROSS_DB_RECONCILER_ENABLED=true", () => {
    const env = makeValidEnv({ NEX_CROSS_DB_RECONCILER_ENABLED: "true" });
    const result = validateEnvironment({ env });
    expect(result.prohibited.map((p) => p.name)).toContain("NEX_CROSS_DB_RECONCILER_ENABLED");
  });
});

// ─── Warnings · payment not implemented ───────────────────────────

describe("validateEnvironment · warnings", () => {
  it("warns when STRIPE_SECRET_KEY is set (payment not wired)", () => {
    const env = makeValidEnv({ STRIPE_SECRET_KEY: "sk_live_PLACEHOLDER_only_do_not_use" });
    const result = validateEnvironment({ env });
    // Warnings are informational · they do NOT fail validation.
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.name)).toContain("STRIPE_SECRET_KEY");
  });
});

// ─── Secret-leak safety · the critical discipline ─────────────────

describe("validateEnvironment · never prints variable values", () => {
  it("missing-required scenario · no supplied value appears in messages", () => {
    const SENTINEL = "SECRET_SENTINEL_VALUE_abcdef0123456789_do_not_leak";
    const env = makeValidEnv();
    // Make one required var invalid using SENTINEL (not a real JWT)
    env.NEX_SUPABASE_SERVICE_ROLE_KEY = SENTINEL;
    const result = validateEnvironment({ env });
    for (const line of result.messages) {
      expect(line).not.toContain(SENTINEL);
    }
    // Also check the structured result · no `invalid` reason should
    // echo the value.
    for (const entry of result.invalid) {
      expect(JSON.stringify(entry)).not.toContain(SENTINEL);
    }
  });

  it("prohibited-presence scenario · no supplied value appears in messages", () => {
    const SENTINEL = "LEAK_IF_YOU_SEE_ME_xyzqrst0987654321";
    const env = makeValidEnv({ SUPABASE_URL: SENTINEL });
    const result = validateEnvironment({ env });
    for (const line of result.messages) {
      expect(line).not.toContain(SENTINEL);
    }
    for (const entry of result.prohibited) {
      expect(JSON.stringify(entry)).not.toContain(SENTINEL);
    }
  });

  it("adversarial values with newlines are rejected without echoing content", () => {
    const SENTINEL_WITH_NEWLINE = "LEAK_NEWLINE_abcdefghij\nmore_leakage_SHOULD_NOT_APPEAR";
    const env = makeValidEnv({ NEX_SESSION_SECRET: SENTINEL_WITH_NEWLINE });
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    for (const line of result.messages) {
      expect(line).not.toContain("LEAK_NEWLINE");
      expect(line).not.toContain("more_leakage");
    }
  });

  it("credential-shaped adversarial values are not echoed", () => {
    const CRED_SHAPES = [
      "eyJfake.eyJfake.eyJfake",
      "sk-live_FAKE_openai_key",
      "AKIAFAKEAWSKEYID",
      "re_fakeresend_api_key_0123456789",
      "xoxb-fake-slack-bot-token-1234",
    ];
    for (const bad of CRED_SHAPES) {
      const env = makeValidEnv({ NEX_SUPABASE_SERVICE_ROLE_KEY: bad });
      const result = validateEnvironment({ env });
      for (const line of result.messages) {
        expect(line, `credential-shape leaked: ${bad}`).not.toContain(bad);
      }
    }
  });

  it("captured output through injected log sink also never contains values", () => {
    const SENTINEL = "LOG_SINK_LEAK_sentinel_do_not_appear_HiJkLmNoPq";
    const captured = [];
    const env = makeValidEnv({ ENC_KEY: SENTINEL });
    // ENC_KEY=SENTINEL is 48 chars so passes secret-32 · emit no error there.
    // Add a definite failure elsewhere so the validator emits some output.
    delete env.CRON_SECRET;
    validateEnvironment({ env, log: (m) => captured.push(m) });
    for (const line of captured) {
      expect(line).not.toContain(SENTINEL);
    }
  });
});

// ─── Input immutability ───────────────────────────────────────────

describe("validateEnvironment · input env object is NOT mutated", () => {
  it("env object stays byte-identical after a passing validation", () => {
    const env = makeValidEnv();
    const before = JSON.stringify(env);
    validateEnvironment({ env });
    expect(JSON.stringify(env)).toBe(before);
  });

  it("env object stays byte-identical after a failing validation", () => {
    const env = makeValidEnv({
      SUPABASE_URL: "https://legacy.example",
      NEX_ALLOW_DEV_ADMIN: "1",
    });
    delete env.NEX_SUPABASE_URL;
    const before = JSON.stringify(env);
    const result = validateEnvironment({ env });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(env)).toBe(before);
  });

  it("Object.freeze(env) does not throw · validator never writes", () => {
    const env = Object.freeze(makeValidEnv());
    // Would throw TypeError in strict mode if the validator wrote.
    expect(() => validateEnvironment({ env })).not.toThrow();
  });
});

// ─── Determinism · no reliance on real process.env ────────────────

describe("validateEnvironment · determinism", () => {
  it("two consecutive calls with the same env return identical structural results", () => {
    const env = makeValidEnv();
    const r1 = validateEnvironment({ env });
    const r2 = validateEnvironment({ env });
    expect(r1.ok).toBe(r2.ok);
    expect(r1.missing).toEqual(r2.missing);
    expect(r1.invalid).toEqual(r2.invalid);
    expect(r1.decisions).toEqual(r2.decisions);
    expect(r1.prohibited).toEqual(r2.prohibited);
    expect(r1.warnings).toEqual(r2.warnings);
  });

  it("validator does NOT touch process.env (empty injected env → structured failure, not crash)", () => {
    const result = validateEnvironment({ env: {} });
    expect(result.ok).toBe(false);
    // All 10 required missing.
    expect(result.missing.length).toBe(REQUIRED_PHASE1.length);
    // All 4 decisions pending.
    expect(result.decisions.length).toBe(DECISION_REQUIRED.length);
  });
});

// ─── Input defensive handling ─────────────────────────────────────

describe("validateEnvironment · input guards", () => {
  it("non-object env returns a structured failure, does not throw", () => {
    const r1 = validateEnvironment({ env: null });
    expect(r1.ok).toBe(false);
    expect(r1.profile).toBe(null);

    const r2 = validateEnvironment({ env: "string-is-not-an-env-object" });
    expect(r2.ok).toBe(false);

    const r3 = validateEnvironment({ env: 42 });
    expect(r3.ok).toBe(false);
  });

  it("unknown profile returns a structured failure", () => {
    const result = validateEnvironment({ env: makeValidEnv(), profile: "fake-profile" });
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.includes("unknown profile"))).toBe(true);
  });
});

// ─── CLI wrapper · exit codes ─────────────────────────────────────

describe("runValidator CLI wrapper", () => {
  function captureCli({ argv = [], env = {} } = {}) {
    const captured = [];
    let exitCode = null;
    const result = runValidator({
      argv,
      env,
      log: (m) => captured.push(m),
      exit: (code) => { exitCode = code; },
    });
    return { exitCode, captured, result };
  }

  it("exits 0 on a valid Phase 1 env", () => {
    const { exitCode, result } = captureCli({ env: makeValidEnv() });
    expect(result.ok).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("exits 1 on hard failure (missing required)", () => {
    const env = makeValidEnv();
    delete env.NEX_SUPABASE_URL;
    const { exitCode, result } = captureCli({ env });
    expect(result.ok).toBe(false);
    expect(exitCode).toBe(1);
  });

  it("exits 1 on prohibited presence", () => {
    const env = makeValidEnv({ SUPABASE_URL: "https://legacy.supabase.co" });
    const { exitCode } = captureCli({ env });
    expect(exitCode).toBe(1);
  });

  it("exits 2 on decisions-only pending (no hard failures)", () => {
    const env = makeValidEnv();
    delete env.NEX_POSTGRES_URL;
    const { exitCode, result } = captureCli({ env });
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.prohibited).toEqual([]);
    expect(exitCode).toBe(2);
  });

  it("accepts --profile=production-phase1", () => {
    const { exitCode } = captureCli({
      argv: ["--profile=production-phase1"],
      env: makeValidEnv(),
    });
    expect(exitCode).toBe(0);
  });

  it("surfaces unknown profile as exit 1", () => {
    const { exitCode, captured } = captureCli({
      argv: ["--profile=does-not-exist"],
      env: makeValidEnv(),
    });
    expect(exitCode).toBe(1);
    expect(captured.some((m) => m.includes("unknown profile"))).toBe(true);
  });

  it("passed log sink receives messages but never a supplied value", () => {
    const SENTINEL = "CLI_LOG_LEAK_sentinel_1234567890abc";
    const env = makeValidEnv({ NEX_SESSION_SECRET: SENTINEL + "_padding_to_32_chars_____" });
    // SENTINEL + padding > 32 chars so passes format; just verify no echo.
    const { captured } = captureCli({ env });
    for (const line of captured) {
      expect(line).not.toContain(SENTINEL);
    }
  });

  it("defaults to production-phase1 profile when no --profile flag passed", () => {
    const { result } = captureCli({ env: makeValidEnv() });
    expect(result.profile).toBe(PROFILE_PRODUCTION_PHASE1);
  });
});
