// src/app/nex-native/themes/[id]/page.tsx
//
// Dynamic theme viewer · Bridge 97g · Founder-set 2026-09-29.
// -------------------------------------------------------------------
// Renders a live sample chat for ANY registered theme id. Reads the
// theme from nex_chat_theme and hands the palette + wallpaper +
// animation config + bubble preset to a client viewer that mounts a
// mock peer chat via PortraitBloomShell.
//
// This is the "just show me what it looks like" surface. Sits next
// to the gallery: gallery = 31 cards at a glance, viewer = one theme
// full-screen.
//
// Static preview pages under this folder (theme-1, pink-dream,
// cyber-grid) take precedence for their ids · this dynamic route
// only fires for the 20-theme batch + any future theme without a
// sealed spec page.
//
// No auth. The viewer uses no-op actions (send/react/delete are all
// preview stubs) so nothing writes to the DB.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { listThemeStickers } from "@/lib/nex-native/theme-sticker-service";
import ThemeViewerClient from "./_viewer";
import { parseJokerMotion } from "./_joker-motion-data";
// Owner directive 2026-10-19 · guests who arrive at a theme
// preview via the welcome page's "Continue NEX Free" primary CTA
// see a floating container banner inviting them to create an
// account. Signed-in viewers never see it.
import { GuestSignupBanner } from "./_guest-signup-banner";
// Owner directive 2026-10-21 (iteration 23) · guest-only overlay ·
// renders the NEX blue-rim ping badge at the top-left avatar area
// so the free chat header reads as "NEX" until the user creates
// an account. Signed-in viewers never mount this overlay.
import { GuestNexAvatarOverlay } from "./_guest-nex-avatar-overlay";
import { HauntedHotelChrome } from "@/components/nex-native/HauntedHotelChrome";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "../../chat-standard/_live-worlds";
import { StandardExperienceLiveClient } from "./_standard-experience-live-client";
import { UniversalChromeOverlay } from "../../chat-standard/_universal-chrome-overlay";
import { UniversalComposerFooter } from "../../chat-standard/_universal-composer-footer";
import { UniversalHeaderIconsOverlay } from "../../chat-standard/_universal-header-icons-overlay";
import { trackThemeView } from "@/lib/nex-native/theme-view-service";
import { getIntroSettings } from "@/lib/nex-native/intro-settings-service";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  effectiveTier,
  isThemesTrialActive,
} from "@/lib/nex-native/account-service";
import { pickPremiumBannerCopy } from "./_premium-banner-copy";
import { ThemePreviewDrawer } from "./_theme-preview-drawer";
import { ThemePreviewRail } from "./_theme-preview-rail";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner-authorised 2026-10-18 · S6 · discreet bottom bar for Use /
// Back · never a modal · respects the sealed 2026-10-11
// "overlay too intrusive" decision.
import { ThemePreviewActionBar } from "./_preview-action-bar";
import { cookies } from "next/headers";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "../../welcome/_welcome-intent";

/** Resolve the server-side `next` URL that the Use-this-theme button
 *  will send users to after `updateChatThemeAction` writes the
 *  theme. Shop-intent → cover-themes-library (the user picks a
 *  cover next). Every other intent (themes · personalised · null ·
 *  tampered) → back to the same theme preview with `?applied=1` so
 *  the preview can render a "Theme applied" toast. Previously
 *  returned `/nex-native/chat/preview` which looped back to this
 *  same URL via the self-chat redirect · the user saw a page
 *  refresh and no visible confirmation. Owner directive 2026-10-19
 *  · break the loop + show a toast. The intent cookie is READ but
 *  NOT cleared here · the welcome page owns the clear lifecycle. */
