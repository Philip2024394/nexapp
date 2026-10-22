// src/lib/nex-native/business-trial/__tests__/audit-pepper.test.ts
//
// G1 Final Readiness · Fail-closed pepper policy verification.
// =============================================================
// Proves that NEX_AUDIT_HASH_PEPPER is REQUIRED in non-test contexts and
// that the test-only sentinel fallback cannot be used in a real deployment.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  resolveAuditPepper,
  NexAuditPepperMissingError,
  AUDIT_PEPPER_ENV,
  MIN_PEPPER_LENGTH,
} from "../audit-pepper";

// Save + restore every env var we touch · never leak to other tests.
const SAVED_PEPPER = process.env[AUDIT_PEPPER_ENV];
const SAVED_NODE_ENV = (process.env as Record<string, string | undefined>).NODE_ENV;
const SAVED_VITEST = process.env.VITEST;

function restoreEnv(): void {
  if (SAVED_PEPPER === undefined) {
    delete process.env[AUDIT_PEPPER_ENV];
  } else {
    process.env[AUDIT_PEPPER_ENV] = SAVED_PEPPER;
  }
  if (SAVED_NODE_ENV === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  } else {
    (process.env as Record<string, string | undefined>).NODE_ENV = SAVED_NODE_ENV;
  }
  if (SAVED_VITEST === undefined) {
    delete process.env.VITEST;
  } else {
    process.env.VITEST = SAVED_VITEST;
  }
}

afterEach(() => {
  restoreEnv();
});

describe("resolveAuditPepper · test-context fallback allowed", () => {
  beforeEach(() => {
    delete process.env[AUDIT_PEPPER_ENV];
    // vitest sets VITEST='true' automatically · verify
    process.env.VITEST = "true";
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  it("returns the test sentinel when env is absent + VITEST=true", () => {
    const result = resolveAuditPepper();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThanOrEqual(MIN_PEPPER_LENGTH);
    // Must NOT be a value that would be useful outside tests
    expect(result).toContain("test-only");
  });

  it("returns the explicit env value when set and >= min length (test context)", () => {
    const explicit = "a-strong-test-pepper-with-32-chars-xx";
    process.env[AUDIT_PEPPER_ENV] = explicit;
    expect(resolveAuditPepper()).toBe(explicit);
  });

  it("in test context, accepts a short value (tests may deliberately use short)", () => {
    process.env[AUDIT_PEPPER_ENV] = "short";
    expect(resolveAuditPepper()).toBe("short");
  });

  it("NODE_ENV=test also triggers test-context fallback (jest/vitest convention)", () => {
    delete process.env.VITEST;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).not.toThrow();
  });
});

describe("resolveAuditPepper · FAIL-CLOSED in non-test contexts", () => {
  beforeEach(() => {
    // Simulate production: no VITEST, NODE_ENV != test
    delete process.env.VITEST;
    delete (process.env as Record<string, string | undefined>).NODE_ENV; // undefined is NOT 'test' · counts as non-test
  });

  it("throws NexAuditPepperMissingError when env absent in non-test context", () => {
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
    try {
      resolveAuditPepper();
    } catch (err) {
      const e = err as NexAuditPepperMissingError;
      expect(e.code).toBe("audit_pepper_missing");
      expect(e.message).toContain("REQUIRED");
    }
  });

  it("throws NexAuditPepperMissingError when env is empty string in non-test context", () => {
    process.env[AUDIT_PEPPER_ENV] = "";
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });

  it("throws NexAuditPepperMissingError when env is too short in non-test context", () => {
    process.env[AUDIT_PEPPER_ENV] = "short"; // 5 chars · below min of 16
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
    try {
      resolveAuditPepper();
    } catch (err) {
      const e = err as NexAuditPepperMissingError;
      expect(e.message).toContain("too short");
      expect(e.message).toContain(String(MIN_PEPPER_LENGTH));
    }
  });

  it("NODE_ENV='development' is a non-test context · must fail closed", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });

  it("NODE_ENV='production' is a non-test context · must fail closed", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });

  it("NODE_ENV='preview' (Vercel preview) is a non-test context · must fail closed", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "preview";
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });

  it("VITEST='false' explicitly disables test-context detection", () => {
    process.env.VITEST = "false";
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });

  it("real-length pepper passes in non-test context", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env[AUDIT_PEPPER_ENV] =
      "a".repeat(MIN_PEPPER_LENGTH); // exactly min length
    expect(resolveAuditPepper()).toBe("a".repeat(MIN_PEPPER_LENGTH));
  });

  it("a 64-char hex pepper (typical secure value) passes", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env[AUDIT_PEPPER_ENV] =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(resolveAuditPepper()).toBe(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
  });
});

describe("resolveAuditPepper · defence against sentinel leaking into production", () => {
  it("the sentinel value cannot be the same as a developer could pass in production", () => {
    // Even if an attacker/misconfig set NEX_AUDIT_HASH_PEPPER='nex-test-only-pepper-do-not-use'
    // in production, the resolver would ACCEPT it (because it's >= 16 chars).
    // That is a configuration error separate from the fail-closed guard.
    // The sentinel's long "do-not-use" suffix is a documentation signal; the
    // true defence is operators auditing their env config.
    //
    // This test documents the honest limitation: the resolver cannot detect
    // "operator used the sentinel string on purpose in production". It CAN
    // and DOES prevent the fallback from being silently applied.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VITEST;
    process.env[AUDIT_PEPPER_ENV] = "nex-test-only-pepper-do-not-use";
    const result = resolveAuditPepper();
    expect(result).toBe("nex-test-only-pepper-do-not-use");
    // Honest documentation · not an error · operator must know not to copy the sentinel.
  });

  it("the fallback sentinel is ONLY returned when env is absent AND test context", () => {
    // Verify no code path returns the sentinel outside test contexts.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VITEST;
    delete process.env[AUDIT_PEPPER_ENV];
    expect(() => resolveAuditPepper()).toThrow(NexAuditPepperMissingError);
  });
});
