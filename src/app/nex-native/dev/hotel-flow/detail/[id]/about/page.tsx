// Screen 6 · About the Property.
"use client";

import type * as React from "react";
import { use } from "react";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

export default function AboutPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  return (
    <PageShell>
      <TopBarBack title="About the property" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 20px 20px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>
          About {property.name}
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: 15, color: NEX.textMid, lineHeight: 1.7 }}>
          {property.description}
        </p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <InfoRow label="Property type" value={property.propertyType} />
          <InfoRow label="Address" value={property.address} />
          <InfoRow label="City" value={`${property.city}, ${property.region}`} />
          <InfoRow label="Country" value={property.country} />
          <InfoRow
            label="Verification"
            value={property.ownerVerified ? "Owner-verified listing" : "Owner has not yet claimed this listing"}
          />
        </div>
      </section>
    </PageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${NEX.dividerSoft}`, fontSize: 14 }}>
      <span style={{ color: NEX.textMuted }}>{label}</span>
      <span style={{ color: NEX.text, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}
