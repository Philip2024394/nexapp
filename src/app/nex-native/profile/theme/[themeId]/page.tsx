// src/app/nex-native/profile/theme/[themeId]/page.tsx
//
// NEX themed-profile route · owner-approved 2026-10-18.
// --------------------------------------------------------------------
// Renders a profile surface that represents a CHAT THEME (not a real
// person or account). Used as the destination for the chat-header
// avatar tap on a theme preview · lets the viewer explore the theme's
// identity (name, wallpaper, tagline, accent) in a familiar profile
// layout WITHOUT any personal-account coupling.
//
// Hard rules:
//   · The theme is NOT treated as a real account. Personal-account
//     affordances (Connect, Message, Edit, Camera-upload, Safe Trade)
//     are OMITTED entirely · they would fire server actions against a
//     theme id as if it were a person.
//   · Theme data is resolved from the REAL theme sources · no mock /
//     parallel identity system. Code-registered worlds come from
//     `LIVE_WORLD_PACKAGES` · DB-backed themes come from
//     `chatThemeService.getThemeById()`. Invalid / unknown theme ids
//     fall through to `notFound()` · never silently substituted.
//   · Avatar + display name must match the chat-header derivation
//     byte-for-byte so the viewer sees continuity from chat → profile:
//       - name: pkg.identity.name  OR  theme.name
//       - avatar + cover: pkg.wallpaperUrl  OR  theme.hero_image_url
//       - tagline: pkg.identity.tagline  OR  theme.tagline
//       - accent: pkg.colours.primary  OR  theme.accent_hex
//     This mirrors `_standard-experience-live-client.tsx:149` and
//     `_viewer.tsx:392` exactly.
//
// Reuses only the 5 presentation components flagged SAFE in the
// 2026-10-18 architecture audit · zero edits to those components:
//
//   · ProfileChrome   · top chrome bar (viewer identity + drawer)
//   · CoverPhoto      · wallpaper hero with smile-clip
//   · IdentityHero    · theme name + tagline + wallpaper avatar
//   · InterestsPills  · empty · hides itself when no interests
//   · MutualFriends   · count=0 · returns null
//
// Server Component.

import { notFound } from "next/navigation";
import * as React from "react";
import { CoverPhoto } from "../../[handle]/_cover-photo";
import { IdentityHero } from "../../[handle]/_identity-hero";
import { InterestsPills } from "../../[handle]/_interests-pills";
import { MutualFriends } from "../../[handle]/_mutual-friends";
import { ProfileChrome } from "../../[handle]/_profile-chrome";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "../../../chat-standard/_live-worlds";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  params: Promise<{ themeId: string }>;
}

/* Resolved theme identity · the narrow set of fields the themed
 * profile actually needs. Isolated here so the two source paths
 * (ThemePackage · nex_chat_theme row) normalise into the same shape
 * before rendering. */
interface ResolvedThemeIdentity {
  readonly id: string;
  readonly name: string;
  readonly tagline: string | null;
  readonly wallpaperUrl: string | null;
  readonly accentHex: string;
}

/** Resolve a themeId against the two real theme sources · same split
 *  that `/nex-native/themes/[id]/page.tsx` uses (isLiveWorldId first ·
 *  else DB). Returns null for unknown / inactive themes · the caller
 *  then falls through to notFound(). */
async function resolveTheme(
  themeId: string,
): Promise<ResolvedThemeIdentity | null> {
  // Reject obviously bad ids before touching any service. Theme ids
  // in the DB and in LIVE_WORLD_PACKAGES all match [a-z0-9][a-z0-9-]{0,60}
  // in practice · keep the regex permissive so legitimate ids pass.
  if (!themeId || !/^[a-z0-9][a-z0-9_-]{0,80}$/.test(themeId)) return null;

  // Code-registered Standard Experience world (identity-first path).
  if (isLiveWorldId(themeId)) {
    const pkg = LIVE_WORLD_PACKAGES[themeId];
    return {
      id: pkg.identity.id,
      name: pkg.identity.name,
      tagline: pkg.identity.tagline?.trim() || null,
      wallpaperUrl: pkg.wallpaperUrl ?? null,
      accentHex: pkg.colours.primary,
    };
  }

  // DB-backed theme row. getThemeById returns null for missing +
  // service-level errors are caught upstream · we just translate the
  // row shape here.
  try {
    const theme = await chatThemeService.getThemeById(themeId);
    if (!theme || !theme.is_active) return null;
    return {
      id: theme.id,
      name: theme.name,
      tagline: (theme.tagline ?? "").trim() || null,
      wallpaperUrl: theme.hero_image_url ?? null,
      accentHex: theme.accent_hex,
    };
  } catch {
    return null;
  }
}

/* Strict #RRGGBB validator so the accentHex we trust in style attrs
 * is guaranteed hex · never a user-supplied string that could carry
 * a style-injection payload. Mirrors the parseThemeAccent helper on
 * the canonical profile page. */
function sanitiseHex(raw: string): string {
  const trimmed = raw.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : "#00AFFF";
}

