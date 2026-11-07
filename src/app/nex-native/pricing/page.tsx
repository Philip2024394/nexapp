// src/app/nex-native/pricing/page.tsx
//
// NEX pricing page · Ireland launch presentation.
// Owner-approved pricing · owner-authorised 2026-11-07 local build.
// -----------------------------------------------------------------------------
// Replaces the Indonesia-focused 7-tier legacy at /settings/tier for
// the launch-market view. Reads prices from the regional-pricing
// reference registry (Ireland only is active). Chat is positioned as
// the free foundation · Shop is the one paid business product with
// two tiers · Chat Themes are separately purchasable · Vault lives
// in the NEX Store.
//
// This page does NOT trigger checkout. No Stripe calls fire. Tapping
// a plan routes to the (sealed, draft, not-wired) billing checkout
// endpoint, which itself requires owner approval before going live.

import type * as React from "react";
import Link from "next/link";
import {
  PROFESSIONAL_MONTHLY,
  PROFESSIONAL_ANNUAL,
  PROFESSIONAL_PLUS_MONTHLY,
  PROFESSIONAL_PLUS_ANNUAL,
  getActivePrice,
  formatPrice,
} from "@/lib/nex-native/commercial/regional-pricing";
import {
  ENTRY_ENTITLEMENT,
  PROFESSIONAL_ENTITLEMENT,
  PROFESSIONAL_PLUS_ENTITLEMENT,
} from "@/lib/nex-native/commercial/shop-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function NexPricingPage(): React.JSX.Element {
  const proMonth = getActivePrice(PROFESSIONAL_MONTHLY, "IE");
  const proYear = getActivePrice(PROFESSIONAL_ANNUAL, "IE");
  const plusMonth = getActivePrice(PROFESSIONAL_PLUS_MONTHLY, "IE");
  const plusYear = getActivePrice(PROFESSIONAL_PLUS_ANNUAL, "IE");

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-pricing
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxSizing: "border-box",
          gap: 18,
        }}
      >
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href="/nex-native/free-chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: GOLD,
              textDecoration: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
            }}
          >
            ← Back
          </Link>
        </nav>

        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "22px 20px 24px",
            background: `linear-gradient(135deg, ${EMERALD} 0%, ${FOREST} 60%, rgba(2,9,20,0.95) 100%)`,
            border: `1px solid ${BORDER_HI}`,
            borderRadius: 18,
            textAlign: "center",
            boxShadow: "0 18px 46px rgba(0,0,0,0.55)",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              margin: "0 auto",
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: GOLD,
              background: "rgba(198, 161, 91, 0.12)",
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 999,
            }}
          >
            NEX Ireland Pricing
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
            }}
          >
            Chat free. Sell when you&rsquo;re ready.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              color: INK_DIM,
              lineHeight: 1.5,
              maxWidth: 340,
              marginInline: "auto",
            }}
          >
            NEX Chat is free forever. Shop is one paid membership with
            two levels. Themes are optional one-time purchases. Vault
            lives in NEX Store.
          </p>
        </header>

        {/* Free pillar · NEX Chat */}
        <PricingCard
          badge="Foundation"
          name="NEX Chat"
          priceLabel="Free forever"
          summary="Private messaging · groups · contacts · notifications. The foundation of your NEX."
          bullets={[
            "End-to-end chat infrastructure in place (claims pending cryptographic review)",
            "Device-key message storage · never server-held",
            "No Shop membership required",
          ]}
          cta={null}
          accent={false}
        />

        {/* Entry allowance · 5 products trial */}
        <PricingCard
          badge="Try selling"
          name="Entry · 5 products"
          priceLabel="Included with any signed-in Chat account"
          summary="Open a shop, list up to 5 products, see if it works for your business."
          bullets={[
            `${ENTRY_ENTITLEMENT.products.maxActive} active products`,
            `${ENTRY_ENTITLEMENT.products.imagesPerProduct} images per product · ${Math.round(
              ENTRY_ENTITLEMENT.products.imageMaxBytes / 1_000_000,
            )} MB max`,
            `No video on Entry · upgrade for video`,
            `${Math.round(ENTRY_ENTITLEMENT.storage.mediaBytes / 1_000_000)} MB total media storage`,
          ]}
          cta={{
            label: "Open Shop setup →",
            href: "/nex-native/manage/shop/start",
          }}
          accent={false}
        />

        {/* Pro · €9.99/mo */}
        <PricingCard
          badge="Most popular"
          name="NEX Shop Professional"
          priceLabel={
            proMonth
              ? `${formatPrice(proMonth)} / month`
              : "Pricing coming soon"
          }
          subPriceLabel={
            proYear
              ? `or ${formatPrice(proYear)} / year · save ~17%`
              : undefined
          }
          summary="A working shop for the typical seller — café, maker, independent brand."
          bullets={[
            `${PROFESSIONAL_ENTITLEMENT.products.maxActive} active products`,
            `${PROFESSIONAL_ENTITLEMENT.products.imagesPerProduct} images per product · 4 MB max`,
            `${PROFESSIONAL_ENTITLEMENT.products.videosPerProduct} video per product · 30 sec · 40 MB`,
            `${Math.round(PROFESSIONAL_ENTITLEMENT.storage.mediaBytes / 1_000_000_000)} GB shop media storage`,
            `${Math.round(PROFESSIONAL_ENTITLEMENT.storage.monthlyBandwidthBytes / 1_000_000_000)} GB monthly delivery`,
            "All 11 shop templates + background catalogue",
          ]}
          cta={{
            label: "Choose Professional",
            href: "/nex-native/manage/shop/setup",
            note: "Checkout is in review · tap routes to Shop setup today",
          }}
          accent={true}
        />

        {/* Plus · €19.99/mo */}
        <PricingCard
          badge="For power sellers"
          name="NEX Shop Professional Plus"
          priceLabel={
            plusMonth
              ? `${formatPrice(plusMonth)} / month`
              : "Pricing coming soon"
          }
          subPriceLabel={
            plusYear
              ? `or ${formatPrice(plusYear)} / year · save ~17%`
              : undefined
          }
          summary="More products, more media, priority placement for shops with real volume."
          bullets={[
            `${PROFESSIONAL_PLUS_ENTITLEMENT.products.maxActive} active products`,
            `${PROFESSIONAL_PLUS_ENTITLEMENT.products.imagesPerProduct} images per product · 8 MB max`,
            `${PROFESSIONAL_PLUS_ENTITLEMENT.products.videosPerProduct} videos per product · 60 sec · 100 MB`,
            `${Math.round(PROFESSIONAL_PLUS_ENTITLEMENT.storage.mediaBytes / 1_000_000_000)} GB shop media storage`,
            `${Math.round(PROFESSIONAL_PLUS_ENTITLEMENT.storage.monthlyBandwidthBytes / 1_000_000_000)} GB monthly delivery`,
            "Boosted directory listing · analytics · priority support",
          ]}
          cta={{
            label: "Choose Plus",
            href: "/nex-native/manage/shop/setup",
            note: "Checkout is in review · tap routes to Shop setup today",
          }}
          accent={false}
        />

        {/* Other products · Vault + Themes */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <SideCard
            name="Vault"
            glyph="🔐"
            summary="Private encrypted storage for files + conversations."
            footer="Visit NEX Store"
            href="/nex-native/store"
          />
          <SideCard
            name="Chat Themes"
            glyph="🎨"
            summary="One-time theme purchases · no Shop required."
            footer="Browse themes"
            href="/nex-native/chat-themes-library"
          />
        </section>

        <footer
          style={{
            paddingTop: 10,
            fontSize: 10.5,
            color: INK_MUTED,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Prices shown in EUR for Ireland. Other regional prices land as
          markets are enabled. Chat is free forever. NEX never handles
          buyer-seller payments for Shop orders.
        </footer>
      </main>
    </>
  );
}

function PricingCard({
  badge,
  name,
  priceLabel,
  subPriceLabel,
  summary,
  bullets,
  cta,
  accent,
}: {
  badge: string;
  name: string;
  priceLabel: string;
  subPriceLabel?: string;
  summary: string;
  bullets: ReadonlyArray<string>;
  cta: { label: string; href: string; note?: string } | null;
  accent: boolean;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: "16px 18px 18px",
        background: accent
          ? `linear-gradient(135deg, ${EMERALD} 0%, rgba(5,15,28,0.94) 80%)`
          : SURFACE,
        border: `1px solid ${accent ? GOLD : BORDER}`,
        borderRadius: 16,
        boxShadow: accent
          ? "0 16px 40px rgba(0,0,0,0.5), 0 0 0 3px rgba(198,161,91,0.14)"
          : "none",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: accent ? "#1A120A" : GOLD,
          background: accent ? GOLD : "rgba(198, 161, 91, 0.12)",
          border: accent ? "none" : `1px solid ${BORDER}`,
          borderRadius: 999,
          marginBottom: 8,
        }}
      >
        {badge}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: "-0.01em",
        }}
      >
        {name}
      </h2>
      <div
        style={{
          margin: "4px 0 2px",
          fontSize: 16,
          fontWeight: 800,
          color: GOLD,
        }}
      >
        {priceLabel}
      </div>
      {subPriceLabel ? (
        <div style={{ fontSize: 11, color: INK_DIM, marginBottom: 6 }}>
          {subPriceLabel}
        </div>
      ) : null}
      <p
        style={{
          margin: "6px 0 10px",
          fontSize: 12.5,
          color: INK_DIM,
          lineHeight: 1.5,
        }}
      >
        {summary}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {bullets.map((b) => (
          <li
            key={b}
            style={{
              fontSize: 11.5,
              color: INK,
              display: "flex",
              gap: 6,
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden style={{ color: GOLD }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {cta ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Link
            href={cta.href}
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              alignItems: "center",
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#1A120A",
              background: GOLD,
              textDecoration: "none",
              borderRadius: 999,
            }}
          >
            {cta.label}
          </Link>
          {cta.note ? (
            <span style={{ fontSize: 10, color: INK_MUTED }}>{cta.note}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SideCard({
  name,
  glyph,
  summary,
  footer,
  href,
}: {
  name: string;
  glyph: string;
  summary: string;
  footer: string;
  href: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        color: INK,
        textDecoration: "none",
      }}
    >
      <span aria-hidden style={{ fontSize: 24 }}>{glyph}</span>
      <div style={{ fontSize: 13, fontWeight: 900, color: CREAM }}>{name}</div>
      <div style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>
        {summary}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: GOLD,
        }}
      >
        {footer} →
      </div>
    </Link>
  );
}
