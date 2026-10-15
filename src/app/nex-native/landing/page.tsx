// src/app/nex-native/landing/page.tsx
//
// NEX landing · marketing composition · 2026-10-15.
// -----------------------------------------------------------------------------
// Rebuilt to match the owner-supplied template at
// c:/Users/Victus/Pictures/az1.png. Full-viewport Cosmic Wanderer
// backdrop + top-left brand header + headline block + 4-capability
// icon tile + carousel band + CTA + sign-in.
//
// Routing contract preserved · signed-in viewers are redirected to
// /nex-native/home so this surface is only shown to unauthenticated
// first-time visitors.
//
// B.1a chat-composer work lives in disjoint files
// (src/lib/nex-native/use-virtual-keyboard-inset.ts +
// src/app/nex-native/chat-standard/_universal-composer-footer.tsx)
// and is untouched by this pass.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { HeroCarouselClient, type HeroSlide } from "./_hero-carousel-client";

// Three phone-showcase slides rotating in the compact band.
const HERO_SLIDES: readonly HeroSlide[] = [
  {
    src: "/nex-native/landing-phone-screen.png",
    alt: "NEX chat on five phones",
    label: "Chat showcase",
  },
  {
    src: "/nex-native/landing-hero-2-futuristic.png",
    alt: "Futuristic NEX App Showcase on multiple phones",
    label: "Futuristic app showcase",
  },
  {
    src: "/nex-native/landing-hero-3-neon.png",
    alt: "Neon NEX App Showcase on multiple phones",
    label: "Neon app showcase",
  },
] as const;

