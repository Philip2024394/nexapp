// src/app/nex-native/[businessSlug]/page.tsx
//
// NEX Shop · public visitor landing for a seller's business.
// ----------------------------------------------------------
// This is what a visitor sees when they follow a philip.nex or
// aisha-vintage-cameras.nex link from an Instagram bio / QR code /
// share URL. Founder direction 2026-09-27: "highest quality possible
// shop page for sellers".
//
// Aesthetic:
//   · Dark navy #020914 canvas · matches the NEX Chat identity
//   · Serif display for the business name + product headlines ·
//     editorial, magazine-quality read
//   · Rich full-bleed hero with the seller's photo · cinematic
//   · 1-column product feed with big photos (up to 640px wide) ·
//     each item reads as its own editorial spread, not a table row
//   · Chat CTA anchored to the bottom as the primary conversion ·
//     the whole page funnels toward "start the conversation"
//
// Zero legacy chrome: no SKU column, no idempotency inputs, no
// inline order forms · commerce happens inside chat per doctrine.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
// Phase A1 · accommodation listings (owner-authorised 2026-10-21).
// Rooms persist via migration 213 · `listLiveAvailableRoomsByBusiness`
// is the customer-safe filter (status='live' AND is_available=true).
// Owner-only management lives under /nex-native/manage/accommodation.
import * as accommodationService from "@/lib/nex-native/accommodation-service";
import * as accountService from "@/lib/nex-native/account-service";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";
import { BusinessThumbnailRow } from "./_business-thumbnail-row";
import * as menuService from "@/lib/nex-native/menu-service";
import * as sellerResponsivenessService from "@/lib/nex-native/seller-responsiveness-service";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isMenuFirstCategory } from "@/lib/nex-native/site-templates";
import { HeroSidePanel } from "./_hero-side-panel";
import { FloatingChatButton } from "./_floating-chat-button";
import { toggleLikeProductAction } from "../_actions";
import { AddToCartButton } from "../_add-to-cart-button";
import { HeaderCartIcon } from "../_header-cart-icon";
// Phase A1 (owner-authorised 2026-10-20) · Accommodation demo-room
// designs panel. Server-side gated to the owner · never rendered to
// a guest or non-owner viewer · never carries booking / availability
// language. See _demo-room-designs.tsx for the honesty doctrine.
import {
  DemoRoomDesigns,
  hasDemoRoomDesignsForSubtype,
} from "./_demo-room-designs";
import type { BusinessSubtype } from "@/lib/nex-native/business/types";
// Owner directive 2026-10-20 · the subtype-aware "Add listing" button
// for the owner's own shop view. Routes to the correct existing
// `/manage/*` creation surface or shows an honest "Phase B" chip for
// blocked subtypes (accommodation · property). Guests never see
// either state · the entire block is gated on `isOwnerViewing`.
import { listingAddRouteFor } from "@/lib/nex-native/business/listing-add-route";

