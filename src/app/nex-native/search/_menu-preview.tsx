// src/app/nex-native/search/_menu-preview.tsx
//
// Horizontal menu preview strip for restaurant cards.
// ---------------------------------------------------
// Shows up to 3 of the business's cheapest available menu items with
// name + price. Click/tap routes to the full menu via the shop
// landing page (`/nex-native/{slug}`).
//
// Honest-null:
//   · menuPreview empty → component renders nothing (no strip, no
//     reserved space on the card)
//   · item.pricePence null → price text omitted on that one item

import Link from "next/link";
import type { DiscoverCardMenuItem } from "@/lib/nex-native/discover-card-context";
import { formatMinPrice } from "@/lib/nex-native/discover-card-context";

const NEX = {
  pillBg: "rgba(255,114,0,0.08)",
  pillBorder: "rgba(255,114,0,0.3)",
  pillText: "#F2F5F8",
  priceText: "#FF9A4A",
  textSoft: "#8BA9D1",
};

const FOOD_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
]);

export function MenuPreview({
  menuPreview,
  businessCategory,
  shopHref,
}: {
  readonly menuPreview: readonly DiscoverCardMenuItem[];
  readonly businessCategory: string | null;
  readonly shopHref: string;
}): React.JSX.Element | null {
  if (!businessCategory || !FOOD_CATEGORIES.has(businessCategory)) return null;
  if (menuPreview.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="nex-no-scrollbar"
    >
      {menuPreview.map((item) => {
        const priceLabel = formatPriceInline(item.pricePence, item.currency);
        return (
          <Link
            key={item.id}
            href={shopHref}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              background: NEX.pillBg,
              border: `1px solid ${NEX.pillBorder}`,
              textDecoration: "none",
              maxWidth: 180,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: NEX.pillText,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 120,
              }}
            >
              {item.name}
            </span>
            {priceLabel ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: NEX.priceText,
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {priceLabel}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

/** Compact inline price · reuses formatMinPrice but strips the
 *  "From " prefix for use in the menu-item pill. */
function formatPriceInline(
  pence: number | null,
  currency: string | null,
): string | null {
  const full = formatMinPrice(pence, currency);
  if (!full) return null;
  return full.replace(/^From\s+/, "");
}
