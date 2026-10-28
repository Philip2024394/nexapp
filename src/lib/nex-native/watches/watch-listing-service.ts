// src/lib/nex-native/watches/watch-listing-service.ts
//
// NEX Watches v1 · listing data-access service · server-only.
// ----------------------------------------------------------------------------
// Pairs with migrations:
//   · 227 · nex_watch_listing
//   · 228 · nex_watch_listing_entitlement
//   · 229 · watch_listing_directory_v (Option Y projection)
//   · 230 · nex_watch_listing.search_tsv + GIN
//
// Doctrine
//   · Payment doctrine amendment 2026-10-26 ·
//     docs/doctrine/nex-commerce-live-relationship-plan-2026-10-24.md §2.4a
//     (NEX collects its own listing fee only · never intermediates
//     buyer-seller marketplace payments.)
//   · G3 tile uniqueness amendment 2026-10-26 ·
//     docs/doctrine/nex-directory-tile-uniqueness-g3-amendment-2026-10-26.md
//     (one tile per shop + one tile per eligible paid individual
//     listing; eligibility = status='published' AND
//     entitlement_expires_at > now()).
//   · §8h withdrawal + sibling-table approach 2026-10-26 ·
//     owner_account_id NOT NULL, business_id NULL.
//
// Fail posture
//   · Writes · FAIL-CLOSED (throw with a stable code so the UI can map).
//   · Reads · FAIL-OPEN (return empty · log · let the UI render honestly).

import "server-only";
import { randomUUID } from "node:crypto";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  WATCH_LISTING_ENTITLEMENT_PENCE,
  WATCH_LISTING_ENTITLEMENT_CURRENCY,
  WATCH_LISTING_ENTITLEMENT_DAYS,
  formatIdrPence,
  LISTING_FEE_LABEL_IDR,
} from "./watch-listing-money";
import type {
  NexUuid,
  WatchListingStatus,
  WatchListingPricingMode,
  WatchListingEntitlementProvider,
  WatchListingRow,
  WatchDirectoryTile,
} from "./watch-listing-types";

// Public types live in `./watch-listing-types.ts` (safe for client +
// server) and are re-exported from this module below. The server-only
// guard above prevents the browser from importing anything else from
// here.

export type {
  NexUuid,
  WatchListingStatus,
  WatchListingPricingMode,
  WatchListingEntitlementProvider,
  WatchListingRow,
  WatchDirectoryTile,
};

/** Input to createWatchListing · creator supplies only the editable fields;
 *  server fills owner_account_id, status='draft', timestamps. */
export interface WatchListingDraftInput {
  readonly owner_account_id: NexUuid;
  readonly business_id?: NexUuid | null;
  readonly pricing_mode: WatchListingPricingMode;
  readonly price_pence?: number | null;
  readonly currency?: string;
  readonly brand: string;
  readonly brand_is_custom?: boolean;
  readonly model_name: string;
  readonly reference_number?: string | null;
  readonly watch_type: string;
  readonly movement: string;
  readonly case_diameter_mm?: number | null;
  readonly dial_color?: string | null;
  readonly strap_material?: string | null;
  readonly condition: string;
  readonly description?: string | null;
  readonly case_shape?: string | null;
  readonly case_material_category?: string | null;
  readonly crystal_material?: string | null;
  readonly clasp_type?: string | null;
  readonly water_resistance_m?: number | null;
  readonly bezel_style?: string | null;
  readonly dial_finish?: string | null;
  readonly hand_style?: string | null;
  readonly case_finish?: string | null;
  readonly style_audience?: string | null;
  readonly strap_interchangeability?: string | null;
  readonly lug_type?: string | null;
  readonly crown_position?: string | null;
  readonly case_size_category?: string | null;
  readonly authenticity?: string | null;
  readonly seller_type?: string | null;
  readonly shipping_scope?: string | null;
  readonly packaging_items?: readonly string[] | null;
  readonly availability?: string | null;
  readonly warranty_note?: string | null;
  readonly provenance_note?: string | null;
  readonly video_url?: string | null;
  readonly cover_image_url?: string | null;
  readonly gallery_image_urls?: readonly string[] | null;
}

