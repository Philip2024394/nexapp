"use client";

// src/app/nex-native/manage/shop/setup/category/_client.tsx
//
// Shop Setup · Step 3 · Category client.
// Owner-authorised 2026-11-06 · Rev 6 dropdown rework 2026-11-07.
// Phase B search-first rework 2026-11-07 · "No legitimate business
// should be left without a suitable category in NEX."
// -----------------------------------------------------------------------------
// Mobile-first interaction model:
//   · Primary surface = a big search box · a seller types what they
//     do in everyday language ("hair salon", "juice bar", "online
//     retailer", "ice cream shop") and the matching subtype lands
//     directly from alias search.
//   · Secondary surface = two SURFACE_CARD dropdowns (category then
//     subcategory) for sellers who prefer to browse.
//   · "Other …" fallback appears at the end of each category list ·
//     for Food/Services/Products this writes the generic bucket
//     (food_maker/creative/retail · now labelled "Other X"); for
//     Accommodation + Property it opens the request-a-category flow.
//   · "Can't find your business? Request a category →" link below.
// Save → saveShopCategoryAction → writes nex_business.profile JSONB.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import { saveShopCategoryAction } from "../_actions";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_BLURB,
  BUSINESS_CATEGORY_LABEL,
} from "@/lib/nex-native/business/categories";
import {
  BUSINESS_SUBTYPE_CATEGORY,
  BUSINESS_SUBTYPE_LABEL,
  CATEGORIES_WITHOUT_OTHER_SUBTYPE,
  OTHER_BUSINESS_FALLBACK_SUBTYPE,
  subtypesByCategory,
} from "@/lib/nex-native/business/subtypes";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "@/lib/nex-native/business/types";
import { searchSubtypes } from "@/lib/nex-native/business/subtype-aliases";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.28)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

const CATEGORY_EMOJI: Record<BusinessCategory, string> = {
  food:          "🍽",
  accommodation: "🏨",
  property:      "🏠",
  products:      "📦",
  services:      "🛎",
};

const SUBTYPE_EMOJI: Record<BusinessSubtype, string> = {
  restaurant:         "🍽",
  cafe:               "☕",
  bakery:             "🥐",
  food_maker:         "👩‍🍳",
  catering:           "🥂",
  drinks:             "🍹",
  food_delivery:      "🛵",
  ice_cream:          "🍦",
  dessert_shop:       "🍰",
  juice_bar:          "🧃",
  hotel:              "🏨",
  villa:              "🏡",
  guesthouse:         "🛏",
  homestay:           "🏠",
  resort:             "🌴",
  short_rental:       "📅",
  kost:               "🚪",
  for_sale:           "💰",
  for_rent:           "📝",
  developer:          "🏗",
  agent:              "🧑‍💼",
  retail:             "🛒",
  manufacturer:       "🏭",
  wholesale:          "📦",
  local_artisan:      "🎨",
  exporter:           "🌐",
  motorbike_shop:     "🏍",
  ecommerce:          "💻",
  product_brand:      "🏷",
  beauty:             "💄",
  health_wellness:    "💆",
  home_services:      "🧰",
  professional:       "🧑‍⚖️",
  trade_construction: "🔧",
  automotive:         "🚗",
  events:             "🎪",
  creative:           "🎨",
  salon:              "💇",
  fitness:            "🏋️",
  tradesperson:       "🔨",
  construction:       "🏗",
  staircase_company:  "🪜",
  consultant:         "🧭",
  agency:             "🧑‍💼",
  portfolio:          "🖼",
  creator:            "🎥",
  community:          "🧑‍🤝‍🧑",
};

const SELECT_STYLE: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: CREAM,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  padding: "4px 0",
};