async function resolveUseThemeNext(themeId: string): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  if (isWelcomeIntent(raw) && raw === "shop") {
    return "/nex-native/cover-themes-library";
  }
  return `/nex-native/themes/${encodeURIComponent(themeId)}?applied=1`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ThemeViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    mode?: string;
    motion?: string;
    shop_setup?: string;
    /** Owner directive 2026-10-19 · set by resolveUseThemeNext after
     *  the Use-this-theme form writes the theme. Renders a floating
     *  "Theme applied" toast on this page. */
    applied?: string;
    /** Owner directive 2026-10-20 · Bisnis setup flow lands here from
     *  the Edit Shop Cover page with ?shop=open · auto-opens the
     *  sealed 5-tile category chooser (Products / Services / Food /
     *  Accommodation / Affiliate). */
    shop?: string;
  }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  // Step 1G · fire-and-forget view tracking so the NEX Space landing's
  // "Popular" row ranks by real activity. Never awaited · the counter
  // is non-fatal and the preview page must stay fast.
  void trackThemeView(id);

  // Standard-Experience-backed worlds short-circuit the DB-driven
  // viewer path · they are code-registered in `_live-worlds.ts` and
  // render the full Standard Experience (header icons + bubbles +
  // composer + shop sheet + call actions + + menu) as the live chat.
  /* Owner directive 2026-10-18 · chat theme previews mount the same
     ControlDrawer used on /welcome + /directory/landing. Resolved up
     here (before the Standard Experience / Haunted Hotel branches) so
     every preview path can mount the drawer as a sibling. Session
     null = guest = sign-in prompt rendered inside the drawer. */
  let drawerSession: ControlDrawerSession | null = null;
  /* Owner directive 2026-10-19 · track the viewer's currently-applied
     chat_theme so the ThemePreviewActionBar can hide the Use-this-
     theme button when the previewed theme is already the active one.
     Guest viewers keep activeChatTheme = null and always see the Use
     button (gated by the sealed account-wall). */
  let activeChatTheme: string | null = null;
  /* Owner directive 2026-10-20 · load the signed-in viewer's own
     saved intro settings so the StandardIntroOverlay can render the
     viewer's personal title + typography on top of the theme intro
     video. Guest viewers / errored loads stay null · the overlay
     then plays the theme intro unmodified. Fail-soft via the service
     layer's EMPTY_INTRO_SETTINGS default. */
  let viewerIntroSettings:
    | Awaited<ReturnType<typeof getIntroSettings>>
    | null = null;
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
      };
      activeChatTheme = sess.account.chat_theme ?? null;
      viewerIntroSettings = await getIntroSettings(sess.account.id).catch(
        () => null,
      );
    }
  } catch {
    // guest · keep drawerSession = null
  }

  // Rule sealed 2026-10-05 · scope: ocean · coffee · botanical-cafe ·
  // midnight-cafe · french-cafe.
  if (isLiveWorldId(id)) {
    const pkg = LIVE_WORLD_PACKAGES[id];
    const isGuest = drawerSession === null;
    const useNext = await resolveUseThemeNext(pkg.identity.id);
    const showAppliedToast = sp.applied === "1";
    /* Owner directive 2026-10-19 · live-world previews now fetch
       themeEmojis + themeStickers for the current theme id · same
       services the DB-driven viewer path already uses · so uploaded
       (or filesystem-fallback) assets appear in the composer picker.
       Catches both DB rows and the built-in catalog in
       theme-asset-fallback.ts. Zero rows + no fallback → empty
       arrays · picker falls back to BASE_EMOJI + engine SVG as
       before. */
    const liveWorldEmojiRows = await listThemeEmojis(pkg.identity.id).catch(
      () => [],
    );
    const liveWorldEmojis = liveWorldEmojiRows.map((row) => ({
      slug: row.slug,
      imageUrl: row.image_url,
      label: row.label,
    }));
    const liveWorldStickerRows = await listThemeStickers(
      pkg.identity.id,
    ).catch(() => []);
    const liveWorldStickers = liveWorldStickerRows.map((row) => ({
      slug: row.slug,
      imageUrl: row.image_url,
      label: row.label,
      stickerType: row.sticker_type,
      aspectRatio: row.aspect_ratio,
    }));
    return (
      <>
        <StandardExperienceLiveClient
          pkg={pkg}
          viewerNexHandle={drawerSession?.nexHandle ?? null}
          themeEmojis={liveWorldEmojis}
          themeStickers={liveWorldStickers}
          userIntroOverlay={viewerIntroSettings}
          initialShopOpen={sp.shop === "open"}
        />
        <ThemePreviewDrawer
          session={drawerSession}
          themeAccent={pkg.colours.primary}
          themeName={pkg.identity.name}
        />
        <ThemePreviewRail
          accent={pkg.colours.primary}
          themeName={pkg.identity.name}
        />
        {/* Owner-authorised 2026-10-18 · S6 · discreet bottom action
            bar · never a modal · "Use this theme" is wrapped in the
            sealed RequireAccount for guests. */}
        <ThemePreviewActionBar
          themeId={pkg.identity.id}
          themeName={pkg.identity.name}
          useThemeNextHref={useNext}
          isGuest={isGuest}
          accentHex={pkg.colours.primary}
          isAlreadyApplied={activeChatTheme === pkg.identity.id}
        />
        {/* Owner directive 2026-10-19 · post-apply success toast ·
            shown only when ?applied=1 is in the URL (set by
            resolveUseThemeNext after the Use-this-theme form writes
            the theme). Breaks the old silent redirect loop so the
            user sees that the action succeeded. Toast tints to the
            theme accent so it reads as part of the applied theme
            and not foreign chrome. */}
        {showAppliedToast ? (
          <ThemeAppliedToast
            themeName={pkg.identity.name}
            accentHex={pkg.colours.primary}
          />
        ) : null}
        {/* Owner directive 2026-10-19 · "Create Account to activate
            your free NEX Chat" banner shown only to guest viewers.
            Signed-in users already have an account · gating here
            keeps the message honest. */}
        {isGuest ? <GuestSignupBanner /> : null}
        {isGuest ? <GuestNexAvatarOverlay /> : null}
      </>
    );
  }

  // The Haunted Hotel preview IS the depth-cards experience that the
  // founder spent 6 hours building: card carousel + atmosphere +
  // smoke + FX controller. Route this theme's preview URL directly at
  // that surface so there's one source of truth for the Haunted Hotel
  // chat look, instead of trying to replicate it in two places.
  if (id === "haunted-hotel") {
    redirect("/nex-native/chat/prototypes/hauntedhoteltheme");
  }

  const theme = await chatThemeService.getThemeById(id);
  if (!theme || !theme.is_active) notFound();

  // Bridge 97g · pre-compute sample message timestamps on the SERVER
  // so SSR and client hydration see identical ISO strings. Calling
  // Date.now() inside the client viewer produced a hydration mismatch
  // because server-render time and client-hydrate time drift by
  // 100-300ms. Passing them as props locks the values.
  const now = Date.now();
  const sentAts = {
    m1: new Date(now - 9 * 60_000).toISOString(),
    m2: new Date(now - 8 * 60_000).toISOString(),
    m3: new Date(now - 6 * 60_000).toISOString(),
    m4: new Date(now - 4 * 60_000).toISOString(),
    m5: new Date(now - 1 * 60_000).toISOString(),
    readEarly: new Date(now - 7 * 60_000).toISOString(),
    readMid: new Date(now - 5 * 60_000).toISOString(),
    readLate: new Date(now - 3 * 60_000).toISOString(),
  };

  // Preview-mode shop · defaults to product mode. `?mode=menu` on
  // the URL flips isVenue so the header icon becomes cutlery and
  // the slider header reads "Menu". Same data structure otherwise.
  const isVenueMode = sp.mode === "menu";
  const motionVariant = parseJokerMotion(sp.motion);
  // Sealed 2026-10-01 · default-ON in the theme preview so the
  // founder sees the 3-button chooser (Sell Products / Sell Food /
  // Affiliate) the moment they tap the Shop icon. Explicit opt-out
  // via `?shop_setup=0` falls through to the mock products grid.
  const showShopSetupChooser = sp.shop_setup !== "0";

  // Bridge ThemeEmoji-B · load this theme's emoji set (if any) so
  // the composer emoji picker paints the theme's tiles instead of
  // the default 40-emoji hardcoded array.
  const themeEmojiRows = await listThemeEmojis(theme.id).catch(() => []);
  const themeEmojis = themeEmojiRows.map((row) => ({
    slug: row.slug,
    imageUrl: row.image_url,
    label: row.label,
  }));

  // Bridge ThemeSticker · sealed 2026-10-01 · load this theme's
  // sticker set (if any) so the composer exposes the dedicated
  // Stickers tab. See Migration 118 + theme-sticker-service.ts.
  const themeStickerRows = await listThemeStickers(theme.id).catch(() => []);
  const themeStickers = themeStickerRows.map((row) => ({
    slug: row.slug,
    imageUrl: row.image_url,
    label: row.label,
    stickerType: row.sticker_type,
    aspectRatio: row.aspect_ratio,
  }));

  // Honest premium banner · sealed 2026-10-14 · bounded addition.
  //
  // Shown ONLY when the theme is category='premium' AND the viewer
  // cannot activate it today. The copy is sourced from
  // _premium-banner-copy.ts (pure helper with its own test suite,
  // including the forbidden-phrase guard that fails the build if a
  // future refactor silently claims payment works). Direct theme
  // purchase is NOT available · migrations 191–196 are drafts.
  // Service-role reads of nex_chat_theme (nexSupabaseAdmin) make
  // the theme row visible regardless of RLS, which is correct for
  // the viewer preview path.
  const viewer = await resolveNexAppSessionOrGuest();
  const canUsePremium =
    viewer.kind === "session" &&
    (effectiveTier(viewer.session.account) === "bisnis" ||
      effectiveTier(viewer.session.account) === "pro" ||
      isThemesTrialActive(viewer.session.account));
  const premiumBanner = pickPremiumBannerCopy({
    viewerKind: viewer.kind,
    category: theme.category,
    canUsePremium,
  });

  /* drawerSession already resolved above the Standard Experience
     early-return · used here for the viewer path. */

  return (
    <>
      {premiumBanner ? (
        <div
          data-nex-themes-premium-banner
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 6,
            maxWidth: 420,
            width: "calc(100vw - 24px)",
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(2, 9, 20, 0.78)",
            border: "1px solid rgba(0, 175, 255, 0.42)",
            boxShadow:
              "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 24px rgba(0, 175, 255, 0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#F2F5F8",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          role="region"
          aria-label="Premium theme information"
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "#00AFFF",
            }}
          >
            {premiumBanner.eyebrow}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {premiumBanner.headline}
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.4,
              color: "#B5C3D6",
            }}
          >
            {premiumBanner.subheading}
          </div>
          <Link
            href={premiumBanner.ctaHref}
            style={{
              marginTop: 4,
              alignSelf: "flex-start",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#FF7200",
              textDecoration: "none",
            }}
          >
            {premiumBanner.ctaLabel} →
          </Link>
        </div>
      ) : null}
      <ThemeViewerClient
        themeId={theme.id}
        themeName={theme.name}
        /* Owner directive 2026-10-18 · subtitle is the theme's own
           tagline · per-theme copy from nex_chat_theme.tagline ·
           null hides the subline row. Retired the hardcoded
           "Photographer" fallback. */
        subtitle={theme.tagline ?? null}
        accent={theme.accent_hex}
        bubbleRim={theme.bubble_rim_hex ?? theme.accent_hex}
        composerRim={theme.composer_rim_hex ?? theme.accent_hex}
        wallpaperUrl={theme.hero_image_url}
        wallpaperConfig={theme.wallpaper_config}
        layoutStyle={theme.layout_style}
        sentAts={sentAts}
        isVenueMode={isVenueMode}
        showShopSetupChooser={showShopSetupChooser}
        themeEmojis={themeEmojis}
        themeStickers={themeStickers}
        motionVariant={motionVariant}
      />
      {/* Haunted Hotel chrome · atmosphere + smoke + FX controller.
          Mounted as a sibling of the viewer so the server-rendered
          Atmosphere layer can flow in from a server parent (viewer
          itself is a client component). Chrome's 10 FX toggles ship
          OFF by default · discoverable via the floating 3-dots. */}
      {theme.id === "haunted-hotel" && <HauntedHotelChrome />}
      {/* UNIVERSAL HEADER ICONS OVERLAY · sealed R11b 2026-10-05 ·
          R1 parity · Home/Cart/Shop. PortraitBloomShell's native
          HeaderRightCluster is tagged `data-nex-native-r1-cluster`
          and gets suppressed by this overlay's CSS so there is
          exactly one R1 implementation on every legacy theme route. */}
      <UniversalHeaderIconsOverlay accent={theme.accent_hex} />
      {/* UNIVERSAL CHROME OVERLAY · sealed 2026-10-05 · every live
          theme including Joker · Joker's native dancing-dots is
          hidden by the UniversalComposerFooter CSS block so the
          universal 3-dots becomes the sole lower-right affordance. */}
      <UniversalChromeOverlay accent={theme.accent_hex} />
      {/* Sealed 2026-10-11 · UniversalComposerFooter was previously
          mounted here as a sibling · now owned by ThemeViewerClient
          (above) so the overlay's Send button has a working
          onSendMessage callback that appends to the preview message
          list. Removing the duplicate mount keeps the composer as
          a single instance per route. */}
      {/* Owner directive 2026-10-18 · Home button replaced by the
          shared ControlDrawer (same drawer on /welcome +
          /directory/landing). Mounted as a sibling of the chat
          chrome · hides the native Home via a scoped CSS block and
          positions its 3-dot trigger in the Home-slot. */}
      <ThemePreviewDrawer
        session={drawerSession}
        themeAccent={theme.accent_hex}
        themeName={theme.name}
      />
      <ThemePreviewRail
        accent={theme.accent_hex}
        themeName={theme.name}
        isVenue={isVenueMode}
      />
      {/* Owner-authorised 2026-10-18 · S6 · discreet bottom action
          bar · "Use this theme" wrapped in the sealed RequireAccount
          for guests. Routed to cover-themes-library for shop intent
          via the server-resolved useNext computed below. */}
      <ThemePreviewActionBar
        themeId={theme.id}
        themeName={theme.name}
        useThemeNextHref={await resolveUseThemeNext(theme.id)}
        isGuest={viewer.kind === "guest"}
        accentHex={theme.accent_hex}
        isAlreadyApplied={
          viewer.kind === "session" &&
          viewer.session.account.chat_theme === theme.id
        }
      />
      {/* Owner directive 2026-10-19 · post-apply success toast on the
          DB-driven viewer path, mirroring the live-world branch.
          Tints to the theme accent so it visually belongs to the
          applied theme. */}
      {sp.applied === "1" ? (
        <ThemeAppliedToast
          themeName={theme.name}
          accentHex={theme.accent_hex}
        />
      ) : null}
    </>
  );
}

