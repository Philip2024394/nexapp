// src/app/nex-native/manage/accommodation/_actions.ts
//
// Accommodation room editor server actions.
// Stream B · 2026-11-16 · S6 · owner-authorised stub replacement.
//
// -----------------------------------------------------------------
// This action powers the form on
//   /nex-native/manage/accommodation/[roomId]/page.tsx
//
// Doctrine honoured:
//   · DB-wired (sealed memory 2026-11-12): every field submitted here
//     reads from and writes to Supabase via the sealed
//     accommodation-service. No TODOs · no console-only stubs.
//   · Session resolver unification (S7): uses
//     resolveSessionWithDevOverride so dev-impersonation flows match
//     the editor PAGE (which still reads via
//     resolveNexAppSessionFromContext — unchanged in this stream
//     because the page is not an upload surface). The 2026-11-12
//     upload-bounce bug is avoided here because only ONE resolver is
//     used in the WRITE path · the page's READ resolver is
//     independent and does not bounce on write-time mismatches.
//   · Ownership fail-closed: the action loads the room, then confirms
//     `room.business_id ∈ listBusinessesByOwner(session.account.id)`
//     before issuing any update. A cross-seller roomId is rejected
//     with `e=room_forbidden` (NOT `notFound()` from an action, since
//     Next.js doesn't support throwing navigation errors cleanly from
//     write paths · a redirect with error banner is the clean fallback).
//   · NEX never transacts: `price_per_night_pence` is display-only ·
//     the field is persisted so sellers can show nightly rates to
//     guests · NEX never charges.
//   · No commits, no pushes, no migrations: this file only replaces an
//     existing stub with the already-sealed service call.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import * as accommodationService from "@/lib/nex-native/accommodation-service";

/** Parse a form value as an optional integer. Returns `undefined` when
 *  the field is absent / blank so we don't persist "0 means empty". */
function parseOptionalInt(raw: FormDataEntryValue | null): number | undefined {
  if (raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function parseOptionalNonNegativeInt(
  raw: FormDataEntryValue | null,
): number | null | undefined {
  // Special semantics: an explicit blank string means "clear this field"
  // and we persist null. An omitted field returns undefined (no change).
  // A finite non-negative integer is returned.
  if (raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.trunc(n);
}

function parseAmenities(raw: FormDataEntryValue | null): string[] | undefined {
  if (raw === null) return undefined;
  const s = String(raw);
  // The editor page submits a comma-separated list. Split, trim, drop
  // empties, dedupe. The service layer further normalises against the
  // sealed NEX_ACCOMMODATION_AMENITIES whitelist.
  const parts = s.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  const deduped = Array.from(new Set(parts));
  return deduped;
}

export async function updateRoomAction(
  businessId: string,
  roomId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/accommodation");
  }

  // Ownership gate · load owned businesses + confirm the URL businessId
  // actually belongs to the signed-in seller.
  let owned;
  try {
    owned = await businessService.listBusinessesByOwner(session.account.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not verify ownership";
    const qs = new URLSearchParams({
      e: "room_update_failed",
      m: msg,
    });
    redirect(
      `/nex-native/manage/accommodation/${roomId}?${qs.toString()}`,
    );
  }
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(businessId)) {
    const qs = new URLSearchParams({
      e: "room_forbidden",
      m: "You don't own this shop",
    });
    redirect(`/nex-native/manage/accommodation?${qs.toString()}`);
  }

  // Load the room and confirm it belongs to the claimed business.
  // Cross-seller requests surface as "forbidden" with a generic
  // banner · we deliberately do not leak whether the room exists
  // for another seller.
  let room;
  try {
    room = await accommodationService.getRoomById(roomId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load room";
    const qs = new URLSearchParams({
      e: "room_update_failed",
      m: msg,
    });
    redirect(
      `/nex-native/manage/accommodation/${roomId}?${qs.toString()}`,
    );
  }
  if (!room || room.business_id !== businessId) {
    const qs = new URLSearchParams({
      e: "room_forbidden",
      m: "You don't own this room",
    });
    redirect(`/nex-native/manage/accommodation?${qs.toString()}`);
  }

  // Parse inputs · the editor page submits fields: name, description,
  // capacity, bedrooms, bathrooms, amenities, price_per_night_pence,
  // image_url.
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = formData.get("description");
  const description =
    descriptionRaw === null
      ? undefined
      : String(descriptionRaw).trim() || null;
  const capacity = parseOptionalInt(formData.get("capacity"));
  const bedrooms = parseOptionalInt(formData.get("bedrooms"));
  const bathrooms = parseOptionalInt(formData.get("bathrooms"));
  const amenities = parseAmenities(formData.get("amenities"));
  const pricePence = parseOptionalNonNegativeInt(
    formData.get("price_per_night_pence"),
  );
  const imageRaw = formData.get("image_url");
  const imageUrl =
    imageRaw === null
      ? undefined
      : String(imageRaw).trim() || null;

  // Build a strict patch · fields outside the editor UI stay untouched.
  const patch: accommodationService.NexAccommodationUnitPatch = {};
  if (name.length > 0) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (capacity !== undefined) patch.capacity = capacity;
  if (bedrooms !== undefined) patch.bedrooms = bedrooms;
  if (bathrooms !== undefined) patch.bathrooms = bathrooms;
  if (amenities !== undefined) patch.amenities = amenities;
  if (pricePence !== undefined) patch.price_per_night_pence = pricePence;
  if (imageUrl !== undefined) patch.image_url = imageUrl;

  if (Object.keys(patch).length === 0) {
    // Nothing to save · surface a soft banner instead of silent success.
    const qs = new URLSearchParams({
      e: "room_update_noop",
      m: "No changes to save",
    });
    redirect(
      `/nex-native/manage/accommodation/${roomId}?${qs.toString()}`,
    );
  }

  try {
    await accommodationService.updateRoom(roomId, patch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save room";
    // The service throws validator strings like
    //   "accommodation-service.assertRoomInput: name must be 1-120 chars"
    // · trim the prefix so the banner reads naturally.
    const friendly = msg.replace(/^accommodation-service\.[^:]+:\s*/i, "");
    const qs = new URLSearchParams({
      e: "room_update_failed",
      m: friendly,
    });
    redirect(
      `/nex-native/manage/accommodation/${roomId}?${qs.toString()}`,
    );
  }

  // Revalidate the editor + the parent list so the next render sees the
  // fresh row without a client refresh.
  revalidatePath("/nex-native/manage/accommodation");
  revalidatePath(`/nex-native/manage/accommodation/${roomId}`);
  redirect(`/nex-native/manage/accommodation/${roomId}?ok=1`);
}
