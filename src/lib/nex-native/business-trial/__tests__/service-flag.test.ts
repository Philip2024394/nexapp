// src/lib/nex-native/business-trial/__tests__/service-flag.test.ts
//
// G1 regression tests · T26 feature-flag enforcement at service layer.
// Separate from DB-touching tests so vitest can run this in isolation.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { isBusinessTrialEnabled } from "../service";

describe("isBusinessTrialEnabled · Q3 feature flag", () => {
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

  it("T26 · absent env var → disabled (false)", () => {
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("T26 · 'false' → disabled", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "false";
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("T26 · 'TRUE' (wrong case) → disabled (strict equality)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "TRUE";
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("T26 · 'yes' → disabled (strict equality)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "yes";
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("T26 · '1' → disabled (strict equality)", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "1";
    expect(isBusinessTrialEnabled()).toBe(false);
  });

  it("T26 · exact 'true' → enabled", () => {
    process.env.NEX_BUSINESS_TRIAL_ENABLED = "true";
    expect(isBusinessTrialEnabled()).toBe(true);
  });

  it("default-closed is the honest security posture · pilot never activates by accident", () => {
    // Even with 10 near-truthy values · only exact 'true' flips the gate
    const nearTruthy = ["True", "truE", " true", "true ", "True ", "1", "y", "yes", "on", ""];
    for (const v of nearTruthy) {
      process.env.NEX_BUSINESS_TRIAL_ENABLED = v;
      expect(isBusinessTrialEnabled()).toBe(false);
    }
  });
});