/** Re-export the pure money helpers so callers can keep a single
 *  import surface at `watch-listing-service`. The authoritative
 *  definitions live in `./watch-listing-money.ts` and are safe for
 *  client-side use. */
export {
  WATCH_LISTING_ENTITLEMENT_PENCE,
  WATCH_LISTING_ENTITLEMENT_CURRENCY,
  WATCH_LISTING_ENTITLEMENT_DAYS,
  formatIdrPence,
  LISTING_FEE_LABEL_IDR,
};

// ─── Error class ────────────────────────────────────────────────────────────

export class WatchListingServiceError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "WatchListingServiceError";
    this.code = code;
    this.cause = cause;
  }
}

// ─── Writes · FAIL-CLOSED ───────────────────────────────────────────────────

/** Insert a draft listing. Status is pinned to 'draft'; the service
 *  layer refuses to let the caller set status directly. */
export async function createWatchListing(
  input: WatchListingDraftInput
): Promise<WatchListingRow> {
  if (!input.owner_account_id) {
    throw new WatchListingServiceError(
      "missing_owner",
      "owner_account_id is required"
    );
  }
  if (!input.brand.trim() || !input.model_name.trim()) {
    throw new WatchListingServiceError(
      "missing_identity",
      "brand and model_name are required"
    );
  }
  if (input.pricing_mode !== "chat") {
    if (input.price_pence == null || input.price_pence <= 0) {
      throw new WatchListingServiceError(
        "missing_price",
        "price_pence > 0 is required for non-chat pricing modes"
      );
    }
  }

  const row: Record<string, unknown> = {
    owner_account_id: input.owner_account_id,
    business_id: input.business_id ?? null,
    status: "draft",
    pricing_mode: input.pricing_mode,
    price_pence: input.price_pence ?? null,
    currency: (input.currency ?? "IDR").toUpperCase(),
    brand: input.brand.trim(),
    brand_is_custom: input.brand_is_custom ?? false,
    model_name: input.model_name.trim(),
    reference_number: input.reference_number ?? null,
    watch_type: input.watch_type,
    movement: input.movement,
    case_diameter_mm: input.case_diameter_mm ?? null,
    dial_color: input.dial_color ?? null,
    strap_material: input.strap_material ?? null,
    condition: input.condition,
    description: input.description ?? null,
    case_shape: input.case_shape ?? null,
    case_material_category: input.case_material_category ?? null,
    crystal_material: input.crystal_material ?? null,
    clasp_type: input.clasp_type ?? null,
    water_resistance_m: input.water_resistance_m ?? null,
    bezel_style: input.bezel_style ?? null,
    dial_finish: input.dial_finish ?? null,
    hand_style: input.hand_style ?? null,
    case_finish: input.case_finish ?? null,
    style_audience: input.style_audience ?? null,
    strap_interchangeability: input.strap_interchangeability ?? null,
    lug_type: input.lug_type ?? null,
    crown_position: input.crown_position ?? null,
    case_size_category: input.case_size_category ?? null,
    authenticity: input.authenticity ?? null,
    seller_type: input.seller_type ?? null,
    shipping_scope: input.shipping_scope ?? null,
    packaging_items: input.packaging_items ?? null,
    availability: input.availability ?? null,
    warranty_note: input.warranty_note ?? null,
    provenance_note: input.provenance_note ?? null,
    video_url: input.video_url ?? null,
    cover_image_url: input.cover_image_url ?? null,
    gallery_image_urls: input.gallery_image_urls ?? null,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    throw new WatchListingServiceError(
      "insert_failed",
      error?.message ?? "insert returned no row",
      error
    );
  }
  return data as WatchListingRow;
}

/** Grant an entitlement window to a listing. Writes a ledger row AND
 *  flips the listing to status='published' + sets entitlement_expires_at.
 *  Idempotent per internal_event_id · a retry with the same event_id
 *  returns the existing entitlement without side-effects. */
