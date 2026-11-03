// src/app/nex-native/free-chat/_customize-actions.ts
//
// NEX · Free Chat · bubble-customization server actions.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Save + Reset actions for the per-theme bubble customization chosen on
// `/nex-native/free-chat/bubble-customize`. Stores a plain JSON blob
// per themeId in a cookie (365-day max-age).
//
// Model (sealed · same-day): owner's choice is visible to the other
// user (per-chat theme). Today's /free-chat is a single-viewer preview
// surface so cookies suffice. When real two-way chat lands, swap the
// cookie read/write for a DB lookup against nex_chat_theme keyed by
// chat-id · the stored payload shape is identical, so neither the UI
// nor the renderer needs to change.
//
// Scope:
//   · No signed-in-account DB write today · the cookie fallback owner
//     authorised 2026-11-02 is the first pass. DB persistence lands
//     when nex_chat_theme ships (F-series follow-up).
//   · 365-day cookie max-age matches the sealed wallpaper cookie.
//   · Cookies are JS-writable (not httpOnly) so the client-side canvas
//     can clear them on Reset without a round-trip.

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  parseBubbleCustomization,
  type BubbleCustomization,
} from "./_types";

const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Build the cookie name for a given themeId. One cookie per theme so
 *  switching themes keeps each theme's customisation. */
function cookieNameFor(themeId: string): string {
  // The themeId is already a safe slug (e.g. "ireland-1", "theme-3").
  // Reject anything with characters that would mangle the cookie name.
  if (!/^[a-z0-9-]{1,32}$/i.test(themeId)) {
    throw new Error(
      `saveBubbleCustomizationAction · invalid themeId: ${themeId}`,
    );
  }
  return `nex-free-chat-bubble-${themeId}`;
}

export interface SaveBubbleCustomizationInput {
  readonly themeId: string;
  readonly customization: BubbleCustomization;
}

export type SaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "invalid_theme_id" | "invalid_payload" };

/** Persist a BubbleCustomization for the given themeId. */
export async function saveBubbleCustomizationAction(
  input: SaveBubbleCustomizationInput,
): Promise<SaveResult> {
  let name: string;
  try {
    name = cookieNameFor(input.themeId);
  } catch {
    return { ok: false, code: "invalid_theme_id" };
  }
  const safe = parseBubbleCustomization(input.customization);
  if (!safe) {
    return { ok: false, code: "invalid_payload" };
  }
  const jar = await cookies();
  jar.set({
    name,
    value: JSON.stringify(safe),
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    path: "/",
  });
  // Revalidate the surfaces that consume the cookie so the next
  // navigation paints the updated colours without a hard refresh.
  revalidatePath("/nex-native/free-chat");
  revalidatePath("/nex-native/free-chat/bubble-customize");
  return { ok: true };
}

/** Clear the customization for a themeId · the canvas falls back to
 *  the theme's accent-hex defaults. */
export async function resetBubbleCustomizationAction(
  input: { readonly themeId: string },
): Promise<SaveResult> {
  let name: string;
  try {
    name = cookieNameFor(input.themeId);
  } catch {
    return { ok: false, code: "invalid_theme_id" };
  }
  const jar = await cookies();
  jar.set({
    name,
    value: "",
    maxAge: 0,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/nex-native/free-chat");
  revalidatePath("/nex-native/free-chat/bubble-customize");
  return { ok: true };
}

/** Server-side read of the saved customisation for a themeId.
 *  Used by the free-chat page.tsx + the customize page.tsx.
 *  Returns null when the cookie is absent OR the payload is malformed. */
export async function readBubbleCustomization(
  themeId: string,
): Promise<BubbleCustomization | null> {
  let name: string;
  try {
    name = cookieNameFor(themeId);
  } catch {
    return null;
  }
  const jar = await cookies();
  const raw = jar.get(name)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parseBubbleCustomization(parsed);
  } catch {
    return null;
  }
}
