"use client";

// src/app/nex-native/_cover/layouts.tsx
//
// 10 Founder-sealed cover layouts composed from primitives.
// -------------------------------------------------------------------
// Every layout consumes the SAME primitives from ./primitives · every
// layout wraps under <CoverThemeSkin> · so the theme's visual DNA
// (wallpaper + accent + charm + motion + card shape) flows through
// unchanged. What varies per layout: information architecture only.
//
// Layouts:
//   1. cafe             · portrait-half hero · featured today · atmosphere
//   2. restaurant       · full-photo hero · menu sections · reserve
//   3. product          · product hero · 2-col grid · shipping
//   4. tradesperson     · portrait + badges · services · before/after
//   5. salon            · signature look · services · reviews
//   6. creator          · circular portrait · mixed grid · links
//   7. fashion          · full-viewport carousel · big cards · fit CTA
//   8. street_food      · dish hero · dish rows · running cart
//   9. premium_business · weighted name · services + case studies + team
//  10. personal_brand   · half-portrait · products + services + content
//
// The doctrine test: Pink Dream × any of these must LOOK like the
// same brand. Emerald City × any must LOOK like Emerald City. Never
// like a website template.

import * as React from "react";
// Client-safe constants file (no "server-only" import) so this
// "use client" module can safely resolve the shipping-scope label
// without dragging Supabase into the browser bundle.
import { NEX_SHIPPING_SCOPE_META } from "@/lib/nex-native/shipping-scope";
import {
  CoverIdentityBadge,
  CoverSecondaryCTA,
  CoverSectionHeading,
  CoverProductGrid,
  CoverProductCard,
  CoverIdentityRail,
} from "./primitives";
// Owner-sealed 2026-11-13 · CoverComposer retired from every shop
// template (see the 10 removal comments inline). The component file
// stays on disk for the /cover/preview playground that still mounts
// it for internal design preview · retiring it there is a separate
// decision. Shop-to-customer contact now flows exclusively through
// the floating ShopChatFab bottom-right.
// Category Tabs (2026-09-30) · CoverCatalog wraps CoverProductGrid with the
// one-word category tab bar. Drop-in replacement for the primary product grid
// in each layout. Restaurant keeps its secondary "Signature mains" cut as a
// plain CoverProductGrid so the layout's identity survives.
import { CoverCatalog } from "./CoverCatalog";
import type { MockCoverContent } from "./mock-data";
import { terminologyForContent } from "./mock-data";
import {
  ShopLocaleProvider,
  useShopLocale,
} from "@/lib/nex-native/shop-locale/locale-context";
import {
  defaultCurrencyForCountry,
  type ShopCurrencyCode,
} from "@/lib/nex-native/shop-locale/data";
import { ShopCurrencySwitch } from "./_shop-currency-switch";

/**
 * Small helper that renders the translated shop UI chrome string
 * when inside a ShopLocaleProvider, or the English fallback when
 * the provider isn't mounted (e.g. preview playground).
 */
function LocalizedShopLabel({
  k,
  fallback,
}: {
  k: string;
  fallback: string;
}): React.JSX.Element {
  const locale = useShopLocale();
  return <>{locale ? locale.t(k) : fallback}</>;
}

interface LayoutProps {
  content: MockCoverContent;
  themeId: string;
}

const chatHref = (ownerAccountId: string) =>
  `/nex-native/chat/peer/${ownerAccountId}`;

// ─── 1 · Café ─────────────────────────────────────────────────────────

export function LayoutCafe({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 26 }}>
          {/* Founder direction 2026-09-30 · default eyebrow is "Services"
              (renameable per-seller in a future settings surface) · title
              resolves from shipping-scope enum (Migration 108) to one of
              the six NEX_SHIPPING_SCOPE_META labels · falls back to
              "Local Delivery" when unset. sectionTitle wins if present. */}
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          {/* Founder direction 2026-09-30 · pass ALL products · the
              CoverCatalog now paginates at 4 per page with prev/next
              controls. Category filter narrows within the pagination. */}
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        {/* Founder direction 2026-09-30 · replaced "today's atmosphere"
            quote with a Visit-Us panel · address is a Google Maps
            directions link (prefers lat/lng, falls back to text
            search) · hours of operation sit below. Seller edits the
            location via SellerLocationEditor on /manage/shop which
            persists lat/lng to nex_business.location_lat / _lng. */}
        {/* Owner-sealed 2026-11-13 · Visit Us card retired from the footer · address + hours now live only in the burger menu's Visit Us slider · socials below are the sole footer chrome. */}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 15 · Café · Round Products ──────────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 01 (Café)
// with one deliberate difference · product cards render as ROUND
// circles with the product name centred below and a magnifier button
// on the rim (50% in / 50% out). Every other block identical.

export function LayoutCafeRound({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="round"
          />
        </div>
        {/* Owner-sealed 2026-11-13 · Visit Us card retired from the footer · address + hours now live only in the burger menu's Visit Us slider · socials below are the sole footer chrome. */}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 11 · Accommodation ──────────────────────────────────────────────
// Owner directive 2026-10-20 · Phase 1 Accommodation · hospitality
// cover for homestays, villas, hotels, hostels. Composed from the
// SAME primitives as the sealed 10 layouts (CoverPage · identity ·
// section heading · CoverCatalog · Visit Us · identity rail ·
// composer) so Pink Dream × Accommodation reads as Pink Dream, Café
// × Accommodation reads as Café, etc.
//
// Differences from Café (deliberate · hospitality semantics):
//
//   · Section heading reads "Rooms & Suites" instead of "Services"
//     with a hospitality-flavoured fallback title.
//   · Amenities row sits above the Visit Us card · a compact chip
//     row with wifi · breakfast · parking · pool · AC glyphs.
//     Rendered unconditionally (same honest-null pattern as the Café
//     "today's atmosphere" quote prior) so the layout feels complete
//     even when the content loader hasn't surfaced per-amenity flags.
//   · "Check-in / Check-out" label replaces the Café hours clock.
//   · Everything else identical · theme skin + composer + identity
//     chrome unchanged · zero fork of CoverThemeSkin.

export function LayoutAccommodation({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Stay with us"}
            title={content.sectionTitle ?? "Rooms & Suites"}
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>

        {/* Amenities chip row · owner directive 2026-10-20 · a slim
            band of hospitality signals so visitors can scan the
            property's features at a glance. Content stays theme-
            agnostic · each chip picks up `--nex-accent` so every
            theme repaints the row in its own accent. */}
        <div
          data-nex-cover-accommodation-amenities
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
          aria-label="Amenities"
        >
          {[
            { label: "Wi-Fi", glyph: "📶" },
            { label: "Breakfast", glyph: "🍳" },
            { label: "Parking", glyph: "🅿️" },
            { label: "Air-con", glyph: "❄️" },
            { label: "Pool", glyph: "🏊" },
          ].map((a) => (
            <span
              key={a.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--nex-accent-faint)",
                border: "1px solid var(--nex-accent-soft)",
                color: "var(--nex-text)",
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <span aria-hidden>{a.glyph}</span>
              <span>{a.label}</span>
            </span>
          ))}
        </div>

        {/* Visit Us · same Google Maps directions pattern as Café ·
            label swapped to "Where you'll stay" and the hours row
            becomes a check-in / check-out line. */}
        {/* Owner-sealed 2026-11-13 · Visit Us card retired from the footer · address + hours now live only in the burger menu's Visit Us slider · socials below are the sole footer chrome. */}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
      {/* Reference the terminology helper so the unused-var linter
          stays happy · future variants can swap labels per vertical. */}
      <span data-nex-terminology-key={t.section_location_label} hidden />
    </>
  );
}

// ─── 16 · Product Seller · Round Products ────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 03 (Product
// Seller) with one deliberate difference · product cards render as
// ROUND circles. Everything else identical.

export function LayoutProductRound({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>📦</span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="round"
          />
        </div>
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--nex-accent)", fontWeight: 700, marginBottom: 4 }}>Dispatch Times</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--nex-text, #F2F5F8)", whiteSpace: "normal" }}>{content.infoPages.delivery_details}</div>
          </section>
        )}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 17 · Product Seller Landscape · Round Products ──────────────────
