// src/app/nex-native/discover/page.tsx
//
// Public business discovery · Phase 2 of first-time experience.
// -------------------------------------------------------------
// Grid of real published businesses · guest-accessible by design.
// Each tile links to the sealed `/<businessSlug>` public page (also
// guest-accessible). Account-wall actions (save · message · order)
// live on the business page itself, not on this landing.
//
// Load-bearing rules:
//   · Session viewers see the same discovery grid · personalisation
//     (e.g. "near you") can land in a later phase without changing
//     the public contract.
//   · Honest empty state if no businesses exist · no fabricated rows.
//   · Query + category filter are server-rendered via searchParams
//     so guests get shareable URLs.

import Link from "next/link";
import {
  listPublicBusinesses,
  listPublicBusinessCategories,
  type DiscoverBusinessRow,
} from "./_loader";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind === "guest";
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category?.trim() ?? "";

  const [businesses, categories] = await Promise.all([
    listPublicBusinesses({ q, category, limit: 60 }),
    listPublicBusinessCategories(),
  ]);

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.07), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="discover" />

          <header style={{ margin: "24px 0 20px" }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.22em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Discover
            </div>
            <h1
              style={{
                margin: "8px 0 6px",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.015em",
              }}
            >
              Local businesses on NEX
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: NEX.textSecondary,
                lineHeight: 1.55,
              }}
            >
              Browse published shops and services. Tap any to open their
              page.
              {isGuest && " You'll need a free account only when you want to message, save, or order."}
            </p>
          </header>

          <form
            method="get"
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 14,
              alignItems: "stretch",
            }}
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search businesses…"
              style={{
                flex: 1,
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.borderSoft}`,
                color: NEX.textPrimary,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />
            {category && <input type="hidden" name="category" value={category} />}
            <button
              type="submit"
              style={{
                padding: "0 18px",
                borderRadius: 12,
                background: NEX.cyan,
                color: "#021022",
                fontSize: 13,
                fontWeight: 700,
                border: `1px solid ${NEX.cyan}`,
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </form>

          {categories.length > 0 && (
            <nav
              aria-label="Business categories"
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/nex-native/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                style={pillStyle(!category)}
              >
                All
              </Link>
              {categories.map((c) => {
                const active = category === c;
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                params.set("category", c);
                return (
                  <Link
                    key={c}
                    href={`/nex-native/discover?${params.toString()}`}
                    style={pillStyle(active)}
                  >
                    {c}
                  </Link>
                );
              })}
            </nav>
          )}

          {businesses.length === 0 ? (
            <EmptyState hasFilter={Boolean(q || category)} />
          ) : (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {businesses.map((b) => (
                <BusinessTile key={b.id} business={b} />
              ))}
            </section>
          )}

          {isGuest && businesses.length > 0 && (
            <footer
              style={{
                marginTop: 28,
                padding: "16px 18px",
                borderRadius: 14,
                background: NEX.panel,
                border: `1px solid ${NEX.borderSoft}`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.22em",
                  color: NEX.cyan,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Want to message a business?
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: NEX.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                Create your free NEX account in 15 seconds — no card
                needed.
              </div>
              <Link
                href="/nex-native/create-account"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: NEX.orange,
                  color: "#0a0608",
                  fontSize: 13.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  border: `1px solid ${NEX.orange}`,
                }}
              >
                Create free account →
              </Link>
            </footer>
          )}
        </div>
      </main>
    </>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 14px",
    borderRadius: 999,
    background: active ? NEX.cyanFaint : NEX.panel,
    color: active ? NEX.cyan : NEX.textSecondary,
    border: `1px solid ${active ? NEX.cyan + "55" : NEX.borderSoft}`,
    fontSize: 12.5,
    fontWeight: active ? 700 : 600,
    textDecoration: "none",
  };
}

function BusinessTile({ business }: { business: DiscoverBusinessRow }) {
  const initial = business.display_name.charAt(0).toUpperCase();
  return (
    <Link
      href={`/nex-native/${encodeURIComponent(business.slug)}?commerce=1`}
      data-nex-discover-tile={business.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 14,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.borderSoft}`,
        textDecoration: "none",
        color: NEX.textPrimary,
        minHeight: 150,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {business.logo_url ? (
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              overflow: "hidden",
              background: `url("${encodeURI(business.logo_url)}") center/cover`,
              border: `1px solid ${NEX.borderSoft}`,
              flex: "none",
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: NEX.cyanFaint,
              display: "grid",
              placeItems: "center",
              color: NEX.cyan,
              fontSize: 18,
              fontWeight: 700,
              border: `1px solid ${NEX.cyan}33`,
              flex: "none",
            }}
          >
            {initial}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {business.display_name}
          </div>
          {business.business_category && (
            <div
              style={{
                fontSize: 11,
                color: NEX.textMuted,
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {business.business_category}
            </div>
          )}
        </div>
      </div>
      {business.description && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: NEX.textSecondary,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {business.description}
        </p>
      )}
      {business.address && (
        <div
          style={{
            fontSize: 11.5,
            color: NEX.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden>📍</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {business.address}
          </span>
        </div>
      )}
    </Link>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
        {hasFilter ? "No matches" : "No businesses yet"}
      </h2>
      <p
        style={{
          margin: "8px auto 0",
          maxWidth: 400,
          fontSize: 13,
          color: NEX.textSecondary,
          lineHeight: 1.55,
        }}
      >
        {hasFilter
          ? "Try a different search or clear the category filter."
          : "Businesses on NEX will appear here as they publish their public pages."}
      </p>
      {hasFilter && (
        <Link
          href="/nex-native/discover"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 999,
            background: "transparent",
            color: NEX.cyan,
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            border: `1px solid ${NEX.cyanSoft}`,
          }}
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
