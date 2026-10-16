// src/app/nex-native/dev/hotel-flow/discover/page.tsx
// Screen 1 · Discover / Home · entry point.
// Search bar · categories · popular stays · experiences preview.

"use client";

import type * as React from "react";
import Link from "next/link";
import { useState } from "react";
import { PageShell, TopBarBrand } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { PropertyCard } from "../_components/_property-card";
import { NEX } from "../_components/_palette";
import { ALL_PROPERTIES, makeIllustrativeSvg } from "../_components/_fixtures";

const CATEGORIES = [
  { id: "hotels", label: "Hotels", icon: "bell", hue: 210 },
  { id: "villas", label: "Villas", icon: "home", hue: 170 },
  { id: "apartments", label: "Apartments", icon: "parking", hue: 32 },
  { id: "experiences", label: "Experiences", icon: "map", hue: 90 },
] as const;

const DESTINATIONS = [
  { id: "bali", label: "Bali", country: "Indonesia", hue: 170 },
  { id: "lombok", label: "Lombok", country: "Indonesia", hue: 210 },
  { id: "yogyakarta", label: "Yogyakarta", country: "Indonesia", hue: 32 },
  { id: "jakarta", label: "Jakarta", country: "Indonesia", hue: 290 },
] as const;

export default function DiscoverPage(): React.ReactElement {
  const [query, setQuery] = useState("");
  return (
    <PageShell>
      <TopBarBrand />

      {/* Hero banner · "Better stays. Real places. Local experiences." */}
      <section
        style={{
          padding: "16px 18px 10px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: NEX.text,
            lineHeight: 1.2,
            letterSpacing: "-0.015em",
          }}
        >
          Better stays. Real places.
          <br />
          <span style={{ color: NEX.accent }}>Local experiences.</span>
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 14,
            color: NEX.textMid,
            lineHeight: 1.5,
          }}
        >
          Verified hotels, villas and homes · and the local businesses
          that make the trip worth it.
        </p>
      </section>

      {/* Search bar */}
      <section style={{ padding: "6px 18px 14px" }}>
        <Link
          href={`/nex-native/dev/hotel-flow/results${query ? `?q=${encodeURIComponent(query)}` : ""}`}
          style={{ textDecoration: "none" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: NEX.surface,
              border: `1px solid ${NEX.divider}`,
              borderRadius: 14,
              boxShadow: NEX.shadow,
            }}
          >
            <Icon name="search" size={20} stroke={NEX.textMid} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Where to go?"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: 15,
                color: NEX.text,
                outline: "none",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: NEX.accent,
                fontWeight: 700,
              }}
            >
              Search
            </span>
          </div>
        </Link>
      </section>

      {/* Category tiles */}
      <section style={{ padding: "0 18px 20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/nex-native/dev/hotel-flow/results?type=${c.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "12px 4px",
                background: NEX.surface,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 12,
                textDecoration: "none",
                color: NEX.text,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: NEX.accentMuted,
                  color: NEX.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={c.icon} size={20} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular destinations · horizontal scroll */}
      <section style={{ padding: "4px 0 18px" }}>
        <div style={{ padding: "0 18px 10px" }}>
          <SectionTitle>Popular destinations</SectionTitle>
        </div>
        <div
          className="nex-no-scrollbar"
          style={{
            display: "flex",
            gap: 10,
            padding: "0 18px 4px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
          }}
        >
          {DESTINATIONS.map((d) => (
            <Link
              key={d.id}
              href={`/nex-native/dev/hotel-flow/results?q=${encodeURIComponent(d.label)}`}
              style={{
                flex: "0 0 160px",
                scrollSnapAlign: "start",
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
                aspectRatio: "4 / 5",
                textDecoration: "none",
                color: "#FFFFFF",
                boxShadow: NEX.shadow,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={makeIllustrativeSvg(d.label, d.hue, "1x1")}
                alt={`${d.label} · illustrative`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(26,43,74,0.75) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 10,
                  right: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>{d.label}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{d.country}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular stays · property cards */}
      <section style={{ padding: "6px 18px 18px" }}>
        <SectionTitle rightLink={{ href: "/nex-native/dev/hotel-flow/results", label: "See all" }}>
          Popular stays
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {ALL_PROPERTIES.slice(0, 3).map((p) => (
            <PropertyCard key={p.id} property={p} layout="horizontal" />
          ))}
        </div>
      </section>

      {/* Experiences preview */}
      <section style={{ padding: "6px 18px 24px" }}>
        <SectionTitle>Experiences near you</SectionTitle>
        <div style={{ marginTop: 8, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          Guided experiences launch once there are verified NEX
          providers in your area. For now, explore properties above.
        </div>
      </section>

      <PrototypeFooterNote />
      <BottomNav active="home" />
    </PageShell>
  );
}

function SectionTitle({
  children,
  rightLink,
}: {
  readonly children: React.ReactNode;
  readonly rightLink?: { readonly href: string; readonly label: string };
}): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 700,
          color: NEX.text,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h2>
      {rightLink ? (
        <Link
          href={rightLink.href}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: NEX.accent,
            textDecoration: "none",
          }}
        >
          {rightLink.label}
        </Link>
      ) : null}
    </div>
  );
}

function PrototypeFooterNote(): React.ReactElement {
  return (
    <div
      style={{
        padding: "4px 18px 20px",
        fontSize: 10,
        color: NEX.textSoft,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      Prototype fixture data · no real bookings · no production writes.
    </div>
  );
}
