// src/app/api/nex-native/select-theme/route.ts
//
// NEX · selected-theme cookie setter · 2026-10-15 · owner-authorised.
// -----------------------------------------------------------------------------
// Writes the `nex_selected_theme` cookie when a guest viewer opens
// one of the two free NEX-brand themes (nex-bubbles · nex-flat). The
// cookie is read + consumed inside `createNexAccountAction` so a
// freshly-signed-up user returns to the EXACT theme they previewed.
//
// Hard whitelist against `parseSelectedThemeId` so an attacker can't
// make the cookie point at an arbitrary URL. Same cookie attributes
// as sealed nex_welcome_intent (httpOnly · sameSite lax · 24h ·
// path "/").

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  parseSelectedThemeId,
  SELECTED_THEME_COOKIE,
} from "@/lib/nex-native/selected-theme-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("id") ?? "";
  const chosen = parseSelectedThemeId(raw);
  if (!chosen) {
    return NextResponse.json(
      { ok: false, reason: "unknown_theme" },
      { status: 400 },
    );
  }
  const jar = await cookies();
  jar.set({
    name: SELECTED_THEME_COOKIE,
    value: chosen,
    httpOnly: true,
    // `secure: true` in production so the cookie never leaves HTTPS.
    // Dev (http://localhost) must stay false or the browser refuses
    // to set the cookie at all. Mirrors nex_welcome_intent's pattern.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return NextResponse.json({ ok: true, chosen });
}
