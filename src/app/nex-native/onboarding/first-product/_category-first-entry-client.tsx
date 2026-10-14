"use client";

// src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx
//
// Track B · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Category-aware celebration variant for food · services · accommodation ·
// property sellers. The sealed `createFirstProductAction` redirect
// (sealed 2026-10-01) sends every new business to this page regardless
// of category. For businesses whose `nex_business.business_category`
// is NOT `products` (or null), the server page branches here instead
// of mounting <FirstProductClient>. Preserves the sealed terminal
// redirect contract while rendering a category-appropriate first step.
//
// What this surface IS:
//   · Honest celebration + guided deep-link into the category's
//     EXISTING management surface (/manage/menu for food, etc.).
//   · The Phase 2 two-step "Make it yours" setup remains the SAME
//     link for every category (theme is account-level, cover is
//     business-level; both apply universally).
//
// What this surface is NOT:
//   · NOT a duplicate catalogue · NOT a new category-specific editor
//     (those live in /manage/menu, /manage/services, /manage/venue).
//   · NOT a booking engine. Accommodation sellers get honest
//     "booking features in design" copy, not a fake flow.
//   · NOT a product form · it writes nothing, has no form submit,
//     has no sealed-service dependency beyond the server-rendered
//     deep-links.
//   · NOT a visibility toggle · it does not publish, verify, or gate
//     the business. Visibility is explained on the subsequent shop
//     page via the setup-complete banner.
//
// Doctrine respected:
//   · All sealed services and redirects preserved.
//   · No new DB column · no migration · no cookie · no completion flag.
//   · No invented capabilities · "Coming soon" is used only where the
//     backend genuinely does not support the feature today.

import * as React from "react";
import Link from "next/link";
import type { BusinessCategory } from "@/lib/nex-native/business/types";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  violet: "#9B6DFF",
  amber: "#F59E0B",
  green: "#16D66B",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface CategoryFirstEntryClientProps {
  readonly category: Exclude<BusinessCategory, "products">;
  readonly slug: string;
  readonly displayName: string;
  readonly logoUrl: string | null;
  readonly businessId: string;
  readonly banner: { code: string; message: string } | null;
}

/** Build the category-specific celebration + CTA copy block.
 *  Pure data mapping · exported for unit-testing honesty invariants
 *  (no fabricated booking engine, no fake upload, etc.). */
export interface CategoryEntrySpec {
  readonly eyebrow: string;
  readonly heading: string;
  readonly intro: string;
  readonly primaryCta: {
    readonly label: string;
    readonly href: string;
  };
  readonly honestNote: string | null;
}

export function categoryEntrySpec(
  category: Exclude<BusinessCategory, "products">,
  businessId?: string,
): CategoryEntrySpec {
  // Track C · 2026-10-14 · food + services primary CTA now routes
  // through the make-it-yours onboarding wrappers (menu-first,
  // services-first) rather than deep-linking directly into the
  // sealed /manage/* dashboards. The wrappers reuse the sealed
  // service primitives (menuService.createMenuItem + insertService)
  // and route back to /${slug}?setup=complete on success so the
  // Track B visibility banner surfaces. If businessId is not
  // provided we fall back to the raw dashboard URL · defensive
  // only · the client page always passes businessId.
  const bidQs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  switch (category) {
    case "food":
      return {
        eyebrow: "Your food business is set up",
        heading: "Add your first menu item.",
        intro:
          "Your business page is created. Add dishes, drinks, or bakery items from the menu editor. Each item carries dietary tags, allergens, prep time, and perks.",
        primaryCta: {
          label: "Add your first menu item →",
          href: businessId
            ? `/nex-native/business-setup/make-it-yours/menu-first${bidQs}`
            : "/nex-native/manage/menu",
        },
        honestNote: null,
      };
    case "services":
      return {
        eyebrow: "Your services business is set up",
        heading: "List your first service.",
        intro:
          "Your business page is created. Add the services you offer with a short description and a from-price hint. Customers reach you through chat for quotes and bookings.",
        primaryCta: {
          label: "List your first service →",
          href: businessId
            ? `/nex-native/business-setup/make-it-yours/services-first${bidQs}`
            : "/nex-native/manage/services",
        },
        honestNote:
          "Full booking + appointment features are in design · for now, customers enquire through NEX chat and you handle scheduling directly.",
      };
    case "accommodation":
      return {
        eyebrow: "Your accommodation is set up",
        heading: "Set up your venue profile.",
        intro:
          "Your business page is created. Add photos of your venue, your capacity, and what you offer guests. Customers reach you through chat to enquire about stays.",
        primaryCta: {
          label: "Open the venue editor →",
          href: "/nex-native/manage/venue",
        },
        honestNote:
          "Room inventory, nightly rates, availability calendars, and reservations are in design and not yet available in NEX. Guests enquire through chat today; you take their booking details offline.",
      };
    case "property":
      return {
        eyebrow: "Your property business is set up",
        heading: "Share your listings in chat.",
        intro:
          "Your business page is created. Property listings and viewings aren't yet built into NEX as a dedicated surface — for now, share listings with customers via NEX chat.",
        primaryCta: {
          label: "Open your business dashboard →",
          href: "/nex-native/manage",
        },
        honestNote:
          "A dedicated property listing editor is on the roadmap. For now the business page shows your profile, and chat is where you share listings.",
      };
  }
}

