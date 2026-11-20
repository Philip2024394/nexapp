// src/lib/nex-native/translation/__tests__/translation-flag.test.ts
//
// Deterministic tests for the pilot feature-flag module.
// Owner-authorised 2026-11-17 · local verification only.
//
// These tests manipulate process.env directly via vi.stubEnv. The
// module under test reads env vars on every call, so no module cache
// reset is required between cases.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  canAttemptLiveTranslation,
  describeTranslationBlockers,
  isTranslationPilotEnabled,
} from "../translation-flag";

describe("translation-flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isTranslationPilotEnabled requires strict string 'true'", () => {
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "false");
    expect(isTranslationPilotEnabled()).toBe(false);
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "1");
    expect(isTranslationPilotEnabled()).toBe(false);
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "true");
    expect(isTranslationPilotEnabled()).toBe(true);
  });

  it("describeTranslationBlockers reports every missing piece without leaking secrets", () => {
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "");
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "");
    vi.stubEnv("NEX_ADMIN_EMAILS", "");
    const blockers = describeTranslationBlockers();
    expect(blockers).toContain("feature_disabled");
    expect(blockers).toContain("missing_provider_credentials");
    expect(blockers).toContain("missing_founder_allowlist");
    // No credential material should leak into the blocker list.
    expect(blockers.every((b) => typeof b === "string" && b.length < 64)).toBe(
      true,
    );
  });

  it("canAttemptLiveTranslation only true when all four env knobs are set", () => {
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "true");
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "k");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "eastus");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com");
    vi.stubEnv("NEX_ADMIN_EMAILS", "owner@example.com");
    expect(canAttemptLiveTranslation()).toBe(true);
    // Drop any one and it should go false.
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "");
    expect(canAttemptLiveTranslation()).toBe(false);
  });
});
