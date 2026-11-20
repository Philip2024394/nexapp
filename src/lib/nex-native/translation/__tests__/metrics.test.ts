// src/lib/nex-native/translation/__tests__/metrics.test.ts
//
// Deterministic unit tests for the process-local translation metrics
// counters. Owner-authorised 2026-11-17 · local verification only.

import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetTranslationMetricsForTests,
  readTranslationMetrics,
  recordTranslationEvent,
} from "../metrics";

describe("translation metrics · process-local counters", () => {
  beforeEach(() => _resetTranslationMetricsForTests(0));

  it("starts empty", () => {
    const s = readTranslationMetrics();
    expect(s.totalRequests).toBe(0);
    expect(s.providerAttempts).toBe(0);
    expect(s.providerSuccesses).toBe(0);
    expect(s.lastOutcome).toBeNull();
    expect(s.charactersSubmittedEstimate).toBe(0);
  });

  it("records a successful provider attempt", () => {
    recordTranslationEvent({ outcome: "ok", charsSubmitted: 42, nowMs: 1000 });
    const s = readTranslationMetrics();
    expect(s.totalRequests).toBe(1);
    expect(s.providerAttempts).toBe(1);
    expect(s.providerSuccesses).toBe(1);
    expect(s.providerFailures).toBe(0);
    expect(s.charactersSubmittedEstimate).toBe(42);
    expect(s.lastOutcome).toBe("ok");
    expect(s.lastProviderSuccessAtIso).not.toBeNull();
  });

  it("classifies gate rejections as non-provider attempts with zero chars", () => {
    recordTranslationEvent({ outcome: "not_founder", charsSubmitted: 999, nowMs: 2000 });
    recordTranslationEvent({ outcome: "feature_disabled", charsSubmitted: 500, nowMs: 3000 });
    const s = readTranslationMetrics();
    expect(s.totalRequests).toBe(2);
    expect(s.providerAttempts).toBe(0);
    expect(s.charactersSubmittedEstimate).toBe(0);
    expect(s.outcomeCounts.not_founder).toBe(1);
    expect(s.outcomeCounts.feature_disabled).toBe(1);
  });

  it("tracks provider timeout + rate-limit + quota separately", () => {
    recordTranslationEvent({ outcome: "provider_timeout", charsSubmitted: 10, nowMs: 1 });
    recordTranslationEvent({ outcome: "provider_rate_limited", charsSubmitted: 20, nowMs: 2 });
    recordTranslationEvent({ outcome: "provider_quota_exhausted", charsSubmitted: 30, nowMs: 3 });
    const s = readTranslationMetrics();
    expect(s.providerAttempts).toBe(3);
    expect(s.providerFailures).toBe(3);
    expect(s.providerTimeouts).toBe(1);
    expect(s.providerRateLimited).toBe(1);
    expect(s.providerQuotaExhausted).toBe(1);
    expect(s.charactersSubmittedEstimate).toBe(60);
    expect(s.lastOutcome).toBe("provider_quota_exhausted");
  });

  it("collectionStart does not change between recordings", () => {
    const before = readTranslationMetrics().collectionStartIso;
    recordTranslationEvent({ outcome: "ok", charsSubmitted: 1, nowMs: 10 });
    recordTranslationEvent({ outcome: "ok", charsSubmitted: 1, nowMs: 20 });
    expect(readTranslationMetrics().collectionStartIso).toBe(before);
  });

  it("does not record negative character counts", () => {
    recordTranslationEvent({ outcome: "ok", charsSubmitted: -5, nowMs: 100 });
    expect(readTranslationMetrics().charactersSubmittedEstimate).toBe(0);
  });
});
