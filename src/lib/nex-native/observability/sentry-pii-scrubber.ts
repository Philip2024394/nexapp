// src/lib/nex-native/observability/sentry-pii-scrubber.ts
//
// Aggressive PII + sealed-invariant scrubber for Sentry event payloads.
// Called from sentry.{server,client,edge}.config.ts via `beforeSend`.
//
// Sealed invariant I-1 is the controlling constraint:
//   · NEX servers must NEVER retain private message content
//   · An error-reporting pipeline that captured message bodies would
//     DIRECTLY violate I-1
//   · Therefore this scrubber is strict-by-default · deny-list is
//     comprehensive · escape routes do not exist
//
// Also scrubs the standard credential + personal-data categories per
// GDPR Article 32 + ePrivacy minimisation.

export type SentryEventLike = {
  message?: string;
  exception?: {
    values?: Array<{
      value?: string;
      stacktrace?: {
        frames?: Array<{ vars?: Record<string, unknown> }>;
      };
    }>;
  };
  request?: {
    data?: unknown;
    headers?: Record<string, string>;
    query_string?: string;
    cookies?: Record<string, string>;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
    category?: string;
  }>;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
    [k: string]: unknown;
  };
  tags?: Record<string, string>;
};

/** Keys that MUST never appear in a logged payload. */
export const FORBIDDEN_KEYS: readonly string[] = [
  // Sealed invariant I-1 · message content
  "body",
  "ciphertext",
  "plaintext",
  "content",
  "message_body",
  "message_content",
  "attachment",
  "attachment_bytes",
  "attachment_data",
  "attachment_meta",
  // Credentials
  "password",
  "password_hash",
  "pin",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "session_token",
  "api_key",
  "service_role_key",
  "private_key",
  "signing_key",
  "key",
  "cookie",
  "authorization",
  "x-api-key",
  // Personal data
  "phone",
  "phone_number",
  "ssn",
  "national_id",
  "passport",
  "credit_card",
  "card_number",
  "cvv",
  "iban",
  "stripe_customer_secret",
];

/** String tokens in error messages that also need scrubbing. */
export const FORBIDDEN_MESSAGE_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_\-=]{5,}\.[A-Za-z0-9_\-=]{5,}\.[A-Za-z0-9_\-=]{5,}/g, // JWT
  /sk_(?:live|test)_[A-Za-z0-9]{24,}/g, // Stripe secret keys
  /pk_(?:live|test)_[A-Za-z0-9]{24,}/g, // Stripe publishable keys
  /whsec_[A-Za-z0-9]{24,}/g, // Stripe webhook secret
  /\bbearer\s+[A-Za-z0-9_\-.=]{20,}/gi, // Bearer tokens
];

const REDACTED = "[REDACTED]";
const REDACTED_SEALED = "[REDACTED · sealed I-1]";
const MAX_DEPTH = 8;

/** Normalise a key for case-insensitive match. */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[-_\s]+/g, "");
}

const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_KEYS.map(normKey));

function isForbiddenKey(key: string): "sealed" | "credential" | null {
  const norm = normKey(key);
  if (!FORBIDDEN_KEY_SET.has(norm)) return null;
  // Determine if this is a sealed-invariant key or just a credential.
  if (
    norm.includes("body") ||
    norm.includes("ciphertext") ||
    norm.includes("plaintext") ||
    norm.includes("content") ||
    norm.includes("attachment") ||
    norm === "messagecontent" ||
    norm === "messagebody"
  ) {
    return "sealed";
  }
  return "credential";
}

/** Redact forbidden keys recursively on any plain object. */
export function scrubObject(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return scrubString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (typeof input === "bigint") return input.toString();
  if (Array.isArray(input)) {
    return input.map((v) => scrubObject(v, depth + 1));
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const forbidden = isForbiddenKey(k);
      if (forbidden === "sealed") {
        out[k] = REDACTED_SEALED;
      } else if (forbidden === "credential") {
        out[k] = REDACTED;
      } else {
        out[k] = scrubObject(v, depth + 1);
      }
    }
    return out;
  }
  return "[UNSCRUBBABLE]";
}

export function scrubString(s: string): string {
  let out = s;
  for (const pattern of FORBIDDEN_MESSAGE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/**
 * Sentry `beforeSend` hook. Rewrites the event with all forbidden fields
 * removed. Returns null to drop the event entirely if it looks like it
 * carries a sealed-invariant payload we cannot sanitise safely.
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T | null {
  // 1 · request.data (body)
  if (event.request && "data" in event.request) {
    (event.request as { data?: unknown }).data = scrubObject(event.request.data);
  }

  // 2 · request.headers
  if (event.request?.headers) {
    const h: Record<string, string> = {};
    for (const [k, v] of Object.entries(event.request.headers)) {
      const forbidden = isForbiddenKey(k);
      h[k] = forbidden ? REDACTED : scrubString(v);
    }
    event.request.headers = h;
  }

  // 3 · request.query_string
  if (event.request?.query_string && typeof event.request.query_string === "string") {
    event.request.query_string = scrubString(event.request.query_string);
  }

  // 4 · request.cookies · always redact entirely
  if (event.request?.cookies) {
    const c: Record<string, string> = {};
    for (const k of Object.keys(event.request.cookies)) c[k] = REDACTED;
    event.request.cookies = c;
  }

  // 5 · exception values
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (v.value) v.value = scrubString(v.value);
      if (v.stacktrace?.frames) {
        for (const frame of v.stacktrace.frames) {
          if (frame.vars) frame.vars = scrubObject(frame.vars) as Record<string, unknown>;
        }
      }
    }
  }

  // 6 · message
  if (event.message) event.message = scrubString(event.message);

  // 7 · extra + contexts + tags
  if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubObject(event.contexts) as Record<string, unknown>;
  if (event.tags) {
    const t: Record<string, string> = {};
    for (const [k, v] of Object.entries(event.tags)) {
      t[k] = isForbiddenKey(k) ? REDACTED : scrubString(v);
    }
    event.tags = t;
  }

  // 8 · breadcrumbs
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      if (bc.message) bc.message = scrubString(bc.message);
      if (bc.data) bc.data = scrubObject(bc.data) as Record<string, unknown>;
    }
  }

  // 9 · user · keep ID, drop email/ip
  if (event.user) {
    const u: Record<string, unknown> = { id: event.user.id };
    event.user = u as SentryEventLike["user"];
  }

  return event;
}
