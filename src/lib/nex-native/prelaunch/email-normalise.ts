// src/lib/nex-native/prelaunch/email-normalise.ts
//
// NEX prelaunch · email normalisation + validation (pure).
// Authored 2026-11-18.
//
// Deliberately narrow — this is the launch-notification signup, not the
// business/merchant email validator. The merchant validator at
// `src/lib/nex-native/harvest/email-validation.ts` does DNS MX lookups +
// source attribution; here we only need a strict-but-cheap format check
// suitable for an Edge-callable path and durable upsert.
//
// Behaviour:
//   · trim surrounding whitespace
//   · lowercase (case-insensitive local-part is the pragmatic norm for
//     marketing lists; RFC 5321 allows case-sensitive local but no major
//     provider honours it)
//   · reject strings longer than 254 chars (RFC 5321 §4.5.3.1.3)
//   · reject strings whose local-part exceeds 64 chars
//   · regex sanity check — single @, no whitespace, dot in domain
//
// NO network call. NO DNS. NO side effects.

export type EmailNormaliseResult =
  | { ok: true; normalised: string }
  | { ok: false; reason: EmailNormaliseReason };

export type EmailNormaliseReason =
  | "empty"
  | "too_long"
  | "local_too_long"
  | "invalid_format";

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_TOTAL = 254;
const MAX_LOCAL = 64;

export function normaliseEmailForLaunchSignup(
  raw: unknown,
): EmailNormaliseResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty" };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > MAX_TOTAL) {
    return { ok: false, reason: "too_long" };
  }
  const lower = trimmed.toLowerCase();
  if (!EMAIL_FORMAT.test(lower)) {
    return { ok: false, reason: "invalid_format" };
  }
  const atIdx = lower.indexOf("@");
  const local = lower.slice(0, atIdx);
  if (local.length > MAX_LOCAL) {
    return { ok: false, reason: "local_too_long" };
  }
  return { ok: true, normalised: lower };
}
