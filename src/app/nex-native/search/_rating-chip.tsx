// src/app/nex-native/search/_rating-chip.tsx
//
// Star-rating chip for hotel / accommodation cards.
// -------------------------------------------------
// Reads `rating` (0..5) + `review_count` from the business row via a
// defensive cast · fields are populated on
// `nex.accommodation_business` once the walker + verification pipe
// finishes approving ratings; today they're all null, so this chip
// is honest-null and renders nothing on every card.
//
// Only shown for accommodation / stay-vertical rows. For non-stay
// categories the chip never renders, even if the fields happen to
// carry a value from elsewhere.

import type { NexBusinessRow } from "@/lib/nex-native/types";

const STAY_CATEGORIES = new Set([
  "accommodation",
  "hotel",
  "villa",
  "guesthouse",
  "homestay",
  "resort",
  "hostel",
  "boutique_hotel",
  "serviced_apartment",
]);

const NEX = {
  bg: "rgba(2,9,20,0.78)",
  border: "rgba(255,196,0,0.5)",
  text: "#F2F5F8",
  starGold: "#FFC400",
  textMuted: "#8BA9D1",
};

export function RatingChip({
  row,
}: {
  readonly row: NexBusinessRow;
}): React.JSX.Element | null {
  const cat = row.business_category ?? null;
  if (!cat || !STAY_CATEGORIES.has(cat)) return null;

  // Defensive read · these fields live on
  // nex.accommodation_business but are projected into NexBusinessRow
  // via `local-directory-service.adaptCanonical` once rating + review
  // count are approved. Until then both are null.
  const loose = row as unknown as {
    rating?: number | null;
    review_count?: number | null;
    rating_source?: string | null;
  };
  const rating =
    typeof loose.rating === "number" && loose.rating >= 0 && loose.rating <= 5
      ? loose.rating
      : null;
  if (rating === null) return null;
  const reviews =
    typeof loose.review_count === "number" && loose.review_count > 0
      ? loose.review_count
      : null;
  const source =
    typeof loose.rating_source === "string" && loose.rating_source.length > 0
      ? loose.rating_source
      : null;

  const label = `${rating.toFixed(1)} rating${reviews ? ` from ${reviews.toLocaleString("en-US")} reviews` : ""}${source ? ` · source ${source}` : ""}`;

  return (
    <span
      aria-label={label}
      title={label}
      data-nex-rating-chip
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: NEX.bg,
        border: `1px solid ${NEX.border}`,
        fontSize: 11,
        fontWeight: 700,
        color: NEX.text,
        letterSpacing: "0.01em",
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ color: NEX.starGold, fontSize: 12, lineHeight: 1 }}>
        ★
      </span>
      <span>{rating.toFixed(1)}</span>
      {reviews ? (
        <span style={{ color: NEX.textMuted, fontWeight: 500 }}>
          · {formatReviewCount(reviews)}
        </span>
      ) : null}
    </span>
  );
}

function formatReviewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
