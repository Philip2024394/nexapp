// src/app/nex-native/chat-themes-library/_entry-client.tsx
//
// NEX Chat Themes Library · entry surface.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Entry hero + horizontal carousel + Join Library + View Library CTAs.
// Pattern: App Store / Spotify intake · hero sells the "feel", carousel
// lets the user flick between highlighted themes, "View Library" opens
// the full paginated grid at /chat-themes-library/all.

"use client";

import * as React from "react";
import Link from "next/link";
import {
  LIBRARY_THEMES,
  LIBRARY_SUBSCRIPTION,
  LIBRARY_PLANS,
  type LibraryTheme,
  type LibraryPlanId,
  type LibraryPlan,
} from "./_catalog";
import { HeroPreview } from "./_hero-preview";
import { PaymentPlaceholderSheet } from "./_payment-sheet";

const NEX_ACCENT = "var(--nex-world-secondary, #C6A15B)";
const NEX_INK = "#F2F5F8";
const NEX_INK_DIM = "#B5C3D6";
const NEX_INK_MUTE = "#7D9BC0";

type Sheet =
  | {
      readonly kind: "subscription";
      readonly plan: LibraryPlan;
    }
  | { readonly kind: "theme"; readonly theme: LibraryTheme }
  | null;

export function EntryClient(): React.JSX.Element {
  const [activeId, setActiveId] = React.useState<string>(LIBRARY_THEMES[0].id);
  const [planId, setPlanId] = React.useState<LibraryPlanId>("yearly");
  const [sheet, setSheet] = React.useState<Sheet>(null);

  const activePlan =
    LIBRARY_PLANS.find((p) => p.id === planId) ?? LIBRARY_PLANS[0];

  const activeTheme =
    LIBRARY_THEMES.find((t) => t.id === activeId) ?? LIBRARY_THEMES[0];

  return (
    <>
      {/* Top bar · back + "View Library" entry */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <Link
          href="/nex-native/free-chat?show-themes=1&preview=1"
          aria-label="Back to free chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(6, 15, 28, 0.72)",
            border: `1px solid ${NEX_ACCENT}`,
            color: NEX_INK,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </Link>
        <Link
          href="/nex-native/chat-themes-library/all"
          aria-label="View full library"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${NEX_ACCENT}`,
            color: NEX_INK,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          <span>View Library</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/* Scrollable body · hero + headline + subscription card + carousel */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 2px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <HeroPreview theme={activeTheme} />

        {/* Horizontal carousel · directly under the phone screen so
            the user can flick between themes · snap-scroll · tap
            updates the hero. Owner directive 2026-11-03. */}
        <section
          data-nex-library-carousel
          aria-label="Theme carousel"
          style={{
            margin: "16px -20px 0",
            padding: "6px 20px 10px",
            display: "flex",
            gap: 12,
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {LIBRARY_THEMES.map((t) => {
            const isActive = t.id === activeTheme.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                aria-label={`Preview ${t.label}`}
                aria-pressed={isActive}
                data-nex-library-carousel-tile={t.id}
                data-nex-library-carousel-active={isActive ? "true" : "false"}
                style={{
                  flexShrink: 0,
                  width: 108,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  scrollSnapAlign: "start",
                  WebkitTapHighlightColor: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {/* Owner directive 2026-11-03 · <img object-fit:cover>
                    inside an overflow-hidden rounded container paints
                    to the exact clip radius · no sub-pixel bleed from
                    a border/background-image seam. Active ring uses
                    inset box-shadow so it stays INSIDE the clip and
                    the image is never shifted by a 2px border. */}
                <span
                  style={{
                    position: "relative",
                    display: "block",
                    width: "100%",
                    aspectRatio: "9 / 18",
                    borderRadius: 14,
                    overflow: "hidden",
                    backgroundColor: "#000",
                    boxShadow: isActive
                      ? `inset 0 0 0 2px ${NEX_ACCENT}, 0 0 14px color-mix(in srgb, ${NEX_ACCENT} 55%, transparent)`
                      : "inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 10px rgba(0, 0, 0, 0.4)",
                    transition: "box-shadow 180ms ease",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.wallpaperUrl}
                    alt=""
                    aria-hidden
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isActive ? NEX_INK : NEX_INK_DIM,
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </section>

        {/* Headline + Buy · directly under the carousel so the user
            sees "this theme → price → Buy" as a single beat after
            flicking through the thumbnails. Owner directive 2026-11-03. */}
        <header style={{ textAlign: "center", margin: "6px 0 0" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: NEX_INK_MUTE,
            }}
          >
            NEX Chat Themes
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 22,
              fontWeight: 700,
              color: NEX_INK,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            {activeTheme.label}
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: NEX_INK_DIM,
            }}
          >
            Buy once · €{activeTheme.oneTimePriceEUR.toFixed(2)}
          </p>
          <button
            type="button"
            onClick={() => setSheet({ kind: "theme", theme: activeTheme })}
            style={{
              marginTop: 10,
              minHeight: 42,
              padding: "0 22px",
              borderRadius: 999,
              background: NEX_ACCENT,
              color: "#0a1a0a",
              border: `1px solid ${NEX_ACCENT}`,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Buy · €{activeTheme.oneTimePriceEUR.toFixed(2)}
          </button>
        </header>

        <SubscriptionCard
          planId={planId}
          onPlanChange={setPlanId}
          onJoin={() =>
            setSheet({ kind: "subscription", plan: activePlan })
          }
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
            paddingBottom: 8,
          }}
        >
          <Link
            href="/nex-native/chat-themes-library/all"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
              padding: "0 24px",
              borderRadius: 999,
              background: "transparent",
              color: NEX_INK,
              border: `1px solid ${NEX_ACCENT}`,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View full library →
          </Link>
        </div>

        <p
          style={{
            margin: "22px 0 0",
            textAlign: "center",
            fontSize: 11,
            color: NEX_INK_MUTE,
            paddingBottom: 4,
          }}
        >
          Prices in euro · payment integration in progress.
        </p>
      </div>

      {sheet ? (
        <PaymentPlaceholderSheet
          onClose={() => setSheet(null)}
          title={
            sheet.kind === "subscription"
              ? `Join · ${sheet.plan.label}`
              : `Buy ${sheet.theme.label}`
          }
          description={
            sheet.kind === "subscription"
              ? `€${sheet.plan.priceEUR.toFixed(2)} / ${sheet.plan.period} · ${
                  sheet.plan.billingNote ?? LIBRARY_SUBSCRIPTION.pitch
                }`
              : `One-time purchase · €${sheet.theme.oneTimePriceEUR.toFixed(2)}`
          }
        />
      ) : null}
    </>
  );
}

// ─── Subscription card · plan toggle + custom-upload (yearly) ─────────

function SubscriptionCard({
  planId,
  onPlanChange,
  onJoin,
}: {
  readonly planId: LibraryPlanId;
  readonly onPlanChange: (next: LibraryPlanId) => void;
  readonly onJoin: () => void;
}): React.JSX.Element {
  const activePlan =
    LIBRARY_PLANS.find((p) => p.id === planId) ?? LIBRARY_PLANS[0];
  const pitch = LIBRARY_SUBSCRIPTION.pitch;
  return (
    <section
      data-nex-library-subscription
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        marginTop: 18,
        borderRadius: 16,
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 20%, transparent), color-mix(in srgb, var(--nex-world-primary, #1B5138) 30%, transparent))",
        border: `1px solid ${NEX_ACCENT}`,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: NEX_INK_MUTE,
        }}
      >
        {activePlan.savingsBadge ?? "Theme library"}
      </p>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NEX_INK }}>
        {LIBRARY_SUBSCRIPTION.label}
      </h2>

      {/* Plan toggle · segmented control · monthly vs yearly */}
      <div
        role="radiogroup"
        aria-label="Choose billing plan"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          padding: 4,
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.55)",
          border: `1px solid rgba(255, 255, 255, 0.08)`,
        }}
      >
        {LIBRARY_PLANS.map((p) => {
          const isActive = p.id === planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onPlanChange(p.id)}
              data-nex-library-plan-toggle={p.id}
              data-nex-library-plan-active={isActive ? "true" : "false"}
              style={{
                minHeight: 36,
                padding: "0 14px",
                borderRadius: 999,
                background: isActive ? NEX_ACCENT : "transparent",
                color: isActive ? "#0a1a0a" : NEX_INK,
                border: "none",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                transition: "background 160ms ease, color 160ms ease",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: NEX_INK_DIM, lineHeight: 1.5 }}>
        {pitch}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: NEX_INK,
            lineHeight: 1,
          }}
        >
          €{activePlan.priceEUR.toFixed(2)}
        </span>
        <span style={{ fontSize: 13, color: NEX_INK_MUTE }}>
          / {activePlan.period}
        </span>
        {activePlan.billingNote ? (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: NEX_INK_MUTE,
              textAlign: "right",
            }}
          >
            {activePlan.billingNote}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onJoin}
        style={{
          marginTop: 2,
          minHeight: 44,
          padding: "0 20px",
          borderRadius: 999,
          background: NEX_ACCENT,
          color: "#0a1a0a",
          border: `1px solid ${NEX_ACCENT}`,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Join · {activePlan.label}
      </button>
    </section>
  );
}
