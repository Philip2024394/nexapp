// src/app/nex-native/manage/shop/setup/finish/page.tsx
//
// Shop Setup · Step 8 · Finish line + pick template.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Final step · celebrates the completed onboarding and hands off to
// the template picker which is already a rich surface (11 templates ·
// backgrounds library · activate shop CTA). Rather than reinventing a
// mini picker here we send the owner into the real tool with a clear
// "you're almost live" framing.

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

export default async function ShopSetupFinishPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/finish");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/identity");
  }

  // Build a small checklist of what the owner has (and hasn't) set so
  // the finish surface doubles as a progress summary. Shows ✓ for set
  // fields and · for empty · nothing is required to go live, but the
  // list makes the trade-off visible.
  const summary: ReadonlyArray<{
    label: string;
    done: boolean;
  }> = [
    { label: "Shop name", done: Boolean(existing.display_name) },
    { label: "Logo", done: Boolean(existing.logo_url) },
    { label: "City", done: Boolean(existing.city) },
    { label: "Address", done: Boolean(existing.address) },
    { label: "Category", done: Boolean(existing.business_category) },
    { label: "Opening hours", done: Boolean(existing.hours_display) },
    { label: "Your story", done: Boolean(existing.description) },
    { label: "Shipping scope", done: Boolean(existing.shipping_scope) },
    {
      label: "At least one social / phone",
      done: Boolean(
        existing.instagram_handle ||
          existing.facebook_handle ||
          existing.tiktok_handle ||
          existing.public_phone ||
          existing.website_url,
      ),
    },
  ];
  const doneCount = summary.filter((s) => s.done).length;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-finish
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
          gap: 16,
        }}
      >
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href="/nex-native/manage/shop/setup/contact"
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
            ← Contact
          </Link>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: INK_MUTED,
            }}
          >
            Step 8 of 8
          </span>
        </nav>

        {/* Progress bar at 100% · the finish surface always shows the
            fully-filled bar even if the owner skipped optional steps. */}
        <div
          aria-hidden
          style={{
            width: "100%",
            height: 6,
            background: "rgba(198, 161, 91, 0.12)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: GOLD,
            }}
          />
        </div>

        {/* Hero · celebration · emerald-gold gradient card. */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "24px 20px 26px",
            background: `linear-gradient(135deg, ${EMERALD} 0%, ${FOREST} 60%, rgba(2,9,20,0.95) 100%)`,
            border: `1px solid ${BORDER_HI}`,
            borderRadius: 18,
            textAlign: "center",
            boxShadow: "0 18px 46px rgba(0,0,0,0.55)",
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 36,
              lineHeight: 1,
            }}
          >
            🎉
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Nice work.
            <br />
            <span style={{ color: GOLD }}>Your shop</span> is almost live.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: INK_DIM,
              lineHeight: 1.5,
              maxWidth: 320,
              marginInline: "auto",
            }}
          >
            Pick a shop template and a background · activate · your shop
            opens to the world.
          </p>
          <Link
            href="/nex-native/manage/shop/themes"
            data-nex-shop-finish-cta
            style={{
              display: "inline-flex",
              alignSelf: "center",
              alignItems: "center",
              gap: 8,
              padding: "14px 26px",
              marginTop: 6,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#1A120A",
              background: GOLD,
              textDecoration: "none",
              borderRadius: 999,
              boxShadow:
                "0 12px 26px rgba(198,161,91,0.25), 0 0 0 4px rgba(198,161,91,0.14)",
            }}
          >
            Pick template & activate →
          </Link>
          {/* Owner directive 2026-11-06 readiness fill · without
              products the public shop surface renders as an empty
              template · give the owner a visible path to add products
              right after they activate so the loop completes. */}
          <Link
            href="/nex-native/manage/products"
            data-nex-shop-finish-products
            style={{
              display: "inline-flex",
              alignSelf: "center",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: GOLD,
              background: "transparent",
              border: `1px solid ${GOLD}`,
              textDecoration: "none",
              borderRadius: 999,
            }}
          >
            + Add your first product
          </Link>
          <span
            style={{
              fontSize: 10,
              color: INK_MUTED,
              letterSpacing: "0.04em",
            }}
          >
            {doneCount} of {summary.length} fields complete
          </span>
        </section>

        {/* Setup summary · checklist so owners see at a glance what's
            still blank. Everything optional · no gating. */}
        <section
          aria-label="Setup summary"
          style={{
            padding: "14px 14px 16px",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: GOLD,
              marginBottom: 4,
            }}
          >
            What you&rsquo;ve set
          </span>
          {summary.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: row.done ? CREAM : INK_MUTED,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: row.done
                    ? GOLD
                    : "rgba(198, 161, 91, 0.14)",
                  color: row.done ? "#1A120A" : INK_MUTED,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {row.done ? "✓" : "·"}
              </span>
              <span style={{ flex: 1, fontWeight: row.done ? 800 : 600 }}>
                {row.label}
              </span>
            </div>
          ))}
        </section>

        {/* Footer · secondary nav back into the wizard so owners can
            fill a skipped step before activating. */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Link
            href="/nex-native/manage/shop/setup"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: INK_DIM,
              textDecoration: "underline",
              letterSpacing: "0.04em",
            }}
          >
            Go back and fill a skipped step
          </Link>
          <span style={{ fontSize: 10, color: INK_MUTED }}>
            All fields are editable from Shop settings later.
          </span>
        </section>
      </main>
    </>
  );
}
