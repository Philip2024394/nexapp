// Screen 5 · Facilities. Honest-null for items not confirmed.
"use client";

import type * as React from "react";
import { use } from "react";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { Icon } from "../../../_components/_icons";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

const ALL_FACILITIES: readonly { readonly k: string; readonly label: string; readonly icon: string }[] = [
  { k: "wifi", label: "Free Wi-Fi", icon: "wifi" },
  { k: "parking", label: "Free parking", icon: "parking" },
  { k: "pool", label: "Outdoor pool", icon: "pool" },
  { k: "air_conditioning", label: "Air conditioning", icon: "ac" },
  { k: "breakfast", label: "Breakfast available", icon: "breakfast" },
  { k: "front_desk_24h", label: "24-hour front desk", icon: "bell" },
  { k: "gym", label: "Gym", icon: "gym" },
  { k: "spa", label: "Spa", icon: "spa" },
  { k: "pet_friendly", label: "Pet friendly", icon: "pet" },
  { k: "airport_shuttle", label: "Airport shuttle", icon: "car" },
  { k: "laundry", label: "On-site laundry", icon: "laundry" },
];

export default function FacilitiesPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  const confirmed = ALL_FACILITIES.filter((f) => property.hotelOffers.has(f.k));
  const unknown = ALL_FACILITIES.filter((f) => !property.hotelOffers.has(f.k));

  return (
    <PageShell>
      <TopBarBack title="Facilities" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 18px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NEX.text, letterSpacing: "-0.01em" }}>
          Confirmed by the owner
        </h2>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted }}>
          {confirmed.length} facilities · owner-reported
        </div>
      </section>
      <section style={{ padding: "4px 18px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {confirmed.map((f) => (
            <div
              key={f.k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: NEX.surfaceAlt,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 10,
                fontSize: 13,
                color: NEX.text,
                fontWeight: 500,
              }}
            >
              <span style={{ color: NEX.accent }}>
                <Icon name={f.icon} size={20} />
              </span>
              {f.label}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "10px 18px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: NEX.text, letterSpacing: "-0.01em" }}>
          Not confirmed yet
        </h2>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          NEX does not have the owner's confirmation on these facilities.
          Ask the owner if any of them matter for your stay.
        </div>
      </section>
      <section style={{ padding: "4px 18px 30px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {unknown.map((f) => (
            <div
              key={f.k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: NEX.surface,
                border: `1px dashed ${NEX.divider}`,
                borderRadius: 10,
                fontSize: 13,
                color: NEX.textMuted,
              }}
            >
              <span style={{ color: NEX.textSoft }}>
                <Icon name={f.icon} size={20} />
              </span>
              {f.label}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