// Founder direction 2026-09-30 · exact clone of Template 11 (Product
// Seller · Landscape) with the CoverCatalog variant flipped to
// "round". Note · because Template 11 differs from Template 03 only
// in the variant flag, this template renders identically to
// Template 16 when both are set to variant="round". Kept as a
// separate entry per founder request so admins can pick either
// clone lineage on /manage/shop.

export function LayoutProductLandscapeRound({ content, themeId }: LayoutProps): React.JSX.Element {
  return <LayoutProductRound content={content} themeId={themeId} />;
}

// ─── 12 · Café · Landscape ───────────────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 01 (Café) with
// a single deliberate difference · products render as landscape rows
// (image left · meta right · 6 per page) instead of the 4-per-page
// portrait grid. Every other block (identity, Visit Us, hours,
// identity rail, composer + info tray) is identical so a café seller
// can switch layouts without losing any of their configured data.

export function LayoutCafeLandscape({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="landscape"
          />
        </div>
        {/* Owner-sealed 2026-11-13 · Visit Us card retired from the footer · address + hours now live only in the burger menu's Visit Us slider · socials below are the sole footer chrome. */}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 3 · Product seller ─────────────────────────────────────────────

export function LayoutProduct({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          {/* Founder direction 2026-09-30 · products-live count moves
              from the standalone stats strip to the right side of the
              All products heading · reads as a live badge on the
              section header. */}
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {/* Founder direction 2026-09-30 · 3D emoji glyph (renders
                    as a dimensional colour icon on iOS / Android / modern
                    browsers) instead of the flat stroke SVG. Same badge
                    layout · just swaps line-art for the platform's
                    native colour icon. */}
                <span
                  aria-hidden
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  📦
                </span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        {/* Founder direction 2026-09-30 · Dispatch Times block sits
            below the pagination row · reads from the same
            info_pages.delivery_details field that feeds the Info Tray
            Delivery panel · one source, two surfaces. Auto-hides when
            the seller hasn't set delivery details. */}
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Dispatch Times
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
                whiteSpace: "normal",
              }}
            >
              {content.infoPages.delivery_details}
            </div>
          </section>
        )}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 11 · Product Seller · Landscape ─────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 03 (Product
// Seller) with a single deliberate difference · products render as
// landscape rows (image left · meta right · 6 per page) instead of
// the 4-per-page portrait grid. Every other block (identity badge,
// Who-We-Are, All-products header, pagination, Dispatch Times,
// identity rail, composer + info tray) is identical so a seller can
// switch layouts without losing any of their configured data.

export function LayoutProductLandscape({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  aria-hidden
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  📦
                </span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="landscape"
          />
        </div>
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Dispatch Times
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
                whiteSpace: "normal",
              }}
            >
              {content.infoPages.delivery_details}
            </div>
          </section>
        )}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 15 · Product Seller · Hero Landscape ────────────────────────────
// Owner directive 2026-11-28 · new template built fresh at owner's
// explicit request ("create new page design for shops as i am asking
// template new"). Structurally identical to Template 11 (Product
// Seller · Landscape) with three deliberate differences:
//   1. Every landscape product card carries a vertical shop-brand
//      strip rendered on the LEFT edge (brandStripUrl forwarded from
//      MockCoverContent → CoverCatalog → CoverProductGrid →
//      CoverProductCard). Null = no strip, falls back to Template 11.
//   2. Pagination defaults to 8 cards per page (vs Template 11's 6)
//      so sellers with larger catalogs see a denser first page
//      without losing the landscape row density.
//   3. The ONLY layout that is wired to the shop's brand strip asset
//      today · other landscape layouts keep their original 6-per-page
//      tempo so nothing regresses.
// Every other block (identity badge, Who-We-Are, All-products header,
// pagination, Dispatch Times, identity rail) reads verbatim from
// Template 11 so a seller can switch between the two without losing
// configured data.

