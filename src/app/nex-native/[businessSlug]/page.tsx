// src/app/nex-native/[businessSlug]/page.tsx
//
// Public shop surface · "/<slug>".
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Re-architects the deleted /[businessSlug] route. Loads the business
// row by slug, its live products, the preferred chat theme, and
// renders the sealed CoverThemeSkin + CoverLayoutSwitch primitives
// using the owner's real nex_business content (which the burger menu
// + ShopChatFab + CoverIdentityBadge already read from the prior
// content-wiring commit).
//
// Flow for the buyer:
//   · GET /<slug> · server loads business + products
//   · if slug not found · redirect to /free-chat (soft landing)
//   · if business present but Setup Steps 1-6 not complete · still
//     renders · burger/overlay/identity fall back to mock per-field
//   · tap burger → About Us / Visit Us / Shipping & Returns / Services
//   · tap floating 💬 FAB → chat with owner (ownerHandle resolves to
//     slug deep-link)
//   · tap product → routes to /nex-native/chat/peer/<ownerId>?pending_
//     product=<productId> (existing peer-chat flow)

import type * as React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
// Owner directive 2026-11-13 · the public shop country flag was
// hard-coded to "IE" so Indonesian shops (Rosa / Tri) rendered with
// the 🇮🇪 flag. Load the owner account so we can read their
// last_known_country_iso and derive the flag honestly.
import { getAccountById } from "@/lib/nex-native/account-service";
import {
  buildBreadcrumbList,
  buildLocalBusiness,
  renderJsonLd,
} from "@/lib/nex-native/seo/json-ld";
import { nexCanonicalUrl } from "@/lib/nex-native/seo/site-url-resolver";
import { buildShopProductJsonLdStrings } from "@/lib/nex-native/seo/shop-product-json-ld";
// Owner directive 2026-11-08 (round 5) · traffic analytics tracer ·
// fires once per server response (no client re-render double-count).
// Sandbox-only until migration 303 is applied in prod.
import {
  recordPageView,
  isLikelyBot,
  sha256Hex,
  resolveViewCountry,
} from "@/lib/nex-native/analytics/page-view-service";
import { resolveViewerToken } from "@/lib/nex-native/analytics/viewer-cookie";
import * as productService from "@/lib/nex-native/product-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
// Owner directive 2026-11-06 readiness fill · surface an owner-only
// empty state when the shop is live but has zero products so the
// shop owner sees the gap on their public face.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { getShopCoverContent } from "@/lib/nex-native/shop-cover-service";
import { CoverThemeSkin } from "../cover/theme-skin";
import { CoverLayoutSwitch } from "../cover/layout-switch";
import { BurgerMenu } from "../cover/_burger-menu";
import { ShopChatFab } from "../cover/_shop-chat-fab";
// Owner directive 2026-11-07 · ShopSideChatDrawer (top-left chat icon
// on the shop cover) retired · the bottom-right ShopChatFab already
// routes to the owner's chat page, so the duplicate top-left tap
// target was removed. The drawer file is preserved on disk in case
// we want to re-mount it later with a different trigger.
// import { ShopSideChatDrawer } from "../cover/_shop-side-chat-drawer";
import { ProductDetailSheet } from "../cover/_product-detail-sheet";
import { PhoneFrame } from "../cover/preview/_phone-frame";
import {
  COVER_LAYOUT_IDS,
  isValidCoverLayoutId,
  type CoverLayoutId,
} from "../cover/layout-ids";
import type {
  CoverProduct,
  CoverSection,
  CoverSocialLinks,
} from "../cover/primitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback theme when the owner hasn't picked one (brand-new shop).
// Stays as nex-flat to match the themes-picker default.
const DEFAULT_THEME = "nex-flat";

// Fallback layout for owners who haven't run the themes picker yet.
const DEFAULT_LAYOUT: CoverLayoutId = "cafe";

interface PageProps {
  params: Promise<{ businessSlug: string }>;
  // Owner-sealed 2026-11-13 · `open-chat=1` triggers the signed-in
  // auto-redirect into the peer chat with the shop owner · set by
  // the registration popup so the visitor lands back on the shop
  // after sign-up / sign-in and immediately opens the chat.
  //
  // Stage 3 · 2026-11-14 · `product=<id>` is the optional product
  // reference forwarded from the Stage 1 "More Details" path when
  // the visitor arrived unauthenticated. The open-chat handler
  // below re-attaches it to the `/conversations/<id>` redirect so
  // the Shop Chat chip paints with the originally-selected product.
  searchParams?: Promise<{
    openChat?: string;
    "open-chat"?: string;
    product?: string;
  }>;
}

