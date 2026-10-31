// src/app/nex-native/chat/first-visit/shop/page.tsx
//
// Chat Themes Shop · honest "browse-only" preview · 2026-10-14.
//
// This destination is reached from the first-visit page when a user
// taps "Chat Themes Shop". It is NOT a storefront. Purchases are not
// wired in this codebase (migration 193 explicitly: "Payment provider
// is NOT WIRED YET. No simulated payment path is granted here."). No
// Stripe consumer exists. The page below respects that honestly:
//
//   · reads the live catalogue via listActiveThemes()
//   · displays theme name, tagline and accent colour
//   · displays NO price, NO buy button, NO "unlock" CTA
//   · displays a prominent "Shop opening Phase 2" explainer
//   · reinforces NEX_COMMERCE_ENABLED is the only legitimate on-switch
//
// Entry criteria:
//   · Any signed-in NEX user (same gate as the first-visit page).
//   · Guests redirect to /welcome.
//
// This page does NOT change state. No cookie set. No DB write. No
// theme preference modified.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { listActiveThemes } from "@/lib/nex-native/chat-theme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
} as const;

export default async function FirstVisitShopPage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind !== "session") {
    redirect("/nex-native/welcome");
  }

  // Read the live catalogue · tolerate failure (an empty catalogue
  // just means no browse-only tiles render · the explainer still
  // works). We never create a fake row to fill the grid.
  let themes: Awaited<ReturnType<typeof listActiveThemes>> = [];
  try {
    themes = await listActiveThemes();
  } catch {
    themes = [];
  }

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
      data-nex-surface="first-visit-shop"
    >
      <header
        style={{
          position: "relative",
          flexShrink: 0,
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 20px",
          textShadow: "0 2px 20px rgba(0,0,0,0.75)",
        }}
      >
        <ChatIdentityHeader
          avatarUrl={null}
          displayName="Themes Shop"
          subtitle="Browse · opening Phase 2"
          presenceKind="online"
          rightReserveWidth={0}
        />
      </header>

      <section
        style={{
          flex: 1,
          padding: "4px 16px 24px",
          maxWidth: 640,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Explainer · honest, not sell-y */}
        <div
          data-nex-first-visit-shop-explainer
          role="status"
          style={{
            marginTop: 8,
            marginBottom: 16,
            padding: "14px 16px",
            background: NEX.orangeFaint,
            border: `1px solid ${NEX.orange}44`,
            borderRadius: 14,
            color: NEX.textPrimary,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: NEX.orange }}>Shop opening Phase 2.</strong>{" "}
          Have a look around · you can browse the themes that are being
          prepared for the shop. Purchasing isn't wired in this version, so
          none of the tiles below is for sale yet. We'll tell you when the
          shop opens.
        </div>

        {/* Browse-only grid · reads the live catalogue, no price, no buy */}
        {themes.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: NEX.textMuted,
              fontSize: 14,
              border: `1px solid ${NEX.borderSoft}`,
              borderRadius: 14,
              background: NEX.panel,
            }}
            data-nex-first-visit-shop-empty
          >
            Catalogue not available right now. Check back later.
          </div>
        ) : (
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
            }}
          >
            {themes.map((t) => (
              <li
                key={t.id}
                data-nex-first-visit-shop-tile={t.id}
                data-nex-theme-tier={t.tier}
                style={{
                  background: NEX.panel,
                  border: `1px solid ${NEX.borderStrong}`,
                  borderRadius: 14,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 140,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    height: 54,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${t.accent_hex}44 0%, ${t.accent_hex}11 60%, transparent 100%)`,
                    border: `1px solid ${t.accent_hex}55`,
                  }}
                />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: NEX.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.name}
                </div>
                {t.tagline ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: NEX.textSecondary,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                    }}
                  >
                    {t.tagline}
                  </div>
                ) : null}
                {/* Tier chip · informational metadata · NOT enforced */}
                <div
                  style={{
                    marginTop: "auto",
                    fontSize: 11,
                    color: NEX.textMuted,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.tier === "bisnis" ? "Premium" : "Standard"}
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Reinforced honesty · no fake CTA */}
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            color: NEX.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          No prices are shown because purchasing isn't live yet. We will
          turn the shop on when payments are ready for your market.
        </div>

        <nav
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/nex-native/chat/first-visit"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${NEX.borderStrong}`,
              background: NEX.panel,
              color: NEX.textPrimary,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Back to welcome
          </Link>
          <Link
            href="/nex-native/chat-themes-library"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${NEX.cyan}66`,
              background: `${NEX.cyan}1a`,
              color: NEX.cyan,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Open live Chat Themes →
          </Link>
          <Link
            href="/nex-native/chat"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "transparent",
              color: NEX.textMuted,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Continue to NEX Chat
          </Link>
        </nav>
      </section>
    </main>
  );
}
