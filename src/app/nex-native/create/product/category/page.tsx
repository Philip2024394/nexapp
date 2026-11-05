// src/app/nex-native/create/product/category/page.tsx
//
// Shared category picker · Phase 1 Product System.
//
// Reads the sealed 30-dept taxonomy from
// src/lib/nex-native/catalogue/departments.ts and uses the sealed
// isCategorySpecRegistered() to decide which sub-categories are
// selectable right now. Fashion & Clothing is Phase 1 pilot per §K.1.
// Other departments graduate as their batch per §I.5 ships a Zod spec.
//
// Non-registered departments render a disabled tile with a sealed
// "Coming soon" message. The sealed Watches entry at
// /manage/watches/new continues to work until Phase 4 reconciliation.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { DEPARTMENTS } from "@/lib/nex-native/catalogue/departments";
import { isCategorySpecRegistered } from "@/lib/nex-native/catalogue/specs";

export const dynamic = "force-dynamic";

// Owner directive 2026-11-05 iter 29 · Ship A commit 4 · category
// picker goes NEX Ireland palette. Sealed world CSS vars (set by
// _world-stylesheet.tsx) with safe fallbacks for the Ireland hex
// values so local dev without env-set world identity still renders
// correctly.
const INK = "var(--nex-world-primary-ink, #F2F5F8)";
const INK_DIM = "var(--nex-world-muted-ink, #AFC5B5)";
const ACCENT = "var(--nex-world-secondary, #C6A15B)";
const DISABLED_INK = "rgba(175, 197, 181, 0.55)";
const PAGE_BG = "var(--nex-world-drawer-bg, #123D2B)";
const TILE_BG = "rgba(2, 20, 12, 0.55)";
const TILE_BG_DISABLED = "rgba(2, 20, 12, 0.28)";

// Owner directive 2026-11-05 iter 29 · Ship B2 follow-up · emoji
// glyph per department. Lives in the UI layer (not the sealed
// departments.ts taxonomy) · purely cosmetic · no DB/API impact.
// Universal + culturally safe emoji that read instantly across
// locales. Easy to swap for custom SVGs later without touching the
// taxonomy source.
const DEPARTMENT_ICONS: Record<string, string> = {
  electronics_technology: "📱",
  home_furniture_living: "🛋️",
  kitchen_dining: "🍽️",
  fashion_clothing: "👗",
  jewellery_watches: "💎",
  beauty_personal_care: "💄",
  health_wellness_medical: "🩺",
  baby_nursery_parenting: "👶",
  toys_games_hobbies: "🎲",
  sports_fitness_outdoors: "⚽",
  garden_outdoor_agriculture: "🌱",
  tools_diy_construction: "🔧",
  automotive_motorcycles_transport: "🚗",
  food_grocery_beverages: "🛒",
  pet_supplies_animals: "🐾",
  books_education_stationery: "📚",
  office_business_industrial: "🏢",
  arts_crafts_handmade: "🎨",
  music_film_entertainment: "🎬",
  travel_luggage_outdoor: "🧳",
  digital_products_software: "💻",
  accommodation_property: "🏠",
  food_delivery_restaurants: "🍔",
  services_marketplace: "🤝",
  experiences_activities_tickets: "🎟️",
  second_hand_refurbished: "♻️",
  luxury_premium_collectibles: "✨",
  gifts_celebrations_seasonal: "🎁",
  renewable_energy_utilities: "☀️",
  everything_else: "📦",
};