// Bridge 22 · food + drink verticals are menu-first · we skip the
// product-grid section for these entirely and render the full menu
// with Add-to-cart buttons on the landing. All other categories
// keep the product-grid landing.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.6)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.65)",
  green: "#16D66B",
  amber: "#F59E0B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams?: Promise<{ commerce?: string; setup?: string }>;
}) {
  // Bridge 55 · Phase 1 launch gate · shop landings hidden by default.
  // Admins can still reach with ?commerce=1.
  const sp = searchParams ? await searchParams : {};
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  // Track B · 2026-10-14 · setup-complete banner · owner-only.
  // When the owner lands here with `?setup=complete` after finishing
  // the Phase 2 two-step setup, show an honest 3-state visibility
  // explanation above the normal shop content. Non-owners never see
  // the banner (guard: owner_account_id === viewer.account.id). Also
  // guarded on the exact param value so URL-fragment manipulation
  // from outside the setup flow doesn't accidentally surface the
  // banner. See:
  //   docs/doctrine/nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md
  //
  // Track B.1 · 2026-10-14 · personalise invitation · owner-only.
  // Mutually exclusive with the setup-complete banner. When the owner
  // lands here WITHOUT ?setup=complete (e.g. after submitting their
  // first product · the sealed createFirstProductAction redirect
  // bypasses the Phase 2 two-step), surface an always-available
  // deep-link to the Phase 2 flow. Honest · never claims the setup
  // is incomplete · never reads chat_theme or cover_layout_id to
  // infer completion state. See:
  //   docs/doctrine/nex-bisnis-track-b-acceptance-review-2026-10-14.md
  let setupBanner: React.ReactElement | null = null;
  if (sp.setup === "complete") {
    const bannerSession = await resolveNexAppSessionFromContext().catch(
      () => null,
    );
    if (
      bannerSession &&
      bannerSession.account.id === business.owner_account_id
    ) {
      const { SetupCompleteBanner } = await import(
        "./_setup-complete-banner"
      );
      setupBanner = <SetupCompleteBanner business={business} />;
    }
  } else {
    const inviteSession = await resolveNexAppSessionFromContext().catch(
      () => null,
    );
    if (
      inviteSession &&
      inviteSession.account.id === business.owner_account_id
    ) {
      const { PersonaliseInvitation } = await import(
        "./_personalise-invitation"
      );
      setupBanner = <PersonaliseInvitation business={business} />;
    }
  }

  // Cover-A · sealed 2026-09-30 · when the seller has picked one of
  // the 10 sealed cover layouts (Migration 100 · nex_business.
  // cover_layout_id), we render the NEW cover via CoverThemeSkin +
  // CoverLayoutSwitch and return before we hit the legacy
  // HeroSidePanel path. NULL cover_layout_id keeps every existing
  // business on the legacy landing (zero regression).
  if (business.cover_layout_id) {
    const { loadCoverContent } = await import(
      "@/lib/nex-native/cover-content-loader"
    );
    const bundle = await loadCoverContent(business);
    if (bundle) {
      const { CoverThemeSkin } = await import("../cover/theme-skin");
      const { CoverLayoutSwitch } = await import("../cover/layout-switch");
      const chatThemeService = await import(
        "@/lib/nex-native/chat-theme-service"
      );
      // Owner directive 2026-10-20 · the shop face cover inherits
      // the OWNER's currently-selected chat theme (one continuous
      // world across chat + shop). The bundle.themeId is the
      // per-cover stored default (often pink-dream) · we prefer the
      // owner's nex_account.chat_theme when that theme row exists +
      // is active. Falls back to bundle.themeId on any lookup miss.
      const ownerAccountForTheme = await accountService
        .getAccountById(business.owner_account_id)
        .catch(() => null);
      const ownerChatThemeId = ownerAccountForTheme?.chat_theme ?? null;
      let resolvedThemeId = bundle.themeId;
      if (ownerChatThemeId && ownerChatThemeId !== bundle.themeId) {
        const ownerTheme = await chatThemeService
          .getThemeById(ownerChatThemeId)
          .catch(() => null);
        if (ownerTheme && ownerTheme.is_active) {
          resolvedThemeId = ownerChatThemeId;
        }
      }
      const theme = await chatThemeService
        .getThemeById(resolvedThemeId)
        .catch(() => null);
      if (theme && theme.is_active) {
        /* Owner directive 2026-10-20 · shop face cover overrides ·
           when the Bisnis owner has saved shop_cover_image_url and/
           or shop_cover_tint_hex via /cover-themes-library/edit/[id],
           those values layer on top of the sealed chat_theme defaults.
           Precedence (sealed): owner override → chat_theme default. */
        const businessOverrides = business as unknown as {
          shop_cover_image_url?: string | null;
          shop_cover_tint_hex?: string | null;
        };
        const effectiveWallpaperUrl =
          businessOverrides.shop_cover_image_url ?? theme.hero_image_url;
        const effectiveAccentHex =
          businessOverrides.shop_cover_tint_hex ?? theme.accent_hex;
        return (
          <>
            {setupBanner}
            <CoverThemeSkin
              accentHex={effectiveAccentHex}
              bubbleRimHex={theme.bubble_rim_hex}
              composerRimHex={theme.composer_rim_hex}
              wallpaperUrl={effectiveWallpaperUrl}
              wallpaperConfig={theme.wallpaper_config}
              themeId={theme.id}
              layoutId={bundle.layoutId}
            >
              <CoverLayoutSwitch
                layoutId={bundle.layoutId}
                content={bundle.content}
                themeId={theme.id}
              />
            </CoverThemeSkin>
          </>
        );
      }
    }
    // Fall through to legacy landing if theme couldn't resolve.
  }

  // Bridge 16c · resolve viewer to decide whether the floating chat
  // button renders (hide it for the shop owner viewing their own
  // shop · they'd be chatting with themselves).
  const viewerSession = await resolveNexAppSessionFromContext().catch(
    () => null,
  );
  const isOwnerViewing =
    viewerSession?.account.id === business.owner_account_id;
  const sellerFirstName =
    business.display_name.split(/\s+/)[0] ?? business.display_name;

  const products = await productService.listProductsByBusiness(
    business.id,
    "live",
  );

  // Phase A1 accommodation listings · owner-authorised 2026-10-21.
  // Fetches the business's live+available rooms (migration 213).
  // Safe-fail: if the migration hasn't been applied yet (local DB
  // without 213) the service throws · we catch to an empty array so
  // the page keeps rendering · the sealed R8 demo-room gate takes
  // over when `accommodationRooms.length === 0`.
  const accommodationRooms = await accommodationService
    .listLiveAvailableRoomsByBusiness(business.id)
    .catch(() => [] as accommodationService.NexAccommodationUnitRow[]);

  // Phase 3 · thin thumbnail-shape slice for the row that renders
  // directly under the business name. Reuses the live-product pool so
  // the row and the full feed stay honest — no synthesised items. The
  // row renders ONLY when products.length > 0 (component short-circuits
  // on empty · never an empty strip).
  const thumbnailProducts = await productService
    .getProductThumbnailsByBusiness(business.id, 0)
    .catch(() => [] as productService.ProductThumbnail[]);

  // Bridge 15a · restaurant/cafe menu · lifted to the top of the
  // landing when the shop is one of the menu categories.
  const isMenuVertical = isMenuFirstCategory(business.business_category);
  const menuBundle = isMenuVertical
    ? await menuService
        .getMenuBundleForBusiness(business.id, { onlyLive: true })
        .catch(() => ({ sections: [], totalItems: 0 }))
    : { sections: [], totalItems: 0 };

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;
  const menuHref = `/nex-native/${business.slug}/menu`;

  // Bridge 13 · resolve the seller's activity status so the hero
  // can carry an honest badge (active / slow / away / archived).
  // Reads existing columns · auto-archives crossings for 30+ days.
  const activity = await sellerResponsivenessService.resolveActivity({
    business_id: business.id,
    last_seller_activity_at: business.last_seller_activity_at,
    is_away: business.is_away,
    away_until: business.away_until ?? null,
    away_message: business.away_message ?? null,
    archived_at: business.archived_at ?? null,
  });

  // Owner directive 2026-10-20 · when the seller has selected a
  // live-world chat theme (e.g. "crispy-chicken") and HASN'T uploaded
  // a logo/cover photo, the shop face cover background inherits the
  // theme's wallpaper (same image as the chat background) · one
  // continuous world across chat + shop. Honest fallback chain:
  //   1. business.logo_url (owner-uploaded cover photo)   ← wins
  //   2. owner's live-world chat_theme wallpaperUrl        ← NEW
  //   3. moody-gradient fallback                           ← existing
  let heroThemeWallpaperUrl: string | null = null;
  let heroThemeAccentHex: string | null = null;
  if (!business.logo_url) {
    const ownerAccount = await accountService
      .getAccountById(business.owner_account_id)
      .catch(() => null);
    const themeId = ownerAccount?.chat_theme ?? undefined;
    if (isLiveWorldId(themeId)) {
      const pkg = LIVE_WORLD_PACKAGES[themeId] as unknown as {
        wallpaperUrl?: string | null;
        colours?: { primary?: string };
      };
      heroThemeWallpaperUrl = pkg.wallpaperUrl ?? null;
      heroThemeAccentHex = pkg.colours?.primary ?? null;
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {setupBanner}
      {/* --- TOP HEADER · NEX brand + home + settings ----------------
          Transparent · no container · floats directly over the hero
          photograph. The wordmark carries a subtle text-shadow and
          the icon buttons carry their own orange fill so nothing
          needs an outer shell for legibility. */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 14px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
        }}
      >
        {/* Brand · NE (white) + X (orange) · matches the create-account
            wordmark exactly · sans + letterSpacing 0.08em. Soft text
            shadow so it stays legible over any hero photo without
            needing a container behind it. */}
        <Link
          href="/nex-native"
          aria-label="NEX home"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            fontSize: 22,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "0.08em",
            padding: "6px 4px",
            textShadow: "0 2px 12px rgba(0,0,0,0.75)",
          }}
        >
          <span style={{ color: "#F2F5F8" }}>NE</span>
          <span style={{ color: "#FF7200" }}>X</span>
        </Link>

        {/* Right cluster · home + cart + settings · cart sits between so
            the badge count reads next to the two anchor icons. */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <HeaderIconLink
            href="/nex-native/home"
            ariaLabel="Home"
            title="Home"
          >
            <HomeIcon />
          </HeaderIconLink>
          <HeaderCartIcon variant="inline" />
          <HeaderIconLink
            href="/nex-native/settings"
            ariaLabel="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </HeaderIconLink>
        </div>
      </header>

      {/* --- HERO ---------------------------------------------------- */}
      <section
        style={{
          position: "relative",
          width: "100%",
          minHeight: "min(78vh, 720px)",
          overflow: "hidden",
          marginTop: -64, // header floats over the hero
        }}
      >
        {/* Cover photograph · falls back to the owner's live-world
            chat-theme wallpaper (owner directive 2026-10-20 · one
            continuous world across chat + shop · same image as the
            chat background) · then to a moody gradient when neither
            is set. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: business.logo_url
              ? `url(${business.logo_url})`
              : heroThemeWallpaperUrl
                ? `url(${heroThemeWallpaperUrl})`
                : `linear-gradient(135deg, #063B67 0%, #05101f 60%, #020914 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.05)",
          }}
        />
        {/* Editorial scrim · dark at bottom so text stays legible */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.15) 0%, rgba(2,9,20,0.55) 45%, rgba(2,9,20,0.95) 100%)",
          }}
        />

        {/* Content column · centered · caps at 720 so lines don't
            sprawl on desktop */}
        <div
          style={{
            position: "relative",
            maxWidth: 720,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0) + 32px) 24px 40px",
            minHeight: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Cyan address label · pushed down with explicit top margin
              so it never bumps into the sticky NEX brand mark on tall
              viewports · Founder direction 2026-09-28. */}
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginTop: 72,
              marginBottom: 16,
            }}
          >
            {business.slug}.nex
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(38px, 8vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              marginBottom: 12,
              textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            }}
          >
            {business.display_name}
          </h1>
          {/* Bridge 13 · activity badge · green/amber/purple/gray
              signal computed from last_seller_activity_at */}
          <ActivityBadge activity={activity} />
          {/* Phase 3 · compact owner-shop product thumbnail row ·
              horizontally scrollable · each tile links to the owner's
              peer chat with ?focus_product so the shop sheet auto-
              opens scrolled to the selected item. Renders nothing
              when the business has zero live products. */}
          <BusinessThumbnailRow
            ownerAccountId={business.owner_account_id}
            products={thumbnailProducts}
          />
          {/* Bridge 14 · category chip removed from hero per Founder
              direction 2026-09-28 · still used on Directory facet
              chips + shop-settings picker · component kept below. */}
          {business.description && (
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: "rgba(244,247,252,0.85)",
                maxWidth: 520,
                textShadow: "0 1px 12px rgba(0,0,0,0.5)",
              }}
            >
              {business.description}
            </p>
          )}
          {/* Two reach bullets · migration 060 · shows visitors at a
              glance whether this seller ships to their region. */}
          <ul
            style={{
              margin: "18px 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxWidth: 520,
            }}
          >
            {/* Only render the services the seller actually offers.
                A missing "Ships internationally" is not a claim to
                strike through · it's just absent. */}
            {(business.market_reach === "both" ||
              business.market_reach === "local_only") && (
              <ReachBullet label="Ships to local buyers" on={true} />
            )}
            {(business.market_reach === "both" ||
              business.market_reach === "export_only") && (
              <ReachBullet
                label="Ships internationally (export)"
                on={true}
              />
            )}
          </ul>
          {/* Bridge 16a · buyer-safe payment chips + link to explainer.
              Every chip is a method NEX vouches for as buyer-safe. */}
          <SafeTradeChipStrip
            methods={business.accepted_payment_methods ?? ["cod"]}
          />
        </div>
        {/* Right-side vertical rail · About / Order / SafeTrade ·
            each opens a full-screen overlay with the relevant info. */}
        <HeroSidePanel
          businessName={business.display_name}
          businessDescription={business.description ?? null}
          address={business.address ?? null}
          city={business.city ?? null}
          hoursDisplay={business.hours_display ?? null}
          acceptsCod={!!business.accepts_cod}
          acceptsPickup={!!business.accepts_pickup}
          paymentInstructions={business.payment_instructions ?? null}
          marketReach={business.market_reach ?? "both"}
          sellerDetails={{
            yearEstablished: business.year_established ?? null,
            staffCount: business.staff_count ?? null,
            samplesAvailable: !!business.samples_available,
            acceptsOem: !!business.accepts_oem,
            minOrderQuantity: business.min_order_quantity ?? null,
            localPostageIncluded: !!business.local_postage_included,
            sellerKind: business.seller_kind ?? "private",
            languages: business.languages ?? ["id"],
            additionalDetails: business.additional_details ?? null,
          }}
          eventsProfile={business.events_profile ?? null}
          venueGallery={business.venue_gallery ?? []}
        />
      </section>

      {/* --- FULL MENU on landing (food + drink verticals) --------- */}
      {isMenuVertical && menuBundle.totalItems > 0 && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "32px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
          id="menu"
        >
          <SectionHeading eyebrow="The menu" title="Order here" />
          {menuBundle.sections.map((s, i) => (
            <div key={s.section?.id ?? `unc-${i}`}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Section {i + 1}
              </div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: SERIF,
                  fontSize: 24,
                  lineHeight: 1.15,
                  fontWeight: 500,
                  letterSpacing: "-0.008em",
                  marginBottom: 14,
                }}
              >
                {s.section?.name ?? "Menu"}
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {s.items.map((it) => (
                  <MenuDishAddRow
                    key={it.id}
                    dish={it}
                    business={business}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {isMenuVertical && menuBundle.totalItems === 0 && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "32px 20px 12px",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 16,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            The menu is being written. Message{" "}
            <Link
              href={chatHref}
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              {business.display_name}
            </Link>{" "}
            to hear today&apos;s specials.
          </div>
        </section>
      )}

      {/* --- PRODUCTS · skipped for menu-first shops ---------------- */}
      {!isMenuVertical && products.length > 0 && (
        <section
          id="products"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 20px",
          }}
        >
          <SectionHeading
            eyebrow="The Collection"
            title="Currently available"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {products.map((p) => (
              <div key={p.id}>
              <ProductSpread
                name={p.name}
                description={p.description ?? null}
                price={formatPrice(p.price_pence, p.currency)}
                imageUrl={p.image_url ?? null}
                tags={p.tags ?? []}
                stockStatus={p.stock_status}
                chatHref={chatHref}
                detailHref={`/nex-native/${business.slug}/${p.id}`}
                shareHref={`/nex-native/share?product=${p.id}&back=${encodeURIComponent(`/nex-native/${business.slug}`)}`}
                likeAction={toggleLikeProductAction.bind(null, p.id)}
                likeBackHref={`/nex-native/${business.slug}`}
                addToCart={
                  <AddToCartButton
                    compact
                    tone="ghost"
                    label="+ Add to cart"
                    item={{
                      kind: "product",
                      id: p.id,
                      shop_id: business.id,
                      shop_slug: business.slug ?? "",
                      shop_owner_account_id: business.owner_account_id,
                      shop_display_name: business.display_name,
                      shop_lat: business.location_lat ?? null,
                      shop_lng: business.location_lng ?? null,
                      name: p.name,
                      price_pence: p.price_pence,
                      currency: p.currency,
                      image_url: p.image_url,
                      variants: [],
                    }}
                  />
                }
              />
              {/* Owner-authorised 2026-10-20 · Track A · owner-only
                  "Manage listing" link appended under each product
                  card. Routes to the existing /manage/products/<id>
                  edit page. `changeProductStatusAction` already
                  calls `revalidatePath("/nex-native/<slug>")` on
                  save, so the shop refreshes automatically on
                  archive / unarchive. Guests never see this. */}
              {isOwnerViewing && (
                <div
                  data-nex-owner-manage-listing={p.id}
                  style={{
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Link
                    href={`/nex-native/manage/products/${p.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 32,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: NEX.cyan,
                      textDecoration: "none",
                      border: `1px solid ${NEX.cyanSoft ?? "rgba(0,175,255,0.5)"}`,
                      borderRadius: 8,
                      background: "transparent",
                    }}
                  >
                    Manage listing →
                  </Link>
                </div>
              )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!isMenuVertical && products.length === 0 && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "60px 20px",
            textAlign: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Aisha hasn&apos;t listed anything yet. The conversation is
          still open · say hi above.
        </section>
      )}

      {/* Phase A1 real accommodation rooms (owner-authorised 2026-10-21).
          Rendered to BOTH owners and guests when the business has
          live+available rooms. Status filter `status='live' AND
          is_available=true` is applied at the service layer AND by
          RLS (migration 213:85-96 public_read_live policy). Owner
          management lives at /nex-native/manage/accommodation. The
          sealed R8 demo-room gate below suppresses when real rooms
          exist (fifth-condition suffix `accommodationRooms.length === 0`). */}
      {accommodationRooms.length > 0 && (
        <section
          data-nex-accommodation-rooms-section="true"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "32px 20px 8px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Rooms
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {accommodationRooms.map((room) => (
              <article
                key={room.id}
                data-nex-accommodation-room-card={room.id}
                style={{
                  padding: 16,
                  background: NEX.panelSoft,
                  border: `1px solid ${NEX.border}`,
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {room.image_url && (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: `center/cover url(${room.image_url})`,
                      border: `1px solid ${NEX.border}`,
                    }}
                  />
                )}
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: NEX.text,
                    }}
                  >
                    {room.name}
                  </h3>
                  {room.price_per_night_pence !== null && (
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: NEX.cyan,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {room.currency}{" "}
                      {room.price_per_night_pence.toLocaleString()}
                      <span
                        style={{
                          fontSize: 10,
                          color: NEX.textDim,
                          marginLeft: 4,
                        }}
                      >
                        /night
                      </span>
                    </div>
                  )}
                </header>
                <div
                  style={{
                    fontSize: 12,
                    color: NEX.textDim,
                  }}
                >
                  {room.capacity} guest{room.capacity !== 1 ? "s" : ""} ·{" "}
                  {room.bedrooms} bed{room.bedrooms !== 1 ? "s" : ""} ·{" "}
                  {room.bathrooms} bath
                  {room.bathrooms !== 1 ? "s" : ""}
                </div>
                {room.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: NEX.textDim,
                      lineHeight: 1.5,
                    }}
                  >
                    {room.description}
                  </p>
                )}
                {room.amenities.length > 0 && (
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                  >
                    {room.amenities.map((a) => (
                      <span
                        key={a}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(0,175,255,0.08)",
                          color: NEX.textDim,
                          border: `1px solid ${NEX.border}`,
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {/* Honest enquiry link · routes to chat with the
                    owner. "NEX never handles payments" · no booking
                    confirmation claim here. */}
                <Link
                  data-nex-accommodation-room-enquire={room.id}
                  href={chatHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 4,
                    padding: "10px 16px",
                    background: NEX.orange,
                    color: "#1A0808",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderRadius: 10,
                    border: `1px solid ${NEX.orangeSoft}`,
                  }}
                >
                  Enquire about {room.name}
                </Link>
                {isOwnerViewing && (
                  <Link
                    href={`/nex-native/manage/accommodation/${room.id}`}
                    data-nex-accommodation-room-manage={room.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      marginTop: 2,
                      fontSize: 11,
                      color: NEX.cyan,
                      textDecoration: "none",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Manage listing →
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Phase A1 (owner-authorised 2026-10-20) · Accommodation
          demo-room designs. ONLY rendered when the viewer IS the
          business owner AND the business has zero live products AND
          the business profile declares a Phase A1 accommodation
          subtype (villa / homestay / kost). This is non-interactive
          visual guidance, never seen by guests. See the file-level
          doctrine in `_demo-room-designs.tsx`.
          Fifth-condition suffix (2026-10-21): `accommodationRooms.length === 0`
          suppresses the demo when real rooms exist. The sealed
          four-condition regex anchor (`!isMenuVertical && isOwnerViewing
          && products.length === 0 && hasDemoRoomDesignsForSubtype`) stays
          intact · the fifth AND clause lives AFTER the sealed anchor so
          the regex continues to match. */}
      {!isMenuVertical &&
        isOwnerViewing &&
        products.length === 0 &&
        hasDemoRoomDesignsForSubtype(
          (business.profile as { primary?: { subtype?: BusinessSubtype } } | null)
            ?.primary?.subtype ?? null,
        ) &&
        accommodationRooms.length === 0 && (
          <DemoRoomDesigns
            subtype={
              (
                business.profile as {
                  primary: { subtype: BusinessSubtype };
                }
              ).primary.subtype
            }
          />
        )}

      {/* Owner directive 2026-10-20 · Add Listing CTA · owner-only.
          Reads the business subtype, resolves the correct existing
          creation surface via `listingAddRouteFor`, and renders either
          a Link (ready subtypes · food/services/products) or a dimmed
          honest "coming in Phase B" chip (accommodation · property).
          Guests never see this section. The sealed DemoRoomDesigns
          gate above is unchanged. */}
      {isOwnerViewing &&
        (() => {
          const subtype =
            (business.profile as { primary?: { subtype?: BusinessSubtype } } | null)
              ?.primary?.subtype ?? null;
          const addRoute = listingAddRouteFor(subtype);
          if (!addRoute) return null;
          return (
            <section
              data-nex-owner-add-listing={addRoute.state}
              style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "28px 20px 8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                Owner-only
              </div>
              {addRoute.state === "ready" ? (
                <Link
                  href={addRoute.href}
                  data-nex-owner-add-listing-link={addRoute.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 44,
                    padding: "10px 18px",
                    background: NEX.orange,
                    color: "#1A0808",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    textDecoration: "none",
                    borderRadius: 10,
                    border: `1px solid ${NEX.orangeSoft}`,
                  }}
                >
                  <span
                    aria-hidden
                    style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}
                  >
                    +
                  </span>
                  {addRoute.label}
                </Link>
              ) : (
                <div
                  data-nex-owner-add-listing-blocked
                  role="status"
                  aria-label={addRoute.reason}
                  title={addRoute.reason}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 44,
                    padding: "10px 18px",
                    background: "rgba(255,255,255,0.06)",
                    color: NEX.textDim,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    borderRadius: 10,
                    border: `1px dashed ${NEX.border}`,
                    cursor: "default",
                  }}
                >
                  <span
                    aria-hidden
                    style={{ fontSize: 14, lineHeight: 1 }}
                  >
                    ⏳
                  </span>
                  {addRoute.label}
                </div>
              )}
            </section>
          );
        })()}

      {/* --- CONTACT + SOCIALS --------------------------------------- */}
      {(business.address ||
        business.public_phone ||
        business.public_email ||
        business.instagram_handle ||
        business.facebook_handle ||
        business.tiktok_handle) && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 24px",
          }}
        >
          <SectionHeading eyebrow="Reach out" title="Find the seller" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 20,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              borderRadius: 16,
            }}
          >
            {business.address && (
              <ContactRow label="Location" value={business.address} />
            )}
            {business.public_phone && (
              <ContactRow
                label="Phone"
                value={business.public_phone}
                href={`tel:${business.public_phone}`}
              />
            )}
            {business.public_email && (
              <ContactRow
                label="Email"
                value={business.public_email}
                href={`mailto:${business.public_email}`}
              />
            )}
            {(business.instagram_handle ||
              business.facebook_handle ||
              business.tiktok_handle ||
              business.linkedin_handle ||
              business.x_handle) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {business.instagram_handle && (
                  <SocialPill
                    href={`https://instagram.com/${business.instagram_handle}`}
                    label={`@${business.instagram_handle}`}
                  />
                )}
                {business.facebook_handle && (
                  <SocialPill
                    href={`https://facebook.com/${business.facebook_handle}`}
                    label={`/${business.facebook_handle}`}
                  />
                )}
                {business.tiktok_handle && (
                  <SocialPill
                    href={`https://tiktok.com/@${business.tiktok_handle}`}
                    label={`TikTok · @${business.tiktok_handle}`}
                  />
                )}
                {business.linkedin_handle && (
                  <SocialPill
                    href={`https://linkedin.com/${business.linkedin_handle}`}
                    label={`LinkedIn · /${business.linkedin_handle}`}
                  />
                )}
                {business.x_handle && (
                  <SocialPill
                    href={`https://x.com/${business.x_handle}`}
                    label={`X · @${business.x_handle}`}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- FOOTER -------------------------------------------------- */}
      <footer
        style={{
          padding: "32px 20px calc(env(safe-area-inset-bottom, 0) + 32px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          Powered by NEX
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            marginTop: 8,
          }}
        >
          <Link
            href="/nex-native/about"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            What is NEX?
          </Link>
        </div>
      </footer>
      {/* Bridge 16c · Floating "Chat with seller" button · pinned to
          bottom-right of the viewport. Hidden when the shop owner is
          viewing their own shop. */}
      <FloatingChatButton
        ownerAccountId={business.owner_account_id}
        sellerFirstName={sellerFirstName}
        businessSlug={business.slug}
        isOwnerViewing={isOwnerViewing}
        isGuest={!viewerSession}
      />
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Bridge 22 · Menu dish row on the menu-first landing                    *
 * --------------------------------------------------------------------- */

function MenuDishAddRow({
  dish,
  business,
}: {
  dish: import("@/lib/nex-native/menu-service").NexMenuItemRow;
  business: import("@/lib/nex-native/types").NexBusinessRow;
}) {
  const unavailable = !dish.is_available;
  const priceIdr = Math.round(dish.price_pence / 100).toLocaleString();
  const spice =
    dish.spice_level > 0 ? "🌶".repeat(dish.spice_level) : null;
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "96px 1fr auto",
        gap: 14,
        padding: 12,
        borderRadius: 16,
        background: dish.is_featured
          ? "rgba(255,114,0,0.05)"
          : NEX.panelSoft,
        border: dish.is_featured
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid ${NEX.border}`,
        opacity: unavailable ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 10,
          background: dish.image_url
            ? `url(${dish.image_url}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        {dish.is_featured && (
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 800,
              marginBottom: 4,
            }}
          >
            ★ House special
          </div>
        )}
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: 1.15,
            marginBottom: 4,
          }}
        >
          {dish.name}
        </div>
        {dish.perks?.includes("free_delivery") && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
              border: "1px solid rgba(22,214,107,0.60)",
              color: "#08170D",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: "0 4px 12px rgba(22,214,107,0.35)",
            }}
          >
            🚚 Free Delivery
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginBottom: 6,
          }}
        >
          {spice && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,90,60,0.14)",
                color: "#FF9A80",
              }}
            >
              {spice}
            </span>
          )}
          {dish.dietary_tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(22,214,107,0.14)",
                color: "#4EE38A",
              }}
            >
              {t}
            </span>
          ))}
          {(dish.perks ?? [])
            .filter((p) => p !== "free_delivery")
            .slice(0, 3)
            .map((perk) => (
              <span
                key={perk}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(22,214,107,0.10)",
                  color: "#B8F1CC",
                }}
              >
                {perk === "bogo"
                  ? "🎁 Buy 1 Get 1 Free"
                  : perk === "free_drink"
                    ? "🥤 Free Drink"
                    : perk === "free_rice"
                      ? "🍚 Free Rice"
                      : perk === "free_fries"
                        ? "🍟 Free Fries"
                        : perk === "other" && dish.perks_note
                          ? `✨ ${dish.perks_note}`
                          : `✨ ${perk}`}
              </span>
            ))}
          {dish.portion_note && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(139,169,209,0.10)",
                color: NEX.textDim,
              }}
            >
              🍽 {dish.portion_note}
            </span>
          )}
        </div>
        {dish.description && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(244,247,252,0.85)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {dish.description}
          </p>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: NEX.orange,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Rp {priceIdr}
        </div>
        {unavailable ? (
          <span
            style={{
              fontSize: 9,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(255,51,85,0.10)",
              border: "1px solid rgba(255,51,85,0.35)",
              color: "#FF7A85",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Sold out
          </span>
        ) : (
          <AddToCartButton
            compact
            item={{
              kind: "menu_item",
              id: dish.id,
              shop_id: business.id,
              shop_slug: business.slug ?? "",
              shop_owner_account_id: business.owner_account_id,
              shop_display_name: business.display_name,
              shop_lat: business.location_lat ?? null,
              shop_lng: business.location_lng ?? null,
              name: dish.name,
              price_pence: dish.price_pence,
              currency: dish.currency,
              image_url: dish.image_url,
              variants: [],
              perks: dish.perks ?? [],
              perks_note: dish.perks_note ?? null,
            }}
            label="+ Add"
          />
        )}
      </div>
    </article>
  );
}

/* --------------------------------------------------------------------- *
 * Building blocks                                                       *
 * --------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 28,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const valueEl = href ? (
    <a
      href={href}
      style={{
        color: NEX.text,
        textDecoration: "none",
        borderBottom: `1px solid ${NEX.borderStrong}`,
      }}
    >
      {value}
    </a>
  ) : (
    <span style={{ color: NEX.text }}>{value}</span>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: 12,
        alignItems: "start",
        fontSize: 13,
      }}
    >
      <div
        style={{
          color: NEX.textMute,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          paddingTop: 2,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{valueEl}</div>
    </div>
  );
}

function SocialPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${NEX.borderStrong}`,
        background: "rgba(0,175,255,0.08)",
        color: NEX.cyan,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

function ProductSpread({
  name,
  description,
  price,
  imageUrl,
  stockStatus,
  detailHref,
  shareHref,
  likeAction,
  likeBackHref,
  addToCart,
}: {
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  /** Kept in the signature so callers don't need to change · no
   *  longer rendered on the card · Founder direction 2026-09-28. */
  tags?: string[];
  stockStatus: string | null;
  /** Kept in the signature so callers don't need to change · card
   *  now has a single "More info" button that goes to detailHref
   *  and the chat CTA lives on the product page itself. */
  chatHref?: string;
  detailHref: string;
  /** Bridge 17 · opens /share?product=<id> · pick a NEX contact
   *  and drop the product into their chat as a Bridge 11 card. */
  shareHref?: string;
  /** Bridge 18 · heart icon top-left of the image · saves to the
   *  viewer's liked list. Anonymous viewers get bounced to sign-in
   *  by the action's guard. */
  likeAction?: (formData: FormData) => Promise<never> | void;
  likeBackHref?: string;
  /** Bridge 22 · optional add-to-cart client button rendered next
   *  to More info. Pre-configured by the caller (has all product
   *  fields it needs to persist into localStorage). */
  addToCart?: React.ReactNode;
}) {
  return (
    <article
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Hero photo · 3:2 aspect · bottom corners rounded so the
          image reads as its own self-contained photo, with the meta
          block sitting below it in the card. */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 2",
          background: "#050f1e",
          overflow: "hidden",
          position: "relative",
          borderRadius: "0 0 18px 18px",
        }}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: NEX.textMute,
              fontSize: 56,
            }}
          >
            🛍️
          </div>
        )}
        {/* Bridge 18 · like/save · top-left icon on the image.
            Complements the share icon at top-right. */}
        {likeAction && (
          <form
            action={likeAction}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              margin: 0,
            }}
          >
            <input type="hidden" name="intent" value="like" />
            <input
              type="hidden"
              name="back"
              value={likeBackHref ?? "/nex-native/liked"}
            />
            <button
              type="submit"
              aria-label="Save to liked items"
              title="Save to Liked"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(2,9,20,0.75)",
                border: "1px solid rgba(255,51,85,0.45)",
                display: "grid",
                placeItems: "center",
                color: "#FF7A85",
                fontSize: 15,
                lineHeight: 1,
                cursor: "pointer",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                fontFamily: "inherit",
              }}
            >
              ♥
            </button>
          </form>
        )}
        {/* Bridge 17 · share to a NEX contact · top-right icon on the
            image. Anonymous visitors get bounced through /sign-in. */}
        {shareHref && (
          <Link
            href={shareHref}
            aria-label="Share this product"
            title="Share with a NEX contact"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(2,9,20,0.75)",
              border: `1px solid ${NEX.borderStrong}`,
              display: "grid",
              placeItems: "center",
              color: "#F4F7FC",
              textDecoration: "none",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            <span aria-hidden>↗</span>
          </Link>
        )}
        {stockStatus && stockStatus !== "in_stock" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(2,9,20,0.75)",
              border: `1px solid ${
                stockStatus === "sold_out"
                  ? "rgba(255,120,120,0.5)"
                  : NEX.borderStrong
              }`,
              color:
                stockStatus === "sold_out"
                  ? "#FF7A85"
                  : stockStatus === "low_stock"
                    ? NEX.amber
                    : NEX.cyan,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              backdropFilter: "blur(6px)",
            }}
          >
            {stockStatus === "sold_out"
              ? "Sold out"
              : stockStatus === "low_stock"
                ? "Low stock"
                : stockStatus === "made_to_order"
                  ? "Made to order"
                  : stockStatus.replace(/_/g, " ")}
          </div>
        )}
      </div>

      {/* Meta · name on one line · description underneath · price
          right-aligned below the description · single More info CTA.
          Founder direction 2026-09-28. */}
      <div style={{ padding: "18px 22px 22px" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 24,
            letterSpacing: "-0.008em",
            lineHeight: 1.15,
            marginBottom: description ? 10 : 14,
            // One-line name · truncate with ellipsis if too long ·
            // full name still available on the detail page.
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={name}
        >
          {name}
        </h3>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.85)",
              marginBottom: 10,
              whiteSpace: "pre-wrap",
            }}
          >
            {description}
          </p>
        )}
        <div
          style={{
            fontFamily: SANS,
            fontSize: 16,
            fontWeight: 800,
            color: NEX.orange,
            letterSpacing: "0.01em",
            textAlign: "right",
            marginBottom: 14,
          }}
        >
          {price}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: addToCart ? "1fr auto" : "1fr",
            gap: 10,
          }}
        >
          <Link
            href={detailHref}
            style={{
              display: "block",
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.16)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            More info →
          </Link>
          {addToCart}
        </div>
      </div>
    </article>
  );
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

