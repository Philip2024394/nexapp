// src/lib/nex-native/translation/azure-translator-adapter.ts
//
// Server-only adapter for Azure AI Translator · Text Translation API.
// Owner-authorised 2026-11-17 for a founder-only pilot. NOT a public
// rollout.
//
// HARD RULES (directive · verified against doctrine):
//   · This file is server-only. No "use client" anywhere upstream.
//   · Credentials are read from process.env. They MUST NOT appear in
//     NEXT_PUBLIC_* vars, browser bundles, URLs, or any response body.
//   · We never log message bodies, translations, credentials, tokens,
//     or provider request/response payloads.
//   · If credentials are absent, this adapter REFUSES with a typed
//     error. There is NO silent paid fallback and NO tier upgrade.
//   · We do not assume we are on F0; we also do not claim unlimited.
//     The caller is responsible for in-process rate limits and for
//     reporting its inability to enforce aggregate limits across
//     instances.
//   · Bounded timeout (default 8s). Controlled retry (at most one
//     retry on a transient 5xx/429, with jittered backoff).
//
// Shape: `translateText({ text, from, to })`. `from` is OPTIONAL — if
// omitted, Azure detects the source. The caller decides whether to
// expose detection confidence to the UI.

import {
  MAX_INPUT_CHARS,
  isPilotLanguage,
  type PilotLanguageCode,
} from "./supported-languages";

export type AzureTranslatorErrorReason =
  | "credentials_missing"
  | "invalid_endpoint"
  | "unsupported_language"
  | "input_empty"
  | "input_too_long"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_quota_exhausted"
  | "provider_auth_failed"
  | "provider_malformed_response"
  | "cancelled"
  | "unexpected_error";

/** Trusted hostname patterns for Azure AI Translator Text API endpoints.
 *  The adapter MUST refuse any endpoint not matching one of these ·
 *  defence against an operator misconfiguration pointing at a stolen /
 *  phishing endpoint (keys would still be sent with the subscription
 *  header). Keep in sync with Microsoft's documented patterns:
 *    - `api.cognitive.microsofttranslator.com`  (global)
 *    - `api-<region>.cognitive.microsofttranslator.com`  (regional)
 *    - `*.cognitiveservices.azure.com`  (private/custom resource) */
export function isTrustedAzureTranslatorHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "api.cognitive.microsofttranslator.com") return true;
  if (h.endsWith(".cognitive.microsofttranslator.com")) return true;
  if (h.endsWith(".cognitiveservices.azure.com")) return true;
  return false;
}

/** Validates the endpoint URL · returns null if acceptable, otherwise a
 *  short reason string suitable for a one-time diagnostic. The adapter
 *  never prints the full endpoint value (it may include subdomains an
 *  operator considers sensitive); only the host is checked and only
 *  the reason is logged. */
export function validateAzureTranslatorEndpoint(
  endpoint: string,
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { ok: false, reason: "endpoint_not_a_url" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "endpoint_not_https" };
  }
  if (!isTrustedAzureTranslatorHost(parsed.hostname)) {
    return { ok: false, reason: "endpoint_host_not_trusted" };
  }
  return { ok: true };
}

/** Maximum delay (ms) we will honour from a Retry-After header before
 *  bailing out to a truthful retry-later state. Kept small so a 429
 *  never stalls the composer; longer waits must be surfaced to the
 *  caller rather than slept through silently. */
export const RETRY_AFTER_CAP_MS = 2000;

