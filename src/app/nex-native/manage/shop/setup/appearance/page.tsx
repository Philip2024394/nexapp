// src/app/nex-native/manage/shop/setup/appearance/page.tsx
//
// Shop Setup · Step 2 · Appearance.
// Owner-authorised 2026-11-12 (simplification review).
// -----------------------------------------------------------------------------
// Thin welcome card that routes the seller to the sealed template +
// background pickers. This step is normally SKIPPED by the dispatcher
// because sellers arriving from the backgrounds "Use Theme" CTA have
// already confirmed both a template (nex_business.cover_layout_id)
// and a background (nex_business.shop_cover_image_url !== null).
//
// A seller who lands here directly (e.g. via a hand-typed URL or a
// resume-from-where-you-left-off deep link) should see a clear call
// to pick a template + background before moving on to First Product.
//
// This page performs NO writes. The real writes happen on
// /manage/shop/themes and /manage/shop/backgrounds (sealed existing
// surfaces · no duplication).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { AppearanceClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupAppearancePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/manage/shop/setup/appearance",
    );
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    // No business row yet · bounce to business-details which auto-
    // provisions on save.
    redirect("/nex-native/manage/shop/setup/business-details");
  }

  // Safeguard: if the seller is already past this step, the dispatcher
  // will skip them · we also honour that signal here in case someone
  // hand-visits the URL after confirming.
  const hasConfirmedBackground = existing.shop_cover_image_url !== null;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-appearance
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
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <AppearanceClient hasConfirmedBackground={hasConfirmedBackground} />
      </main>
    </>
  );
}
