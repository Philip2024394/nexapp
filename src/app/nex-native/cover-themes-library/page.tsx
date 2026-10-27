// src/app/nex-native/cover-themes-library/page.tsx
//
// NEX Cover Themes Library · owner-authorised 2026-10-18.
// --------------------------------------------------------------------
// A library/discovery surface for the 10 sealed Cover templates.
// Modelled on the Chat Themes Library (`/nex-native/chat-themes-
// library`) but each tile renders inside a scaled-down phone-shaped
// frame so visitors see the WHOLE catalogue as mini phone screens
// at a glance.
//
// Each card has:
//   · A mini phone silhouette with a LIVE iframe showing the sealed
//     /nex-native/cover/preview/{layoutId}?theme=… route rendered at
//     native phone size, scaled down to fit.
//   · The template number + display name + one-line blurb.
//   · "Open design" link → the full phone-frame preview.
//   · "Share" button (client) → Web Share API with clipboard fallback,
//     uses the sealed share href `/nex-native/cover/preview/{layoutId}`.
//
// A theme dropdown at the top flows a `?theme=` query into every
// tile's iframe + share href, so the whole gallery repaints under
// a different chat_theme in one submit.
//
// This is a preview-only surface · no auth · no DB writes.

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { COVER_LAYOUT_IDS, COVER_LAYOUT_LABELS } from "../cover/layout-ids";
import type { CoverLayoutId } from "../cover/layout-ids";
import { MiniPhoneFrame } from "./_mini-phone-frame";
// Owner directive 2026-10-18 · header mirrors Welcome's identity row:
// NexPingBadge on the left + shared ControlDrawer (3-dots) on the right.
// Same imports, same session-resolution pattern · the sealed drawer is
// used across every NEX surface so this page is not forking the
// drawer UX.
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  border: "rgba(139, 169, 209, 0.14)",
};

/** One-line description of each template · copied from the sealed
 *  /nex-native/cover/preview gallery so both surfaces stay in sync.
 *  If/when the sealed gallery adds an exported record, swap this
 *  literal for the import. */
const COVER_LAYOUT_BLURB: Record<CoverLayoutId, string> = {
  cafe:
    "Portrait-half hero · products grid · Visit Us panel with Google Maps directions",
  cafe_landscape:
    "Same identity as Café · landscape product cards · 6 per page",
  cafe_round:
    "Same identity as Café · round product cards · name below · magnifier on rim",
  product:
    "Compact identity · Who-We-Are · shop grid · dispatch times",
  product_landscape:
    "Same identity as Product Seller · landscape product cards · 6 per page",
  product_round:
    "Same identity as Product Seller · round product cards · name below · magnifier on rim",
  product_landscape_round:
    "Cloned from Product Landscape · round product cards · name below · magnifier on rim",
  personal_brand:
    "Round-portrait hero · Our Journey story · Products/Images/Sizes/Ordering tabs · Visit Us",
  personal_brand_landscape:
    "Same identity as Personal Brand · landscape product cards · 6 per page",
  personal_brand_round:
    "Same identity as Personal Brand · round product cards · name below · magnifier on rim",
  accommodation:
    "Hero image · suite grid · amenities row · check-in/out · Visit Us",
};

const DEFAULT_THEME = "pink-dream";

