// src/lib/nex-native/safe-trade-status.ts
//
// Safe Trade status · per-business trade-safety signal shown on
// NEX Discover shop cards and on business profile pages.
// ----------------------------------------------------------------
// Four possible states for the viewer:
//
//   NEW          · claimed account · 0 completed trades on NEX
//   VERIFIED     · claimed + ≥1 completed trade + 0 open disputes
//   FLAGGED      · 1+ open dispute · buyer caution
//   SUSPENDED    · trading paused by NEX moderation · do not transact
//   UNCLAIMED    · directory listing · no owner_account_id → there is
//                  no NEX trade history to show (not a seller yet)
//
// This module is intentionally honest-null: NEX does NOT yet have a
// disputes / complaints table, so for every business today the
// resolver returns UNCLAIMED (when owner_account_id is empty) or
// NEW (when claimed). Counts are returned as null until the
// complaint-tracking schema lands · the UI already handles that
// cleanly ("No disputes recorded yet" vs "0 open disputes").
//
// When the complaint-tracking schema lands:
//   1. Add a new table (e.g. nex_business_dispute) with status +
//      opened_at + resolved_at + canonical_business_id OR
//      business_id.
//   2. Replace the two `null`s below with real counts.
//   3. Promote statuses based on the thresholds in STATUS_RULES.
// The service signature stays stable so the UI never has to change.

import type { NexBusinessRow } from "./types";

export type SafeTradeStatus =
  | "UNCLAIMED"
  | "NEW"
  | "VERIFIED"
  | "FLAGGED"
  | "SUSPENDED";

/** Variant · drives the Safe Trade sheet's copy flavor.
 *  · "trade" — sealed product-seller version (shipping risk + escrow)
 *  · "meal"  — restaurant / food-vertical (hygiene + verified premises)
 *  · "stay"  — accommodation (verified premises + guest reports +
 *              nights booked). All three share the same 4-state
 *              badge, same shield icon, same resolver — only copy +
 *              stat cell labels differ. */
export type SafeTradeVariant = "trade" | "meal" | "stay";

