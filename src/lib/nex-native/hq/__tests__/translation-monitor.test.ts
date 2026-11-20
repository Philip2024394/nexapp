// src/lib/nex-native/hq/__tests__/translation-monitor.test.ts
//
// Deterministic fixture tests for HQ translation monitoring composer.
// Owner-authorised 2026-11-17 · local verification only.
//
// These tests never issue a provider request; they verify the state
// composition from (a) env presence (b) recorded metrics outcomes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composeAvailability,
  composeProviderHealth,
  readTranslationMonitoringSnapshot,
} from "../translation-monitor";
import {
  _resetTranslationMetricsForTests,
  readTranslationMetrics,
  recordTranslationEvent,
} from "../../translation/metrics";

const ENV_KEYS = [
  "NEX_CHAT_TRANSLATION_ENABLED",
  "AZURE_TRANSLATOR_KEY",
  "AZURE_TRANSLATOR_REGION",
  "AZURE_TRANSLATOR_ENDPOINT",
  "NEX_ADMIN_EMAILS",
  "NEXT_PUBLIC_NEX_SUPABASE_URL",
];

describe("composeAvailability", () => {
  it("returns disabled when feature_disabled blocker present", () => {
    const m = { ...readTranslationMetrics(), providerSuccesses: 0 } as ReturnType<typeof readTranslationMetrics>;
    expect(composeAvailability(["feature_disabled"], m)).toBe("disabled");
  });

  it("returns configuration_incomplete on credential or allowlist blocker", () => {
    const m = { ...readTranslationMetrics(), providerSuccesses: 0 } as ReturnType<typeof readTranslationMetrics>;
    expect(composeAvailability(["missing_provider_credentials"], m)).toBe(
      "configuration_incomplete",
    );
    expect(composeAvailability(["missing_founder_allowlist"], m)).toBe(
      "configuration_incomplete",
    );
  });

  it("returns configured_not_live_tested when no blockers and no provider successes", () => {
    const m = { ...readTranslationMetrics(), providerSuccesses: 0 } as ReturnType<typeof readTranslationMetrics>;
    expect(composeAvailability([], m)).toBe("configured_not_live_tested");
  });

  it("returns configured only after at least one observed success", () => {
    const m = { ...readTranslationMetrics(), providerSuccesses: 1 } as ReturnType<typeof readTranslationMetrics>;
    expect(composeAvailability([], m)).toBe("configured");
  });
});

describe("composeProviderHealth", () => {
  beforeEach(() => _resetTranslationMetricsForTests(0));

  it("returns no_observations when no provider attempts", () => {
    expect(composeProviderHealth(readTranslationMetrics())).toBe("no_observations");
  });

  it("returns last_success after ok", () => {
    recordTranslationEvent({ outcome: "ok", charsSubmitted: 5, nowMs: 1 });
    expect(composeProviderHealth(readTranslationMetrics())).toBe("last_success");
  });

  it("maps provider_unavailable to unavailable", () => {
    recordTranslationEvent({ outcome: "provider_unavailable", charsSubmitted: 5, nowMs: 1 });
    expect(composeProviderHealth(readTranslationMetrics())).toBe("unavailable");
  });

  it("maps provider_quota_exhausted to quota_exhausted", () => {
    recordTranslationEvent({ outcome: "provider_quota_exhausted", charsSubmitted: 5, nowMs: 1 });
    expect(composeProviderHealth(readTranslationMetrics())).toBe("quota_exhausted");
  });

  it("maps provider_rate_limited to rate_limited", () => {
    recordTranslationEvent({ outcome: "provider_rate_limited", charsSubmitted: 5, nowMs: 1 });
    expect(composeProviderHealth(readTranslationMetrics())).toBe("rate_limited");
  });

  it("maps provider_timeout to degraded_last_failure", () => {
    recordTranslationEvent({ outcome: "provider_timeout", charsSubmitted: 5, nowMs: 1 });
    expect(composeProviderHealth(readTranslationMetrics())).toBe("degraded_last_failure");
  });
});

