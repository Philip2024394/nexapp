// src/app/nex-native/create-account/business-welcome/page.tsx
//
// NEX · Business Welcome · pre-signup intro container.
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Reached from the "Business NEX Chat" welcome card (card 3) · the sealed
// three-card welcome page (/nex-native/welcome) now routes shop-intent
// taps here instead of straight to /chat-themes-library. The intro
// collects two things:
//
//   1. Business type (vertical) · Phase A1 hold · Accommodation only.
//      The other three tiles (Food & Drink, Products, Services) render
//      honestly as "Coming soon" per the sealed release doctrine.
//
//   2. Location (free-text city/area) · seeds the NEX Directory
//      evidence pipeline. Appearance in search is still gated by the
//      sealed Directory Spine (lifecycle_state VERIFIED/CLAIMED +
//      freshness FRESH/AGING + no open conflicts) · the UI copy is
//      honest about that.
//
// Guest-safe (no session required). Submission persists both to
// cookies and continues to /create-account?intent=shop so the sealed
// signup chain picks up the context.
//
// Scope boundaries:
//   · No DB connection · migration 213 remains unapplied.
//   · No new peer-message attachment types.
//   · No sealed-primitive change (vertical-presets enum, Chat Master
//     Layout, theme engine, R8 gate, peer-message idempotency).
//   · Phase A1 release hold respected · only Accommodation is reachable.

import type * as React from "react";
import Link from "next/link";
import { BusinessWelcomeFormClient } from "./_business-welcome-form-client";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(3, 16, 29, 0.72)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function BusinessWelcomePage(): Promise<React.ReactElement> {
  // Resolve session for the ControlDrawer · guest-safe · null session
  // renders a "Sign in" prompt inside the drawer. Mirrors the welcome
  // page pattern.
  let drawerSession: ControlDrawerSession | null = null;
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
      };
    }
  } catch {
    // guest · keep drawerSession = null
  }

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-business-welcome-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily: SANS,
          padding: "0 16px 48px",
          overflow: "hidden",
        }}
      >
        {/* Owner directive 2026-10-21 (iteration 2) · the background
            image stays INSIDE the phone frame on desktop. Scoped to
            the main (position:absolute · 100% × 100%) so the frame
            bezel remains visible. The dark overlay keeps the hero +
            form legible on top of the illustration. */}
        <img
          src="/nex-native/business-welcome-bg.png"
          alt=""
          aria-hidden
          data-nex-business-welcome-bg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          data-nex-business-welcome-bg-overlay
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0.84) 55%, rgba(2,9,20,0.92) 100%)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* ─── NEX identity header · matches /welcome shell ───────
            Ping badge on the left · wordmark + subtitle · 3-dots
            drawer on the right. Guest-safe · drawer shows Sign in
            prompt when no session. */}
        <header
          data-nex-business-welcome-header
          style={{
            position: "relative",
            zIndex: 2,
            padding:
              "calc(env(safe-area-inset-top, 0) + 24px) 2px 10px 4px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <NexPingBadge
            size={56}
            accent="#00AFFF"
            dataTestId="business-welcome-nex"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              data-nex-business-welcome-header-row
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                zIndex: 3,
              }}
            >
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: NEX.text,
                  lineHeight: 1,
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                NEX
              </span>
              <div style={{ marginLeft: "auto", display: "inline-flex" }}>
                <ControlDrawer session={drawerSession} />
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: NEX.textDim,
                lineHeight: 1.2,
                textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              }}
            >
              Business Account
            </span>
          </div>
        </header>
        {/* Centre column · phone-frame friendly */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            paddingTop: 12,
          }}
        >
          {/* Hero · owner directive 2026-10-21 (iteration 3) · hero
              paragraph removed. Header + form carry the identity. */}

          {/* ─── What you get · owner directive 2026-10-21 iteration 13 ─
              Four honestly-deliverable Business items. NO trial
              promise (welcome-trial-copy guards G-D4-1/3/4 forbid
              "N days free when you join" on welcome-adjacent flows).
              NO hard price (sealed memo 2026-10-20 says pricing is
              PROPOSAL, not approved for hard-code). Vault excluded
              per the LOCKED entitlements policy 2026-10-20. */}
          <section
            data-nex-business-welcome-value-prop
            style={{
              padding: "16px 14px 14px",
              background: NEX.panel,
              border: `1px solid ${NEX.panelBorder}`,
              borderRadius: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              What Business Chat includes
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              <ValuePropTile glyph="💬" label="Your NEX Chat" />
              <ValuePropTile glyph="🧭" label="Shop page" />
              <ValuePropTile glyph="🔎" label="Directory listing" />
              <ValuePropTile glyph="📥" label="Customer enquiries" />
            </div>
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
              }}
            >
              <Link
                href="/nex-native/packages"
                data-nex-business-welcome-see-plans
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  textDecoration: "none",
                  borderBottom: `1px dashed ${NEX.cyanSoft}`,
                  paddingBottom: 1,
                }}
              >
                See all plans →
              </Link>
            </div>
          </section>

          {/* Interactive form · business type + shop name + location */}
          <section
            style={{
              padding: "20px 16px",
              background: NEX.panel,
              border: `1px solid ${NEX.panelBorder}`,
              borderRadius: 20,
            }}
          >
            <BusinessWelcomeFormClient />
          </section>

          {/* Owner directive 2026-10-21 (iteration 10) · the
              "What happens after Continue" honesty footer was removed. */}
        </div>
      </main>
    </>
  );
}

/** Owner directive 2026-10-21 iteration 13 · value-prop tile. One
 *  emoji glyph + a short label. No pricing / no trial copy per the
 *  sealed welcome-trial-copy + packages honesty doctrine. */
function ValuePropTile({
  glyph,
  label,
}: {
  glyph: string;
  label: string;
}): React.ReactElement {
  return (
    <div
      data-nex-business-welcome-value-prop-tile
      style={{
        padding: "10px 6px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(0,175,255,0.18)",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
        {glyph}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "-0.002em",
          color: "#F2F5F8",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}
