// Screen 8 · Guest Reviews. Empty state when no NEX reviews exist.
"use client";

import type * as React from "react";
import { use } from "react";
import Link from "next/link";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { ScoreBadge, ReviewBreakdown } from "../../../_components/_score-badge";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

export default function ReviewsPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  return (
    <PageShell>
      <TopBarBack title="Guest reviews" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 18px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>
          Guest reviews
        </h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          NEX shows review scores only when verified NEX reviews exist for this property.
        </div>
      </section>
      <section style={{ padding: "4px 18px 12px" }}>
        <ScoreBadge reviews={property.reviews} />
      </section>
      <section style={{ padding: "6px 18px 12px" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: NEX.text }}>Category breakdown</h2>
        <ReviewBreakdown reviews={property.reviews} />
      </section>
      {property.reviews === null ? (
        <section style={{ padding: "10px 18px 30px" }}>
          <div
            style={{
              padding: 16,
              background: NEX.accentMuted,
              border: `1px solid ${NEX.accentSoft}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
              Want to know what guests think?
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMid, lineHeight: 1.6 }}>
              Open a chat with the owner · ask about response times,
              cleanliness policies and what past guests have said.
            </div>
            <Link
              href={`/nex-native/dev/hotel-flow/chat?property=${property.id}`}
              style={{
                marginTop: 12,
                display: "inline-flex",
                padding: "10px 16px",
                borderRadius: 10,
                background: NEX.accent,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Ask the owner
            </Link>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
