"use server";

// src/app/nex-native/create-account/business-kind/_skip-action.ts
//
// NEX · business-kind SKIP server action · R1 corrective patch
// (owner-authorised 2026-10-20).
// -----------------------------------------------------------------------------
// Writes the short-lived decline sentinel cookie so pick-theme does
// not immediately bounce the user back to /business-kind in an
// infinite redirect loop. Does NOT invent a subtype · does NOT
// pre-select Villa / Homestay / Kost · does NOT touch the sealed
// `nex_welcome_intent` cookie. The user simply reaches theme
// selection without a declared vertical.

import { redirect } from "next/navigation";
import { writeVerticalDeclined } from "../../welcome/_welcome-intent";

const PICK_THEME_HREF = "/nex-native/create-account/pick-theme";

/** Write-and-redirect server action bound to the business-kind
 *  Skip button form. Writes the decline sentinel then redirects to
 *  /pick-theme · the pick-theme redirect gate consults the sentinel
 *  and no longer bounces back to business-kind, breaking the loop. */
export async function skipVerticalPickerAction(): Promise<never> {
  await writeVerticalDeclined();
  redirect(PICK_THEME_HREF);
}
