// src/app/nex-native/chat-themes-library/_category-library-shell.tsx
//
// NEX Chat Themes · shared category-library shell.
// Owner-sealed 2026-11-26 (L-011) · three-category hub.
//
// A single server component so the three category routes
// (/plain, /small, /full-image) stay thin wrappers. Each page
// invokes `renderCategoryLibrary(kind)` and passes the result
// up as its default export.
//
// What this does differently from /all/page.tsx:
//
//   · filters the unified nex_background_asset catalog through the
//     pure `classifyChatCategories` classifier so a user only sees
//     the assets that match their chosen category,
//   · overrides the FullLibraryClient header title with the
//     human-readable label from CHAT_CATEGORY_LABEL so each library
//     carries its own identity (e.g. "Small Designs").
//
// Everything else is identical to /all so bubble-preview, selection,
// persistence, the Themes+ entitlement path, the global drawer, and
// the reset flow continue to work unchanged.

import type * as React from "react";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  resolveCreatorBadges,
  EMPTY_EARNED_BADGES,
} from "@/lib/nex-native/creator/creator-badges";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  FullLibraryClient,
  type LibraryEntitlementProps,
} from "./_full-library-client";
import {
  listBackgroundAssets,
  type BackgroundAsset,
} from "@/lib/nex-native/library/catalog-service";
import type { LibraryTheme } from "./_catalog";
import {
  canClaimFirstFreeTheme,
  isThemesPlusActive,
  loadThemesPlusUntil,
} from "@/lib/nex-native/library/entitlement-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { getThemesPlusMonthlyForMarket } from "@/lib/nex-native/commercial/themes-plus-pricing";
import type { SupportedRegion } from "@/lib/nex-native/commercial/regional-pricing";
import {
  CHAT_CATEGORY_LABEL,
  classifyBackgroundAsset,
  type ChatCategoryKind,
} from "./_category-classifier";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function normaliseRegion(iso2: string | null): SupportedRegion | null {
  if (!iso2) return null;
  const u = iso2.trim().toUpperCase();
  switch (u) {
    case "IE":
    case "GB":
    case "US":
    case "ID":
    case "AU":
    case "CA":
    case "JP":
    case "IN":
    case "PH":
      return u;
    default:
      return null;
  }
}

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function toLibraryTheme(a: BackgroundAsset): LibraryTheme {
  return {
    id: a.id,
    label: a.label,
    wallpaperUrl: a.previewUrl ?? a.storageUrl,
    oneTimePriceEUR: 3.99 as const,
    accentHex: "#C6A15B" as const,
    downloads: 0,
  };
}

/** Server component helper: render the category library for `kind`.
 *  Called from each of the three category route files. Returns the
 *  same `<main>` shape as /all/page.tsx so the surrounding chrome
 *  (safe-area insets, country-backdrop CSS, drawer) behaves identically. */
export async function renderCategoryLibrary(
  kind: ChatCategoryKind,
): Promise<React.ReactElement> {
  const session = await resolveSessionWithDevOverride();

  const drawerSession: ControlDrawerSession | null = session
    ? {
        displayName: session.account.display_name,
        nexHandle: session.account.nex_handle,
        isBisnis: effectiveTier(session.account) === "bisnis",
      }
    : null;

  const viewerCreatorBadges = session
    ? await resolveCreatorBadges(session.account.id).catch(
        () => EMPTY_EARNED_BADGES,
      )
    : EMPTY_EARNED_BADGES;

  // Load every chat-context asset then narrow through the pure
  // classifier. Keeping the filter in TypeScript means no sandbox
  // migration is required to adopt the three-category hub.
  const allAssets = await listBackgroundAssets({ context: "chat" }).catch(
    () => [],
  );
  const filteredAssets = allAssets.filter(
    (a) => classifyBackgroundAsset(a) === kind,
  );

  const themesRaw: readonly LibraryTheme[] = filteredAssets.map(toLibraryTheme);
  const themes: readonly LibraryTheme[] = [...themesRaw].sort(
    (a, b) => stableHash(a.id) - stableHash(b.id),
  );

  let entitlement: LibraryEntitlementProps | undefined;
  if (session) {
    const [themesPlusUntil, canClaimFirstFree, profile] = await Promise.all([
      loadThemesPlusUntil(session.account.id),
      canClaimFirstFreeTheme(session.account.id),
      getProfileByAccountId(session.account.id).catch(() => null),
    ]);
    const region = normaliseRegion(profile?.country_code ?? null);
    const price = region ? getThemesPlusMonthlyForMarket(region) : null;
    entitlement = {
      themesPlusActive: isThemesPlusActive(themesPlusUntil),
      canClaimFirstFree,
      themesPlusPriceLabel: price?.label ?? null,
    };
  }

  const title = CHAT_CATEGORY_LABEL[kind];

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-library-category={kind}
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
        <FullLibraryClient
          drawerSession={drawerSession}
          viewerCreatorBadges={viewerCreatorBadges}
          themesOverride={themes}
          entitlement={entitlement}
          title={title}
        />
      </main>
    </>
  );
}
