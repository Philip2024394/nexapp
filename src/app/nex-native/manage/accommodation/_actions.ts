"use server";

// src/app/nex-native/manage/accommodation/_actions.ts
//
// Phase A1 · Accommodation management server actions.
// Owner-authorised 2026-10-21. Mirror of /manage/services/_actions.ts
// pattern · same `assertOwner` gate · same banner-redirect error path ·
// same revalidatePath discipline on write.
//
// Doctrine kept:
//   · Owner-only · every mutation starts with `assertOwner(businessId)`
//     which checks `business.owner_account_id === session.account.id`
//     BEFORE any service call. RLS on nex_accommodation_unit is
//     defence-in-depth · never the only gate.
//   · Lifecycle · uses the sealed enum (draft · live · archived).
//     DOES NOT invent a `paused` state · uses `is_available` boolean
//     for temporary-off (same mechanism as nex_menu_item).
//   · Zero inline mutation APIs that bypass the service layer ·
//     every write goes through `accommodation-service`.
//   · "NEX never handles payments" · price_per_night_pence is display
//     only · never transacted here or anywhere.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as accommodationService from "@/lib/nex-native/accommodation-service";

function bannerRedirect(code: string, message: string): never {
  redirect(
    `/nex-native/manage/accommodation?e=${code}&m=${encodeURIComponent(message)}`,
  );
}

async function assertOwner(businessId: string): Promise<void> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    bannerRedirect(
      "accommodation_forbidden",
      "You don't own this shop",
    );
  }
}

/** Parse "1,2,3" or ["a","b","c"] from form data · tolerant of either
 *  comma-separated string or multiple same-named inputs. */
function parseAmenitiesInput(formData: FormData): string[] {
  const raw = formData.getAll("amenities");
  const strings: string[] = [];
  for (const v of raw) {
    if (typeof v === "string") {
      // Allow comma-separated too so a single input "wi-fi, pool" works.
      for (const piece of v.split(",")) {
        const trimmed = piece.trim();
        if (trimmed.length > 0) strings.push(trimmed);
      }
    }
  }
  return strings;
}

function parseIntegerField(
  formData: FormData,
  name: string,
  fallback: number,
): number {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw.length === 0) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return n;
}

