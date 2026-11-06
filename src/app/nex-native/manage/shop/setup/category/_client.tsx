"use client";

// src/app/nex-native/manage/shop/setup/category/_client.tsx
//
// Shop Setup · Step 3 · Category client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Picks ONE business_category from the sealed NEX_BUSINESS_CATEGORIES
// list (23 options from migration 065). The 23 slugs are grouped into
// 6 semantic clusters (Food & Drink · Beauty & Wellness · Trade ·
// Services · Product · Creator) so the picker reads as a two-tap
// browse (cluster → category) instead of a 23-item scroll list.
//
// Save → saveShopCategoryAction → routes to Step 4 (Hours).

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import { saveShopCategoryAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

interface CategoryOption {
  readonly slug: string;
  readonly label: string;
  readonly emoji: string;
}

interface CategoryCluster {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
  readonly lead: string;
  readonly options: ReadonlyArray<CategoryOption>;
}

// Owner-friendly cluster grouping over the 23 sealed slugs.
const CLUSTERS: ReadonlyArray<CategoryCluster> = [
  {
    id: "food",
    emoji: "🥗",
    label: "Food & Drink",
    lead: "Restaurants, cafés, bakeries · menu-first templates.",
    options: [
      { slug: "restaurant", label: "Restaurant", emoji: "🍽" },
      { slug: "cafe", label: "Café", emoji: "☕" },
      { slug: "bakery", label: "Bakery", emoji: "🥐" },
      { slug: "ice-cream", label: "Ice-cream", emoji: "🍦" },
      { slug: "dessert-shop", label: "Dessert shop", emoji: "🍰" },
      { slug: "drinks-shop", label: "Drinks shop", emoji: "🍹" },
      { slug: "juice-bar", label: "Juice bar", emoji: "🧃" },
    ],
  },
  {
    id: "beauty",
    emoji: "💆",
    label: "Beauty & Wellness",
    lead: "Salons, fitness, beauty services.",
    options: [
      { slug: "salon", label: "Salon", emoji: "💇" },
      { slug: "beauty", label: "Beauty", emoji: "💄" },
      { slug: "fitness", label: "Fitness", emoji: "🏋️" },
    ],
  },
  {
    id: "trade",
    emoji: "🧰",
    label: "Trade & Construction",
    lead: "Skilled trades, builders, specialists.",
    options: [
      { slug: "tradesperson", label: "Tradesperson", emoji: "🔧" },
      { slug: "construction", label: "Construction", emoji: "🏗" },
      { slug: "staircase-company", label: "Staircase maker", emoji: "🪜" },
    ],
  },
  {
    id: "services",
    emoji: "📎",
    label: "Services",
    lead: "Consultants, agencies, local services.",
    options: [
      { slug: "consultant", label: "Consultant", emoji: "🧭" },
      { slug: "agency", label: "Agency", emoji: "🧑‍💼" },
      { slug: "local-service", label: "Local service", emoji: "📍" },
      {
        slug: "professional-service",
        label: "Professional service",
        emoji: "🧑‍⚖️",
      },
    ],
  },
  {
    id: "product",
    emoji: "📦",
    label: "Product & Brand",
    lead: "Makers, ecommerce, physical goods.",
    options: [
      { slug: "ecommerce", label: "Ecommerce", emoji: "🛒" },
      { slug: "product-brand", label: "Product brand", emoji: "🏷" },
    ],
  },
  {
    id: "creator",
    emoji: "✨",
    label: "Creator & Community",
    lead: "Portfolios, events, communities.",
    options: [
      { slug: "portfolio", label: "Portfolio", emoji: "🎨" },
      { slug: "creator", label: "Creator", emoji: "🎥" },
      { slug: "community", label: "Community", emoji: "🧑‍🤝‍🧑" },
      { slug: "event", label: "Event", emoji: "🎪" },
    ],
  },
];

function findClusterFor(slug: string | null): string | null {
  if (!slug) return null;
  for (const c of CLUSTERS) {
    if (c.options.some((o) => o.slug === slug)) return c.id;
  }
  return null;
}

export function CategoryStepClient({
  initialCategory,
}: {
  initialCategory: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [picked, setPicked] = React.useState<string | null>(initialCategory);
  const [openCluster, setOpenCluster] = React.useState<string | null>(
    () => findClusterFor(initialCategory) ?? CLUSTERS[0]!.id,
  );
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked || status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("category", picked);
    const result = await saveShopCategoryAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  return (
    <WizardShell
      stepNumber={3}
      stepTitle="What do you sell?"
      stepLead="Pick one · drives which shop templates we surface AND the labels on your product grid."
      backHref="/nex-native/manage/shop/setup/location"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={SURFACE_CARD_STYLE}>
          <span style={LABEL_STYLE}>Category family</span>
          <span style={{ fontSize: 10.5, color: INK_MUTED }}>
            Tap a family to expand · tap a tile to pick · you can change
            this later in Shop settings.
          </span>
        </div>

        {CLUSTERS.map((cluster) => {
          const isOpen = openCluster === cluster.id;
          return (
            <section key={cluster.id}>
              <button
                type="button"
                onClick={() =>
                  setOpenCluster(isOpen ? null : cluster.id)
                }
                data-nex-category-cluster={cluster.id}
                aria-expanded={isOpen}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: "rgba(5, 15, 28, 0.9)",
                  border: `1px solid ${isOpen ? BORDER_HI : BORDER}`,
                  borderRadius: 12,
                  color: INK,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {cluster.emoji}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: CREAM,
                    }}
                  >
                    {cluster.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: INK_DIM,
                      marginTop: 1,
                    }}
                  >
                    {cluster.lead}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    color: GOLD,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    padding: "10px 2px 0",
                  }}
                >
                  {cluster.options.map((opt) => {
                    const isPicked = opt.slug === picked;
                    return (
                      <button
                        key={opt.slug}
                        type="button"
                        onClick={() => setPicked(opt.slug)}
                        data-nex-category-option={opt.slug}
                        aria-pressed={isPicked}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 10px",
                          background: isPicked
                            ? "rgba(198, 161, 91, 0.18)"
                            : "rgba(5, 15, 28, 0.9)",
                          border: `1.5px solid ${
                            isPicked ? GOLD : BORDER
                          }`,
                          borderRadius: 10,
                          color: INK,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                          boxShadow: isPicked
                            ? "0 0 0 3px rgba(198,161,91,0.14)"
                            : "none",
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 16 }}>
                          {opt.emoji}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12.5,
                            fontWeight: isPicked ? 900 : 700,
                            color: isPicked ? GOLD : INK,
                            letterSpacing: "0.01em",
                          }}
                        >
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#FF6B6B",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!picked || status.kind === "saving"}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: picked && status.kind !== "saving" ? 1 : 0.5,
            cursor:
              picked && status.kind !== "saving" ? "pointer" : "not-allowed",
            marginTop: 6,
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>
      </form>
    </WizardShell>
  );
}