export interface AzureTranslatorRequest {
  readonly text: string;
  readonly from?: PilotLanguageCode;
  readonly to: PilotLanguageCode;
  /** Optional per-request override for the fetch implementation.
   *  Used by tests ONLY · production callers omit this. */
  readonly fetchImpl?: typeof fetch;
  /** Optional override for the timeout in ms. Default 8_000. Tests
   *  may lower this to simulate timeouts deterministically. */
  readonly timeoutMs?: number;
  /** Optional override for retry behaviour. Default: retry once on
   *  transient 5xx/429 after 150 ms. */
  readonly retryOnce?: boolean;
  /** Optional external AbortSignal. The caller can trigger this to
   *  cancel an in-flight attempt and any scheduled retry delay · used
   *  by the consent-revoke and logout paths so pending work is
   *  genuinely stopped rather than left to complete in the background.
   *  Cancelling cannot retract text already sent to the provider · the
   *  caller must treat `cancelled` as "may or may not have reached
   *  the provider", not "guaranteed not sent". */
  readonly abortSignal?: AbortSignal;
  /** Deterministic clock · injected by tests only. Returns ms since
   *  epoch. Production callers omit and we use `Date.now`. */
  readonly nowMs?: () => number;
  /** Deterministic sleep · injected by tests only. Called for the
   *  retry backoff and for the Retry-After honoured delay. Production
   *  callers omit and we use `setTimeout`. */
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Optional cap override (ms) · tests only. Default:
   *  `RETRY_AFTER_CAP_MS`. If the provider asks for a wait longer
   *  than this, we DO NOT retry and surface `retryAfterMs` to the
   *  caller instead. */
  readonly retryAfterCapMs?: number;
}

export type AzureTranslatorResult =
  | {
      readonly ok: true;
      readonly translation: string;
      readonly detectedSourceLanguage: string | null;
      readonly detectedConfidence: number | null;
      /** Total number of fetches actually issued (initial attempt +
       *  any retries). Separates "logical request" from "provider
       *  attempts" so metrics can count them independently. */
      readonly providerAttempts: number;
    }
  | {
      readonly ok: false;
      readonly reason: AzureTranslatorErrorReason;
      readonly providerAttempts: number;
      /** Present only when `reason === "provider_rate_limited"`. The
       *  caller MAY use this to surface a truthful "try again in N
       *  seconds" hint to the user. When the server asked for a wait
       *  longer than our `retryAfterCapMs`, we refuse to auto-retry
       *  and surface this value instead. Capped to a sane upper
       *  bound (1 hour) regardless of what the provider sent. */
      readonly retryAfterMs?: number;
    };

/** One-time guard for the silently-ignored-config diagnostic. */
let ignoredAzureEnvWarned = false;

/** Emits a single `console.warn` the first time the adapter runs with
 *  `NEX_AZURE_TRANSLATOR_*` or `NEXT_PUBLIC_AZURE_TRANSLATOR_*` set but
 *  canonical `AZURE_TRANSLATOR_*` missing. No secret values are printed.
 *  Visibility only; the adapter still fails closed via `readConfig`. */
function warnIfIgnoredAzureEnv(): void {
  if (ignoredAzureEnvWarned) return;
  const canonical =
    (process.env.AZURE_TRANSLATOR_KEY ?? "").length > 0 &&
    (process.env.AZURE_TRANSLATOR_REGION ?? "").length > 0 &&
    (process.env.AZURE_TRANSLATOR_ENDPOINT ?? "").length > 0;
  if (canonical) return;
  const ignored: string[] = [];
  for (const k of [
    "NEX_AZURE_TRANSLATOR_KEY",
    "NEX_AZURE_TRANSLATOR_REGION",
    "NEX_AZURE_TRANSLATOR_ENDPOINT",
    "NEXT_PUBLIC_AZURE_TRANSLATOR_KEY",
    "NEXT_PUBLIC_AZURE_TRANSLATOR_REGION",
    "NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT",
  ]) {
    if ((process.env[k] ?? "").length > 0) ignored.push(k);
  }
  if (ignored.length === 0) return;
  ignoredAzureEnvWarned = true;
  try {
    // Names only · never values. The adapter refuses translation when
    // canonical env is missing, so this warn is purely to help an
    // operator notice the misnamed configuration.
    // eslint-disable-next-line no-console
    console.warn(
      "[azure-translator-adapter] Non-canonical env ignored: " +
        ignored.join(",") +
        ". Canonical names are AZURE_TRANSLATOR_KEY/REGION/ENDPOINT (server-only).",
    );
  } catch {
    /* ignore · a misconfigured console is not a translation failure */
  }
}

/** TEST-ONLY · resets the diagnostic one-time latch so tests can
 *  assert the warn fires. Not part of the public API. */
