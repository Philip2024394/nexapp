// src/app/nex-native/pricing/page.tsx
//
// NEX pricing page · single-package presentation.
// Owner-authorised 2026-11-08 (round 29).
// -----------------------------------------------------------------------------
// Replaces the 3-tier (Entry / Professional / Professional Plus) layout
// that preceded the 2026-11-08 commercial seal. Reflects the single
// Shop package model with pay-as-you-grow storage packs.
//
// This page does NOT trigger checkout. No Stripe calls fire. The
// "Open Shop setup" CTA routes to the sealed setup flow; Stripe
// wiring is held for separate owner authorisation.

import * as React from "react";
import Link from "next/link";
import {
  SHOP_MONTHLY,
  STORAGE_PACKS,
  getActivePrice,
  getActivePackPrice,
  formatPrice,
  type SupportedRegion,
  type CapacityPackSpec,
} from "@/lib/nex-native/commercial/regional-pricing";
import {
  SHOP_ENTITLEMENT,
} from "@/lib/nex-native/commercial/shop-entitlements";
import { ShopCheckoutButton } from "../_shop-checkout-button";

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

// Launch markets · owner-sealed 2026-11-08. The viewer-region resolver
// (`region-resolver.ts`) is deferred; until it lands, the page shows the
// four launch-market prices as a transparent chart.
const LAUNCH_MARKETS: ReadonlyArray<{
  region: SupportedRegion;
  label: string;
}> = [
  { region: "IE", label: "Europe" },
  { region: "GB", label: "United Kingdom" },
  { region: "US", label: "United States" },
  { region: "ID", label: "Indonesia" },
];

export default function NexPricingPage(): React.JSX.Element {
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
            NEX Pricing
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
            Chat free. One package. Grow as you go.
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
            NEX Chat is free forever. Shop is one package at the same
            price for everyone. Need more capacity? Buy storage and
            bandwidth as your business grows.
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

        {/* The single Shop package */}
        <section
          style={{
            padding: "16px 18px 18px",
            background: `linear-gradient(135deg, ${EMERALD} 0%, rgba(5,15,28,0.94) 80%)`,
            border: `1px solid ${GOLD}`,
            borderRadius: 16,
            boxShadow:
              "0 16px 40px rgba(0,0,0,0.5), 0 0 0 3px rgba(198,161,91,0.14)",
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
              color: "#1A120A",
              background: GOLD,
              borderRadius: 999,
              marginBottom: 8,
            }}
          >
            One package
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.01em",
            }}
          >
            {SHOP_ENTITLEMENT.displayName}
          </h2>
          <p
            style={{
              margin: "6px 0 10px",
              fontSize: 12.5,
              color: INK_DIM,
              lineHeight: 1.5,
            }}
          >
            One subscription. Same features everywhere. Chat Themes and
            Vault included. 0% commission on sales.
          </p>

          {/* Per-market price chart */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 6,
              columnGap: 12,
              margin: "12px 0 14px",
              padding: "10px 12px",
              background: "rgba(2,9,20,0.4)",
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
            }}
          >
            {LAUNCH_MARKETS.map(({ region, label }) => {
              const row = getActivePrice(SHOP_MONTHLY, region);
              return (
                <React.Fragment key={region}>
                  <span style={{ fontSize: 12, color: INK_DIM }}>{label}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: GOLD,
                      textAlign: "right",
                    }}
                  >
                    {row ? `${formatPrice(row)} / month` : "Coming soon"}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

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
            {[
              `${SHOP_ENTITLEMENT.products.maxActive} shop products`,
              `${SHOP_ENTITLEMENT.products.videosTotal} shop videos (up to ${SHOP_ENTITLEMENT.products.videoMaxSeconds}s each)`,
              `${Math.round(SHOP_ENTITLEMENT.storage.mediaBytes / 1_000_000_000)} GB storage`,
              `${Math.round(SHOP_ENTITLEMENT.storage.monthlyBandwidthBytes / 1_000_000_000)} GB monthly delivery`,
              "Chat Themes included",
              "Vault included",
              "0% commission on sales",
            ].map((b) => (
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Owner-sealed 2026-11-08 Option B · pre-trial disclosure
                shown BEFORE the button so the user understands what
                happens on day 8 (honesty guardrail #1). */}
            <span style={{ fontSize: 10, color: INK_MUTED, marginBottom: 2 }}>
              7 days free · then €4.99 / £4.99 / $4.99 / Rp 89,000 per
              month unless you cancel · cancel anytime.
            </span>
            <ShopCheckoutButton />
          </div>
        </section>

        {/* Capacity upgrades · storage + bandwidth packs */}
        <section
          style={{
            padding: "14px 16px 16px",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.005em",
            }}
          >
            Grow as your business grows
          </h3>
          <p
            style={{
              margin: "6px 0 10px",
              fontSize: 11.5,
              color: INK_DIM,
              lineHeight: 1.5,
            }}
          >
            Start with 1 GB storage and 30 GB monthly delivery. Need
            more? Buy capacity packs by the month. Storage and bandwidth
            are sold separately, so a quiet shop never subsidises a
            busy one.
          </p>

          {/* Owner directive 2026-11-08 (round 29d) · users don't
              understand "bandwidth" · single "storage" surface here
              too · the 6-card detail lives on /settings/storage for
              owners who want it. */}
          <PackGroup
            title="Storage upgrades"
            region="IE"
            packs={STORAGE_PACKS}
            emptyHint="Storage upgrade prices for Indonesia are pending pilot data."
          />

          <Link
            href="/nex-native/settings/storage"
            style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: GOLD,
              textDecoration: "none",
            }}
          >
            See usage + upgrade →
          </Link>
        </section>

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
            summary="Private encrypted storage. Included with your Shop package."
            footer="Open Vault"
            href="/nex-native/vault"
          />
          <SideCard
            name="Chat Themes"
            glyph="🎨"
            summary="One-time theme purchases · included with Shop · browse free previews."
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
          Same Shop package for every subscriber globally. Local prices
          shown for the four launch markets. Indonesia upgrade pack
          prices pending pilot usage data. NEX never handles buyer-seller
          payments for Shop orders.
        </footer>
      </main>
    </>
  );
}

function PackGroup({
  title,
  region,
  packs,
  emptyHint,
}: {
  title: string;
  region: SupportedRegion;
  packs: ReadonlyArray<CapacityPackSpec>;
  emptyHint: string;
}): React.JSX.Element {
  return (
    <div style={{ margin: "8px 0 12px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: INK_DIM,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 6,
        }}
      >
        {packs.map((p) => {
          const activeRow = getActivePackPrice(p, region);
          return (
            <div
              key={p.size}
              style={{
                padding: "8px 10px",
                background: "rgba(2,9,20,0.4)",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: CREAM,
                }}
              >
                {p.displayName}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  color: GOLD,
                }}
              >
                {activeRow ? formatPrice(activeRow) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: INK_MUTED, marginTop: 4 }}>
        {emptyHint}
      </div>
    </div>
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
