// src/lib/nex-native/onboarding/account-active-seen.ts
//
// NEX-024 · one-time gate for the /welcome/account-active celebration
// screen. Owner-sealed 2026-11-24 · HMAC signing added 2026-11-26.
//
// HONEST SCOPE:
//   · This is a device-local cookie, not an account-level flag. Clearing
//     site data or signing in on a different device re-shows the page.
//     That is deliberate for now · account-level persistence requires a
//     `nex_account.onboarding_seen_at` column which is NOT yet applied.
//     When that column lands, this helper can be replaced in place.
//   · The cookie is HttpOnly + SameSite=Lax + **HMAC-signed with a
//     server-only key**. HttpOnly keeps document.cookie from reading it;
//     SameSite=Lax prevents cross-site attach; the HMAC envelope stops
//     a JS-set cookie of the same name from being trusted by the server
//     (the bare value "1" that JS can write will not carry a matching
//     signature → verification fails → server treats it as unseen).
//   · "Seen" means the user was shown the celebration shell ONCE after
//     landing on /welcome/account-active while authenticated. On every
//     subsequent visit to that URL the server redirects to contacts.
//
// WRITE LAYER (L-008 · 2026-11-26):
//   Next.js 16 throws `ReadonlyRequestCookiesError` (E1180 · "Cookies
//   can only be modified in a Server Action or Route Handler") when
//   `cookies().set()` runs inside a Server Component render. The live
//   write path is therefore the edge middleware
//   (`src/middleware.ts :: ensureAccountActiveSeenCookie`), mirroring
//   the `ensureDirectorySeedCookie` pattern. `markAccountActiveSeen`
//   is retained for Server Action / Route Handler callers only —
//   invoking it from a `page.tsx` Server Component will throw.
//
// COOKIE VALUE FORMAT (L-008 · 2026-11-26):
//   `v1.<base64url(hmac-sha256(key, "1"))>` where `key` is derived from
//   the server-only `NEX_SUPABASE_SERVICE_ROLE_KEY` with HKDF info
//   string `"nex_account_active_seen.v1"`. Signature verifies via
//   constant-time compare. If `NEX_SUPABASE_SERVICE_ROLE_KEY` is not
//   configured the signer refuses to emit a cookie (middleware early-
//   returns and the celebration shows again), which is the correct
//   fail-closed posture — we never accept an unsigned value.

import { cookies } from "next/headers";

export const ACCOUNT_ACTIVE_SEEN_COOKIE = "nex_account_active_seen";

// 30 days is long enough that a user re-signing in on the same device
// within a month does not get the celebration again, but short enough
// that a long-dormant account coming back feels welcomed on return.
// The ceiling is a cookie · it never forecloses the user from seeing
// the welcome again on another device, which is correct.
export const ACCOUNT_ACTIVE_SEEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Cookie envelope version · bumping this invalidates existing cookies,
// which is acceptable for a cosmetic gate (users see the celebration
// one additional time).
const ENVELOPE_VERSION = "v1";
const SIGNING_INFO = "nex_account_active_seen.v1";
const SEEN_PAYLOAD = "1";

function base64UrlEncode(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  // btoa is available in both node and edge runtimes.
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Derive the signing key from the service-role key + per-purpose info
 * string. Returns `null` if the service-role key isn't configured —
 * callers MUST fail-closed in that case (no signed cookie emitted, no
 * unsigned cookie trusted).
 */
async function importSigningKey(): Promise<CryptoKey | null> {
  const serviceRole = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole || serviceRole.length < 16) return null;
  // Compose key material as `serviceRole + "\0" + info` so a future
  // reuse of the service-role key for another purpose produces a
  // different HMAC key.
  const material = new TextEncoder().encode(`${serviceRole}\u0000${SIGNING_INFO}`);
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Produce the signed cookie value `"v1.<b64url(hmac(key, "1"))>"`, or
 * `null` when the signing key isn't configured.
 */
export async function signAccountActiveSeenValue(): Promise<string | null> {
  const key = await importSigningKey();
  if (!key) return null;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SEEN_PAYLOAD),
  );
  return `${ENVELOPE_VERSION}.${base64UrlEncode(sig)}`;
}

/**
 * Verify a cookie value. Returns `true` only if the value has the
 * expected envelope AND the HMAC matches a freshly-computed signature.
 * Fails closed on any error (missing key, bad envelope, bad signature,
 * crypto failure).
 */
async function verifyAccountActiveSeenValue(value: string): Promise<boolean> {
  if (typeof value !== "string") return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  if (value.slice(0, dot) !== ENVELOPE_VERSION) return false;
  const providedSig = value.slice(dot + 1);
  if (providedSig.length === 0) return false;
  const expected = await signAccountActiveSeenValue();
  if (expected === null) return false;
  const expectedSig = expected.slice(expected.indexOf(".") + 1);
  return constantTimeEqual(providedSig, expectedSig);
}

export async function hasSeenAccountActive(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(ACCOUNT_ACTIVE_SEEN_COOKIE)?.value ?? null;
  if (value === null) return false;
  return verifyAccountActiveSeenValue(value);
}

/**
 * Set the one-time-gate cookie. Server Action / Route Handler only ·
 * Next.js 16 Server Components (`page.tsx` / `layout.tsx` render) are
 * read-only and will throw `ReadonlyRequestCookiesError` (E1180). The
 * live write path is `src/middleware.ts`. Returns `false` if the
 * signing key is unavailable (nothing written).
 */
export async function markAccountActiveSeen(): Promise<boolean> {
  const value = await signAccountActiveSeenValue();
  if (value === null) return false;
  const jar = await cookies();
  jar.set({
    name: ACCOUNT_ACTIVE_SEEN_COOKIE,
    value,
    maxAge: ACCOUNT_ACTIVE_SEEN_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return true;
}
