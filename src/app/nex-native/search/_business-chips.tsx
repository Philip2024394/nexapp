// src/app/nex-native/search/_business-chips.tsx
//
// Compact chip row for NEX Discover shop cards.
// ---------------------------------------------
// Each chip is small (10px font · pill shape · icon + label) and
// derived STRICTLY from honest-set fields on the business row:
//
//   · shipping_scope   → `🛵 Delivery`  (local / nationwide)
//                      → `🌍 Exports`   (international / global)
//   · accepts_pickup   → `🏃 Pickup`   (non-food categories only ·
//                                       restaurants are implicit)
//   · accepts_cod      → `💵 COD`
//   · offers_eat_in    → `🍽 Eat-in`   (restaurant / cafe only · requires
//                                       the new column from migration
//                                       158 — reads null-safe today)
//
// Removed 2026-10-13: Languages chip (mostly "ID" on 100% of rows ·
// not differentiating). Pickup is hidden for food categories because
// walk-up / takeaway is implicit for restaurants + cafes.
//
// Honest-null rule: when a field is empty / null / false, the chip is
// NOT rendered. Unclaimed directory rows produce zero chips and the
// row is still shown (chip row quietly collapses).

"use client";

import type { NexBusinessRow } from "@/lib/nex-native/types";

const NEX = {
  pillBg: "rgba(0,175,255,0.08)",
  pillBorder: "rgba(0,175,255,0.3)",
  pillText: "#B5C3D6",
  deliveryBg: "rgba(255,114,0,0.1)",
  deliveryBorder: "rgba(255,114,0,0.4)",
  deliveryText: "#FF9A4A",
  exportBg: "rgba(22,214,107,0.1)",
  exportBorder: "rgba(22,214,107,0.4)",
  exportText: "#4FD991",
};

interface Chip {
  readonly key: string;
  readonly emoji: string;
  readonly label: string;
  readonly tone: "default" | "delivery" | "export";
}

const FOOD_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
]);

export function BusinessChips({
  row,
}: {
  readonly row: NexBusinessRow;
}): React.JSX.Element | null {
  const chips: Chip[] = [];

  const isFood = FOOD_CATEGORIES.has(row.business_category ?? "");

  // Shipping scope · delivery (local / nationwide) vs exports
  // (international / global). Honest-null when unset.
  const ship = typeof row.shipping_scope === "string" ? row.shipping_scope.toLowerCase() : null;
  if (ship === "local" || ship === "nationwide" || ship === "national") {
    chips.push({ key: "delivery", emoji: "🛵", label: "Delivery", tone: "delivery" });
  } else if (ship === "international" || ship === "global" || ship === "export") {
    // Upgrade the generic Exports chip when migration 160 lands and
    // the owner has declared target countries. Defensive read keeps
    // this honest-null until the column exists in Supabase.
    const loose = row as unknown as { exports_to_countries?: string[] | null };
    const countries = Array.isArray(loose.exports_to_countries) ? loose.exports_to_countries : [];
    const label =
      countries.length === 0
        ? "Exports"
        : countries.length === 1
          ? `Ships to 1 country`
          : `Ships to ${countries.length} countries`;
    chips.push({ key: "export", emoji: "🌍", label, tone: "export" });
  }

  // MOQ chip · reads existing nex_business.min_order_quantity.
  // Shown for product/service businesses only (never on food — a
  // restaurant having a "min order 10" would read as hostile).
  const loose = row as unknown as { min_order_quantity?: number | null };
  const moq =
    typeof loose.min_order_quantity === "number" && loose.min_order_quantity > 1
      ? loose.min_order_quantity
      : null;
  if (moq !== null && !isFood) {
    chips.push({
      key: "moq",
      emoji: "📦",
      label: `MOQ ${moq}`,
      tone: "default",
    });
  }

  // Pickup chip · suppressed for food categories (walk-up / takeaway
  // is implicit for restaurants + cafes). Shown for product / service
  // businesses where it's a real differentiator.
  if (row.accepts_pickup && !isFood) {
    chips.push({ key: "pickup", emoji: "🏃", label: "Pickup", tone: "default" });
  }

  // COD chip removed 2026-10-13 per founder · the Safe Trade sheet
  // already explains COD / escrow / Stripe as the recommended path,
  // so a per-card COD label was duplicate signalling.

  // Eat-in chip · future field (`offers_eat_in` boolean · migration
  // 158). We read it defensively from a loose cast today so this
  // component renders correctly the moment the column lands AND
  // during the gap it reads false (no chip shown).
  const r = row as unknown as { offers_eat_in?: boolean };
  if (r.offers_eat_in && isFood) {
    chips.push({ key: "eatin", emoji: "🍽", label: "Eat-in", tone: "default" });
  }

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
      }}
    >
      {chips.map((c) => (
        <span
          key={c.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 7px",
            borderRadius: 999,
            background:
              c.tone === "delivery"
                ? NEX.deliveryBg
                : c.tone === "export"
                  ? NEX.exportBg
                  : NEX.pillBg,
            border: `1px solid ${
              c.tone === "delivery"
                ? NEX.deliveryBorder
                : c.tone === "export"
                  ? NEX.exportBorder
                  : NEX.pillBorder
            }`,
            color:
              c.tone === "delivery"
                ? NEX.deliveryText
                : c.tone === "export"
                  ? NEX.exportText
                  : NEX.pillText,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1.4,
          }}
        >
          <span aria-hidden style={{ fontSize: 10 }}>{c.emoji}</span>
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
}