// Owner directive 2026-11-11 (SEO B2) · dynamic per-shop metadata ·
// carries the business name + description + canonical URL so each shop
// renders a unique head in HTML, instead of inheriting the generic
// nex-native layout title. OG + Twitter cards emit the same unique
// strings · the per-shop OG image is wired in B4 via opengraph-image.tsx.
// Zero fabricated fields · if a shop hasn't supplied a description, the
// default is a neutral platform-level fallback that doesn't invent facts.
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { businessSlug } = await params;
  const business = await businessService
    .getBusinessBySlug(businessSlug)
    .catch(() => null);
  if (!business) {
    return { title: "Shop · NEX" };
  }
  const canonical = nexCanonicalUrl(`/nex-native/${business.slug}`);
  const title = `${business.display_name} · NEX`;
  const descriptionRaw = business.description?.trim();
  const description =
    descriptionRaw && descriptionRaw.length > 0
      ? descriptionRaw
      : `${business.display_name} on NEX — online shop and business profile.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "NEX",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicShopPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) {
    notFound();
  }
  // Owner-sealed 2026-11-13 · shop-to-customer return flow. When the
  // visitor arrives with `?open-chat=1` AND they're signed in, bounce
  // them straight into the peer chat with the shop owner. Keeps the
  // post-sign-in landing clean: the registration popup set
  // ?next=/nex-native/<slug>?open-chat=1 so the final destination is
  // this page WITH the param · the auth flow preserves it and this
  // guard completes the journey.
  const sp = (await searchParams) ?? {};
  const openChatIntent = sp.openChat === "1" || sp["open-chat"] === "1";

  // Parallel loads · all fail-soft so a transient Supabase blip
  // doesn't crash the shop surface.
  const [products, coverContent, themeRow, viewerSession, ownerAccount] =
    await Promise.all([
      productService
        .listProductsByBusiness(business.id, "live")
        .catch(() => []),
      getShopCoverContent(business.id).catch(() => null),
      chatThemeService.getThemeById(DEFAULT_THEME).catch(() => null),
      resolveSessionWithDevOverride().catch(() => null),
      // Owner directive 2026-11-13 · flag source · read the owner's
      // ISO so Indonesian shops render 🇮🇩 instead of 🇮🇪.
      getAccountById(business.owner_account_id).catch(() => null),
    ]);

  // Owner-sealed 2026-11-13 (iter 2) · complete the return journey
  // via the BUSINESS-SCOPED conversation system (nex_conversation
  // keyed by business_id) instead of the personal peer chat. Each
  // shop owns its own customer conversation thread · multiple shops
  // per owner get independent conversations. Falls through to the
  // normal shop page render when the viewer isn't signed in or is
  // the shop owner themselves (they skip the bounce).
  if (openChatIntent && viewerSession && viewerSession.account.id !== business.owner_account_id) {
    const { getOrCreateBusinessConversation } = await import(
      "@/lib/nex-native/business-message-service"
    );
    const { redirect } = await import("next/navigation");
    const conversationId = await getOrCreateBusinessConversation(
      viewerSession.account.id,
      business.id,
      business.owner_account_id,
    );
    // Owner directive 2026-11-13 (iter 23) · draft stash migrated
    // off the URL. No draft param carried through · client reads
    // same-origin sessionStorage after mount.
    //
    // Stage 3 · 2026-11-14 · when the visitor arrived via the Stage
    // 1 "More Details" → sign-up / sign-in round-trip, the open-
    // chat URL also carries `?product=<id>`. Forward it to the
    // conversation page so the Stage 1 chip paints with the
    // originally-selected product. UUID-shape validated here so
    // junk input never reaches the conversation page's resolver.
    const PRODUCT_UUID_SHAPE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const productIdRaw = typeof sp.product === "string" ? sp.product.trim() : "";
    const productId =
      productIdRaw.length > 0 && PRODUCT_UUID_SHAPE.test(productIdRaw)
        ? productIdRaw
        : null;
    const dest = productId
      ? `/nex-native/conversations/${conversationId}?product=${encodeURIComponent(productId)}`
      : `/nex-native/conversations/${conversationId}`;
    redirect(dest);
  }

  // Owner directive 2026-11-13 · derive the shop's country flag from
  // the owner's last_known_country_iso. Previously hard-coded to "IE"
  // so Indonesian shops rendered the wrong flag. Fallback kept so the
  // MockCoverContent.countryCode stays a plain string.
  const ownerCountryIso: string =
    (ownerAccount as { last_known_country_iso?: string | null } | null)
      ?.last_known_country_iso ?? "IE";

  // Owner directive 2026-11-06 readiness fill · viewer-is-owner check
  // powers the "Your shop is empty · add products →" banner that only
  // the owner sees on their own public face. Everyone else sees the
  // template render exactly as before (empty catalog · no banner).
  const isOwnerViewer =
    viewerSession?.account.id === business.owner_account_id;
  const shouldShowOwnerEmptyPrompt = isOwnerViewer && products.length === 0;

  // Owner directive 2026-11-08 (round 5) · page-view tracer.
  // Fires EXACTLY ONCE per server render · no client callback · a
  // browser re-mount triggers a fresh server request so the semantics
  // stay "one view per real HTTP GET from a human". The owner is NOT
  // counted when they view their own shop (prevents inflated
  // self-views).
  //
  // All of the tracer logic is fail-soft · a Supabase blip or a
  // missing migration 303 returns table_not_available and the page
  // continues to render normally. We do NOT await the result so the
  // tracer never blocks the user-visible render path.
  if (!isOwnerViewer) {
    try {
      const hdrs = await headers();
      const userAgent = hdrs.get("user-agent") ?? null;
      const botLikely = isLikelyBot(userAgent);
      const { tokenHash } = await resolveViewerToken();
      const country = resolveViewCountry({
        vercelIpCountry: hdrs.get("x-vercel-ip-country"),
        envCountry: process.env.NEX_APP_COUNTRY,
      });
      void recordPageView({
        businessId: business.id,
        pageType: "business",
        country,
        viewerTokenHash: tokenHash,
        viewerAccountId: viewerSession?.account.id ?? null,
        userAgentHash: userAgent ? sha256Hex(userAgent) : null,
        botLikely,
      });
    } catch {
      /* fail-soft · analytics never blocks the shop surface */
    }
  }

  // Resolve layout + tint + wallpaper with sensible fallbacks.
  const layoutId: CoverLayoutId =
    business.cover_layout_id &&
    isValidCoverLayoutId(business.cover_layout_id)
      ? (business.cover_layout_id as CoverLayoutId)
      : DEFAULT_LAYOUT;
  const accentHex =
    business.shop_cover_tint_hex &&
    /^#[0-9A-Fa-f]{6}$/.test(business.shop_cover_tint_hex)
      ? business.shop_cover_tint_hex
      : (themeRow?.accent_hex ?? "#C6A15B");
  const wallpaperUrl =
    business.shop_cover_image_url ?? themeRow?.hero_image_url ?? null;

  // Shape the real business + products into the CoverLayoutSwitch
  // content contract. Fields the owner hasn't filled fall back to
  // sensible blanks so the template still reads as a finished page.
  const coverProducts: CoverProduct[] = products.map((p) => ({
    id: p.id,
    slug: null,
    name: p.name,
    price_pence: p.price_pence,
    currency: p.currency,
    image_url: p.image_url,
    stock_status: p.stock_status,
    section_id: p.section_id ?? null,
    description: p.description,
  }));

  // Grouping placeholder · owners can add nex_product_section rows in
  // a follow-up · for now sections is empty so CoverCategoryTabs
  // hides itself (sections.length ≤ 1 returns null).
  const sections: CoverSection[] = [];

  const themeEmojis = themeRow
    ? await listThemeEmojis(themeRow.id).catch(() => [])
    : [];

  // Owner directive 2026-11-13 · socialHandles typed as
  // CoverSocialLinks · optional string fields · previously inferred as
  // `string | undefined` which didn't match the interface and produced
  // a wide excess-property error on the content object assignment.
  const socialHandles: CoverSocialLinks = {
    ...(business.instagram_handle ? { instagram: business.instagram_handle } : {}),
    ...(business.tiktok_handle ? { tiktok: business.tiktok_handle } : {}),
    ...(business.facebook_handle ? { facebook: business.facebook_handle } : {}),
    ...(business.public_phone ? { whatsapp: business.public_phone } : {}),
    ...(business.website_url ? { website: business.website_url } : {}),
  };

  const content = {
    ownerAccountId: business.owner_account_id,
    businessName: business.display_name,
    handle: business.slug ? `@${business.slug}` : "",
    tagline: "",
    portraitUrl: business.logo_url ?? "",
    location: coverContent?.city ?? "",
    presenceOnline: true,
    social: socialHandles,
    sections,
    sectionTitle: null,
    // business.shipping_scope is typed as `string | null` in the DB
    // layer; MockCoverContent requires the sealed enum. Narrow cast is
    // honest because business-service validates against
    // NEX_SHIPPING_SCOPES on write.
    shippingScope: (business.shipping_scope ?? null) as
      | "local_delivery"
      | "local_and_export"
      | "international_only"
      | "pickup_only"
      | "dine_in"
      | "digital"
      | null,
    products: coverProducts,
    services: [],
    reviews: [],
    aboutUs: business.description ?? null,
    paymentMethodLabels: business.accepted_payment_methods ?? [],
    returnPolicyBody: business.return_policy?.notes ?? null,
    eventsBody: null,
    galleryUrls: [],
    isVenue: false,
    qrCodeImageUrl: business.qr_code_image_url ?? null,
    acceptsQrisDelivery:
      (business.accepted_payment_methods ?? []).includes("qris_delivery"),
    yearEstablished: business.year_established ?? null,
    ownerName: null,
    ownerPosition: null,
    ownerAvatarUrl: null,
    hoursByDay: null,
    galleryImages: [],
    hours: business.hours_display ?? "",
    address: business.address ?? "",
    atmosphereLine: "",
    countryCode: ownerCountryIso,
    themeEmojis: themeEmojis.map((row) => ({
      slug: row.slug,
      imageUrl: row.image_url,
      label: row.label,
    })),
  };

  // Owner directive 2026-11-11 (SEO B2) · emit LocalBusiness +
  // BreadcrumbList JSON-LD so Google + AI assistants can parse this shop.
  // Zero fabricated ratings / reviews / prices · only fields that exist
  // on the row are surfaced.
  const localBusinessLd = renderJsonLd(
    buildLocalBusiness({
      slug: business.slug,
      displayName: business.display_name,
      description: business.description,
      logoUrl: business.logo_url,
      coverImageUrl: null,
      address: business.address,
      publicPhone: business.public_phone,
      publicEmail: business.public_email,
      websiteUrl: business.website_url,
    }),
  );
  const breadcrumbLd = renderJsonLd(
    buildBreadcrumbList([
      { name: "NEX", path: "/nex-native" },
      { name: "Directory", path: "/nex-native/directory" },
      { name: business.display_name, path: `/nex-native/${business.slug}` },
    ]),
  );

  // Owner directive 2026-11-11 (B2 closeout) · emit Product JSON-LD for
  // every LIVE product. Private/draft/archived statuses, missing names
  // and missing ids are silently dropped by the helper. Availability is
  // never inferred · only mapped when stock_status carries a known value.
  const productLds: readonly string[] = buildShopProductJsonLdStrings(
    business.slug,
    products,
  );

  return (
    <>
      {localBusinessLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: localBusinessLd }}
        />
      ) : null}
      {breadcrumbLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
        />
      ) : null}
      {productLds.map((body, i) => (
        <script
          key={`product-ld-${i}`}
          type="application/ld+json"
          data-nex-seo="product"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ))}
      <PhoneFrame>
        <CoverThemeSkin
          accentHex={accentHex}
          bubbleRimHex={themeRow?.bubble_rim_hex ?? accentHex}
          composerRimHex={themeRow?.composer_rim_hex ?? accentHex}
          wallpaperUrl={wallpaperUrl}
          wallpaperConfig={themeRow?.wallpaper_config ?? null}
          themeId={themeRow?.id ?? DEFAULT_THEME}
          layoutId={layoutId}
        >
          <CoverLayoutSwitch
            layoutId={layoutId}
            content={content}
            themeId={themeRow?.id ?? DEFAULT_THEME}
          />
        </CoverThemeSkin>
        <BurgerMenu
          ownerHandle={business.slug}
          address={business.address ?? null}
          hours={null}
          shopUrl={`/nex-native/${business.slug}`}
          accentHex={accentHex}
          content={coverContent}
        />
        {/* Owner-sealed 2026-11-13 · shop-to-customer contact flow ·
            tap routes signed-in visitors directly to peer chat with
            the owner; signed-out visitors see the registration popup
            that brings them back to /nex-native/<slug>?open-chat=1
            after authentication. */}
        <ShopChatFab
          ownerAccountId={business.owner_account_id}
          shopName={business.display_name}
          shopSlug={business.slug}
          isSignedIn={viewerSession !== null}
          accentHex={accentHex}
        />
        {/* Owner directive 2026-11-07 · ShopSideChatDrawer unmounted ·
            the top-left chat trigger was a duplicate entry point, the
            bottom-right ShopChatFab above already routes to the owner's
            chat page. File preserved in cover/_shop-side-chat-drawer.tsx
            for revert-safety but no longer rendered. */}
        {/* Owner directive 2026-11-06 readiness · owner-only empty-
            products prompt · sits above the sticky bottom of the
            shop surface, below the ShopChatFab. Only renders when
            viewer IS the shop owner AND products.length === 0.
            Everyone else sees the template render untouched. */}
        {shouldShowOwnerEmptyPrompt ? (
          <OwnerEmptyPrompt
            shopName={business.display_name}
            accentHex={accentHex}
          />
        ) : null}
        {/* Owner directive 2026-11-06 · product detail bottom sheet ·
            opens when the URL carries ?product=<id> · "Buy now · chat"
            routes the purchase into the owner's peer chat · Add to
            cart writes NEX_CART_STORAGE_KEY using the sealed
            NexCartItem shape so the HeaderCartIcon badge bumps
            immediately. */}
        <ProductDetailSheet
          products={coverProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price_pence: p.price_pence,
            currency: p.currency,
            image_url: p.image_url,
            description: p.description ?? null,
          }))}
          shopOwnerAccountId={business.owner_account_id}
          shopName={business.display_name}
          shopBusinessId={business.id}
          shopSlug={business.slug}
          acceptedPaymentMethods={
            (business.accepted_payment_methods ?? []) as ReadonlyArray<string>
          }
          acceptedPaymentLabels={
            (business.accepted_payment_methods ?? []) as ReadonlyArray<string>
          }
          shopQrCodeImageUrl={business.qr_code_image_url ?? null}
          accentHex={accentHex}
          /* Stage 4 · 2026-11-14 · when the viewer is NOT signed in,
             the "More Details" button opens an in-sheet registration
             popup (Create Free Account / Sign In) instead of doing a
             full-page bounce to /sign-in. Signed-in viewers skip the
             popup and submit straight through. */
          isSignedIn={viewerSession !== null}
        />
      </PhoneFrame>
    </>
  );
}

// Silence unused-import warnings in strict configs · COVER_LAYOUT_IDS
// is referenced only in the type guard call above.
void COVER_LAYOUT_IDS;

// ─── Owner-only empty-products prompt ─────────────────────────────────
// Owner directive 2026-11-06 readiness · when the owner views their
// own shop and products.length === 0, show a floating banner above
// the ShopChatFab with a direct link to /manage/products so they can
// add listings without hunting through the manage tree. Other
// viewers (customers · guests) see the template render as-is with
// an empty catalog — their path is to ask the owner in chat.

function OwnerEmptyPrompt({
  shopName,
  accentHex,
}: {
  shopName: string;
  accentHex: string;
}): React.JSX.Element {
  // Position : absolute scoped to the phone frame · sits above the
  // ShopChatFab (which is bottom-right 56×56 + safe-area). Non-blocking
  // pointer events outside the pill so the rest of the shop stays
  // tappable.
  return (
    <div
      aria-live="polite"
      data-nex-owner-empty-prompt
      style={{
        position: "absolute",
        left: 14,
        right: 86, // leave room for the ShopChatFab + its ring
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "rgba(5, 15, 28, 0.94)",
        border: `1px solid ${accentHex}`,
        borderRadius: 14,
        boxShadow: "0 12px 26px rgba(0,0,0,0.55)",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#F2F5F8",
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
        🛍
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 900,
            color: "var(--nex-world-cream, #FAF8F4)",
            letterSpacing: "-0.005em",
          }}
        >
          {shopName} is live · no products yet
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#B5C3D6",
            marginTop: 1,
            lineHeight: 1.35,
          }}
        >
          Customers can chat but can&rsquo;t buy until you list.
        </div>
      </div>
      <a
        href="/nex-native/manage/products"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "7px 12px",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#1A120A",
          background: accentHex,
          borderRadius: 999,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        + Add
      </a>
    </div>
  );
}
