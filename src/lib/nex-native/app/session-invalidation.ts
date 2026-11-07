// src/lib/nex-native/app/session-invalidation.ts
//
// NEX Phase 1.0 Security · pure helpers for the mass-session-
// invalidation comparison in `./session.ts`. Owner directive
// 2026-11-07 · Item 2.
// -----------------------------------------------------------------------------
// Lives in its own module so regression tests can import these
// primitives WITHOUT dragging `./session.ts` through its module-level
// env var check (NEX_SUPABASE_URL + NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY).
// No side effects · no "server-only" guard · safe for Node + browser
// bundles both.

/** Extract the `iat` (issued-at, seconds since epoch) claim from a JWT.
 *  Returns null when the token is malformed · never throws. The session
 *  resolver uses this alongside `nex_account.sessions_invalidated_at`
 *  to decide whether a session predates a mass-invalidation event
 *  (password change · future flows). */
export function extractJwtIssuedAt(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    // JWT payload is base64url-encoded. Convert to base64 then decode.
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const obj = JSON.parse(json) as { iat?: unknown };
    const iat = obj?.iat;
    return typeof iat === "number" && Number.isFinite(iat) ? iat : null;
  } catch {
    return null;
  }
}

/** Phase 1.0 Security · pure comparison helper. Returns:
 *    · true   · session MUST be rejected (JWT was issued before the
 *               account's mass-invalidation timestamp).
 *    · false  · no mass invalidation applies · caller proceeds to
 *               load the session normally.
 *
 *  Fail-open semantics preserved: if the iat cannot be extracted or
 *  the invalidation timestamp is unparseable, returns false (i.e.,
 *  "no evidence of rejection") so Bridge 2b's token-less flows keep
 *  working. */
export function isJwtInvalidatedByMassInvalidation(
  accessToken: string,
  invalidatedAtIso: string | null,
): boolean {
  if (!invalidatedAtIso) return false;
  const iatSec = extractJwtIssuedAt(accessToken);
  if (iatSec === null) return false;
  const invalidatedAtMs = Date.parse(invalidatedAtIso);
  if (!Number.isFinite(invalidatedAtMs)) return false;
  return iatSec * 1000 < invalidatedAtMs;
}
