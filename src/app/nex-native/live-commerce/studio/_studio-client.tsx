"use client";

// src/app/nex-native/live-commerce/studio/_studio-client.tsx
//
// Studio hub · three honest cards:
//   · Insights · DEMO-labelled aggregate numbers (views/likes/shares)
//     that come from mock data today. The DEMO chip is sealed so the
//     owner is never led to believe these are real.
//   · Followers · empty state ("No followers yet"). The follower
//     graph doesn't exist for live personas today.
//   · Shop · deep link to the broadcaster's own shop surface via a
//     disabled "Open shop" when no shop slug is known.
//
// Palette matches the sealed MessagePanel (near-white panel · muted
// navy rim · dark navy text · cyan + green accents).

import * as React from "react";
import { useRouter } from "next/navigation";

const PANEL = "rgba(240, 244, 250, 0.96)";
const RIM = "rgba(90, 110, 140, 0.5)";
const TEXT = "#102033";
const TEXT_DIM = "#4A6080";
const CYAN = "#00AFFF";
const GREEN = "#2DD57A";
const NAVY_GRADIENT = "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)";

export function StudioClient(): React.JSX.Element {
  const router = useRouter();
  return (
    <main
      data-nex-live-studio
      style={{
        // Owner troubleshoot 2026-10-27 · "studio has black rim and
        // should be same size container as live libary" · the earlier
        // `padding: 16` revealed the dark phone-frame background as a
        // flat black border around the panel. Live Library's inset
        // works there because the gap shows a dimmed live video via
        // a scrim; on a route surface there's no video to scrim over,
        // so the inset reads as a hard black band. Dropping the main
        // padding (and matching with 0 on the panel radius) lets the
        // panel fill the full phone frame — the "same size as Live
        // Library" ask resolved by making the panel the entire visible
        // container rather than an inset card.
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        fontFamily: "inherit",
      }}
    >
      <div
        data-nex-live-studio-panel
        style={{
          // Panel fills the whole phone frame now that the main
          // padding is 0. Radius + rim retired so the panel aligns
          // flush with the frame edges and no "black rim" shows.
          flex: "1 1 auto",
          width: "100%",
          minHeight: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 14px 16px",
          borderRadius: 0,
          background: PANEL,
          backdropFilter: "blur(14px) saturate(1.4)",
          WebkitBackdropFilter: "blur(14px) saturate(1.4)",
          border: "none",
          color: TEXT,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Studio
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT_DIM, lineHeight: 1.2 }}>
              Insights · Followers · Shop
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            data-nex-live-studio-close
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: NAVY_GRADIENT,
              border: "none",
              color: "#FFFFFF",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
            }}
          >
            ×
          </button>
        </div>

        {/* Body · 3 stacked cards. Scrolls when content exceeds height. */}
        <div
          data-nex-live-studio-body
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <InsightsCard />
          <FollowersCard />
          <ShopCard />
        </div>
      </div>
    </main>
  );
}

