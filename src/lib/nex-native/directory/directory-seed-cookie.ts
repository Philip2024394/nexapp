// src/lib/nex-native/directory/directory-seed-cookie.ts
//
// NEX Directory · server-component read side of the seed cookie.
// Owner-authorised 2026-10-18 · P1 of the discovery system.
// -----------------------------------------------------------------------------
// Pairs with:
//   · directory-seed.ts : edge-safe constants + pure pickOrMint
//   · src/middleware.ts : writes the cookie on every
//                         /nex-native/directory* request (sliding
//                         15-min window)
//
// Why we split read/write: in Next 16, Server Components can
// READ cookies via `next/headers` but CANNOT write them (writes
// silently no-op). So the cookie write lives in middleware (which
// CAN write via NextResponse.cookies.set) and the Server Component
// just reads whatever's there · with a safe fallback if middleware
// didn't get a chance to run (e.g. a static-cached initial render).

import "server-only";
import { cookies } from "next/headers";
import {
  DIRECTORY_SEED_COOKIE,
  pickOrMintDirectorySeed,
} from "./directory-seed";

/** Resolve the active seed for a directory render. Order of priority:
 *
 *   1. URL `?s=` seed (share-link reproducibility · always wins).
 *   2. Cookie `nex_directory_seed` (written by middleware).
 *   3. Fresh mint (middleware will catch up on the next request).
 *
 *  Returning a freshly-minted seed in case 3 is a honest fallback ·
 *  the user still gets a stable ordering within the render even if
 *  the cookie wasn't written yet. Middleware takes over on the
 *  very next request. */
export async function resolveDirectorySeed(
  urlSeed: string | null,
): Promise<string> {
  const store = await cookies();
  const cookieSeed = store.get(DIRECTORY_SEED_COOKIE)?.value ?? null;
  if (urlSeed !== null && urlSeed.length > 0) {
    return pickOrMintDirectorySeed(urlSeed);
  }
  if (cookieSeed !== null && cookieSeed.length > 0) {
    return pickOrMintDirectorySeed(cookieSeed);
  }
  return pickOrMintDirectorySeed(null);
}
