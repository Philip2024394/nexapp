// src/app/nex-native/landing/page.tsx
//
// NEX landing · three-slide hero carousel with complete-artwork display.
// -----------------------------------------------------------------------------
// 2026-10-15.
//
// Design intent: the landing rotates through three owner-supplied
// hero images with pagination dots:
//   1. Cosmic Wanderer character (852 × 1846, portrait aspect 0.46)
//   2. Futuristic App Showcase (1677 × 938, landscape aspect 1.79)
//   3. Neon App Showcase (1677 × 938, landscape aspect 1.79)
//
// Each slide uses the layered backdrop pattern (iTunes/Spotify
// ambient art) so the complete artwork is visible at every viewport
// regardless of the mismatch between slide aspect and viewport aspect:
//   · Backdrop: same image, cover + heavy blur + scale 1.08, fills
//     leftover viewport space with atmospheric colour rather than
//     dead black bars.
//   · Primary: same image, contain + top-aligned, renders the whole
//     artwork crisply.
//
// The carousel itself (interactivity, auto-rotate, dot pagination,
// reduced-motion handling) lives in the Client Component sibling
// `_hero-carousel-client.tsx`. This file stays a Server Component so
// the session-redirect server gate and SEO metadata are preserved.
//
// Routing contract preserved · a signed-in viewer is still redirected
// to /nex-native/home so the first-visit image is only shown to
// unauthenticated users.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { HeroCarouselClient, type HeroSlide } from "./_hero-carousel-client";

// Three SMALL phone-showcase images rotating in a compact carousel
// above the orange CTA. The Cosmic Wanderer character stays as the
// STATIC full-viewport backdrop · it is NOT part of the rotating
// slides. These three are all phone-showcase style and share visual
// language.
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX",
  description: "NEX.",
};

export default async function LandingPage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "session") {
    redirect("/nex-native/home");
  }

  return (
    <>
      {/* Landing-only overrides. The parent nex-native layout wraps
       *  every /nex-native/* route in a mobile-preview frame
       *  (.nex-native-stage > .nex-native-frame) so designers can
       *  see non-landing surfaces at phone proportions on desktop.
       *  The LANDING page is a marketing hero — it should fill the
       *  whole viewport. These rules collapse the frame visuals on
       *  this route only (safely scoped via :has()) and reset
       *  box-sizing so width:100% + padding doesn't overflow. */}
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
          overflow: hidden !important;
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
          height: "100%",
          overflow: "hidden",
          background: "#06060F",
          display: "flex",
          flexDirection: "column",
          // The carousel container inside owns the top area via flex:1.
          // Dots + CTA + sign-in stack naturally below. No justify-end
          // because the carousel's flex-grow pushes them down.
          justifyContent: "flex-start",
          alignItems: "center",
          padding:
            "0 25px calc(env(safe-area-inset-bottom, 0px) + 32px)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Compact carousel · 3 small phone-showcase images rotating
         *  just above the orange CTA. The Cosmic Wanderer character
         *  is the STATIC full-viewport backdrop below, decoupled from
         *  the rotating slides · it never appears inside the carousel.
         *  Dots render immediately below the carousel band. */}
        <HeroCarouselClient
          slides={HERO_SLIDES}
          backdropSrc="/nex-native/landing-hero.png"
        />
        <Link
          href="/nex-native/welcome"
          data-nex-landing-primary-cta
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            width: "100%",
            padding: "8px 20px",
            minHeight: 31,
            borderRadius: 999,
            background: "#FF7200",
            color: "#000000",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.01em",
            textDecoration: "none",
            boxShadow:
              "0 8px 22px -6px rgba(255,114,0,0.55), 0 1px 0 rgba(255,255,255,0.35) inset",
            marginBottom: 10,
          }}
        >
          Get Started
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.18)",
              fontSize: 11,
              fontWeight: 800,
              color: "#000000",
            }}
          >
            →
          </span>
        </Link>
        <div
          data-nex-landing-signin-row
          style={{
            position: "relative",
            zIndex: 2,
            fontSize: 13,
            color: "rgba(255,255,255,0.78)",
            textShadow: "0 1px 3px rgba(0,0,0,0.55)",
          }}
        >
          Already have account?{" "}
          <Link
            href="/nex-native/sign-in"
            data-nex-landing-signin-link
            style={{
              color: "#FFFFFF",
              fontWeight: 700,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Sign in
          </Link>
        </div>
      </main>
    </>
  );
}
