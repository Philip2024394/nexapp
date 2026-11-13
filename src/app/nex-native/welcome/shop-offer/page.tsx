// src/app/nex-native/welcome/shop-offer/page.tsx
//
// Signup-flow interstitial · owner directive 2026-11-12.
// -------------------------------------------------------------------------
// After a new user hits Activate on /settings/profile/edit?from=signup,
// their server action redirects HERE first. The page pitches the shop
// subscription over a sealed golden backdrop image and offers two
// mutually-exclusive paths:
//
//   · "Yes I'm in"   → /manage/shop/setup?from=signup
//                      (jumps straight into the existing sealed shop
//                      setup wizard · skips the /manage/shop/start
//                      landing pitch since this page already pitched)
//
//   · "Skip for now" → /welcome/account-active
//                      (confetti · congratulations · Enter NEX)
//
// Rendering is done server-side so the gold-shopping backdrop + the
// pitch copy + the two buttons arrive as one paint · no flash.
// Session is resolved via dev-override so Nex-99901 and other dev
// personas are recognised.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShopOfferWelcomePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <main
      data-nex-shop-offer
      style={{
        position: "relative",
        height: "100%",
        maxHeight: "100dvh",
        overflow: "hidden",
        color: "#F2F5F8",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Sealed golden backdrop · copy sits over a dark bottom scrim
          so the pitch text + buttons stay legible on bright phones. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nex-onboarding/shop-offer-backdrop.png"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(10,20,40,0.05) 0%, rgba(10,20,40,0.35) 55%, rgba(10,20,40,0.82) 100%)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          maxWidth: 460,
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top,0) + 24px) 20px calc(env(safe-area-inset-bottom,0) + 28px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 18,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#FFD600",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            One more thing
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.18,
              textShadow: "0 2px 12px rgba(0,0,0,0.55)",
            }}
          >
            Sell on NEX, social media and Google search listings
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.45,
              color: "#F2F5F8",
              textShadow: "0 1px 6px rgba(0,0,0,0.6)",
            }}
          >
            Only{" "}
            <span style={{ color: "#FFD600", fontWeight: 900 }}>
              €4.99 per month
            </span>
            . Open your shop, get found worldwide, and reply to buyers
            in NEX Chat the second they land.
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          <Link
            href="/nex-native/manage/shop/setup?from=signup"
            data-nex-shop-offer-yes
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "15px 22px",
              borderRadius: 999,
              background: "#FF7200",
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              boxShadow:
                "0 4px 14px rgba(255, 114, 0, 0.45), 0 0 20px rgba(255, 114, 0, 0.25)",
            }}
          >
            Yes · I&apos;m in →
          </Link>
          <Link
            href="/nex-native/welcome/account-active"
            data-nex-shop-offer-skip
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 22px",
              borderRadius: 999,
              background: "transparent",
              color: "#F2F5F8",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              border: "1px solid rgba(242, 245, 248, 0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            Skip for now
          </Link>
        </div>
      </div>
    </main>
  );
}
