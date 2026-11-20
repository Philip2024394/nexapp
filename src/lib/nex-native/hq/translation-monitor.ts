// src/lib/nex-native/hq/translation-monitor.ts
//
// Server-only HQ reader for the chat-translation pilot monitoring page.
// Owner-authorised 2026-11-17 · local/sandbox only.
//
// HONEST STATE MODEL (per directive):
//
//   availability      · one of: "disabled" | "configuration_incomplete"
//                              | "configured_not_live_tested"
//                              | "configured" | "unknown"
//
//   provider_health   · one of: "unknown" | "last_success"
//                              | "degraded_last_failure"
//                              | "rate_limited" | "quota_exhausted"
//                              | "unavailable" | "no_observations"
//
// These are derived from (a) real environment presence checks and
// (b) PROCESS-LOCAL observations recorded by translate-service.ts.
// Neither indicator fires a provider request · painting an indicator
// green must never cost the owner money.
//
// NEVER returns credentials, endpoint hosts, or message bodies.
// The admin UI calls this via an HQ-admin-gated server action.

import "server-only";
import {
  describeTranslationBlockers,
  isTranslationPilotEnabled,
} from "../translation/translation-flag";
import {
  readTranslationMetrics,
  type TranslationMetricsSnapshot,
} from "../translation/metrics";
import {
  MAX_INPUT_CHARS,
  MIN_CONFIDENT_AUTO_TRANSLATE_CHARS,
  PILOT_LANGUAGES,
} from "../translation/supported-languages";

export type TranslationAvailabilityState =
  | "disabled"
  | "configuration_incomplete"
  | "configured_not_live_tested"
  | "configured"
  | "unknown";

export type TranslationProviderHealth =
  | "unknown"
  | "no_observations"
  | "last_success"
  | "degraded_last_failure"
  | "rate_limited"
  | "quota_exhausted"
  | "unavailable";

export interface TranslationProviderConfigView {
  readonly providerName: "Azure AI Translator (Text Translation API v3)";
  readonly hasKey: boolean;
  readonly hasRegion: boolean;
  readonly hasEndpoint: boolean;
  readonly envVarNames: {
    readonly key: "AZURE_TRANSLATOR_KEY";
    readonly region: "AZURE_TRANSLATOR_REGION";
    readonly endpoint: "AZURE_TRANSLATOR_ENDPOINT";
    readonly featureFlag: "NEX_CHAT_TRANSLATION_ENABLED";
    readonly founderAllowlist: "NEX_ADMIN_EMAILS";
  };
  readonly founderAllowlistConfigured: boolean;
  readonly tierVerified: boolean; // always false in the pilot
  readonly quotaVerified: boolean; // always false in the pilot
}

export interface TranslationMonitoringSnapshot {
  readonly observedAtIso: string;
  readonly environment: "sandbox" | "local" | "unknown";
  readonly featureFlagEnabled: boolean;
  readonly blockers: ReadonlyArray<
    | "feature_disabled"
    | "missing_provider_credentials"
    | "missing_founder_allowlist"
  >;
  readonly availability: TranslationAvailabilityState;
  readonly providerHealth: TranslationProviderHealth;
  readonly pilotScope: {
    readonly founderOnly: true;
    readonly autoTranslateDefault: "off";
    readonly supportedLanguageCodes: ReadonlyArray<string>;
    readonly maxInputChars: number;
    readonly minAutoTranslateChars: number;
    readonly timeoutMsDefault: 8000;
    readonly retryPolicy: "retry_once_on_transient_bounded_backoff";
    readonly rateLimitPerAccountPerMinute: 60;
    readonly maxInFlightPerAccount: 4;
    readonly rateLimitScope: "process_local_not_cross_instance";
    readonly preferencePersistence: "device_local_only_no_server_record";
  };
  readonly provider: TranslationProviderConfigView;
  readonly metrics: TranslationMetricsSnapshot;
  readonly metricsCaveats: {
    readonly collection: "in_process_memory_only";
    readonly resetsOn: "server_restart";
    readonly scope: "this_process_only_not_platform_wide";
    readonly populationLimitation: "founder_only_pilot_not_customer_adoption";
    readonly notBilledUsage: "character_count_is_app_estimate_not_microsoft_billed";
    readonly uniqueCustomersMetric: "not_collected";
    readonly uniqueCustomersBlocker: "durable_storage_approval_required";
  };
  readonly externalProcessingDisclosure: {
    readonly provider: "Azure AI Translator";
    readonly dataSent: "only_the_decrypted_bubble_text_the_viewer_chose_to_read";
    readonly outgoingMessages: "never_sent";
    readonly vaultContent: "excluded";
    readonly credentialLogging: "never_logged";
  };
}

