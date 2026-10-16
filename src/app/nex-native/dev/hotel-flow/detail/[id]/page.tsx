// src/app/nex-native/dev/hotel-flow/detail/[id]/page.tsx
// Screen 3 · Hotel Detail / Overview.
// The core property page · all other detail routes link off this one.

"use client";

import type * as React from "react";
import { useState, use } from "react";
import Link from "next/link";
import { PageShell, FloatingBack } from "../../_components/_page-shell";
import { Icon } from "../../_components/_icons";
import { NEX } from "../../_components/_palette";
import {
  getPropertyById,
  visibleLocalCategoriesFor,
  COPY,
} from "../../_components/_fixtures";
import { ScoreBadge } from "../../_components/_score-badge";

export default function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  const [active, setActive] = useState(0);

  if (!property) {
    return (
      <PageShell>
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}>Property not found</div>
          <Link
            href="/nex-native/dev/hotel-flow/discover"
            style={{ color: NEX.accent, fontSize: 13, textDecoration: "none" }}
          >
            Back to Discover
          </Link>
        </div>
      </PageShell>
    );
  }

  const localCats = visibleLocalCategoriesFor(property);
  const detailBase = `/nex-native/dev/hotel-flow/detail/${property.id}`;

  return (
    <PageShell>
      {/* Hero gallery · swipeable */}
      <section style={{ position: "relative", background: NEX.surfaceAlt }}>
        <FloatingBack onBackHref="/nex-native/dev/hotel-flow/results" />
        <Link
          href={`${detailBase}/gallery`}
          aria-label="Open photo gallery"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 40,
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {property.hero.length} photos
        </Link>
        <div
          className="nex-no-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollLeft / el.clientWidth);
            if (idx !== active) setActive(idx);
          }}
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
          }}
        >
          {property.hero.map((img, i) => (
            <div
              key={i}
              style={{
                flex: "0 0 100%",
                scrollSnapAlign: "start",
                aspectRatio: "4 / 3",
                background: NEX.surfaceAlt,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 10,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {property.hero.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === active ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                transition: "width 160ms ease",
              }}
            />
          ))}
        </div>
      </section>

      {/* Identity */}
      <section style={{ padding: "18px 18px 10px" }}>
        <div
          style={{
            fontSize: 11,
            color: NEX.textMuted,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 600,
          }}
        >
          {property.propertyType}
        </div>
        <h1
          style={{
            margin: "4px 0 6px",
            fontSize: 24,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
          }}
        >
          {property.name}
        </h1>
        <div
          style={{
            fontSize: 14,
            color: NEX.textMid,
            lineHeight: 1.4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="pin" size={14} />
          <span>
            {property.city}, {property.region} · {property.country}
          </span>
        </div>
        <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2 }}>{property.address}</div>

        {/* Verified chip */}
        <div style={{ marginTop: 12 }}>
          {property.ownerVerified ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: NEX.verifiedSoft,
                color: NEX.verified,
                border: `1px solid ${NEX.verified}33`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Icon name="check" size={13} />
              {COPY.verificationClaimed}
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                background: NEX.surfaceAlt,
                color: NEX.textMuted,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {COPY.verificationUnclaimed}
            </span>
          )}
        </div>
      </section>

      {/* Score + reviews summary · honest-null when none */}
      <section style={{ padding: "4px 18px 10px" }}>
        <ScoreBadge reviews={property.reviews} />
      </section>

      {/* Quick-decide summary */}
      <section style={{ padding: "10px 18px" }}>
        <div
          style={{
            padding: 16,
            background: NEX.surface,
            border: `1px solid ${NEX.divider}`,
            borderRadius: 14,
            boxShadow: NEX.shadow,
          }}
        >
          <SectionKicker>Decide at a glance</SectionKicker>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {property.nearby.slice(0, 4).map((n) => (
              <li
                key={n.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: `1px solid ${NEX.dividerSoft}`,
                  fontSize: 13,
                  color: NEX.text,
                }}
              >
                <span style={{ color: NEX.textMid }}>{n.label}</span>
                <span style={{ fontWeight: 600 }}>
                  {n.walkMin !== undefined ? `${n.walkMin} min walk` : `~${n.driveMin} min drive`}
                </span>
              </li>
            ))}
          </ul>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: NEX.accentMuted,
              border: `1px solid ${NEX.accentSoft}`,
              borderRadius: 10,
              fontSize: 12,
              color: NEX.text,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ fontWeight: 700 }}>Not confirmed yet:</strong>{" "}
            nightly rate · availability for your dates · child & pet
            policy.{" "}
            <Link
              href={`/nex-native/dev/hotel-flow/chat?property=${property.id}`}
              style={{ color: NEX.accent, fontWeight: 700, textDecoration: "underline" }}
            >
              Ask the owner
            </Link>
            .
          </div>
        </div>
      </section>

      {/* "Before you book" strip · honest */}
      <section style={{ padding: "4px 18px 10px" }}>
        <div
          style={{
            padding: 14,
            background: NEX.warnSoft,
            border: `1px solid ${NEX.warn}44`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: NEX.warn,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Before you book
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13, color: NEX.text }}>
            {["Resort fee", "Deposit on arrival", "Cancellation policy"].map((row) => (
              <li
                key={row}
                style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}
              >
                <span style={{ color: NEX.textMid }}>{row}</span>
                <span style={{ fontWeight: 600, color: NEX.textMuted }}>Not disclosed yet</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section links · each one opens its own route */}
      <section style={{ padding: "6px 18px 0" }}>
        <SectionLink href={`${detailBase}/facilities`} title="Facilities" subtitle={`${property.hotelOffers.size} confirmed by the owner`} />
        <SectionLink href={`${detailBase}/about`} title="About the property" subtitle="Short description" />
        <SectionLink href={`${detailBase}/rooms`} title="Rooms" subtitle={`${property.rooms.length || 3} types`} />
        <SectionLink
          href={`${detailBase}/reviews`}
          title="Guest reviews"
          subtitle={property.reviews ? `${property.reviews.count} reviews` : "No NEX reviews yet"}
        />
        <SectionLink href={`${detailBase}/location`} title="Location & surroundings" subtitle="Walking distances to nearby places" />
        <SectionLink
          href={`${detailBase}/around`}
          title="Around your stay"
          subtitle={`${localCats.length} independent local categories`}
        />
      </section>

      <div style={{ height: 80 }} />

      {/* Sticky bottom action bar */}
      <StickyActions propertyId={property.id} />
    </PageShell>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 11,
        color: NEX.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function SectionLink({
  href,
  title,
  subtitle,
}: {
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        background: NEX.surface,
        border: `1px solid ${NEX.divider}`,
        borderRadius: 12,
        boxShadow: NEX.shadow,
        marginBottom: 10,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>{title}</div>
        <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2 }}>{subtitle}</div>
      </div>
      <span style={{ color: NEX.textMuted, display: "inline-flex" }}>
        <Icon name="chevronRight" size={18} />
      </span>
    </Link>
  );
}

function StickyActions({ propertyId }: { readonly propertyId: string }): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="nex-mobile-shell"
        style={{
          pointerEvents: "auto",
          padding: "10px 16px 14px",
          background: `${NEX.bg}f0`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${NEX.divider}`,
          display: "flex",
          gap: 10,
          boxShadow: "0 -4px 20px rgba(26,43,74,0.06)",
        }}
      >
        <Link
          href={`/nex-native/dev/hotel-flow/chat?property=${propertyId}`}
          aria-label="Ask the owner"
          style={{
            flex: "0 0 auto",
            width: 52,
            height: 52,
            borderRadius: 14,
            border: `1px solid ${NEX.divider}`,
            background: NEX.surface,
            color: NEX.textMid,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          <Icon name="message" size={22} />
        </Link>
        <Link
          href={`/nex-native/dev/hotel-flow/booking/${propertyId}`}
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 14,
            background: NEX.accent,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: `0 4px 14px ${NEX.accent}44`,
          }}
        >
          Request booking
        </Link>
      </div>
    </div>
  );
}
