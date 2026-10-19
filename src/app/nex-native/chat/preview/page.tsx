// src/app/nex-native/chat/preview/page.tsx
//
// Self-chat preview · world-class free NEX themes · 2026-10-11.
// -------------------------------------------------------------
// Resolves the viewer's own `chat_theme` and redirects to the
// matching `/themes/<id>` live preview. That page already mounts
// the full Theme Engine (StandardExperience) with sample messages,
// floating bubbles, ambient layers and the slim top activate bar.
//
// Why a redirect and not a bespoke renderer:
//   · /themes/[id] IS the self-chat preview surface. Writing a
//     second renderer would fork the Theme Engine stack and
//     invite drift. A redirect reuses the sealed preview path.
//   · The viewer's chat_theme is the authoritative "my theme"
//     signal. If it's unset or points at a theme we no longer
//     ship, we fall back to NEX Original (nex-bubbles) so the
//     visitor never lands on a 404.
//
// Guest viewers hit the account wall at /themes/[id] when they
// try to activate · they can still PREVIEW any theme the same way
// they can on /chat-themes-library.

import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { isLiveWorldId } from "../../chat-standard/_live-worlds";
// Owner-authorised 2026-10-18 · S9 · one-shot "open the Shop slider"
// cookie set by the cover-preview Use action. Consumed-and-cleared
// here so the next render of the theme preview opens the slider for
// Shop-journey users · never auto-opens for Themes / Personalised.
import { consumeOpenShopSliderCookie } from "@/lib/nex-native/open-shop-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PREVIEW_THEME = "nex-bubbles";

export default async function ChatPreviewPage() {
  const viewer = await resolveNexAppSessionOrGuest();

  // Guest · preview the NEX Original brand theme by default. The
  // activate bar on /themes/[id] handles the account wall when
  // they try to apply it. Guests cannot have the open-shop cookie
  // in a meaningful way (the Use-cover action redirects them to
  // sign-in before setting it) so no consume happens here.
  if (viewer.kind === "guest") {
    redirect(`/nex-native/themes/${DEFAULT_PREVIEW_THEME}`);
  }

  // Signed in · consume-and-clear the open-shop one-shot. When the
  // cookie is present we forward the signal to `/themes/[id]` via a
  // `?openShop=1` query param · the live preview reads that param
  // and opens the sealed Shop slider on first paint.
  const openShop = await consumeOpenShopSliderCookie();

  const picked = viewer.session.account.chat_theme ?? null;
  const previewId =
    picked && isLiveWorldId(picked) ? picked : DEFAULT_PREVIEW_THEME;
  const dest = `/nex-native/themes/${encodeURIComponent(previewId)}${
    openShop ? "?openShop=1" : ""
  }`;
  redirect(dest);
}
