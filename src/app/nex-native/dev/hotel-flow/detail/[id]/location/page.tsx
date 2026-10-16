// Screen 9 · Location & Surroundings.
"use client";

import type * as React from "react";
import { use } from "react";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { Icon } from "../../../_components/_icons";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

// Small OSM-tag humaniser · same pattern as the directory prototype
function humaniseOsmTag(tag: string): string {
  const map: Record<string, string> = {
    "amenity:place_of_worship": "Temple",
    "amenity:ferry_terminal": "Ferry terminal",
    "amenity:bus_station": "Bus station",
    "historic:monument": "Monument",
    "historic:memorial": "Memorial",
    "tourism:museum": "Museum",
    "tourism:attraction": "Attraction",
    "shop:marketplace": "Market",
    "public_transport:station": "Station",
    "aeroway:aerodrome": "Airport",
    "natural:beach": "Beach",
  };
  if (map[tag]) return map[tag];
  const parts = tag.split(":");
  return (parts[parts.length - 1] ?? tag).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function LocationPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  const mapsHref = `https://www.google.com/maps?q=${property.coordinates.lat},${property.coordinates.lng}&z=16&output=embed`;
  const externalHref = `https://www.google.com/maps/dir/?api=1&destination=${property.coordinates.lat},${property.coordinates.lng}&travelmode=walking`;

  return (
    <PageShell>
      <TopBarBack title="Location & surroundings" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 18px 10px" }}>
        <div style={{ fontSize: 14, color: NEX.textMid, lineHeight: 1.5 }}>
          {property.address}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted }}>
          {property.city}, {property.region} · {property.country}
        </div>
      </section>

      {/* Embedded map */}
      <section style={{ padding: "6px 18px 12px" }}>
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${NEX.divider}`,
            height: 280,
          }}
        >
          <iframe
            src={mapsHref}
            title={`${property.name} on map`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 14px",
            borderRadius: 10,
            border: `1px solid ${NEX.accent}66`,
            background: NEX.accentMuted,
            color: NEX.accent,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <Icon name="pin" size={14} />
          Walking directions in Google Maps
        </a>
      </section>

      {/* Nearby places */}
      <section style={{ padding: "16px 18px 24px" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: NEX.text }}>Nearby places</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {property.nearby.map((n) => (
            <li
              key={n.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "10px 0",
                borderBottom: `1px solid ${NEX.dividerSoft}`,
                fontSize: 14,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: NEX.text, fontWeight: 600 }}>{n.label}</span>
                <span style={{ fontSize: 11, color: NEX.textMuted }}>{humaniseOsmTag(n.osmKind)}</span>
              </div>
              <span style={{ fontSize: 13, color: NEX.textMid, fontWeight: 600 }}>
                {n.walkMin !== undefined ? `${n.walkMin} min walk` : `~${n.driveMin} min drive`}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 12, fontSize: 10, color: NEX.textSoft, lineHeight: 1.5 }}>
          © OpenStreetMap contributors (ODbL) · method: osm_overpass_landmarks_v1
        </div>
      </section>
    </PageShell>
  );
}
