// src/lib/nex-native/translation/metrics.ts
//
// Process-local, in-memory event counters for the chat-translation
// pilot. Owner-authorised 2026-11-17 · local/sandbox only.
//
// DISCLOSED LIMITATIONS (surfaced by every HQ page that reads these):
//   · PROCESS-LOCAL. A multi-instance deployment has N independent
//     copies of these counters — the HQ page MUST label them as
//     "this process only", never as platform-wide statistics.
//   · VOLATILE. Counts reset when the Node process restarts. There is
//     NO durable storage · that would require a migration which is
//     NOT authorised in this pilot.
//   · NOT CUSTOMER TOTALS. The pilot is founder-only · counts here
//     reflect founder/test activity, not customer adoption.
//   · NO PII. We NEVER record message bodies, translations, account
//     identifiers, IPs, or any string that could identify a message.
//     We only count event names + outcome categories.
//
// Thread-safety: Node is single-threaded within a V8 isolate. These
// mutations are safe without a lock.

export type TranslationOutcome =
  | "ok"
  | "feature_disabled"
  | "not_signed_in"
  | "not_founder"
  | "unsupported_language"
  | "input_empty"
  | "input_too_long"
  | "same_language"
  | "ambiguous_short_text"
  | "rate_limited_local"
  | "too_many_in_flight"
  | "credentials_missing"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_quota_exhausted"
  | "provider_auth_failed"
  | "provider_malformed_response"
  | "unexpected_error";

export interface TranslationMetricsSnapshot {
  readonly collectionStartIso: string;
  readonly lastUpdatedIso: string | null;
  readonly totalRequests: number;
  readonly outcomeCounts: Readonly<Record<TranslationOutcome, number>>;
  readonly providerAttempts: number;
  readonly providerSuccesses: number;
  readonly providerFailures: number;
  readonly providerTimeouts: number;
  readonly providerRateLimited: number;
  readonly providerQuotaExhausted: number;
  readonly charactersSubmittedEstimate: number;
  readonly lastOutcome: TranslationOutcome | null;
  readonly lastOutcomeAtIso: string | null;
  readonly lastProviderSuccessAtIso: string | null;
  readonly lastProviderFailureAtIso: string | null;
}

interface MutableState {
  collectionStartIso: string;
  lastUpdatedIso: string | null;
  totalRequests: number;
  outcomeCounts: Partial<Record<TranslationOutcome, number>>;
  providerAttempts: number;
  providerSuccesses: number;
  providerFailures: number;
  providerTimeouts: number;
  providerRateLimited: number;
  providerQuotaExhausted: number;
  charactersSubmittedEstimate: number;
  lastOutcome: TranslationOutcome | null;
  lastOutcomeAtIso: string | null;
  lastProviderSuccessAtIso: string | null;
  lastProviderFailureAtIso: string | null;
}

function emptyState(nowIso: string): MutableState {
  return {
    collectionStartIso: nowIso,
    lastUpdatedIso: null,
    totalRequests: 0,
    outcomeCounts: {},
    providerAttempts: 0,
    providerSuccesses: 0,
    providerFailures: 0,
    providerTimeouts: 0,
    providerRateLimited: 0,
    providerQuotaExhausted: 0,
    charactersSubmittedEstimate: 0,
    lastOutcome: null,
    lastOutcomeAtIso: null,
    lastProviderSuccessAtIso: null,
    lastProviderFailureAtIso: null,
  };
}

const state: MutableState = emptyState(new Date().toISOString());

const PROVIDER_OUTCOMES: ReadonlySet<TranslationOutcome> = new Set([
  "ok",
  "provider_unavailable",
  "provider_timeout",
  "provider_rate_limited",
  "provider_quota_exhausted",
  "provider_auth_failed",
  "provider_malformed_response",
]);

export interface RecordTranslationEventInput {
  readonly outcome: TranslationOutcome;
  /** Submitted character count for billable-attempt estimation.
   *  Set to 0 when the request was rejected before reaching the provider
   *  (unsupported language, feature disabled, consent missing, etc.). */
  readonly charsSubmitted: number;
  /** Optional deterministic clock for tests. */
  readonly nowMs?: number;
}

export function recordTranslationEvent(input: RecordTranslationEventInput): void {
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  state.totalRequests += 1;
  state.outcomeCounts[input.outcome] =
    (state.outcomeCounts[input.outcome] ?? 0) + 1;
  state.lastOutcome = input.outcome;
  state.lastOutcomeAtIso = nowIso;
  state.lastUpdatedIso = nowIso;
  if (PROVIDER_OUTCOMES.has(input.outcome)) {
    state.providerAttempts += 1;
    state.charactersSubmittedEstimate += Math.max(0, input.charsSubmitted | 0);
    if (input.outcome === "ok") {
      state.providerSuccesses += 1;
      state.lastProviderSuccessAtIso = nowIso;
    } else {
      state.providerFailures += 1;
      state.lastProviderFailureAtIso = nowIso;
      if (input.outcome === "provider_timeout") state.providerTimeouts += 1;
      if (input.outcome === "provider_rate_limited") state.providerRateLimited += 1;
      if (input.outcome === "provider_quota_exhausted")
        state.providerQuotaExhausted += 1;
    }
  }
}

const ALL_OUTCOMES: readonly TranslationOutcome[] = [
  "ok",
  "feature_disabled",
  "not_signed_in",
  "not_founder",
  "unsupported_language",
  "input_empty",
  "input_too_long",
  "same_language",
  "ambiguous_short_text",
  "rate_limited_local",
  "too_many_in_flight",
  "credentials_missing",
  "provider_unavailable",
  "provider_timeout",
  "provider_rate_limited",
  "provider_quota_exhausted",
  "provider_auth_failed",
  "provider_malformed_response",
  "unexpected_error",
];

export function readTranslationMetrics(): TranslationMetricsSnapshot {
  const outcomeCounts: Record<TranslationOutcome, number> = {} as Record<
    TranslationOutcome,
    number
  >;
  for (const o of ALL_OUTCOMES) outcomeCounts[o] = state.outcomeCounts[o] ?? 0;
  return {
    collectionStartIso: state.collectionStartIso,
    lastUpdatedIso: state.lastUpdatedIso,
    totalRequests: state.totalRequests,
    outcomeCounts,
    providerAttempts: state.providerAttempts,
    providerSuccesses: state.providerSuccesses,
    providerFailures: state.providerFailures,
    providerTimeouts: state.providerTimeouts,
    providerRateLimited: state.providerRateLimited,
    providerQuotaExhausted: state.providerQuotaExhausted,
    charactersSubmittedEstimate: state.charactersSubmittedEstimate,
    lastOutcome: state.lastOutcome,
    lastOutcomeAtIso: state.lastOutcomeAtIso,
    lastProviderSuccessAtIso: state.lastProviderSuccessAtIso,
    lastProviderFailureAtIso: state.lastProviderFailureAtIso,
  };
}

/** Tests only · resets the process-local counters. Not exported from
 *  any public barrel; dynamic-imported by HQ fixture tests. */
export function _resetTranslationMetricsForTests(nowMs?: number): void {
  const fresh = emptyState(new Date(nowMs ?? Date.now()).toISOString());
  Object.assign(state, fresh);
}