export function LayoutProductHeroLandscape({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  // Owner directive 2026-11-28 (third pass) · category dropdown drives
  // the catalog filter via controlled props so the parent owns the
  // active section id. Empty string = no filter (show every product).
  const [categoryId, setCategoryId] = React.useState<string>("");
  // Owner directive 2026-11-28 (fourth pass) · pass the shop's own
  // country as a seed to the locale provider so the first paint can
  // skip USD when the shop sits in Indonesia / Japan / etc. The IP-
  // derived suggestion still wins once the client handshake lands.
  const seedCurrency: ShopCurrencyCode | null = defaultCurrencyForCountry(
    content.countryCode ?? null,
  );
  return (
    <ShopLocaleProvider initialCurrency={seedCurrency}>
      <CoverPage>
        {/* Owner directive 2026-11-28 (sixth pass) · X-Rated Tool
            Belts design iteration · country flag badge removed
            (countryCode withheld) · "online now" + green dot removed
            (presenceOnline withheld) · city/country rendered as plain
            text directly under the hero logo WITHOUT the 📍 pin glyph
            (hideLocationPin · location still threaded so the string
            comes from content, which the shop page slug-overrides to
            "Yogyakarta, Indonesia" for X-Rated). Every other template
            that calls CoverIdentityBadge keeps its full badge. */}
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          location={content.location}
          headerLogoUrl={content.headerLogoUrl ?? null}
          hideLocationPin
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          {/* Owner directive 2026-11-28 (ninth pass) · "Products"
              heading removed · Currency + Categories now sit on a
              SINGLE row as two sibling dropdown buttons with matching
              ▾ chevrons. Both drive the catalog beneath · currency
              → price formatting + shop UI language via
              ShopLocaleProvider · categories → catalog filter via
              controlled categoryId. */}
          <div
            data-nex-cover-products-header-row
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {/* Owner directive 2026-11-28 (tenth pass) · categories
                moves to the LEFT and both buttons share the row 50/50
                via flex:1 so they read as a matched pair. ShopCurrencySwitch
                is wrapped in a scoped style override so its chrome
                stretches to fill its half of the row (its default
                stylesheet is width-auto).
                Thirty-ninth pass · currency switch moved OUT of the
                header row and into the side drawer so the header reads
                as a single Categories control. Categories now spans
                the row. */}
            <div
              data-nex-cover-product-select
              style={{
                display: "flex",
                alignItems: "center",
                // Owner directive 2026-11-28 (twenty-third pass) · no
                // button chrome at all · plain gray text + gray icon
                // so the controls read as quiet metadata rather than
                // call-to-actions.
                padding: 0,
                borderRadius: 0,
                border: "none",
                background: "transparent",
                height: 40,
                flex: "1 1 100%",
                minWidth: 0,
                gap: 8,
              }}
            >
              {/* Owner directive 2026-11-28 (twelfth pass) · 2x2 grid of
                  four small white squares sits to the LEFT of the label.
                  Button background is now orange (owner-sealed) and the
                  chevron flips to white so the drop-affordance still
                  reads against the orange surface. */}
              <span
                aria-hidden
                data-nex-cover-cat-icon
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "1fr 1fr",
                  gap: 2,
                  width: 12,
                  height: 12,
                  flexShrink: 0,
                }}
              >
                <span style={{ display: "block", background: "#000000", borderRadius: 1 }} />
                <span style={{ display: "block", background: "#000000", borderRadius: 1 }} />
                <span style={{ display: "block", background: "#000000", borderRadius: 1 }} />
                <span style={{ display: "block", background: "#000000", borderRadius: 1 }} />
              </span>
              <CategorySelectLocalized
                value={categoryId}
                onChange={setCategoryId}
                sections={content.sections}
              />
              <span
                aria-hidden
                style={{
                  display: "none",
                }}
              >
                ▾
              </span>
            </div>
            {/* Thirty-ninth pass · ShopCurrencySwitch removed from
                this row · lives inside the side drawer now (see
                `_burger-menu.tsx`). */}
          </div>
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="landscape"
            textOnly
            hideTabs
            controlledActiveId={categoryId}
            onActiveIdChange={setCategoryId}
          />
        </div>
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Dispatch Times
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
                whiteSpace: "normal",
              }}
            >
              {content.infoPages.delivery_details}
            </div>
          </section>
        )}
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
    </ShopLocaleProvider>
  );
}

// Owner directive 2026-11-28 (fourth pass) · category select that
// re-reads the shop UI language so the "All categories" placeholder
// swaps to the buyer-picked language. Styling identical to the
// previous inline <select> so no other visual regression.
function CategorySelectLocalized({
  value,
  onChange,
  sections,
}: {
  value: string;
  onChange: (next: string) => void;
  sections: ReadonlyArray<{ id: string; name: string; sort_order?: number }>;
}): React.JSX.Element {
  const locale = useShopLocale();
  const allLabel = "Categories";
  const ariaLabel = locale ? locale.t("select_category") : "Select category";
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{
        flex: 1,
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        color: "var(--nex-accent, #F97316)",
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "inherit",
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        cursor: "pointer",
      }}
    >
      <option
        value=""
        style={{ background: "#111111", color: "#F97316" }}
      >
        {allLabel}
      </option>
      {sections.map((s) => (
        <option
          key={s.id}
          value={s.id}
          style={{ background: "#111111", color: "#F97316" }}
        >
          {s.name}
        </option>
      ))}
    </select>
  );
}

// ─── 10 · Personal Brand ────────────────────────────────────────────