export function _resetIgnoredAzureEnvWarnedForTest(): void {
  ignoredAzureEnvWarned = false;
}

/** Pulls the server-side configuration. Returns null if any required
 *  piece is absent. Callers surface this as `credentials_missing`. */
function readConfig(): {
  key: string;
  region: string;
  endpoint: string;
} | null {
  warnIfIgnoredAzureEnv();
  const key = process.env.AZURE_TRANSLATOR_KEY ?? "";
  const region = process.env.AZURE_TRANSLATOR_REGION ?? "";
  const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT ?? "").replace(/\/+$/, "");
  if (key.length === 0 || region.length === 0 || endpoint.length === 0) {
    return null;
  }
  return { key, region, endpoint };
}

/** The core adapter · ALL requests go through here. Keeps the fetch
 *  shape identical across callers so rate-limiting + metrics live in
 *  one place. */
export async function translateText(
  req: AzureTranslatorRequest,
): Promise<AzureTranslatorResult> {
  // 1. Input validation (cheap, no secrets, no network).
  // Each of these early returns exits BEFORE any URL build / fetch /
  // retry loop, so `providerAttempts` is branch-specific truth = 0.
  // Addendum round 2026-11-17 cont-3 · closes the five TS2322 errors
  // the prior Gap A/B landing left open on the error-arm shape.
  const text = req.text ?? "";
  if (text.length === 0 || text.trim().length === 0) {
    return { ok: false, reason: "input_empty", providerAttempts: 0 };
  }
  if (text.length > MAX_INPUT_CHARS) {
    return { ok: false, reason: "input_too_long", providerAttempts: 0 };
  }
  if (!isPilotLanguage(req.to)) {
    return { ok: false, reason: "unsupported_language", providerAttempts: 0 };
  }
  if (req.from !== undefined && !isPilotLanguage(req.from)) {
    return { ok: false, reason: "unsupported_language", providerAttempts: 0 };
  }

  // 2. Config presence (no credential logging, ever). Still pre-network,
  //    so providerAttempts = 0 here too.
  const cfg = readConfig();
  if (cfg === null) {
    return { ok: false, reason: "credentials_missing", providerAttempts: 0 };
  }

  // 2b. Endpoint validation · must be HTTPS AND match a documented
  //     Azure Translator hostname pattern. Still pre-network, so
  //     providerAttempts = 0. We refuse rather than fetch · the key
  //     header would otherwise go out over whatever host an operator
  //     typo-ed in.
  const endpointCheck = validateAzureTranslatorEndpoint(cfg.endpoint);
  if (!endpointCheck.ok) {
    return { ok: false, reason: "invalid_endpoint", providerAttempts: 0 };
  }

  // 3. Build the request · the official Translator Text API v3 shape.
  //    Documented at learn.microsoft.com/azure/ai-services/translator.
  const url = new URL(`${cfg.endpoint}/translate`);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", req.to);
  if (req.from) url.searchParams.set("from", req.from);
  url.searchParams.set("textType", "plain");
  // profanityAction omitted · default behaviour (`NoAction`).

  const body = JSON.stringify([{ Text: text }]);
  const fetchImpl = req.fetchImpl ?? fetch;
  const timeoutMs = req.timeoutMs ?? 8000;
  const retryOnce = req.retryOnce ?? true;
  const retryAfterCapMs = req.retryAfterCapMs ?? RETRY_AFTER_CAP_MS;
  const nowMs = req.nowMs ?? Date.now;
  const sleep =
    req.sleep ??
    ((ms: number, signal?: AbortSignal) =>
      new Promise<void>((resolve) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const id = setTimeout(resolve, ms);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(id);
            resolve();
          },
          { once: true },
        );
      }));

  // If the caller handed us an already-aborted signal, do not touch
  // the network at all — surface `cancelled` immediately so we do not
  // leak a provider attempt that the UI has already discarded.
  if (req.abortSignal?.aborted) {
    return { ok: false, reason: "cancelled", providerAttempts: 0 };
  }

  let attempts = 0;

  /** Attempt one provider request. Composes a local timeout with the
   *  caller's external abort signal · either firing cancels the fetch.
   *  Returns `{ status, retryAfter }` for 429 so the outer retry layer
   *  can decide whether to wait, and never calls `.json()` on a
   *  non-200 (bytes beyond headers are not useful for error mapping
   *  and parsing them wastes the socket). */
  const call = async (): Promise<AzureTranslatorResult> => {
    attempts += 1;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    // Fan the external abort signal (consent revoke, logout, nav) into
    // the fetch controller · we do NOT mutate the caller's signal and
    // we clean the listener up in `finally`.
    const onExternalAbort = () => ac.abort();
    const external = req.abortSignal;
    external?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const res = await fetchImpl(url.toString(), {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": cfg.key,
          "Ocp-Apim-Subscription-Region": cfg.region,
          "content-type": "application/json",
          // Note: we DELIBERATELY do not set a per-request client-trace
          // id derived from message content · it would leak msg ids.
        },
        body,
        signal: ac.signal,
        // Belt-and-braces · the endpoint validator already rejected
        // untrusted hostnames, but a legitimate host could still issue
        // a cross-origin redirect. Manual redirect prevents the key +
        // region headers from being replayed to an unchecked target.
        redirect: "manual",
      });
      // Treat a redirect response as unavailable · we refused to follow,
      // so there is nothing usable to parse. Not retried · this is a
      // provider-configuration anomaly, not transient.
      if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
        return {
          ok: false,
          reason: "provider_unavailable",
          providerAttempts: attempts,
        };
      }
      // Error-mapping order (first match wins):
      //   401 → auth_failed  (bad key)
      //   403 → auth_failed  (region/key mismatch, blocked, or
      //                        subscription disabled · Azure uses 403
      //                        for several auth-like conditions · we
      //                        intentionally do NOT guess quota from
      //                        a plain 403 status · callers surface a
      //                        single "authentication/authorization
      //                        failed" message to the user)
      //   429 → rate_limited (honour Retry-After)
      //   402 → quota_exhausted (RFC "Payment Required" · Azure uses
      //                        this on paid-tier quota exhaustion)
      //   5xx → unavailable
      //   other non-ok → unavailable
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          reason: "provider_auth_failed",
          providerAttempts: attempts,
        };
      }
      if (res.status === 429) {
        const headerValue = res.headers.get("retry-after");
        const parsed = parseRetryAfter(headerValue, nowMs());
        const ret: AzureTranslatorResult = {
          ok: false,
          reason: "provider_rate_limited",
          providerAttempts: attempts,
          ...(parsed !== null ? { retryAfterMs: parsed } : {}),
        };
        return ret;
      }
      if (res.status === 402) {
        return {
          ok: false,
          reason: "provider_quota_exhausted",
          providerAttempts: attempts,
        };
      }
      if (res.status >= 500) {
        return {
          ok: false,
          reason: "provider_unavailable",
          providerAttempts: attempts,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          reason: "provider_unavailable",
          providerAttempts: attempts,
        };
      }
      // Parse · the API returns an array of translation entries.
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        return {
          ok: false,
          reason: "provider_malformed_response",
          providerAttempts: attempts,
        };
      }
      const parsed = parseAzureResponse(payload);
      if (parsed === null) {
        return {
          ok: false,
          reason: "provider_malformed_response",
          providerAttempts: attempts,
        };
      }
      return { ok: true, ...parsed, providerAttempts: attempts };
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") {
        // Distinguish caller-initiated cancellation from our own
        // timeout: if the EXTERNAL signal is aborted, report
        // "cancelled" so the UI does not misreport as a timeout.
        if (external?.aborted) {
          return {
            ok: false,
            reason: "cancelled",
            providerAttempts: attempts,
          };
        }
        return {
          ok: false,
          reason: "provider_timeout",
          providerAttempts: attempts,
        };
      }
      return {
        ok: false,
        reason: "provider_unavailable",
        providerAttempts: attempts,
      };
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  };

  const first = await call();
  if (first.ok) return first;
  if (!retryOnce) return first;
  // Auth, cancel, quota, unsupported-language, input-level, parse-error
  // are NOT transient · a second identical request will not help.
  const transient: ReadonlySet<AzureTranslatorErrorReason> = new Set([
    "provider_unavailable",
    "provider_timeout",
    "provider_rate_limited",
  ]);
  if (!transient.has(first.reason)) return first;
  if (req.abortSignal?.aborted) {
    return { ok: false, reason: "cancelled", providerAttempts: attempts };
  }
  // Rate-limit: honour the server's Retry-After when present and
  // within our foreground budget. If the server asked for longer, do
  // NOT retry · return the original rate-limited result (with
  // `retryAfterMs`) so the caller can surface a truthful "try again
  // in N seconds" state rather than freeze the composer.
  let backoffMs: number;
  if (first.reason === "provider_rate_limited") {
    const asked =
      "retryAfterMs" in first && typeof first.retryAfterMs === "number"
        ? first.retryAfterMs
        : null;
    if (asked !== null && asked > retryAfterCapMs) {
      return first;
    }
    if (asked !== null) {
      // Add a small jitter (0..40ms) to avoid thundering herd across
      // many simultaneously-rate-limited requests on the same device.
      backoffMs = asked + Math.floor(Math.random() * 40);
    } else {
      backoffMs = 120 + Math.floor(Math.random() * 80);
    }
  } else {
    // 5xx / timeout retry · small jittered backoff. Bounded so the
    // composer stays snappy.
    backoffMs = 120 + Math.floor(Math.random() * 80);
  }
  await sleep(backoffMs, req.abortSignal);
  if (req.abortSignal?.aborted) {
    return { ok: false, reason: "cancelled", providerAttempts: attempts };
  }
  return call();
}

