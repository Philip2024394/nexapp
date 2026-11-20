// src/lib/nex-native/prelaunch/__tests__/email-normalise.test.ts
//
// Authored 2026-11-18 · NEX prelaunch · email normalise + validate tests.

import { describe, expect, it } from "vitest";
import { normaliseEmailForLaunchSignup } from "../email-normalise";

describe("normaliseEmailForLaunchSignup", () => {
  it("rejects non-string input as empty", () => {
    expect(normaliseEmailForLaunchSignup(undefined)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(normaliseEmailForLaunchSignup(null)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(normaliseEmailForLaunchSignup(42)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(normaliseEmailForLaunchSignup({})).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects whitespace-only / empty string", () => {
    expect(normaliseEmailForLaunchSignup("")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(normaliseEmailForLaunchSignup("   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("trims surrounding whitespace and lowercases", () => {
    expect(normaliseEmailForLaunchSignup("  Alice@Example.COM  ")).toEqual({
      ok: true,
      normalised: "alice@example.com",
    });
  });

  it("rejects obvious format failures", () => {
    expect(normaliseEmailForLaunchSignup("plainstring")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(normaliseEmailForLaunchSignup("no-at-sign.example.com")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(normaliseEmailForLaunchSignup("a@b")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(normaliseEmailForLaunchSignup("a@@b.com")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(normaliseEmailForLaunchSignup("a @b.com")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects when total length exceeds 254", () => {
    const local = "a".repeat(60);
    const domain = "b".repeat(200) + ".com";
    const raw = `${local}@${domain}`;
    expect(raw.length).toBeGreaterThan(254);
    expect(normaliseEmailForLaunchSignup(raw)).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("rejects when local-part exceeds 64 chars", () => {
    const local = "a".repeat(65);
    const raw = `${local}@example.com`;
    expect(raw.length).toBeLessThanOrEqual(254);
    expect(normaliseEmailForLaunchSignup(raw)).toEqual({
      ok: false,
      reason: "local_too_long",
    });
  });

  it("accepts standard-shaped addresses", () => {
    expect(normaliseEmailForLaunchSignup("user@example.com")).toEqual({
      ok: true,
      normalised: "user@example.com",
    });
    expect(normaliseEmailForLaunchSignup("u.ser+tag@sub.example.co.uk")).toEqual(
      { ok: true, normalised: "u.ser+tag@sub.example.co.uk" },
    );
  });
});