export function CategoryStepClient({
  initialCategory,
  initialSubtype,
}: {
  initialCategory: BusinessCategory | null;
  initialSubtype: BusinessSubtype | null;
}): React.JSX.Element {
  const router = useRouter();
  const [category, setCategory] = React.useState<string>(initialCategory ?? "");
  const [subtype, setSubtype] = React.useState<string>(initialSubtype ?? "");
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [browseOpen, setBrowseOpen] = React.useState(!!initialCategory);

  // 150ms debounce so each keystroke doesn't reflow the result list.
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  const searchHits = React.useMemo(() => {
    if (debouncedQuery.trim().length === 0) return [];
    return searchSubtypes(debouncedQuery, { limit: 8 });
  }, [debouncedQuery]);

  const activeCategory: BusinessCategory | null =
    (BUSINESS_CATEGORIES as readonly string[]).includes(category)
      ? (category as BusinessCategory)
      : null;
  const activeSubtypes = activeCategory ? subtypesByCategory(activeCategory) : [];
  const pickedSubtype: BusinessSubtype | null =
    activeCategory && (activeSubtypes as readonly string[]).includes(subtype)
      ? (subtype as BusinessSubtype)
      : null;

  function pickFromSearch(hit: { category: BusinessCategory; subtype: BusinessSubtype }) {
    setCategory(hit.category);
    setSubtype(hit.subtype);
    setQuery("");
    setDebouncedQuery("");
    setBrowseOpen(true);
  }

  function onCategoryChange(next: string) {
    setCategory(next);
    setSubtype("");
  }

  function onSubtypeChange(next: string) {
    // Special-case "other" selection for Accommodation + Property ·
    // these have no catch-all subtype so we redirect to the request
    // flow instead of saving.
    if (next.startsWith("__other__:")) {
      const cat = next.split(":")[1] ?? "";
      const qs = new URLSearchParams({ category: cat });
      router.push(`/nex-native/manage/shop/setup/request-category?${qs.toString()}`);
      return;
    }
    setSubtype(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeCategory || !pickedSubtype || status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("category", activeCategory);
    fd.set("subtype", pickedSubtype);
    const result = await saveShopCategoryAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  return (
    <WizardShell
      stepNumber={3}
      stepTitle="What do you sell?"
      stepLead="Type what you do — hair salon, coffee shop, online retailer, staircase company — or browse the categories below."
      backHref="/nex-native/manage/shop/setup/location"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* ───────── Mobile-first search surface ───────── */}
        <div>
          <label htmlFor="shop-category-search" style={LABEL_STYLE}>
            Describe your business
          </label>
          <div
            style={{
              ...SURFACE_CARD_STYLE,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
            }}
          >
            <span aria-hidden style={{ fontSize: 20, minWidth: 22 }}>
              🔎
            </span>
            <input
              id="shop-category-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Hair salon · juice bar · online retailer · gym …"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: CREAM,
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                padding: "4px 0",
                minWidth: 0,
              }}
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                style={{
                  background: "transparent",
                  border: "none",
                  color: INK_MUTED,
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <span style={HINT_STYLE}>
            {debouncedQuery.length > 0 && searchHits.length === 0
              ? "No matches yet. Try a different word or browse below."
              : "Type in ordinary language — synonyms, trade names and slang work."}
          </span>
        </div>

        {/* Search results · live-ranked by searchSubtypes. */}
        {searchHits.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {searchHits.map((hit) => {
              const isPicked = hit.subtype === pickedSubtype;
              return (
                <button
                  key={hit.subtype}
                  type="button"
                  onClick={() => pickFromSearch({ category: hit.category, subtype: hit.subtype })}
                  data-nex-category-search-hit={hit.subtype}
                  aria-pressed={isPicked}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isPicked
                      ? "rgba(198, 161, 91, 0.18)"
                      : "rgba(5, 15, 28, 0.9)",
                    border: `1.5px solid ${isPicked ? GOLD : BORDER}`,
                    borderRadius: 12,
                    color: INK,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    minHeight: 48 /* mobile touch target */,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 22, minWidth: 24 }}>
                    {SUBTYPE_EMOJI[hit.subtype]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 900,
                        color: isPicked ? GOLD : CREAM,
                      }}
                    >
                      {hit.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: INK_MUTED,
                        marginTop: 1,
                      }}
                    >
                      In {BUSINESS_CATEGORY_LABEL[hit.category]}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      color: GOLD,
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    →
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* ───────── Browse by category (collapsible) ───────── */}
        <button
          type="button"
          onClick={() => setBrowseOpen(!browseOpen)}
          aria-expanded={browseOpen}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 14px",
            background: "rgba(5, 15, 28, 0.6)",
            border: `1px solid ${browseOpen ? BORDER_HI : BORDER}`,
            borderRadius: 10,
            color: INK,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: "0.01em",
          }}
        >
          <span>Browse all categories</span>
          <span style={{ color: GOLD, fontSize: 13 }}>
            {browseOpen ? "▾" : "▸"}
          </span>
        </button>

        {browseOpen ? (
          <>
            {/* Category dropdown. */}
            <div>
              <label htmlFor="shop-category" style={LABEL_STYLE}>
                Business category
              </label>
              <div
                style={{
                  ...SURFACE_CARD_STYLE,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                }}
              >
                <span aria-hidden style={{ fontSize: 22, minWidth: 24 }}>
                  {activeCategory ? CATEGORY_EMOJI[activeCategory] : "🏷"}
                </span>
                <select
                  id="shop-category"
                  value={category}
                  onChange={(e) => onCategoryChange(e.currentTarget.value)}
                  style={SELECT_STYLE}
                >
                  <option value="" style={{ background: "#0A1526" }}>
                    Select a category…
                  </option>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "#0A1526" }}>
                      {CATEGORY_EMOJI[c]} &nbsp;{BUSINESS_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                {activeCategory ? (
                  <span
                    style={{
                      padding: "4px 10px",
                      fontSize: 9.5,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: GOLD,
                      background: "rgba(198, 161, 91, 0.12)",
                      border: "1px solid rgba(198, 161, 91, 0.55)",
                      borderRadius: 999,
                    }}
                  >
                    {activeSubtypes.length} types
                  </span>
                ) : null}
              </div>
              <span style={HINT_STYLE}>
                {activeCategory
                  ? BUSINESS_CATEGORY_BLURB[activeCategory]
                  : "Pick the family that best fits your shop."}
              </span>
            </div>

            {/* Subcategory dropdown · with "Other X" fallback. */}
            <div>
              <label htmlFor="shop-subtype" style={LABEL_STYLE}>
                Subcategory
              </label>
              <div
                style={{
                  ...SURFACE_CARD_STYLE,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  opacity: activeCategory ? 1 : 0.5,
                }}
              >
                <span aria-hidden style={{ fontSize: 22, minWidth: 24 }}>
                  {pickedSubtype ? SUBTYPE_EMOJI[pickedSubtype] : "📂"}
                </span>
                <select
                  id="shop-subtype"
                  value={subtype}
                  onChange={(e) => onSubtypeChange(e.currentTarget.value)}
                  disabled={!activeCategory}
                  style={{
                    ...SELECT_STYLE,
                    cursor: activeCategory ? "pointer" : "not-allowed",
                  }}
                >
                  <option value="" style={{ background: "#0A1526" }}>
                    {activeCategory ? "Select a subcategory…" : "Pick a category first"}
                  </option>
                  {activeSubtypes
                    // Hide the 3 generic buckets from the main browse
                    // list so "Other X" appears at the bottom as its
                    // own labelled fallback row.
                    .filter((s) => OTHER_BUSINESS_FALLBACK_SUBTYPE[BUSINESS_SUBTYPE_CATEGORY[s]] !== s)
                    .map((s) => (
                      <option key={s} value={s} style={{ background: "#0A1526" }}>
                        {SUBTYPE_EMOJI[s]} &nbsp;{BUSINESS_SUBTYPE_LABEL[s]}
                      </option>
                    ))}
                  {activeCategory
                    ? renderOtherOption(activeCategory)
                    : null}
                </select>
                {pickedSubtype ? (
                  <span
                    style={{
                      padding: "4px 10px",
                      fontSize: 9.5,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: GOLD,
                      background: "rgba(198, 161, 91, 0.12)",
                      border: "1px solid rgba(198, 161, 91, 0.55)",
                      borderRadius: 999,
                    }}
                  >
                    Picked
                  </span>
                ) : null}
              </div>
              <span style={HINT_STYLE}>
                Can&rsquo;t find your exact business?{" "}
                <Link
                  href={{
                    pathname: "/nex-native/manage/shop/setup/request-category",
                    query: activeCategory ? { category: activeCategory } : undefined,
                  }}
                  style={{ color: GOLD, fontWeight: 800 }}
                >
                  Request a category →
                </Link>
              </span>
            </div>
          </>
        ) : null}

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#FF6B6B",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!pickedSubtype || status.kind === "saving"}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: pickedSubtype && status.kind !== "saving" ? 1 : 0.5,
            cursor:
              pickedSubtype && status.kind !== "saving"
                ? "pointer"
                : "not-allowed",
            marginTop: 2,
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_MUTED,
          }}
        >
          Saved on nex_business.profile · editable from /manage/shop any time.
        </span>
      </form>
    </WizardShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function renderOtherOption(category: BusinessCategory): React.JSX.Element | null {
  const subtypeFallback = OTHER_BUSINESS_FALLBACK_SUBTYPE[category];
  if (subtypeFallback) {
    // Direct-save fallback (Food/Services/Products).
    return (
      <option value={subtypeFallback} style={{ background: "#0A1526" }}>
        ✳ &nbsp;Other {BUSINESS_CATEGORY_LABEL[category]} business…
      </option>
    );
  }
  if ((CATEGORIES_WITHOUT_OTHER_SUBTYPE as readonly string[]).includes(category)) {
    // Redirect-to-request fallback (Accommodation/Property).
    return (
      <option
        value={`__other__:${category}`}
        style={{ background: "#0A1526" }}
      >
        ✳ &nbsp;Other {BUSINESS_CATEGORY_LABEL[category]} business → request
      </option>
    );
  }
  return null;
}

function errorCopy(code: string): string {
  switch (code) {
    case "category-required":
      return "Please pick a category and subcategory before continuing.";
    case "unknown-category":
      return "That category isn't recognised. Try picking from the list.";
    case "unknown-subtype":
      return "That subcategory isn't recognised. Try picking from the list.";
    case "subtype-mismatch":
      return "The subcategory doesn't belong to that category. Please pick again.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    default:
      return code;
  }
}
