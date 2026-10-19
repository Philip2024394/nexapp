"use server";

// src/app/nex-native/cover/preview/[layoutId]/_use-cover-action.ts
//
// NEX · S8 · "Use this cover" action from the cover-preview bar.
// Owner-authorised 2026-10-18 · library→preview→Use journey.
// -----------------------------------------------------------------------------
// Writes the sealed `nex_pending_cover_layout` cookie (S0) AND the
// one-shot `nex_open_shop_on_chat` cookie (S9), then redirects to the
// chat preview. For guests, the pending-cover cookie is set FIRST
// (survives signup on its own 24h TTL) and the user is pushed to
// `/sign-in?next=/nex-native/chat/preview` so the standard auth
// flow completes without the sealed `AccountWallActionId` contract
// having to grow a `pick-cover` id (owner-recommended Option A).
//
// Doctrine guarantees · never silently violated:
//
//   1 · Validation happens server-side before ANY cookie write ·
//       the sealed `parsePendingCoverLayoutId` whitelist rejects
//       tampered input and the action returns a redirect-with-error
//       instead of a silent accept.
//
//   2 · Cookie writes are PENDING SELECTIONS · they do NOT create
//       a `nex_business` row and they do NOT touch
//       `nex_business.cover_layout_id`. The sealed Q2b rule holds:
//       Shop intent must not auto-create a business.
//
//   3 · The one-shot open-shop cookie is only set after the pending
//       cover write succeeds · we never pre-queue the slider for a
//       user whose cover selection didn't persist.
//
//   4 · Guests go through the standard sign-in route, not an
//       invented account-wall action id · preserves the sealed
//       AccountWallActionId contract.

import { redirect } from "next/navigation";
import { writePendingCoverLayoutId } from "@/lib/nex-native/pending-cover-cookie";
import { setOpenShopSliderCookie } from "@/lib/nex-native/open-shop-cookie";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";

/** Chat preview URL · the sealed `/chat/preview` route resolves to
 *  the user's current `nex_account.chat_theme` live preview. The
 *  cookie-based one-shot flag then opens the Shop slider on landing. */
const CHAT_PREVIEW_HREF = "/nex-native/chat/preview";

/** Guest-first destination · we route them to sign-in with the next
 *  parameter pointing at the chat preview. After successful sign-in
 *  the pending-cover cookie is still live (its own 24h TTL) and the
 *  open-shop cookie is still live (its own 1h TTL). */
function signInHref(): string {
  return `/nex-native/sign-in?next=${encodeURIComponent(CHAT_PREVIEW_HREF)}`;
}

/** Error destination · bounces the user back to the same cover
 *  preview with a honest query so the picker shows the mistake. */
function errorHref(layoutId: string, code: "missing" | "invalid"): string {
  return `/nex-native/cover/preview/${encodeURIComponent(
    layoutId,
  )}?e=${encodeURIComponent(code)}`;
}

export async function useCoverAction(formData: FormData): Promise<never> {
  const rawLayoutId = formData.get("layout_id");
  const asString =
    typeof rawLayoutId === "string" ? rawLayoutId.trim() : "";
  if (asString === "") {
    // No layout id in the form · bounce back with the sealed error
    // query so the preview can show the mistake honestly.
    redirect("/nex-native/cover-themes-library?e=missing");
  }

  // `writePendingCoverLayoutId` re-validates via the sealed
  // `parsePendingCoverLayoutId` whitelist · returns the parsed id on
  // success or null when the submission is tampered. We treat null
  // as "do not advance the flow."
  const written = await writePendingCoverLayoutId(asString);
  if (written === null) {
    redirect(errorHref(asString, "invalid"));
  }

  // Only AFTER the pending cover persists do we set the one-shot
  // open-shop cookie · prevents the slider firing for users whose
  // choice did not actually record.
  await setOpenShopSliderCookie();

  // Session branch · signed-in users go straight to the chat
  // preview. Guests are routed to sign-in with the chat preview as
  // the `next` destination · both cookies survive the auth hop.
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "guest") {
    redirect(signInHref());
  }
  redirect(CHAT_PREVIEW_HREF);
}