export async function grantWatchListingEntitlement(args: {
  readonly listingId: NexUuid;
  readonly internalEventId?: NexUuid;
  readonly provider?: WatchListingEntitlementProvider;
  readonly paymentReference?: string | null;
  readonly amountPence?: number;
  readonly currency?: string;
  readonly durationDays?: number;
  readonly notes?: string | null;
}): Promise<{
  readonly listing: WatchListingRow;
  readonly entitlementId: NexUuid;
  readonly windowEnd: string;
}> {
  const internalEventId = args.internalEventId ?? randomUUID();
  const provider = args.provider ?? "manual";
  const amountPence = args.amountPence ?? WATCH_LISTING_ENTITLEMENT_PENCE;
  const currency = (args.currency ?? WATCH_LISTING_ENTITLEMENT_CURRENCY).toUpperCase();
  const durationDays = args.durationDays ?? WATCH_LISTING_ENTITLEMENT_DAYS;

  // Idempotency check · if a row with this internal_event_id already
  // exists, return early without side-effects.
  {
    const { data: existing } = await nexSupabaseAdmin
      .from("nex_watch_listing_entitlement")
      .select("id, listing_id, window_end")
      .eq("internal_event_id", internalEventId)
      .maybeSingle();
    if (existing) {
      const current = await getWatchListingById(existing.listing_id as NexUuid);
      if (!current) {
        throw new WatchListingServiceError(
          "entitlement_listing_missing",
          "existing entitlement references a missing listing"
        );
      }
      return {
        listing: current,
        entitlementId: existing.id as NexUuid,
        windowEnd: existing.window_end as string,
      };
    }
  }

  // Read current entitlement_expires_at so we stack windows instead
  // of overlapping. Service-role (nexSupabaseAdmin) bypasses RLS so
  // this read sees the row regardless of its current status.
  const { data: listingBefore, error: readErr } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .select("id, owner_account_id, entitlement_expires_at, status, removed_at")
    .eq("id", args.listingId)
    .maybeSingle();
  if (readErr || !listingBefore) {
    throw new WatchListingServiceError(
      "listing_not_found",
      `listing ${args.listingId} not found`,
      readErr
    );
  }
  if (listingBefore.status === "removed") {
    throw new WatchListingServiceError(
      "listing_removed",
      "cannot grant entitlement to a removed listing"
    );
  }

  const nowMs = Date.now();
  const priorExpiresMs = listingBefore.entitlement_expires_at
    ? Date.parse(listingBefore.entitlement_expires_at)
    : NaN;
  const windowStartMs = Number.isFinite(priorExpiresMs) && priorExpiresMs > nowMs
    ? priorExpiresMs
    : nowMs;
  const windowEndMs = windowStartMs + durationDays * 24 * 60 * 60 * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const windowEnd = new Date(windowEndMs).toISOString();

  // Insert the entitlement ledger row.
  const { data: ent, error: entErr } = await nexSupabaseAdmin
    .from("nex_watch_listing_entitlement")
    .insert({
      listing_id: args.listingId,
      owner_account_id: listingBefore.owner_account_id,
      internal_event_id: internalEventId,
      provider,
      payment_reference: args.paymentReference ?? null,
      window_start: windowStart,
      window_end: windowEnd,
      amount_pence: amountPence,
      currency,
      notes: args.notes ?? null,
    })
    .select("id")
    .single();
  if (entErr || !ent) {
    throw new WatchListingServiceError(
      "entitlement_insert_failed",
      entErr?.message ?? "entitlement insert returned no row",
      entErr
    );
  }

  // Flip the listing to published + extend the window.
  const nowIso = new Date(nowMs).toISOString();
  const { data: listingAfter, error: updateErr } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .update({
      status: "published",
      published_at: listingBefore.status === "published"
        ? undefined
        : nowIso,
      entitlement_expires_at: windowEnd,
    })
    .eq("id", args.listingId)
    .select("*")
    .single();
  if (updateErr || !listingAfter) {
    throw new WatchListingServiceError(
      "listing_update_failed",
      updateErr?.message ?? "listing update returned no row",
      updateErr
    );
  }

  return {
    listing: listingAfter as WatchListingRow,
    entitlementId: ent.id as NexUuid,
    windowEnd,
  };
}

/** Soft-remove a listing · status='removed', removed_at=now(). */
export async function softRemoveWatchListing(args: {
  readonly listingId: NexUuid;
  readonly ownerAccountId: NexUuid;
}): Promise<WatchListingRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", args.listingId)
    .eq("owner_account_id", args.ownerAccountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new WatchListingServiceError(
      "remove_failed",
      error?.message ?? "no matching listing to remove",
      error
    );
  }
  return data as WatchListingRow;
}

