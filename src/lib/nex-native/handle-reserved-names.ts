// src/lib/nex-native/handle-reserved-names.ts
//
// NEX chosen-handle reserved names · two tiers:
//
//   · DB_SYSTEM_RESERVED mirrors the CHECK constraint in migration 204.
//     Changing this list requires a new migration.
//   · APP_RESERVED is runtime-extensible policy terms (impersonation,
//     platform roles, UI route slugs). Can be edited without a migration.
//
// Comparisons are case-insensitive against the NFC-normalised handle
// lowercased via String.prototype.toLowerCase().
//
// Reserved-name policy is a subset of the full validation pipeline in
// handle-normalise.ts. The validator calls isReservedHandle() AFTER
// character-category rejection and grapheme-structural checks have
// already run, so this list never has to deal with emoji, controls, or
// malformed whitespace.

export const DB_SYSTEM_RESERVED: ReadonlySet<string> = new Set([
  "nex",
  "admin",
  "root",
  "api",
  "auth",
  "official",
  "support",
  "help",
  "www",
  "app",
  "system",
  "null",
  "undefined",
  "nex admin",
  "nex support",
  "nex help",
  "nex official",
  "nex team",
  "nex api",
  "nex staff",
]);

export const APP_RESERVED: ReadonlySet<string> = new Set([
  "customer service",
  "customer support",
  "moderator",
  "moderators",
  "operator",
  "operators",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "about",
  "terms",
  "privacy",
  "contact",
  "home",
  "developer",
  "developers",
  "tech",
  "owner",
]);

/** Returns true when the lowercased normalised handle is reserved. */
export function isReservedHandle(lowercasedNormalised: string): boolean {
  return (
    DB_SYSTEM_RESERVED.has(lowercasedNormalised) ||
    APP_RESERVED.has(lowercasedNormalised)
  );
}
