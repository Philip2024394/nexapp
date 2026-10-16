// src/app/nex-native/dev/hotel-flow/_components/_score-badge.tsx
// Review score components · reusable · HONEST-NULL default.
//
// When the property has no NEX reviews (fixture.reviews === null),
// renders the "No NEX reviews yet" empty state instead of a fake score.

"use client";

import type * as React from "react";
import { NEX } from "./_palette";
import type { ReviewAggregateFixture } from "./_fixtures";

export function ScoreBadge({
  reviews,
}: {
  readonly reviews: ReviewAggregateFixture | null;
}): React.ReactElement {
  if (reviews === null) {
    return (
      <div
        data-nex-score="empty"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: NEX.surfaceAlt,
          border: `1px solid ${NEX.divider}`,
          borderRadius: 10,
          fontSize: 12,
          color: NEX.textMuted,
          fontWeight: 600,
        }}
      >
        <span>No NEX reviews yet</span>
      </div>
    );
  }
  return (
    <div
      data-nex-score="populated"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: NEX.accentMuted,
        border: `1px solid ${NEX.accentSoft}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: NEX.accent,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        {reviews.overall.toFixed(1)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NEX.text }}>{reviews.label}</div>
        <div style={{ fontSize: 11, color: NEX.textMuted }}>{reviews.count} reviews</div>
      </div>
    </div>
  );
}

export function ReviewBreakdown({
  reviews,
}: {
  readonly reviews: ReviewAggregateFixture | null;
}): React.ReactElement {
  if (reviews === null) {
    return (
      <div
        style={{
          padding: 16,
          background: NEX.surfaceAlt,
          border: `1px solid ${NEX.divider}`,
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 14, color: NEX.text, fontWeight: 600 }}>No NEX reviews yet</div>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          NEX only displays verified guest reviews. When past guests
          leave a NEX review, the overall score and category breakdown
          will appear here.
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {reviews.categories.map((cat) => (
        <div key={cat.label}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: NEX.textMid,
              marginBottom: 4,
            }}
          >
            <span>{cat.label}</span>
            <span style={{ fontWeight: 700, color: NEX.text }}>{cat.score.toFixed(1)}</span>
          </div>
          <div
            style={{
              height: 6,
              background: NEX.surfaceAlt,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(cat.score / 10) * 100}%`,
                background: NEX.accent,
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
