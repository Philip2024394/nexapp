// src/app/nex-native/manage/shop/setup/page.tsx
//
// NEX Shop · Setup wizard shell.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Placeholder shell for the 8-step shop onboarding wizard. This file
// is scoped to just render a holding page + routing contract: future
// batches will add actual step components (identity · location ·
// category · hours · story · policies · contact · template pick) and
// autosave through the existing business-service writers.
//
// For now, signed-out users get bounced to sign-in · signed-in users
// who already have a business land on /manage/shop/themes · brand-new
// owners see a "Setup opens next" holding card with a pointer into
// the templates picker so they can keep exploring.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";

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

export default async function ShopSetupPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  if (businesses[0]) {
    redirect("/nex-native/manage/shop/themes");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup
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
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href="/nex-native/manage/shop/start"
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
            ← Get Started
          </Link>
        </nav>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "22px 20px 24px",
            background: `linear-gradient(135deg, ${EMERALD} 0%, ${FOREST} 60%, rgba(2,9,20,0.95) 100%)`,
            border: `1px solid ${BORDER_HI}`,
            borderRadius: 18,
            textAlign: "center",
            boxShadow: "0 14px 36px rgba(0,0,0,0.55)",
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
            Shop Setup · Step 1 of 8
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Setup wizard opens next
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: INK_DIM,
              maxWidth: 320,
              marginInline: "auto",
            }}
          >
            The guided 8-step flow (identity · location · category ·
            hours · story · policies · contact · template) ships in
            the next build. For now, jump into the template picker
            and come back — all your saves are already wired.
          </p>
        </section>

        <section
          aria-label="Planned wizard steps"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "14px 14px 16px",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: GOLD,
              marginBottom: 2,
            }}
          >
            Coming in order
          </span>
          {PLANNED_STEPS.map((s, idx) => (
            <div
              key={s.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: idx === 0 ? CREAM : INK_DIM,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background:
                    idx === 0 ? GOLD : "rgba(198, 161, 91, 0.18)",
                  color: idx === 0 ? "#1A120A" : GOLD,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <span
                style={{
                  fontWeight: idx === 0 ? 800 : 600,
                  letterSpacing: "0.02em",
                }}
              >
                {s.title}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: idx === 0 ? GOLD : INK_MUTED,
                  letterSpacing: "0.04em",
                }}
              >
                {idx === 0 ? "NEXT" : s.status}
              </span>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            paddingTop: 10,
          }}
        >
          <Link
            href="/nex-native/manage/shop/themes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#1A120A",
              background: GOLD,
              textDecoration: "none",
              borderRadius: 999,
              boxShadow: "0 10px 24px rgba(198,161,91,0.22)",
            }}
          >
            Jump to template picker →
          </Link>
          <span style={{ fontSize: 10.5, color: INK_MUTED }}>
            Nothing lost · the wizard will pre-fill from what you set here.
          </span>
        </section>
      </main>
    </>
  );
}

const PLANNED_STEPS: ReadonlyArray<{ title: string; status: string }> = [
  { title: "Shop identity · name + logo", status: "PLANNED" },
  { title: "Location · address + city", status: "PLANNED" },
  { title: "Category · what you sell", status: "PLANNED" },
  { title: "Opening hours", status: "PLANNED" },
  { title: "Your story", status: "PLANNED" },
  { title: "Policies · returns + shipping", status: "PLANNED" },
  { title: "Contact · socials + phone", status: "PLANNED" },
  { title: "Pick template · go live", status: "PLANNED" },
];
