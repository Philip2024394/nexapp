// src/app/nex-native/store/page.tsx
//
// NEX Store · NEX's own catalogue of optional extras.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// NOT a marketplace for third-party sellers · NOT the shop templates
// picker (those live on /manage/shop/*). This is the destination
// where NEX users discover + purchase NEX-owned optional additions
// (Vault today · more extras in future).
//
// Design intent (per owner directive 2026-11-07):
//   · Premium NEX appearance
//   · Responsive grid of large round product buttons
//   · Each button: icon + name + concise price/description
//   · Reuse existing NEX design tokens (gold + emerald world palette)
//   · Does not introduce a separate visual design system
//
// First item · VAULT · €9.99/mo · taps route to the existing sealed
// /nex-native/vault experience. Future store items drop into
// STORE_ITEMS below.

import type * as React from "react";
import Link from "next/link";

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

// Catalogue of NEX-owned extras. Each entry renders as a round
// store button in the grid. Add new items here as they launch ·
// `comingSoon` suppresses the tap destination and shows a dim
// badge so the catalogue keeps growing visually before every item
// is live.
interface StoreItem {
  readonly id: string;
  readonly name: string;
  readonly glyph: string;
  readonly priceLabel: string;
  readonly href: string | null;
  readonly blurb: string;
  readonly comingSoon?: boolean;
}

const STORE_ITEMS: ReadonlyArray<StoreItem> = [
  {
    id: "vault",
    name: "Vault",
    glyph: "🔐",
    // Owner-sealed 2026-11-08 (round 29) · Vault is bundled with the
    // single NEX Shop package · no longer a separate paid product.
    priceLabel: "Included with NEX Shop",
    href: "/nex-native/vault",
    blurb: "Private encrypted storage · included with your Shop package.",
  },
  // Placeholder tiles · signal the catalogue will grow · suppressed
  // taps until each item is approved to go live.
  {
    id: "chat-themes-packs",
    name: "Theme Packs",
    glyph: "🎨",
    priceLabel: "From €3.49",
    href: "/nex-native/chat-themes-library",
    blurb: "Premium chat themes · one-time purchases.",
  },
  {
    id: "shop-upgrades",
    name: "Shop Extras",
    glyph: "🛍",
    priceLabel: "Coming soon",
    href: null,
    blurb: "Pro templates · boosted directory listings.",
    comingSoon: true,
  },
  {
    id: "vault-storage-plus",
    name: "Extra Vault",
    glyph: "💾",
    priceLabel: "Coming soon",
    href: null,
    blurb: "Expand your Vault with additional storage.",
    comingSoon: true,
  },
];

export default function NexStorePage(): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-store
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
        <Back />
        <Hero />
        <Grid />
        <Footer />
      </main>
    </>
  );
}

function Back(): React.JSX.Element {
  return (
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
  );
}

function Hero(): React.JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "20px 20px 22px",
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
        NEX Store
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
        Enhance your NEX
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: INK_DIM,
          lineHeight: 1.5,
          maxWidth: 320,
          marginInline: "auto",
        }}
      >
        Optional extras built by the NEX team. Buy once or subscribe
        — everything you already use stays free.
      </p>
    </section>
  );
}

function Grid(): React.JSX.Element {
  return (
    <section
      aria-label="NEX Store products"
      /* Responsive grid · 2 across on phone-frame width, auto-fills
         wider surfaces. Uses auto-fit minmax so desktop lands 3-4
         columns without a breakpoint cascade. */
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 14,
      }}
    >
      {STORE_ITEMS.map((item) => (
        <StoreButton key={item.id} item={item} />
      ))}
    </section>
  );
}

function StoreButton({ item }: { item: StoreItem }): React.JSX.Element {
  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      {/* Round product circle · gold rim · emerald wash · glyph
          center. This IS the "round product button" from the
          directive. Size is responsive to grid cell. */}
      <div
        aria-hidden
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 25%, ${FOREST} 0%, ${EMERALD} 60%, rgba(2,9,20,0.95) 100%)`,
          border: `2px solid ${item.comingSoon ? BORDER : GOLD}`,
          boxShadow: item.comingSoon
            ? "none"
            : "0 10px 24px rgba(0,0,0,0.5), 0 0 0 4px rgba(198,161,91,0.12)",
          display: "grid",
          placeItems: "center",
          fontSize: 44,
          color: CREAM,
          opacity: item.comingSoon ? 0.65 : 1,
          transition: "transform 160ms ease, box-shadow 160ms ease",
        }}
      >
        {item.glyph}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: "-0.005em",
        }}
      >
        {item.name}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: item.comingSoon ? INK_MUTED : GOLD,
        }}
      >
        {item.priceLabel}
      </div>
      <div
        style={{
          fontSize: 10.5,
          lineHeight: 1.4,
          color: INK_DIM,
          maxWidth: 160,
        }}
      >
        {item.blurb}
      </div>
    </div>
  );

  if (item.comingSoon || !item.href) {
    return (
      <div
        data-nex-store-item={item.id}
        data-nex-store-item-locked="true"
        aria-disabled="true"
        style={{
          padding: "14px 10px 16px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          cursor: "not-allowed",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      data-nex-store-item={item.id}
      style={{
        padding: "14px 10px 16px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        cursor: "pointer",
        textDecoration: "none",
        color: INK,
        display: "block",
      }}
    >
      {content}
    </Link>
  );
}

function Footer(): React.JSX.Element {
  return (
    <footer
      style={{
        paddingTop: 10,
        fontSize: 10.5,
        color: INK_MUTED,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      Everything in the NEX Store is optional · your Chat stays free
      forever regardless of purchases.
    </footer>
  );
}