export function LayoutPersonalBrand({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        {/* Founder direction 2026-09-30 · replaced the custom rectangular
            portrait + inline text with the shared CoverIdentityBadge so
            Personal Brand carries the same round portrait, green ping
            ring, green ONLINE NOW marker, and country flag as Templates
            01 (Café) and 03 (Product Seller). ONE NEX IDENTITY doctrine
            · every template presents the same identity signature. */}
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        {/* Founder direction 2026-09-30 · "Our Journey" · 7-line story
            block · reuses the WhoWeAreCollapsible primitive with a
            custom eyebrow. Body pulls from content.aboutUs (falls back
            to tagline). Buyers who want the full story tap the +
            button to open the About Us panel in the info tray. */}
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        {/* Founder direction 2026-09-30 · Personal Brand tab system.
            Replaces the standalone Shop/Products/Services/Testimonials
            sections + static QuickPill row. Four top-level tabs govern
            the middle of the page. Products tab exposes four sub-tabs
            (Products / Images / Sizes / Ordering) so buyers can browse
            the shop from multiple angles without leaving the cover. */}
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            // Owner-sealed 2026-11-13 · productsFooter retired · it
            // previously held the Visit Us card which is now removed
            // from every shop template · socials via CoverIdentityRail
            // below carry the remaining footer chrome.
            productsFooter={null}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── Shared layout primitives (local to this file) ──────────────────

/**
 * WhoWeAreCollapsible · Template 03 header block. Renders the seller's
 * About-Us story (from content.aboutUs) inside a themed rounded panel.
 * The body is clamped to 7 lines by default · a right-side chevron
 * toggles the full text open. Chevron auto-hides when the body is
 * short enough to render fully at the initial cap.
 *
 * Founder direction 2026-09-30 · Template 03 replaces the "Featured"
 * product-hero card with this "Who We Are" block. Body text pulls from
 * the same nex_business.description column that feeds the Info Tray
 * About Us panel · authoring the story once fills both surfaces.
 */
/** Convert 24-hour "HH:MM" to a compact 12-hour label ("7am", "9:30pm").
 *  Founder direction 2026-09-30 · lowercase am/pm · no space between
 *  number and suffix · omit the ":00" on the hour · so "07:00" reads
 *  as "7am" and "07:30" reads as "7:30am". */
function formatTime12(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? "0");
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  const ampm = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m > 0 ? `${hour12}:${String(m).padStart(2, "0")}${ampm}` : `${hour12}${ampm}`;
}

/** Compact "9am - 10pm" style label for TODAY, derived from a
 *  WeeklyHours structure. Falls back to the seller's free-text
 *  content.hours string when hoursByDay isn't populated · returns
 *  null when today is closed. */
function formatTodayHoursLabel(
  hoursByDay:
    | {
        mon?: { open?: string | null; close?: string | null; closed?: boolean };
        tue?: { open?: string | null; close?: string | null; closed?: boolean };
        wed?: { open?: string | null; close?: string | null; closed?: boolean };
        thu?: { open?: string | null; close?: string | null; closed?: boolean };
        fri?: { open?: string | null; close?: string | null; closed?: boolean };
        sat?: { open?: string | null; close?: string | null; closed?: boolean };
        sun?: { open?: string | null; close?: string | null; closed?: boolean };
      }
    | null
    | undefined,
  fallbackText: string | null | undefined,
): string | null {
  if (hoursByDay) {
    const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = hoursByDay[keys[new Date().getDay()]];
    if (today) {
      if (today.closed === true) return "Closed today";
      const open = formatTime12(today.open);
      const close = formatTime12(today.close);
      if (open && close) return `${open} - ${close}`;
    }
  }
  const raw = (fallbackText ?? "").trim();
  return raw.length > 0 ? raw : null;
}

function WhoWeAreCollapsible({
  body,
  hoursLabel,
  title = "Who We Are",
}: {
  body: string;
  hoursLabel?: string | null;
  /** Founder direction 2026-09-30 · optional header override. Default
   *  "Who We Are" (used by Templates 03 + 11 for Product Sellers) ·
   *  Template 10 Personal Brand overrides to "Our Journey". Same
   *  visual · same 7-line clip · only the eyebrow text differs. */
  title?: string;
}): React.JSX.Element | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  // Founder direction 2026-09-30 (final) · 7-line hard clip, no
  // chevron. The cover is a SCAN surface · the Info Tray About Us
  // panel is the READ-the-full-story surface. Buyers who want the
  // whole thing tap the + button. Sellers writing longer stories
  // get clipped with an ellipsis · that's the intended discipline.
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--nex-accent)",
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        {hoursLabel && (
          <div
            aria-label={`Today's hours ${hoursLabel}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--nex-accent)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* Founder direction 2026-09-30 · 3D emoji clock (renders
                as a dimensional colour icon on iOS / Android / modern
                browsers) instead of the flat stroke SVG. Matches the
                📦 badge pattern in the All products heading. */}
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
              🕐
            </span>
            <span>{hoursLabel}</span>
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--nex-text, #F2F5F8)",
          whiteSpace: "normal",
          display: "-webkit-box",
          WebkitLineClamp: 7,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {trimmed}
      </div>
    </section>
  );
}

// Owner directive 2026-10-22 · universal cart icon on every shop
// template. Reads NEX_CART_STORAGE_KEY from localStorage. Tap opens a
// theme-tinted slide-in drawer that lists cart items or shows the
// empty state. Checkout CTA routes to the sealed /nex-native/cart
// page where sendCartOrderAction posts the order into the owner's
// chat. Updated 2026-10-22 · in-place drawer replaces direct nav so
// the buyer stays in the shop while reviewing their cart.

export interface CoverCartLineItem {
  key: string;
  name: string;
  image_url: string | null;
  price_pence: number;
  currency: string;
  quantity: number;
  shop_display_name: string;
}

export function readCartItems(): CoverCartLineItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("nex_cart_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      items?: Array<Partial<CoverCartLineItem>>;
    };
    return (parsed.items ?? []).flatMap((item): CoverCartLineItem[] => {
      if (
        typeof item?.key !== "string" ||
        typeof item?.name !== "string" ||
        typeof item?.price_pence !== "number" ||
        typeof item?.currency !== "string" ||
        typeof item?.quantity !== "number"
      ) {
        return [];
      }
      return [
        {
          key: item.key,
          name: item.name,
          image_url: typeof item.image_url === "string" ? item.image_url : null,
          price_pence: item.price_pence,
          currency: item.currency,
          quantity: item.quantity,
          shop_display_name:
            typeof item.shop_display_name === "string"
              ? item.shop_display_name
              : "Shop",
        },
      ];
    });
  } catch {
    return [];
  }
}

function formatCoverPrice(pence: number, currency: string): string {
  try {
    const major = pence / 100;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" || currency === "VND" ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${(pence / 100).toFixed(0)}`;
  }
}

// Owner directive 2026-10-22 · delivery-aware cart footer. Reads the
// delivery prototype's localStorage so the drawer footer can show
// an honest line ("Pickup only", "Confirmed at checkout",
// "Delivery confirmed at order") based on whether the owner has set
// their policy. The precise per-zone price is resolved on the sealed
// /nex-native/cart page where the buyer enters their destination.
type DeliverySummary =
  | { kind: "unset"; label: "Delivery confirmed at order" }
  | { kind: "pickup"; label: "Pickup only" }
  | { kind: "will-quote"; label: "Confirmed at checkout" };

function readDeliverySummary(): DeliverySummary {
  if (typeof window === "undefined") {
    return { kind: "unset", label: "Delivery confirmed at order" };
  }
  try {
    const raw = window.localStorage.getItem(
      "nex-delivery-prototype-policy-v1",
    );
    if (!raw) return { kind: "unset", label: "Delivery confirmed at order" };
    const parsed = JSON.parse(raw) as {
      pickupOnly?: boolean;
      offersBike?: boolean;
      offersCargo?: boolean;
      cargoZones?: Array<{ priceIdr?: number }>;
    };
    if (parsed.pickupOnly) return { kind: "pickup", label: "Pickup only" };
    const hasBike = Boolean(parsed.offersBike);
    const hasCargo =
      Boolean(parsed.offersCargo) &&
      Array.isArray(parsed.cargoZones) &&
      parsed.cargoZones.length > 0;
    if (hasBike || hasCargo) {
      return { kind: "will-quote", label: "Confirmed at checkout" };
    }
    return { kind: "unset", label: "Delivery confirmed at order" };
  } catch {
    return { kind: "unset", label: "Delivery confirmed at order" };
  }
}

function CoverCartButton(): React.JSX.Element {
  const [items, setItems] = React.useState<CoverCartLineItem[]>([]);
  const [open, setOpen] = React.useState<boolean>(false);

  const refresh = React.useCallback(() => {
    setItems(readCartItems());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nex_cart_v1") refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!open) return;
    refresh();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  // Owner directive 2026-10-22 · when the shop template renders inside
  // the marketplace prototype iframe, the ⓘ info button + layout nav
  // + detail card live on the OUTER ShopPreviewSheet (parent window)
  // and would otherwise overlay the cart drawer. PostMessage to the
  // parent so it can hide those overlays while the drawer is open.
  // No-op when not in an iframe · production shop pages have no
  // outer overlay to collide with.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;
    try {
      window.parent.postMessage(
        { type: "nex-cover:cart-drawer-visibility", open },
        "*",
      );
    } catch {
      /* cross-origin block · silent · prototype-side only */
    }
  }, [open]);

  const count = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Cart · ${count} items` : "Cart · empty"}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-nex-cover-cart-button
        style={{
          // Owner directive 2026-11-12 · cart button shrunk again to
          // 26×26 (was 32). Still tap-friendly at 26 px when paired
          // with the sibling drawer "+" mounted outside the cover.
          position: "absolute",
          top: "max(env(safe-area-inset-top, 44px), 44px)",
          right: 20,
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.72)",
          border: "1px solid var(--nex-accent-soft)",
          color: "var(--nex-text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
          zIndex: 20,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          fontFamily: "inherit",
        }}
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx={9} cy={20} r={1.2} />
          <circle cx={18} cy={20} r={1.2} />
          <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" />
        </svg>
        {count > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              background: "var(--nex-accent)",
              color: "#031018",
              fontSize: 10,
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <CoverCartDrawer
          items={items}
          onClose={() => setOpen(false)}
          onRefresh={refresh}
        />
      )}
    </>
  );
}

export function CoverCartDrawer({
  items,
  onClose,
  onRefresh,
  themeAccent,
}: {
  readonly items: readonly CoverCartLineItem[];
  readonly onClose: () => void;
  readonly onRefresh: () => void;
  /** Owner directive 2026-10-22 · when rendered OUTSIDE a theme-skin
   *  wrapper (e.g. the chat ThemePreviewSheet right-dock Cart
   *  button) the drawer wraps its content in an inline style that
   *  sets the --nex-* CSS vars from this prop so the drawer still
   *  reads as part of the current theme. When omitted, the drawer
   *  inherits CSS vars from the surrounding theme-skin (the normal
   *  shop-template usage). */
  readonly themeAccent?: string;
}): React.JSX.Element {
  // Resolve the delivery summary from the delivery-prototype policy
  // every time the drawer opens · if the owner updates their policy
  // mid-session the drawer picks up the change on next open.
  const [delivery, setDelivery] = React.useState<DeliverySummary>(() =>
    readDeliverySummary(),
  );
  React.useEffect(() => {
    setDelivery(readDeliverySummary());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nex-delivery-prototype-policy-v1") {
        setDelivery(readDeliverySummary());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const subtotalByCurrency = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(
        it.currency,
        (map.get(it.currency) ?? 0) + it.price_pence * it.quantity,
      );
    }
    return Array.from(map.entries());
  }, [items]);

  const removeItem = React.useCallback(
    (key: string) => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem("nex_cart_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          items?: Array<{ key?: string }>;
        } & Record<string, unknown>;
        const next = {
          ...parsed,
          items: (parsed.items ?? []).filter((i) => i?.key !== key),
        };
        window.localStorage.setItem("nex_cart_v1", JSON.stringify(next));
        onRefresh();
      } catch {
        /* storage denied · silent */
      }
    },
    [onRefresh],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
      data-nex-cover-cart-drawer
      style={{
        // Owner directive 2026-10-22 (afternoon) · constrain the
        // drawer to the sealed .nex-native-frame phone column on
        // desktop (420px wide, centered). Previously `inset: 0`
        // made position:fixed anchor to the viewport, so on desktop
        // the drawer flew out to the right edge of the browser
        // window instead of staying inside the phone screen.
        //
        // left:50% + translateX(-50%) + width:100% + max-width:420
        // reproduces the frame's column: on real phones (<500px)
        // the viewport IS the frame and max-width is a no-op · on
        // desktop the drawer is pinned to the phone column.
        position: "fixed",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 420,
        // Owner directive 2026-10-22 · explicit dvh so the drawer
        // panel's children (header + scrollable body + footer) can
        // size against a known viewport height. 100dvh collapses
        // with the mobile browser chrome correctly so the footer
        // never hides below the fold.
        height: "100dvh",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
        // Inline CSS var injection · lets the drawer render in the
        // right theme accent when mounted OUTSIDE a theme-skin
        // wrapper (e.g. from ThemePreviewSheet's right-dock Cart
        // button). Omitted when themeAccent is undefined so the
        // normal shop-template path inherits from theme-skin.
        ...(themeAccent
          ? ({
              "--nex-accent": themeAccent,
              "--nex-accent-soft": `${themeAccent}5A`,
              "--nex-accent-faint": `${themeAccent}24`,
              "--nex-accent-glow": `${themeAccent}99`,
              "--nex-bg": "#050F1E",
              "--nex-text": "#F2F5F8",
            } as React.CSSProperties)
          : {}),
      }}
    >
      {/* Backdrop · tap to close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close cart"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.65)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      {/* Panel · slides in from the right · theme-tinted · full dvh
          so the sticky footer (subtotal + delivery + total +
          Checkout) is always visible without scrolling. */}
      <aside
        style={{
          position: "relative",
          width: "min(420px, 90vw)",
          maxWidth: "100%",
          height: "100dvh",
          maxHeight: "100dvh",
          background: "var(--nex-bg, #050F1E)",
          borderLeft: "1px solid var(--nex-accent-soft)",
          boxShadow: "-20px 0 50px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          color: "var(--nex-text, #F2F5F8)",
          fontFamily: "inherit",
          boxSizing: "border-box",
          // Belt-and-braces so flex children can't overflow and push
          // the footer out of view.
          overflow: "hidden",
        }}
      >
        {/* Header · theme eyebrow + close */}
        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) 16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderBottom: "1px solid var(--nex-accent-soft)",
            background:
              "linear-gradient(180deg, var(--nex-accent-faint, rgba(0,175,255,0.08)) 0%, transparent 100%)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "var(--nex-accent)",
              }}
            >
              Your cart
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: -0.2,
                marginTop: 2,
                color: "var(--nex-text, #F2F5F8)",
              }}
            >
              {items.length === 0
                ? "No items yet"
                : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid var(--nex-accent-soft)",
              color: "var(--nex-text, #F2F5F8)",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </header>

        {/* Body · items list OR empty state. flex:1 min:0 lets the
            internal list scroll while the sticky footer stays pinned.
            Without minHeight:0, a tall items list would push the
            footer below the viewport. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: items.length === 0 ? "40px 20px" : "12px 14px",
            boxSizing: "border-box",
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--nex-text, #F2F5F8)",
                opacity: 0.75,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 10 }} aria-hidden>
                🛒
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                Your cart is empty
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  lineHeight: 1.5,
                  maxWidth: 240,
                  margin: "0 auto",
                }}
              >
                Tap any item in this shop to add it · it'll show up here.
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {items.map((it) => (
                <li
                  key={it.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderRadius: 12,
                    background: "rgba(2, 9, 20, 0.5)",
                    border: "1px solid var(--nex-accent-soft)",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: it.image_url
                        ? `url(${it.image_url}) center / cover no-repeat, #0A1526`
                        : "linear-gradient(135deg, var(--nex-accent-faint, rgba(0,175,255,0.14)), #0A1526)",
                      border: "1px solid var(--nex-accent-soft)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--nex-text, #F2F5F8)",
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--nex-accent)",
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      {it.quantity} × {formatCoverPrice(it.price_pence, it.currency)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    aria-label={`Remove ${it.name}`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid rgba(255, 51, 85, 0.4)",
                      color: "#FF3355",
                      fontSize: 16,
                      cursor: "pointer",
                      flexShrink: 0,
                      lineHeight: 1,
                      fontFamily: "inherit",
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer · subtotal · delivery · total · checkout. Delivery
            row is honest · if the owner has set a policy the drawer
            says "Pickup only" or "Confirmed at checkout"; if nothing
            is set yet it says "Delivery confirmed at order" so the
            buyer knows the owner will reach out to confirm. */}
        <footer
          style={{
            padding:
              "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            borderTop: "1px solid var(--nex-accent-soft)",
            background:
              "linear-gradient(0deg, var(--nex-accent-faint, rgba(0,175,255,0.08)) 0%, transparent 100%)",
            display: "grid",
            gap: 10,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          {/* Owner directive 2026-10-22 · footer summary always renders
              (even when cart is empty) so the owner can review the
              buyer's checkout layout while deciding on the shop template
              flow. Subtotal shows "—" when empty; delivery row reflects
              the owner's declared policy so they can see what the buyer
              will read before paying. */}
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: 13,
                color: "var(--nex-text, #F2F5F8)",
                opacity: 0.8,
              }}
            >
              <span>Subtotal</span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--nex-text, #F2F5F8)",
                  letterSpacing: -0.2,
                }}
              >
                {subtotalByCurrency.length === 0
                  ? "—"
                  : subtotalByCurrency
                      .map(([currency, cents]) =>
                        formatCoverPrice(cents, currency),
                      )
                      .join(" · ")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: 13,
                color: "var(--nex-text, #F2F5F8)",
                opacity: 0.8,
              }}
            >
              <span>Delivery</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    delivery.kind === "pickup"
                      ? "var(--nex-accent)"
                      : "var(--nex-text, #F2F5F8)",
                  opacity: delivery.kind === "pickup" ? 1 : 0.75,
                }}
              >
                {delivery.label}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: 13,
                color: "var(--nex-text, #F2F5F8)",
                paddingTop: 6,
                borderTop: "1px dashed var(--nex-accent-soft)",
              }}
            >
              <span style={{ fontWeight: 800 }}>Total</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "var(--nex-accent)",
                  letterSpacing: -0.2,
                }}
              >
                {subtotalByCurrency.length === 0
                  ? "—"
                  : subtotalByCurrency
                      .map(([currency, cents]) =>
                        formatCoverPrice(cents, currency),
                      )
                      .join(" · ")}
                {items.length > 0 &&
                (delivery.kind === "will-quote" ||
                  delivery.kind === "unset")
                  ? " + delivery"
                  : ""}
              </span>
            </div>
          </div>
          <a
            href="/nex-native/cart"
            aria-disabled={items.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              padding: "0 16px",
              borderRadius: 12,
              background:
                items.length === 0
                  ? "rgba(255, 255, 255, 0.08)"
                  : "var(--nex-accent, #00AFFF)",
              color: items.length === 0 ? "rgba(255,255,255,0.5)" : "#031018",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: 0.3,
              boxShadow:
                items.length === 0
                  ? "none"
                  : "0 8px 20px -8px var(--nex-accent-glow, rgba(0,175,255,0.6))",
              pointerEvents: items.length === 0 ? "none" : "auto",
              fontFamily: "inherit",
            }}
          >
            {items.length === 0 ? "Add items to checkout" : "Checkout →"}
          </a>
          <div
            style={{
              fontSize: 10,
              color: "var(--nex-text, #F2F5F8)",
              opacity: 0.55,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Your order posts to the shop's chat · owner confirms stock
            and dispatch before you pay.
          </div>
        </footer>
      </aside>
    </div>
  );
}