/** Parses an HTTP Retry-After header. Supports both forms defined in
 *  RFC 7231 §7.1.3:
 *    · delta-seconds · `"120"` · non-negative integer, no decimal
 *    · HTTP-date     · `"Wed, 21 Oct 2026 07:28:00 GMT"`
 *  Returns milliseconds to wait, OR null for invalid / missing /
 *  past-dated values. Return value is clamped to [0, 3_600_000] ms so
 *  a hostile value cannot schedule an absurd sleep. */
export function parseRetryAfter(
  raw: string | null | undefined,
  nowMs: number,
): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // delta-seconds: all digits.
  if (/^\d+$/.test(trimmed)) {
    const secs = Number(trimmed);
    if (!Number.isFinite(secs) || secs < 0) return null;
    return clampRetryMs(secs * 1000);
  }
  // HTTP-date: parse as date.
  const whenMs = Date.parse(trimmed);
  if (Number.isNaN(whenMs)) return null;
  const delta = whenMs - nowMs;
  if (delta <= 0) return null; // past · nothing to wait for
  return clampRetryMs(delta);
}

function clampRetryMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  if (ms < 0) return 0;
  const MAX = 3_600_000; // 1 hour
  if (ms > MAX) return MAX;
  return Math.floor(ms);
}

/** Parses the Translator Text v3 response. Returns null for any
 *  malformed payload shape — callers surface `provider_malformed_response`. */
function parseAzureResponse(payload: unknown): {
  translation: string;
  detectedSourceLanguage: string | null;
  detectedConfidence: number | null;
} | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0] as Record<string, unknown>;
  if (!first || typeof first !== "object") return null;
  const translations = first["translations"];
  if (!Array.isArray(translations) || translations.length === 0) return null;
  const t0 = translations[0] as Record<string, unknown>;
  const txt = t0["text"];
  if (typeof txt !== "string") return null;
  const detectedBlock = first["detectedLanguage"] as
    | Record<string, unknown>
    | undefined;
  let detectedLang: string | null = null;
  let detectedConf: number | null = null;
  if (detectedBlock && typeof detectedBlock === "object") {
    const lang = detectedBlock["language"];
    const score = detectedBlock["score"];
    if (typeof lang === "string") detectedLang = lang;
    if (typeof score === "number") detectedConf = score;
  }
  return {
    translation: txt,
    detectedSourceLanguage: detectedLang,
    detectedConfidence: detectedConf,
  };
}
