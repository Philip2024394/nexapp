// src/lib/nex-native/accommodation-service.ts
//
// Phase A1 · Accommodation listing service (owner-authorised 2026-10-21).
// -----------------------------------------------------------------------
// CRUD + list functions for nex_accommodation_unit (migration 213).
// Mirrors nex_menu_service shape (Bridge 15a) and nex_product_service.
// Rooms are a distinct primitive from products so accommodation
// doesn't inherit fields (SKU · dispatch time · variants) that don't
// apply, but shares the lifecycle (status enum + is_available boolean).
//
// Doctrine kept:
//   · Chat is still the enquiry path · this service ships browsing +
//     display + owner management · never a booking engine.
//   · "NEX never handles payments" · price_per_night_pence is a display
//     price · never transacted · owners negotiate per enquiry in chat.
//   · Sellers control everything · no auto-generation of rooms.
//   · Availability toggle is separate from status · "booked tonight"
//     is not the same as "archived from listing."
//   · Phase A1 release stays on HOLD until this service is proven
//     end-to-end against an isolated local DB (not under this
//     author-only authorisation).
//
// Vocabularies (amenities, bed types) are stored as text[] with
// normalisation on write (lowercase-hyphen) so the renderer can show
// consistent chip labels without extra mapping.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

/* ------------------------------------------------------------------
 * Canonical vocabularies · the seller UI presents these as toggles
 * but the DB stays flexible for future additions. Normalised to
 * lowercase-hyphen on write.
 * ------------------------------------------------------------------ */

export const NEX_ACCOMMODATION_AMENITIES = [
  "wi-fi",
  "kitchen",
  "air-con",
  "hot-water",
  "pool",
  "parking",
  "bbq",
  "washing-machine",
  "tv",
  "garden",
  "breakfast",
  "pet-friendly",
  "work-space",
  "security",
] as const;

export type NexAccommodationAmenity =
  (typeof NEX_ACCOMMODATION_AMENITIES)[number];

/** Normalise a raw amenity string to the lowercase-hyphen vocabulary.
 *  Reject whitespace-only strings. Trim and collapse internal spaces
 *  to single hyphens. Doesn't force the string to be in the canonical
 *  vocabulary (the DB is deliberately flexible per migration 213 doc).
 */
export function normaliseAmenity(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  const collapsed = trimmed.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (collapsed.length === 0) return null;
  if (collapsed.length > 64) return collapsed.slice(0, 64);
  return collapsed;
}

/* ------------------------------------------------------------------
 * Row + Insert types · mirror the migration 213 column shape
 * ------------------------------------------------------------------ */

export type NexAccommodationUnitStatus = "draft" | "live" | "archived";

export const NEX_ACCOMMODATION_UNIT_STATUSES: readonly NexAccommodationUnitStatus[] = [
  "draft",
  "live",
  "archived",
] as const;

export interface NexAccommodationUnitRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  description: string | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  price_per_night_pence: number | null;
  currency: string;
  image_url: string | null;
  gallery_urls: string[];
  status: NexAccommodationUnitStatus;
  is_available: boolean;
  sort_order: number;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexAccommodationUnitInsert {
  business_id: NexUuid;
  name: string;
  description?: string | null;
  capacity?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  price_per_night_pence?: number | null;
  currency?: string;
  image_url?: string | null;
  gallery_urls?: string[];
  status?: NexAccommodationUnitStatus;
  is_available?: boolean;
  sort_order?: number;
}

export interface NexAccommodationUnitPatch {
  name?: string;
  description?: string | null;
  capacity?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  price_per_night_pence?: number | null;
  currency?: string;
  image_url?: string | null;
  gallery_urls?: string[];
  sort_order?: number;
}

/* ------------------------------------------------------------------
 * Validators · defensive bounds matching migration 213 CHECKs so we
 * fail fast at the service boundary rather than relying on DB errors.
 * ------------------------------------------------------------------ */

