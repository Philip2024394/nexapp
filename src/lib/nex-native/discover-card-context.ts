// src/lib/nex-native/discover-card-context.ts
//
// Batch resolver · hero image + lowest live product price per business.
// --------------------------------------------------------------------
// NEX Discover cards show:
//   · a cover photo (hero image taken from the first live product's
//     image_url when no logo-cover exists on nex_business itself)
//   · a "from Rp N" chip when the business has priced products
//
// Doing these naïvely would be 24 round-trips per page. This helper
// does ONE round-trip for all business ids on the page: it fetches
// `nex_product` rows for the given business ids, groups them, picks
// the first image per business and the minimum live price per
// business. Everything is honest-null: a business with no products
// returns `{ heroImageUrl: null, minPricePence: null, currency: null }`.
//
// Non-fatal on failure: the resolver returns an empty Map, the UI
// falls back to the category gradient + no price chip.

import { nexSupabaseAdmin } from "./supabase-admin";

export interface DiscoverCardPromo {
  readonly id: string;
  readonly position: 1 | 2 | 3;
  readonly title: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly backgroundHex: string | null;
  readonly expiresAt: string;
}

export interface DiscoverCardMenuItem {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number | null;
  readonly currency: string | null;
  readonly imageUrl: string | null;
}

export interface DiscoverCardContext {
  readonly heroImageUrl: string | null;
  readonly minPricePence: number | null;
  readonly currency: string | null;
  /** Max spice_level across the business's live menu items · 0..3.
   *  null when the business has no menu items (not just no-spice). */
  readonly maxSpiceLevel: number | null;
  /** Up to 3 active promos · ordered by position asc. Empty when the
   *  business has no active promos. */
  readonly promos: readonly DiscoverCardPromo[];
  /** Up to 3 available menu items ordered by lowest price · drives
   *  the menu-preview strip on food cards. Empty when the business
   *  has no live menu. */
  readonly menuPreview: readonly DiscoverCardMenuItem[];
}

const EMPTY_CTX: DiscoverCardContext = {
  heroImageUrl: null,
  minPricePence: null,
  currency: null,
  maxSpiceLevel: null,
  promos: [],
  menuPreview: [],
};

/** One batch call · returns a Map keyed by business_id. Business ids
 *  with no live products are NOT present in the Map (callers can
 *  default to EMPTY_CTX via `.get(id) ?? EMPTY_CTX`). */
