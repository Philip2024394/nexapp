// src/lib/nex-worlds/world-cookie.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · preview cookie.
//
// Owner-only preview. The cookie carries the previewed world id AND a
// HMAC of (id + owner's account id) so it cannot be forged by a
// non-owner. Even if the cookie is copied, the HMAC fails against a
// different account's id.
//
// Lifetime: Max-Age 1h · auto-expires if the owner forgets to clear.
// Scope: httpOnly, sameSite=lax (so navigations keep it), secure in
// production. NOT persistent across devices (not stored in DB · sealed
// decision 2026-10-31).

import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { WorldId } from "./world-types";
import { parseWorldId } from "./world-registry";

const COOKIE_NAME = "nex_preview_world";
const MAX_AGE_SECONDS = 60 * 60; // 1 hour

function hmacKey(): string {
  // Reuse an existing secret if present, else derive from the service
  // role key (always present server-side). This cookie is a dev /
  // owner-preview mechanism · not sensitive beyond "which world is
  // the owner previewing on this device."
  const explicit = process.env.NEX_WORLD_PREVIEW_SIGNING_KEY;
  if (explicit && explicit.length >= 32) return explicit;
  const svc = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
  return crypto.createHash("sha256").update(`nex-world-preview::${svc}`).digest("hex");
}

function sign(worldId: WorldId, ownerAccountId: string): string {
  return crypto
    .createHmac("sha256", hmacKey())
    .update(`${worldId}|${ownerAccountId}`)
    .digest("hex")
    .slice(0, 32); // short-form · 128 bits is plenty
}

interface PreviewCookieValue {
  readonly worldId: WorldId;
  readonly ownerAccountId: string;
  readonly sig: string;
}

function encode(v: PreviewCookieValue): string {
  return `${v.worldId}.${v.ownerAccountId}.${v.sig}`;
}

function decode(raw: string): PreviewCookieValue | null {
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const worldId = parseWorldId(parts[0]);
  if (!worldId) return null;
  if (!parts[1] || parts[1].length < 8) return null;
  if (!parts[2] || parts[2].length !== 32) return null;
  return { worldId, ownerAccountId: parts[1]!, sig: parts[2]! };
}

/** Set the preview cookie for the current owner. */
export async function setPreviewWorldCookie(
  worldId: WorldId,
  ownerAccountId: string,
): Promise<void> {
  const value: PreviewCookieValue = {
    worldId,
    ownerAccountId,
    sig: sign(worldId, ownerAccountId),
  };
  const store = await cookies();
  store.set(COOKIE_NAME, encode(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearPreviewWorldCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Read + verify the preview cookie. Returns the previewed world id
 *  ONLY if the cookie's HMAC matches the supplied ownerAccountId.
 *  Caller is expected to have already resolved the signed-in account
 *  via `resolveSessionWithDevOverride()`. Pass that account's id. */
export async function readPreviewWorldForOwner(
  ownerAccountId: string | null,
): Promise<WorldId | null> {
  if (!ownerAccountId) return null;
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = decode(raw);
  if (!parsed) return null;
  // Owner-match: the cookie is bound to the owner's account id.
  if (parsed.ownerAccountId !== ownerAccountId) return null;
  // Signature check (constant-time).
  const expected = sign(parsed.worldId, parsed.ownerAccountId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.sig, "hex");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return parsed.worldId;
}
