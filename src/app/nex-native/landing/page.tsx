// src/app/nex-native/landing/page.tsx
//
// NEX landing · full-viewport hero with complete-artwork display.
// -----------------------------------------------------------------------------
// 2026-10-15 · owner-authorised final visual acceptance pass.
//
// Design intent: the "Neon NEX Cosmic Wanderer" artwork is a tall
// portrait illustration (852 × 1846) where the character + NEX cap is
// the brand focal point. On phone-aspect viewports (390 × 844 etc.)
// the image fits almost perfectly. On wider viewports (tablets,
// desktops) a `cover`-sized hero cropped the character's body and
// the entire bottom nebula, which was not an intentional art
// decision — just whatever fit.
//
// Fix: layered backgrounds.
//   · Backdrop: the same hero image scaled with `cover`, heavily
//     blurred and dimmed, fills the extra viewport space on wide
//     screens so the surrounding area reads as atmospheric nebula
//     rather than dead black bars.
//   · Primary: the same hero image sized with `contain`, aligned to
//     the top, renders the COMPLETE artwork crisply at every viewport
//     so the character, planet, phone and lower nebula are all
//     visible.
// This is the standard "ambient art" pattern (iTunes, Spotify,
// Apple TV album art) · zero new assets · deterministic across every
// screen size.
//
// Routing contract preserved · a signed-in viewer is still redirected
// to /nex-native/home so the first-visit image is only shown to
// unauthenticated users.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";

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
          justifyContent: "flex-end",
          alignItems: "center",
          padding:
            "0 25px calc(env(safe-area-inset-bottom, 0px) + 32px)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Layer 0 · ambient blurred backdrop · fills empty viewport
         *  on wide screens so the extra space reads as atmospheric
         *  nebula rather than dead black. Transform:scale slightly
         *  larger than 100% so the blur radius doesn't produce a
         *  visible soft edge inside the viewport. */}
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
            objectPosition: "center center",
            filter: "blur(44px) brightness(0.55) saturate(1.1)",
            transform: "scale(1.08)",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* Layer 1 · the complete hero artwork · `contain` guarantees
         *  the whole image is visible on every viewport, aligned to
         *  the top so the character + NEX cap sit high and the
         *  bottom nebula tapers into the CTA area below. */}
        <img
          src="/nex-native/landing-hero.png"
          alt="NEX Cosmic Wanderer"
          data-nex-landing-hero-image
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center top",
            zIndex: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <img
          src="/nex-native/landing-phone-screen.png"
          alt=""
          aria-hidden
          data-nex-landing-above-cta-image
          style={{
            display: "block",
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 420,
            height: "auto",
            marginBottom: 14,
            userSelect: "none",
            pointerEvents: "none",
          }}
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