function MenuPreviewCard({
  menuHref,
  totalItems,
  featuredItems,
  sections,
}: {
  menuHref: string;
  totalItems: number;
  featuredItems: import("@/lib/nex-native/menu-service").NexMenuItemRow[];
  sections: string[];
}) {
  return (
    <Link
      href={menuHref}
      style={{
        display: "block",
        borderRadius: 20,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,114,0,0.10) 0%, rgba(6,15,28,0.85) 40%, rgba(3,10,20,0.9) 100%)",
        border: "1px solid rgba(255,114,0,0.5)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.55), 0 0 40px rgba(255,114,0,0.14), inset 0 1px 0 rgba(255,255,255,0.05)",
        color: NEX.text,
        textDecoration: "none",
      }}
    >
      {featuredItems.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              featuredItems.length === 1
                ? "1fr"
                : featuredItems.length === 2
                  ? "1fr 1fr"
                  : "1fr 1fr 1fr",
            gap: 2,
            background: "#050f1e",
          }}
        >
          {featuredItems.map((it) => (
            <div
              key={it.id}
              style={{
                aspectRatio: "1 / 1",
                overflow: "hidden",
                background: "#050f1e",
              }}
            >
              {it.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.image_url}
                  alt={it.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "22px 22px 24px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          The Menu · {totalItems} live items
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 30,
            letterSpacing: "-0.012em",
            lineHeight: 1.05,
            marginBottom: 8,
          }}
        >
          View today&apos;s menu
        </h2>
        {sections.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 16,
            }}
          >
            {sections.map((s) => (
              <span
                key={s}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${NEX.borderStrong}`,
                  background: "rgba(0,0,0,0.35)",
                  color: NEX.textDim,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 18px",
            borderRadius: 12,
            background:
              "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 10px 24px rgba(255,114,0,0.4)",
          }}
        >
          Open menu <span aria-hidden>→</span>
        </div>
      </div>
    </Link>
  );
}

function CategoryChip({ category }: { category: string }) {
  const label = category
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
  return (
    <Link
      href={`/nex-native/directory?category=${encodeURIComponent(category)}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        background: "rgba(0,175,255,0.14)",
        border: "1px solid rgba(0,175,255,0.45)",
        color: "#66CFFF",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        textDecoration: "none",
        marginBottom: 14,
        backdropFilter: "blur(6px)",
        textShadow: "0 1px 8px rgba(0,0,0,0.55)",
      }}
    >
      {label}
    </Link>
  );
}