/** Owner directive 2026-10-19 · floating "Theme applied" toast ·
 *  rendered when ?applied=1 is on the URL. Server component ·
 *  no interactivity · the toast fades out via a CSS animation and
 *  the user clears it by navigating away. Positioned above the
 *  sealed ThemePreviewActionBar at bottom so it reads as a
 *  confirmation of the button they just pressed. Tints to the
 *  theme's own accent colour so it visually belongs to the applied
 *  theme (owner directive 2026-10-19 · "must be same color as
 *  theme color"). */
function ThemeAppliedToast({
  themeName,
  accentHex,
}: {
  themeName: string;
  accentHex: string;
}) {
  return (
    <>
      <style>{`
        @keyframes nex-theme-applied-toast-in {
          0%   { opacity: 0; transform: translate(-50%, 12px); }
          12%  { opacity: 1; transform: translate(-50%, 0); }
          80%  { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, 6px); }
        }
      `}</style>
      <div
        data-nex-theme-applied-toast
        data-nex-theme-applied-toast-accent={accentHex}
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          left: "50%",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 148px)",
          transform: "translate(-50%, 0)",
          zIndex: 500,
          maxWidth: 360,
          width: "calc(100vw - 48px)",
          padding: "10px 16px",
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.92)",
          border: `1px solid ${accentHex}`,
          color: accentHex,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          textAlign: "center",
          boxShadow: `0 10px 28px rgba(0, 0, 0, 0.55), 0 0 24px ${accentHex}55`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          pointerEvents: "none",
          animation: "nex-theme-applied-toast-in 4000ms ease forwards",
        }}
      >
        {themeName} applied as your chat theme
      </div>
    </>
  );
}
