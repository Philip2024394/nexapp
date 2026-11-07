// src/app/nex-native/manage/shop/setup/request-category/page.tsx
//
// Shop Setup · side flow · Request a missing business category.
// Owner-authorised 2026-11-07 · "No legitimate business should be
// left without a suitable category in NEX."
// -----------------------------------------------------------------------------
// Entry points:
//   · /nex-native/manage/shop/setup/category · "Request a category →"
//     link below the subcategory dropdown
//   · /nex-native/manage/shop/setup/category · picking "Other …" in
//     Accommodation or Property (which have no catch-all subtype)
// Server shell confirms a session + reads the optional ?category
// query param to pre-select the closest match. Delegates render to
// _client.tsx.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { isBusinessCategory } from "@/lib/nex-native/business/categories";
import type { BusinessCategory } from "@/lib/nex-native/business/types";
import { RequestCategoryClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupRequestCategoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/manage/shop/setup/request-category",
    );
  }
  const params = await searchParams;
  const rawCategory = typeof params.category === "string" ? params.category : "";
  const prefilledCategory: BusinessCategory | null = isBusinessCategory(rawCategory)
    ? (rawCategory as BusinessCategory)
    : null;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-request-category
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
        <RequestCategoryClient prefilledCategory={prefilledCategory} />
      </main>
    </>
  );
}