function CoverPage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        maxWidth: 720,
        margin: "0 auto",
        // Founder direction 2026-09-30 (revised) · header must clear
        // the iPhone/Android earpiece / notch / dynamic island AND the
        // simulated 38px notch in the preview PhoneFrame. Real iOS
        // devices fire env(safe-area-inset-top) via viewportFit:cover
        // (set in src/app/nex-native/layout.tsx); the 44px fallback
        // matches the iOS status bar height + clears the sim notch.
        paddingTop:
          "max(env(safe-area-inset-top, 44px), 44px)",
        paddingRight: 20,
        paddingLeft: 20,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 96px)",
      }}
    >
      {/* Owner directive 2026-11-12 · CoverCartButton removed from the
          shop template header per owner feedback ("move the remove the
          button from cart icon in header shop templates"). The buyer
          still has /nex-native/cart as a direct route and the My
          Orders row in the global drawer. CoverCartButton function
          + drawer kept on disk for possible later reinstatement. */}
      {children}
    </div>
  );
}

// ─── 13 · Personal Brand · Landscape ─────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 10 (Personal
// Brand) with a single deliberate difference · product cards in the
// Products tab render as landscape rows (image left · meta right · 6
// per page) instead of the 2-column portrait grid. Every other block
// (identity, Our Journey, tabs, Images, Sizes, Ordering, Visit Us,
// identity rail, composer + info tray) is identical.

