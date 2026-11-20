// src/lib/nex-native/translation/translate-service.ts
//
// Server-side translation service for the founder-only pilot.
// Owner-authorised 2026-11-17 · local verification only.
//
// Responsibilities:
//   · Authenticate the caller (resolveSessionWithDevOverride).
//   · Enforce the founder gate (isAdminSession · NEX_ADMIN_EMAILS).
//   · Validate the target language and the input length.
//   · Enforce in-process rate + concurrency limits (documented as
//     in-process only · not cross-instance).
//   · Call the Azure adapter · surface typed errors truthfully.
//   · Return a structured result · NEVER return credentials or
//     provider-internal metadata.
//
// This service does NOT decrypt messages. It receives already-decrypted
// plaintext from the client (the client is the only party that holds
// the device key for the viewer). The service's job is to route that
// plaintext to the provider under the founder gate. Everything else
// (encryption, storage, read receipts) is unaffected by this pilot.
//
// Scope exclusions:
//   · Vault routes: this service is NEVER called from vault surfaces
//     (the client wires the pilot only in non-vault chat). The server
//     also refuses any caller whose session reports a vaulted context
//     when a future caller passes it in.
//   · Outgoing messages: not translated. The pilot translates
//     incoming text that the viewer has chosen to read.
//
// Logging discipline:
//   · We NEVER log message bodies, translations, or credentials.
//   · We log event NAMES + outcome CATEGORIES only. Not text.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import {
  translateText,
  type AzureTranslatorErrorReason,
} from "./azure-translator-adapter";
import {
  canAttemptLiveTranslation,
  describeTranslationBlockers,
} from "./translation-flag";
import {
  isPilotLanguage,
  MIN_CONFIDENT_AUTO_TRANSLATE_CHARS,
  MAX_INPUT_CHARS,
  type PilotLanguageCode,
} from "./supported-languages";
import {
  recordTranslationEvent,
  type TranslationOutcome,
} from "./metrics";

export type TranslateServiceReason =
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
  | AzureTranslatorErrorReason;

export interface TranslateServiceInput {
  readonly text: string;
  readonly from?: PilotLanguageCode;
  readonly to: PilotLanguageCode;
  readonly mode: "auto" | "manual";
  /** Optional overrides for tests · never set in production. */
  readonly testing?: {
    readonly fetchImpl?: typeof fetch;
    readonly timeoutMs?: number;
    readonly now?: () => number;
  };
}

export type TranslateServiceResult =
  | {
      readonly ok: true;
      readonly translation: string;
      readonly detectedSourceLanguage: string | null;
      readonly detectedConfidence: number | null;
    }
  | {
      readonly ok: false;
      readonly reason: TranslateServiceReason;
    };

// -----------------------------------------------------------------------------
// In-process rate + concurrency limits.
// -----------------------------------------------------------------------------
// LIMITATION we disclose in the pilot report: these limits are PER
// SERVER PROCESS. In multi-instance deployments the aggregate ceiling
// is (processes × these limits). The pilot keeps `NEX_CHAT_TRANSLATION_ENABLED`
// off in prod and the founder-allowlist tiny, so this is acceptable
// for the pilot envelope. Do NOT claim these replace Azure's quota
// enforcement.
//
// Numbers chosen for a small-envelope founder pilot — not for scale.
const RATE_WINDOW_MS = 60_000;
const MAX_REQ_PER_ACCOUNT_PER_MINUTE = 60;
const MAX_IN_FLIGHT_PER_ACCOUNT = 4;

const rateWindows = new Map<string, number[]>(); // account_id -> ts array
const inFlight = new Map<string, number>();       // account_id -> count

function pruneWindow(accountId: string, now: number): void {
  const arr = rateWindows.get(accountId);
  if (!arr) return;
  const cutoff = now - RATE_WINDOW_MS;
  while (arr.length > 0 && arr[0]! < cutoff) arr.shift();
}

function allowAndRecord(accountId: string, now: number): boolean {
  pruneWindow(accountId, now);
  const arr = rateWindows.get(accountId) ?? [];
  if (arr.length >= MAX_REQ_PER_ACCOUNT_PER_MINUTE) return false;
  arr.push(now);
  rateWindows.set(accountId, arr);
  return true;
}

function acquireInFlight(accountId: string): boolean {
  const current = inFlight.get(accountId) ?? 0;
  if (current >= MAX_IN_FLIGHT_PER_ACCOUNT) return false;
  inFlight.set(accountId, current + 1);
  return true;
}

