// src/lib/nex-native/directory/directory-seed.ts
//
// NEX Directory · edge-safe seed helpers · P1 of the recommended
// discovery system · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Pure utility module · zero server-only imports · zero DB access.
// Safe to use from Edge middleware (where cookies MUST be written
// since Server Components can't write cookies in Next 16+) AND
// from Server Components (reading via `next/headers`).
//
// Separation of concerns:
//   · This file : constants + the pickOrMint pure function.
//   · directory-seed-cookie.ts : the server-side read helper that
//     uses `next/headers`. That file imports `server-only` and is
//     NOT edge-safe.
//   · middleware.ts : writes the cookie on every /nex-native/directory
//     request (sliding 15-min window).

/** Cookie name · sealed · do not drift. */
export const DIRECTORY_SEED_COOKIE = "nex_directory_seed";

/** 15-minute TTL · sealed. Every directory render extends the
 *  cookie via middleware · active browsing keeps the seed alive ·
 *  the user has to leave for 15+ minutes to see a new seed on
 *  return. */
export const DIRECTORY_SEED_MAX_AGE_SECONDS = 15 * 60;

/** Seed length guardrails · a seed from URL or cookie must be in
 *  this range to be trusted. Shorter values are treated as absent
 *  (mint a fresh seed instead). */
const MIN_SEED_LENGTH = 4;
const MAX_SEED_LENGTH = 32;
const MINTED_SEED_LENGTH = 10;

/** Validate + mint a directory sort seed. Pure · deterministic for
 *  a valid input · stochastic for an invalid/missing input. Edge-
 *  safe (uses `globalThis.crypto` which exists in both Node and
 *  Edge runtimes). */
export function pickOrMintDirectorySeed(
  input: string | null | undefined,
): string {
  if (
    typeof input === "string" &&
    input.length >= MIN_SEED_LENGTH &&
    input.length <= MAX_SEED_LENGTH
  ) {
    return input;
  }
  const g = (globalThis as { crypto?: { getRandomValues?: (b: Uint32Array) => void } }).crypto;
  const buf = new Uint32Array(1);
  if (g?.getRandomValues) {
    g.getRandomValues(buf);
  } else {
    // Deterministic fallback for environments without crypto. Rare
    // on production (both Node + Edge expose it) but non-fatal so
    // we don't crash a render on a missing primitive.
    buf[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return buf[0]!
    .toString(36)
    .padStart(MINTED_SEED_LENGTH, "0")
    .slice(0, MINTED_SEED_LENGTH);
}