export function LayoutPersonalBrandLandscape({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            productsVariant="landscape"
            // Owner-sealed 2026-11-13 · productsFooter retired per the
            // Visit Us footer removal directive.
            productsFooter={null}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── 14 · Personal Brand · Round Products ────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 13 (Personal
// Brand · Landscape) with a single deliberate difference · product
// cards in the Products tab render as ROUND circles with the product
// name centred below and a small magnifier button on the image rim.
// Every other block (identity, Our Journey, tabs, Images, Sizes,
// Ordering, Visit Us, identity rail, composer + info tray) is identical.

export function LayoutPersonalBrandRound({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
          location={content.location}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            productsVariant="round"
            // Owner-sealed 2026-11-13 · productsFooter retired per the
            // Visit Us footer removal directive.
            productsFooter={null}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      {/* Owner-sealed 2026-11-13 · CoverComposer (footer text-input +
          emoji picker + info-tray + first-message POST) retired from
          every shop template. Shop-to-customer contact is now handled
          exclusively by the floating ShopChatFab bottom-right, which
          opens peer chat with the shop owner's intro bubble as the
          first message. Address / hours / policies are accessible via
          the burger menu's "Visit us" slider · no duplicate info-tray
          surface. Keeping the import so the module stays warm for the
          /cover/preview playground, which still mounts the composer
          for internal design previews only. */}
    </>
  );
}

// ─── Personal Brand · tabbed content ─────────────────────────────────
// Founder direction 2026-09-30 · Template 10 organises its middle
// content into four flat tabs · Products · Images · Sizes · Ordering.
// Buyers can look at the shop from multiple angles without leaving
// the cover. No nested sub-tabs · one level of navigation only.

type PersonalBrandTab = "products" | "images" | "sizes" | "ordering";

function PersonalBrandTabs({
  products,
  peerAccountId,
  orderingCopy,
  productsFooter,
  productsVariant = "grid",
  galleryImages,
}: {
  products: MockCoverContent["products"];
  peerAccountId: string;
  orderingCopy: string | null;
  /** Founder direction 2026-09-30 · rendered ONLY when the Products
   *  tab is active, below the paginated grid. Used by Template 10 to
   *  slot the Visit Us block under the products pagination without
   *  it appearing on the Images / Sizes / Ordering tabs. */
  productsFooter?: React.ReactNode;
  /** Founder direction 2026-09-30 · "landscape" flips the CoverCatalog
   *  cards to a single-column landscape list (Template 13) · "round"
   *  flips them to a 3-column round-image grid (Template 14). */
  productsVariant?: "grid" | "landscape" | "round";
  /** Bridge Gallery-C · real seller-uploaded gallery images from
   *  nex_gallery_image (Migration 111). When empty the Images tab
   *  renders 18 IMAGE HERE placeholder tiles. */
  galleryImages?: MockCoverContent["galleryImages"];
}): React.JSX.Element {
  const [tab, setTab] = React.useState<PersonalBrandTab>("products");
  const realGalleryImages = galleryImages ?? [];

  const tabs: { id: PersonalBrandTab; label: string }[] = [
    { id: "products", label: "Products" },
    { id: "images", label: "Images" },
    { id: "sizes", label: "Sizes" },
    { id: "ordering", label: "Ordering" },
  ];

  return (
    <div>
      {/* Four flat tabs · pill buttons · active fills with accent */}
      <div
        role="tablist"
        aria-label="Personal brand sections"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 6,
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.id)}
              style={{
                appearance: "none",
                padding: "9px 6px",
                borderRadius: 10,
                border: isActive
                  ? "1px solid var(--nex-accent)"
                  : "1px solid var(--nex-accent-soft)",
                background: isActive
                  ? "var(--nex-accent)"
                  : "var(--nex-accent-faint)",
                color: isActive ? "#03101D" : "var(--nex-text)",
                fontFamily: "var(--nex-font-body, inherit)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.02em",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "products" && (
        // Founder direction 2026-09-30 · Products tab under Personal
        // Brand uses CoverCatalog so it inherits the pagination row
        // (page numbers + prev / next arrow buttons). No sections
        // passed so the category-tab bar auto-hides · we deliberately
        // stripped Meal/Snack/Drinks tabs from this template earlier.
        <>
          <CoverCatalog
            sections={[]}
            products={products}
            peerAccountId={peerAccountId}
            columns={2}
            pageSize={6}
            variant={productsVariant}
          />
          {productsFooter}
        </>
      )}
      {tab === "images" && (
        <ImagePlaceholderGallery
          totalTiles={18}
          realImages={realGalleryImages}
        />
      )}
      {tab === "sizes" && <SizesPanel />}
      {tab === "ordering" && <OrderingPanel body={orderingCopy} />}
    </div>
  );
}

/**
 * ImagePlaceholderGallery · Founder direction 2026-09-30 (revised) ·
 * 3x3 grid with ‹ prev · next › pagination + tap-to-open lightbox.
 *
 * Bridge Gallery-C · when `realImages` is non-empty the tiles render
 * SELLER-UPLOADED photography with real captions + long descriptions
 * from nex_gallery_image (Migration 111). When `realImages` is empty
 * (previews without a business AND real businesses that haven't
 * uploaded yet) the grid falls back to `totalTiles` IMAGE HERE
 * placeholder tiles so the surface shape reads clearly.
 */
function ImagePlaceholderGallery({
  totalTiles,
  realImages = [],
}: {
  totalTiles: number;
  realImages?: NonNullable<MockCoverContent["galleryImages"]>;
}): React.JSX.Element {
  const hasReal = realImages.length > 0;
  const PAGE = 9;
  const [page, setPage] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(
    null,
  );
  // Real gallery drives pagination when present · falls back to
  // placeholder tile count otherwise. Never fewer than 1 page so the
  // component always renders something.
  const totalItems = hasReal ? realImages.length : totalTiles;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE;
  const visibleCount = Math.min(PAGE, totalItems - start);
  const canPrev = safePage > 0;
  const canNext = safePage < totalPages - 1;

  const nameFor = (i: number) =>
    hasReal
      ? realImages[i]?.caption?.trim() || `Image ${String(i + 1).padStart(2, "0")}`
      : `Photo ${String(i + 1).padStart(2, "0")}`;
  const skuFor = (i: number) =>
    hasReal
      ? realImages[i]?.id?.slice(0, 8) ?? ""
      : `MDL-${String.fromCharCode(65 + Math.floor(i / 10))}-${String(
          (i % 10) + 1,
        ).padStart(3, "0")}`;

  // Fallback captions + long descriptions when no real gallery images
  // exist. Real seller data supersedes these via the realImages prop.
  const placeholderCaptions = Array.from(
    { length: 18 },
    (_, i) => `Photo caption ${String(i + 1).padStart(2, "0")}`,
  );
  const placeholderLongDescriptions = Array.from(
    { length: 18 },
    (_, i) =>
      `This is where the full description for photo ${String(i + 1).padStart(
        2,
        "0",
      )} lives · sellers write what the image shows, why it matters, and any context a buyer might want. Talk about the process, the people, the place, the material · whatever the picture actually captures. Keep it a paragraph or two so it reads calmly on a phone screen. The lightbox clamps at seven lines so long copy never pushes the surface off-screen · buyers who want more tap the composer to ask directly. This whole block is placeholder text so the founder sees the SHAPE of the long-description slot before real sellers author their own words.`,
  );

  const captionFor = (i: number) =>
    hasReal
      ? realImages[i]?.caption?.trim() || placeholderCaptions[i % 18]
      : placeholderCaptions[i % 18];
  const descriptionFor = (i: number) =>
    hasReal
      ? realImages[i]?.longDescription?.trim() ||
        placeholderLongDescriptions[i % 18]
      : placeholderLongDescriptions[i % 18];
  const imageUrlFor = (i: number) =>
    hasReal ? realImages[i]?.imageUrl : null;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {Array.from({ length: visibleCount }).map((_, i) => {
          const globalIndex = start + i;
          const realUrl = imageUrlFor(globalIndex);
          return (
            <div
              key={`tile-${globalIndex}`}
              style={{ display: "grid", gap: 6 }}
            >
              <button
                type="button"
                aria-label={`Open ${nameFor(globalIndex)}`}
                onClick={() => setLightboxIndex(globalIndex)}
                style={{
                  appearance: "none",
                  padding: 0,
                  aspectRatio: "1 / 1",
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid var(--nex-accent-soft)",
                  background: "#0a1120",
                  backgroundImage: realUrl ? `url(${realUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 180ms ease, box-shadow 180ms ease",
                }}
              >
                {!realUrl && (
                  <>
                    <svg
                      aria-hidden
                      width="100%"
                      height="100%"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0.22,
                      }}
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="100"
                        y2="100"
                        stroke="currentColor"
                        strokeWidth="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1="100"
                        y1="0"
                        x2="0"
                        y2="100"
                        stroke="currentColor"
                        strokeWidth="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <span
                      style={{
                        position: "relative",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.14em",
                        color: "var(--nex-text-dim)",
                        textAlign: "center",
                        padding: "2px 6px",
                        background: "#03101D",
                        borderRadius: 4,
                      }}
                    >
                      IMAGE HERE
                    </span>
                  </>
                )}
              </button>
              {/* Founder direction 2026-09-30 · description caption
                  under each tile · varied mock text per index so the
                  founder sees the varying-length layout. Tap the tile
                  to open the lightbox with a 7-line long description. */}
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: "var(--nex-text-dim)",
                  textAlign: "center",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                  minHeight: 26,
                }}
              >
                {captionFor(globalIndex)}
              </div>
            </div>
          );
        })}
        {/* Balance the last row when the final page is short. */}
        {Array.from({ length: PAGE - visibleCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden
            style={{ display: "grid", gap: 6 }}
          >
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 10,
                border: "1px dashed var(--nex-accent-soft)",
                opacity: 0.25,
              }}
            />
            <div style={{ minHeight: 26 }} />
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <GalleryArrow
            direction="prev"
            disabled={!canPrev}
            onClick={() => canPrev && setPage(safePage - 1)}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--nex-text-dim)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {safePage + 1} / {totalPages}
          </div>
          <GalleryArrow
            direction="next"
            disabled={!canNext}
            onClick={() => canNext && setPage(safePage + 1)}
          />
        </div>
      )}

      {lightboxIndex !== null && (
        <ImagePlaceholderLightbox
          name={nameFor(lightboxIndex)}
          sku={skuFor(lightboxIndex)}
          description={descriptionFor(lightboxIndex)}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/**
 * ImagePlaceholderLightbox · fullscreen overlay opened when the buyer
 * taps an image tile. Founder direction 2026-09-30 · shows the
 * enlarged placeholder tile plus the mock product name and SKU/model
 * above it. Tap the backdrop or the × to close.
 */
function ImagePlaceholderLightbox({
  name,
  sku,
  description,
  onClose,
}: {
  name: string;
  sku: string;
  description: string;
  onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(3,8,20,0.92)",
        backdropFilter: "blur(12px) saturate(1.05)",
        WebkitBackdropFilter: "blur(12px) saturate(1.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "56px 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        {/* Header · name + SKU */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--nex-font-display)",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                color: "var(--nex-text)",
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              SKU · {sku}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              appearance: "none",
              width: 36,
              height: 36,
              borderRadius: "50%",
              // Founder direction 2026-09-30 · close button paints in
              // the active theme's accent · under Pink Dream that
              // reads as pink · under any other theme the button
              // picks up that theme's accent hex automatically.
              border: "1px solid var(--nex-accent)",
              background: "var(--nex-accent)",
              color: "#03101D",
              fontSize: 20,
              fontWeight: 800,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.45), 0 0 12px var(--nex-accent-glow, rgba(255,63,159,0.35))",
            }}
          >
            ×
          </button>
        </div>
        {/* Enlarged placeholder tile */}
        <div
          role="img"
          aria-label="Image placeholder"
          style={{
            aspectRatio: "1 / 1",
            width: "100%",
            borderRadius: 14,
            border: "1px solid var(--nex-accent-soft)",
            background: "#0a1120",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg
            aria-hidden
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              color: "var(--nex-accent, #FF3F9F)",
            }}
          >
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="100"
              y1="0"
              x2="0"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            style={{
              position: "relative",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.24em",
              color: "var(--nex-text-dim)",
              textAlign: "center",
              padding: "6px 14px",
              background: "#03101D",
              borderRadius: 6,
            }}
          >
            IMAGE HERE
          </span>
        </div>
        {/* Founder direction 2026-09-30 · 7-line long description
            below the enlarged tile. Sellers author the full body per
            image · placeholder text stops at ~7 lines with an
            ellipsis so long copy doesn't push the whole lightbox
            offscreen. Buyers who want to keep reading tap the chat
            composer to ask directly. */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--nex-text)",
            display: "-webkit-box",
            WebkitLineClamp: 7,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

function GalleryArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous images" : "Next images"}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "#000000",
        color: "var(--nex-accent, #FF3F9F)",
        fontFamily: "var(--nex-font-body, inherit)",
        fontSize: 18,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

/**
 * SizesPanel · Founder direction 2026-09-30 · placeholder list of
 * available sizes. Real sellers configure this via a future
 * /manage/sizes editor (queued). For now shows the common apparel
 * ladder so the Personal Brand demo reads meaningfully.
 */
function SizesPanel(): React.JSX.Element {
  const sizes = [
    { label: "XS", available: true },
    { label: "S", available: true },
    { label: "M", available: true },
    { label: "L", available: true },
    { label: "XL", available: true },
    { label: "XXL", available: false },
  ];
  return (
    <div>
      {/* Founder direction 2026-09-30 · size chart image placeholder ·
          sellers upload a fit chart (measurements, model wearing size,
          etc.) later via a future editor. Same IMAGE HERE treatment as
          the Images tab · solid navy tile with a diagonal cross and a
          SIZE CHART HERE caption. Wider than 1:1 to match the shape
          of a real fit chart. */}
      <div
        role="img"
        aria-label="Size chart placeholder"
        style={{
          aspectRatio: "3 / 2",
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--nex-accent-soft)",
          background: "#0a1120",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          position: "relative",
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <svg
          aria-hidden
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.22,
            color: "var(--nex-accent, #FF3F9F)",
          }}
        >
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="100"
            y1="0"
            x2="0"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          style={{
            position: "relative",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: "var(--nex-text-dim)",
            textAlign: "center",
            padding: "4px 10px",
            background: "#03101D",
            borderRadius: 5,
          }}
        >
          SIZE CHART HERE
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--nex-accent)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Available sizes
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sizes.map((s) => (
          <span
            key={s.label}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: s.available
                ? "1px solid var(--nex-accent-soft)"
                : "1px solid rgba(148,163,184,0.25)",
              background: s.available
                ? "var(--nex-accent-faint)"
                : "transparent",
              color: s.available
                ? "var(--nex-text)"
                : "var(--nex-text-dim)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textDecoration: s.available ? "none" : "line-through",
            }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * OrderingPanel · Founder direction 2026-09-30 · describes the order-
 * to-delivery flow. Body pulls from info_pages.delivery_details when
 * the seller has authored it · falls back to the default four-step
 * NEX flow so every buyer sees a clear path.
 */
function OrderingPanel({ body }: { body: string | null }): React.JSX.Element {
  const trimmed = body?.trim();
  if (trimmed && trimmed.length > 0) {
    return (
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--nex-text)",
          whiteSpace: "pre-wrap",
        }}
      >
        {trimmed}
      </div>
    );
  }
  const steps = [
    {
      no: "01",
      label: "Send a message",
      body: "Ask us anything about the product · we reply in-chat.",
    },
    {
      no: "02",
      label: "Confirm details",
      body: "Size, quantity, delivery address · all agreed in-chat.",
    },
    {
      no: "03",
      label: "Ships in 24 hrs",
      body: "Packed the same day where possible · courier assigned.",
    },
    {
      no: "04",
      label: "Track delivery",
      body: "Courier tracking + arrival window sent in-chat.",
    },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {steps.map((s) => (
        <div
          key={s.no}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--nex-accent-soft)",
            background: "var(--nex-accent-faint)",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--nex-accent)",
              color: "#03101D",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--nex-font-display)",
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {s.no}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--nex-font-display)",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 12,
                color: "var(--nex-text-dim)",
                lineHeight: 1.4,
              }}
            >
              {s.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlogPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "20px 16px",
        textAlign: "center",
        borderRadius: 12,
        border: "1px dashed var(--nex-accent-soft)",
        background: "var(--nex-accent-faint)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--nex-accent)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Blog
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--nex-text-dim)",
          lineHeight: 1.55,
        }}
      >
        Posts, journal entries, and updates land here soon.
      </div>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#fff",
  background: "var(--nex-accent)",
};

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  const sym = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

// Layout registry lives in ./layout-ids.ts + ./layout-switch.tsx so
// server components can enumerate ids without pulling the "use client"
// layout functions into their bundle. The stale COVER_LAYOUTS map that
// used to live here referenced 7 deleted templates and blew up SSR ·
// removed 2026-09-30. Do not re-add it here.