export async function fetchDiscoverCardContext(
  businessIds: readonly string[],
): Promise<Map<string, DiscoverCardContext>> {
  const result = new Map<string, DiscoverCardContext>();
  const ids = businessIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return result;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_product")
      .select("business_id, image_url, gallery_urls, price_pence, currency, status, created_at")
      .in("business_id", ids)
      .in("status", ["live", "active", "published"])
      .order("created_at", { ascending: false });
    if (error || !data) return result;
    for (const row of data as ReadonlyArray<{
      business_id: string;
      image_url: string | null;
      gallery_urls: string[] | null;
      price_pence: number | null;
      currency: string | null;
    }>) {
      const existing = result.get(row.business_id) ?? EMPTY_CTX;
      const galleryFirst =
        Array.isArray(row.gallery_urls) && row.gallery_urls.length > 0
          ? row.gallery_urls[0]
          : null;
      const img = existing.heroImageUrl ?? row.image_url ?? galleryFirst ?? null;
      const price =
        typeof row.price_pence === "number" && row.price_pence > 0
          ? existing.minPricePence === null
            ? row.price_pence
            : Math.min(existing.minPricePence, row.price_pence)
          : existing.minPricePence;
      const currency = existing.currency ?? row.currency ?? null;
      result.set(row.business_id, {
        heroImageUrl: img,
        minPricePence: price,
        currency,
        maxSpiceLevel: existing.maxSpiceLevel,
        promos: existing.promos,
        menuPreview: existing.menuPreview,
      });
    }
  } catch {
    // Non-fatal · return whatever we already resolved (or empty).
  }

  // Top 3 cheapest available menu items per business · drives the
  // menu-preview strip. Non-fatal · silent on error.
  try {
    const { data: menu } = await nexSupabaseAdmin
      .from("nex_menu_item")
      .select("id, business_id, name, price_pence, currency, image_url, is_available, status")
      .in("business_id", ids)
      .eq("is_available", true)
      .not("price_pence", "is", null)
      .order("price_pence", { ascending: true })
      .limit(300); // pool big enough to cover 24 restaurants × ~12 items
    if (Array.isArray(menu)) {
      const byBusiness = new Map<string, DiscoverCardMenuItem[]>();
      for (const r of menu as ReadonlyArray<{
        id: string;
        business_id: string;
        name: string;
        price_pence: number | null;
        currency: string | null;
        image_url: string | null;
      }>) {
        const list = byBusiness.get(r.business_id) ?? [];
        if (list.length >= 6) continue;
        list.push({
          id: r.id,
          name: r.name,
          pricePence: r.price_pence,
          currency: r.currency,
          imageUrl: r.image_url,
        });
        byBusiness.set(r.business_id, list);
      }
      for (const [bid, items] of byBusiness) {
        const existing = result.get(bid) ?? EMPTY_CTX;
        result.set(bid, { ...existing, menuPreview: items });
      }
    }
  } catch {
    // Non-fatal.
  }

  // Max spice per business (food menu items). Separate call to keep
  // the main product join simple. Non-fatal · silent on error.
  try {
    const { data: spice } = await nexSupabaseAdmin
      .from("nex_menu_item")
      .select("business_id, spice_level")
      .in("business_id", ids)
      .not("spice_level", "is", null);
    if (Array.isArray(spice)) {
      const spiceMax = new Map<string, number>();
      for (const r of spice as ReadonlyArray<{
        business_id: string;
        spice_level: number;
      }>) {
        const prev = spiceMax.get(r.business_id) ?? -1;
        if (typeof r.spice_level === "number" && r.spice_level > prev) {
          spiceMax.set(r.business_id, r.spice_level);
        }
      }
      for (const [bid, lvl] of spiceMax) {
        const existing = result.get(bid) ?? EMPTY_CTX;
        result.set(bid, { ...existing, maxSpiceLevel: lvl });
      }
    }
  } catch {
    // Non-fatal.
  }

  // Active promos per business · ordered by position. Honest-null
  // when the table isn't yet applied (migration 159) — PostgREST
  // returns an error that we swallow.
  try {
    const { data: promos } = await nexSupabaseAdmin
      .from("nex_business_promo")
      .select(
        "id, business_id, position, title, description, image_url, background_hex, expires_at",
      )
      .in("business_id", ids)
      .gt("expires_at", new Date().toISOString())
      .order("position", { ascending: true });
    if (Array.isArray(promos)) {
      const byBusiness = new Map<string, DiscoverCardPromo[]>();
      for (const p of promos as ReadonlyArray<{
        id: string;
        business_id: string;
        position: 1 | 2 | 3;
        title: string;
        description: string | null;
        image_url: string | null;
        background_hex: string | null;
        expires_at: string;
      }>) {
        const slot: DiscoverCardPromo = {
          id: p.id,
          position: p.position,
          title: p.title,
          description: p.description,
          imageUrl: p.image_url,
          backgroundHex: p.background_hex,
          expiresAt: p.expires_at,
        };
        const list = byBusiness.get(p.business_id) ?? [];
        list.push(slot);
        byBusiness.set(p.business_id, list);
      }
      for (const [bid, list] of byBusiness) {
        const existing = result.get(bid) ?? EMPTY_CTX;
        result.set(bid, { ...existing, promos: list });
      }
    }
  } catch {
    // Non-fatal · migration 159 may not yet be applied.
  }

  return result;
}

/** Format a price_pence + currency into a short display string.
 *  Pence here means the smallest unit for the given currency (sen for
 *  IDR = already whole rupiah units in NEX convention; cents for USD;
 *  pence for GBP). Pure. */
