// src/app/nex-native/library/backgrounds/page.tsx
//
// NEX Unified Visual Library · shared library page.
// Owner-authorised 2026-11-11 · Phase 1 implementation.
// -----------------------------------------------------------------------------
// Opened from either Shop settings (context=shop) or Chat Theme settings
// (context=chat). Reads the shared catalog; dispatches saves to the
// context-specific writer. Zero cross-coupling.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import {
  listBackgroundAssets,
  SHOP_CATEGORIES,
  CHAT_CATEGORIES,
  type BackgroundContext,
} from "@/lib/nex-native/library/catalog-service";
import { LibraryClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{
    readonly context?: string;
    readonly category?: string;
    readonly businessId?: string;
    readonly returnTo?: string;
  }>;
}

export default async function LibraryBackgroundsPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;
  const rawContext = sp.context;
  const context: BackgroundContext =
    rawContext === "shop" ? "shop" : rawContext === "chat" ? "chat" : "chat";

  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  // For shop context, resolve the businessId · either from query (explicit)
  // or pick the first business owned by the viewer (default).
  let businessId: string | null = null;
  let selectedShopAssetUrl: string | null = null;
  let selectedShopTintHex: string | null = null;

  if (context === "shop") {
    if (effectiveTier(session.account) !== "bisnis") {
      // Honest rejection · the UI will still render but the Apply button
      // is server-disabled by the action. Also link back to settings.
    }
    const businesses = await listBusinessesByOwner(session.account.id);
    if (businesses.length === 0) {
      // No business · redirect to shop setup
      redirect("/nex-native/manage/shop?from=library");
    }
    const explicit = sp.businessId;
    const match = explicit ? businesses.find((b) => b.id === explicit) : null;
    const chosen = match ?? businesses[0]!;
    businessId = chosen.id;
    selectedShopAssetUrl = chosen.shop_cover_image_url ?? null;
    selectedShopTintHex = chosen.shop_cover_tint_hex ?? null;
  }

  const selectedChatThemeId = context === "chat" ? session.account.chat_theme ?? null : null;

  const assets = await listBackgroundAssets({ context, category: sp.category });
  const categories = context === "shop" ? SHOP_CATEGORIES : CHAT_CATEGORIES;

  return (
    <LibraryClient
      context={context}
      categories={categories}
      initialCategory={sp.category ?? "all"}
      assets={assets.map((a) => ({
        id: a.id,
        storageUrl: a.storageUrl,
        previewUrl: a.previewUrl,
        label: a.label,
        tintHex: a.tintHex,
        categories: [...a.categories],
        contexts: [...a.contexts],
        tier: a.tier,
      }))}
      businessId={businessId}
      selectedShopAssetUrl={selectedShopAssetUrl}
      selectedShopTintHex={selectedShopTintHex}
      selectedChatThemeId={selectedChatThemeId}
      returnTo={sp.returnTo ?? null}
      viewerTier={effectiveTier(session.account)}
    />
  );
}