export interface SafeTradeSnapshot {
  readonly status: SafeTradeStatus;
  readonly variant: SafeTradeVariant;
  /** Completed trades / meals served on NEX. null when the counter is
   *  not yet implemented · the UI should NOT render a "0" when null. */
  readonly completedTrades: number | null;
  /** Currently-open disputes on NEX. null when the counter is not
   *  yet implemented. */
  readonly openDisputes: number | null;
  /** ISO 8601 or null · when the account started trading on NEX.
   *  Shown as "On NEX since …" in the sheet. */
  readonly tradingSince: string | null;
  /** Short one-line summary · stable regardless of count resolution. */
  readonly summary: string;
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

// Accommodation vertical · directory canonical rows get
// `entity_type = "accommodation"`, and claimed Supabase businesses
// typically carry a specific hotel/villa/guesthouse category. The
// adapter in `local-directory-service.ts` sets business_category to
// `entity_type` so "accommodation" matches here. Keep this set in
// sync with any future accommodation subcategories.
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

/** Resolve a Safe Trade snapshot for a business row. Pure as of
 *  today · never throws · never hits the network. Variant is derived
 *  from the business category (food → "meal", everything else →
 *  "trade"). */
export function resolveSafeTradeStatus(row: NexBusinessRow): SafeTradeSnapshot {
  const cat = row.business_category ?? null;
  const variant: SafeTradeVariant =
    cat && STAY_CATEGORIES.has(cat)
      ? "stay"
      : cat && FOOD_CATEGORIES.has(cat)
        ? "meal"
        : "trade";
  const hasOwner =
    typeof row.owner_account_id === "string" && row.owner_account_id.length > 0;
  if (!hasOwner) {
    return {
      status: "UNCLAIMED",
      variant,
      completedTrades: null,
      openDisputes: null,
      tradingSince: null,
      summary:
        variant === "meal"
          ? "Directory listing · restaurant has not joined NEX yet"
          : variant === "stay"
            ? "Directory listing · property has not joined NEX yet"
            : "Directory listing · owner has not joined NEX yet",
    };
  }
  return {
    status: "NEW",
    variant,
    completedTrades: null,
    openDisputes: null,
    tradingSince: row.created_at ?? null,
    summary:
      variant === "meal"
        ? "New on NEX · no served meals yet"
        : variant === "stay"
          ? "New on NEX · no guest stays yet"
          : "New on NEX · no completed trades yet",
  };
}

export interface SafeTradePresentation {
  readonly label: string;
  readonly tone: "neutral" | "verified" | "warn" | "danger";
  readonly dotColor: string;
  readonly ringColor: string;
  readonly description: string;
}

export interface SafeTradeVariantCopy {
  readonly header: string; // "Safe Trade" vs "Safe Meal"
  readonly completedLabel: string; // "Completed trades" vs "Meals served"
  readonly openDisputesLabel: string; // "Open disputes" vs "Open complaints"
  readonly ruleHeadline: string;
  readonly ruleBody: string;
}

export const SAFE_TRADE_COPY: Record<SafeTradeVariant, SafeTradeVariantCopy> = {
  trade: {
    header: "Safe Trade",
    completedLabel: "Completed trades",
    openDisputesLabel: "Open disputes",
    ruleHeadline: "NEX safe-trade rule:",
    ruleBody:
      "We always recommend Cash on Delivery (COD) or a safe payment service — PayPal, escrow, or Stripe — that holds the money until the goods are delivered. Keep conversations on NEX so moderators can step in if anything goes wrong.",
  },
  meal: {
    header: "Safe Meal",
    completedLabel: "Meals served on NEX",
    openDisputesLabel: "Open complaints",
    ruleHeadline: "NEX safe-meal rule:",
    ruleBody:
      "Prefer eat-in or verified-premises restaurants, and pay on arrival or on delivery. Ask about allergens before you order. Keep all messages inside NEX so moderators can help if something goes wrong with your order.",
  },
  stay: {
    header: "Safe Stay",
    completedLabel: "Nights booked on NEX",
    openDisputesLabel: "Open guest reports",
    ruleHeadline: "NEX safe-stay rule:",
    ruleBody:
      "Confirm your dates and the total price in chat with the owner before you pay. Prefer verified-premises properties (someone from NEX has been there) and keep all deposits and bookings on NEX so moderators can step in if the stay is misrepresented when you arrive.",
  },
};

export const SAFE_TRADE_PRESENTATION: Record<SafeTradeStatus, SafeTradePresentation> = {
  UNCLAIMED: {
    label: "Unclaimed",
    tone: "neutral",
    dotColor: "#6B82A5",
    ringColor: "rgba(107,130,165,0.5)",
    description:
      "This is a directory listing. The owner has not joined NEX yet, so there is no NEX trade history to show. Treat as unverified · do not pay before meeting in person.",
  },
  NEW: {
    label: "New seller",
    tone: "neutral",
    dotColor: "#00AFFF",
    ringColor: "rgba(0,175,255,0.55)",
    description:
      "This seller has joined NEX but has no completed trades yet. New sellers are honest · they just don't have a track record. Follow NEX safe-trade rules (never pay before receiving · use a trusted escrow for high-value items).",
  },
  VERIFIED: {
    label: "Trusted seller",
    tone: "verified",
    dotColor: "#16D66B",
    ringColor: "rgba(22,214,107,0.55)",
    description:
      "This seller has completed trades on NEX with no open disputes. Keep communication on NEX · payments outside NEX are not covered.",
  },
  FLAGGED: {
    label: "Caution",
    tone: "warn",
    dotColor: "#FF7200",
    ringColor: "rgba(255,114,0,0.55)",
    description:
      "This seller has open dispute(s) that are being reviewed by NEX moderators. Take extra care · prefer in-person pickup and only pay after you have the item in hand.",
  },
  SUSPENDED: {
    label: "Trading paused",
    tone: "danger",
    dotColor: "#C94A4A",
    ringColor: "rgba(201,74,74,0.55)",
    description:
      "NEX has paused this seller's trading pending review. Do not send money or share personal information with this account.",
  },
};
