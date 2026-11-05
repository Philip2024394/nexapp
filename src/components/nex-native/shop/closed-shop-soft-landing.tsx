// src/components/nex-native/shop/closed-shop-soft-landing.tsx
//
// Closed-shop soft-landing · NEX Shop Entitlement Contract § K-4
// ---------------------------------------------------------------
// Rendered on `/nex-native/{slug}` when a seller's Shop membership
// has lapsed into permanent-closure state. Soft-landing preserves
// SEO + social-share dignity for buyers who follow stale WhatsApp
// or Instagram links to a shop that is no longer active.
//
// Contract reference: § K-4 (locked 2026-11-06)
//   "On day 30+ after grace expires (never resubscribed),
//    /nex-native/{slug} renders 'This shop is no longer active'
//    soft-landing + chat CTA. Shop data retained internally for
//    audit + possible resubscription; not published. Buyer landing
//    from stale WhatsApp/Instagram share sees option to message
//    the former seller via chat (sellers keep their chat account
//    independent of Shop membership)."
//
// What this file does NOT do:
//   · Does not render products, categories, stock, pricing, or
//     any commerce surface. The shop is gone.
//   · Does not advertise or hint at reactivation to buyers · that
//     is a seller-side billing concern, surfaced elsewhere.
//   · Does not invent new UI. Colours + fonts match the sealed
//     [businessSlug]/page.tsx NEX token palette so the soft
//     landing reads as the SAME world as the active shop would.
//
// Classification: presentational · pure props · no server I/O.

import Link from "next/link";
import type * as React from "react";

// Same design tokens the sealed shop landing uses · do not diverge.
const NEX_TEXT = "#F4F7FC";
const NEX_TEXT_DIM = "#8BA9D1";
const NEX_TEXT_MUTE = "#526B89";
const NEX_BG = "var(--nex-world-background-base, #020914)";
const NEX_PANEL = "#050f1e";
const NEX_BORDER = "rgba(139, 169, 209, 0.14)";
const NEX_ORANGE = "#FF7800";

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface ClosedShopSoftLandingProps {
  /** `/nex-native/chat/peer/{owner_account_id}` — reuses the sealed
   *  chat-peer URL pattern from the active shop page's `chatHref`
   *  variable. Sellers keep their chat account independent of Shop
   *  membership, so this remains reachable after the shop closes. */
  readonly sellerChatHref: string;
  /** Former shop display name, for a dignified "shop-name is no
   *  longer active" line when provided. Optional; when absent the
   *  copy stays neutral ("This shop is no longer active"). */
  readonly displayName?: string | null;
}

export function ClosedShopSoftLanding(
  props: ClosedShopSoftLandingProps,
): React.ReactElement {
  const { sellerChatHref, displayName } = props;
  const name =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim()
      : null;

  return (
    <div
      role="main"
      style={{
        minHeight: "100dvh",
        background: NEX_BG,
        color: NEX_TEXT,
        fontFamily: SANS,
        display: "grid",
        placeItems: "center",
        padding: "24px 20px calc(env(safe-area-inset-bottom, 0) + 32px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 20,
        }}
      >
        {/* Brand mark · matches the sealed /{slug} header wordmark so
            the soft landing reads as the SAME world. Smaller size here
            because there is no cover photo competing for visual weight. */}
        <Link
          href="/nex-native"
          aria-label="NEX home"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "0.08em",
            padding: "6px 4px",
            color: NEX_TEXT,
          }}
        >
          <span style={{ color: "#F2F5F8" }}>NE</span>
          <span style={{ color: NEX_ORANGE }}>X</span>
        </Link>

        {/* Dignified heading · serif editorial grammar matches the
            active shop page's product headlines. "No longer active"
            is factual, neutral, respectful · never speculates why. */}
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: "clamp(28px, 7vw, 40px)",
            lineHeight: 1.1,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: NEX_TEXT,
          }}
        >
          {name ? `${name} is no longer active` : "This shop is no longer active"}
        </h1>

        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: 15,
            lineHeight: 1.55,
            color: NEX_TEXT_DIM,
            maxWidth: 360,
          }}
        >
          The shop has closed. You can still reach the owner on NEX chat
          if you want to ask about past orders or get back in touch.
        </p>

        {/* Chat CTA · the ONE action available here. Sellers keep their
            chat account independent of Shop membership (§ K-4). */}
        <Link
          href={sellerChatHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "14px 28px",
            marginTop: 8,
            borderRadius: 999,
            background: NEX_ORANGE,
            color: "#0B0C0F",
            fontFamily: SANS,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.01em",
            textDecoration: "none",
            minWidth: 220,
          }}
        >
          Message the owner
        </Link>

        {/* Honest footnote · points the lost buyer somewhere useful
            without pretending this specific shop can come back. */}
        <div
          style={{
            marginTop: 18,
            padding: "14px 16px",
            borderRadius: 14,
            background: NEX_PANEL,
            border: `1px solid ${NEX_BORDER}`,
            fontFamily: SANS,
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX_TEXT_MUTE,
            width: "100%",
          }}
        >
          Looking for a similar shop?{" "}
          <Link
            href="/nex-native/directory"
            style={{
              color: NEX_TEXT_DIM,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Browse the NEX directory
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