function parseOptionalPricePence(formData: FormData): number | null {
  const raw = String(formData.get("price_per_night_pence") ?? "").trim();
  if (raw.length === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function createRoomAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const capacity = parseIntegerField(formData, "capacity", 2);
  const bedrooms = parseIntegerField(formData, "bedrooms", 1);
  const bathrooms = parseIntegerField(formData, "bathrooms", 1);
  const amenities = parseAmenitiesInput(formData);
  const price_per_night_pence = parseOptionalPricePence(formData);
  const image_url = String(formData.get("image_url") ?? "").trim() || null;

  if (name.length === 0) {
    bannerRedirect("accommodation_no_name", "Room name is required");
  }

  try {
    await accommodationService.createRoom({
      business_id: businessId,
      name,
      description,
      capacity,
      bedrooms,
      bathrooms,
      amenities,
      price_per_night_pence,
      image_url,
      // Default to draft on create · owner publishes explicitly via
      // publishRoomAction. Prevents accidental public listing of
      // half-filled rooms.
      status: "draft",
      is_available: true,
    });
  } catch (e) {
    bannerRedirect(
      "accommodation_create_failed",
      e instanceof Error ? e.message : "Create failed",
    );
  }

  revalidatePath("/nex-native/manage/accommodation");
  // Also revalidate the owner's shop page so the new room (once
  // published) shows up without a hard refresh.
  const business = await businessService.getBusinessById(businessId);
  if (business?.slug) {
    revalidatePath(`/nex-native/${business.slug}`);
  }
  redirect("/nex-native/manage/accommodation?ok=1&m=room_created");
}

export async function updateRoomAction(
  businessId: string,
  roomId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const room = await accommodationService.getRoomById(roomId);
  if (!room || room.business_id !== businessId) {
    bannerRedirect(
      "accommodation_not_found",
      "Room not found for this shop",
    );
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) {
    bannerRedirect("accommodation_no_name", "Room name is required");
  }

  const description =
    String(formData.get("description") ?? "").trim() || null;
  const capacity = parseIntegerField(formData, "capacity", room.capacity);
  const bedrooms = parseIntegerField(formData, "bedrooms", room.bedrooms);
  const bathrooms = parseIntegerField(formData, "bathrooms", room.bathrooms);
  const amenities = parseAmenitiesInput(formData);
  const price_per_night_pence = parseOptionalPricePence(formData);
  const image_url =
    String(formData.get("image_url") ?? "").trim() || null;

  try {
    await accommodationService.updateRoom(roomId, {
      name,
      description,
      capacity,
      bedrooms,
      bathrooms,
      amenities,
      price_per_night_pence,
      image_url,
    });
  } catch (e) {
    bannerRedirect(
      "accommodation_update_failed",
      e instanceof Error ? e.message : "Save failed",
    );
  }

  revalidatePath("/nex-native/manage/accommodation");
  const business = await businessService.getBusinessById(businessId);
  if (business?.slug) {
    revalidatePath(`/nex-native/${business.slug}`);
  }
  redirect(
    `/nex-native/manage/accommodation/${roomId}?ok=1&m=room_saved`,
  );
}

/** Transition status · live ↔ draft ↔ archived.
 *  Only live↔archived and draft→live are reachable from the UI ·
 *  draft is the create-time default and the "not yet published" state.
 *  Archive is the sealed soft-remove · the row stays for history. */
export async function changeRoomStatusAction(
  businessId: string,
  roomId: string,
  nextStatus: "draft" | "live" | "archived",
): Promise<never> {
  await assertOwner(businessId);
  if (
    nextStatus !== "draft" &&
    nextStatus !== "live" &&
    nextStatus !== "archived"
  ) {
    bannerRedirect(
      "accommodation_invalid_status",
      "Invalid status transition",
    );
  }
  const room = await accommodationService.getRoomById(roomId);
  if (!room || room.business_id !== businessId) {
    bannerRedirect(
      "accommodation_not_found",
      "Room not found for this shop",
    );
  }
  try {
    await accommodationService.updateRoomStatus(roomId, nextStatus);
  } catch (e) {
    bannerRedirect(
      "accommodation_status_failed",
      e instanceof Error ? e.message : "Status change failed",
    );
  }
  revalidatePath("/nex-native/manage/accommodation");
  const business = await businessService.getBusinessById(businessId);
  if (business?.slug) {
    revalidatePath(`/nex-native/${business.slug}`);
  }
  const bannerCode =
    nextStatus === "live"
      ? "room_published"
      : nextStatus === "archived"
        ? "room_archived"
        : "room_drafted";
  redirect(`/nex-native/manage/accommodation?ok=1&m=${bannerCode}`);
}

/** Toggle the daily availability flag · the clean temporary-off
 *  mechanism · distinct from archive. Defence-in-depth: rejects
 *  when room is not live (draft and archived rooms cannot be toggled). */
export async function toggleRoomAvailableAction(
  businessId: string,
  roomId: string,
  nextIsAvailable: boolean,
): Promise<never> {
  await assertOwner(businessId);
  const room = await accommodationService.getRoomById(roomId);
  if (!room || room.business_id !== businessId) {
    bannerRedirect(
      "accommodation_not_found",
      "Room not found for this shop",
    );
  }
  if (room.status !== "live") {
    bannerRedirect(
      "accommodation_toggle_requires_live",
      "Only live rooms can be marked unavailable",
    );
  }
  try {
    await accommodationService.toggleRoomAvailable(roomId, nextIsAvailable);
  } catch (e) {
    bannerRedirect(
      "accommodation_toggle_failed",
      e instanceof Error ? e.message : "Toggle failed",
    );
  }
  revalidatePath("/nex-native/manage/accommodation");
  const business = await businessService.getBusinessById(businessId);
  if (business?.slug) {
    revalidatePath(`/nex-native/${business.slug}`);
  }
  redirect(
    `/nex-native/manage/accommodation?ok=1&m=${nextIsAvailable ? "room_marked_available" : "room_marked_unavailable"}`,
  );
}