// ─── Reads · FAIL-OPEN ──────────────────────────────────────────────────────

export async function getWatchListingById(
  id: NexUuid
): Promise<WatchListingRow | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_watch_listing")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as WatchListingRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Public listing by id · null unless status=published and within
 *  the entitlement window. Used by the public listing route. */
export async function getPublicWatchListingById(
  id: NexUuid
): Promise<WatchListingRow | null> {
  const row = await getWatchListingById(id);
  if (!row) return null;
  if (row.status !== "published") return null;
  if (!row.entitlement_expires_at) return null;
  if (Date.parse(row.entitlement_expires_at) <= Date.now()) return null;
  return row;
}

export async function listMyWatchListings(args: {
  readonly ownerAccountId: NexUuid;
  readonly limit?: number;
}): Promise<readonly WatchListingRow[]> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_watch_listing")
      .select("*")
      .eq("owner_account_id", args.ownerAccountId)
      .order("created_at", { ascending: false })
      .limit(args.limit ?? 50);
    if (error) return [];
    return (data as readonly WatchListingRow[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Public directory tiles via the Option Y view. Fail-open. */
export async function listPublicDirectoryTiles(args: {
  readonly limit?: number;
  readonly offset?: number;
}): Promise<readonly WatchDirectoryTile[]> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("watch_listing_directory_v")
      .select("*")
      .order("entitlement_expires_at", { ascending: false })
      .range(
        args.offset ?? 0,
        (args.offset ?? 0) + (args.limit ?? 20) - 1
      );
    if (error) return [];
    return (data as readonly WatchDirectoryTile[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Real text search via tsvector + GIN (Migration 230). Fail-open.
 *  Also returns an empty array for empty / whitespace-only queries. */
export async function searchPublicWatchListings(args: {
  readonly query: string;
  readonly limit?: number;
}): Promise<readonly WatchDirectoryTile[]> {
  const q = args.query.trim();
  if (!q) return [];
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_watch_listing")
      .select(
        [
          "id",
          "brand",
          "model_name",
          "reference_number",
          "description",
          "cover_image_url",
          "price_pence",
          "currency",
          "pricing_mode",
          "business_id",
          "owner_account_id",
          "published_at",
          "entitlement_expires_at",
        ].join(",")
      )
      .eq("status", "published")
      .gt("entitlement_expires_at", nowIso)
      .textSearch("search_tsv", q, { config: "simple", type: "websearch" })
      .order("entitlement_expires_at", { ascending: false })
      .limit(args.limit ?? 20);
    if (error || !data) return [];
    return (data as unknown as readonly {
      id: NexUuid;
      brand: string;
      model_name: string;
      reference_number: string | null;
      description: string | null;
      cover_image_url: string | null;
      price_pence: number | null;
      currency: string;
      pricing_mode: WatchListingPricingMode;
      business_id: NexUuid | null;
      owner_account_id: NexUuid;
      published_at: string | null;
      entitlement_expires_at: string | null;
    }[]).map((r) => ({
      id: r.id,
      slug: `watch-${r.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${r.id.slice(0, 8)}`,
      title: `${r.brand} ${r.model_name}`,
      category_label: "Watches",
      category_id: "watches",
      category_accent: "#C8A24B",
      category_icon_col: 3 as const,
      category_icon_row: 1 as const,
      image_url: r.cover_image_url,
      description: r.description?.trim() || r.reference_number || null,
      featured_offering: r.model_name,
      city: null,
      href: `/nex-native/watches/${r.id}`,
      source: "watch_listing" as const,
      price_pence: r.price_pence,
      currency: r.currency,
      pricing_mode: r.pricing_mode,
      business_id: r.business_id,
      owner_account_id: r.owner_account_id,
      published_at: r.published_at,
      entitlement_expires_at: r.entitlement_expires_at,
    }));
  } catch {
    return [];
  }
}

// Pure helpers are defined in `./watch-listing-money.ts` and re-exported
// above. Keeping them in a separate module lets client components +
// vitest import them without triggering the `server-only` guard.
