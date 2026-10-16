// src/app/nex-native/search/_food-amenity-chips.tsx
//
// Food-vertical amenity chips.
// ----------------------------
// Reads three owner-declared fields that land with migration 161:
//
//   · cuisine_type        · one-word · "italian" / "indonesian" / "vegan"
//   · dietary_flags       · ["halal", "vegetarian_options", …]
//   · delivery_platforms  · ["gofood", "grab", "own"]
//
// All reads are defensive casts so the component is honest-null before
// the column lands and lights up the moment data arrives.
//
// Shown only on food-category cards. Non-food cards never render.

import type { NexBusinessRow } from "@/lib/nex-native/types";

const FOOD_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
]);

interface ChipSpec {
  readonly emoji: string;
  readonly label: string;
}

const DIET_MAP: Record<string, ChipSpec> = {
  halal: { emoji: "🕌", label: "Halal" },
  kosher: { emoji: "✡️", label: "Kosher" },
  vegetarian_options: { emoji: "🥬", label: "Veggie opt." },
  vegan_options: { emoji: "🌱", label: "Vegan opt." },
  gluten_free_options: { emoji: "🌾", label: "GF opt." },
};

const PLATFORM_MAP: Record<string, ChipSpec> = {
  gofood: { emoji: "🛵", label: "GoFood" },
  grab: { emoji: "🛵", label: "Grab" },
  shopee: { emoji: "🛍", label: "ShopeeFood" },
  foodpanda: { emoji: "🛵", label: "foodpanda" },
  deliveroo: { emoji: "🛵", label: "Deliveroo" },
  uber_eats: { emoji: "🛵", label: "Uber Eats" },
  own: { emoji: "📞", label: "Own delivery" },
};

const NEX = {
  cuisineBg: "rgba(255,114,0,0.1)",
  cuisineBorder: "rgba(255,114,0,0.4)",
  cuisineText: "#FF9A4A",
  dietBg: "rgba(22,214,107,0.1)",
  dietBorder: "rgba(22,214,107,0.4)",
  dietText: "#4FD991",
  platformBg: "rgba(0,175,255,0.08)",
  platformBorder: "rgba(0,175,255,0.3)",
  platformText: "#B5C3D6",
};

export function FoodAmenityChips({
  row,
}: {
  readonly row: NexBusinessRow;
}): React.JSX.Element | null {
  const cat = row.business_category ?? null;
  if (!cat || !FOOD_CATEGORIES.has(cat)) return null;

  const loose = row as unknown as {
    cuisine_type?: string | null;
    dietary_flags?: string[] | null;
    delivery_platforms?: string[] | null;
  };

  const cuisine =
    typeof loose.cuisine_type === "string" && loose.cuisine_type.length > 0
      ? loose.cuisine_type.trim().toLowerCase()
      : null;
  const diets = Array.isArray(loose.dietary_flags)
    ? loose.dietary_flags.filter((d): d is string => typeof d === "string" && d.length > 0)
    : [];
  const platforms = Array.isArray(loose.delivery_platforms)
    ? loose.delivery_platforms.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];

  if (!cuisine && diets.length === 0 && platforms.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
      }}
    >
      {cuisine ? (
        <span
          data-nex-food-chip="cuisine"
          style={chipStyle(NEX.cuisineBg, NEX.cuisineBorder, NEX.cuisineText)}
        >
          <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>🍜</span>
          <span>{humanize(cuisine)}</span>
        </span>
      ) : null}

      {diets.slice(0, 3).map((d) => {
        const spec = DIET_MAP[d] ?? { emoji: "•", label: humanize(d) };
        return (
          <span
            key={`diet:${d}`}
            data-nex-food-chip={`diet:${d}`}
            style={chipStyle(NEX.dietBg, NEX.dietBorder, NEX.dietText)}
          >
            <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>{spec.emoji}</span>
            <span>{spec.label}</span>
          </span>
        );
      })}

      {platforms.slice(0, 3).map((p) => {
        const spec = PLATFORM_MAP[p] ?? { emoji: "📦", label: humanize(p) };
        return (
          <span
            key={`plat:${p}`}
            data-nex-food-chip={`platform:${p}`}
            style={chipStyle(NEX.platformBg, NEX.platformBorder, NEX.platformText)}
          >
            <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>{spec.emoji}</span>
            <span>{spec.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function chipStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 7px",
    borderRadius: 999,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.02em",
    lineHeight: 1.4,
  };
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
