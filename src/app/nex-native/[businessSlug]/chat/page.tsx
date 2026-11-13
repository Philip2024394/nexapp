// src/app/nex-native/[businessSlug]/chat/page.tsx
//
// Owner-sealed 2026-11-13 (iter 21) · anonymous-friendly chat entry.
// -----------------------------------------------------------------------------
// This is the NEW chat entry point for every shop. The sealed first-SEND
// gate lives here:
//
//   · Signed-in user          → redirect to /nex-native/<slug>?open-chat=1
//                                which calls getOrCreateBusinessConversation
//                                and lands them on /conversations/<id>.
//   · Anonymous visitor       → render an AnonymousChatPreview shell with
//                                the same visual chrome as the real
//                                conversation page (header, welcome bubble,
//                                products drawer, composer). The composer's
//                                send button intercepts the tap and shows
//                                the "Create free NEX account" registration
//                                popup. No conversation row is created and
//                                no message is sent server-side until the
//                                visitor completes sign-up.
//
// Supersedes the 2026-11-13 ShopChatFab anonymous-tap popup. The FAB now
// routes anonymous visitors here instead of showing the popup at tap time
// so they can SEE the shop chat UI (identity, welcome, products) BEFORE
// being asked to sign up.

import type * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { iso2FromPhoneCountryCode } from "@/lib/nex-native/country-catalogue";
import { AnonymousChatPreview } from "./_anon-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessSlug: string }>;
  // Owner directive 2026-11-13 (iter 22) · draft stash. The anon
  // preview popup carries ?draft=<base64 utf-8> into the signup
  // href. After signup completes the user returns here signed-in ·
  // we pass the draft on through to /<slug>?open-chat=1 which hands
  // it to the real conversation page for auto-send.
  searchParams?: Promise<{ draft?: string }>;
}

function countryCodeToFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return "";
  const up = iso2.toUpperCase();
  const base = 0x1f1e6;
  const a = up.charCodeAt(0);
  const b = up.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return (
    String.fromCodePoint(base + (a - 65)) +
    String.fromCodePoint(base + (b - 65))
  );
}

export default async function ShopChatEntryPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { businessSlug } = await params;
  const sp = (await searchParams) ?? {};
  const draftB64 = typeof sp.draft === "string" ? sp.draft : "";
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (session) {
    // Signed-in visitor · hand off to the real conversation creator.
    // Carry the draft through so the conversation page can auto-send.
    const q = draftB64
      ? `&draft=${encodeURIComponent(draftB64)}`
      : "";
    redirect(`/nex-native/${businessSlug}?open-chat=1${q}`);
  }

  // Anonymous visitor · render the preview shell. Load everything the
  // signed-in conversation page loads so the anonymous visitor sees
  // the same visual richness · just without a real message history.
  const [products, themeRow, ownerAccount] = await Promise.all([
    productService
      .listProductsByBusiness(business.id, "live")
      .catch(() => []),
    chatThemeService.getThemeById("nex-flat").catch(() => null),
    getAccountById(business.owner_account_id).catch(() => null),
  ]);

  const accentHex =
    business.shop_cover_tint_hex &&
    /^#[0-9A-Fa-f]{6}$/.test(business.shop_cover_tint_hex)
      ? business.shop_cover_tint_hex
      : (themeRow?.accent_hex ?? "#C6A15B");
  const wallpaperUrl =
    business.shop_cover_image_url ?? themeRow?.hero_image_url ?? null;
  const flagIso =
    business.operating_country_code ??
    iso2FromPhoneCountryCode(ownerAccount?.phone_country_code ?? null);
  const flagEmoji = countryCodeToFlag(flagIso);

  return (
    <AnonymousChatPreview
      businessSlug={business.slug}
      businessId={business.id}
      businessDisplayName={business.display_name}
      businessCategory={business.business_category ?? null}
      businessCity={business.city ?? null}
      businessLogoUrl={business.logo_url ?? null}
      wallpaperUrl={wallpaperUrl}
      accentHex={accentHex}
      flagEmoji={flagEmoji}
      flagIso={flagIso ?? null}
      shopProducts={products.map((p) => ({
        id: p.id,
        name: p.name,
        price_pence: p.price_pence,
        currency: p.currency,
        image_url: p.image_url,
      }))}
    />
  );
}
