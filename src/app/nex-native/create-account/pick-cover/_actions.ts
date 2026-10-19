"use server";

// src/app/nex-native/create-account/pick-cover/_actions.ts
//
// NEX · S1 · Face Cover picker action.
// Owner-authorised 2026-10-18 · D1 (pending cookie) + Q1b (shop-intent only).
// -----------------------------------------------------------------------------
// Server Action invoked by the pick-cover page form. Reads the chosen
// layout id from the FormData, validates it server-side against the
// sealed 10-id whitelist via the sealed `parsePendingCoverLayoutId`
// (which delegates to `isValidCoverLayoutId` from `cover/layout-ids`),
// writes the httpOnly `nex_pending_cover_layout` cookie, and redirects
// the user to the next step in the Shop-intent onboarding chain.
//
// Doctrine guard-rails · owner directive 2026-10-18 safeguard #4:
//   · Server-side validation ONLY. The client cannot bypass the
//     whitelist by crafting a malicious form value · the parse helper
//     narrows every untrusted string to the sealed enum.
//   · Writes ONLY the pending cookie. Does NOT create a nex_business
//     row. Does NOT write `nex_business.cover_layout_id`. Does NOT
//     start a themes trial. Does NOT touch any other table.
//   · Honest failure path · if the layout id is missing or tampered,
//     the action redirects BACK to the picker with a honest error
//     query, never silently continues with no selection and never
//     tells the user the pick was saved.
//
// S1 scope: this action lives standalone · the next-step destination
// is `/create-account/welcome` (the existing Add-to-Home-Screen
// Bridge 42 landing) so the flow still terminates in a sealed page.
// S2 will insert `/create-account/building` between pick-cover and
// welcome · the only edit needed then is the NEXT_STEP constant
// below.

import { redirect } from "next/navigation";
import { writePendingCoverLayoutId } from "@/lib/nex-native/pending-cover-cookie";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { postCoverPickDestination } from "../_onboarding-destinations";

/** Destination after a successful pick · now resolved from the sealed
 *  onboarding destination helper (S3) · routes shop-intent users to
 *  the Building step. */
const PICK_COVER_NEXT_STEP = postCoverPickDestination();

/** Destination when the picker is reached without a valid session ·
 *  mirrors every other create-account surface. */
const SIGN_IN_HREF =
  "/nex-native/sign-in?next=/nex-native/create-account/pick-cover";

/** Destination when the layout id is missing or tampered · the picker
 *  surfaces the error via `?e=…` so the user understands why their
 *  previous tap didn't take. */
function pickCoverErrorHref(code: "missing" | "invalid"): string {
  return `/nex-native/create-account/pick-cover?e=${encodeURIComponent(code)}`;
}

export async function pickCoverAction(formData: FormData): Promise<never> {
  // Session gate first · unauthenticated visitors can't carry an
  // onboarding cookie forward anyway, and we don't want to leak the
  // pending-cover cookie to a stranger's browser.
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect(SIGN_IN_HREF);

  // Pull the raw layout id · explicit String coercion so we never
  // leak a non-string FormDataEntry into the parser.
  const rawLayoutId = formData.get("layout_id");
  const asString =
    typeof rawLayoutId === "string" ? rawLayoutId.trim() : "";
  if (asString === "") {
    redirect(pickCoverErrorHref("missing"));
  }

  // writePendingCoverLayoutId re-validates via `parsePendingCoverLayoutId`
  // before touching the cookie store · returns the parsed id on
  // success, or null when the value is NOT in the sealed 10-id
  // whitelist. We treat null as a tampered submission.
  const written = await writePendingCoverLayoutId(asString);
  if (written === null) {
    redirect(pickCoverErrorHref("invalid"));
  }

  redirect(PICK_COVER_NEXT_STEP);
}
