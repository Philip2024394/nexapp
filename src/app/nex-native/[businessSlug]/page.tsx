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
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { getShopCoverContent } from "@/lib/nex-native/shop-cover-service";
import { CoverThemeSkin } from "../cover/theme-skin";
import { CoverLayoutSwitch } from "../cover/layout-switch";
import { BurgerMenu } from "../cover/_burger-menu";
import { ShopChatFab } from "../cover/_shop-chat-fab";
import { ShopSideChatDrawer } from "../cover/_shop-side-chat-drawer";
import { ProductDetailSheet } from "../cover/_product-detail-sheet";
import { PhoneFrame } from "../cover/preview/_phone-frame";
import {
  COVER_LAYOUT_IDS,
  isValidCoverLayoutId,
  type CoverLayoutId,
} from "../cover/layout-ids";
import type { CoverProduct, CoverSection } from "../cover/primitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback theme when the owner hasn't picked one (brand-new shop).
// Stays as nex-flat to match the themes-picker default.
const DEFAULT_THEME = "nex-flat";

// Fallback layout for owners who haven't run the themes picker yet.
const DEFAULT_LAYOUT: CoverLayoutId = "cafe";

interface PageProps {
  params: Promise<{ businessSlug: string }>;
}

export default async function PublicShopPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) {
    notFound();
  }

  // Parallel loads · all fail-soft so a transient Supabase blip
  // doesn't crash the shop surface.
  const [products, coverContent, themeRow] = await Promise.all([
    productService
      .listProductsByBusiness(business.id, "live")
      .catch(() => []),
    getShopCoverContent(business.id).catch(() => null),
    chatThemeService.getThemeById(DEFAULT_THEME).catch(() => null),
  ]);

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

  const socialHandles = {
    instagram: business.instagram_handle ?? undefined,
    tiktok: business.tiktok_handle ?? undefined,
    facebook: business.facebook_handle ?? undefined,
    whatsapp: business.public_phone ?? undefined,
    website: business.website_url ?? undefined,
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
    shippingScope: business.shipping_scope ?? null,
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
    countryCode: "IE",
    themeEmojis: themeEmojis.map((row) => ({
      slug: row.slug,
      imageUrl: row.image_url,
      label: row.label,
    })),
  };

  return (
    <>
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
        <ShopChatFab
          ownerHandle={business.owner_account_id}
          shopName={business.display_name}
          accentHex={accentHex}
        />
        <ShopSideChatDrawer
          shopName={business.display_name}
          shopOwnerAccountId={business.owner_account_id}
          accentHex={accentHex}
        />
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
          acceptedPaymentLabels={
            (business.accepted_payment_methods ?? []) as ReadonlyArray<string>
          }
          accentHex={accentHex}
        />
      </PhoneFrame>
    </>
  );
}

// Silence unused-import warnings in strict configs · COVER_LAYOUT_IDS
// is referenced only in the type guard call above.
void COVER_LAYOUT_IDS;