export default async function CoverThemesLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ theme?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};

  // Owner directive 2026-10-20 · drawer session resolved early so the
  // viewer's own chat_theme can be used as the default preview theme
  // inside every mini-phone tile (the ?theme= query still wins when
  // present). The PAGE background itself stays on the sealed Neon
  // Earth asset shared with the Chat Themes Library · only the
  // per-tile preview inherits the chat theme.
  let drawerSession: ControlDrawerSession | null = null;
  let viewerChatThemeId: string | null = null;
  // Owner directive 2026-10-20 · the NexPingBadge in the shop-themes
  // library header paints the viewer's chat-theme image (e.g. Crispy
  // Chicken wallpaper) · same image used on the chat preview surface
  // so the shop-themes library reads as a continuation of the chat
  // world. Null (no live-world theme / guest) falls back to the
  // sealed "NEX" wordmark.
  let viewerChatThemeImageUrl: string | null = null;
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      viewerChatThemeId = sess.account.chat_theme ?? null;
      // Owner directive 2026-10-20 · resolve the live-world chat
      // theme wallpaper once · reused by (a) the drawer identity-bar
      // thumbnail and (b) the header NexPingBadge (both show the
      // same chat theme image · one visual thread across both
      // identity surfaces). Guest / DB-driven theme / unset all
      // fall through to null.
      const chatThemeId = viewerChatThemeId ?? undefined;
      if (isLiveWorldId(chatThemeId)) {
        const pkg = LIVE_WORLD_PACKAGES[chatThemeId] as unknown as {
          wallpaperUrl?: string | null;
        };
        viewerChatThemeImageUrl = pkg.wallpaperUrl ?? null;
      }
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
        activeChatThemeImageUrl: viewerChatThemeImageUrl,
      };
    }
  } catch {
    // guest · keep drawerSession = null
  }

  const themes = await chatThemeService.listActiveThemes().catch(() => []);
  // Owner directive 2026-10-20 · Resolution order:
  //   ?theme= query → viewer's chat_theme → sealed DEFAULT_THEME.
  // The viewer's chat_theme is honoured when it is EITHER an active
  // DB-driven chat_theme row OR a live-world package id (code-based
  // themes like "crispy-chicken" aren't rows in nex_chat_theme ·
  // the iframe target `/nex-native/cover/preview/{layoutId}?theme=X`
  // reads the same union). Guards against stale / deleted ids.
  const viewerThemeIsHonourable =
    viewerChatThemeId !== null &&
    (themes.some((t) => t.id === viewerChatThemeId) ||
      isLiveWorldId(viewerChatThemeId));
  const themeId =
    sp.theme ??
    (viewerThemeIsHonourable && viewerChatThemeId
      ? viewerChatThemeId
      : DEFAULT_THEME);
  const currentTheme = themes.find((t) => t.id === themeId) ?? null;

  // Owner directive 2026-10-18 · attach a per-render cache-bust to
  // every iframe URL so a browser or service worker that cached the
  // pre-embed response can't win against a dev edit. `force-dynamic`
  // already runs this function fresh on each request · the value
  // changes every visit.
  const renderCacheBust = Date.now().toString(36);


  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        /* Hide scrollbar on the vertical pager · owner directive
           2026-10-18 · one phone per swipe looks cleaner without
           a scrollbar rail. */
        [data-nex-cover-themes-library] { scrollbar-width: none; -ms-overflow-style: none; }
        [data-nex-cover-themes-library]::-webkit-scrollbar { width: 0; height: 0; display: none; }
      `}</style>
      {/* Owner directive 2026-10-20 · background matches the Chat
          Themes Library ("Neon Earth on a Starry Horizon") so the
          two theme-library surfaces read as one world. Position
          switched from `fixed` + `100vw/100dvh` → `absolute` +
          `100%/100dvh` so the image stays INSIDE the sealed
          .nex-native-frame on desktop (420×909 phone frame) instead
          of escaping to the full desktop viewport.
          Previous asset `electric-blue-bg.png` retired. */}
      <img
        src="/nex-native/contacts/neon-earth-bg.png"
        alt=""
        aria-hidden
        data-nex-cover-themes-bg-image
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100dvh",
          objectFit: "cover",
          objectPosition: "top center",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      <main
        data-nex-cover-themes-library
        style={{
          position: "relative",
          minHeight: "100dvh",
          height: "100dvh",
          // Transparent so the fixed background image shows through.
          // Was `NEX.bg` which painted an opaque navy over the
          // background on every surface except where content sits.
          background: "transparent",
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 0,
          overflowX: "hidden",
          overflowY: "auto",
          // Prevent iOS/Chromium rubber-band bounce from pulling the
          // next-page scroll chain or leaking past the pager edges.
          overscrollBehavior: "contain",
          // Owner directive 2026-10-18 · one phone per swipe up/down.
          // Each phone tile sets `scroll-snap-align: center` so the
          // scroller lands on one phone at a time, but the snap type
          // is `proximity` (not `mandatory`) so the browser does NOT
          // force an initial snap on page-load · the hero + header
          // at the top of the page stay visible until the user
          // chooses to swipe past them.
          scrollSnapType: "y proximity",
          scrollBehavior: "smooth",
          // Lift the content layer above the fixed background.
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1240,
            margin: "0 auto",
            // Padding moved here from <main> so the full-bleed
            // background image stays flush with the viewport edge.
            padding: "24px 20px 48px",
          }}
        >
          {/* Header · owner directive 2026-10-18 · match the Welcome
              identity row · NexPingBadge on the left (profile+ping),
              shared ControlDrawer (3 dots) on the right. */}
          <header
            data-nex-cover-themes-header
            style={{
              marginBottom: 22,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <NexPingBadge
              size={56}
              accent={NEX.cyan}
              dataTestId="cover-themes-nex"
              avatarUrl={viewerChatThemeImageUrl}
            />
            {/* Right side of top row · drawer only. Title block
                moves below so it can run full-width across the hero. */}
            <div style={{ flex: 1 }} />
            <div
              data-nex-cover-themes-header-drawer-slot
              style={{
                display: "flex",
                alignItems: "center",
                position: "relative",
                zIndex: 3,
              }}
            >
              <ControlDrawer session={drawerSession} />
            </div>
          </header>

          {/* Owner directive 2026-10-18 · title block drops BELOW the
              identity row so the heading + description get the full
              hero width. Nudged down a little from the row for
              breathing room. */}
          <section
            data-nex-cover-themes-hero
            style={{
              marginTop: 18,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              NEX Cover · Library
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              NEX Face
            </h1>
            <p
              style={{
                marginTop: 10,
                color: NEX.textDim,
                fontSize: 14,
                lineHeight: 1.55,
                // Full-width hero description · owner directive
                // 2026-10-18 · no maxWidth constraint so the copy
                // spans the hero.
              }}
            >
              Choose your online shopfront · share the link on social
              media, or connect a domain for live Google search.
            </p>
            {/* Current theme swatch kept as a small indicator ·
                sealed theme picker form (APPLY button + dropdown)
                removed per owner directive 2026-10-18. The library
                stays on `?theme=` for ad-hoc overrides. */}
            {currentTheme && (
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: NEX.textDim,
                  fontWeight: 600,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: currentTheme.accent_hex,
                    boxShadow: `0 0 8px ${currentTheme.accent_hex}55`,
                    border: `1px solid ${currentTheme.accent_hex}`,
                  }}
                />
                {/* 2026-10-27 · NexChatThemeRow exposes `name` (not
                    `display_name`); the schema field was renamed /
                    never had a display_name alias (see
                    `src/lib/nex-native/chat-theme-service.ts:21`). */}
                <span>Theme · {currentTheme.name}</span>
              </div>
            )}
          </section>

          {/* Owner directive 2026-10-18 · one phone per swipe up/down.
              The grid is a single-column vertical rail of reduced-size
              phones (280px wide), each scroll-snapped so the viewport
              lands cleanly on one cover per swipe. The main scroller
              is the <main> element (set below via scrollSnapType).
              Mobile and desktop share the same rail · desktop just
              shows the extra viewport margin on either side. */}
          <div
            data-nex-cover-themes-grid
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 32,
              paddingBottom: 48,
            }}
          >
            {COVER_LAYOUT_IDS.map((id) => {
              // Owner directive 2026-10-18 · the mini preview must
              // only show the theme (no header chrome). We pass
              // `embed=1` so the sealed /cover/preview/[layoutId]
              // page hides its own back-link / template number / APPLY
              // header.
              //
              // Cache-bust · dev-mode browsers (and the NEX service
              // worker's HTTP cache layer) sometimes retain the
              // chrome-included response from before the embed flag
              // existed. Attaching `v=<renderTime>` forces a fresh
              // fetch on every library view · harmless in production
              // (dynamic routes are not CDN-cacheable) and keeps
              // dev previews honest.
              const cacheBust = renderCacheBust;
              const previewHref = `/nex-native/cover/preview/${id}?theme=${encodeURIComponent(themeId)}&embed=1&v=${cacheBust}`;
              const label = COVER_LAYOUT_LABELS[id];
              return (
                <article
                  key={id}
                  data-nex-cover-theme-card
                  data-nex-cover-theme-layout={id}
                  style={{
                    position: "relative",
                    width: 240,
                    scrollSnapAlign: "center",
                    scrollSnapStop: "always",
                  }}
                >
                  <Link
                    href={previewHref}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: NEX.text,
                    }}
                    aria-label={`Open ${label} preview`}
                  >
                    <MiniPhoneFrame
                      previewHref={previewHref}
                      frameWidth={240}
                      label={`${label} cover preview`}
                    />
                  </Link>
                  {/* Owner directive 2026-10-20 · each tile carries
                      TWO buttons · View (full-screen preview · same
                      target as the tile tap) + Edit (opens the
                      /edit/[layoutId] route where the Bisnis owner
                      can replace the shop background image and set
                      the theme colour · persists to nex_business
                      shop_cover_image_url + shop_cover_tint_hex). */}
                  <div
                    data-nex-cover-theme-card-actions
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    <Link
                      href={`/nex-native/cover/preview/${id}?theme=${encodeURIComponent(themeId)}`}
                      data-nex-cover-theme-view
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "9px 10px",
                        borderRadius: 10,
                        background: "transparent",
                        border: `1.5px solid ${NEX.cyan}`,
                        color: NEX.cyan,
                        fontSize: 11.5,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        textDecoration: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      View theme
                    </Link>
                    <Link
                      href={`/nex-native/cover-themes-library/edit/${id}`}
                      data-nex-cover-theme-edit
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "9px 10px",
                        borderRadius: 10,
                        background: NEX.cyan,
                        color: "#021424",
                        border: "none",
                        fontSize: 11.5,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        textDecoration: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      Edit theme
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Footer doctrine note · matches the sealed /cover/preview
              gallery's footer so the two surfaces read as siblings. */}
          <div
            style={{
              marginTop: 32,
              padding: "14px 16px",
              borderRadius: 12,
              border: `1px dashed ${NEX.border}`,
              fontSize: 12,
              color: NEX.textDim,
              lineHeight: 1.6,
              maxWidth: 820,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <strong style={{ color: NEX.text }}>Doctrine.</strong> The
            layout provides information architecture. The theme
            (chat_theme) provides visual identity. The owner&apos;s
            content provides personality. Share link is the sealed
            cover preview URL · opens on any device.
          </div>
        </div>
      </main>
    </>
  );
}
