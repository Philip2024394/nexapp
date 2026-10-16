// src/app/nex-native/dev/hotel-flow/results/page.tsx
// Screen 2 · Search / Results.

"use client";

import type * as React from "react";
import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell, TopBarBack } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { PropertyCard } from "../_components/_property-card";
import { NEX } from "../_components/_palette";
import { ALL_PROPERTIES } from "../_components/_fixtures";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "hotels", label: "Hotels", propertyType: "Hotel" },
  { id: "villas", label: "Villas", propertyType: "Villa" },
  { id: "apartments", label: "Apartments", propertyType: "Apartment" },
  { id: "guesthouses", label: "Guesthouses", propertyType: "Guesthouse" },
] as const;

export default function ResultsPage(): React.ReactElement {
  return (
    <Suspense fallback={<PageShell><div style={{ padding: 20 }}>Loading…</div></PageShell>}>
      <ResultsInner />
    </Suspense>
  );
}

function ResultsInner(): React.ReactElement {
  const sp = useSearchParams();
  const initialQ = sp.get("q") ?? "";
  const initialType = sp.get("type") ?? "all";
  const [query, setQuery] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const results = useMemo(() => {
    return ALL_PROPERTIES.filter((p) => {
      if (verifiedOnly && !p.ownerVerified) return false;
      if (typeFilter !== "all") {
        const found = TYPE_FILTERS.find((t) => t.id === typeFilter);
        const want = found && "propertyType" in found ? found.propertyType : null;
        if (want && p.propertyType !== want) return false;
      }
      if (query.trim().length > 0) {
        const q = query.trim().toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.city.toLowerCase().includes(q) &&
          !p.region.toLowerCase().includes(q) &&
          !p.country.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [query, typeFilter, verifiedOnly]);

  return (
    <PageShell>
      <TopBarBack title="Search" onBackHref="/nex-native/dev/hotel-flow/discover" />

      {/* Search bar */}
      <section style={{ padding: "12px 16px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: NEX.surface,
            border: `1px solid ${NEX.divider}`,
            borderRadius: 12,
          }}
        >
          <Icon name="search" size={18} stroke={NEX.textMid} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where to go?"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              color: NEX.text,
              outline: "none",
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                background: "transparent",
                border: "none",
                color: NEX.textMuted,
                cursor: "pointer",
                display: "inline-flex",
              }}
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </section>

      {/* Filter chips */}
      <section style={{ padding: "4px 16px 10px" }}>
        <div
          className="nex-no-scrollbar"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {TYPE_FILTERS.map((t) => {
            const active = typeFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                style={{
                  flex: "0 0 auto",
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? NEX.accent : NEX.divider}`,
                  background: active ? NEX.accent : NEX.surface,
                  color: active ? "#FFFFFF" : NEX.textMid,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            style={{
              flex: "0 0 auto",
              padding: "7px 14px",
              borderRadius: 999,
              border: `1px solid ${verifiedOnly ? NEX.verified : NEX.divider}`,
              background: verifiedOnly ? NEX.verifiedSoft : NEX.surface,
              color: verifiedOnly ? NEX.verified : NEX.textMid,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="check" size={14} />
            Verified only
          </button>
        </div>
      </section>

      {/* Results count */}
      <div
        style={{
          padding: "6px 16px 10px",
          fontSize: 12,
          color: NEX.textMuted,
        }}
      >
        {results.length === 0
          ? "No properties match these filters"
          : `${results.length} ${results.length === 1 ? "property" : "properties"}`}
      </div>

      {/* Results list */}
      <section style={{ padding: "0 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {results.length === 0 ? (
          <EmptyResults />
        ) : (
          results.map((p) => <PropertyCard key={p.id} property={p} layout="horizontal" />)
        )}
      </section>

      <BottomNav active="home" />
    </PageShell>
  );
}

function EmptyResults(): React.ReactElement {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        background: NEX.surfaceAlt,
        border: `1px solid ${NEX.divider}`,
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text, marginBottom: 6 }}>
        No properties match
      </div>
      <div style={{ fontSize: 12, color: NEX.textMuted, lineHeight: 1.6 }}>
        Try a wider search area or clear the filters above.
      </div>
    </div>
  );
}