export default async function ThemeProfilePage({ params }: PageProps) {
  const { themeId: rawThemeId } = await params;
  const themeId = (rawThemeId ?? "").trim().toLowerCase();

  // Resolve against REAL theme data. Null → 404.
  const theme = await resolveTheme(themeId);
  if (!theme) notFound();

  const accent = sanitiseHex(theme.accentHex);

  // Session resolution for the top chrome bar · same pattern as
  // canonical profile. Failure resolves as anonymous · never blocks
  // first paint. The themed profile does NOT impersonate the viewer ·
  // the chrome still shows the viewer's own identity + drawer so they
  // can navigate out via the sealed app menu.
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  let drawerSession: ControlDrawerSession | null = null;
  if (session) {
    drawerSession = {
      displayName: session.account.display_name,
      nexHandle: session.account.nex_handle,
      isBisnis: effectiveTier(session.account) === "bisnis",
    };
  }

  /* Theme-accent CSS var + top-of-page gradient · same pattern as the
   * canonical profile page so retinted components (ProfileChrome ·
   * IdentityHero's accent icons · InterestsPills heading) inherit the
   * theme colour from one declaration site. */
  const mainStyle: React.CSSProperties = {
    position: "relative",
    minHeight: "100dvh",
    background: `linear-gradient(180deg, ${accent}44 0%, ${accent}22 180px, ${NEX.bg} 400px, ${NEX.bg} 100%)`,
    color: NEX.text,
    fontFamily: SANS,
    display: "flex",
    flexDirection: "column",
    paddingBottom: 32,
    ["--nex-profile-accent" as unknown as string]: accent,
  };

  return (
    <main
      data-nex-profile-root
      data-nex-profile-mode="theme"
      data-nex-profile-theme-id={theme.id}
      data-nex-profile-themed="true"
      style={mainStyle}
    >
      {/* 4px theme-coloured strip at top · identical to the canonical
          profile's themed-arrival indicator. Reads as "you are inside
          the <Theme> identity surface" at a glance. */}
      <div
        data-nex-profile-theme-strip
        aria-hidden
        style={{
          height: 4,
          width: "100%",
          background: `linear-gradient(90deg, ${accent}, ${accent}aa, ${accent})`,
          boxShadow: `0 2px 12px ${accent}66`,
          flexShrink: 0,
        }}
      />

      {/* Viewer's own identity at the top (NOT the theme's) · same
          chrome every nex-native route shows. Drawer gives the viewer
          a way out via the sealed app menu. */}
      <ProfileChrome
        viewerAvatarUrl={null}
        viewerDisplayName={session?.account.display_name ?? null}
        viewerNexHandle={session?.account.nex_handle ?? null}
        drawerSession={drawerSession}
      />

      {/* Hero = theme wallpaper. Non-owner · no camera-upload
          affordance. CoverPhoto renders the sealed NEX gradient when
          wallpaperUrl is null (atmospheric themes without a hero
          image) · never fabricates a photo. */}
      <CoverPhoto coverImageUrl={theme.wallpaperUrl} isOwner={false} />

      {/* Owner directive 2026-10-18 · visible "CHAT THEME" eyebrow
          immediately above the theme identity. Makes the subject of
          this profile unambiguous (not the signed-in viewer's own
          profile). Uses existing NEX eyebrow conventions · 11px /
          0.22em letter-spacing / uppercase / weight 700 · same shape
          used by SectionTitle on themes marketplace and the drawer
          section headers (YOUR NEX / YOUR BUSINESS). Colour inherits
          the profile accent via --nex-profile-accent so it ties to
          the 4px strip + chrome on the themed route · falls back to
          the sealed cyan on direct no-param visits.
          Accessibility · source order places this text BEFORE
          IdentityHero's <h1> {theme.name} so screen readers announce
          "chat theme · {theme.name}" naturally · no sr-only
          duplication · no second h1. */}
      <div
        data-nex-profile-theme-eyebrow
        style={{
          margin: "12px 14px 0",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: `var(--nex-profile-accent, #00AFFF)`,
          fontFamily: SANS,
        }}
      >
        Chat Theme
      </div>

      {/* Theme identity: name on top line · tagline as bio · avatar is
          a crop of the same wallpaper used as the cover (byte-for-byte
          match with the chat header derivation). nexHandle null · the
          theme is NOT a real NEX account. profession = NULL ·
          locationLabel = NULL · headline = NULL · isOwner = false ·
          isVerified = false (never claim verification for a theme).
          IdentityHero renders the semantic <h1> {displayName} · this
          is the profile's primary heading · the "CHAT THEME" eyebrow
          above provides visible + source-order context without
          introducing a duplicate h1. */}
      <IdentityHero
        displayName={theme.name}
        nexHandle={null}
        avatarUrl={theme.wallpaperUrl}
        profession={null}
        headline={null}
        locationLabel={null}
        bio={theme.tagline}
        isOwner={false}
        isVerified={false}
      />

      {/* Shared Interests · empty · the component returns null when
          interests is empty AND isOwner is false. Mounted so the
          structural shell matches the canonical profile · the retint
          heading colour inherits --nex-profile-accent when present. */}
      <InterestsPills interests={[]} isOwner={false} />

      {/* Mutual friends · count 0 · the component returns null. */}
      <MutualFriends count={0} preview={[]} />

      {/* Deliberately NOT mounted (per audit):
          · ActionButtons           · Connect/Message would fire
                                      sendFriendInviteAction against
                                      a theme id as if it were a person
          · OwnerEditShell          · fires savePersonalProfileAction
                                      against the signed-in account
          · CoverCameraPicker       · uploads to account
          · SafeTradeCard / icon    · requires real business + real
                                      account for the report flow */}
    </main>
  );
}