function assertRoomInput(input: {
  name: string;
  description?: string | null;
  capacity?: number;
  bedrooms?: number;
  bathrooms?: number;
  price_per_night_pence?: number | null;
  currency?: string;
  gallery_urls?: string[];
}): void {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error(
      "accommodation-service.assertRoomInput: name must be 1-120 chars",
    );
  }
  if (
    input.description !== undefined &&
    input.description !== null &&
    input.description.length > 2000
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: description must be ≤2000 chars",
    );
  }
  if (
    input.capacity !== undefined &&
    (input.capacity < 1 || input.capacity > 50)
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: capacity must be 1-50",
    );
  }
  if (
    input.bedrooms !== undefined &&
    (input.bedrooms < 0 || input.bedrooms > 20)
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: bedrooms must be 0-20",
    );
  }
  if (
    input.bathrooms !== undefined &&
    (input.bathrooms < 0 || input.bathrooms > 20)
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: bathrooms must be 0-20",
    );
  }
  if (
    input.price_per_night_pence !== undefined &&
    input.price_per_night_pence !== null &&
    input.price_per_night_pence < 0
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: price_per_night_pence must be ≥0 (NEX never transacts · display only)",
    );
  }
  if (input.currency !== undefined && input.currency.length !== 3) {
    throw new Error(
      "accommodation-service.assertRoomInput: currency must be ISO 4217 (3 chars)",
    );
  }
  if (
    input.gallery_urls !== undefined &&
    input.gallery_urls.length > 10
  ) {
    throw new Error(
      "accommodation-service.assertRoomInput: gallery_urls max 10 entries",
    );
  }
}

/* ------------------------------------------------------------------
 * CRUD operations
 * ------------------------------------------------------------------ */

/** Create a new room. Owner-only enforcement is the caller's
 *  responsibility (manage/accommodation/_actions.ts verifies the owner
 *  owns business_id BEFORE calling into this function). The RLS policy
 *  on nex_accommodation_unit is a defence-in-depth layer. */
