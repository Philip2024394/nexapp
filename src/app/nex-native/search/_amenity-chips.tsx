// src/app/nex-native/search/_amenity-chips.tsx
//
// Hotel / accommodation amenity chip row.
// ---------------------------------------
// Reads `amenities` (text[]) from the business row via a defensive
// cast · fields are populated on `nex.accommodation_business` and
// surfaced into NexBusinessRow by `local-directory-service.adaptCanonical`.
//
// Shown ONLY on stay-vertical cards. Up to 5 chips rendered; the rest
// collapse into a "+N more" chip.
//
// Honest-null:
//   · amenities array null / empty → component renders nothing
//   · unknown amenity string       → falls back to a generic bullet

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

interface AmenitySpec {
  readonly emoji: string;
  readonly label: string;
}

// OSM / NEX-walker canonical values on nex.accommodation_business.amenities.
const AMENITY_MAP: Record<string, AmenitySpec> = {
  wifi: { emoji: "📶", label: "Wi-Fi" },
  air_conditioning: { emoji: "❄️", label: "AC" },
  pool: { emoji: "🏊", label: "Pool" },
  parking: { emoji: "🅿️", label: "Parking" },
  on_site_restaurant: { emoji: "🍴", label: "Restaurant" },
  on_site_bar: { emoji: "🍺", label: "Bar" },
  breakfast: { emoji: "🥐", label: "Breakfast" },
  gym: { emoji: "💪", label: "Gym" },
  spa: { emoji: "💆", label: "Spa" },
  pet_friendly: { emoji: "🐾", label: "Pet friendly" },
  smoking_allowed: { emoji: "🚬", label: "Smoking" },
  wheelchair_accessible: { emoji: "♿", label: "Accessible" },
  laundry: { emoji: "🧺", label: "Laundry" },
  shuttle: { emoji: "🚐", label: "Shuttle" },
  elevator: { emoji: "🛗", label: "Lift" },
  "24_hr_reception": { emoji: "🛎", label: "24h desk" },
};

const NEX = {
  pillBg: "rgba(0,175,255,0.08)",
  pillBorder: "rgba(0,175,255,0.3)",
  pillText: "#B5C3D6",
  overflowBg: "rgba(255,255,255,0.04)",
  overflowBorder: "rgba(255,255,255,0.08)",
  overflowText: "#8BA9D1",
};

export function AmenityChips({
  row,
  maxVisible = 5,
}: {
  readonly row: NexBusinessRow;
  readonly maxVisible?: number;
}): React.JSX.Element | null {
  const cat = row.business_category ?? null;
  if (!cat || !STAY_CATEGORIES.has(cat)) return null;

  const loose = row as unknown as { amenities?: string[] | null };
  const amenities = Array.isArray(loose.amenities)
    ? loose.amenities.filter((a): a is string => typeof a === "string" && a.length > 0)
    : [];
  if (amenities.length === 0) return null;

  const shown = amenities.slice(0, maxVisible);
  const overflow = amenities.length - shown.length;

  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
      }}
    >
      {shown.map((a) => {
        const spec = AMENITY_MAP[a] ?? { emoji: "•", label: humanize(a) };
        return (
          <span
            key={a}
            data-nex-amenity={a}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px",
              borderRadius: 999,
              background: NEX.pillBg,
              border: `1px solid ${NEX.pillBorder}`,
              color: NEX.pillText,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.02em",
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>
              {spec.emoji}
            </span>
            <span>{spec.label}</span>
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 7px",
            borderRadius: 999,
            background: NEX.overflowBg,
            border: `1px solid ${NEX.overflowBorder}`,
            color: NEX.overflowText,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
