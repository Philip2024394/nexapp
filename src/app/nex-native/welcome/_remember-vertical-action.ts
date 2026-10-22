"use server";

// src/app/nex-native/welcome/_remember-vertical-action.ts
//
// NEX welcome · vertical-intent server action.
// Owner-authorised 2026-10-20 · Phase A1.
// -----------------------------------------------------------------------------
// Writes the additive `nex_welcome_vertical` cookie when a visitor
// taps a vertical sub-type on the welcome page. The sealed
// `nex_welcome_intent` cookie (and its sealed server action
// _remember-intent-action.ts) are 100% UNTOUCHED by this file.
//
// Doctrine guard-rails:
//   · Server-side validation ONLY · the parse helper rejects any
//     category / subtype outside the sealed preset catalogue, so
//     a crafted form value cannot leak a bogus cookie through.
//   · Writes ONLY the vertical cookie · does NOT touch nex_business
//     (no business is created from browsing) · does NOT touch the
//     sealed `nex_welcome_intent` cookie.
//   · Honest failure path · invalid input returns silently with no
//     cookie write · the client UI should re-render in the base
//     state (no selection). The action never redirects away.

import { cookies } from "next/headers";
import {
  getPreset,
  isVerticalCategory,
  isVerticalSubtype,
} from "@/lib/nex-native/vertical-presets";
import {
  WELCOME_VERTICAL_COOKIE,
  welcomeVerticalCookieOptions,
  serializeVerticalIntent,
  clearVerticalDeclined,
} from "./_welcome-intent";

export interface RememberVerticalResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** Write-only server action · receives (category, subtype) via the
 *  form submit · validates against the sealed preset catalogue ·
 *  writes the cookie or returns an error with no cookie write. */
export async function rememberVerticalAction(
  formData: FormData,
): Promise<RememberVerticalResult> {
  const rawCategory = formData.get("category");
  const rawSubtype = formData.get("subtype");
  const category =
    typeof rawCategory === "string" ? rawCategory.trim() : "";
  const subtype =
    typeof rawSubtype === "string" ? rawSubtype.trim() : "";

  if (!isVerticalCategory(category)) {
    return { ok: false, error: `Invalid category "${category}".` };
  }
  if (!isVerticalSubtype(subtype)) {
    return { ok: false, error: `Invalid subtype "${subtype}".` };
  }
  // Final gate · the (category, subtype) pair must match a sealed
  // preset in the catalogue · guards against mismatched pairings
  // like {category: "accommodation", subtype: "villa"} being OK but
  // {category: "food", subtype: "villa"} being rejected.
  const preset = getPreset(category, subtype);
  if (!preset) {
    return {
      ok: false,
      error: `No preset for (${category}, ${subtype}) · pair not in catalogue.`,
    };
  }

  const jar = await cookies();
  jar.set({
    name: WELCOME_VERTICAL_COOKIE,
    value: serializeVerticalIntent({
      category: preset.category,
      subtype: preset.subtype,
    }),
    ...welcomeVerticalCookieOptions(),
  });
  // R1 fix (owner-authorised 2026-10-20) · if the user had previously
  // skipped the picker and later returned to pick a vertical, the
  // decline sentinel is now obsolete · clear it so pick-theme's
  // redirect gate reads the latest state.
  await clearVerticalDeclined();
  return { ok: true };
}
