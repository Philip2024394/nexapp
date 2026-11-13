// src/app/nex-native/manage/page.tsx
//
// NEX Shop Management Centre · owner-sealed 2026-11-13.
// -----------------------------------------------------------------------------
// One central place for a shop owner to manage every surface of their
// NEX shop: identity · appearance · catalogue · orders · payments ·
// subscription · share. Mirrors the Chat Settings visual vocabulary
// (cream page bg · line-icon rows · orange ON/OFF state pills).
//
// Access rules (preserved from the prior landing):
//   · Not signed in           → /sign-in with return-to this page
//   · Signed in · NO business → /manage/shop/setup (sealed dispatcher)
//   · Signed in · HAS business → render the management centre
//
// Honesty rules per the owner's 2026-11-13 directive:
//   · Every visible row leads to a real working route.
//   · Delivery/Shipping settings, standalone Returns page, Customer
//     Notifications surface and standalone Accommodation rooms list
//     have no backing route today · flagged as MISSING in the memo
//     + handled honestly below (either folded into the Shop Profile
//     surface that already hosts them, or omitted entirely).
//   · Menu row only shows for food/cafe venues · Rooms row only shows
//     for hotel category.
//   · Setup Wizard row only shows when key profile fields are empty.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { listOrdersByBusiness } from "@/lib/nex-native/order-service";
import { isVenueCategory } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";
import {
  IconBed,
  IconCard,
  IconClipboard,
  IconCompass,
  IconDatabase,
  IconDiamond,
  IconEye,
  IconMail,
  IconMenu,
  IconPackage,
  IconPalette,
  IconPicture,
  IconPlusSquare,
  IconScroll,
  IconShare,
  IconStorefront,
} from "./_shop-icons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared palette · matches Chat Settings.
const PAGE_BG = "#F5EDD3";
const INK = "#0A0608";
const INK_MUTE = "#7D5A3A";
const ACCENT = "#FF7200";