function detectEnvironment(): "sandbox" | "local" | "unknown" {
  const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
  // Dev `.env.local` currently points at the sandbox project per the
  // sealed 2026-11-10 swap · the env-detect is informational for the
  // HQ UI and never used to relax a gate.
  if (/kdstoyyeygcopkogqsyv/.test(url)) return "sandbox";
  if (/localhost|127\.0\.0\.1/.test(url) || url === "") return "local";
  return "unknown";
}

/** Composes availability from flag + credentials + observed provider
 *  evidence. Intentionally conservative: we only claim "configured"
 *  (the strongest state) when we have an observed recent success.
 *  Without one, the strongest state we may report is
 *  "configured_not_live_tested". */
export function composeAvailability(
  blockers: ReadonlyArray<string>,
  metrics: TranslationMetricsSnapshot,
): TranslationAvailabilityState {
  if (blockers.includes("feature_disabled")) return "disabled";
  if (
    blockers.includes("missing_provider_credentials") ||
    blockers.includes("missing_founder_allowlist")
  ) {
    return "configuration_incomplete";
  }
  if (metrics.providerSuccesses > 0) return "configured";
  return "configured_not_live_tested";
}

export function composeProviderHealth(
  metrics: TranslationMetricsSnapshot,
): TranslationProviderHealth {
  if (metrics.providerAttempts === 0) return "no_observations";
  if (metrics.lastOutcome === "ok") return "last_success";
  if (metrics.lastOutcome === "provider_rate_limited") return "rate_limited";
  if (metrics.lastOutcome === "provider_quota_exhausted") return "quota_exhausted";
  if (
    metrics.lastOutcome === "provider_unavailable" ||
    metrics.lastOutcome === "provider_timeout" ||
    metrics.lastOutcome === "provider_auth_failed" ||
    metrics.lastOutcome === "provider_malformed_response"
  ) {
    // Prefer "unavailable" only for 5xx/parse; other failures are
    // "degraded" so the UI distinguishes "last attempt failed" from
    // "provider is down".
    if (metrics.lastOutcome === "provider_unavailable") return "unavailable";
    return "degraded_last_failure";
  }
  return "unknown";
}

export function readTranslationMonitoringSnapshot(): TranslationMonitoringSnapshot {
  const blockers = describeTranslationBlockers();
  const metrics = readTranslationMetrics();
  const availability = composeAvailability(blockers, metrics);
  const providerHealth = composeProviderHealth(metrics);

  const hasKey = (process.env.AZURE_TRANSLATOR_KEY ?? "").length > 0;
  const hasRegion = (process.env.AZURE_TRANSLATOR_REGION ?? "").length > 0;
  const hasEndpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT ?? "").length > 0;
  const founderAllowlistConfigured =
    (process.env.NEX_ADMIN_EMAILS ?? "").trim().length > 0;

  return {
    observedAtIso: new Date().toISOString(),
    environment: detectEnvironment(),
    featureFlagEnabled: isTranslationPilotEnabled(),
    blockers,
    availability,
    providerHealth,
    pilotScope: {
      founderOnly: true,
      autoTranslateDefault: "off",
      supportedLanguageCodes: PILOT_LANGUAGES.map((l) => l.code),
      maxInputChars: MAX_INPUT_CHARS,
      minAutoTranslateChars: MIN_CONFIDENT_AUTO_TRANSLATE_CHARS,
      timeoutMsDefault: 8000,
      retryPolicy: "retry_once_on_transient_bounded_backoff",
      rateLimitPerAccountPerMinute: 60,
      maxInFlightPerAccount: 4,
      rateLimitScope: "process_local_not_cross_instance",
      preferencePersistence: "device_local_only_no_server_record",
    },
    provider: {
      providerName: "Azure AI Translator (Text Translation API v3)",
      hasKey,
      hasRegion,
      hasEndpoint,
      envVarNames: {
        key: "AZURE_TRANSLATOR_KEY",
        region: "AZURE_TRANSLATOR_REGION",
        endpoint: "AZURE_TRANSLATOR_ENDPOINT",
        featureFlag: "NEX_CHAT_TRANSLATION_ENABLED",
        founderAllowlist: "NEX_ADMIN_EMAILS",
      },
      founderAllowlistConfigured,
      tierVerified: false,
      quotaVerified: false,
    },
    metrics,
    metricsCaveats: {
      collection: "in_process_memory_only",
      resetsOn: "server_restart",
      scope: "this_process_only_not_platform_wide",
      populationLimitation: "founder_only_pilot_not_customer_adoption",
      notBilledUsage: "character_count_is_app_estimate_not_microsoft_billed",
      uniqueCustomersMetric: "not_collected",
      uniqueCustomersBlocker: "durable_storage_approval_required",
    },
    externalProcessingDisclosure: {
      provider: "Azure AI Translator",
      dataSent: "only_the_decrypted_bubble_text_the_viewer_chose_to_read",
      outgoingMessages: "never_sent",
      vaultContent: "excluded",
      credentialLogging: "never_logged",
    },
  };
}
