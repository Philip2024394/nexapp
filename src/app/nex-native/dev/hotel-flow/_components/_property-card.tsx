// src/app/nex-native/dev/hotel-flow/_components/_property-card.tsx
// Reusable property list item · used on Discover + Results + Trips.
// Honest-null · no fake scores, no fake prices.

"use client";

import type * as React from "react";
import Link from "next/link";
import { NEX } from "./_palette";
import { Icon } from "./_icons";
import type { PropertyFixture } from "./_fixtures";

export function PropertyCard({
  property,
  layout = "horizontal",
}: {
  readonly property: PropertyFixture;
  readonly layout?: "horizontal" | "vertical";
}): React.ReactElement {
  const detailHref = `/nex-native/dev/hotel-flow/detail/${property.id}`;
  if (layout === "vertical") {
    return (
      <Link
        href={detailHref}
        style={{
          display: "block",
          textDecoration: "none",
          background: NEX.surface,
          border: `1px solid ${NEX.divider}`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: NEX.shadow,
          color: "inherit",
        }}
      >
        <div style={{ aspectRatio: "4 / 3", background: NEX.surfaceAlt }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={property.hero[0].url}
            alt={property.hero[0].alt}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
        <CardBody property={property} />
      </Link>
    );
  }
  return (
    <Link
      href={detailHref}
      style={{
        display: "flex",
        gap: 12,
        textDecoration: "none",
        padding: 10,
        background: NEX.surface,
        border: `1px solid ${NEX.divider}`,
        borderRadius: 14,
        boxShadow: NEX.shadow,
        color: "inherit",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          width: 110,
          height: 110,
          borderRadius: 10,
          overflow: "hidden",
          background: NEX.surfaceAlt,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={property.hero[0].url}
          alt={property.hero[0].alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <CardBody property={property} compact />
      </div>
    </Link>
  );
}

function CardBody({
  property,
  compact = false,
}: {
  readonly property: PropertyFixture;
  readonly compact?: boolean;
}): React.ReactElement {
  return (
    <div style={{ padding: compact ? 0 : 12 }}>
      <div
        style={{
          fontSize: 10,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
        }}
      >
        {property.propertyType}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 15,
          fontWeight: 700,
          color: NEX.text,
          lineHeight: 1.25,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {property.name}
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: NEX.textMuted,
        }}
      >
        <Icon name="pin" size={13} />
        <span>
          {property.city}, {property.region}
        </span>
      </div>
      {property.ownerVerified ? (
        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            background: NEX.verifiedSoft,
            color: NEX.verified,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          <Icon name="check" size={11} />
          Owner-verified
        </div>
      ) : null}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: NEX.textMuted,
        }}
      >
        No NEX reviews yet
      </div>
    </div>
  );
}