// 4 capability tiles (template order · each has a title + subtitle).
const ICON_TILES: ReadonlyArray<{ title: string; subtitle: string }> = [
  { title: "Chat", subtitle: "With friends, family & more" },
  { title: "Themes", subtitle: "Make it yours" },
  { title: "Shop", subtitle: "Discover local businesses" },
  { title: "Community", subtitle: "Real people. Real connections." },
];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Chat, Discover, Connect",
  description:
    "The ultimate chat experience with stunning themes, powerful features, and a world of possibilities.",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function LandingPage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "session") {
    redirect("/nex-native/home");
  }

  return (
    <>
      {/* Landing-only scoped overrides · collapse the mobile-preview
       *  frame visuals ONLY on this route so the hero fills the
       *  viewport. Mobile phones (<500px) already render edge-to-edge
       *  via the frame's narrow-viewport branch. */}
      <style>{`
        html, body {
          background: #06060F !important;
          margin: 0 !important;
          padding: 0 !important;
          height: 100dvh !important;
          overflow: hidden !important;
        }
        body:has([data-nex-landing-root]) .nex-native-stage {
          display: contents !important;
          background: transparent !important;
          height: auto !important;
          overflow: visible !important;
        }
        body:has([data-nex-landing-root]) .nex-native-frame {
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          min-height: 0 !important;
          aspect-ratio: auto !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          /* Allow the landing main to scroll internally on short
             viewports so the orange CTA + sign-in stay reachable. */
          overflow-y: auto !important;
          overflow-x: hidden !important;
          background: #06060F !important;
        }
        [data-nex-landing-root],
        [data-nex-landing-root] * {
          box-sizing: border-box;
        }
      `}</style>
      <main
        data-nex-landing-root
        style={{
          position: "relative",
          width: "100%",
          minHeight: "100%",
          // Allow scroll on short viewports so the orange CTA + sign-in
          // row remain reachable even when the full layout exceeds the
          // user's browser height. On tall viewports there is nothing
          // to scroll · the content fits.
          overflowY: "auto",
          overflowX: "hidden",
          background: "#06060F",
          color: "#FFFFFF",
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 10px) 18px calc(env(safe-area-inset-bottom, 0px) + 10px)",
        }}
      >
        {/* Full-viewport static Cosmic Wanderer backdrop */}
        <img
          src="/nex-native/landing-hero.png"
          alt=""
          aria-hidden
          data-nex-landing-hero-backdrop
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* ─── Top brand header · badge on the LEFT, right column
             stacks: NEX text + "More than chat." + "Your world,
             connected." (matches owner-supplied template). ─── */}
        <header
          data-nex-landing-brand-header
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
          }}
        >
          {/* Shared NEX ping badge · blue ring, pulsing halo, "NE"
              lettering. Owner-approved 2026-10-15 (same badge appears
              in the welcome page header). Replaces the previous
              landing-nex-badge.png so both surfaces share the design
              and the ping animation. */}
          <NexPingBadge size={78} accent="#00AFFF" dataTestId="landing-nex" />
          <div
            data-nex-landing-brand-header-text
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              // Nudge the text block DOWN so NEX + taglines sit lower
              // relative to the round badge (owner directive).
              marginTop: 14,
            }}
          >
            <span
              data-nex-landing-header-nex-text
              style={{
                fontSize: 32,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                textShadow: "0 2px 10px rgba(0,0,0,0.55)",
              }}
            >
              NEX
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#FFFFFF",
                textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              }}
            >
              More than chat.
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                background:
                  "linear-gradient(90deg, #00AFFF 0%, #B47CFF 55%, #FF5BAE 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
              }}
            >
              Your world, connected.
            </span>
          </div>
        </header>

        {/* ─── Headline block · narrow LEFT column so the character
             on the backdrop stays visible on the right, matching the
             owner-supplied template. */}
        <section
          data-nex-landing-headline
          style={{
            position: "relative",
            zIndex: 2,
            alignSelf: "flex-start",
            maxWidth: 240,
            marginTop: "auto",
            marginBottom: 14,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.015em",
              color: "#FFFFFF",
              textShadow: "0 2px 10px rgba(0,0,0,0.55)",
            }}
          >
            Meet
          </div>
          <img
            src="/nex-native/landing-nex-wordmark.png"
            alt="NEX"
            data-nex-landing-headline-nex
            style={{
              display: "block",
              height: 80,
              width: "auto",
              // Negative top margin pulls the wordmark up tight to
              // "Meet" so the two read as a tight headline pair
              // (owner directive: "Meet word should be close to NEX
              // image").
              margin: "-10px 0 6px",
              filter: "drop-shadow(0 6px 20px rgba(180,124,255,0.4))",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.005em",
              marginBottom: 6,
              color: "#FFFFFF",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
            }}
          >
            Chat. Discover. Connect.
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            The ultimate chat experience with stunning themes, powerful
            features, and a world of possibilities.
          </p>
        </section>

        {/* ─── 4-capability icon row · one combined icon-set image +
           *   4-column label grid directly below. Labels: title + subtitle. ─── */}
        <section
          data-nex-landing-icon-set-group
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            alignSelf: "stretch",
            marginBottom: 10,
          }}
        >
          <img
            src="/nex-native/landing-icon-set.png"
            alt="NEX capabilities · Chat · Themes · Shop · Community"
            data-nex-landing-icon-set-image
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          <div
            data-nex-landing-icon-set-labels
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 4,
              marginTop: 2,
              padding: "0 2px",
            }}
          >
            {ICON_TILES.map((tile) => (
              <div
                key={tile.title}
                data-nex-landing-icon-label={tile.title.toLowerCase()}
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: "#FFFFFF",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  }}
                >
                  {tile.title}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    lineHeight: 1.25,
                    color: "rgba(255,255,255,0.72)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                  }}
                >
                  {tile.subtitle}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Rotating carousel + dots ─── */}
        <HeroCarouselClient slides={HERO_SLIDES} />

        {/* ─── Orange CTA ─── */}
        <Link
          href="/nex-native/welcome"
          data-nex-landing-primary-cta
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "12px 24px",
            minHeight: 48,
            borderRadius: 999,
            background:
              "linear-gradient(180deg, #FF8A2A 0%, #FF7200 100%)",
            color: "#1A0F00",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.01em",
            textDecoration: "none",
            boxShadow:
              "0 10px 28px -6px rgba(255,114,0,0.55), 0 1px 0 rgba(255,255,255,0.42) inset",
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          Get Started
          <span
            aria-hidden
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#1A0F00",
            }}
          >
            →
          </span>
        </Link>

        {/* ─── Sign-in row ─── */}
        <div
          data-nex-landing-signin-row
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            fontSize: 13,
            color: "rgba(255,255,255,0.78)",
            textShadow: "0 1px 3px rgba(0,0,0,0.55)",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/nex-native/sign-in"
            data-nex-landing-signin-link
            style={{
              color: "#00AFFF",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </main>
    </>
  );
}
