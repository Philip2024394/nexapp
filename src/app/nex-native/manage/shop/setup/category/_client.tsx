"use client";

// src/app/nex-native/manage/shop/setup/category/_client.tsx
//
// Shop Setup · Step 3 · Category client.
// Owner-authorised 2026-11-06 · Rev 6 dropdown rework 2026-11-07.
// Simplified picker 2026-11-07 · owner directive: "we need simple ·
// drop down select your category of business all listed with add
// other and they subcategory list drop down and also add other".
// -----------------------------------------------------------------------------
// Two dropdowns · no search · no browse-collapse chrome.
//   · Business category · 5 options + Other (→ request flow)
//   · Subcategory       · filtered to chosen category + Other
//       · Food/Services/Products Other = saves the generic bucket
//         relabelled "Other …" (food_maker / creative / retail)
//       · Accommodation/Property Other = redirects to request flow
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

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_MUTED = "#7D9BC0";

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

// Shared select style · transparent chrome so the SURFACE_CARD_STYLE
// wrapper provides the visible border + background. Matches the
// Location step dropdown exactly.
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

// Sentinel value for the "Other" row in the category dropdown. Picking
// it redirects to the request-a-category flow (there's no "Other"
// category to save · all 5 categories cover the taxonomy).
const CATEGORY_OTHER = "__other_category__";

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

  const activeCategory: BusinessCategory | null =
    (BUSINESS_CATEGORIES as readonly string[]).includes(category)
      ? (category as BusinessCategory)
      : null;
  const activeSubtypes = activeCategory ? subtypesByCategory(activeCategory) : [];
  const pickedSubtype: BusinessSubtype | null =
    activeCategory && (activeSubtypes as readonly string[]).includes(subtype)
      ? (subtype as BusinessSubtype)
      : null;

  function onCategoryChange(next: string) {
    if (next === CATEGORY_OTHER) {
      router.push("/nex-native/manage/shop/setup/request-category");
      return;
    }
    setCategory(next);
    // Reset subtype when category changes · prevents a stale slug
    // from a previous category persisting through save.
    setSubtype("");
  }

  function onSubtypeChange(next: string) {
    // Redirect-to-request fallback (Accommodation/Property Other).
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
      stepLead="Pick your business category, then the specific type."
      backHref="/nex-native/manage/shop/setup/location"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Business category dropdown. */}
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
              <option value={CATEGORY_OTHER} style={{ background: "#0A1526" }}>
                ✳ &nbsp;Other → request a category
              </option>
            </select>
          </div>
          <span style={HINT_STYLE}>
            {activeCategory
              ? BUSINESS_CATEGORY_BLURB[activeCategory]
              : "Pick the family that best fits your shop."}
          </span>
        </div>

        {/* Subcategory dropdown · filtered to the chosen category. */}
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
                // Hide the generic bucket from the main list so its
                // relabelled "Other …" row appears cleanly at the end.
                .filter(
                  (s) =>
                    OTHER_BUSINESS_FALLBACK_SUBTYPE[BUSINESS_SUBTYPE_CATEGORY[s]] !== s,
                )
                .map((s) => (
                  <option key={s} value={s} style={{ background: "#0A1526" }}>
                    {SUBTYPE_EMOJI[s]} &nbsp;{BUSINESS_SUBTYPE_LABEL[s]}
                  </option>
                ))}
              {activeCategory ? renderOtherOption(activeCategory) : null}
            </select>
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
