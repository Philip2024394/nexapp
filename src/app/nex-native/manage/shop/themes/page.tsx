// src/app/nex-native/manage/shop/themes/page.tsx
//
// NEX Shop Themes · Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Shop admin picks their shop's cover layout (one of the 11 sealed
// cover templates) + tint colour + optional custom background image.
// Design mirrors /nex-native/chat-themes-library · emerald Ireland
// palette via the world-stylesheet (no per-page colour overrides).
//
// Three dimensions the owner can set here:
//   1. Template layout · one of COVER_LAYOUT_IDS (sealed · 11 ids).
//      Persists to nex_business.cover_layout_id.
//   2. Accent tint · #RRGGBB hex via native <input type="color">.
//      Persists to nex_business.shop_cover_tint_hex via
//      updateShopCoverTint in shop-cover-service.
//   3. Background image · upload custom to nex-user-wallpapers
//      bucket via uploadShopCoverImage. Persists to
//      nex_business.shop_cover_image_url.
//
// Render-time precedence (sealed · [businessSlug]/page.tsx):
//   shop_cover_image_url → theme.hero_image_url → gradient fallback
//   shop_cover_tint_hex  → theme.accent_hex
//
// Scope for THIS commit:
//   · Full UI for template picker + tint picker + image upload.
//   · All three persistence paths wired to shop-cover-service.
//   · Guest/unauth → redirect to /sign-in.
//   · No shop row (not yet provisioned) → shows a soft "pick a shop
//     first" state with a link to /manage/shop.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { getShopCoverOverrides } from "@/lib/nex-native/shop-cover-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import {
  COVER_LAYOUT_IDS,
  COVER_LAYOUT_LABELS,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";
import { ShopThemesClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopThemesPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/themes");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const business = businesses[0] ?? null;

  const overrides = business
    ? await getShopCoverOverrides(business.id)
    : { imageUrl: null, tintHex: null };

  const currentLayoutId: CoverLayoutId =
    business?.cover_layout_id &&
    (COVER_LAYOUT_IDS as readonly string[]).includes(business.cover_layout_id)
      ? (business.cover_layout_id as CoverLayoutId)
      : "cafe";

  // Owner directive 2026-11-07 · shared ControlDrawer (default + icon
  // trigger) anchored top-right so the user can navigate away without
  // leaving the phone-frame shell. Same pattern mounted on
  // /manage/shop/backgrounds, /cover-themes-library and others.
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-themes
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
            "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        {/* Owner directive 2026-11-07 · absolute drawer slot anchored
            top-right of the page so it stays above the scrollable grid
            inside _client without reserving a row in the client layout.
            Triggers the sealed shared ControlDrawer · default + icon
            trigger · opens the full navigation panel. */}
        <div
          data-nex-shop-themes-drawer-slot
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 14px)",
            right: 20,
            zIndex: 20,
          }}
        >
          {/* Owner directive 2026-11-07 · "add cream button for the +
              side drawer round". Trigger rendered as a cream circle
              with warm-ink + glyph so it reads as a friendly action
              against the sealed dark Ireland world chrome. */}
          <ControlDrawer
            session={drawerSession}
            triggerStyle={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "#FAF8F4",
              color: "#1A120A",
              border: "1.5px solid var(--nex-world-secondary, #C6A15B)",
              boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)",
            }}
          />
        </div>
        <ShopThemesClient
          businessId={business?.id ?? null}
          businessName={business?.display_name ?? null}
          currentLayoutId={currentLayoutId}
          currentTintHex={overrides.tintHex}
          currentImageUrl={overrides.imageUrl}
          layoutIds={[...COVER_LAYOUT_IDS]}
          layoutLabels={COVER_LAYOUT_LABELS}
        />
      </main>
    </>
  );
}