export default async function ShopManagementCentre(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage");
  }

  const businesses = await listBusinessesByOwner(session.account.id);
  const business = businesses[0];
  if (!business) {
    redirect("/nex-native/manage/shop/setup");
  }

  // Pending orders · reflects the "Pending orders indicator" the owner
  // asked for. Service throws on genuine DB errors · we catch and
  // treat as zero so the hub still renders cleanly.
  let pendingCount = 0;
  try {
    const pending = await listOrdersByBusiness(business.id, "pending");
    pendingCount = pending.length;
  } catch {
    pendingCount = 0;
  }

  // Shop-type-specific rows · only display what's relevant.
  const category = business.business_category ?? null;
  const showMenu = isVenueCategory(category) && category !== "hotel";
  const showRooms = category === "hotel";

  // Setup-incomplete probe · surface the wizard shortcut only when
  // a core profile field is missing. Keeps the hub focused once the
  // shop is set up.
  const setupIncomplete =
    !business.description ||
    !business.logo_url ||
    !business.address;

  // Subscription / tier status · entry = free trial · bisnis = paid Shop.
  const tier = effectiveTier(session.account);
  const tierLabel = tier === "bisnis" ? "Shop · active" : "Entry · free";
  const tierIndicator: "on" | "off" | "partial" =
    tier === "bisnis" ? "on" : "partial";

  const publicShopHref = `/nex-native/${business.slug}`;

  return (
    <main
      data-nex-shop-management-centre
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        background: PAGE_BG,
        color: INK,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "16px 20px 32px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <NexPageHeader dataScope="manage-shop" />

        <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.005em",
              color: ACCENT,
            }}
          >
            Shop Settings
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: INK_MUTE,
              lineHeight: 1.5,
            }}
          >
            Manage your shop{business.display_name
              ? ` · ${business.display_name}`
              : ""}
            . Profile, appearance, products, orders and billing in one
            place.
          </p>
        </header>

        <div style={{ height: 10 }} />

        {setupIncomplete ? (
          <LinkCard
            href="/nex-native/manage/shop/setup"
            icon={<IconCompass />}
            title="Finish shop setup"
            subtitle="Add the missing profile details to go live"
            rightIndicator="off"
          />
        ) : null}

        <SectionLabel>Preview & Profile</SectionLabel>
        <LinkCard
          href={publicShopHref}
          icon={<IconEye />}
          title="View My Shop"
          subtitle="See your shop the way customers see it"
        />
        <LinkCard
          href="/nex-native/manage/shop"
          icon={<IconStorefront />}
          title="Shop Profile"
          subtitle="Name · logo · description · address · hours · policies"
        />

        <SectionLabel>Appearance & Design</SectionLabel>
        <LinkCard
          href="/nex-native/manage/shop/themes"
          icon={<IconPalette />}
          title="Cover Template"
          subtitle="11 sealed layouts · tint colour · live preview"
        />
        <LinkCard
          href="/nex-native/manage/shop/backgrounds"
          icon={<IconPicture />}
          title="Background Library"
          subtitle="Pick a background or upload your own cover image"
        />

        <SectionLabel>Products & Catalogue</SectionLabel>
        <LinkCard
          href="/nex-native/manage/products"
          icon={<IconPackage />}
          title="Products"
          subtitle="Browse, edit, stock status and visibility per product"
        />
        <LinkCard
          href="/nex-native/create/product/category"
          icon={<IconPlusSquare />}
          title="Add product"
          subtitle="Pick a category and create a new product listing"
        />
        {showMenu ? (
          <LinkCard
            href="/nex-native/manage/menu"
            icon={<IconMenu />}
            title="Menu"
            subtitle="Sections, items, dietary tags and availability"
          />
        ) : null}
        {showRooms ? (
          <LinkCard
            href="/nex-native/manage/accommodation"
            icon={<IconBed />}
            title="Rooms"
            subtitle="Rooms, capacity, pricing and amenities"
          />
        ) : null}

        <SectionLabel>Orders & Fulfilment</SectionLabel>
        <LinkCard
          href="/nex-native/manage/orders"
          icon={<IconClipboard />}
          title="Orders"
          subtitle={
            pendingCount > 0
              ? `${pendingCount} pending · tap to review`
              : "Buyer orders · newest first"
          }
          rightIndicator={pendingCount > 0 ? "on" : "off"}
        />

        <SectionLabel>Payments & Checkout</SectionLabel>
        <LinkCard
          href="/nex-native/settings/payments"
          icon={<IconCard />}
          title="Payment Providers"
          subtitle="Stripe · PayPal · QR / bank transfer"
        />

        <SectionLabel>Customer Experience & Policies</SectionLabel>
        <LinkCard
          href="/nex-native/manage/shop"
          icon={<IconMail />}
          title="Contact & NEX Chat"
          subtitle="Customers reach you through NEX Chat using your shop contact"
        />
        <LinkCard
          href="/nex-native/manage/shop/setup/policies"
          icon={<IconScroll />}
          title="Returns & refunds policy"
          subtitle="Set your return window and refund terms"
        />

        <SectionLabel>Subscription & Storage</SectionLabel>
        <LinkCard
          href="/nex-native/settings/tier"
          icon={<IconDiamond />}
          title="Subscription"
          subtitle={tierLabel}
          rightIndicator={tierIndicator}
        />
        <LinkCard
          href="/nex-native/settings/storage"
          icon={<IconDatabase />}
          title="Storage & capacity"
          subtitle="Usage snapshot and add-on packs"
        />

        <SectionLabel>Share & Publish</SectionLabel>
        <LinkCard
          href="/nex-native/manage/shop"
          icon={<IconShare />}
          title="Share Shop"
          subtitle={`Public link · ${publicShopHref}`}
        />

        <div
          data-nex-manage-poweredby
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: INK_MUTE,
          }}
        >
          Powered by NEX
        </div>
      </div>
    </main>
  );
}

// ─── Minimal row components · same vocabulary as Chat Settings ──────

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        margin: "18px 2px 4px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: INK_MUTE,
      }}
    >
      {children}
    </div>
  );
}

function LinkCard({
  href,
  icon,
  title,
  subtitle,
  rightIndicator,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightIndicator?: "on" | "off" | "partial";
}): React.JSX.Element {
  return (
    <a
      href={href}
      data-nex-manage-link={href}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "16px 4px",
        textDecoration: "none",
        color: INK,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 28,
          display: "grid",
          placeItems: "center",
          color: INK,
          paddingTop: 2,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: INK,
            letterSpacing: "0.005em",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: INK_MUTE,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {rightIndicator ? <StateIndicator value={rightIndicator} /> : null}
    </a>
  );
}

function StateIndicator({
  value,
}: {
  value: "on" | "off" | "partial";
}): React.JSX.Element {
  const trackColour =
    value === "on" ? "#0E6B3A" : value === "off" ? "#7F1D1D" : "#B45309";
  const knobLeft = value === "on" ? 22 : value === "off" ? 2 : 12;
  return (
    <span
      aria-hidden
      data-nex-manage-link-indicator={value}
      style={{
        flexShrink: 0,
        alignSelf: "center",
        position: "relative",
        width: 42,
        height: 22,
        borderRadius: 999,
        background: trackColour,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: knobLeft,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 160ms ease",
        }}
      />
    </span>
  );
}
