// src/app/nex-native/manage/shop/backgrounds/page.tsx
//
// NEX Shop Backgrounds library · owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Dedicated full-page library for shop background presets · mirrors
// the /chat-themes-library design pattern (phone-framed emerald
// surface · thin server shell · interactive grid in _client.tsx).
//
// Reached from the "Choose Background" small button on
// /manage/shop/themes. Selecting a background here calls the sealed
// applyShopPresetBackgroundAction and redirects back to the themes
// picker so the owner sees the new background applied.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { getShopCoverOverrides } from "@/lib/nex-native/shop-cover-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  COVER_LAYOUT_IDS,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";
import { NexPageHeader } from "../../../_page-header";
import { ShopBackgroundsClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopBackgroundsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/backgrounds");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const business = businesses[0] ?? null;

  const overrides = business
    ? await getShopCoverOverrides(business.id)
    : { imageUrl: null, tintHex: null };

  // Owner directive 2026-11-12 (fifth pass) · the preview popup on
  // this page needs to render the user's PREVIOUSLY SELECTED template
  // (nex_business.cover_layout_id) with the candidate background
  // painted behind it · same iframe route (`?embed=1`) as the themes
  // picker. "cafe" is the sealed first-visit default (matches
  // /manage/shop/themes/page.tsx line 72).
  const currentLayoutId: CoverLayoutId =
    business?.cover_layout_id &&
    (COVER_LAYOUT_IDS as readonly string[]).includes(business.cover_layout_id)
      ? (business.cover_layout_id as CoverLayoutId)
      : "cafe";

  // Owner directive 2026-11-12 · shared NexPageHeader (brand chip +
  // global black "+" drawer button) replaces the custom drawer slot +
  // orange "Browse NEX Visual Library" CTA. Supersedes the 2026-11-07
  // custom-drawer and the 2026-11-11 library CTA at the top of this
  // page · both read as chrome noise on the simplified launch surface.
  // tier()/effectiveTier helpers remain imported in case NexPageHeader
  // ever needs the Bisnis flag; today it auto-resolves via
  // resolveSessionWithDevOverride.
  void effectiveTier;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-backgrounds
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 10px) 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        {/* Owner directive 2026-11-12 (third pass) · header title
            "Shop Backgrounds" now lives INSIDE the global NexPageHeader
            (left slot via `brandSlot`) · promoted from the h1 hero
            that sat below the header. The hero slot below shrinks to
            a subtitle ("Choose Shop background"). Brand ping-badge
            still hidden · the backgrounds library reads as a gallery
            not an identity surface. */}
        <NexPageHeader
          dataScope="shop-backgrounds"
          hideSearch
          brandSlot={
            <div
              data-nex-shop-bg-header-title
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#000000",
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Shop Backgrounds
            </div>
          }
        />
        <ShopBackgroundsClient
          businessId={business?.id ?? null}
          currentImageUrl={overrides.imageUrl}
          currentLayoutId={currentLayoutId}
          currentTintHex={overrides.tintHex}
        />
      </main>
    </>
  );
}
