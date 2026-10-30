// src/lib/nex-native/country/is-irish-account.ts
//
// Owner-authorised 2026-10-30 · pure helper that detects an Irish
// NEX account from its sealed phone_country_code (+353 dial code).
// Ties into the Four-Country doctrine
// (project_nex_country_scope_from_phone_country_code_2026_08_22).
//
// Used by surfaces that want to trigger Ireland-specific flare
// (currently the shamrock-burst on Save/Follow in the music feed,
// Profile FollowButton, and Live FollowButton). Hard-coded to +353
// per the sealed owner decision 2026-10-30 ("Ireland-only hard-coded
// for Phase 1"). Future country-specific animations are a separate
// doctrine amendment.
//
// Null-tolerant. Returns false for null/undefined/empty/non-string
// input. Returns true only when the input is exactly "+353" after a
// trim. No other dial codes qualify.

export function isIrishAccount(
  phoneCountryCode: string | null | undefined,
): boolean {
  if (!phoneCountryCode) return false;
  if (typeof phoneCountryCode !== "string") return false;
  return phoneCountryCode.trim() === "+353";
}