function releaseInFlight(accountId: string): void {
  const current = inFlight.get(accountId) ?? 0;
  if (current <= 1) inFlight.delete(accountId);
  else inFlight.set(accountId, current - 1);
}

/** Used by tests to clear process-local state between cases. */
export function _resetRateLimiterForTests(): void {
  rateWindows.clear();
  inFlight.clear();
}

// -----------------------------------------------------------------------------
// Public entry point.
// -----------------------------------------------------------------------------

export async function translateIncomingMessage(
  input: TranslateServiceInput,
): Promise<TranslateServiceResult> {
  // Each return path emits a single metrics event. The `charsSubmitted`
  // count is 0 for rejections that never reach the provider; it reflects
  // the length of the submitted text only on provider attempts.
  const emit = (outcome: TranslationOutcome, charsSubmitted = 0): void => {
    try {
      recordTranslationEvent({ outcome, charsSubmitted });
    } catch {
      /* metrics never break the request path */
    }
  };

  // 1. Feature flag.
  const blockers = describeTranslationBlockers();
  if (blockers.includes("feature_disabled")) {
    emit("feature_disabled");
    return { ok: false, reason: "feature_disabled" };
  }

  // 2. Caller identity · session-derived only, never client-supplied.
  const session = await resolveSessionWithDevOverride();
  const accountId = session?.account?.id ?? null;
  if (!accountId) {
    emit("not_signed_in");
    return { ok: false, reason: "not_signed_in" };
  }

  // 3. Founder gate · reuse the existing admin-email allowlist pattern.
  if (!isAdminSession(session)) {
    emit("not_founder");
    return { ok: false, reason: "not_founder" };
  }

  // 4. Input validation.
  const text = (input.text ?? "").normalize("NFC");
  if (text.trim().length === 0) {
    emit("input_empty");
    return { ok: false, reason: "input_empty" };
  }
  if (text.length > MAX_INPUT_CHARS) {
    emit("input_too_long");
    return { ok: false, reason: "input_too_long" };
  }
  if (!isPilotLanguage(input.to)) {
    emit("unsupported_language");
    return { ok: false, reason: "unsupported_language" };
  }
  if (input.from !== undefined) {
    if (!isPilotLanguage(input.from)) {
      emit("unsupported_language");
      return { ok: false, reason: "unsupported_language" };
    }
    if (input.from === input.to) {
      emit("same_language");
      return { ok: false, reason: "same_language" };
    }
  }

  // 5. Short / ambiguous auto-translate guard. Manual mode bypasses.
  if (
    input.mode === "auto" &&
    text.trim().length < MIN_CONFIDENT_AUTO_TRANSLATE_CHARS
  ) {
    emit("ambiguous_short_text");
    return { ok: false, reason: "ambiguous_short_text" };
  }

  // 6. In-process rate + concurrency.
  const now = input.testing?.now ? input.testing.now() : Date.now();
  if (!allowAndRecord(accountId, now)) {
    emit("rate_limited_local");
    return { ok: false, reason: "rate_limited_local" };
  }
  if (!acquireInFlight(accountId)) {
    emit("too_many_in_flight");
    return { ok: false, reason: "too_many_in_flight" };
  }

  try {
    // Double-check the live path is not blocked by missing credentials
    // before we attempt the network call. (This is also enforced inside
    // the adapter, but failing fast here keeps the latency floor low
    // and the error surface explicit.)
    if (!canAttemptLiveTranslation()) {
      emit("credentials_missing");
      return { ok: false, reason: "credentials_missing" };
    }
    const r = await translateText({
      text,
      from: input.from,
      to: input.to,
      fetchImpl: input.testing?.fetchImpl,
      timeoutMs: input.testing?.timeoutMs,
    });
    if (!r.ok) {
      // The service NEVER passes `abortSignal` to the adapter · a
      // "cancelled" reason from the adapter would therefore be a
      // defence-in-depth surprise (not possible under current wiring).
      // Guard the metric emit so the TranslationOutcome type stays
      // tight and we do not silently invent a new metric kind here.
      if (r.reason === "cancelled") {
        emit("unexpected_error", 0);
        return { ok: false, reason: "unexpected_error" };
      }
      emit(r.reason, text.length);
      return { ok: false, reason: r.reason };
    }
    emit("ok", text.length);
    return {
      ok: true,
      translation: r.translation,
      detectedSourceLanguage: r.detectedSourceLanguage,
      detectedConfidence: r.detectedConfidence,
    };
  } finally {
    releaseInFlight(accountId);
  }
}
