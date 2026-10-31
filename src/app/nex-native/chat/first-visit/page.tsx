// src/app/nex-native/chat/first-visit/page.tsx
//
// NEX free-chat first-visit experience · redesigned 2026-10-14.
//
// Owner direction (2026-10-14): "the first arrival for user should be
// chat nex free theme with footer and header standard theme - and
// then 3 landscape cards on the center area of the screen (like the
// shop slider cards first time) and we should have a welcome to NEX
// Chat for the ultimate chat experience and business features."
//
// Shape of this surface:
//   · HEADER · sealed ChatIdentityHeader primitive (NEX cyan + "NEX"
//     + personalised welcome subtitle). Required by Chat Master Layout.
//   · WELCOME TEXT BLOCK · owner's three lines of copy, mobile-first.
//   · THREE LANDSCAPE CARDS · stacked vertically in the content column,
//     each a wide-rect tile with a gradient visual on the left and
//     title + status on the right. Reads like the shop-slider cards.
//   · TAGLINE · the owner's "jaw-dropped future" line in muted text.
//   · FOOTER · sealed ChatComposerPill primitive (client-side stub ·
//     routes to /nex-native/chat on submit, no fake peer send).
//     Required by Chat Master Layout.
//
// Honest status of each destination (unchanged from the previous build):
//   1 · Chat Themes      · PROVEN LIVE · /nex-native/chat-themes-library
//   2 · Chat Themes Shop · NOT WIRED FOR PURCHASE · browse-only Phase-2
//       preview at /nex-native/chat/first-visit/shop
//   3 · Personalized     · NOT IMPLEMENTED · honest "coming soon" at
//       /nex-native/chat/first-visit/personalize
//
// What this page does NOT do:
//   · Does NOT change any account state. No cookie set, no DB write,
//     no theme preference modified.
//   · Does NOT bypass NEX_COMMERCE_ENABLED. Shop destination is a
//     browse-only RSC page.
//   · Does NOT activate payments, Vault, SafeChat, or any gated feature.
//   · Does NOT send a message anywhere · the composer routes the user
//     into the normal /nex-native/chat landing.
//   · Does NOT auto-redirect new users here · entry wire-up lives on
//     /nex-native/home via the `FirstVisitInvitation` tile.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { FirstVisitComposerStub } from "./_composer-stub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Sealed NEX design tokens ────────────────────────────────────
// NEX free-theme palette · navy / cyan / orange. No third palette.

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  violet: "#9B6DFF",
  violetFaint: "rgba(155, 109, 255, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
} as const;

interface Destination {
  readonly key: "themes" | "shop" | "personalize";
  readonly href: string;
  readonly title: string;
  readonly tagline: string;
  readonly accent: string;
  readonly status: "live" | "coming-phase-2" | "coming-soon";
  readonly statusLabel: string;
}

const DESTINATIONS: readonly Destination[] = [
  {
    key: "themes",
    href: "/nex-native/chat-themes-library",
    title: "Chat Themes",
    tagline: "Browse NEX's live themes and pick the one that suits you.",
    accent: NEX.cyan,
    status: "live",
    statusLabel: "Available now",
  },
  {
    key: "shop",
    href: "/nex-native/chat/first-visit/shop",
    title: "Chat Themes Shop",
    tagline:
      "Discover themes being prepared for the NEX shop · purchases open in Phase 2.",
    accent: NEX.orange,
    status: "coming-phase-2",
    statusLabel: "Browse · purchases open Phase 2",
  },
  {
    key: "personalize",
    href: "/nex-native/chat/first-visit/personalize",
    title: "Personalized Themes",
    tagline:
      "Preview how different NEX themes express different atmospheres.",
    accent: NEX.violet,
    status: "coming-soon",
    statusLabel: "Preview the idea · personalization coming",
  },
] as const;

