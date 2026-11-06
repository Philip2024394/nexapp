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
        <ShopBackgroundsClient
          businessId={business?.id ?? null}
          currentImageUrl={overrides.imageUrl}
        />
      </main>
    </>
  );
}
