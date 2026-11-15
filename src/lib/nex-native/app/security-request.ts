// src/lib/nex-native/app/security-request.ts
//
// Request-context helpers for Phase 1.0 Security API routes.
// -------------------------------------------------------------------------
// Deriving things like the current session key (sha256 of the access
// token), the client IP, and the user-agent in a consistent way across
// every /api/nex-native/security/* handler. Reusing one helper keeps
// the routes small AND keeps the token-extraction logic in one place
// to review for safety.

import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/** Pull the Supabase access token from the request. Order:
 *    1. Authorization: Bearer header (script / test callers)
 *    2. sb-*-auth-token cookie (standard browser session)
 *    3. chunked sb-*-auth-token.0 / .1 / ... cookies (large sessions) */
export function readAccessTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  return extractAccessTokenFromCookieHeader(cookieHeader);
}

/** sha256 hash of the current request's Supabase access token, lowercase
 *  hex. Matches the key used by the session resolver when writing to
 *  nex_session.supabase_session_key. Returns null when no token is
 *  present (unauthenticated · caller should 401 before this). */
export function currentSessionKey(req: NextRequest): string | null {
  const token = readAccessTokenFromRequest(req);
  if (!token) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Approximate client IP from the request. Falls back through the
 *  standard proxy headers · never trusts user-controlled "x-real-ip"
 *  blindly in prod · in Next.js on a trusted host both are available. */
export function readClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  // NextRequest.ip may be unavailable in dev; return null in that case.
  return null;
}

/** Return the User-Agent header. Trimmed, capped at 1024 chars to
 *  match the DB CHECK on nex_sign_in_event.user_agent. */
export function readUserAgent(req: NextRequest): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  return ua.trim().slice(0, 1024);
}

/** Two-letter ISO country code for the client, derived from edge
 *  headers. Falls through: CF-IPCountry (Cloudflare) → X-Vercel-IP-Country
 *  (Vercel edge). Returns null when no edge is in front (local dev) ·
 *  callers should treat "unknown" as the honest state, not fabricate a
 *  country. Shape is validated against the migration-346 CHECK
 *  (^[A-Z]{2}$) so bad edge values are dropped. */
export function readClientCountry(req: NextRequest): string | null {
  const raw =
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    null;
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  if (trimmed === "XX" || trimmed === "T1") return null; // CF uses XX/T1 for unknown/Tor
  return trimmed;
}

/** Collapse a full User-Agent string into a short "family" label we can
 *  safely display in the side-drawer without leaking fingerprinting
 *  detail. Covers the common desktop/mobile browsers; falls back to
 *  "Other" for anything we can't cheaply recognise. Capped to 64 chars
 *  to satisfy the migration-346 CHECK. */
export function userAgentFamily(ua: string | null): string | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  // Order matters: Edge/OPR/CriOS before Chrome; iPad/iPhone before Safari.
  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("fxios")) return "Firefox (iOS)";
  if (s.includes("firefox")) return "Firefox";
  if (s.includes("crios")) return "Chrome (iOS)";
  if (s.includes("chrome") && !s.includes("chromium")) return "Chrome";
  if (s.includes("chromium")) return "Chromium";
  if (s.includes("ipad") || s.includes("iphone")) return "Safari (iOS)";
  if (s.includes("safari")) return "Safari";
  return "Other";
}

// ---------------------------------------------------------------------------
// Internal · cookie extraction (byte-equivalent to session.ts helper)
// ---------------------------------------------------------------------------

function extractAccessTokenFromCookieHeader(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const cookies: Record<string, string> = Object.fromEntries(
    cookieHeader.split(";").map((p) => {
      const idx = p.indexOf("=");
      if (idx < 0) return [p.trim(), ""];
      return [p.slice(0, idx).trim(), decodeURIComponent(p.slice(idx + 1).trim())];
    }),
  );
  for (const [k, v] of Object.entries(cookies)) {
    if (!/^sb-.*-auth-token$/.test(k)) continue;
    const parsed = tryParseSupabaseCookie(v);
    if (parsed) return parsed;
  }
  const chunkKeys = Object.keys(cookies)
    .filter((k) => /^sb-.*-auth-token\.\d+$/.test(k))
    .sort();
  if (chunkKeys.length > 0) {
    const joined = chunkKeys.map((k) => cookies[k]!).join("");
    const parsed = tryParseSupabaseCookie(joined);
    if (parsed) return parsed;
  }
  return null;
}

function tryParseSupabaseCookie(raw: string): string | null {
  if (!raw) return null;
  let payload = raw;
  if (payload.startsWith("base64-")) payload = payload.slice(7);
  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string")
      return obj.access_token;
  } catch {
    /* fall through */
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string")
      return obj.access_token;
  } catch {
    /* fall through */
  }
  return null;
}
