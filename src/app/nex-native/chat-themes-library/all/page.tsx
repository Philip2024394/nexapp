// src/app/nex-native/chat-themes-library/all/page.tsx
//
// NEX Chat Themes · FULL LIBRARY ROUTE.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Paginated 2-per-row grid of every library theme. Reached via the
// "View full library" / "View Library" CTA on the entry page.
//
// Owner directive 2026-11-11 (Cycle 38) · load session + creator
// badges here so the FullLibraryClient can render the shared NEX
// top-bar pattern (cart + global "+" drawer) in place of the
// back-button + "Chat Themes" title.

import type * as React from "react";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { resolveCreatorBadges, EMPTY_EARNED_BADGES } from "@/lib/nex-native/creator/creator-badges";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { FullLibraryClient, type LibraryEntitlementProps } from "../_full-library-client";
import { listBackgroundAssets } from "@/lib/nex-native/library/catalog-service";
import type { LibraryTheme } from "../_catalog";
import {
  canClaimFirstFreeTheme,
  isThemesPlusActive,
  loadThemesPlusUntil,
} from "@/lib/nex-native/library/entitlement-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { getThemesPlusMonthlyForMarket } from "@/lib/nex-native/commercial/themes-plus-pricing";
import type { SupportedRegion } from "@/lib/nex-native/commercial/regional-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-03 · same fix as entry route · route through
// --nex-world-drawer-bg (Emerald on Ireland · navy fallback elsewhere).
const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Owner directive 2026-11-13 · map an ISO-2 country code from
 *  `nex_account_profile.country_code` to a SupportedRegion the pricing
 *  catalogue recognises. Unknown / missing codes return `null` so the
 *  UI falls back to the waitlist CTA (never a USD price). */
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

export default async function FullLibraryPage(): Promise<React.ReactElement> {
  const session = await resolveSessionWithDevOverride();

  const drawerSession: ControlDrawerSession | null = session
    ? {
        displayName: session.account.display_name,
        nexHandle: session.account.nex_handle,
        isBisnis: effectiveTier(session.account) === "bisnis",
      }
    : null;

  const viewerCreatorBadges = session
    ? await resolveCreatorBadges(session.account.id).catch(() => EMPTY_EARNED_BADGES)
    : EMPTY_EARNED_BADGES;

  // Owner directive 2026-11-11 · load ALL 450 unified-library assets
  // (279 shop + 171 chat) so the Full Library picker displays the
  // complete set, matching the shared-library browsing experience.
  // Map each asset into the LibraryTheme shape the client renders.
  const assets = await listBackgroundAssets({ context: "chat" }).catch(() => []);
  const themesRaw: readonly LibraryTheme[] = assets.map((a) => ({
    id: a.id,
    label: a.label,
    wallpaperUrl: a.previewUrl ?? a.storageUrl,
    oneTimePriceEUR: 3.99 as const,
    accentHex: "#C6A15B" as const,
    downloads: 0,
  }));

  // Owner directive 2026-11-11 · in the "All" view, mix shop- and chat-
  // origin assets so a user never sees all-of-one-type-in-a-row. Stable
  // deterministic shuffle keyed on asset id · hydration-safe (server
  // and client produce the identical order because the sort key is
  // pure of random side effects).
  function stableHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }
  const themes: readonly LibraryTheme[] = [...themesRaw].sort(
    (a, b) => stableHash(a.id) - stableHash(b.id),
  );

  // Owner directive 2026-11-13 · resolve Themes+ entitlement state
  // server-side so the client modal can render the correct CTA
  // immediately when a tile is tapped. Parallel reads · all fail-safe.
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

  return (
    <>
      {/* Owner directive 2026-11-03 · no !important so the ≥500px
          country-backdrop rule in nex-native.css paints the Ireland
          desktop studio behind the phone frame on desktop + tablet. */}
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-library-full
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
        />
      </main>
    </>
  );
}
