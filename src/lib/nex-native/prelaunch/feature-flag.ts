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