export async function createRoom(
  input: NexAccommodationUnitInsert,
): Promise<NexAccommodationUnitRow> {
  assertRoomInput({
    name: input.name,
    description: input.description,
    capacity: input.capacity,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    price_per_night_pence: input.price_per_night_pence,
    currency: input.currency,
    gallery_urls: input.gallery_urls,
  });

  // Normalise amenities before insert · keep DB values consistent.
  const amenities = (input.amenities ?? [])
    .map(normaliseAmenity)
    .filter((v): v is string => v !== null);

  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .insert({
      business_id: input.business_id,
      name: input.name.trim(),
      description: input.description ?? null,
      capacity: input.capacity ?? 2,
      bedrooms: input.bedrooms ?? 1,
      bathrooms: input.bathrooms ?? 1,
      amenities,
      price_per_night_pence: input.price_per_night_pence ?? null,
      currency: input.currency ?? "IDR",
      image_url: input.image_url ?? null,
      gallery_urls: input.gallery_urls ?? [],
      status: input.status ?? "draft",
      is_available: input.is_available ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `accommodation-service.createRoom: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccommodationUnitRow;
}

/** List rooms owned by a business. Optional status filter.
 *  Returns in sort_order ASC then created_at DESC. */
export async function listRoomsByBusiness(
  businessId: NexUuid,
  status?: NexAccommodationUnitStatus,
): Promise<NexAccommodationUnitRow[]> {
  let q = nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .select("*")
    .eq("business_id", businessId);
  if (status) {
    q = q.eq("status", status);
  }
  const { data, error } = await q
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `accommodation-service.listRoomsByBusiness: ${error.message}`,
    );
  }
  return (data ?? []) as NexAccommodationUnitRow[];
}

/** List rooms visible to customers · status='live' AND is_available=true.
 *  Convenience wrapper for the customer-facing render path. */
export async function listLiveAvailableRoomsByBusiness(
  businessId: NexUuid,
): Promise<NexAccommodationUnitRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "live")
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `accommodation-service.listLiveAvailableRoomsByBusiness: ${error.message}`,
    );
  }
  return (data ?? []) as NexAccommodationUnitRow[];
}

/** Fetch a single room by id. Returns null when not found. */
export async function getRoomById(
  id: NexUuid,
): Promise<NexAccommodationUnitRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`accommodation-service.getRoomById: ${error.message}`);
  }
  return (data as NexAccommodationUnitRow | null) ?? null;
}

/** Update room fields. The caller MUST verify ownership BEFORE calling
 *  this function · this layer trusts the caller to have confirmed the
 *  authenticated owner owns the business that owns the room. RLS is
 *  the defence-in-depth layer. */
export async function updateRoom(
  id: NexUuid,
  patch: NexAccommodationUnitPatch,
): Promise<NexAccommodationUnitRow> {
  // Validate any fields that are present in the patch.
  if (patch.name !== undefined) {
    assertRoomInput({ name: patch.name });
  }
  if (patch.description !== undefined && patch.description !== null) {
    assertRoomInput({ name: "placeholder", description: patch.description });
  }
  if (patch.capacity !== undefined) {
    assertRoomInput({ name: "placeholder", capacity: patch.capacity });
  }
  if (patch.bedrooms !== undefined) {
    assertRoomInput({ name: "placeholder", bedrooms: patch.bedrooms });
  }
  if (patch.bathrooms !== undefined) {
    assertRoomInput({ name: "placeholder", bathrooms: patch.bathrooms });
  }
  if (patch.price_per_night_pence !== undefined) {
    assertRoomInput({
      name: "placeholder",
      price_per_night_pence: patch.price_per_night_pence,
    });
  }
  if (patch.currency !== undefined) {
    assertRoomInput({ name: "placeholder", currency: patch.currency });
  }
  if (patch.gallery_urls !== undefined) {
    assertRoomInput({ name: "placeholder", gallery_urls: patch.gallery_urls });
  }

  // Build the update object · only include fields present in the patch.
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.capacity !== undefined) update.capacity = patch.capacity;
  if (patch.bedrooms !== undefined) update.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) update.bathrooms = patch.bathrooms;
  if (patch.amenities !== undefined) {
    update.amenities = patch.amenities
      .map(normaliseAmenity)
      .filter((v): v is string => v !== null);
  }
  if (patch.price_per_night_pence !== undefined) {
    update.price_per_night_pence = patch.price_per_night_pence;
  }
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.image_url !== undefined) update.image_url = patch.image_url;
  if (patch.gallery_urls !== undefined) {
    update.gallery_urls = patch.gallery_urls;
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `accommodation-service.updateRoom: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccommodationUnitRow;
}

/** Transition status · live ↔ draft ↔ archived.
 *  The ARCHIVE direction is the clean soft-delete · "archived"
 *  preserves the room row so past enquiries keep their references.
 *  Pass is_available separately via toggleRoomAvailable. */
export async function updateRoomStatus(
  id: NexUuid,
  status: NexAccommodationUnitStatus,
): Promise<NexAccommodationUnitRow> {
  if (!NEX_ACCOMMODATION_UNIT_STATUSES.includes(status)) {
    throw new Error(
      `accommodation-service.updateRoomStatus: invalid status '${status}'`,
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `accommodation-service.updateRoomStatus: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccommodationUnitRow;
}

/** Toggle the daily availability flag · "available tonight" vs
 *  "temporarily unavailable." Separate from status · an archived or
 *  draft room cannot be toggled (archive is deliberate · draft is
 *  not public yet). Defence-in-depth guard: fetches the row first,
 *  rejects when status !== 'live'. */
export async function toggleRoomAvailable(
  id: NexUuid,
  isAvailable: boolean,
): Promise<NexAccommodationUnitRow> {
  const current = await getRoomById(id);
  if (!current) {
    throw new Error(
      `accommodation-service.toggleRoomAvailable: room ${id} not found`,
    );
  }
  if (current.status !== "live") {
    throw new Error(
      `accommodation-service.toggleRoomAvailable: only live rooms can be toggled (status=${current.status})`,
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_accommodation_unit")
    .update({ is_available: isAvailable })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `accommodation-service.toggleRoomAvailable: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccommodationUnitRow;
}

/** Soft-archive · the sealed removal path. Hard DELETE is service-role
 *  only (RLS forbids owner DELETE) · owners archive to retire a room. */
export async function archiveRoom(
  id: NexUuid,
): Promise<NexAccommodationUnitRow> {
  return updateRoomStatus(id, "archived");
}

/** Reverse an archive · owner-initiated reactivation. Returns to
 *  DRAFT · never direct-to-live · owner re-reviews before public
 *  visibility (prevents accidental re-exposure of archived content). */
export async function unarchiveRoom(
  id: NexUuid,
): Promise<NexAccommodationUnitRow> {
  return updateRoomStatus(id, "draft");
}

/** Live → Draft · "take this offline without archiving." Preserves
 *  the room for continued editing. Different from archive (which is
 *  the retire-forever soft-delete) and from toggleRoomAvailable
 *  (which is tonight-only). */
export async function unpublishRoom(
  id: NexUuid,
): Promise<NexAccommodationUnitRow> {
  return updateRoomStatus(id, "draft");
}