function ActivityBadge({
  activity,
}: {
  activity: import("@/lib/nex-native/seller-responsiveness-service").SellerActivityBundle;
}) {
  const palette = ACTIVITY_PALETTE[activity.status];
  const text = activity.detail || activity.label;
  return (
    <div
      role="status"
      aria-label={`Seller status · ${activity.label} · ${activity.detail}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 6,
        marginBottom: 14,
        fontSize: 12,
        color: palette.detail,
        letterSpacing: "0.02em",
        textShadow: "0 1px 8px rgba(0,0,0,0.55)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: palette.dot,
          boxShadow:
            activity.status === "active"
              ? `0 0 0 3px ${palette.dot}22`
              : "none",
        }}
      />
      <span>{text}</span>
    </div>
  );
}

const ACTIVITY_PALETTE: Record<
  "active" | "slow" | "away" | "archived",
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    detail: string;
  }
> = {
  active: {
    bg: "rgba(22,214,107,0.14)",
    border: "rgba(22,214,107,0.5)",
    text: "#B8F1CC",
    dot: "#16D66B",
    detail: "rgba(184,241,204,0.85)",
  },
  slow: {
    bg: "rgba(245,158,11,0.14)",
    border: "rgba(245,158,11,0.5)",
    text: "#FCD9A8",
    dot: "#F59E0B",
    detail: "rgba(252,217,168,0.85)",
  },
  away: {
    bg: "rgba(163,132,255,0.16)",
    border: "rgba(163,132,255,0.5)",
    text: "#DDD4FF",
    dot: "#A384FF",
    detail: "rgba(221,212,255,0.85)",
  },
  archived: {
    bg: "rgba(139,169,209,0.12)",
    border: "rgba(139,169,209,0.35)",
    text: "#B8C6DA",
    dot: "#8BA9D1",
    detail: "rgba(184,198,218,0.85)",
  },
};

/** Bridge 16a · Buyer-safe payment chips + explainer link. Renders
 *  the seller's accepted methods as small chips beneath the reach
 *  bullets · every chip is a method NEX vouches for as buyer-safe.
 *  Tapping the "🛡 Safe on NEX" link opens /safe-trade for the full
 *  explanation. */
function SafeTradeChipStrip({ methods }: { methods: string[] }) {
  if (!methods || methods.length === 0) return null;
  const EMOJI: Record<string, string> = {
    cod: "💵",
    qris_delivery: "📱",
    courier_cod: "📦",
    meetup: "🤝",
    escrow: "🔒",
    paypal: "🌏",
  };
  const LABEL: Record<string, string> = {
    cod: "C.O.D",
    qris_delivery: "QRIS on delivery",
    courier_cod: "Courier C.O.D",
    meetup: "Meet in person",
    escrow: "Escrow (Rekber)",
    paypal: "PayPal G&S",
  };
  const displayable = methods.filter((m) => EMOJI[m]);
  if (displayable.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 16,
        borderTop: "1px solid rgba(139,169,209,0.14)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <Link
        href="/nex-native/safe-trade"
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "#16D66B",
          fontWeight: 700,
          textDecoration: "none",
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(22,214,107,0.10)",
          border: "1px solid rgba(22,214,107,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        🛡 Safe on NEX
      </Link>
      <span
        style={{
          fontSize: 12,
          color: "rgba(139,169,209,0.85)",
          textShadow: "0 1px 8px rgba(0,0,0,0.5)",
        }}
      >
        Accepts:
      </span>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {displayable.map((m) => (
          <span
            key={m}
            aria-label={LABEL[m]}
            title={LABEL[m]}
            style={{
              fontSize: 16,
              lineHeight: 1,
              textShadow: "0 1px 6px rgba(0,0,0,0.55)",
            }}
          >
            {EMOJI[m]}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReachBullet({ label, on }: { label: string; on: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: on ? "rgba(244,247,252,0.94)" : "rgba(139,169,209,0.55)",
        textDecoration: on ? "none" : "line-through",
        textShadow: on ? "0 1px 10px rgba(0,0,0,0.5)" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "#16D66B" : "rgba(255,255,255,0.12)",
          color: on ? "#0B0F1A" : "rgba(255,255,255,0.6)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
          boxShadow: on ? "0 4px 10px rgba(22,214,107,0.35)" : "none",
        }}
      >
        {on ? "✓" : "×"}
      </span>
      <span>{label}</span>
    </li>
  );
}

function HeaderIconLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  /** Kept in the type so callers don't need to change · no longer
   *  rendered as a browser tooltip so nothing but the icon shows. */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        display: "inline-grid",
        placeItems: "center",
        padding: 6,
        color: "#FFFFFF",
        textDecoration: "none",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.65))",
      }}
    >
      {children}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}