export function formatMinPrice(
  pence: number | null,
  currency: string | null,
): string | null {
  if (pence === null || pence <= 0) return null;
  const cur = (currency ?? "IDR").toUpperCase();
  // Currencies where price_pence is already whole-unit (no decimal
  // conversion needed). IDR cents are rupiah in NEX storage.
  const noDecimal = cur === "IDR" || cur === "JPY" || cur === "KRW" || cur === "VND";
  const whole = noDecimal ? pence : pence / 100;
  // Compact rendering for large IDR values · "25k" / "1.2M".
  if (noDecimal && whole >= 1_000_000) {
    const m = whole / 1_000_000;
    return `From ${symbolForCurrency(cur)}${m.toFixed(m >= 10 ? 0 : 1)}M`;
  }
  if (noDecimal && whole >= 1000) {
    const k = whole / 1000;
    return `From ${symbolForCurrency(cur)}${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  if (noDecimal) {
    return `From ${symbolForCurrency(cur)}${whole.toLocaleString("en-US")}`;
  }
  return `From ${symbolForCurrency(cur)}${whole.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function symbolForCurrency(cur: string): string {
  switch (cur) {
    case "IDR":
      return "Rp ";
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "SGD":
      return "S$";
    case "MYR":
      return "RM ";
    case "AUD":
      return "A$";
    case "JPY":
      return "¥";
    default:
      return `${cur} `;
  }
}

/** Approximate FX rates relative to 1 USD · frozen table so the hint
 *  renders deterministically without a network call. Treat as rough
 *  guidance for international viewers · the UI MUST label the result
 *  as approximate (`~$160 USD`) so users know to double-check. Update
 *  the table when drift becomes material. */
const USD_RATES: Record<string, number> = {
  USD: 1,
  IDR: 15500,
  GBP: 0.79,
  EUR: 0.92,
  SGD: 1.35,
  MYR: 4.5,
  AUD: 1.52,
  JPY: 148,
  VND: 24500,
  THB: 36,
  PHP: 55,
};

/** Convert a pence-amount into a short "~$160 USD" hint for a
 *  foreign viewer. Returns null when the source + target currencies
 *  match or when either rate is unknown. */
export function formatPriceInViewerCurrency(
  pence: number | null,
  sourceCurrency: string | null,
  viewerCountryIso: string | null,
): string | null {
  if (pence === null || pence <= 0) return null;
  const src = (sourceCurrency ?? "IDR").toUpperCase();
  const target = viewerCurrencyForCountry(viewerCountryIso);
  if (target === null || target === src) return null;
  const srcRate = USD_RATES[src];
  const tgtRate = USD_RATES[target];
  if (!srcRate || !tgtRate) return null;
  // Source pence → source whole → USD → target whole.
  const srcNoDecimal = src === "IDR" || src === "JPY" || src === "KRW" || src === "VND";
  const srcWhole = srcNoDecimal ? pence : pence / 100;
  const usd = srcWhole / srcRate;
  const target_whole = usd * tgtRate;
  if (target_whole < 0.01) return null;
  const noDecimal = target === "IDR" || target === "JPY" || target === "KRW" || target === "VND";
  const rounded = noDecimal
    ? Math.round(target_whole)
    : Math.round(target_whole * 100) / 100;
  if (noDecimal && rounded >= 1_000_000) {
    return `~${symbolForCurrency(target)}${(rounded / 1_000_000).toFixed(1)}M ${target}`;
  }
  if (noDecimal && rounded >= 1000) {
    return `~${symbolForCurrency(target)}${(rounded / 1000).toFixed(1)}k ${target}`;
  }
  return `~${symbolForCurrency(target)}${rounded.toLocaleString("en-US", {
    minimumFractionDigits: noDecimal ? 0 : 2,
    maximumFractionDigits: noDecimal ? 0 : 2,
  })} ${target}`;
}

function viewerCurrencyForCountry(iso: string | null): string | null {
  if (!iso) return null;
  const u = iso.toUpperCase();
  const map: Record<string, string> = {
    ID: "IDR",
    US: "USD",
    GB: "GBP",
    DE: "EUR",
    FR: "EUR",
    ES: "EUR",
    IT: "EUR",
    NL: "EUR",
    SG: "SGD",
    MY: "MYR",
    AU: "AUD",
    NZ: "AUD",
    JP: "JPY",
    VN: "VND",
    TH: "THB",
    PH: "PHP",
    CA: "USD",
    AE: "USD",
    IN: "USD",
    KR: "USD",
  };
  return map[u] ?? null;
}
