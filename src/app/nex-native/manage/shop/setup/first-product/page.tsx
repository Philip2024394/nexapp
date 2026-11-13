// src/app/nex-native/manage/shop/setup/first-product/page.tsx
//
// Shop Setup · Step 3 · First Product.
// Owner-authorised 2026-11-12 (simplification review).
// -----------------------------------------------------------------------------
// Welcome card that points the seller at the existing
// /nex-native/create/product/category flow · NEX already has a full
// product-creation pipeline (category → details → publish) and we do
// NOT duplicate it here. On return, the dispatcher checks the real
// product count in nex_product and lands the seller on /review if
// ≥1 product exists.
//
// Skip link: "I'll add products later" → /manage/shop/setup/review
// (the dispatcher will bounce back here on refresh if no product
// exists yet · the skip just lets the seller see the review surface
// without being forced to add a product right now).

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { listProductsByBusiness } from "@/lib/nex-native/product-service";
import { FirstProductClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupFirstProductPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/manage/shop/setup/first-product",
    );
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/business-details");
  }

  // Check the REAL product count · not a visit flag. If the seller
  // created a product and came back, let the dispatcher send them on
  // to review.
  const products = await listProductsByBusiness(existing.id);
  const productCount = products.length;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-first-product
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
        <FirstProductClient productCount={productCount} />
      </main>
    </>
  );
}
