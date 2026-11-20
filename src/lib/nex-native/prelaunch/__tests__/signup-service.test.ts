// src/lib/nex-native/prelaunch/__tests__/signup-service.test.ts
//
// Authored 2026-11-18 · NEX prelaunch · signup-service wrapper tests.
//
// `nexSupabaseAdmin` is replaced with an in-memory mock so the 42P01,
// 23505, transient and success branches can be asserted without any
// network or database I/O. The mock accepts a top-level `_mode` string
// that each test sets.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Mode =
  | "success"
  | "undefined_table"
  | "unique_violation"
  | "transient";

const mock = {
  _mode: "success" as Mode,
};

vi.mock("@/lib/nex-native/supabase-admin", () => {
  return {
    nexSupabaseAdmin: {
      from(_table: string) {
        return {
          async insert(_row: unknown) {
            switch (mock._mode) {
              case "undefined_table":
                return { error: { code: "42P01" } };
              case "unique_violation":
                return { error: { code: "23505" } };
              case "transient":
                return { error: { code: "08006" } };
              default:
                return { error: null };
            }
          },
        };
      },
    },
  };
});

// Import AFTER vi.mock (hoisted) — guarantees mocked client in the module.
import {
  hashEmail,
  recordPrelaunchSignup,
} from "../signup-service";

const VALID_INPUT = {
  normalisedEmail: "alice@example.com",
  source: "nexcorner_landing_v1" as const,
};

describe("recordPrelaunchSignup", () => {
  beforeEach(() => {
    mock._mode = "success";
  });

  it("rejects an unknown source before touching the DB", async () => {
    const r = await recordPrelaunchSignup({
      ...VALID_INPUT,
      // @ts-expect-error — intentional bad input
      source: "some_other_source",
    });
    expect(r).toEqual({ ok: false, reason: "invalid_source" });
  });

  it("returns ok/new on successful insert", async () => {
    mock._mode = "success";
    const r = await recordPrelaunchSignup(VALID_INPUT);
    expect(r).toEqual({ ok: true, state: "new" });
  });

  it("returns migration_not_applied on 42P01 (table missing)", async () => {
    mock._mode = "undefined_table";
    const r = await recordPrelaunchSignup(VALID_INPUT);
    expect(r).toEqual({ ok: false, reason: "migration_not_applied" });
  });

  it("hides unique-violation as ok/already_registered (never leaks membership)", async () => {
    mock._mode = "unique_violation";
    const r = await recordPrelaunchSignup(VALID_INPUT);
    expect(r).toEqual({ ok: true, state: "already_registered" });
  });

  it("returns transient on any other DB error", async () => {
    mock._mode = "transient";
    const r = await recordPrelaunchSignup(VALID_INPUT);
    expect(r).toEqual({ ok: false, reason: "transient" });
  });

  it("accepts optional user-agent and ip-hash without changing the envelope", async () => {
    mock._mode = "success";
    const r = await recordPrelaunchSignup({
      ...VALID_INPUT,
      userAgentOptional: "x".repeat(600),
      ipHashOptional: "y".repeat(200),
    });
    expect(r).toEqual({ ok: true, state: "new" });
  });
});

describe("hashEmail", () => {
  it("is deterministic for the same input", () => {
    expect(hashEmail("a@b.com")).toBe(hashEmail("a@b.com"));
  });

  it("differs for different inputs", () => {
    expect(hashEmail("a@b.com")).not.toBe(hashEmail("c@d.com"));
  });

  it("returns a 64-char lowercase hex string (SHA-256)", () => {
    const h = hashEmail("alice@example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
