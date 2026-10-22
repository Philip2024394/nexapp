// src/app/nex-native/cover-themes-library/edit/[layoutId]/page.tsx
//
// NEX Shop Face Cover · Edit route · owner-authorised 2026-10-20.
// -----------------------------------------------------------------------------
// Dedicated edit surface reached from the "Edit theme" button on each
// cover-themes-library tile. Lets the signed-in Bisnis account owner
//
//   · Pick an accent colour (persists to nex_business.shop_cover_tint_hex)
//   · Replace the shop face cover background image (persists to
//     nex_business.shop_cover_image_url)
//   · Reset both back to the chat_theme defaults
//
// Precedence at render on /{slug}:
//   shop_cover_image_url → theme.hero_image_url → gradient fallback
//   shop_cover_tint_hex  → theme.accent_hex
//
// Non-destructive · the sealed Cover-A path keeps bundle.themeId as
// the base theme. Owner edits are overrides layered on top.

import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";
import {
  isValidCoverLayoutId,
  COVER_LAYOUT_LABELS,
  COVER_LAYOUT_IDS,
} from "../../../cover/layout-ids";
import { getShopCoverOverrides } from "@/lib/nex-native/shop-cover-service";
import { EditShopCoverClient } from "./_edit-client";
import {
  uploadShopCoverImageAction,
  updateShopCoverTintAction,
  resetShopCoverAction,
  applyAndContinueAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ layoutId: string }>;
}

export default async function EditShopCoverPage({ params }: PageProps) {
  const { layoutId } = await params;
  if (!isValidCoverLayoutId(layoutId)) notFound();

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent(`/nex-native/cover-themes-library/edit/${layoutId}`),
    );
  }

  const businesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => []);
  const primaryBusiness = businesses[0] ?? null;
  if (!primaryBusiness) {
    // Signed in but no business row yet · bounce back to the library.
    redirect("/nex-native/cover-themes-library");
  }

  const overrides = await getShopCoverOverrides(primaryBusiness.id);
  const templateNumber =
    String(COVER_LAYOUT_IDS.indexOf(layoutId) + 1).padStart(2, "0");
  const templateName = COVER_LAYOUT_LABELS[layoutId];

  /* Owner directive 2026-10-20 · the preview iframe must paint under
     the SIGNED-IN viewer's chat theme (e.g. Crispy Chicken) not the
     global pink-dream default. Server resolves the chat_theme id and
     passes it to the client · when null the client falls back to
     omitting the ?theme= param (preview surface then uses its own
     default). */
  const viewerChatThemeId = session.account.chat_theme ?? null;

  /* Owner directive 2026-10-20 · header carries the sealed NexPingBadge
     (left · paints the viewer's chat theme wallpaper · same image
     shown on the chat preview) + the shared ControlDrawer (right ·
     3-dots). Both pull from the same chat_theme resolution as the
     cover-themes-library page so the two surfaces read as siblings. */
  let viewerChatThemeImageUrl: string | null = null;
  const chatThemeIdForBadge = viewerChatThemeId ?? undefined;
  if (isLiveWorldId(chatThemeIdForBadge)) {
    const pkg = LIVE_WORLD_PACKAGES[chatThemeIdForBadge] as unknown as {
      wallpaperUrl?: string | null;
    };
    viewerChatThemeImageUrl = pkg.wallpaperUrl ?? null;
  }
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
    activeChatThemeImageUrl: viewerChatThemeImageUrl,
  };

  return (
    <EditShopCoverClient
      layoutId={layoutId}
      templateNumber={templateNumber}
      templateName={templateName}
      businessId={primaryBusiness.id}
      businessSlug={primaryBusiness.slug ?? ""}
      initialImageUrl={overrides.imageUrl}
      initialTintHex={overrides.tintHex}
      viewerChatThemeId={viewerChatThemeId}
      viewerChatThemeImageUrl={viewerChatThemeImageUrl}
      drawerSession={drawerSession}
      uploadImageAction={uploadShopCoverImageAction}
      updateTintAction={updateShopCoverTintAction}
      resetAction={resetShopCoverAction}
      applyAndContinueAction={applyAndContinueAction}
    />
  );
}
