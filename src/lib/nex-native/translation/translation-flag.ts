// src/lib/nex-native/translation/translation-flag.ts
//
// Founder-only chat-translation pilot · owner-authorised 2026-11-17.
// PREPARATION + LOCAL VERIFICATION ONLY · NOT a public rollout.
//
// Flag rules (per directive):
//   · Default OFF. Live provider stays BLOCKED until an explicit
//     authorised Azure Translator F0 resource is configured AND the
//     founder-gate email is on the allow-list.
//   · The flag check is a strict string-match pattern consistent with
//     other NEX feature flags (dispatch, commerce).
//   · A separate function reports the "why" a request is blocked so
//     the UI can give truthful feedback without exposing secrets.
//
// This module is import-safe: zero side effects, zero DB reads, zero
// secret logging. Callers can ask "is live translation possible right
// now?" at import time without triggering any network or DB IO.

export type TranslationBlocker =
  | "feature_disabled"
  | "missing_provider_credentials"
  | "missing_founder_allowlist";

/** Strict string-match flag · matches the NEX convention. */
export function isTranslationPilotEnabled(): boolean {
  return process.env.NEX_CHAT_TRANSLATION_ENABLED === "true";
}

/**
 * Returns the list of reasons the live translation path is unavailable
 * on this server, in resolution order. Empty list means the live path
 * can be attempted (still subject to per-request auth + founder gate).
 *
 * This NEVER returns credential material. It only reports presence /
 * absence of each configured piece.
 */
export function describeTranslationBlockers(): ReadonlyArray<TranslationBlocker> {
  const out: TranslationBlocker[] = [];
  if (!isTranslationPilotEnabled()) {
    out.push("feature_disabled");
  }
  const hasKey = (process.env.AZURE_TRANSLATOR_KEY ?? "").length > 0;
  const hasRegion = (process.env.AZURE_TRANSLATOR_REGION ?? "").length > 0;
  const hasEndpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT ?? "").length > 0;
  if (!hasKey || !hasRegion || !hasEndpoint) {
    out.push("missing_provider_credentials");
  }
  const hasFounderAllowlist =
    (process.env.NEX_ADMIN_EMAILS ?? "").trim().length > 0;
  if (!hasFounderAllowlist) {
    out.push("missing_founder_allowlist");
  }
  return out;
}

/** True iff live translation CAN be attempted · still per-request gates apply. */
export function canAttemptLiveTranslation(): boolean {
  return describeTranslationBlockers().length === 0;
}