// Owner troubleshoot 2026-10-27 · hydration mismatch · bare
// `Number.toLocaleString()` picks the Node.js runtime's locale on the
// server (period thousands separator) and the browser's locale on
// the client (comma on en-US), producing "12.480" vs "12,480" and
// crashing hydration. Force a fixed locale so SSR + CSR match. Count
// values here are generic metrics (not currency) so en-US commas are
// the honest neutral choice; rupiah uses id-ID separately where it
// has semantic meaning.
function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function InsightsCard(): React.JSX.Element {
  // Owner directive 2026-10-27 · demo-labelled aggregates. These are
  // CONSTANT illustrative numbers · the DEMO chip tells the owner
  // these are not real. When the analytics service lands this card
  // will swap in real counts via a server read, and the DEMO chip
  // comes off at the same time.
  const demo = { views: 12_480, likes: 836, shares: 142, follows: 54 };
  return (
    <section
      data-nex-live-studio-card
      data-nex-live-studio-card-key="insights"
      aria-label="Insights"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        background: "rgba(16, 32, 51, 0.04)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20 V10" />
            <path d="M12 20 V4" />
            <path d="M20 20 V14" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>Insights</div>
        </div>
        {/* Sealed DEMO chip · stays on until real analytics ships. */}
        <span
          data-nex-live-studio-demo-chip
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8A5A00",
            background: "rgba(255, 194, 75, 0.14)",
            border: "1px solid rgba(255, 194, 75, 0.45)",
            padding: "3px 7px",
            borderRadius: 999,
          }}
        >
          Demo
        </span>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <Stat label="Views (7d)" value={formatCount(demo.views)} accent={CYAN} />
        <Stat label="Likes (7d)" value={formatCount(demo.likes)} accent="#C8324C" />
        <Stat label="Shares (7d)" value={formatCount(demo.shares)} accent={GREEN} />
        <Stat label="New followers" value={formatCount(demo.follows)} accent={TEXT_DIM} />
      </div>
      <p style={{ margin: 0, fontSize: 10.5, color: TEXT_DIM, lineHeight: 1.4 }}>
        Illustrative figures only. Real analytics ship when the
        broadcaster-metrics service is sealed.
      </p>
    </section>
  );
}

function Stat(props: { readonly label: string; readonly value: string; readonly accent: string }): React.JSX.Element {
  return (
    <div
      data-nex-live-studio-stat
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: 10,
        borderRadius: 10,
        background: "rgba(240, 244, 250, 0.7)",
        border: "1px solid rgba(16, 32, 51, 0.08)",
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_DIM, letterSpacing: "0.02em" }}>
        {props.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: props.accent, lineHeight: 1.1 }}>
        {props.value}
      </div>
    </div>
  );
}

function FollowersCard(): React.JSX.Element {
  return (
    <section
      data-nex-live-studio-card
      data-nex-live-studio-card-key="followers"
      aria-label="Followers"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        background: "rgba(16, 32, 51, 0.04)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="4" />
          <path d="M2 20 c0 -4 4 -6 7 -6 s7 2 7 6" />
          <circle cx="17" cy="9" r="3" />
          <path d="M15 14 c4 0 7 2 7 6" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>Followers</div>
      </header>
      <div
        data-nex-live-studio-followers-empty
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "20px 10px",
          borderRadius: 10,
          background: "rgba(240, 244, 250, 0.7)",
          border: "1px dashed rgba(16, 32, 51, 0.14)",
          color: TEXT_DIM,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>
          No followers yet.
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4 }}>
          Followers appear here once the live-persona follow service
          lands. Your Live posts can be reached without a follow in
          the meantime.
        </div>
      </div>
    </section>
  );
}

function ShopCard(): React.JSX.Element {
  return (
    <section
      data-nex-live-studio-card
      data-nex-live-studio-card-key="shop"
      aria-label="Shop"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        background: "rgba(16, 32, 51, 0.04)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7 h16 l-1 13 H5 Z" />
          <path d="M9 7 V5 a3 3 0 0 1 6 0 V7" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>Shop</div>
      </header>
      <p style={{ margin: 0, fontSize: 11.5, color: TEXT_DIM, lineHeight: 1.4 }}>
        Open your shop surface to manage products, pricing, and the
        catalogue that appears in the ⋮ Products pill on your Live
        posts.
      </p>
      <button
        type="button"
        disabled
        data-nex-live-studio-shop-open
        aria-label="Open shop · not yet wired"
        style={{
          minHeight: 40,
          borderRadius: 10,
          background: NAVY_GRADIENT,
          border: "none",
          color: "#FFFFFF",
          fontSize: 12.5,
          fontWeight: 800,
          cursor: "not-allowed",
          opacity: 0.55,
          fontFamily: "inherit",
          letterSpacing: "0.02em",
        }}
      >
        Open shop
      </button>
      <p style={{ margin: 0, fontSize: 10.5, color: TEXT_DIM, textAlign: "center", lineHeight: 1.4 }}>
        Wire-up requires the broadcaster&rsquo;s own shop slug · lands with the
        broadcaster-identity service.
      </p>
    </section>
  );
}