export function CategoryFirstEntryClient(
  props: CategoryFirstEntryClientProps,
): React.ReactElement {
  const { category, slug, displayName, logoUrl, businessId, banner } = props;
  const spec = categoryEntrySpec(category, businessId);
  const makeItYoursHref = `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(businessId)}`;
  const shopHref = `/nex-native/${slug}`;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-category-first-entry={category}
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px",
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        {/* Celebration header · mobile-first · brand-neutral */}
        <header style={{ textAlign: "center", marginBottom: 24 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              width={72}
              height={72}
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                objectFit: "cover",
                border: `1px solid ${NEX.borderStrong}`,
                margin: "0 auto 14px",
                display: "block",
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${NEX.cyan}44, ${NEX.orange}22)`,
                border: `1px solid ${NEX.borderStrong}`,
                margin: "0 auto 14px",
              }}
            />
          )}
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: NEX.green,
              fontWeight: 700,
              marginBottom: 8,
            }}
            data-nex-category-first-entry-eyebrow
          >
            ✓ {spec.eyebrow}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 28,
              lineHeight: 1.15,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            {spec.heading}
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            {spec.intro}
          </p>
        </header>

        {banner && (
          <div
            role="status"
            data-nex-category-first-entry-banner
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.1)",
              border: `1px solid ${NEX.amber}66`,
              color: NEX.textPrimary,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: NEX.amber }}>Notice · </strong>
            {banner.message.slice(0, 240)}
          </div>
        )}

        {spec.honestNote && (
          <div
            data-nex-category-first-entry-honest-note
            style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0, 175, 255, 0.07)",
              border: `1px solid ${NEX.cyanBorder}`,
              color: NEX.textSecondary,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: NEX.cyan, letterSpacing: "0.06em" }}>
              Honest note:
            </strong>{" "}
            {spec.honestNote}
          </div>
        )}

        {/* Primary CTA · deep-link into the sealed category editor */}
        <Link
          href={spec.primaryCta.href}
          data-nex-category-first-entry-primary-cta
          style={{
            display: "block",
            textAlign: "center",
            padding: "14px 20px",
            minHeight: 48,
            borderRadius: 14,
            background: `linear-gradient(180deg, ${NEX.cyan}44 0%, ${NEX.cyan}0a 100%)`,
            border: `1px solid ${NEX.cyanBorder}`,
            color: NEX.textPrimary,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textDecoration: "none",
            boxShadow: `0 10px 24px ${NEX.cyan}22`,
          }}
        >
          {spec.primaryCta.label}
        </Link>

        {/* Secondary · Phase 2 two-step setup (universal across all categories) */}
        <Link
          href={makeItYoursHref}
          data-nex-category-first-entry-make-it-yours
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 12,
            padding: "12px 16px",
            minHeight: 44,
            borderRadius: 12,
            background: "transparent",
            border: `1px solid ${NEX.borderStrong}`,
            color: NEX.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Make NEX yours in 2 steps · theme + cover →
        </Link>

        {/* Tertiary · view the public shop page */}
        <Link
          href={shopHref}
          data-nex-category-first-entry-view-shop
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 10,
            padding: "8px 12px",
            minHeight: 32,
            color: NEX.textMuted,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          View {displayName}'s public page →
        </Link>
      </main>
    </>
  );
}
