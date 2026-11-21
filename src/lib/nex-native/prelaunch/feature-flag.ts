// src/lib/nex-native/prelaunch/feature-flag.ts
//
// NEX prelaunch mode · env-flag reader (default OFF).
// Authored 2026-11-18 for the Nexcorner prelaunch landing.
//
// Reading convention matches the existing feature-flag pattern used by
// `emergency/feature-flag.ts` and `family-safety/.../feature-flag.ts`:
// lazy `process.env` reads inside functions so tests can mutate env, and
// explicit boolean coercion (`.toLowerCase() === "true"`).
//
// Flags:
//   NEX_PRELAUNCH_MODE             · "true" | otherwise → off (DEFAULT OFF).
//   NEX_PRELAUNCH_FOUNDER_UIDS     · comma-separated Supabase user UIDs
//                                     that bypass the gate when it is on.
//                                     Default: empty list.
//   NEX_PRELAUNCH_FOUNDER_EMAIL    · single email that, when submitted in
//                                     the Nexcorner notify form, triggers
//                                     a bypass cookie + redirect into the
//                                     app. Default fallback below.
//                                     Owner-sealed 2026-11-21 (Option B) ·
//                                     DELIBERATELY WEAKER than the UID
//                                     check · anyone who learns the email
//                                     walks in. Non-production use.
//   NEX_PRELAUNCH_FOUNDER_BYPASS_TOKEN · opaque secret stamped into the
//                                     bypass cookie by the server action
//                                     and verified by middleware. Prevents
//                                     a stranger from setting the cookie
//                                     directly in their browser.
//
// This module is pure: no side effects, no I/O, no imports from the
// Supabase admin client. It is safe to import from Edge middleware.

export function isPrelaunchModeOn(): boolean {
  const raw = process.env.NEX_PRELAUNCH_MODE;
  if (typeof raw !== "string") return false;
  return raw.trim().toLowerCase() === "true";
}

export function getFounderBypassUids(): readonly string[] {
  const raw = process.env.NEX_PRELAUNCH_FOUNDER_UIDS;
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isFounderUid(candidate: string | null | undefined): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const uids = getFounderBypassUids();
  return uids.includes(candidate);
}

// ── Option B founder-email bypass · owner-sealed 2026-11-21 ──────────
// Deliberately weaker than the UID gate: anyone who types the founder
// email into the public notify form gets a bypass cookie and is sent
// into the app. The cookie value is an opaque token so a random visitor
// can't just set the cookie directly.

const DEFAULT_FOUNDER_EMAIL = "phillipofarrell@gmail.com";

// Fallback token used only when NEX_PRELAUNCH_FOUNDER_BYPASS_TOKEN is
// unset. Not a secret — rotate by setting the env var before any
// public exposure.
const DEFAULT_FOUNDER_BYPASS_TOKEN =
  "nex-founder-bypass-sealed-2026-11-21";

export const FOUNDER_BYPASS_COOKIE_NAME = "nex_prelaunch_founder_bypass";

export function getFounderBypassEmail(): string {
  const raw = process.env.NEX_PRELAUNCH_FOUNDER_EMAIL;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw.trim().toLowerCase();
  }
  return DEFAULT_FOUNDER_EMAIL;
}

export function isFounderBypassEmail(
  candidate: string | null | undefined,
): boolean {
  if (typeof candidate !== "string") return false;
  const normalised = candidate.trim().toLowerCase();
  if (normalised.length === 0) return false;
  return normalised === getFounderBypassEmail();
}

export function getFounderBypassCookieToken(): string {
  const raw = process.env.NEX_PRELAUNCH_FOUNDER_BYPASS_TOKEN;
  if (typeof raw === "string" && raw.trim().length >= 16) {
    return raw.trim();
  }
  return DEFAULT_FOUNDER_BYPASS_TOKEN;
}

export function isValidFounderBypassCookie(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return value === getFounderBypassCookieToken();
}
