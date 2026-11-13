// src/app/nex-native/manage/shop/setup/review/page.tsx
//
// Shop Setup · Step 4 · Review.
// Owner-authorised 2026-11-12 (simplification review).
// -----------------------------------------------------------------------------
// Final step · summary of what's saved + what's optional + a single
// "Open your shop" CTA that lands on /manage/shop. Replaces the legacy
// /setup/finish page.
//
// NO activation writes · existing publishing / Stripe / category /
// safe-trade gates on /manage/shop and /manage/shop/themes continue
// to govern when the shop is actually live. This page just gives the
// seller a completion moment and a clear exit to their shop dashboard.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { listProductsByBusiness } from "@/lib/nex-native/product-service";
import {
  WIZARD_STEPS as _WIZARD_STEPS_IMPORTED,
} from "../_wizard-shell";
import { ReviewClient } from "./_client";

// Keep the tree-shaking helper reachable so eslint doesn't drop the
// import for callers that may want to render the step map later.
void _WIZARD_STEPS_IMPORTED;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupReviewPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/review");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/business-details");
  }
  const products = await listProductsByBusiness(existing.id);

  // Status checklist · each row reports what's saved today so the
  // seller sees the full picture without having to open each page.
  const summary = {
    shopName: existing.display_name ?? null,
    hasLogo: Boolean(existing.logo_url),
    country: existing.operating_country_code ?? null,
    city: existing.city ?? null,
    category: existing.business_category ?? null,
    hasBackground: existing.shop_cover_image_url !== null,
    hasHours: Boolean(existing.hours_display),
    hasStory: Boolean(existing.description),
    hasShipping: Boolean(existing.shipping_scope),
    hasContact: Boolean(
      existing.instagram_handle ||
        existing.facebook_handle ||
        existing.tiktok_handle ||
        existing.public_phone ||
        existing.website_url ||
        existing.public_email,
    ),
    productCount: products.length,
    shopUrl: existing.slug
      ? `/nex-native/${existing.slug}`
      : null,
  };

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-review
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
        <ReviewClient summary={summary} />
      </main>
    </>
  );
}