export default async function CreateProductCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    business?: string;
    dept?: string;
    freshly_provisioned?: string;
  }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent("/nex-native/create/product"));
  }

  const { business, dept, freshly_provisioned } = await searchParams;
  // Owner directive 2026-11-05 iter 29 · Ship A commit 3 · banner
  // shows only on the first visit (when auto-provision just happened)
  // · subsequent navigation drops the param · the banner self-hides.
  const showFreshlyProvisionedBanner = freshly_provisioned === "1" && !dept;
  if (!business) {
    redirect("/nex-native/create/product");
  }

  let owned: Array<{ id: string }>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    owned = raw.map((b) => ({ id: b.id }));
  } catch {
    owned = [];
  }
  if (!owned.some((b) => b.id === business)) {
    redirect("/nex-native/create/product");
  }

  // Second-level view · a department was chosen · show its sub-categories
  if (dept) {
    const department = DEPARTMENTS.find((d) => d.id === dept);
    if (!department) {
      redirect(`/nex-native/create/product/category?business=${encodeURIComponent(business!)}`);
    }
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <Link
            href={`/nex-native/create/product/category?business=${encodeURIComponent(business!)}`}
            style={backLink}
          >
            ← Change department
          </Link>
          <h1 style={h1Style}>
            <span aria-hidden style={{ marginRight: 10 }}>
              {DEPARTMENT_ICONS[department!.id] ?? "📦"}
            </span>
            {department!.label}
          </h1>
          <p style={subStyle}>{department!.blurb}</p>
          <div style={gridStyle}>
            {department!.categories.map((c) => {
              const enabled = isCategorySpecRegistered(department!.id, c.id);
              return enabled ? (
                <Link
                  key={c.id}
                  href={`/nex-native/create/product/form?business=${encodeURIComponent(business!)}&dept=${encodeURIComponent(department!.id)}&cat=${encodeURIComponent(c.id)}`}
                  style={tileEnabledStyle}
                >
                  <span style={tileLabelStyle}>{c.label}</span>
                  <span style={{ color: ACCENT }}>→</span>
                </Link>
              ) : (
                <div
                  key={c.id}
                  aria-disabled
                  style={tileDisabledStyle}
                  title="Coming in a future batch"
                >
                  <span style={{ ...tileLabelStyle, color: DISABLED_INK }}>{c.label}</span>
                  <span style={{ color: DISABLED_INK, fontSize: 11, fontWeight: 700 }}>Soon</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Top-level view · pick a department
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {showFreshlyProvisionedBanner ? (
          <FreshlyProvisionedBanner />
        ) : null}
        <Link href="/nex-native/create/product" style={backLink}>
          ← Change shop
        </Link>
        <h1 style={h1Style}>Pick a department</h1>
        <p style={subStyle}>
          Choose the right home for your product. Fields and specifications adapt to each
          category.
        </p>
        <div style={gridStyle}>
          {DEPARTMENTS.map((d) => {
            const anyCategoryEnabled = d.categories.some((c) =>
              isCategorySpecRegistered(d.id, c.id),
            );
            const icon = DEPARTMENT_ICONS[d.id] ?? "📦";
            return anyCategoryEnabled ? (
              <Link
                key={d.id}
                href={`/nex-native/create/product/category?business=${encodeURIComponent(business!)}&dept=${encodeURIComponent(d.id)}`}
                style={tileEnabledStyle}
              >
                <div style={tileHeaderRow}>
                  <span style={tileIconStyle} aria-hidden>{icon}</span>
                  <span style={tileLabelStyle}>{d.label}</span>
                </div>
                <span style={{ fontSize: 11, color: INK_DIM, fontWeight: 600 }}>{d.blurb}</span>
                <span style={{ color: ACCENT, alignSelf: "flex-end" }}>→</span>
              </Link>
            ) : (
              <div
                key={d.id}
                aria-disabled
                style={tileDisabledStyle}
                title="Coming in a future batch"
              >
                <div style={tileHeaderRow}>
                  <span style={{ ...tileIconStyle, opacity: 0.45 }} aria-hidden>{icon}</span>
                  <span style={{ ...tileLabelStyle, color: DISABLED_INK }}>{d.label}</span>
                </div>
                <span style={{ fontSize: 11, color: DISABLED_INK, fontWeight: 600 }}>{d.blurb}</span>
                <span style={{ color: DISABLED_INK, fontSize: 11, fontWeight: 700, alignSelf: "flex-end" }}>
                  Soon
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: PAGE_BG,
  color: INK,
  fontFamily: "Inter, system-ui, sans-serif",
  padding: 24,
};

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
};

const backLink: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 12,
  color: ACCENT,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};

const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 };

const subStyle: React.CSSProperties = {
  fontSize: 13,
  color: INK_DIM,
  marginBottom: 20,
  lineHeight: 1.5,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 10,
};

const tileEnabledStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "16px 18px",
  background: TILE_BG,
  border: "1.5px solid color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 42%, transparent)",
  borderRadius: 14,
  color: INK,
  textDecoration: "none",
  minHeight: 72,
  boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
};

const tileDisabledStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "16px 18px",
  background: TILE_BG_DISABLED,
  border: "1.5px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  color: DISABLED_INK,
  minHeight: 72,
};

const tileLabelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

// Owner directive 2026-11-05 iter 29 · Ship B2 follow-up · icon +
// label on one row at the top of each department tile.
const tileHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 2,
};
const tileIconStyle: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1,
  flexShrink: 0,
  // Emoji glyphs vary wildly by platform · give them a fixed 32px
  // box so tile labels line up regardless of glyph width.
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
};

// ─── Freshly-provisioned welcome banner · iter 29 Ship A commit 3 ────
//
// Rendered once when a first-time seller lands here straight after
// auto-provisioning their shop (iter 29 commit 1). Sets the value
// anchor BEFORE they hit the free-tier cap · lower abandonment later.
// Honours sealed "NEX never takes commission" doctrine · benefits list
// omits every claim that isn't production-ready today (see sealed
// Package Contract DRAFT 2026-10-20).
function FreshlyProvisionedBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      data-nex-freshly-provisioned-banner
      style={{
        background:
          "linear-gradient(135deg, #0A1F14 0%, #123D2B 60%, #0A1F14 100%)",
        border: "1px solid color-mix(in srgb, #C6A15B 55%, transparent)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        color: "#F2F5F8",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.35), inset 0 0 0 1px color-mix(in srgb, #C6A15B 22%, transparent)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#C6A15B",
          marginBottom: 6,
        }}
      >
        Shop ready · welcome
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.3,
          marginBottom: 6,
        }}
      >
        Your NEX shop is live
      </div>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: "#B5C3D6",
          margin: "0 0 10px 0",
        }}
      >
        List your first product below · 10 free · no commission · ever.
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {[
          "Shareable shop URL to post on socials",
          "Chat shop drawer for sharing to your customers",
          "Rename your shop any time in Settings",
        ].map((line) => (
          <li
            key={line}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12.5,
              color: "#F2F5F8",
            }}
          >
            <span
              aria-hidden
              style={{ color: "#C6A15B", fontWeight: 800 }}
            >
              ✓
            </span>
            <span style={{ lineHeight: 1.4 }}>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
