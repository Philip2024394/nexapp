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
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
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

  // Owner directive 2026-11-07 · shared ControlDrawer in the header's
  // right-side slot so the user can navigate away from the backgrounds
  // library without leaving the phone-frame shell. Same shape mounted
  // on /cover-themes-library + /directory/landing + /contacts.
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

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
            "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        {/* Owner directive 2026-11-07 · absolute drawer slot anchored
            top-right of the page so it stays above the scrollable grid
            inside _client without reserving a row in the client layout.
            z-index above the client content · tap target 36×36 (sealed
            ControlDrawer trigger size). */}
        <div
          data-nex-shop-backgrounds-drawer-slot
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 14px)",
            right: 20,
            zIndex: 20,
          }}
        >
          <ControlDrawer session={drawerSession} />
        </div>
        {/* Owner directive 2026-11-11 · Phase 1 unified NEX Visual
            Library · deep-link CTA at top of the existing shop
            picker. Lets the owner browse the shared catalog with a
            shop preview. Writes go through the library's own shop
            action (applyFromLibraryShopAction), which uses the same
            nex_business.shop_cover_image_url + shop_cover_tint_hex
            columns as the legacy applyShopPresetBackgroundAction,
            so this picker remains fully functional alongside it. */}
        {business ? (
          <div style={{ padding: "8px 2px 0" }}>
            <a
              href={`/nex-native/library/backgrounds?context=shop&businessId=${encodeURIComponent(business.id)}&returnTo=${encodeURIComponent("/nex-native/manage/shop/backgrounds")}`}
              data-nex-shop-library-cta
              style={{
                display: "block",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#FF7200",
                color: "#FFFFFF",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: "0.04em",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              Browse NEX Visual Library
            </a>
          </div>
        ) : null}
        <ShopBackgroundsClient
          businessId={business?.id ?? null}
          currentImageUrl={overrides.imageUrl}
        />
      </main>
    </>
  );
}