describe("readTranslationMonitoringSnapshot · honest state", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) original[k] = process.env[k];
    _resetTranslationMetricsForTests(0);
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    vi.restoreAllMocks();
  });

  it("reports feature_disabled when flag is unset", () => {
    delete process.env.NEX_CHAT_TRANSLATION_ENABLED;
    const s = readTranslationMonitoringSnapshot();
    expect(s.featureFlagEnabled).toBe(false);
    expect(s.blockers).toContain("feature_disabled");
    expect(s.availability).toBe("disabled");
  });

  it("reports missing credentials when env vars absent", () => {
    process.env.NEX_CHAT_TRANSLATION_ENABLED = "true";
    delete process.env.AZURE_TRANSLATOR_KEY;
    delete process.env.AZURE_TRANSLATOR_REGION;
    delete process.env.AZURE_TRANSLATOR_ENDPOINT;
    process.env.NEX_ADMIN_EMAILS = "founder@example.com";
    const s = readTranslationMonitoringSnapshot();
    expect(s.featureFlagEnabled).toBe(true);
    expect(s.blockers).toContain("missing_provider_credentials");
    expect(s.availability).toBe("configuration_incomplete");
    expect(s.provider.hasKey).toBe(false);
    expect(s.provider.hasRegion).toBe(false);
    expect(s.provider.hasEndpoint).toBe(false);
  });

  it("reports configured_not_live_tested when everything configured but no observed success", () => {
    process.env.NEX_CHAT_TRANSLATION_ENABLED = "true";
    process.env.AZURE_TRANSLATOR_KEY = "test-key";
    process.env.AZURE_TRANSLATOR_REGION = "eastus";
    process.env.AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
    process.env.NEX_ADMIN_EMAILS = "founder@example.com";
    const s = readTranslationMonitoringSnapshot();
    expect(s.blockers.length).toBe(0);
    expect(s.availability).toBe("configured_not_live_tested");
    expect(s.providerHealth).toBe("no_observations");
    expect(s.provider.hasKey).toBe(true);
    expect(s.provider.tierVerified).toBe(false);
    expect(s.provider.quotaVerified).toBe(false);
  });

  it("escalates to configured only after a recorded success", () => {
    process.env.NEX_CHAT_TRANSLATION_ENABLED = "true";
    process.env.AZURE_TRANSLATOR_KEY = "test-key";
    process.env.AZURE_TRANSLATOR_REGION = "eastus";
    process.env.AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
    process.env.NEX_ADMIN_EMAILS = "founder@example.com";
    recordTranslationEvent({ outcome: "ok", charsSubmitted: 12, nowMs: 42 });
    const s = readTranslationMonitoringSnapshot();
    expect(s.availability).toBe("configured");
    expect(s.providerHealth).toBe("last_success");
  });

  it("never returns credential values · only presence booleans", () => {
    process.env.NEX_CHAT_TRANSLATION_ENABLED = "true";
    process.env.AZURE_TRANSLATOR_KEY = "SUPER-SECRET-KEY";
    process.env.AZURE_TRANSLATOR_REGION = "eastus";
    process.env.AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
    process.env.NEX_ADMIN_EMAILS = "founder@example.com";
    const s = readTranslationMonitoringSnapshot();
    const serialised = JSON.stringify(s);
    expect(serialised).not.toContain("SUPER-SECRET-KEY");
    expect(serialised).not.toContain("api.cognitive.microsofttranslator.com");
    expect(s.provider.hasKey).toBe(true);
  });

  it("flags process-local metrics scope honestly", () => {
    const s = readTranslationMonitoringSnapshot();
    expect(s.metricsCaveats.scope).toBe("this_process_only_not_platform_wide");
    expect(s.metricsCaveats.collection).toBe("in_process_memory_only");
    expect(s.metricsCaveats.uniqueCustomersMetric).toBe("not_collected");
    expect(s.pilotScope.preferencePersistence).toBe("device_local_only_no_server_record");
    expect(s.pilotScope.rateLimitScope).toBe("process_local_not_cross_instance");
  });
});
