// src/app/nex-native/search/_spice-indicator.tsx
//
// Compact spice indicator for food/restaurant cards.
// --------------------------------------------------
// Reads MAX(nex_menu_item.spice_level) across the business's live
// menu items (0 = none, 1 = mild, 2 = hot, 3 = volcano) and renders
// 1-3 chili emoji ("🌶") in a small pill-ish group placed to the
// right of the profile avatar.
//
// Honest-null:
//   · maxSpiceLevel === null  → not rendered (business has no menu)
//   · maxSpiceLevel === 0     → not rendered (menu but nothing spicy)
//   · 1..3                    → renders exactly that many chilies
//
// Only shown for food-category businesses · for a service / shop
// row the spice signal is meaningless.

const FOOD_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
]);

const LABEL: Record<number, string> = {
  1: "Mild spice",
  2: "Hot",
  3: "Volcano · very spicy",
};

export function SpiceIndicator({
  maxSpiceLevel,
  businessCategory,
}: {
  readonly maxSpiceLevel: number | null;
  readonly businessCategory: string | null;
}): React.JSX.Element | null {
  if (!businessCategory || !FOOD_CATEGORIES.has(businessCategory)) return null;
  if (maxSpiceLevel === null || maxSpiceLevel <= 0) return null;
  const level = Math.max(1, Math.min(3, Math.floor(maxSpiceLevel)));
  const label = LABEL[level] ?? "Spicy";
  return (
    <span
      aria-label={label}
      title={label}
      data-nex-spice-level={level}
      style={{
        position: "absolute",
        // Avatar moved into the body row 2026-10-13 so the spice chip
        // takes the bottom-left slot on the cover itself.
        left: 10,
        bottom: 10,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        padding: "4px 7px",
        borderRadius: 999,
        background: "rgba(2,9,20,0.78)",
        border: "1px solid rgba(255,114,0,0.5)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        fontSize: 12,
        lineHeight: 1,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {Array.from({ length: level }).map((_, i) => (
        <ChiliIcon key={i} />
      ))}
    </span>
  );
}

/** Dark-red chili SVG · replaces the 🌶 emoji so the colour is
 *  controllable (emoji glyphs are coloured by the system font and
 *  can't be CSS-recoloured reliably). */
function ChiliIcon(): React.JSX.Element {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      {/* Stem · dark olive */}
      <path
        d="M12 3.2c0 1.2 .9 2.1 2.1 2.1"
        stroke="#3F4A1F"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Body · dark red droplet */}
      <path
        d="M14.1 5.3c1.3 .6 2.4 1.9 3.1 3.4 .8 1.7 1 3.6 .5 5.2 -.6 2-2.1 3.6-3.9 4.7-1.8 1-3.7 1.2-5.1 .4-1.5-.8-2.2-2.4-1.8-4.1 .4-1.8 1.6-3.5 3.2-5.1 1.5-1.5 3-2.9 4-4.5z"
        fill="#8B1A1A"
        stroke="#5B0F0F"
        strokeWidth="0.6"
      />
      {/* Highlight · lighter red accent */}
      <path
        d="M11.6 10.2c-.8 1-1.5 2.1-1.8 3.1"
        stroke="#C2423E"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
    </svg>
  );
}