export default async function FirstVisitChatPage(): Promise<React.ReactElement> {
  // Only signed-in NEX users should see the first-visit landing. Guests
  // bounce to /welcome where the guest-side first-open experience lives.
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind !== "session") {
    redirect("/nex-native/welcome");
  }

  const displayName = viewer.session.account.display_name ?? "there";
  const firstName = displayName.split(" ")[0] || "there";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
      data-nex-surface="first-visit-chat"
    >
      {/* ─── HEADER · bespoke NEX brand identity row 2026-10-15.
          Owner directive · the free chat NEX standard header must
          carry the same shared blue ping NEX badge used on landing
          and welcome. ChatIdentityHeader primitive stays imported
          for parity with other sealed chat surfaces (peer, guest,
          vault) that are not template-locked. */}
      <header
        data-nex-first-visit-header
        style={{
          position: "relative",
          flexShrink: 0,
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <NexPingBadge size={56} accent="#00AFFF" dataTestId="first-visit-nex" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              color: NEX.textPrimary,
              lineHeight: 1,
              textShadow: "0 2px 10px rgba(0,0,0,0.6)",
            }}
          >
            NEX
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: NEX.textSecondary,
              lineHeight: 1.2,
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            }}
          >
            {`Welcome, ${firstName}`}
          </span>
        </div>
      </header>

      {/* ─── CENTRE · welcome + three landscape cards ────────── */}
      <section
        aria-label="Welcome to NEX Chat"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "6px 16px 20px",
          maxWidth: 640,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Owner-authored welcome copy · headline + benefit + body */}
        <div
          data-nex-first-visit-welcome
          style={{
            textAlign: "center",
            padding: "6px 4px 4px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: NEX.textPrimary,
              fontFamily:
                "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            }}
          >
            Welcome to NEX Chat
          </h1>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              lineHeight: 1.4,
              color: NEX.cyan,
              letterSpacing: "0.02em",
              fontWeight: 600,
            }}
          >
            The ultimate chat experience · plus business features.
          </div>
          <p
            style={{
              margin: "10px 2px 0",
              fontSize: 13,
              lineHeight: 1.5,
              color: NEX.textSecondary,
            }}
          >
            To get started, let's get your free account buzzing so you can
            connect with the world at your fingertips.
          </p>
        </div>

        {/* THREE LANDSCAPE CARDS · stacked in the content column */}
        <ol
          aria-label="Choose your first NEX theme destination"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          data-nex-first-visit-cards-layout="landscape"
        >
          {DESTINATIONS.map((d) => (
            <li key={d.key} style={{ margin: 0, padding: 0 }}>
              <DestinationLandscapeCard destination={d} />
            </li>
          ))}
        </ol>

        {/* Owner-authored tagline · muted, closes the pitch */}
        <div
          data-nex-first-visit-tagline
          style={{
            marginTop: 4,
            padding: "0 10px",
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: NEX.textMuted,
            fontStyle: "italic",
          }}
        >
          It's never been as easy to become the future · while your contacts
          are left jaw-dropped.
        </div>

        {/* Skip affordance · tiny · routes to normal chat landing */}
        <Link
          href="/nex-native/chat"
          data-nex-first-visit-skip
          aria-label="Skip and continue to NEX Chat"
          style={{
            display: "block",
            textAlign: "center",
            padding: "8px 12px",
            marginTop: 2,
            color: NEX.textMuted,
            fontSize: 12,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Continue to NEX Chat →
        </Link>
      </section>

      {/* ─── FOOTER · sealed ChatComposerPill primitive ────── */}
      <footer
        style={{
          padding: "0 12px calc(env(safe-area-inset-bottom, 0) + 12px)",
          flexShrink: 0,
        }}
        data-nex-first-visit-footer
      >
        <FirstVisitComposerStub />
      </footer>
    </main>
  );
}

// ─── Landscape card ───────────────────────────────────────────
// Wide rectangle · left-side gradient visual · right-side title /
// tagline / status. Reads like the shop-slider product cards: the
// user sees three tiles at a glance in the centre of the screen.

function DestinationLandscapeCard({
  destination,
}: {
  destination: Destination;
}): React.ReactElement {
  const { key, href, title, tagline, accent, status, statusLabel } =
    destination;
  const live = status === "live";

  const chipFg = live
    ? "#16D66B"
    : status === "coming-phase-2"
      ? NEX.orange
      : NEX.cyan;
  const chipBg = live
    ? "rgba(22, 214, 107, 0.14)"
    : status === "coming-phase-2"
      ? NEX.orangeFaint
      : NEX.cyanFaint;

  return (
    <Link
      href={href}
      data-nex-first-visit-card={key}
      data-nex-first-visit-card-layout="landscape"
      data-nex-first-visit-status={status}
      aria-label={`${title} · ${statusLabel}`}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: 12,
        padding: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.borderStrong}`,
        borderRadius: 14,
        textDecoration: "none",
        color: NEX.textPrimary,
        position: "relative",
        overflow: "hidden",
        minHeight: 92,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Accent band · thin left stripe matches the destination hue */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          background: `linear-gradient(180deg, ${accent} 0%, transparent 100%)`,
        }}
      />

      {/* Left · landscape gradient preview tile */}
      <div
        aria-hidden
        data-nex-first-visit-card-visual
        style={{
          flexShrink: 0,
          width: 108,
          height: 72,
          alignSelf: "center",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}44 0%, ${accent}11 60%, transparent 100%)`,
          border: `1px solid ${accent}44`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 14,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${accent}, ${accent}66 70%, transparent 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 12,
            width: 42,
            height: 8,
            borderRadius: 999,
            background: `${accent}66`,
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 44,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `${accent}aa`,
          }}
        />
      </div>

      {/* Right · title + tagline + status chip */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingRight: 2,
          paddingLeft: 2,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.2,
              color: NEX.textPrimary,
              fontFamily:
                "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
              letterSpacing: "-0.005em",
              flex: 1,
              minWidth: 0,
            }}
          >
            {title}
          </h2>
          <span
            data-nex-first-visit-chip
            style={{
              flexShrink: 0,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 999,
              color: chipFg,
              background: chipBg,
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
          >
            {live ? "Live" : status === "coming-phase-2" ? "Phase 2" : "Soon"}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.4,
            color: NEX.textSecondary,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {tagline}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            color: NEX.textMuted,
          }}
        >
          <span aria-hidden style={{ color: accent }}>
            ●
          </span>
          <span>{statusLabel}</span>
          <span
            aria-hidden
            style={{
              marginLeft: "auto",
              color: accent,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
