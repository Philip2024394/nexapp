// src/lib/nex-native/business-trial/__tests__/service-flag.test.ts
//
// Shop Entitlement Contract § K-3 LOCK 2026-11-06 · default-TRUE feature flag.
// Replaces the earlier Q3 2026-10-18 default-FALSE posture, which was itself
// retired by the K-3 LOCK ("7-day trial auto-fires on first business signup.
// No card required."). The env var remains an opt-out escape hatch — explicit
// "false" disables; anything else (absent, empty, "true", "1", etc.) enables.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { isBusinessTrialEnabled } from "../service";

describe("isBusinessTrialEnabled · § K-3 LOCK feature flag · default TRUE", () => {
  const originalFlag = process.env.NEX_BUSINESS_TRIAL_ENABLED;

  beforeEach(() => {
    delete process.env.NEX_BUSINESS_TRIAL_ENABLED;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NEX_BUSINESS_TRIAL_ENABLED;
    } else {
      process.env.NEX_BUSINESS_TRIAL_ENABLED = originalFlag;
    }
  });

  it("absent env var → enabled (true) · default aligned with § K-3 LOCK", () => {
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("exact 'false' → disabled (opt-out escape hatch)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "false";
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("'FALSE' (wrong case) → enabled (strict equality · only lowercase 'false' disables)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "FALSE";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("'no' → enabled (strict equality)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "no";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("'0' → enabled (strict equality)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "0";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("empty string → enabled (not strictly 'false')", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("exact 'true' → enabled (explicit opt-in still works)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "true";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("default-open is the § K-3 LOCK posture · only an explicit 'false' disables", () => {
    // Nine near-falsy values that must NOT accidentally disable the trial
    const nearFalsy = ["False", "falsE", " false", "false ", "0", "no", "off", "N", "n"];
    for (const v of nearFalsy) {
      process.env.NEX_BUSINESS_TRIAL_ENABLED = v;
      expect(isBusinessTrialEnabled()).toBe(true);
    }
  });
});
